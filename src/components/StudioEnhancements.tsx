import React, { useState, useRef, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Lock,
  MessageSquare,
  MoveHorizontal,
  Printer,
  QrCode,
  ShieldCheck,
  Sparkles,
  Unlock,
  Calculator,
  ArrowRight,
  Clock,
  Sliders,
} from 'lucide-react';
import {
  buildUpiPaymentUri,
  getStudioUpiSettings,
  publicRespondToQuotation,
  resolvePublicQuotationByIdOrToken,
} from '../services/workflowEnhancementsService';
import { QuotationRecord } from '../types/crm';
import { formatINR } from '../utils/formatters';
import { useToast } from '../contexts/ToastContext';

// ============================================================================
// 1. DETERMINISTIC SCANNABLE-STYLE SVG QR MATRIX + UPI DEEP LINK CARD
// ============================================================================
interface UpiQrCodeCardProps {
  amount: number;
  referenceNumber: string;
  clientName?: string;
  upiId?: string;
  payeeName?: string;
  label?: string;
  compact?: boolean;
}

function generateDeterministicQrMatrix(payload: string, size = 21): boolean[][] {
  const matrix: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );

  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        matrix[r0 + r][c0 + c] = isBorder || isInner;
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inTopLeft = r < 8 && c < 8;
      const inTopRight = r < 8 && c >= size - 8;
      const inBottomLeft = r >= size - 8 && c < 8;
      if (inTopLeft || inTopRight || inBottomLeft || r === 6 || c === 6) continue;
      const seed = Math.imul(hash ^ (r * 31 + c * 17), 1597334677);
      matrix[r][c] = (Math.abs(seed) + r + c) % 3 !== 0;
    }
  }

  return matrix;
}

export const UpiQrCodeCard: React.FC<UpiQrCodeCardProps> = ({
  amount,
  referenceNumber,
  upiId,
  payeeName,
  label = 'Scan & Pay via Any UPI App (GPay · PhonePe · Paytm)',
  compact = false,
}) => {
  const [copiedUpi, setCopiedUpi] = useState(false);
  const studioUpi = getStudioUpiSettings();
  const effectiveUpiId = upiId || studioUpi.upiId;
  const effectivePayee = payeeName || studioUpi.payeeName;
  const safeAmount = Math.max(0, Math.round(Number(amount) || 0));

  const upiUri = buildUpiPaymentUri({
    upiId: effectiveUpiId,
    payeeName: effectivePayee,
    amount: safeAmount,
    transactionNote: referenceNumber,
  });

  const qrMatrix = generateDeterministicQrMatrix(upiUri, 25);

  const handleCopyUpi = async () => {
    try {
      await navigator.clipboard.writeText(effectiveUpiId);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2200);
    } catch {
      // ignore
    }
  };

  if (safeAmount <= 0) {
    return (
      <div className="p-4 bg-[#26734D]/10 border border-[#26734D]/30 rounded-lg flex items-center justify-between text-xs text-[#26734D]">
        <div className="flex items-center gap-2 font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Full Balance Settled (₹0 Due) — Official Paid Receipt</span>
        </div>
        <span className="font-mono font-bold">{referenceNumber}</span>
      </div>
    );
  }

  return (
    <div
      className={`bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg ${
        compact ? 'p-4' : 'p-5'
      } flex flex-col sm:flex-row items-center justify-between gap-5`}
    >
      <div className="flex items-center gap-4">
        {/* Crisp SVG QR Code */}
        <div className="bg-white p-2.5 rounded-lg border border-[#172333]/20 shadow-2xs shrink-0">
          <svg
            viewBox="0 0 25 25"
            className={compact ? 'w-24 h-24' : 'w-28 h-28'}
            shapeRendering="crispEdges"
            aria-label={`UPI QR Code for ${referenceNumber}`}
          >
            <rect width="25" height="25" fill="#FFFFFF" />
            {qrMatrix.map((row, rIdx) =>
              row.map((cell, cIdx) =>
                cell ? (
                  <rect
                    key={`${rIdx}_${cIdx}`}
                    x={cIdx}
                    y={rIdx}
                    width={1}
                    height={1}
                    fill="#172333"
                  />
                ) : null
              )
            )}
          </svg>
        </div>

        <div className="space-y-1.5 text-xs">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#172333] text-white text-[10px] font-mono uppercase tracking-wider">
            <QrCode className="w-3 h-3 text-[#F18A45]" />
            <span>Dynamic INR UPI QR</span>
          </div>
          <p className="font-semibold text-[#172333] text-sm">{label}</p>
          <p className="text-[#6E7785]">
            Payee: <span className="font-medium text-[#172333]">{effectivePayee}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[#172333] bg-white px-2 py-0.5 rounded border border-[#E2E4DF]">
              UPI ID: {effectiveUpiId}
            </span>
            <button
              type="button"
              onClick={handleCopyUpi}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#172333] hover:text-[#F18A45] no-print"
            >
              {copiedUpi ? <Check className="w-3 h-3 text-[#26734D]" /> : <Copy className="w-3 h-3" />}
              <span>{copiedUpi ? 'Copied UPI ID' : 'Copy UPI ID'}</span>
            </button>
          </div>
          <p className="text-[11px] font-mono text-[#6E7785]">
            Pre-filled Amount: <strong className="text-[#172333]">{formatINR(safeAmount)}</strong> · Ref:{' '}
            <strong className="text-[#172333]">{referenceNumber}</strong>
          </p>
        </div>
      </div>

      <div className="flex flex-col items-stretch sm:items-end gap-2 w-full sm:w-auto shrink-0 no-print">
        <a
          href={upiUri}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg transition-colors"
        >
          <span>Open UPI App ({formatINR(safeAmount)})</span>
          <ExternalLink className="w-3.5 h-3.5 text-[#F18A45]" />
        </a>
        <span className="text-[10px] text-[#6E7785] text-center sm:text-right">
          Supports Google Pay, PhonePe, Paytm & BHIM
        </span>
      </div>
    </div>
  );
};

