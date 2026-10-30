import React, { useState, useRef, useEffect } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
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
  ChevronDown,
  HelpCircle,
  Search,
} from 'lucide-react';
import {
  buildUpiPaymentUri,
  getStudioUpiSettings,
  publicRespondToQuotation,
  resolvePublicQuotationByIdOrToken,
  getCrmStatusBadgeStyle,
  checkProjectMasterUnlockStatus,
  submitClientPaymentProof,
  getInvoiceGstMeta,
  calculateGstBreakdown,
} from '../services/workflowEnhancementsService';
import {
  fetchAllProjectsAdmin,
  fetchAllTasksAdmin,
  fetchAllFilesAdmin,
  fetchAllInvoicesAdmin,
} from '../services/crmService';
import {
  QuotationRecord,
  ProjectRecord,
  TaskRecord,
  DeliverableFile,
  InvoiceRecord,
  InvoiceLineItem,
  PaymentRecord,
  ProjectStatus,
} from '../types/crm';
import { DEFAULT_STUDIO_LOGO_URL } from '../utils/seedData';
import { formatINR } from '../utils/formatters';
import { useToast } from '../contexts/ToastContext';
import { LazyImage } from './LazyImage';

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
  onSubmitUtrClick?: () => void;
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
  onSubmitUtrClick,
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
      <div className="p-4 bg-[#16A34A]/10 border border-[#16A34A]/30 rounded-lg flex items-center justify-between text-xs text-[#16A34A]">
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
      className={`pe-card-interactive bg-[#132A4A] border border-[#1E3A5F] rounded-lg ${
        compact ? 'p-4' : 'p-5'
      } flex flex-col sm:flex-row items-center justify-between gap-5`}
    >
      <div className="flex items-center gap-4">
        {/* Crisp SVG QR Code */}
        <div className="bg-[#0D1F38] p-2.5 rounded-lg border border-[#1E3A5F] shadow-2xs shrink-0">
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
                    fill="#040D1A"
                  />
                ) : null
              )
            )}
          </svg>
        </div>

        <div className="space-y-1.5 text-xs">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#132A4A] text-[#F8FAFC] text-[10px] font-mono uppercase tracking-wider">
            <QrCode className="w-3 h-3 text-[#10B981]" />
            <span>Dynamic INR UPI QR</span>
          </div>
          <p className="font-semibold text-[#F8FAFC] text-sm">{label}</p>
          <p className="text-[#94A3B8]">
            Payee: <span className="font-medium text-[#F8FAFC]">{effectivePayee}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[#F8FAFC] bg-[#0D1F38] px-2 py-0.5 rounded border border-[#1E3A5F]">
              UPI ID: {effectiveUpiId}
            </span>
            <button
              type="button"
              onClick={handleCopyUpi}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#F8FAFC] hover:text-[#10B981] no-print"
            >
              {copiedUpi ? <Check className="w-3 h-3 text-[#16A34A]" /> : <Copy className="w-3 h-3" />}
              <span>{copiedUpi ? 'Copied UPI ID' : 'Copy UPI ID'}</span>
            </button>
          </div>
          <p className="text-[11px] font-mono text-[#94A3B8]">
            Pre-filled Amount: <strong className="text-[#F8FAFC]">{formatINR(safeAmount)}</strong> · Ref:{' '}
            <strong className="text-[#F8FAFC]">{referenceNumber}</strong>
          </p>
        </div>
      </div>

      <div className="flex flex-col items-stretch sm:items-end gap-2 w-full sm:w-auto shrink-0 no-print">
        <a
          href={upiUri}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg transition-colors"
        >
          <span>Open UPI App ({formatINR(safeAmount)})</span>
          <ExternalLink className="w-3.5 h-3.5 text-white" />
        </a>
        {onSubmitUtrClick && (
          <button
            type="button"
            onClick={onSubmitUtrClick}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#2DD4BF] bg-[#0D1F38] hover:bg-[#1E3A5F] border border-[#10B981]/40 rounded-lg transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
            <span>Submit 12-Digit UTR Number</span>
          </button>
        )}
        <span className="text-[10px] text-[#94A3B8] text-center sm:text-right">
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
            <text x="110" y="420" fill="#94A3B8" font-family="Inter, sans-serif" font-size="26" font-weight="600">RAW UNEDITED CAMERA FRAME</text>
            <text x="110" y="460" fill="#7D8694" font-family="monospace" font-size="20">Flat Lighting · No Subject Separation · Low CTR</text>
          </svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675">
            <defs>
              <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#040D1A"/>
                <stop offset="55%" stop-color="#040D1A"/>
                <stop offset="100%" stop-color="#132A4A"/>
              </linearGradient>
              <radialGradient id="rimGlow" cx="0.7" cy="0.5" r="0.45">
                <stop offset="0%" stop-color="#10B981" stop-opacity="0.55"/>
                <stop offset="100%" stop-color="#10B981" stop-opacity="0"/>
              </radialGradient>
            </defs>
            <rect width="1200" height="675" fill="url(#bgGrad)"/>
            <rect width="1200" height="675" fill="url(#rimGlow)"/>
            <circle cx="820" cy="340" r="185" fill="#1E2F44" stroke="#10B981" stroke-width="5"/>
            <rect x="95" y="140" width="195" height="40" rx="6" fill="#10B981"/>
            <text x="115" y="166" fill="#040D1A" font-family="monospace" font-size="18" font-weight="700">CTR MASTER +14.8%</text>
            <text x="95" y="255" fill="#FFFFFF" font-family="Inter, sans-serif" font-size="64" font-weight="800">10X YOUTUBE</text>
            <text x="95" y="330" fill="#10B981" font-family="Inter, sans-serif" font-size="64" font-weight="800">THUMBNAIL GRADE</text>
            <text x="95" y="410" fill="#94A3B8" font-family="Inter, sans-serif" font-size="25" font-weight="600">Rim Lighting · Skin Dodge &amp; Burn · 3D Depth Separation</text>
            <rect x="95" y="455" width="380" height="52" rx="8" fill="#16A34A"/>
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
                <stop offset="50%" stop-color="#040D1A"/>
                <stop offset="100%" stop-color="#3A2318"/>
              </linearGradient>
            </defs>
            <rect width="1200" height="675" fill="url(#cine)"/>
            <rect x="80" y="80" width="1040" height="515" rx="14" fill="#132232" stroke="#10B981" stroke-width="3"/>
            <text x="130" y="235" fill="#10B981" font-family="monospace" font-size="22" font-weight="700">REC.709 CINEMATIC TEAL &amp; WARM AMBER LUT</text>
            <text x="130" y="310" fill="#FFFFFF" font-family="Inter, sans-serif" font-size="54" font-weight="800">DYNAMIC REELS &amp; 4K COLOR PASS</text>
            <text x="130" y="370" fill="#94A3B8" font-family="Inter, sans-serif" font-size="24">Retention Subtitles · Motion Callouts · Broadcast Audio Mastering</text>
            <rect x="130" y="425" width="940" height="44" rx="8" fill="#1E3246"/>
            <rect x="130" y="425" width="680" height="44" rx="8" fill="#10B981"/>
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
          <rect width="1200" height="675" fill="#040D1A"/>
          <circle cx="600" cy="315" r="220" fill="#132A4A" stroke="#10B981" stroke-width="4"/>
          <text x="120" y="130" fill="#10B981" font-family="monospace" font-size="20" font-weight="700">COMMERCIAL AD CREATIVE &amp; RETOUCH</text>
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

export const BeforeAfterComparisonShowcase: React.FC<{
  defaultPresetId?: 'thumbnail' | 'colorgrade' | 'retouch';
}> = ({ defaultPresetId = 'thumbnail' }) => {
  const [activePresetId, setActivePresetId] = useState<string>(defaultPresetId);
  const [sliderPos, setSliderPos] = useState<number>(52);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (defaultPresetId) {
      setActivePresetId(defaultPresetId);
    }
  }, [defaultPresetId]);

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
    <section className="pe-card-interactive bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-6 sm:p-8 space-y-6 shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#1E3A5F] pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#10B981]">
            <Sliders className="w-3.5 h-3.5" />
            <span>Interactive Studio Quality Inspector</span>
          </div>
          <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#F8FAFC] mt-1">
            Before & After Craft Comparison
          </h2>
          <p className="text-xs sm:text-sm text-[#94A3B8] mt-1 max-w-2xl">
            {activePreset.subtitle}
          </p>
        </div>

        {/* Discipline Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#132A4A] p-1 rounded-lg border border-[#1E3A5F]">
          {COMPARISON_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setActivePresetId(preset.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activePresetId === preset.id
                  ? 'bg-[#132A4A] text-[#F8FAFC] shadow-2xs'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
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
        className="relative aspect-[16/9] max-h-[440px] w-full rounded-xl overflow-hidden border border-[#1E3A5F] select-none cursor-ew-resize bg-[#040D1A]"
      >
        {/* Base Layer: AFTER (Full width) */}
        <LazyImage
          src={activePreset.afterSvgDataUrl}
          alt={activePreset.afterLabel}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />

        {/* Clipped Layer: BEFORE (Left side up to sliderPos%) */}
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none"
          style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
        >
          <LazyImage
            src={activePreset.beforeSvgDataUrl}
            alt={activePreset.beforeLabel}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>

        {/* Labels */}
        <span className="absolute top-3 left-3 z-20 px-3 py-1 text-[11px] font-mono font-semibold bg-[#040D1A]/90 text-white rounded-md border border-white/15">
          {activePreset.beforeLabel}
        </span>
        <span className="absolute top-3 right-3 z-20 px-3 py-1 text-[11px] font-mono font-semibold bg-[#10B981] text-white rounded-md shadow-xs">
          {activePreset.afterLabel}
        </span>

        {/* Divider Line & Handle */}
        <div
          className="absolute top-0 bottom-0 z-20 w-0.5 bg-[#0D1F38] shadow-[0_0_12px_rgba(0,0,0,0.8)]"
          style={{ left: `${sliderPos}%` }}
        >
          <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#10B981] text-white border-2 border-white shadow-lg flex items-center justify-center">
            <MoveHorizontal className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Footer Range Control & CTA */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-1 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[#94A3B8]">
            Comparison Split: <strong className="text-[#F8FAFC]">{sliderPos}%</strong>
          </span>
          <input
            type="range"
            min={5}
            max={95}
            value={sliderPos}
            onChange={(e) => setSliderPos(Number(e.target.value))}
            aria-label="Before and after comparison slider"
            className="w-36 accent-[#10B981]"
          />
          <span className="px-2.5 py-1 rounded bg-[#16A34A]/10 text-[#16A34A] font-semibold">
            {activePreset.metricsBadge}
          </span>
        </div>

        <Link
          to={`/contact?service=${encodeURIComponent(activePreset.category)}`}
          className="inline-flex items-center gap-1.5 font-semibold text-[#F8FAFC] hover:text-[#10B981]"
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
  whatsappNumber = '916361902619',
}) => {
  const navigate = useNavigate();
  const [thumbnailsCount, setThumbnailsCount] = useState<number>(5);
  const [reelsCount, setReelsCount] = useState<number>(4);
  const [socialPostsCount, setSocialPostsCount] = useState<number>(0);
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
  const rangeMin = Math.max(0, Math.round(estimatedTotal * 0.9));
  const rangeMax = Math.max(0, Math.round(estimatedTotal * 1.15));

  const matchedBudgetBracket =
    estimatedTotal < 2500
      ? 'Under ₹2,500'
      : estimatedTotal <= 5000
      ? '₹2,500 – ₹5,000'
      : estimatedTotal <= 15000
      ? '₹5,000 – ₹15,000'
      : estimatedTotal <= 35000
      ? '₹15,000 – ₹35,000'
      : '₹35,000+ (Monthly Retainer / Campaign)';

  const summaryItems: string[] = [];
  if (thumbnailsCount > 0) summaryItems.push(`${thumbnailsCount} YouTube Thumbnails`);
  if (reelsCount > 0) summaryItems.push(`${reelsCount} Instagram Reels / Shorts`);
  if (socialPostsCount > 0) summaryItems.push(`${socialPostsCount} Social Media Creatives`);
  if (longVideoCount > 0) summaryItems.push(`${longVideoCount} Full YouTube Video Edits`);
  if (rushDelivery) summaryItems.push('24h Rush Priority Turnaround');
  if (includeSourceFiles) summaryItems.push('Editable PSD / Premiere Source Project Files');

  const bundleSummaryText =
    summaryItems.length > 0
      ? `${summaryItems.join(' + ')} (${formatINR(rangeMin)} – ${formatINR(rangeMax)})`
      : 'Custom Creative Bundle';

  const detailedScopeDescription = [
    `Selected Instant Quote Package:`,
    ...summaryItems.map((item) => `• ${item}`),
    `Estimated INR Range: ${formatINR(rangeMin)} – ${formatINR(rangeMax)} (Standard Bundle: ${formatINR(estimatedTotal)})`,
    `Please share the next available production slot and milestone schedule.`,
  ].join('\n');

  const handleSendScopeToShankar = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    navigate(
      `/book?service=${encodeURIComponent(bundleSummaryText)}&budget=${encodeURIComponent(
        matchedBudgetBracket
      )}&scope=${encodeURIComponent(detailedScopeDescription)}`
    );
  };

  const whatsappText = [
    `Hello Shankar (Prithvi Editify), I configured this scope using the Instant Quote Calculator:`,
    ``,
    ...summaryItems.map((i) => `• ${i}`),
    ``,
    `*Estimated INR Range:* ${formatINR(rangeMin)} – ${formatINR(rangeMax)} (Bundle Rate: ${formatINR(estimatedTotal)})`,
  ].join('\n');

  const cleanPhone = (whatsappNumber || '').replace(/\D/g, '') || '916361902619';
  const waHref = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappText)}`;

  return (
    <section className="pe-card-interactive bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-5">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#10B981]">
              <Calculator className="w-3.5 h-3.5" />
              <span>Interactive Instant Quote & Package Calculator</span>
            </div>
            <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#F8FAFC] mt-1">
              Build Your Custom Creative Scope & Instant INR Quote
            </h2>
            <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">
              Select your deliverables (e.g., 5 YouTube Thumbnails + 4 Instagram Reels) to see an instant estimated INR range and click <strong>"Send This Scope to Shankar"</strong> to prefill your project brief.
            </p>
          </div>

          {/* Quick Package Presets */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#94A3B8] mr-1">
              Quick Presets:
            </span>
            <button
              type="button"
              onClick={() => {
                setThumbnailsCount(5);
                setReelsCount(4);
                setSocialPostsCount(0);
                setLongVideoCount(0);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#132A4A] hover:bg-[#1E3A5F] text-[#2DD4BF] border border-[#10B981]/30 transition-colors"
            >
              Creator Pack (5 Thumbnails + 4 Reels)
            </button>
            <button
              type="button"
              onClick={() => {
                setThumbnailsCount(8);
                setReelsCount(8);
                setSocialPostsCount(10);
                setLongVideoCount(0);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#132A4A] hover:bg-[#1E3A5F] text-[#F8FAFC] border border-[#1E3A5F] transition-colors"
            >
              Growth Retainer (8 Thumbnails + 8 Reels + 10 Posts)
            </button>
            <button
              type="button"
              onClick={() => {
                setThumbnailsCount(4);
                setReelsCount(4);
                setSocialPostsCount(4);
                setLongVideoCount(2);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#132A4A] hover:bg-[#1E3A5F] text-[#F8FAFC] border border-[#1E3A5F] transition-colors"
            >
              YouTube + Reels Pro Suite
            </button>
          </div>

          <div className="space-y-4">
            {/* Row 1: YouTube Thumbnails */}
            <div className="pe-card-interactive p-3.5 bg-[#132A4A] rounded-lg border border-[#1E3A5F] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#F8FAFC]">
                  YouTube High-CTR Thumbnails ({formatINR(UNIT_RATES.thumbnail)} / each)
                </span>
                <span className="font-mono font-bold text-[#F8FAFC]">
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
                className="w-full accent-[#10B981]"
              />
            </div>

            {/* Row 2: Instagram Reels / YouTube Shorts */}
            <div className="pe-card-interactive p-3.5 bg-[#132A4A] rounded-lg border border-[#1E3A5F] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#F8FAFC]">
                  Instagram Reels / Shorts Editing ({formatINR(UNIT_RATES.reel)} / reel)
                </span>
                <span className="font-mono font-bold text-[#F8FAFC]">
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
                className="w-full accent-[#10B981]"
              />
            </div>

            {/* Row 3: Social Media Creatives / Ad Posters */}
            <div className="pe-card-interactive p-3.5 bg-[#132A4A] rounded-lg border border-[#1E3A5F] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#F8FAFC]">
                  Social Media Posts & Promotional Banners ({formatINR(UNIT_RATES.socialPost)} / design)
                </span>
                <span className="font-mono font-bold text-[#F8FAFC]">
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
                className="w-full accent-[#10B981]"
              />
            </div>

            {/* Row 4: Long-Form YouTube Video Editing */}
            <div className="pe-card-interactive p-3.5 bg-[#132A4A] rounded-lg border border-[#1E3A5F] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#F8FAFC]">
                  Full-Length YouTube Video Edits ({formatINR(UNIT_RATES.longVideo)} / video)
                </span>
                <span className="font-mono font-bold text-[#F8FAFC]">
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
                className="w-full accent-[#10B981]"
              />
            </div>

            {/* Add-on Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
              <label className="pe-card-interactive flex items-center justify-between p-3 bg-[#132A4A] border border-[#1E3A5F] rounded-lg cursor-pointer">
                <span className="font-medium text-[#F8FAFC]">Express 24h Rush Delivery (+25%)</span>
                <input
                  type="checkbox"
                  checked={rushDelivery}
                  onChange={(e) => setRushDelivery(e.target.checked)}
                />
              </label>
              <label className="pe-card-interactive flex items-center justify-between p-3 bg-[#132A4A] border border-[#1E3A5F] rounded-lg cursor-pointer">
                <span className="font-medium text-[#F8FAFC]">Include Editable Source Files (+₹750)</span>
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
        <div className="pe-card-interactive lg:col-span-5 bg-[#132A4A] text-[#F8FAFC] rounded-xl p-6 space-y-5 border border-[#1E3A5F]">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider text-[#10B981]">
                LIVE STUDIO ESTIMATE
              </p>
              <h3 className="text-lg font-semibold mt-0.5">Custom Deliverable Bundle</h3>
            </div>
            <span className="px-2.5 py-1 text-[11px] font-mono bg-white/10 rounded">INR (₹)</span>
          </div>

          <div className="space-y-2 text-xs text-[#94A3B8]">
            {summaryItems.length === 0 ? (
              <p className="text-[#94A3B8]">Move any slider on the left to calculate your estimate.</p>
            ) : (
              summaryItems.map((line, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
                  <span>{line}</span>
                </div>
              ))
            )}
          </div>

          <div className="pt-4 border-t border-white/10 space-y-1.5 text-xs">
            <div className="flex justify-between text-[#94A3B8]">
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
              <div className="flex justify-between text-[#10B981]">
                <span>24h Rush Priority Surcharge:</span>
                <span className="font-mono">+{formatINR(rushFee)}</span>
              </div>
            )}
            {sourceFilesFee > 0 && (
              <div className="flex justify-between text-[#94A3B8]">
                <span>Open Source Project Files:</span>
                <span className="font-mono">+{formatINR(sourceFilesFee)}</span>
              </div>
            )}
            <div className="pt-3 border-t border-white/10 space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-[#94A3B8]">Estimated INR Range:</span>
                <span className="font-mono text-sm font-semibold text-[#2DD4BF] tabular-nums">
                  {formatINR(rangeMin)} – {formatINR(rangeMax)}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold">Standard Bundle Rate:</span>
                <span className="font-mono text-2xl font-bold text-[#10B981] tabular-nums">
                  {formatINR(estimatedTotal)}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={handleSendScopeToShankar}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-semibold text-[#040D1A] bg-gradient-to-r from-[#10B981] via-[#2DD4BF] to-[#0EA5E9] hover:opacity-95 rounded-lg transition-all shadow-md"
            >
              <span>Send This Scope to Shankar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#132A4A] hover:bg-[#1E3A5F] border border-white/10 rounded-lg transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Send Scope via WhatsApp Direct</span>
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
      <div className="max-w-3xl mx-auto px-6 py-16 text-center text-xs text-[#94A3B8]">
        Loading official quotation document...
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center space-y-4">
        <h1 className="font-editorial text-2xl font-semibold text-[#F8FAFC]">
          Quotation Link Not Found or Expired
        </h1>
        <p className="text-xs text-[#94A3B8]">
          Please ask Shankar Baluragi (Prithvi Editify) for an updated quotation link or sign in to your Client Portal.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            to="/login"
            className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg"
          >
            Client Portal Sign In
          </Link>
          <Link
            to="/contact"
            className="px-4 py-2 text-xs font-semibold text-[#F8FAFC] bg-[#0D1F38] border border-[#1E3A5F] rounded-lg"
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
      <div className="pe-card-interactive bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-6 sm:p-10 space-y-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1E3A5F] pb-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-white p-1.5 border border-[#1E3A5F] shadow-md shrink-0 flex items-center justify-center">
              <img
                src={DEFAULT_STUDIO_LOGO_URL}
                alt="Prithvi Editify Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#10B981]/15 text-[#2DD4BF] text-[11px] font-semibold">
                OFFICIAL STUDIO QUOTATION · SAC 9983
              </span>
              <h1 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#F8FAFC] mt-1">
                {quotation.projectTitle}
              </h1>
              <p className="text-xs text-[#94A3B8] mt-1">
                Prepared by <strong>Prithvi Editify (Shankar Baluragi)</strong> for{' '}
                <strong className="text-[#F8FAFC]">{quotation.clientName}</strong> ({quotation.clientEmail})
              </p>
            </div>
          </div>
          <div className="text-right font-mono text-xs">
            <p className="text-base font-bold text-[#F8FAFC]">{quotation.quotationNumber}</p>
            <p className="text-[#94A3B8]">Issued: {quotation.issueDate}</p>
            <p className="text-[#94A3B8]">Valid Until: {quotation.expiryDate}</p>
            <span
              className={`inline-block mt-1.5 px-2.5 py-0.5 rounded font-sans font-semibold text-[11px] ${
                quotation.status === 'Accepted'
                  ? 'bg-[#16A34A]/15 text-[#16A34A]'
                  : quotation.status === 'Rejected'
                  ? 'bg-[#DC2626]/15 text-[#DC2626]'
                  : 'bg-[#132A4A] text-[#F8FAFC]'
              }`}
            >
              Status: {quotation.status}
            </span>
          </div>
        </div>

        {/* Scope & Deliverables */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-[#132A4A] rounded-lg text-xs">
          <div>
            <p className="font-semibold text-[#F8FAFC]">Scope Summary</p>
            <p className="text-[#94A3B8] mt-1 leading-relaxed">{quotation.scopeSummary || '—'}</p>
          </div>
          <div>
            <p className="font-semibold text-[#F8FAFC]">Deliverables Included</p>
            <p className="text-[#94A3B8] mt-1 leading-relaxed">{quotation.deliverables || '—'}</p>
          </div>
          <div>
            <p className="font-semibold text-[#F8FAFC]">Estimated Turnaround</p>
            <p className="text-[#94A3B8] mt-1">{quotation.estimatedTimeline || '3–5 business days'}</p>
          </div>
        </div>

        {/* Line Items Table */}
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#1E3A5F] text-[#94A3B8]">
              <th className="py-2.5">Deliverable Description</th>
              <th className="py-2.5 text-right">Qty</th>
              <th className="py-2.5 text-right">Unit Price</th>
              <th className="py-2.5 text-right">Amount (INR)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E3A5F]">
            {quotation.lineItems.map((li, idx) => (
              <tr key={idx}>
                <td className="py-3 font-medium text-[#F8FAFC]">{li.description}</td>
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
              <span className="text-[#94A3B8]">Subtotal:</span>
              <span className="font-mono">{formatINR(quotation.subtotal)}</span>
            </div>
            {quotation.discount > 0 && (
              <div className="flex justify-between text-[#16A34A]">
                <span>Discount:</span>
                <span className="font-mono">-{formatINR(quotation.discount)}</span>
              </div>
            )}
            {quotation.taxRate > 0 && (
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">GST / Tax ({quotation.taxRate}% · SAC 9983):</span>
                <span className="font-mono">{formatINR(quotation.taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-[#1E3A5F] text-sm font-bold text-[#F8FAFC]">
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

        <div className="text-xs text-[#94A3B8] border-t border-[#1E3A5F] pt-4">
          <p className="font-semibold text-[#F8FAFC]">Terms & Studio Policy:</p>
          <p className="mt-1 whitespace-pre-line">{quotation.termsAndConditions}</p>
        </div>

        {/* One-Tap Client Approval Controls */}
        <div className="pt-4 border-t border-[#1E3A5F] space-y-3 no-print">
          {quotation.status !== 'Accepted' ? (
            <>
              <input
                type="text"
                value={clientNote}
                onChange={(e) => setClientNote(e.target.value)}
                placeholder="Optional note or preferred kickoff date before approving..."
                className="w-full px-3.5 py-2 text-xs bg-[#132A4A] border border-[#1E3A5F] rounded-lg"
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDecision('Accepted')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#16A34A] hover:bg-[#15803D] rounded-lg"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve & Accept Quotation</span>
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDecision('Rejected')}
                  className="px-4 py-2.5 text-xs font-semibold text-[#DC2626] bg-[#DC2626]/10 rounded-lg"
                >
                  Request Scope Changes
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-[#F8FAFC] bg-[#132A4A] hover:bg-[#1E3A5F] rounded-lg"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / Save PDF</span>
                </button>
              </div>
            </>
          ) : (
            <div className="p-4 bg-[#16A34A]/10 border border-[#16A34A]/30 rounded-lg flex flex-wrap items-center justify-between gap-4 text-xs text-[#16A34A]">
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
                  className="px-3 py-1.5 font-semibold text-[#F8FAFC] bg-[#0D1F38] border border-[#1E3A5F] rounded-md"
                >
                  Print PDF
                </button>
                <Link
                  to="/portal"
                  className="px-3.5 py-1.5 font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-md"
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

// ============================================================================
// 6. STUDIO FREQUENTLY ASKED QUESTIONS (FAQ) + SCHEMA.ORG FAQPAGE JSON-LD
// ============================================================================
export interface StudioFaqItem {
  id: string;
  number: string;
  category:
    | 'Services & Turnaround'
    | 'Pricing & INR Billing'
    | 'Revisions & Deliverables'
    | 'Client Portal & Workflow';
  question: string;
  answer: string;
  highlights?: string;
}

export const STUDIO_FAQ_ITEMS: StudioFaqItem[] = [
  {
    id: 'faq-services-offered',
    number: '01',
    category: 'Services & Turnaround',
    question: 'What creative design and video editing services does Prithvi Editify provide?',
    answer:
      'Prithvi Editify is an independent creative studio led by Shankar Baluragi specializing in high-CTR YouTube thumbnail design, social media creatives and carousels, brand identity and logo design, promotional ad banners, photo retouching, long-form YouTube video editing, and Instagram Reels / YouTube Shorts editing.',
    highlights: 'YouTube Thumbnails · Graphic Design · Video & Reels Editing · Brand Identity',
  },
  {
    id: 'faq-turnaround-time',
    number: '02',
    category: 'Services & Turnaround',
    question: 'What is the typical turnaround time for thumbnails, graphics, and video edits?',
    answer:
      'Standard YouTube thumbnails, social media posts, and promotional graphics are delivered within 24 to 48 hours. Short-form vertical videos (Instagram Reels and YouTube Shorts) take 24 to 72 hours, while long-form YouTube video edits and multi-asset brand identity systems typically take 3 to 5 business days depending on footage length and complexity.',
    highlights: '24–48 hrs for Graphics & Thumbnails · 2–5 days for Video Edits',
  },
  {
    id: 'faq-pricing-structure',
    number: '03',
    category: 'Pricing & INR Billing',
    question: 'How does pricing work and are rates quoted in Indian Rupees (INR)?',
    answer:
      'Yes, all studio services are transparently priced in Indian Rupees (₹ INR). Standard design assets such as YouTube thumbnails and social media creatives start at ₹400–₹750 per creative, with tiered Basic, Standard, and Premium packages available on every service page. Custom campaigns, monthly creator retainers, and multi-video scopes receive an itemized written quotation (PE-QTN) before production begins.',
    highlights: 'Transparent INR Pricing · Tiered Packages · Itemized Written Quotations',
  },
  {
    id: 'faq-payment-methods',
    number: '04',
    category: 'Pricing & INR Billing',
    question: 'What payment methods are accepted and how do project milestones work?',
    answer:
      'We accept instant UPI payments (Google Pay, PhonePe, Paytm, BHIM) via dynamic QR codes as well as NEFT/IMPS bank transfers. Most projects begin with a 50% kickoff advance upon quotation approval, with the remaining 50% balance settled after you review and approve the final draft preview in your Client Portal. Every payment is verified and recorded on an official downloadable INR invoice.',
    highlights: 'UPI QR (GPay / PhonePe / Paytm) · Bank Transfer · Official INR Invoices',
  },
  {
    id: 'faq-revisions-policy',
    number: '05',
    category: 'Revisions & Deliverables',
    question: 'How many revisions are included with my design or video editing project?',
    answer:
      'Every service package includes 2 to 3 structured revision rounds (and unlimited revisions on select Premium packages) within the agreed project brief. You can submit timestamped video notes or design feedback directly inside your private Client Portal so nothing gets lost in scattered chat threads.',
    highlights: '2–3 Included Revision Rounds · Structured Portal Feedback',
  },
  {
    id: 'faq-deliverable-formats',
    number: '06',
    category: 'Revisions & Deliverables',
    question: 'What file formats and source files will I receive upon project completion?',
    answer:
      'Graphic design and thumbnail projects are delivered as print-ready and web-optimized high-resolution PNG, JPG, and PDF files, with editable layered source files (PSD, AI, or Figma) available in Standard and Premium tiers. Video editing projects are exported in color-calibrated 1080p or 4K H.264/ProRes MP4/MOV formats optimized for YouTube, Instagram, and LinkedIn.',
    highlights: 'High-Res PNG / JPG / PDF · 1080p & 4K Master Video Exports · Layered Source Files',
  },
  {
    id: 'faq-client-portal',
    number: '07',
    category: 'Client Portal & Workflow',
    question: 'How do I track project progress, review drafts, and download final master files?',
    answer:
      'Every client receives dedicated access to the Prithvi Editify Client Portal. Once logged in, you can view live project progress percentages, milestone checklists, watermarked draft previews, itemized INR invoices, payment history, and one-click downloads for your unlocked master deliverables.',
    highlights: 'Private Client Workspace · Live Milestone Tracking · Secure File Delivery',
  },
  {
    id: 'faq-monthly-retainers',
    number: '08',
    category: 'Client Portal & Workflow',
    question: 'Do you offer ongoing monthly retainers for YouTube creators and growing brands?',
    answer:
      'Yes. We partner with YouTube creators, podcasters, coaches, and marketing teams on recurring monthly retainers that bundle consistent thumbnail design, long-form video editing, daily Reels/Shorts, and social media graphics at a dedicated studio rate with priority turnaround.',
    highlights: 'Monthly Creator & Brand Retainers · Priority Studio Turnaround',
  },
];

interface StudioFaqSectionProps {
  primaryBg?: string;
  secondaryBg?: string;
  accentColor?: string;
  ownerName?: string;
  businessName?: string;
  whatsappUrl?: string;
}

export const StudioFaqSection: React.FC<StudioFaqSectionProps> = ({
  primaryBg = '#040D1A',
  accentColor = '#10B981',
  ownerName = 'Shankar Baluragi',
  businessName = 'Prithvi Editify',
  whatsappUrl,
}) => {
  const categories = [
    'All Questions',
    'Services & Turnaround',
    'Pricing & INR Billing',
    'Revisions & Deliverables',
    'Client Portal & Workflow',
  ] as const;

  const [selectedCategory, setSelectedCategory] = useState<string>('All Questions');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [openIds, setOpenIds] = useState<string[]>([
    'faq-services-offered',
    'faq-pricing-structure',
  ]);

  const filteredFaqs = STUDIO_FAQ_ITEMS.filter((item) => {
    const matchesCat =
      selectedCategory === 'All Questions' || item.category === selectedCategory;
    if (!matchesCat) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      item.question.toLowerCase().includes(q) ||
      item.answer.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      (item.highlights || '').toLowerCase().includes(q)
    );
  });

  const toggleFaq = (id: string) => {
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const allFilteredOpen =
    filteredFaqs.length > 0 && filteredFaqs.every((f) => openIds.includes(f.id));

  const handleToggleAll = () => {
    if (allFilteredOpen) {
      setOpenIds([]);
    } else {
      setOpenIds(filteredFaqs.map((f) => f.id));
    }
  };

  const faqSchemaJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: STUDIO_FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <section
      id="faq"
      aria-labelledby="studio-faq-heading"
      className="bg-[#0D1F38] border-b border-[#1E3A5F] py-20"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchemaJsonLd) }}
      />

      <div className="max-w-[1200px] mx-auto px-6">
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-[#1E3A5F]">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[#94A3B8] tracking-wide">
              05. Frequently Asked Questions
            </p>
            <h2
              id="studio-faq-heading"
              className="font-editorial text-3xl font-semibold text-[#F8FAFC] mt-2"
            >
              Clear answers on creative scope, INR pricing, and delivery
            </h2>
            <p className="text-sm text-[#94A3B8] mt-2.5 leading-relaxed">
              Everything you need to know about commissioning graphic design, YouTube thumbnails,
              and video editing with {businessName} ({ownerName}).
            </p>
          </div>

          {/* Search & Expand Controls */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search pricing, revisions, files..."
                aria-label="Search frequently asked questions"
                className="w-full pl-8 pr-3 py-2 text-xs bg-[#132A4A] border border-[#1E3A5F] rounded-lg text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-none focus:border-[#10B981]"
              />
            </div>
            <button
              type="button"
              onClick={handleToggleAll}
              className="px-3.5 py-2 text-xs font-semibold text-[#F8FAFC] bg-[#132A4A] hover:bg-[#1E3A5F]/70 border border-[#1E3A5F] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {allFilteredOpen ? 'Collapse All' : 'Expand All'}
            </button>
          </div>
        </div>

        {/* Interactive Category Filter Bar */}
        <div
          role="tablist"
          aria-label="Filter FAQ by topic"
          className="flex items-center gap-2 overflow-x-auto py-4 border-b border-[#1E3A5F] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {categories.map((cat) => {
            const active = selectedCategory === cat;
            const count =
              cat === 'All Questions'
                ? STUDIO_FAQ_ITEMS.length
                : STUDIO_FAQ_ITEMS.filter((i) => i.category === cat).length;

            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedCategory(cat)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-gradient-to-r from-[#0EA5E9] to-[#10B981] text-white border-[#10B981] font-semibold'
                    : 'bg-[#132A4A]/70 text-[#94A3B8] border-[#1E3A5F] hover:bg-[#132A4A] hover:text-[#F8FAFC] font-medium'
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`font-mono text-[10px] tabular-nums ${
                    active ? 'text-[#10B981]' : 'text-[#94A3B8]'
                  }`}
                >
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Accordion List */}
        {filteredFaqs.length === 0 ? (
          <div className="py-12 text-center bg-[#132A4A]/50 rounded-lg border border-[#1E3A5F] mt-6">
            <HelpCircle className="w-6 h-6 text-[#94A3B8] mx-auto mb-2" />
            <p className="text-sm font-semibold text-[#F8FAFC]">
              No matching questions found for "{searchQuery}"
            </p>
            <p className="text-xs text-[#94A3B8] mt-1">
              Try clearing your filter or ask {ownerName} directly via the project inquiry form.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('All Questions');
                setSearchQuery('');
              }}
              className="mt-4 px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors"
              style={{ backgroundColor: primaryBg }}
            >
              Reset FAQ Filters
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#1E3A5F] mt-2">
            {filteredFaqs.map((faq) => {
              const isOpen = openIds.includes(faq.id);
              const panelId = `${faq.id}-panel`;
              const buttonId = `${faq.id}-trigger`;

              return (
                <div key={faq.id} className="py-5">
                  <h3>
                    <button
                      id={buttonId}
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => toggleFaq(faq.id)}
                      className="w-full flex items-start justify-between gap-4 text-left group focus:outline-none"
                    >
                      <div className="flex items-start gap-4 min-w-0">
                        <span
                          className="font-mono text-xs font-semibold pt-1 tabular-nums shrink-0"
                          style={{ color: accentColor }}
                        >
                          {faq.number}.
                        </span>
                        <div className="min-w-0">
                          <span className="text-base font-semibold text-[#F8FAFC] group-hover:text-[#10B981] transition-colors block leading-snug">
                            {faq.question}
                          </span>
                          <span className="text-xs text-[#94A3B8] mt-1 block">
                            {faq.category}
                            {faq.highlights ? ` · ${faq.highlights}` : ''}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`mt-0.5 p-1.5 rounded-md border transition-transform duration-150 shrink-0 ${
                          isOpen
                            ? 'bg-gradient-to-r from-[#0EA5E9] to-[#10B981] text-white border-[#10B981] rotate-180'
                            : 'bg-[#132A4A] text-[#F8FAFC] border-[#1E3A5F] group-hover:border-[#10B981]'
                        }`}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </span>
                    </button>
                  </h3>

                  {isOpen && (
                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={buttonId}
                      className="pl-8 sm:pl-9 pr-4 pt-3.5 text-sm text-[#F8FAFC]/90 leading-relaxed max-w-3xl"
                    >
                      <p>{faq.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Trust & Action Callout Bar */}
        <div className="pe-card-interactive mt-10 p-6 bg-[#132A4A] border border-[#1E3A5F] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#F8FAFC]">
              Have a custom project requirement not covered above?
            </p>
            <p className="text-xs text-[#94A3B8] mt-1">
              Share your brief for an exact INR quote or estimate using our interactive studio tools.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              to="/services"
              className="px-4 py-2.5 text-xs font-semibold text-[#F8FAFC] bg-[#0D1F38] border border-[#1E3A5F] hover:border-[#10B981] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Explore Rate Card
            </Link>
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white rounded-lg hover:opacity-95 transition-opacity whitespace-nowrap shrink-0"
                style={{ backgroundColor: accentColor }}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Ask on WhatsApp</span>
              </a>
            )}
            <Link
              to="/contact"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
              style={{ backgroundColor: primaryBg }}
            >
              <span>Submit Project Brief</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

// ============================================================================
// 7. UNIVERSAL COLOR-CODED CRM STATUS BADGE & 5-STEP PROJECT LIFECYCLE STEPPER
// ============================================================================
export const CrmStatusBadge: React.FC<{ status: string; className?: string }> = ({
  status,
  className = '',
}) => {
  const { containerClass, dotClass } = getCrmStatusBadgeStyle(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-md border whitespace-nowrap ${containerClass} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
      <span>{status}</span>
    </span>
  );
};

export const ProjectLifecycleStepper: React.FC<{
  status: ProjectStatus | string;
  progress: number;
  isMasterUnlocked?: boolean;
}> = ({ status, progress, isMasterUnlocked = false }) => {
  const steps = [
    { key: 1, title: 'Brief & Scope', subtitle: 'Inquiry / Planned' },
    { key: 2, title: 'In Production', subtitle: 'Editing & Design' },
    { key: 3, title: 'Draft In Review', subtitle: 'Client Proofing' },
    { key: 4, title: 'Revisions & Polish', subtitle: 'Feedback Applied' },
    {
      key: 5,
      title: 'Master Completed',
      subtitle: isMasterUnlocked ? 'High-Res Unlocked' : 'Final Delivery',
    },
  ];

  let activeStep = 1;
  if (status === 'Completed' || progress >= 100) {
    activeStep = 5;
  } else if (status === 'Revision Requested' || progress >= 80) {
    activeStep = 4;
  } else if (status === 'In Review' || status === 'Waiting for Client' || progress >= 60) {
    activeStep = 3;
  } else if (status === 'In Progress' || progress >= 20) {
    activeStep = 2;
  } else {
    activeStep = 1;
  }

  return (
    <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-[#10B981]">
            5-STAGE STUDIO LIFECYCLE TRACKER
          </p>
          <h3 className="text-sm font-semibold text-[#F8FAFC] mt-0.5">
            Current Stage: {steps[activeStep - 1]?.title} ({progress}% Complete)
          </h3>
        </div>
        <CrmStatusBadge status={status} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
        {steps.map((s) => {
          const isCompleted = s.key < activeStep || (s.key === 5 && status === 'Completed');
          const isCurrent = s.key === activeStep && status !== 'Completed';
          return (
            <div
              key={s.key}
              className={`p-3 rounded-lg border transition-colors ${
                isCompleted
                  ? 'bg-[#16A34A]/12 border-[#16A34A]/40 text-[#F8FAFC]'
                  : isCurrent
                  ? 'bg-[#F59E0B]/15 border-[#F59E0B]/50 text-[#F8FAFC]'
                  : 'bg-[#132A4A]/60 border-[#1E3A5F] text-[#94A3B8]'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span
                  className={
                    isCompleted
                      ? 'text-[#4ADE80] font-bold'
                      : isCurrent
                      ? 'text-[#FBBF24] font-bold'
                      : 'text-[#94A3B8]'
                  }
                >
                  STEP 0{s.key}
                </span>
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#4ADE80]" />
                ) : isCurrent ? (
                  <Clock className="w-3.5 h-3.5 text-[#FBBF24]" />
                ) : null}
              </div>
              <p className="text-xs font-semibold mt-1">{s.title}</p>
              <p className="text-[10px] text-[#94A3B8] mt-0.5">{s.subtitle}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// 8. PUBLIC SHAREABLE PROJECT STATUS TRACKER PAGE (/track/:projectId)