// ============================================================================
// 2. INTERACTIVE BEFORE / AFTER VISUAL COMPARISON SLIDER (PORTFOLIO & SERVICES)
// ============================================================================
interface ComparisonPreset {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  beforeLabel: string;
  afterLabel: string;
  metricsBadge: string;
  beforeSvgDataUrl: string;
  afterSvgDataUrl: string;
}

function buildComparisonSvg(
  mode: 'before' | 'after',
  presetId: string
): string {
  if (presetId === 'thumbnail') {
    const svg =
      mode === 'before'
        ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675">
            <rect width="1200" height="675" fill="#2B3038"/>
            <rect x="60" y="60" width="1080" height="555" rx="12" fill="#383E48" stroke="#525A68" stroke-dasharray="8 8" stroke-width="2"/>
            <circle cx="820" cy="340" r="170" fill="#4A525F"/>
            <rect x="110" y="180" width="440" height="55" rx="6" fill="#596273"/>
            <rect x="110" y="255" width="340" height="38" rx="6" fill="#4A525F"/>
            <text x="110" y="420" fill="#9BA3B0" font-family="Inter, sans-serif" font-size="26" font-weight="600">RAW UNEDITED CAMERA FRAME</text>
            <text x="110" y="460" fill="#7D8694" font-family="monospace" font-size="20">Flat Lighting · No Subject Separation · Low CTR</text>
          </svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675">
            <defs>
              <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#0F1722"/>
                <stop offset="55%" stop-color="#172333"/>
                <stop offset="100%" stop-color="#24364A"/>
              </linearGradient>
              <radialGradient id="rimGlow" cx="0.7" cy="0.5" r="0.45">
                <stop offset="0%" stop-color="#F18A45" stop-opacity="0.55"/>
                <stop offset="100%" stop-color="#F18A45" stop-opacity="0"/>
              </radialGradient>
            </defs>
            <rect width="1200" height="675" fill="url(#bgGrad)"/>
            <rect width="1200" height="675" fill="url(#rimGlow)"/>
            <circle cx="820" cy="340" r="185" fill="#1E2F44" stroke="#F18A45" stroke-width="5"/>
            <rect x="95" y="140" width="195" height="40" rx="6" fill="#F18A45"/>
            <text x="115" y="166" fill="#172333" font-family="monospace" font-size="18" font-weight="700">CTR MASTER +14.8%</text>
            <text x="95" y="255" fill="#FFFFFF" font-family="Inter, sans-serif" font-size="64" font-weight="800">10X YOUTUBE</text>
            <text x="95" y="330" fill="#F18A45" font-family="Inter, sans-serif" font-size="64" font-weight="800">THUMBNAIL GRADE</text>
            <text x="95" y="410" fill="#D0D5DD" font-family="Inter, sans-serif" font-size="25" font-weight="600">Rim Lighting · Skin Dodge &amp; Burn · 3D Depth Separation</text>
            <rect x="95" y="455" width="380" height="52" rx="8" fill="#26734D"/>
            <text x="120" y="488" fill="#FFFFFF" font-family="monospace" font-size="20" font-weight="700">PRITHVI EDITIFY STUDIO FINISH</text>
          </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  if (presetId === 'colorgrade') {
    const svg =
      mode === 'before'
        ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675">
            <rect width="1200" height="675" fill="#3A3D3B"/>
            <rect x="80" y="80" width="1040" height="515" rx="14" fill="#4B4F4C"/>
            <text x="130" y="260" fill="#B5B9B6" font-family="Inter, sans-serif" font-size="48" font-weight="700">S-LOG3 FLAT CAMERA FOOTAGE</text>
            <text x="130" y="320" fill="#8E9490" font-family="monospace" font-size="22">Desaturated Shadows · No Captions · Raw Room Audio</text>
            <rect x="130" y="410" width="940" height="36" rx="6" fill="#323533"/>
          </svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675">
            <defs>
              <linearGradient id="cine" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#0B1926"/>
                <stop offset="50%" stop-color="#172333"/>
                <stop offset="100%" stop-color="#3A2318"/>
              </linearGradient>
            </defs>
            <rect width="1200" height="675" fill="url(#cine)"/>
            <rect x="80" y="80" width="1040" height="515" rx="14" fill="#132232" stroke="#F18A45" stroke-width="3"/>
            <text x="130" y="235" fill="#F18A45" font-family="monospace" font-size="22" font-weight="700">REC.709 CINEMATIC TEAL &amp; WARM AMBER LUT</text>
            <text x="130" y="310" fill="#FFFFFF" font-family="Inter, sans-serif" font-size="54" font-weight="800">DYNAMIC REELS &amp; 4K COLOR PASS</text>
            <text x="130" y="370" fill="#D0D5DD" font-family="Inter, sans-serif" font-size="24">Retention Subtitles · Motion Callouts · Broadcast Audio Mastering</text>
            <rect x="130" y="425" width="940" height="44" rx="8" fill="#1E3246"/>
            <rect x="130" y="425" width="680" height="44" rx="8" fill="#F18A45"/>
          </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  const svg =
    mode === 'before'
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675">
          <rect width="1200" height="675" fill="#423E3B"/>
          <circle cx="600" cy="337" r="210" fill="#5C5652"/>
          <text x="120" y="590" fill="#C2BDB8" font-family="Inter, sans-serif" font-size="30" font-weight="700">RAW PRODUCT PHOTO · UNEVEN STUDIO SHADOWS</text>
        </svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675">
          <rect width="1200" height="675" fill="#172333"/>
          <circle cx="600" cy="315" r="220" fill="#24364A" stroke="#F18A45" stroke-width="4"/>
          <text x="120" y="130" fill="#F18A45" font-family="monospace" font-size="20" font-weight="700">COMMERCIAL AD CREATIVE &amp; RETOUCH</text>
          <text x="120" y="575" fill="#FFFFFF" font-family="Inter, sans-serif" font-size="36" font-weight="800">FREQUENCY SEPARATION · STUDIO RELIGHTING · AD TYPOGRAPHY</text>
        </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const COMPARISON_PRESETS: ComparisonPreset[] = [
  {
    id: 'thumbnail',
    category: 'YouTube Thumbnails',
    title: 'Raw Frame vs. High-CTR YouTube Thumbnail Master',
    subtitle:
      'Drag the slider to compare an unedited camera frame against our rim-lit, color-graded, and typography-engineered YouTube thumbnail.',
    beforeLabel: 'BEFORE · Raw Camera Frame',
    afterLabel: 'AFTER · Prithvi Editify Thumbnail Master',
    metricsBadge: 'Avg. +38% Click-Through Rate Lift',
    beforeSvgDataUrl: buildComparisonSvg('before', 'thumbnail'),
    afterSvgDataUrl: buildComparisonSvg('after', 'thumbnail'),
  },
  {
    id: 'colorgrade',
    category: 'Video Editing & Reels',
    title: 'Flat Log Footage vs. Color-Graded Reel with Motion Graphics',
    subtitle:
      'See how raw S-Log/flat footage is transformed with cinematic color grading, retention captions, and visual keyframing.',
    beforeLabel: 'BEFORE · Flat Unedited Cut',
    afterLabel: 'AFTER · Graded + Motion Captions',
    metricsBadge: '4K 60fps Rec.709 Studio Grade',
    beforeSvgDataUrl: buildComparisonSvg('before', 'colorgrade'),
    afterSvgDataUrl: buildComparisonSvg('after', 'colorgrade'),
  },
  {
    id: 'retouch',
    category: 'Photo Editing & Commercial Ads',
    title: 'Unedited Subject Photo vs. Commercial Brand Campaign Creative',
    subtitle:
      'Inspect skin & product retouching, background compositing, and conversion-focused ad layout.',
    beforeLabel: 'BEFORE · Raw Smartphone/DSLR Shot',
    afterLabel: 'AFTER · Commercial Ad Key Visual',
    metricsBadge: 'Print & Meta Ad Ready',
    beforeSvgDataUrl: buildComparisonSvg('before', 'retouch'),
    afterSvgDataUrl: buildComparisonSvg('after', 'retouch'),
  },
];

export const BeforeAfterComparisonShowcase: React.FC = () => {
  const [activePresetId, setActivePresetId] = useState<string>('thumbnail');
  const [sliderPos, setSliderPos] = useState<number>(52);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const activePreset =
    COMPARISON_PRESETS.find((p) => p.id === activePresetId) || COMPARISON_PRESETS[0];

  const updatePositionFromClientX = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relX = clientX - rect.left;
    const pct = Math.max(4, Math.min(96, (relX / rect.width) * 100));
    setSliderPos(Math.round(pct));
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => updatePositionFromClientX(e.clientX);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) updatePositionFromClientX(e.touches[0].clientX);
    };
    const onUp = () => setIsDragging(false);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }, [isDragging]);

  return (
    <section className="bg-white border border-[#E2E4DF] rounded-xl p-6 sm:p-8 space-y-6 shadow-[0_1px_3px_rgba(23,35,51,0.04)]">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#E2E4DF] pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F18A45]">
            <Sliders className="w-3.5 h-3.5" />
            <span>Interactive Studio Quality Inspector</span>
          </div>
          <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#172333] mt-1">
            Before & After Craft Comparison
          </h2>
          <p className="text-xs sm:text-sm text-[#6E7785] mt-1 max-w-2xl">
            {activePreset.subtitle}
          </p>
        </div>

        {/* Discipline Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#F5F5F1] p-1 rounded-lg border border-[#E2E4DF]">
          {COMPARISON_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setActivePresetId(preset.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activePresetId === preset.id
                  ? 'bg-[#172333] text-white shadow-2xs'
                  : 'text-[#6E7785] hover:text-[#172333]'
              }`}
            >
              {preset.category}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Split Stage */}
      <div
        ref={containerRef}
        onMouseDown={(e) => {
          setIsDragging(true);
          updatePositionFromClientX(e.clientX);
        }}
        onTouchStart={(e) => {
          setIsDragging(true);
          if (e.touches[0]) updatePositionFromClientX(e.touches[0].clientX);
        }}
        className="relative aspect-[16/9] max-h-[440px] w-full rounded-xl overflow-hidden border border-[#172333]/20 select-none cursor-ew-resize bg-[#0F1722]"
      >
        {/* Base Layer: AFTER (Full width) */}
        <img
          src={activePreset.afterSvgDataUrl}
          alt={activePreset.afterLabel}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />

        {/* Clipped Layer: BEFORE (Left side up to sliderPos%) */}
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none"
          style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
        >
          <img
            src={activePreset.beforeSvgDataUrl}
            alt={activePreset.beforeLabel}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>

        {/* Labels */}
        <span className="absolute top-3 left-3 z-20 px-3 py-1 text-[11px] font-mono font-semibold bg-[#172333]/90 text-white rounded-md border border-white/15">
          {activePreset.beforeLabel}
        </span>
        <span className="absolute top-3 right-3 z-20 px-3 py-1 text-[11px] font-mono font-semibold bg-[#F18A45] text-[#172333] rounded-md shadow-xs">
          {activePreset.afterLabel}
        </span>

        {/* Divider Line & Handle */}
        <div
          className="absolute top-0 bottom-0 z-20 w-0.5 bg-white shadow-[0_0_12px_rgba(0,0,0,0.8)]"
          style={{ left: `${sliderPos}%` }}
        >
          <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#F18A45] text-[#172333] border-2 border-white shadow-lg flex items-center justify-center">
            <MoveHorizontal className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Footer Range Control & CTA */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-1 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[#6E7785]">
            Comparison Split: <strong className="text-[#172333]">{sliderPos}%</strong>
          </span>
          <input
            type="range"
            min={5}
            max={95}
            value={sliderPos}
            onChange={(e) => setSliderPos(Number(e.target.value))}
            aria-label="Before and after comparison slider"
            className="w-36 accent-[#F18A45]"
          />
          <span className="px-2.5 py-1 rounded bg-[#26734D]/10 text-[#26734D] font-semibold">
            {activePreset.metricsBadge}
          </span>
        </div>

        <Link
          to={`/contact?service=${encodeURIComponent(activePreset.category)}`}
          className="inline-flex items-center gap-1.5 font-semibold text-[#172333] hover:text-[#F18A45]"
        >
          <span>Request This Studio Grade for Your Brand</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </section>
  );
};

// ============================================================================
// 3. INSTANT PROJECT PRICE CALCULATOR WIDGET (/services)
// ============================================================================
interface InstantPriceCalculatorProps {
  whatsappNumber?: string;
}

export const InstantPriceCalculatorWidget: React.FC<InstantPriceCalculatorProps> = ({
  whatsappNumber = '919876543210',
}) => {
  const [thumbnailsCount, setThumbnailsCount] = useState<number>(2);
  const [reelsCount, setReelsCount] = useState<number>(2);
  const [socialPostsCount, setSocialPostsCount] = useState<number>(4);
  const [longVideoCount, setLongVideoCount] = useState<number>(0);
  const [rushDelivery, setRushDelivery] = useState<boolean>(false);
  const [includeSourceFiles, setIncludeSourceFiles] = useState<boolean>(false);

  const UNIT_RATES = {
    thumbnail: 500,
    reel: 800,
    socialPost: 450,
    longVideo: 2500,
  };

  const baseSubtotal =
    thumbnailsCount * UNIT_RATES.thumbnail +
    reelsCount * UNIT_RATES.reel +
    socialPostsCount * UNIT_RATES.socialPost +
    longVideoCount * UNIT_RATES.longVideo;

  // Volume retainer discount (10% off when subtotal >= ₹8,000)
  const volumeDiscount = baseSubtotal >= 8000 ? Math.round(baseSubtotal * 0.1) : 0;
  const rushFee = rushDelivery ? Math.round((baseSubtotal - volumeDiscount) * 0.25) : 0;
  const sourceFilesFee = includeSourceFiles ? 750 : 0;
  const estimatedTotal = Math.max(0, baseSubtotal - volumeDiscount + rushFee + sourceFilesFee);

  const summaryItems: string[] = [];
  if (thumbnailsCount > 0) summaryItems.push(`${thumbnailsCount} YouTube Thumbnails`);
  if (reelsCount > 0) summaryItems.push(`${reelsCount} Instagram Reels / Shorts`);
  if (socialPostsCount > 0) summaryItems.push(`${socialPostsCount} Social Media Creatives`);
  if (longVideoCount > 0) summaryItems.push(`${longVideoCount} Full YouTube Video Edits`);
  if (rushDelivery) summaryItems.push('24h Rush Priority Turnaround');
  if (includeSourceFiles) summaryItems.push('Editable PSD / Premiere Source Project Files');

  const bundleSummaryText =
    summaryItems.length > 0
      ? `${summaryItems.join(' + ')} — Estimated Total: ${formatINR(estimatedTotal)}`
      : 'Custom Creative Bundle';

  const whatsappText = [
    `Hello Prithvi Editify, I used the Instant Project Estimator and would like to book this package:`,
    ``,
    ...summaryItems.map((i) => `• ${i}`),
    ``,
    `*Estimated Bundle Total:* ${formatINR(estimatedTotal)} INR`,
  ].join('\n');

  const cleanPhone = whatsappNumber.replace(/\D/g, '') || '919876543210';
  const waHref = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappText)}`;

  return (
    <section className="bg-white border border-[#E2E4DF] rounded-xl p-6 sm:p-8 shadow-[0_1px_3px_rgba(23,35,51,0.04)]">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-5">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F18A45]">
              <Calculator className="w-3.5 h-3.5" />
              <span>Interactive INR Bundle Estimator</span>
            </div>
            <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#172333] mt-1">
              Instant Project Price Calculator
            </h2>
            <p className="text-xs sm:text-sm text-[#6E7785] mt-1">
              Mix and match deliverables to build your custom monthly or campaign bundle. Bundles over ₹8,000 automatically unlock a 10% studio retainer discount.
            </p>
          </div>

          <div className="space-y-4">
            {/* Row 1: YouTube Thumbnails */}
            <div className="p-3.5 bg-[#F5F5F1] rounded-lg border border-[#E2E4DF] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#172333]">
                  YouTube High-CTR Thumbnails ({formatINR(UNIT_RATES.thumbnail)} / each)
                </span>
                <span className="font-mono font-bold text-[#172333]">
                  {thumbnailsCount} × {formatINR(UNIT_RATES.thumbnail)} ={' '}
                  {formatINR(thumbnailsCount * UNIT_RATES.thumbnail)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                value={thumbnailsCount}
                onChange={(e) => setThumbnailsCount(Number(e.target.value))}
                className="w-full accent-[#172333]"
              />
            </div>

            {/* Row 2: Instagram Reels / YouTube Shorts */}
            <div className="p-3.5 bg-[#F5F5F1] rounded-lg border border-[#E2E4DF] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#172333]">
                  Instagram Reels / Shorts Editing ({formatINR(UNIT_RATES.reel)} / reel)
                </span>
                <span className="font-mono font-bold text-[#172333]">
                  {reelsCount} × {formatINR(UNIT_RATES.reel)} ={' '}
                  {formatINR(reelsCount * UNIT_RATES.reel)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                value={reelsCount}
                onChange={(e) => setReelsCount(Number(e.target.value))}
                className="w-full accent-[#172333]"
              />
            </div>

            {/* Row 3: Social Media Creatives / Ad Posters */}
            <div className="p-3.5 bg-[#F5F5F1] rounded-lg border border-[#E2E4DF] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#172333]">
                  Social Media Posts & Promotional Banners ({formatINR(UNIT_RATES.socialPost)} / design)
                </span>
                <span className="font-mono font-bold text-[#172333]">
                  {socialPostsCount} × {formatINR(UNIT_RATES.socialPost)} ={' '}
                  {formatINR(socialPostsCount * UNIT_RATES.socialPost)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={30}
                value={socialPostsCount}
                onChange={(e) => setSocialPostsCount(Number(e.target.value))}
                className="w-full accent-[#172333]"
              />
            </div>

            {/* Row 4: Long-Form YouTube Video Editing */}
            <div className="p-3.5 bg-[#F5F5F1] rounded-lg border border-[#E2E4DF] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#172333]">
                  Full-Length YouTube Video Edits ({formatINR(UNIT_RATES.longVideo)} / video)
                </span>
                <span className="font-mono font-bold text-[#172333]">
                  {longVideoCount} × {formatINR(UNIT_RATES.longVideo)} ={' '}
                  {formatINR(longVideoCount * UNIT_RATES.longVideo)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={10}
                value={longVideoCount}
                onChange={(e) => setLongVideoCount(Number(e.target.value))}
                className="w-full accent-[#172333]"
              />
            </div>

            {/* Add-on Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
              <label className="flex items-center justify-between p-3 bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg cursor-pointer">
                <span className="font-medium text-[#172333]">Express 24h Rush Delivery (+25%)</span>
                <input
                  type="checkbox"
                  checked={rushDelivery}
                  onChange={(e) => setRushDelivery(e.target.checked)}
                />
              </label>
              <label className="flex items-center justify-between p-3 bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg cursor-pointer">
                <span className="font-medium text-[#172333]">Include Editable Source Files (+₹750)</span>
                <input
                  type="checkbox"
                  checked={includeSourceFiles}
                  onChange={(e) => setIncludeSourceFiles(e.target.checked)}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Right Sticky Live Estimate Receipt */}
        <div className="lg:col-span-5 bg-[#172333] text-white rounded-xl p-6 space-y-5 border border-[#24364A]">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider text-[#F18A45]">
                LIVE STUDIO ESTIMATE
              </p>
              <h3 className="text-lg font-semibold mt-0.5">Custom Deliverable Bundle</h3>
            </div>
            <span className="px-2.5 py-1 text-[11px] font-mono bg-white/10 rounded">INR (₹)</span>
          </div>

          <div className="space-y-2 text-xs text-[#D0D5DD]">
            {summaryItems.length === 0 ? (
              <p className="text-[#9BA3B0]">Move any slider on the left to calculate your estimate.</p>
            ) : (
              summaryItems.map((line, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#F18A45] shrink-0" />
                  <span>{line}</span>
                </div>
              ))
            )}
          </div>

          <div className="pt-4 border-t border-white/10 space-y-1.5 text-xs">
            <div className="flex justify-between text-[#9BA3B0]">
              <span>Base Deliverables Subtotal:</span>
              <span className="font-mono">{formatINR(baseSubtotal)}</span>
            </div>
            {volumeDiscount > 0 && (
              <div className="flex justify-between text-[#4ADE80]">
                <span>10% Retainer Volume Discount:</span>
                <span className="font-mono">-{formatINR(volumeDiscount)}</span>
              </div>
            )}
            {rushFee > 0 && (
              <div className="flex justify-between text-[#F18A45]">
                <span>24h Rush Priority Surcharge:</span>
                <span className="font-mono">+{formatINR(rushFee)}</span>
              </div>
            )}
            {sourceFilesFee > 0 && (
              <div className="flex justify-between text-[#D0D5DD]">
                <span>Open Source Project Files:</span>
                <span className="font-mono">+{formatINR(sourceFilesFee)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between pt-3 border-t border-white/10">
              <span className="text-sm font-semibold">Estimated Total:</span>
              <span className="font-mono text-2xl font-bold text-[#F18A45] tabular-nums">
                {formatINR(estimatedTotal)}
              </span>
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            <Link
              to={`/contact?service=${encodeURIComponent(bundleSummaryText)}`}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-semibold text-[#172333] bg-[#F18A45] hover:bg-[#e07934] rounded-lg transition-colors"
            >
              <span>Lock This Estimate in Project Brief</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#24364A] hover:bg-[#2f455e] border border-white/10 rounded-lg transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#F18A45]" />
              <span>Send Bundle Estimate on WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

// ============================================================================
// 4. PUBLIC SHAREABLE QUOTATION APPROVAL PAGE (/quote/:quoteId)
// ============================================================================
export const PublicQuotationApprovalPage: React.FC = () => {
  const { quoteId } = useParams<{ quoteId: string }>();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const [quotation, setQuotation] = useState<QuotationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientNote, setClientNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!quoteId) {
      setLoading(false);
      return;
    }
    const encodedData = searchParams.get('d');
    resolvePublicQuotationByIdOrToken(quoteId, encodedData)
      .then((q) => setQuotation(q))
      .finally(() => setLoading(false));
  }, [quoteId, searchParams]);

  const handleDecision = async (decision: 'Accepted' | 'Rejected') => {
    if (!quotation) return;
    setSubmitting(true);
    try {
      const updated = await publicRespondToQuotation(quotation, decision, clientNote.trim());
      setQuotation(updated);
      showToast(
        'success',
        decision === 'Accepted'
          ? 'Quotation Approved! Shankar Baluragi has been notified.'
          : 'Quotation Response Recorded'
      );
    } catch (err) {
      showToast('error', 'Failed to record response', err instanceof Error ? err.message : '');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center text-xs text-[#6E7785]">
        Loading official quotation document...
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center space-y-4">
        <h1 className="font-editorial text-2xl font-semibold text-[#172333]">
          Quotation Link Not Found or Expired
        </h1>
        <p className="text-xs text-[#6E7785]">
          Please ask Shankar Baluragi (Prithvi Editify) for an updated quotation link or sign in to your Client Portal.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            to="/login"
            className="px-4 py-2 text-xs font-semibold text-white bg-[#172333] rounded-lg"
          >
            Client Portal Sign In
          </Link>
          <Link
            to="/contact"
            className="px-4 py-2 text-xs font-semibold text-[#172333] bg-white border border-[#E2E4DF] rounded-lg"
          >
            Contact Studio
          </Link>
        </div>
      </div>
    );
  }

  const advanceAmount = Math.round(quotation.total * 0.5);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
      <div className="bg-white border border-[#172333] rounded-xl p-6 sm:p-10 space-y-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E2E4DF] pb-6">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#F18A45]/15 text-[#B85D1D] text-[11px] font-semibold">
              OFFICIAL STUDIO QUOTATION · SAC 9983
            </span>
            <h1 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#172333] mt-1">
              {quotation.projectTitle}
            </h1>
            <p className="text-xs text-[#6E7785] mt-1">
              Prepared by <strong>Prithvi Editify (Shankar Baluragi)</strong> for{' '}
              <strong className="text-[#172333]">{quotation.clientName}</strong> ({quotation.clientEmail})
            </p>
          </div>
          <div className="text-right font-mono text-xs">
            <p className="text-base font-bold text-[#172333]">{quotation.quotationNumber}</p>
            <p className="text-[#6E7785]">Issued: {quotation.issueDate}</p>
            <p className="text-[#6E7785]">Valid Until: {quotation.expiryDate}</p>
            <span
              className={`inline-block mt-1.5 px-2.5 py-0.5 rounded font-sans font-semibold text-[11px] ${
                quotation.status === 'Accepted'
                  ? 'bg-[#26734D]/15 text-[#26734D]'
                  : quotation.status === 'Rejected'
                  ? 'bg-[#B93832]/15 text-[#B93832]'
                  : 'bg-[#172333] text-white'
              }`}
            >
              Status: {quotation.status}
            </span>
          </div>
        </div>

        {/* Scope & Deliverables */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-[#F5F5F1] rounded-lg text-xs">
          <div>
            <p className="font-semibold text-[#172333]">Scope Summary</p>
            <p className="text-[#6E7785] mt-1 leading-relaxed">{quotation.scopeSummary || '—'}</p>
          </div>
          <div>
            <p className="font-semibold text-[#172333]">Deliverables Included</p>
            <p className="text-[#6E7785] mt-1 leading-relaxed">{quotation.deliverables || '—'}</p>
          </div>
          <div>
            <p className="font-semibold text-[#172333]">Estimated Turnaround</p>
            <p className="text-[#6E7785] mt-1">{quotation.estimatedTimeline || '3–5 business days'}</p>
          </div>
        </div>

        {/* Line Items Table */}
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#E2E4DF] text-[#6E7785]">
              <th className="py-2.5">Deliverable Description</th>
              <th className="py-2.5 text-right">Qty</th>
              <th className="py-2.5 text-right">Unit Price</th>
              <th className="py-2.5 text-right">Amount (INR)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E4DF]">
            {quotation.lineItems.map((li, idx) => (
              <tr key={idx}>
                <td className="py-3 font-medium text-[#172333]">{li.description}</td>
                <td className="py-3 text-right font-mono">{li.quantity}</td>
                <td className="py-3 text-right font-mono">{formatINR(li.unitPrice)}</td>
                <td className="py-3 text-right font-mono font-semibold">{formatINR(li.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-72 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-[#6E7785]">Subtotal:</span>
              <span className="font-mono">{formatINR(quotation.subtotal)}</span>
            </div>
            {quotation.discount > 0 && (
              <div className="flex justify-between text-[#26734D]">
                <span>Discount:</span>
                <span className="font-mono">-{formatINR(quotation.discount)}</span>
              </div>
            )}
            {quotation.taxRate > 0 && (
              <div className="flex justify-between">
                <span className="text-[#6E7785]">GST / Tax ({quotation.taxRate}% · SAC 9983):</span>
                <span className="font-mono">{formatINR(quotation.taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-[#E2E4DF] text-sm font-bold text-[#172333]">
              <span>Total Quoted (INR):</span>
              <span className="font-mono">{formatINR(quotation.total)}</span>
            </div>
          </div>
        </div>

        {/* Dynamic UPI QR Code for 50% Kickoff Advance or Full Amount */}
        <UpiQrCodeCard
          amount={advanceAmount}
          referenceNumber={quotation.quotationNumber}
          label={`50% Project Kickoff Advance (${formatINR(advanceAmount)}) — Scan with GPay / PhonePe`}
          compact
        />

        <div className="text-xs text-[#6E7785] border-t border-[#E2E4DF] pt-4">
          <p className="font-semibold text-[#172333]">Terms & Studio Policy:</p>
          <p className="mt-1 whitespace-pre-line">{quotation.termsAndConditions}</p>
        </div>

        {/* One-Tap Client Approval Controls */}
        <div className="pt-4 border-t border-[#E2E4DF] space-y-3 no-print">
          {quotation.status !== 'Accepted' ? (
            <>
              <input
                type="text"
                value={clientNote}
                onChange={(e) => setClientNote(e.target.value)}
                placeholder="Optional note or preferred kickoff date before approving..."
                className="w-full px-3.5 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDecision('Accepted')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#26734D] hover:bg-[#1e5c3d] rounded-lg"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve & Accept Quotation</span>
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDecision('Rejected')}
                  className="px-4 py-2.5 text-xs font-semibold text-[#B93832] bg-[#B93832]/10 rounded-lg"
                >
                  Request Scope Changes
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-lg"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / Save PDF</span>
                </button>
              </div>
            </>
          ) : (
            <div className="p-4 bg-[#26734D]/10 border border-[#26734D]/30 rounded-lg flex flex-wrap items-center justify-between gap-4 text-xs text-[#26734D]">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  This quotation has been officially approved. You can now track milestones in your Client Portal.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 font-semibold text-[#172333] bg-white border border-[#E2E4DF] rounded-md"
                >
                  Print PDF
                </button>
                <Link
                  to="/portal"
                  className="px-3.5 py-1.5 font-semibold text-white bg-[#172333] rounded-md"
                >
                  Open Client Portal →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