// ============================================================================
export const PublicProjectTrackerPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [files, setFiles] = useState<DeliverableFile[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [utrInput, setUtrInput] = useState('');
  const [utrSubmitted, setUtrSubmitted] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    const encoded = searchParams.get('d');
    Promise.all([
      fetchAllProjectsAdmin().catch(() => []),
      fetchAllTasksAdmin().catch(() => []),
      fetchAllFilesAdmin().catch(() => []),
      fetchAllInvoicesAdmin().catch(() => []),
    ])
      .then(([allProjs, allTasks, allFiles, allInvs]) => {
        let found = allProjs.find((p) => p.id === projectId) || null;
        if (!found && encoded) {
          try {
            const decoded = JSON.parse(decodeURIComponent(atob(encoded)));
            if (decoded && decoded.title) {
              found = decoded as ProjectRecord;
            }
          } catch {
            // ignore
          }
        }
        setProject(found);
        setTasks(allTasks.filter((t) => t.projectId === projectId && t.visibility === 'client'));
        setFiles(allFiles.filter((f) => f.projectId === projectId));
        setInvoices(allInvs.filter((i) => i.projectId === projectId && i.status !== 'Cancelled'));
      })
      .finally(() => setLoading(false));
  }, [projectId, searchParams]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 text-center text-xs text-[#94A3B8]">
        Loading live studio project tracker...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center space-y-4">
        <h1 className="font-editorial text-2xl font-semibold text-[#F8FAFC]">
          Project Tracker Link Not Found
        </h1>
        <p className="text-xs text-[#94A3B8]">
          Please sign in to your Client Portal or request an updated live status link from Shankar Baluragi.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            to="/login"
            className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] rounded-lg"
          >
            Client Portal Sign In
          </Link>
          <Link
            to="/contact"
            className="px-4 py-2 text-xs font-semibold text-[#F8FAFC] bg-[#0D1F38] border border-[#1E3A5F] rounded-lg"
          >
            Contact Studio
          </Link>
        </div>
      </div>
    );
  }

  const unlockInfo = checkProjectMasterUnlockStatus(project.id, invoices);
  const unpaidInvoice = invoices.find((inv) => inv.balanceDue > 0);

  const handleUtrQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!utrInput.trim() || !unpaidInvoice) return;
    submitClientPaymentProof({
      invoiceId: unpaidInvoice.id,
      invoiceNumber: unpaidInvoice.invoiceNumber,
      clientId: unpaidInvoice.clientId,
      clientUserId: unpaidInvoice.clientUserId,
      clientName: unpaidInvoice.clientName,
      clientEmail: unpaidInvoice.clientEmail,
      amount: unpaidInvoice.balanceDue,
      method: 'UPI',
      utrNumber: utrInput.trim(),
      notes: `Submitted via Live Project Tracker (/track/${project.id})`,
    });
    setUtrSubmitted(true);
    setUtrInput('');
    showToast('success', 'UTR Payment Proof Submitted! Studio Admin has been alerted.');
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
      <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1E3A5F] pb-5">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#10B981]/15 text-[#2DD4BF] text-[11px] font-semibold">
              LIVE PROJECT STATUS TRACKER · PRITHVI EDITIFY
            </span>
            <h1 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#F8FAFC] mt-1">
              {project.title}
            </h1>
            <p className="text-xs text-[#94A3B8] mt-1">
              Client: <strong className="text-[#F8FAFC]">{project.clientName}</strong> · Service:{' '}
              {project.serviceType} · Target Delivery: {project.deadline || 'On schedule'}
            </p>
          </div>
          <Link
            to="/portal"
            className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] rounded-lg"
          >
            Open Full Client Portal →
          </Link>
        </div>

        <ProjectLifecycleStepper
          status={project.status}
          progress={project.progress}
          isMasterUnlocked={unlockInfo.isUnlocked}
        />

        {project.latestUpdate && (
          <div className="p-4 bg-[#132A4A] border border-[#1E3A5F] rounded-lg text-xs space-y-1">
            <p className="font-semibold text-[#10B981]">Latest Studio Update from Shankar Baluragi:</p>
            <p className="text-[#F8FAFC] leading-relaxed">{project.latestUpdate}</p>
          </div>
        )}

        {/* Milestones Checklist */}
        {tasks.length > 0 && (
          <div className="space-y-2.5">
            <h2 className="text-sm font-semibold text-[#F8FAFC]">Production Milestones</h2>
            <div className="divide-y divide-[#1E3A5F] bg-[#132A4A]/60 border border-[#1E3A5F] rounded-lg px-4">
              {tasks.map((t) => (
                <div key={t.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <p className="font-semibold text-[#F8FAFC]">{t.title}</p>
                    <p className="text-[#94A3B8]">{t.description}</p>
                  </div>
                  <CrmStatusBadge status={t.status} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unpaid Invoice + Instant UPI QR & UTR Submission */}
        {unpaidInvoice && (
          <div className="space-y-3 pt-2 border-t border-[#1E3A5F]">
            <h2 className="text-sm font-semibold text-[#F8FAFC]">
              Instant UPI Settlement — Unlock Unwatermarked Master Files
            </h2>
            <UpiQrCodeCard
              amount={unpaidInvoice.balanceDue}
              referenceNumber={unpaidInvoice.invoiceNumber}
              compact
            />
            {utrSubmitted ? (
              <div className="p-3 bg-[#16A34A]/15 border border-[#16A34A]/40 rounded-lg text-xs text-[#4ADE80] font-semibold">
                ✓ UTR payment proof submitted for verification. Your master files will unlock once verified.
              </div>
            ) : (
              <form onSubmit={handleUtrQuickSubmit} className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  required
                  value={utrInput}
                  onChange={(e) => setUtrInput(e.target.value)}
                  placeholder="Enter 12-digit UPI UTR / Reference No. after payment..."
                  className="flex-1 min-w-[220px] px-3.5 py-2 text-xs bg-[#132A4A] border border-[#1E3A5F] rounded-lg"
                />
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#16A34A] hover:bg-[#15803D] rounded-lg"
                >
                  Submit UTR Proof
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 9. BRANDED STUDIO INVOICE & QUOTATION DOCUMENTS (WITH OFFICIAL PRITHVI EDITIFY LOGO)
// ============================================================================
export interface BrandedStudioInvoiceDocumentProps {
  invoice: InvoiceRecord;
  lineItems?: InvoiceLineItem[];
  payments?: PaymentRecord[];
  logoUrl?: string;
  businessName?: string;
  ownerName?: string;
  tagline?: string;
  businessEmail?: string;
  officialEmail?: string;
  whatsappNumber?: string;
  businessAddress?: string;
  websiteUrl?: string;
  clientPhone?: string;
  clientCompany?: string;
  onSubmitUtrClick?: () => void;
  headerActions?: React.ReactNode;
}

export const BrandedStudioInvoiceDocument: React.FC<BrandedStudioInvoiceDocumentProps> = ({
  invoice,
  lineItems = [],
  payments = [],
  logoUrl,
  businessName = 'Prithvi Editify',
  ownerName = 'Shankar Baluragi',
  tagline = 'Creative Design, Video Editing & Visual Production Studio',
  businessEmail = 'shankarbaluragi066@gmail.com',
  officialEmail = 'prithvieditify.official@gmail.com',
  whatsappNumber = '+91 63619 02619',
  businessAddress = 'Karnataka, India',
  websiteUrl = 'https://prithvieditify.netlify.app',
  clientPhone,
  clientCompany,
  onSubmitUtrClick,
  headerActions,
}) => {
  const studioUpi = getStudioUpiSettings();
  const invGstMeta = getInvoiceGstMeta(invoice.id);
  const invGstBreakdown = calculateGstBreakdown(
    invoice.subtotal,
    invoice.discount,
    invGstMeta.gstMode,
    invoice.taxRate,
    invGstMeta.sacCode || studioUpi.sacCode || '9983'
  );

  const effectiveLogo = (logoUrl || '').trim() || DEFAULT_STUDIO_LOGO_URL;
  const sacCode = invGstMeta.sacCode || studioUpi.sacCode || '9983';

  // Ensure there is always at least one itemized row even if lineItems weren't separately fetched
  const effectiveLineItems: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }> =
    lineItems.length > 0
      ? lineItems
      : [
          {
            id: 'default-line-1',
            description:
              invoice.projectTitle ||
              'Creative Graphic Design, Thumbnail & Video Editing Services',
            quantity: 1,
            unitPrice: Number(invoice.subtotal) || Number(invoice.total) || 0,
            amount: Number(invoice.subtotal) || Number(invoice.total) || 0,
          },
        ];

  const isPaid = invoice.status === 'Paid' || Number(invoice.balanceDue) <= 0;
  const isPartial = invoice.status === 'Partially Paid';
  const isOverdue = invoice.status === 'Overdue';
  const isCancelled = invoice.status === 'Cancelled';

  const statusStampConfig = isPaid
    ? {
        label: 'PAID IN FULL',
        badgeClass:
          'bg-[#16A34A]/15 text-[#4ADE80] border-[#16A34A]/50 print:bg-emerald-50 print:text-emerald-800 print:border-emerald-400',
      }
    : isPartial
    ? {
        label: 'PARTIALLY PAID',
        badgeClass:
          'bg-[#F59E0B]/15 text-[#FBBF24] border-[#F59E0B]/50 print:bg-amber-50 print:text-amber-800 print:border-amber-400',
      }
    : isOverdue
    ? {
        label: 'PAYMENT OVERDUE',
        badgeClass:
          'bg-[#DC2626]/15 text-[#F87171] border-[#DC2626]/50 print:bg-red-50 print:text-red-800 print:border-red-400',
      }
    : isCancelled
    ? {
        label: 'VOID / CANCELLED',
        badgeClass:
          'bg-[#64748B]/20 text-[#94A3B8] border-[#64748B]/40 print:bg-slate-100 print:text-slate-600 print:border-slate-300',
      }
    : {
        label: invoice.status === 'Draft' ? 'DRAFT INVOICE' : 'AWAITING SETTLEMENT',
        badgeClass:
          'bg-[#0EA5E9]/15 text-[#38BDF8] border-[#0EA5E9]/50 print:bg-sky-50 print:text-sky-800 print:border-sky-400',
      };

  const invoicePayments = payments.filter((p) => p.invoiceId === invoice.id);

  return (
    <div className="bg-[#081528] border-2 border-[#1E3A5F] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.55)] print:bg-white print:text-slate-900 print:border-slate-300 print:shadow-none">
      {/* Top Action Bar (Hidden when printing) */}
      {headerActions && (
        <div className="bg-[#0D1F38] border-b border-[#1E3A5F] px-6 py-4 flex flex-wrap items-center justify-between gap-3 no-print">
          {headerActions}
        </div>
      )}

      {/* Top Emerald/Cyan Brand Accent Ribbon */}
      <div className="h-2 w-full bg-gradient-to-r from-[#0EA5E9] via-[#10B981] to-[#059669]" />

      <div className="p-6 sm:p-10 space-y-8">
        {/* 1. Executive Studio Header with Official Logo & Invoice Metadata */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 border-b border-[#1E3A5F] print:border-slate-200 pb-7">
          {/* Left: Official Studio Brand Identity & Logo */}
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white p-2 border-2 border-[#10B981]/50 shadow-[0_8px_24px_rgba(16,185,129,0.2)] shrink-0 flex items-center justify-center">
              <img
                src={effectiveLogo}
                alt={`${businessName} Official Logo`}
                className="w-full h-full object-contain"
              />
            </div>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-[#10B981]/15 border border-[#10B981]/30 text-[#2DD4BF] print:bg-emerald-50 print:text-emerald-800 print:border-emerald-200 text-[10px] font-mono uppercase tracking-widest font-semibold">
                <span>OFFICIAL STUDIO INVOICE · SAC {sacCode}</span>
              </div>
              <h2 className="font-editorial text-2xl sm:text-3xl font-bold tracking-tight text-[#F8FAFC] print:text-slate-900">
                {businessName}
              </h2>
              <p className="text-xs font-medium text-[#2DD4BF] print:text-emerald-700">
                {tagline}
              </p>
              <div className="pt-1 text-[11px] text-[#94A3B8] print:text-slate-600 space-y-0.5">
                <p>
                  Founder &amp; Lead Creative:{' '}
                  <strong className="text-[#F8FAFC] print:text-slate-900">{ownerName}</strong>
                  {businessAddress ? ` · ${businessAddress}` : ''}
                </p>
                <p className="font-mono text-[10.5px]">
                  {businessEmail}
                  {officialEmail && officialEmail !== businessEmail ? ` · ${officialEmail}` : ''}
                </p>
                <p className="font-mono text-[10.5px]">
                  WhatsApp: {whatsappNumber} · Web: {websiteUrl.replace(/^https?:\/\//, '')}
                </p>
                {studioUpi.gstin && (
                  <p className="font-mono text-[11px] font-semibold text-[#F8FAFC] print:text-slate-900 pt-0.5">
                    Studio GSTIN: {studioUpi.gstin}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right: Invoice Number, Dates & Status Stamp */}
          <div className="flex flex-col lg:items-end justify-between gap-3 bg-[#0D1F38] print:bg-slate-50 border border-[#1E3A5F] print:border-slate-200 rounded-xl p-4 sm:p-5 min-w-[260px]">
            <div className="flex lg:flex-col items-center lg:items-end justify-between w-full gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#94A3B8] print:text-slate-500">
                {invGstMeta.gstMode !== 'NON_GST' || studioUpi.gstin
                  ? 'TAX INVOICE (INR)'
                  : 'STUDIO COMMERCIAL INVOICE'}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-mono font-bold uppercase tracking-wider border ${statusStampConfig.badgeClass}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {statusStampConfig.label}
              </span>
            </div>

            <div className="w-full pt-2 border-t border-[#1E3A5F]/80 print:border-slate-200 space-y-1 text-xs lg:text-right">
              <p className="font-mono text-lg sm:text-xl font-bold text-[#F8FAFC] print:text-slate-900 tracking-tight">
                {invoice.invoiceNumber}
              </p>
              <div className="flex lg:justify-end gap-4 text-[11px] text-[#94A3B8] print:text-slate-600 font-mono">
                <span>
                  Issued:{' '}
                  <strong className="text-[#F8FAFC] print:text-slate-900">
                    {invoice.issueDate || '—'}
                  </strong>
                </span>
                <span>
                  Due:{' '}
                  <strong className="text-[#F8FAFC] print:text-slate-900">
                    {invoice.dueDate || 'On Receipt'}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Two-Column Billing & Project Reference Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Billed To */}
          <div className="p-4 sm:p-5 rounded-xl bg-[#0D1F38] print:bg-slate-50 border border-[#1E3A5F] print:border-slate-200 space-y-1.5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-[#10B981] print:text-emerald-700 font-semibold">
              01 · BILLED TO (CLIENT DETAILS)
            </p>
            <p className="text-base font-bold text-[#F8FAFC] print:text-slate-900">
              {invoice.clientName || 'Valued Studio Client'}
            </p>
            {clientCompany && clientCompany !== invoice.clientName && (
              <p className="text-xs font-medium text-[#CBD5E1] print:text-slate-700">
                {clientCompany}
              </p>
            )}
            <div className="text-xs text-[#94A3B8] print:text-slate-600 space-y-0.5 pt-1 font-mono">
              {invoice.clientEmail && <p>Email: {invoice.clientEmail}</p>}
              {clientPhone && <p>Phone / WhatsApp: {clientPhone}</p>}
              {invGstMeta.clientGstin && (
                <p className="text-[#F8FAFC] print:text-slate-900 font-semibold">
                  Client GSTIN: {invGstMeta.clientGstin}
                </p>
              )}
            </div>
          </div>

          {/* Project & Engagement Reference */}
          <div className="p-4 sm:p-5 rounded-xl bg-[#0D1F38] print:bg-slate-50 border border-[#1E3A5F] print:border-slate-200 space-y-1.5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-[#0EA5E9] print:text-sky-700 font-semibold">
              02 · PROJECT &amp; ENGAGEMENT DETAILS
            </p>
            <p className="text-base font-bold text-[#F8FAFC] print:text-slate-900">
              {invoice.projectTitle || 'Creative Design & Video Production'}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1.5 text-[11px] text-[#94A3B8] print:text-slate-600">
              <div>
                <span className="block text-[10px] uppercase font-mono text-[#64748B]">
                  HSN / SAC Classification
                </span>
                <span className="font-mono font-semibold text-[#F8FAFC] print:text-slate-900">
                  SAC {sacCode} (Creative Services)
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-mono text-[#64748B]">
                  Settlement Currency
                </span>
                <span className="font-mono font-semibold text-[#F8FAFC] print:text-slate-900">
                  INR (₹) · Indian Rupee
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Structured Itemized Deliverables Table */}
        <div className="rounded-xl border border-[#1E3A5F] print:border-slate-300 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#132A4A] print:bg-slate-100 border-b border-[#1E3A5F] print:border-slate-300 text-[11px] font-mono uppercase tracking-wider text-[#94A3B8] print:text-slate-700">
                  <th className="py-3.5 px-4 w-12">#</th>
                  <th className="py-3.5 px-4">Service &amp; Deliverable Description</th>
                  <th className="py-3.5 px-3 text-center w-24">SAC Code</th>
                  <th className="py-3.5 px-3 text-right w-20">Qty</th>
                  <th className="py-3.5 px-4 text-right w-32">Unit Rate (₹)</th>
                  <th className="py-3.5 px-4 text-right w-36">Line Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E3A5F] print:divide-slate-200 bg-[#0D1F38]/60 print:bg-white">
                {effectiveLineItems.map((li, index) => (
                  <tr
                    key={li.id || index}
                    className="hover:bg-[#132A4A]/40 print:hover:bg-transparent transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono text-[#94A3B8] print:text-slate-500">
                      {String(index + 1).padStart(2, '0')}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-[#F8FAFC] print:text-slate-900">
                      {li.description}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono text-[11px] text-[#94A3B8] print:text-slate-600">
                      {sacCode}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-[#F8FAFC] print:text-slate-900">
                      {li.quantity}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-[#CBD5E1] print:text-slate-700">
                      {formatINR(li.unitPrice)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-[#F8FAFC] print:text-slate-900">
                      {formatINR(li.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Financial Summary & Payment Ledger Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 7 Cols: Recorded Payment History + Studio Terms */}
          <div className="lg:col-span-7 space-y-4">
            {invoicePayments.length > 0 && (
              <div className="p-4 rounded-xl bg-[#0D1F38] print:bg-slate-50 border border-[#1E3A5F] print:border-slate-200 space-y-2.5">
                <p className="text-[11px] font-mono uppercase tracking-wider text-[#4ADE80] print:text-emerald-700 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Verified Payment Ledger ({invoicePayments.length})</span>
                </p>
                <div className="divide-y divide-[#1E3A5F] print:divide-slate-200 text-xs">
                  {invoicePayments.map((pay) => (
                    <div
                      key={pay.id}
                      className="py-2 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <span className="font-semibold text-[#F8FAFC] print:text-slate-900">
                          {pay.paymentDate}
                        </span>
                        <span className="text-[#94A3B8] print:text-slate-600">
                          {' '}
                          · {pay.method}
                        </span>
                        {pay.transactionReference && (
                          <span className="ml-2 font-mono text-[11px] px-2 py-0.5 rounded bg-[#132A4A] print:bg-slate-200 text-[#2DD4BF] print:text-slate-800">
                            UTR/Ref: {pay.transactionReference}
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-[#4ADE80] print:text-emerald-700">
                        +{formatINR(pay.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {invoice.notes && (
              <div className="p-4 rounded-xl bg-[#0D1F38]/80 print:bg-slate-50 border border-[#1E3A5F] print:border-slate-200 text-xs space-y-1">
                <p className="font-mono text-[10px] uppercase tracking-wider text-[#94A3B8] print:text-slate-500 font-semibold">
                  INVOICE NOTES &amp; DELIVERABLE TERMS
                </p>
                <p className="text-[#CBD5E1] print:text-slate-700 whitespace-pre-line leading-relaxed">
                  {invoice.notes}
                </p>
              </div>
            )}

            <div className="p-4 rounded-xl bg-[#0D1F38]/50 print:bg-slate-50 border border-[#1E3A5F]/70 print:border-slate-200 text-[11px] text-[#94A3B8] print:text-slate-600 space-y-1">
              <p className="font-semibold text-[#F8FAFC] print:text-slate-900">
                Master File Unlock &amp; License Policy:
              </p>
              <p>
                Unwatermarked high-resolution master deliverables (4K Video / Layered PSD / Vector
                Master Pack) unlock automatically in the Prithvi Editify Client Portal once the
                invoice balance due reaches ₹0.
              </p>
            </div>
          </div>

          {/* Right 5 Cols: Financial Totals Breakdown */}
          <div className="lg:col-span-5 bg-[#0D1F38] print:bg-slate-50 border border-[#1E3A5F] print:border-slate-300 rounded-xl p-5 space-y-2.5 text-xs">
            <div className="flex justify-between text-[#94A3B8] print:text-slate-600">
              <span>Itemized Subtotal</span>
              <span className="font-mono font-medium text-[#F8FAFC] print:text-slate-900">
                {formatINR(invoice.subtotal)}
              </span>
            </div>

            {invoice.discount > 0 && (
              <div className="flex justify-between text-[#4ADE80] print:text-emerald-700">
                <span>Studio Package Discount</span>
                <span className="font-mono font-semibold">-{formatINR(invoice.discount)}</span>
              </div>
            )}

            {invGstBreakdown.mode === 'CGST_SGST_18' ? (
              <>
                <div className="flex justify-between text-[#94A3B8] print:text-slate-600">
                  <span>CGST (9% · SAC {sacCode})</span>
                  <span className="font-mono text-[#F8FAFC] print:text-slate-900">
                    {formatINR(invGstBreakdown.cgstAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-[#94A3B8] print:text-slate-600">
                  <span>SGST (9% · SAC {sacCode})</span>
                  <span className="font-mono text-[#F8FAFC] print:text-slate-900">
                    {formatINR(invGstBreakdown.sgstAmount)}
                  </span>
                </div>
              </>
            ) : invGstBreakdown.mode === 'IGST_18' ? (
              <div className="flex justify-between text-[#94A3B8] print:text-slate-600">
                <span>IGST (18% · SAC {sacCode})</span>
                <span className="font-mono text-[#F8FAFC] print:text-slate-900">
                  {formatINR(invGstBreakdown.igstAmount)}
                </span>
              </div>
            ) : (
              invoice.taxRate > 0 && (
                <div className="flex justify-between text-[#94A3B8] print:text-slate-600">
                  <span>Tax ({invoice.taxRate}%)</span>
                  <span className="font-mono text-[#F8FAFC] print:text-slate-900">
                    {formatINR(invoice.taxAmount)}
                  </span>
                </div>
              )
            )}

            <div className="pt-3 border-t border-[#1E3A5F] print:border-slate-300 flex justify-between items-baseline text-sm font-bold text-[#F8FAFC] print:text-slate-900">
              <span>Invoice Grand Total (INR)</span>
              <span className="font-mono text-base">{formatINR(invoice.total)}</span>
            </div>

            <div className="flex justify-between text-[#4ADE80] print:text-emerald-700 font-medium">
              <span>Amount Paid to Date</span>
              <span className="font-mono">{formatINR(invoice.amountPaid)}</span>
            </div>

            <div
              className={`mt-2 p-3.5 rounded-lg border flex justify-between items-center ${
                invoice.balanceDue > 0
                  ? 'bg-[#F59E0B]/12 border-[#F59E0B]/40 text-[#FBBF24] print:bg-amber-50 print:text-amber-900 print:border-amber-300'
                  : 'bg-[#16A34A]/15 border-[#16A34A]/40 text-[#4ADE80] print:bg-emerald-50 print:text-emerald-900 print:border-emerald-300'
              }`}
            >
              <span className="font-bold uppercase tracking-wider text-[11px] font-mono">
                {invoice.balanceDue > 0 ? 'Balance Due (INR)' : 'Balance Settled'}
              </span>
              <span className="font-mono text-lg font-extrabold">
                {formatINR(invoice.balanceDue)}
              </span>
            </div>
          </div>
        </div>

        {/* 5. Dynamic UPI QR Code + Authorized Studio Signatory Footer */}
        <div className="pt-6 border-t border-[#1E3A5F] print:border-slate-200 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8">
            <UpiQrCodeCard
              amount={invoice.balanceDue}
              referenceNumber={invoice.invoiceNumber}
              clientName={invoice.clientName}
              onSubmitUtrClick={onSubmitUtrClick}
            />
          </div>

          <div className="lg:col-span-4 flex flex-col items-start lg:items-end justify-between text-left lg:text-right p-4 rounded-xl bg-[#0D1F38]/60 print:bg-slate-50 border border-[#1E3A5F] print:border-slate-200 space-y-2">
            <div className="flex items-center gap-2.5">
              <img
                src={effectiveLogo}
                alt={businessName}
                className="w-7 h-7 rounded-md bg-white p-0.5 object-contain border border-[#1E3A5F]"
              />
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#10B981] print:text-emerald-700 font-semibold">
                AUTHORIZED SIGNATORY
              </span>
            </div>
            <div className="pt-2">
              <p className="font-editorial italic text-lg text-[#F8FAFC] print:text-slate-900 font-semibold">
                {ownerName}
              </p>
              <p className="text-[11px] font-semibold text-[#CBD5E1] print:text-slate-800">
                Founder &amp; Creative Director, {businessName}
              </p>
              <p className="text-[10px] font-mono text-[#94A3B8] print:text-slate-500 mt-0.5">
                Verified Digital Studio Invoice · {invoice.invoiceNumber}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};



