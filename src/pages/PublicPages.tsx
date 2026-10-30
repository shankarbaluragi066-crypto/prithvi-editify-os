import React, { useEffect, useState, useMemo } from 'react';
import {
  Link,
  useSearchParams,
  useOutletContext,
  useParams,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  MessageSquare,
  ExternalLink,
  Clock,
  FileCheck,
  ShieldCheck,
  Eye,
  Search,
  X,
  SlidersHorizontal,
  Layers,
  Film,
  Sparkles,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Link2,
  IndianRupee,
} from 'lucide-react';
import {
  fetchPublishedServices,
  fetchPublishedPortfolio,
  getCachedPublishedServices,
  getCachedPublishedPortfolio,
} from '../services/crmService';
import {
  DEFAULT_SITE_CUSTOMIZATION,
  mergeSiteCustomization,
  createStudioArtworkDataUri,
} from '../utils/seedData';
import { ServiceItem, PortfolioItem, PublicSettings } from '../types/crm';
import { InquiryForm } from '../components/InquiryForm';
import { LazyImage } from '../components/LazyImage';
import { MediaPreviewModal, PreviewableMediaItem } from '../components/MediaPreviewModal';
import {
  BeforeAfterComparisonShowcase,
  InstantPriceCalculatorWidget,
  StudioFaqSection,
} from '../components/StudioEnhancements';
import { buildWhatsAppLink } from '../utils/formatters';
import { normalizePreviewableImageUrl, normalizeVideoEmbedUrl } from '../utils/mediaValidation';

interface OutletCtx {
  settings: PublicSettings;
}

// ============================================================================
// CATEGORY CONFIGURATION & NORMALIZATION HELPERS (SERVICES & PORTFOLIO)
// ============================================================================
const SERVICE_MARKETPLACE_CATEGORIES = [
  'All',
  'Graphic Design',
  'Video Editing',
  'Logo Design',
  'YouTube Thumbnail Design',
  'Social Media Design',
  'Banner and Flyer Design',
  'Promotional Ad Creatives',
  'YouTube Video Editing',
  'Instagram Reels Editing',
  'Social Media Content',
  'Photo Editing',
] as const;

const PORTFOLIO_SHOWCASE_CATEGORIES = [
  'All',
  'Graphic Design',
  'Video Editing',
  'Logo Design',
  'YouTube Thumbnails',
  'Social Media Posts',
  'Brand Identity and Logos',
  'Promotional Ads',
  'Instagram Reels',
] as const;

function formatServiceCategoryLabel(rawCategory: string, title?: string): string {
  const cat = (rawCategory || '').trim();
  const lowerCat = cat.toLowerCase();
  const lowerTitle = (title || '').toLowerCase();

  if (lowerTitle.includes('banner') || lowerTitle.includes('flyer')) {
    return 'Banner and Flyer Design';
  }
  if (lowerTitle.includes('photo edit') || lowerCat.includes('photo')) {
    return 'Photo Editing';
  }
  if (lowerCat === 'youtube thumbnails' || lowerCat === 'youtube thumbnail design') {
    return 'YouTube Thumbnail Design';
  }
  if (lowerCat === 'social media') {
    if (lowerTitle.includes('content') || lowerTitle.includes('carousel')) {
      return 'Social Media Design';
    }
    return 'Social Media Design';
  }
  if (lowerCat === 'branding' || lowerCat === 'logo and brand design') {
    return 'Logo and Brand Design';
  }
  if (lowerCat === 'promotional ads' || lowerCat === 'promotional ad creatives') {
    return 'Promotional Ad Creatives';
  }
  if (lowerCat === 'video editing' || lowerCat === 'youtube video editing') {
    return 'YouTube Video Editing';
  }
  if (lowerCat === 'instagram reels' || lowerCat === 'instagram reels editing') {
    return 'Instagram Reels Editing';
  }
  return cat || 'Graphic Design';
}

function matchesServiceCategoryFilter(service: ServiceItem, selectedFilter: string): boolean {
  if (selectedFilter === 'All') return true;
  const filterLower = selectedFilter.toLowerCase();
  const rawCatLower = (service.category || '').toLowerCase();
  const mappedLabelLower = formatServiceCategoryLabel(service.category, service.title).toLowerCase();
  const titleLower = (service.title || '').toLowerCase();
  const descLower = (service.description || '').toLowerCase();

  if (rawCatLower === filterLower || mappedLabelLower === filterLower) return true;

  switch (selectedFilter) {
    case 'Graphic Design':
      return rawCatLower === 'graphic design' || titleLower.includes('graphic');
    case 'Video Editing':
      return (
        rawCatLower.includes('video') ||
        rawCatLower.includes('reel') ||
        titleLower.includes('video') ||
        titleLower.includes('edit')
      );
    case 'Logo Design':
    case 'Logo and Brand Design':
      return (
        rawCatLower.includes('brand') ||
        rawCatLower.includes('logo') ||
        titleLower.includes('brand') ||
        titleLower.includes('logo')
      );
    case 'YouTube Thumbnail Design':
      return (
        rawCatLower.includes('thumbnail') ||
        titleLower.includes('thumbnail')
      );
    case 'Social Media Design':
      return (
        rawCatLower.includes('social media') ||
        titleLower.includes('social media')
      );
    case 'Banner and Flyer Design':
      return (
        rawCatLower.includes('banner') ||
        rawCatLower.includes('flyer') ||
        titleLower.includes('banner') ||
        titleLower.includes('flyer')
      );
    case 'Promotional Ad Creatives':
      return (
        rawCatLower.includes('promotional') ||
        rawCatLower.includes('ad') ||
        titleLower.includes('ad creative') ||
        titleLower.includes('campaign')
      );
    case 'YouTube Video Editing':
      return (
        rawCatLower === 'video editing' ||
        rawCatLower === 'youtube video editing' ||
        titleLower.includes('youtube video')
      );
    case 'Instagram Reels Editing':
      return (
        rawCatLower.includes('reel') ||
        titleLower.includes('reel') ||
        titleLower.includes('short')
      );
    case 'Social Media Content':
      return (
        rawCatLower.includes('social') ||
        titleLower.includes('content') ||
        descLower.includes('social media') ||
        descLower.includes('carousel')
      );
    case 'Photo Editing':
      return (
        rawCatLower.includes('photo') ||
        titleLower.includes('photo') ||
        descLower.includes('retouch') ||
        descLower.includes('color grading') ||
        rawCatLower === 'other'
      );
    default:
      return rawCatLower === filterLower;
  }
}

function formatPortfolioCategoryLabel(rawCategory: string): string {
  const cat = (rawCategory || '').trim();
  if (cat === 'Social Media') return 'Social Media Posts';
  if (cat === 'Branding') return 'Brand Identity and Logos';
  return cat || 'Graphic Design';
}

function matchesPortfolioCategoryFilter(item: PortfolioItem, selectedFilter: string): boolean {
  if (selectedFilter === 'All') return true;
  const rawCat = (item.category || '').trim();
  const rawCatLower = rawCat.toLowerCase();
  const displayCat = formatPortfolioCategoryLabel(rawCat);
  const displayCatLower = displayCat.toLowerCase();
  const filterLower = selectedFilter.toLowerCase();
  const titleLower = (item.title || '').toLowerCase();

  if (rawCatLower === filterLower || displayCatLower === filterLower) return true;

  if (selectedFilter === 'Video Editing') {
    return (
      rawCatLower.includes('video') ||
      rawCatLower.includes('reel') ||
      titleLower.includes('video') ||
      Boolean(item.videoUrl)
    );
  }
  if (selectedFilter === 'Logo Design' || selectedFilter === 'Brand Identity and Logos') {
    return (
      rawCatLower === 'branding' ||
      rawCatLower.includes('logo') ||
      rawCatLower.includes('brand') ||
      titleLower.includes('logo') ||
      titleLower.includes('brand')
    );
  }
  if (selectedFilter === 'Social Media Posts' && rawCat === 'Social Media') return true;
  return false;
}

function parseDeliverablesList(summary: string): string[] {
  if (!summary || !summary.trim()) return [];
  return summary
    .split(/[,·•;\n]+/)
    .map((part) => part.trim().replace(/\.$/, ''))
    .filter((part) => part.length > 2);
}

// ============================================================================
// REUSABLE MARKETPLACE SERVICE & PORTFOLIO CARDS (CONSISTENT 16:10 ASPECT RATIO)
function buildServiceBookingPageUrl(
  service: ServiceItem,
  customPriceRange?: string,
  referenceLink?: string
): string {
  const slug = encodeURIComponent(service.slug || service.id);
  const serviceLabel = `${service.title} (${
    service.isCustomQuote ? 'Custom quote' : service.priceDisplay
  })`;
  const params = new URLSearchParams();
  params.set('service', serviceLabel);
  const effectivePrice = (customPriceRange || '').trim() || service.priceDisplay;
  if (effectivePrice) {
    params.set('budget', effectivePrice);
  }
  const effectiveLink = (referenceLink || '').trim();
  if (effectiveLink) {
    params.set('link', effectiveLink);
  }
  return `/book/${slug}?${params.toString()}`;
}

// ============================================================================
interface MarketplaceServiceCardProps {
  service: ServiceItem;
  settings: PublicSettings;
  primaryBg: string;
  secondaryBg: string;
  accentColor: string;
  onQuickPreview?: (previewItem: PreviewableMediaItem) => void;
}

const MarketplaceServiceCard: React.FC<MarketplaceServiceCardProps> = ({
  service: srv,
  settings,
  primaryBg,
  secondaryBg,
  accentColor,
  onQuickPreview,
}) => {
  const navigate = useNavigate();
  const [customPriceRange, setCustomPriceRange] = useState('');
  const [referenceLink, setReferenceLink] = useState('');

  const detailPath = `/services/${encodeURIComponent(srv.slug || srv.id)}`;
  const displayCategory = formatServiceCategoryLabel(srv.category, srv.title);
  const fallbackArtwork = createStudioArtworkDataUri(
    srv.title,
    displayCategory,
    accentColor,
    primaryBg,
    secondaryBg
  );
  const normalizedImg = normalizePreviewableImageUrl(srv.imageUrl);
  const hasCustomImage = Boolean(
    normalizedImg && !normalizedImg.startsWith('data:image/svg+xml')
  );
  const coverSrc = hasCustomImage ? normalizedImg : fallbackArtwork;
  const creatorName = settings.ownerName || 'Shankar Baluragi';
  const studioName = settings.businessName || 'Prithvi Editify';

  return (
    <article className="pe-card-interactive group bg-[#0D1F38] border border-[#1E3A5F] rounded-xl overflow-hidden flex flex-col justify-between shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
      <div>
        {/* 1. Consistent 16:9 Full-Fit Media Stage (Zero Cropping) */}
        <div className="relative aspect-video w-full bg-[#040D1A] overflow-hidden border-b border-[#1E3A5F]">
          <Link
            to={detailPath}
            className="relative flex items-center justify-center w-full h-full overflow-hidden"
          >
            <LazyImage
              src={coverSrc}
              fallbackSrc={fallbackArtwork}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover blur-xl opacity-35 scale-110 pointer-events-none select-none"
            />
            <LazyImage
              src={coverSrc}
              fallbackSrc={fallbackArtwork}
              fallbackSubtitle={displayCategory}
              alt={srv.title}
              className="relative z-10 w-full h-full object-contain transition-transform duration-300 ease-out group-hover:scale-[1.02]"
            />
          </Link>

          {/* Category Tag Overlay */}
          <span className="absolute top-2.5 left-2.5 z-20 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-white bg-[#040D1A]/85 backdrop-blur-xs border border-white/15 rounded-md shadow-xs">
            {displayCategory}
          </span>

          {/* Quick Lightbox Preview Trigger */}
          {onQuickPreview && (
            <button
              type="button"
              onClick={() =>
                onQuickPreview({
                  id: srv.id,
                  title: srv.title,
                  url: coverSrc,
                  videoUrl: srv.videoPreviewUrl || undefined,
                  description: `${srv.description}${
                    srv.deliverablesSummary ? ` — Included: ${srv.deliverablesSummary}` : ''
                  }`,
                  categoryLabel: `${displayCategory} · ${srv.priceDisplay}`,
                  storageBucket: 'service-media',
                })
              }
              title="Quick preview sample"
              className="absolute bottom-2.5 right-2.5 z-20 inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-white bg-[#040D1A]/85 hover:bg-[#040D1A] backdrop-blur-xs rounded-md border border-white/15 shadow-xs transition-all duration-150 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Preview</span>
            </button>
          )}
        </div>

        {/* 2. Marketplace Card Body */}
        <div className="p-5 space-y-3">
          {/* Seller / Studio Attribution Strip */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 shadow-2xs"
                style={{ backgroundColor: primaryBg }}
              >
                {creatorName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#F8FAFC] truncate leading-tight">
                  {creatorName}
                </p>
                <p className="text-[11px] text-[#94A3B8] truncate leading-tight mt-0.5">
                  {studioName}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#16A34A] bg-[#16A34A]/10 px-2 py-0.5 rounded shrink-0">
              Verified Studio
            </span>
          </div>

          {/* Service Title */}
          <h3 className="text-[15px] font-semibold text-[#F8FAFC] group-hover:text-[#10B981] transition-colors leading-snug line-clamp-2 min-h-[2.6rem]">
            <Link to={detailPath} className="focus:outline-none">
              {srv.title}
            </Link>
          </h3>

          {/* Short Description */}
          <p className="text-xs text-[#94A3B8] line-clamp-2 leading-relaxed min-h-[2.25rem]">
            {srv.description}
          </p>

          {/* Delivery Time & Revisions Meta Strip */}
          <div className="pt-2.5 border-t border-[#1E3A5F]/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#94A3B8]">
            <span className="inline-flex items-center gap-1.5 font-medium text-[#F8FAFC]">
              <Clock className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
              <span>{srv.turnaroundTime || '24–48 hours'}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <RefreshCw className="w-3 h-3 text-[#94A3B8] shrink-0" />
              <span>{srv.revisions || '2 Revisions'}</span>
            </span>
            {!srv.isCustomQuote && (
              <span className="text-[#16A34A] font-semibold">Single Price</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Single Price, Customer Custom Price Range + Reference Link & Book Now Footer */}
      <div className="px-5 py-3.5 bg-[#132A4A]/75 border-t border-[#1E3A5F] space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
            {srv.isCustomQuote ? 'Project Scope' : 'Service Price'}
          </span>
          <span className="font-mono text-base font-bold text-[#F8FAFC] tabular-nums">
            {srv.priceDisplay}
          </span>
        </div>

        {/* Customer Custom Price Range & Reference Link Inputs on Every Service */}
        <div className="grid grid-cols-1 gap-2 pt-0.5">
          <div className="relative">
            <IndianRupee className="w-3.5 h-3.5 text-[#10B981] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={customPriceRange}
              onChange={(e) => setCustomPriceRange(e.target.value)}
              placeholder={`Custom price range (e.g. ${srv.priceDisplay} – ₹2,500)`}
              aria-label={`Custom price range for ${srv.title}`}
              className="w-full pl-7 pr-2.5 py-1.5 text-[11px] bg-[#0D1F38] border border-[#1E3A5F] focus:border-[#10B981] rounded-lg text-[#F8FAFC] placeholder-[#64748B] outline-none transition-colors"
            />
          </div>
          <div className="relative">
            <Link2 className="w-3.5 h-3.5 text-[#0EA5E9] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="url"
              value={referenceLink}
              onChange={(e) => setReferenceLink(e.target.value)}
              placeholder="Add reference / footage link (Drive, YouTube...)"
              aria-label={`Reference link for ${srv.title}`}
              className="w-full pl-7 pr-2.5 py-1.5 text-[11px] bg-[#0D1F38] border border-[#1E3A5F] focus:border-[#10B981] rounded-lg text-[#F8FAFC] placeholder-[#64748B] outline-none transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link
            to={detailPath}
            className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-[#F8FAFC] bg-[#0D1F38] border border-[#1E3A5F] hover:border-[#10B981] hover:bg-[#132A4A]/50 rounded-lg transition-colors text-center"
          >
            View Details
          </Link>
          <button
            type="button"
            onClick={() => {
              const targetUrl = buildServiceBookingPageUrl(
                srv,
                customPriceRange,
                referenceLink
              );
              window.scrollTo({ top: 0, behavior: 'smooth' });
              navigate(targetUrl, {
                state: {
                  service: srv,
                  customPriceRange: customPriceRange.trim() || srv.priceDisplay,
                  referenceLink: referenceLink.trim(),
                },
              });
            }}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg transition-colors text-center cursor-pointer"
          >
            <span>Book Now</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </article>
  );
};

interface MarketplacePortfolioCardProps {
  item: PortfolioItem;
  settings?: PublicSettings;
  primaryBg: string;
  secondaryBg: string;
  accentColor: string;
  onQuickPreview?: (item: PortfolioItem) => void;
}

const MarketplacePortfolioCard: React.FC<MarketplacePortfolioCardProps> = ({
  item,
  settings,
  primaryBg,
  secondaryBg,
  accentColor,
  onQuickPreview,
}) => {
  const detailPath = `/portfolio/${encodeURIComponent(item.slug || item.id)}`;
  const displayCat = formatPortfolioCategoryLabel(item.category);
  const fallbackArtwork = createStudioArtworkDataUri(
    item.title,
    displayCat,
    accentColor,
    primaryBg,
    secondaryBg
  );
  const normalizedCover = normalizePreviewableImageUrl(item.coverImage);
  const hasCustomCover = Boolean(
    normalizedCover && !normalizedCover.startsWith('data:image/svg+xml')
  );
  const coverSrc = hasCustomCover ? normalizedCover : fallbackArtwork;
  const creatorName = settings?.ownerName || 'Shankar Baluragi';
  const studioName = settings?.businessName || 'Prithvi Editify';
  const galleryCount = 1 + (Array.isArray(item.galleryUrls) ? item.galleryUrls.filter(Boolean).length : 0);

  return (
    <article className="pe-card-interactive group bg-[#0D1F38] border border-[#1E3A5F] rounded-xl overflow-hidden flex flex-col justify-between shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
      <div>
        {/* 1. Consistent 16:9 Full-Fit Media Stage (Zero Cropping) */}
        <div className="relative aspect-video w-full bg-[#040D1A] overflow-hidden border-b border-[#1E3A5F]">
          <Link
            to={detailPath}
            className="relative flex items-center justify-center w-full h-full overflow-hidden"
          >
            <LazyImage
              src={coverSrc}
              fallbackSrc={fallbackArtwork}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover blur-xl opacity-35 scale-110 pointer-events-none select-none"
            />
            <LazyImage
              src={coverSrc}
              fallbackSrc={fallbackArtwork}
              fallbackSubtitle={displayCat}
              alt={item.title}
              className="relative z-10 w-full h-full object-contain transition-transform duration-300 ease-out group-hover:scale-[1.02]"
            />
          </Link>

          {/* Category Tag Overlay */}
          <span className="absolute top-2.5 left-2.5 z-20 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-white bg-[#040D1A]/85 backdrop-blur-xs border border-white/15 rounded-md shadow-xs">
            {displayCat}
          </span>

          {/* Quick Lightbox Preview Trigger */}
          {onQuickPreview && (
            <button
              type="button"
              onClick={() => onQuickPreview(item)}
              title="Quick preview project"
              className="absolute bottom-2.5 right-2.5 z-20 inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-white bg-[#040D1A]/85 hover:bg-[#040D1A] backdrop-blur-xs rounded-md border border-white/15 shadow-xs transition-all duration-150 cursor-pointer"
            >
              {item.videoUrl ? (
                <Film className="w-3.5 h-3.5 text-[#10B981]" />
              ) : (
                <Eye className="w-3.5 h-3.5 text-[#10B981]" />
              )}
              <span>Preview</span>
            </button>
          )}
        </div>

        {/* 2. Marketplace Card Body */}
        <div className="p-5 space-y-3">
          {/* Studio Attribution Strip */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 shadow-2xs"
                style={{ backgroundColor: primaryBg }}
              >
                {creatorName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#F8FAFC] truncate leading-tight">
                  {creatorName}
                </p>
                <p className="text-[11px] text-[#94A3B8] truncate leading-tight mt-0.5">
                  {studioName}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#16A34A] bg-[#16A34A]/10 px-2 py-0.5 rounded shrink-0">
              Verified Studio
            </span>
          </div>

          {/* Project Title */}
          <h3 className="text-[15px] font-semibold text-[#F8FAFC] group-hover:text-[#10B981] transition-colors leading-snug line-clamp-2 min-h-[2.6rem]">
            <Link to={detailPath} className="focus:outline-none">
              {item.title}
            </Link>
          </h3>

          {/* Short Description */}
          <p className="text-xs text-[#94A3B8] line-clamp-2 leading-relaxed min-h-[2.25rem]">
            {item.description}
          </p>

          {/* Project Meta Strip */}
          <div className="pt-2.5 border-t border-[#1E3A5F]/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#94A3B8]">
            <span className="inline-flex items-center gap-1.5 font-medium text-[#F8FAFC]">
              <Clock className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
              <span>{item.videoUrl ? 'Video Production' : '24–48 hours'}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <RefreshCw className="w-3 h-3 text-[#94A3B8] shrink-0" />
              <span>{galleryCount > 1 ? `${galleryCount} Previews` : 'High-Res Export'}</span>
            </span>
            <span className="text-[#16A34A] font-semibold">
              {item.featured ? 'Featured Work' : 'Case Study'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Deliverable & Dual Action Footer */}
      <div className="px-5 py-3.5 bg-[#132A4A]/75 border-t border-[#1E3A5F] space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
            Deliverable
          </span>
          <span className="font-mono text-sm font-bold text-[#F8FAFC] truncate max-w-[190px]">
            {item.metricsSummary || displayCat}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link
            to={`/contact?service=${encodeURIComponent(displayCat)}`}
            className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-[#F8FAFC] bg-[#0D1F38] border border-[#1E3A5F] hover:border-[#10B981] hover:bg-[#132A4A]/50 rounded-lg transition-colors text-center"
          >
            Contact for a Project
          </Link>
          <Link
            to={detailPath}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg transition-colors text-center"
          >
            <span>View Project</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </article>
  );
};

// ============================================================================
// 1. HOME PAGE (PRESERVED EXACTLY)
// ============================================================================
export const HomePage: React.FC = () => {
  const { settings } = useOutletContext<OutletCtx>();
  const custom = mergeSiteCustomization(settings.siteCustomization || DEFAULT_SITE_CUSTOMIZATION);
  const [services, setServices] = useState<ServiceItem[]>(() => getCachedPublishedServices());
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>(() => getCachedPublishedPortfolio());
  const [portfolioCategory, setPortfolioCategory] = useState<string>('All');
  const [previewMedia, setPreviewMedia] = useState<PreviewableMediaItem | null>(null);
  const [loading, setLoading] = useState<boolean>(() => getCachedPublishedServices().length === 0);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchPublishedServices().catch(() => []),
      fetchPublishedPortfolio().catch(() => []),
    ])
      .then(([srv, port]) => {
        if (!active) return;
        setServices(srv);
        setPortfolio(port);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const whatsappUrl = buildWhatsAppLink(settings.whatsappNumber, settings.whatsappDefaultMessage);
  const primaryBg = custom.primaryColor || '#040D1A';
  const secondaryBg = custom.secondaryColor || '#132A4A';
  const accentColor = custom.accentColor || '#10B981';

  const heroPreviewSrc =
    custom.heroImageUrl ||
    createStudioArtworkDataUri(
      custom.heroArtworkTitle || settings.businessName || 'Prithvi Editify',
      custom.heroArtworkSubtitle || 'Design Grids · Thumbnails · Video Timelines',
      accentColor,
      primaryBg,
      secondaryBg
    );

  const trustIcons = [Clock, FileCheck, ShieldCheck];

  return (
    <div>
      {/* HERO SECTION */}
      <section
        className="text-[#F8FAFC] border-b"
        style={{ backgroundColor: primaryBg, borderColor: secondaryBg }}
      >
        <div className="max-w-[1200px] mx-auto px-6 py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
            {/* Left Copy Column */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-8">
              <div className="space-y-6">
                <p
                  className="text-xs font-semibold tracking-wide"
                  style={{ color: '#2DD4BF' }}
                >
                  {custom.heroKicker}
                </p>
                <h1
                  className="font-editorial font-bold text-white tracking-tight leading-[1.08]"
                  style={{ fontSize: 'clamp(2.5rem, 4.2vw, 3.75rem)', textWrap: 'balance' }}
                >
                  {custom.heroHeadline}
                </h1>
                <p className="text-base sm:text-lg text-[#94A3B8] max-w-xl leading-relaxed">
                  {custom.heroSubheadline}
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-4">
                  <Link
                    to={custom.heroPrimaryCtaLink || '/contact'}
                    className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-white rounded-lg shadow-sm hover:opacity-95 transition-all whitespace-nowrap shrink-0"
                    style={{ backgroundColor: accentColor }}
                  >
                    <span>{custom.heroPrimaryCtaLabel || 'Start a Project'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    to={custom.heroSecondaryCtaLink || '/portfolio'}
                    className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-white border border-white/10 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    style={{ backgroundColor: secondaryBg }}
                  >
                    <span>{custom.heroSecondaryCtaLabel || 'Explore Portfolio'}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      const videoItem = portfolio.find((p) => Boolean(p.videoUrl)) || portfolio[0];
                      setPreviewMedia({
                        id: 'studio-showreel-hero',
                        title: `${settings.businessName || 'Prithvi Editify'} — 60s Studio Showreel & Editing Highlights`,
                        url: heroPreviewSrc,
                        videoUrl: videoItem?.videoUrl || undefined,
                        description:
                          'High-retention YouTube editing, dynamic Instagram Reels motion graphics, color grading, and CTR-tested thumbnail systems by Shankar Baluragi.',
                        categoryLabel: 'Studio Showreel · 4K 60fps Master',
                        storageBucket: 'portfolio-media',
                      });
                    }}
                    className="inline-flex items-center gap-2 px-4 py-3.5 text-xs font-semibold text-[#2DD4BF] bg-[#0D1F38] hover:bg-[#132A4A] border border-[#10B981]/40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Film className="w-4 h-4 text-[#10B981]" />
                    <span>Watch Studio Showreel</span>
                  </button>
                </div>


                {custom.heroDisciplines && custom.heroDisciplines.length > 0 && (
                  <div
                    className="pt-4 border-t flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#94A3B8]"
                    style={{ borderColor: secondaryBg }}
                  >
                    {custom.heroDisciplines.map((disc, idx) => (
                      <React.Fragment key={`${disc}_${idx}`}>
                        {idx > 0 && <span aria-hidden="true">·</span>}
                        <span>{disc}</span>
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Visual Studio Composition */}
            <div className="lg:col-span-5 flex">
              <div
                className="pe-card-interactive w-full border border-white/10 rounded-lg p-6 flex flex-col justify-between space-y-6"
                style={{ backgroundColor: secondaryBg }}
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="text-xs font-semibold text-white">{custom.showcaseTitle}</p>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">{custom.showcaseSubtitle}</p>
                  </div>
                  <span className="font-mono text-xs font-semibold" style={{ color: '#2DD4BF' }}>
                    {custom.showcaseBadge}
                  </span>
                </div>

                {/* Custom Image or Architectural SVG Composition */}
                <div
                  className="relative aspect-video overflow-hidden rounded-lg border border-white/10 flex items-center justify-center"
                  style={{ backgroundColor: primaryBg }}
                >
                  <LazyImage
                    src={heroPreviewSrc}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover blur-xl opacity-35 scale-110 pointer-events-none select-none"
                  />
                  <LazyImage
                    src={heroPreviewSrc}
                    alt={`${settings.businessName || 'Prithvi Editify'} studio showcase`}
                    eager
                    className="relative z-10 w-full h-full object-contain"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div
                    className="pe-card-interactive border border-white/10 rounded-lg p-3.5"
                    style={{ backgroundColor: primaryBg }}
                  >
                    <p className="text-xs text-[#94A3B8]">{custom.stat1Label}</p>
                    <p className="text-lg font-mono font-semibold text-white mt-1 tabular-nums">
                      {custom.stat1Value}
                    </p>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">{custom.stat1Subtext}</p>
                  </div>
                  <div
                    className="pe-card-interactive border border-white/10 rounded-lg p-3.5"
                    style={{ backgroundColor: primaryBg }}
                  >
                    <p className="text-xs text-[#94A3B8]">{custom.stat2Label}</p>
                    <p className="text-lg font-semibold text-white mt-1">{custom.stat2Value}</p>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">{custom.stat2Subtext}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES PREVIEW SECTION */}
      {custom.showServicesSection !== false && (
        <section className="max-w-[1200px] mx-auto px-6 py-20">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <p className="text-xs font-semibold text-[#94A3B8] tracking-wide">
                {custom.homeServicesKicker}
              </p>
              <h2 className="font-editorial text-3xl font-semibold text-[#F8FAFC] mt-2">
                {custom.homeServicesHeading}
              </h2>
            </div>
            <Link
              to="/services"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#F8FAFC] hover:text-[#10B981] transition-colors whitespace-nowrap shrink-0"
            >
              <span>{custom.homeServicesCtaLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-96 bg-[#0D1F38] rounded-lg animate-pulse border border-[#1E3A5F]"
                />
              ))}
            </div>
          ) : services.length === 0 ? (
            <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-10 text-center">
              <p className="font-editorial text-lg font-semibold text-[#F8FAFC]">
                Custom Creative Services Available
              </p>
              <p className="text-sm text-[#94A3B8] mt-1.5 max-w-md mx-auto">
                Contact {settings.businessName || 'Prithvi Editify'} directly to discuss your graphic design, thumbnail, or video editing project scope.
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <Link
                  to="/contact"
                  className="px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg transition-colors"
                >
                  Contact for a Project
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.slice(0, 6).map((srv) => (
                <MarketplaceServiceCard
                  key={srv.id}
                  service={srv}
                  settings={settings}
                  primaryBg={primaryBg}
                  secondaryBg={secondaryBg}
                  accentColor={accentColor}
                  onQuickPreview={(item) => setPreviewMedia(item)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* PORTFOLIO PREVIEW SECTION */}
      {settings.portfolioVisible !== false && portfolio.length > 0 && (
        <section className="bg-[#0D1F38] border-y border-[#1E3A5F] py-20">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#1E3A5F]">
              <div>
                <p className="text-xs font-semibold text-[#94A3B8] tracking-wide">
                  {custom.homePortfolioKicker}
                </p>
                <h2 className="font-editorial text-3xl font-semibold text-[#F8FAFC] mt-2">
                  {custom.homePortfolioHeading}
                </h2>
              </div>
              <Link
                to="/portfolio"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#F8FAFC] hover:text-[#10B981] transition-colors whitespace-nowrap shrink-0"
              >
                <span>{custom.homePortfolioCtaLabel}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Horizontal Category Filter Bar for Home Portfolio Section */}
            <div
              role="tablist"
              aria-label="Filter featured portfolio projects by category"
              className="flex items-center gap-2 overflow-x-auto py-4 border-b border-[#1E3A5F] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              {PORTFOLIO_SHOWCASE_CATEGORIES.map((cat) => {
                const active = portfolioCategory === cat;
                const matchCount =
                  cat === 'All'
                    ? portfolio.length
                    : portfolio.filter((item) => matchesPortfolioCategoryFilter(item, cat)).length;
                if (cat !== 'All' && matchCount === 0) return null;

                return (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() =>
                      setPortfolioCategory((prev) => (prev === cat && cat !== 'All' ? 'All' : cat))
                    }
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-lg border transition-all duration-150 whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-gradient-to-r from-[#0EA5E9] to-[#10B981] text-white border-[#10B981] font-semibold shadow-2xs'
                        : 'bg-[#132A4A]/70 text-[#94A3B8] border-[#1E3A5F] hover:bg-[#132A4A] hover:text-[#F8FAFC] hover:border-[#10B981]/40 font-medium'
                    }`}
                  >
                    <span>{cat}</span>
                    {matchCount > 0 && (
                      <span
                        className={`font-mono text-[10px] px-1.5 py-0.2 rounded tabular-nums ${
                          active
                            ? 'bg-white/15 text-white'
                            : 'bg-[#1E3A5F]/70 text-[#F8FAFC]'
                        }`}
                      >
                        {matchCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-96 bg-[#132A4A] rounded-lg animate-pulse border border-[#1E3A5F]"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                {portfolio
                  .filter((item) => matchesPortfolioCategoryFilter(item, portfolioCategory))
                  .slice(0, 6)
                  .map((item) => (
                    <MarketplacePortfolioCard
                      key={item.id}
                      item={item}
                      settings={settings}
                      primaryBg={primaryBg}
                      secondaryBg={secondaryBg}
                      accentColor={accentColor}
                      onQuickPreview={(selected) =>
                        setPreviewMedia({
                          id: selected.id,
                          title: selected.title,
                          url:
                            selected.coverImage ||
                            createStudioArtworkDataUri(
                              selected.title,
                              selected.category,
                              accentColor,
                              primaryBg,
                              secondaryBg
                            ),
                          videoUrl: selected.videoUrl || undefined,
                          description: selected.description,
                          tags: selected.tags,
                          categoryLabel: `${formatPortfolioCategoryLabel(selected.category)} · ${
                            selected.metricsSummary || 'Studio Deliverable'
                          }`,
                          storageBucket: 'portfolio-media',
                        })
                      }
                    />
                  ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* BEFORE / AFTER VISUAL COMPARISON SHOWCASE ON HOMEPAGE */}
      <section className="max-w-[1200px] mx-auto px-6 pt-16">
        <BeforeAfterComparisonShowcase />
      </section>

      {/* INTERACTIVE INSTANT QUOTE / PACKAGE CALCULATOR ON HOMEPAGE */}
      <section id="instant-quote-calculator" className="max-w-[1200px] mx-auto px-6 pt-14 pb-4 scroll-mt-24">
        <InstantPriceCalculatorWidget whatsappNumber={settings.whatsappNumber} />
      </section>

      {/* PROCESS SECTION */}
      {custom.showProcessSection !== false && (
        <section className="max-w-[1200px] mx-auto px-6 py-20">
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-semibold text-[#94A3B8] tracking-wide">
              {custom.processKicker}
            </p>
            <h2 className="font-editorial text-3xl font-semibold text-[#F8FAFC] mt-2">
              {custom.processHeading}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {custom.processSteps.map((p, idx) => (
              <div
                key={`${p.step}_${idx}`}
                className="pe-card-interactive bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-6 shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
              >
                <h3 className="text-base font-semibold text-[#F8FAFC]">{p.step}</h3>
                <p className="text-sm text-[#94A3B8] mt-2.5 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TRUST SECTION */}
      {custom.showTrustSection !== false && (
        <section
          className="text-[#F8FAFC] py-20 border-y"
          style={{ backgroundColor: primaryBg, borderColor: secondaryBg }}
        >
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="max-w-2xl mb-12">
              <p className="text-xs font-semibold tracking-wide" style={{ color: '#2DD4BF' }}>
                {custom.trustKicker}
              </p>
              <h2 className="font-editorial text-3xl font-semibold text-white mt-2">
                {custom.trustHeading}
              </h2>
              <p className="text-sm text-[#94A3B8] mt-3 leading-relaxed">{custom.trustSubtitle}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {custom.trustPillars.map((pillar, idx) => {
                const IconComp = trustIcons[idx % trustIcons.length];
                return (
                  <div
                    key={`${pillar.title}_${idx}`}
                    className="pe-card-interactive border border-white/10 rounded-xl p-6"
                    style={{ backgroundColor: secondaryBg }}
                  >
                    <IconComp className="w-5 h-5 mb-3" style={{ color: '#2DD4BF' }} />
                    <h3 className="text-base font-semibold text-white">{pillar.title}</h3>
                    <p className="text-sm text-[#94A3B8] mt-2 leading-relaxed">{pillar.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* FREQUENTLY ASKED QUESTIONS (FAQ) SECTION FOR TRUST & SEO */}
      <StudioFaqSection
        primaryBg={primaryBg}
        secondaryBg={secondaryBg}
        accentColor={accentColor}
        ownerName={settings.ownerName || 'Shankar Baluragi'}
        businessName={settings.businessName || 'Prithvi Editify'}
        whatsappUrl={whatsappUrl}
      />

      {/* CONTACT / INQUIRY SECTION */}
      {custom.showHomeContactSection !== false && (
        <section id="home-inquiry-section" className="max-w-[1200px] mx-auto px-6 py-20 scroll-mt-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-5 space-y-6">
              <p className="text-xs font-semibold text-[#94A3B8] tracking-wide">
                {custom.homeContactKicker}
              </p>
              <h2 className="font-editorial text-3xl font-semibold text-[#F8FAFC]">
                {custom.homeContactHeading}
              </h2>
              <p className="text-sm text-[#94A3B8] leading-relaxed">{custom.homeContactDesc}</p>

              <div className="pe-card-interactive bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-6 space-y-4">
                <h3 className="text-sm font-semibold text-[#F8FAFC]">Direct Studio Contact</h3>
                <div className="space-y-2 text-xs text-[#94A3B8]">
                  <p>
                    <span className="font-semibold text-[#F8FAFC]">Studio Owner:</span>{' '}
                    {settings.ownerName || 'Shankar Baluragi'}
                  </p>
                  {settings.businessEmail && (
                    <p>
                      <span className="font-semibold text-[#F8FAFC]">Email:</span>{' '}
                      {settings.businessEmail}
                    </p>
                  )}
                  {custom.workingHours && (
                    <p>
                      <span className="font-semibold text-[#F8FAFC]">Hours:</span>{' '}
                      {custom.workingHours}
                    </p>
                  )}
                </div>
                <div className="pt-2">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white rounded-lg hover:opacity-95 transition-opacity whitespace-nowrap shrink-0"
                    style={{ backgroundColor: accentColor }}
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Open WhatsApp Chat</span>
                  </a>
                  <p className="text-[11px] text-[#94A3B8] mt-2">
                    Opens WhatsApp with a prefilled inquiry message. You confirm and send the message directly in WhatsApp.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="pe-card-interactive bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-6 sm:p-8 space-y-6 shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#10B981]">
                    <Sparkles className="w-4 h-4" />
                    <span>Single-Rate Creative Service Booking</span>
                  </span>
                  <h3 className="font-editorial text-2xl font-semibold text-[#F8FAFC]">
                    Book Your Creative Service in a Dedicated Booking Page
                  </h3>
                  <p className="text-sm text-[#94A3B8] leading-relaxed">
                    Select any service above or open our dedicated booking page to enter your custom price range, attach reference or footage links, and specify your deliverable requirements.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 bg-[#132A4A]/60 border border-[#1E3A5F] rounded-lg space-y-1">
                    <span className="font-mono text-[#10B981] font-bold">01 · Select Service</span>
                    <p className="text-[#F8FAFC] font-medium">Single transparent pricing</p>
                  </div>
                  <div className="p-3.5 bg-[#132A4A]/60 border border-[#1E3A5F] rounded-lg space-y-1">
                    <span className="font-mono text-[#0EA5E9] font-bold">02 · Custom Budget & Link</span>
                    <p className="text-[#F8FAFC] font-medium">Add price range & Drive/YouTube URL</p>
                  </div>
                  <div className="p-3.5 bg-[#132A4A]/60 border border-[#1E3A5F] rounded-lg space-y-1">
                    <span className="font-mono text-[#2DD4BF] font-bold">03 · Fast Delivery</span>
                    <p className="text-[#F8FAFC] font-medium">24–48h studio turnaround</p>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <Link
                    to="/book"
                    className="inline-flex items-center gap-2 px-6 py-3 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg transition-colors shadow-sm"
                  >
                    <span>Open Service Booking Page</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    to="/services"
                    className="inline-flex items-center gap-2 px-5 py-3 text-xs font-semibold text-[#F8FAFC] bg-[#132A4A] hover:bg-[#1E3A5F] border border-[#1E3A5F] rounded-lg transition-colors"
                  >
                    <span>Browse All Services</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <MediaPreviewModal item={previewMedia} onClose={() => setPreviewMedia(null)} />
    </div>
  );
};

// ============================================================================
// 2. SERVICES MARKETPLACE PAGE (/services)
// ============================================================================
type ServiceSortOption = 'recommended' | 'price_asc' | 'price_desc';

export const ServicesPage: React.FC = () => {
  const { settings } = useOutletContext<OutletCtx>();
  const custom = mergeSiteCustomization(settings.siteCustomization || DEFAULT_SITE_CUSTOMIZATION);
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryScrollRef = React.useRef<HTMLDivElement>(null);

  const initialCategory = searchParams.get('category') || 'All';
  const initialQuery = searchParams.get('q') || '';

  const [services, setServices] = useState<ServiceItem[]>(() => getCachedPublishedServices());
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState<string>(initialQuery);
  const [sortBy, setSortBy] = useState<ServiceSortOption>('recommended');
  const [loading, setLoading] = useState<boolean>(() => getCachedPublishedServices().length === 0);
  const [previewService, setPreviewService] = useState<PreviewableMediaItem | null>(null);

  useEffect(() => {
    const paramCat = searchParams.get('category') || 'All';
    setSelectedCategory(paramCat);
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    fetchPublishedServices()
      .then((list) => {
        if (!active) return;
        setServices(list);
      })
      .catch(() => {
        if (!active) return;
        setServices([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Build unified category list: standard categories + any additional custom admin categories
  const categoryOptions = useMemo(() => {
    const base = [...SERVICE_MARKETPLACE_CATEGORIES] as string[];
    const lowerKnown = new Set(base.map((c) => c.toLowerCase()));
    services.forEach((srv) => {
      const mapped = formatServiceCategoryLabel(srv.category, srv.title);
      if (mapped && !lowerKnown.has(mapped.toLowerCase()) && srv.category.toLowerCase() !== 'other') {
        lowerKnown.add(mapped.toLowerCase());
        base.push(mapped);
      }
    });
    return base;
  }, [services]);

  const handleSelectCategory = (cat: string) => {
    const nextCategory = selectedCategory === cat && cat !== 'All' ? 'All' : cat;
    setSelectedCategory(nextCategory);
    const nextParams = new URLSearchParams(searchParams);
    if (nextCategory === 'All') {
      nextParams.delete('category');
    } else {
      nextParams.set('category', nextCategory);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const scrollCategoryBar = (direction: 'left' | 'right') => {
    if (!categoryScrollRef.current) return;
    const offset = direction === 'left' ? -260 : 260;
    categoryScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  const filteredAndSortedServices = useMemo(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase();

    const filtered = services.filter((srv) => {
      const matchesCat = matchesServiceCategoryFilter(srv, selectedCategory);
      if (!matchesCat) return false;

      if (!trimmedQuery) return true;
      const displayCat = formatServiceCategoryLabel(srv.category, srv.title).toLowerCase();
      return (
        srv.title.toLowerCase().includes(trimmedQuery) ||
        srv.description.toLowerCase().includes(trimmedQuery) ||
        srv.category.toLowerCase().includes(trimmedQuery) ||
        displayCat.includes(trimmedQuery) ||
        (srv.deliverablesSummary || '').toLowerCase().includes(trimmedQuery)
      );
    });

    if (sortBy === 'price_asc') {
      return [...filtered].sort((a, b) => {
        const aCustom = a.isCustomQuote || !a.startingPrice || a.startingPrice <= 0;
        const bCustom = b.isCustomQuote || !b.startingPrice || b.startingPrice <= 0;
        if (aCustom && !bCustom) return 1;
        if (!aCustom && bCustom) return -1;
        return (a.startingPrice || 0) - (b.startingPrice || 0);
      });
    }

    if (sortBy === 'price_desc') {
      return [...filtered].sort((a, b) => {
        const aCustom = a.isCustomQuote || !a.startingPrice || a.startingPrice <= 0;
        const bCustom = b.isCustomQuote || !b.startingPrice || b.startingPrice <= 0;
        if (aCustom && !bCustom) return 1;
        if (!aCustom && bCustom) return -1;
        return (b.startingPrice || 0) - (a.startingPrice || 0);
      });
    }

    return [...filtered].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [services, selectedCategory, searchQuery, sortBy]);

  const hasActiveFilters =
    selectedCategory !== 'All' || searchQuery.trim() !== '' || sortBy !== 'recommended';

  const handleClearFilters = () => {
    setSelectedCategory('All');
    setSearchQuery('');
    setSortBy('recommended');
    setSearchParams({});
  };

  const primaryBg = custom.primaryColor || '#040D1A';
  const secondaryBg = custom.secondaryColor || '#132A4A';
  const accentColor = custom.accentColor || '#10B981';

  return (
    <div>
      {/* Top Horizontal Marketplace Category Filter Bar */}
      <div className="bg-[#0D1F38] border-b border-[#1E3A5F] sticky top-16 z-20 shadow-[0_1px_2px_rgba(23,35,51,0.03)]">
        <div className="max-w-[1200px] mx-auto px-6 flex items-center gap-2 py-2.5">
          <button
            type="button"
            onClick={() => scrollCategoryBar('left')}
            aria-label="Scroll categories left"
            className="hidden sm:inline-flex items-center justify-center w-7 h-7 rounded-md border border-[#1E3A5F] bg-[#0D1F38] text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#10B981]/40 shrink-0 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div
            ref={categoryScrollRef}
            role="tablist"
            aria-label="Filter services by category"
            className="flex items-center gap-2 overflow-x-auto py-0.5 scroll-smooth flex-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {categoryOptions.map((cat) => {
              const active = selectedCategory === cat;
              const matchCount =
                cat === 'All'
                  ? services.length
                  : services.filter((srv) => matchesServiceCategoryFilter(srv, cat)).length;
              if (cat !== 'All' && services.length > 0 && matchCount === 0 && !active) return null;

              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => handleSelectCategory(cat)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-lg border transition-all duration-150 whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-gradient-to-r from-[#0EA5E9] to-[#10B981] text-white border-[#10B981] font-semibold shadow-2xs'
                      : 'bg-[#132A4A]/70 text-[#94A3B8] border-[#1E3A5F] hover:bg-[#132A4A] hover:text-[#F8FAFC] hover:border-[#10B981]/40 font-medium'
                  }`}
                >
                  <span>{cat}</span>
                  {services.length > 0 && matchCount > 0 && (
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.2 rounded tabular-nums ${
                        active
                          ? 'bg-white/15 text-white'
                          : 'bg-[#1E3A5F]/70 text-[#F8FAFC]'
                      }`}
                    >
                      ({matchCount})
                    </span>
                  )}
                </button>
              );
            })}
          </div>


          <button
            type="button"
            onClick={() => scrollCategoryBar('right')}
            aria-label="Scroll categories right"
            className="hidden sm:inline-flex items-center justify-center w-7 h-7 rounded-md border border-[#1E3A5F] bg-[#0D1F38] text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#10B981]/40 shrink-0 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 py-12 lg:py-14">
        {/* Marketplace Header, Search & Sort Controls */}
        <div className="border-b border-[#1E3A5F] pb-7">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold text-[#94A3B8] tracking-wide">
                {custom.servicesPageKicker || 'Prithvi Editify · Creative Services'}
              </p>
              <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-[#F8FAFC] mt-2">
                {selectedCategory === 'All'
                  ? custom.servicesPageTitle || 'Creative Services'
                  : selectedCategory}
              </h1>
              <p className="text-base text-[#94A3B8] mt-2.5 leading-relaxed">
                {custom.servicesPageDescription ||
                  'Professional design, video editing and digital creative solutions for your brand.'}
              </p>
            </div>

            {/* Search & Sort Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for a service…"
                  aria-label="Search for a service"
                  className="w-full pl-10 pr-8 py-2.5 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded-lg text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-none focus:border-[#10B981] transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#F8FAFC] p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#94A3B8] shrink-0 hidden sm:block" />
                <label htmlFor="service-sort" className="text-xs text-[#94A3B8] whitespace-nowrap">
                  Sort by:
                </label>
                <select
                  id="service-sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as ServiceSortOption)}
                  className="px-3 py-2.5 text-xs font-medium text-[#F8FAFC] bg-[#0D1F38] border border-[#1E3A5F] rounded-lg focus:outline-none focus:border-[#10B981] transition-colors"
                >
                  <option value="recommended">Recommended</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                </select>
              </div>
            </div>
          </div>

          {/* Active Filter Status Strip */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#94A3B8]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono tabular-nums text-[#F8FAFC] font-semibold">
                {filteredAndSortedServices.length}{' '}
                {filteredAndSortedServices.length === 1 ? 'service' : 'services'} available
              </span>
              {selectedCategory !== 'All' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#040D1A]/5 text-[#F8FAFC] font-medium">
                  <span>Category: {selectedCategory}</span>
                  <button
                    type="button"
                    onClick={() => handleSelectCategory('All')}
                    aria-label={`Remove ${selectedCategory} filter`}
                    className="hover:text-[#10B981]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#F8FAFC] hover:text-[#10B981] transition-colors whitespace-nowrap"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear all filters</span>
              </button>
            )}
          </div>
        </div>

      {/* Services Marketplace Grid — Fiverr-Inspired Service Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="h-[420px] bg-[#0D1F38] border border-[#1E3A5F] rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : filteredAndSortedServices.length === 0 ? (
        <div className="mt-10 bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-12 text-center max-w-xl mx-auto shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
          <h2 className="font-editorial text-xl font-semibold text-[#F8FAFC]">
            No matching services found
          </h2>
          <p className="text-sm text-[#94A3B8] mt-2 leading-relaxed">
            No services matched your current search or category selection. Try clearing your filters or contact Prithvi Editify directly for a custom project scope.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg transition-colors"
            >
              Reset All Filters
            </button>
            <Link
              to="/contact"
              className="px-4 py-2.5 text-xs font-semibold text-[#F8FAFC] bg-[#132A4A] hover:bg-[#1E3A5F] rounded-lg transition-colors"
            >
              Contact for a Project
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
          {filteredAndSortedServices.map((srv) => (
            <MarketplaceServiceCard
              key={srv.id}
              service={srv}
              settings={settings}
              primaryBg={primaryBg}
              secondaryBg={secondaryBg}
              accentColor={accentColor}
              onQuickPreview={(item) => setPreviewService(item)}
            />
          ))}
        </div>
      )}

      {/* Interactive Project Price Calculator & Before/After Studio Showcase */}
      <div className="mt-16 space-y-12">
        <InstantPriceCalculatorWidget whatsappNumber={settings.whatsappNumber} />
        <BeforeAfterComparisonShowcase />
      </div>

      {/* Custom Scope Banner */}
      <div className="pe-card-interactive mt-16 bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
        <div className="max-w-xl">
          <p className="text-xs font-semibold text-[#94A3B8]">Custom Creative Production</p>
          <h2 className="font-editorial text-2xl font-semibold text-[#F8FAFC] mt-1">
            Need a multi-deliverable package or monthly creative retainer?
          </h2>
          <p className="text-sm text-[#94A3B8] mt-2 leading-relaxed">
            Share your brand requirements, volume of creatives, and target schedule with Shankar Baluragi for a tailored studio quote.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            to="/book"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg transition-colors whitespace-nowrap"
          >
            <span>Book a Service</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/portfolio"
            className="px-4 py-2.5 text-xs font-semibold text-[#F8FAFC] bg-[#132A4A] hover:bg-[#1E3A5F] rounded-lg transition-colors whitespace-nowrap"
          >
            Explore Portfolio
          </Link>
        </div>
      </div>

      <MediaPreviewModal item={previewService} onClose={() => setPreviewService(null)} />
      </div>
    </div>
  );
};

// ============================================================================
// 2B. SERVICE DETAILS PAGE (/services/:slug) — FIVERR-STYLE MARKETPLACE LAYOUT
// ============================================================================
export const ServiceDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { settings } = useOutletContext<OutletCtx>();
  const custom = mergeSiteCustomization(settings.siteCustomization || DEFAULT_SITE_CUSTOMIZATION);

  const [services, setServices] = useState<ServiceItem[]>(() => getCachedPublishedServices());
  const [loading, setLoading] = useState<boolean>(() => getCachedPublishedServices().length === 0);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [previewMedia, setPreviewMedia] = useState<PreviewableMediaItem | null>(null);
  const [customPriceRange, setCustomPriceRange] = useState('');
  const [referenceLink, setReferenceLink] = useState('');

  useEffect(() => {
    let active = true;
    const cached = getCachedPublishedServices();
    if (cached.length === 0) {
      setLoading(true);
    }
    setActiveMediaIndex(0);
    setCustomPriceRange('');
    setReferenceLink('');
    fetchPublishedServices()
      .then((list) => {
        if (!active) return;
        setServices(list);
      })
      .catch(() => {
        if (!active) return;
        if (cached.length === 0) setServices([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const service = useMemo(() => {
    if (!slug) return null;
    const decoded = decodeURIComponent(slug).toLowerCase();
    return (
      services.find(
        (s) =>
          (s.slug && s.slug.toLowerCase() === decoded) ||
          s.id.toLowerCase() === decoded
      ) || null
    );
  }, [services, slug]);

  const relatedServices = useMemo(() => {
    if (!service) return [];
    const sameCategory = services.filter(
      (s) =>
        s.id !== service.id &&
        formatServiceCategoryLabel(s.category, s.title) ===
          formatServiceCategoryLabel(service.category, service.title)
    );
    const others = services.filter(
      (s) => s.id !== service.id && !sameCategory.some((sc) => sc.id === s.id)
    );
    return [...sameCategory, ...others].slice(0, 3);
  }, [services, service]);

  const primaryBg = custom.primaryColor || '#040D1A';
  const secondaryBg = custom.secondaryColor || '#132A4A';
  const accentColor = custom.accentColor || '#10B981';

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-16 space-y-8">
        <div className="h-6 w-64 bg-[#0D1F38] border border-[#1E3A5F] rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 h-[480px] bg-[#0D1F38] border border-[#1E3A5F] rounded-lg animate-pulse" />
          <div className="lg:col-span-4 h-[420px] bg-[#0D1F38] border border-[#1E3A5F] rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-20 text-center space-y-4">
        <p className="text-xs font-semibold text-[#94A3B8]">Service Not Found</p>
        <h1 className="font-editorial text-3xl font-semibold text-[#F8FAFC]">
          This service listing is unavailable
        </h1>
        <p className="text-sm text-[#94A3B8] max-w-md mx-auto">
          The service you selected may have been updated or unpublished. Browse all available creative services below.
        </p>
        <div className="pt-2 flex items-center justify-center gap-3">
          <Link
            to="/services"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Creative Services</span>
          </Link>
          <Link
            to="/contact"
            className="px-5 py-2.5 text-xs font-semibold text-[#F8FAFC] bg-[#0D1F38] border border-[#1E3A5F] hover:border-[#10B981] rounded-lg transition-colors"
          >
            Contact for a Project
          </Link>
        </div>
      </div>
    );
  }

  const displayCategory = formatServiceCategoryLabel(service.category, service.title);
  const fallbackArtwork = createStudioArtworkDataUri(
    service.title,
    displayCategory,
    accentColor,
    primaryBg,
    secondaryBg
  );
  const normalizedImg = normalizePreviewableImageUrl(service.imageUrl);
  const hasCustomImage = Boolean(
    normalizedImg && !normalizedImg.startsWith('data:image/svg+xml')
  );
  const primaryCover = hasCustomImage ? normalizedImg : fallbackArtwork;

  // Build gallery list from cover image + any additional configured mediaUrls
  const galleryImages = [
    primaryCover,
    ...(Array.isArray(service.mediaUrls)
      ? service.mediaUrls.map((u) => normalizePreviewableImageUrl(u)).filter(Boolean)
      : []),
  ];
  const currentPreviewUrl = galleryImages[activeMediaIndex] || primaryCover;

  const deliverablesItems = parseDeliverablesList(service.deliverablesSummary);
  const creatorName = settings.ownerName || 'Shankar Baluragi';
  const studioName = settings.businessName || 'Prithvi Editify';

  const whatsappMessage = [
    `Hello ${studioName}, I would like to discuss the "${service.title}" service (${
      customPriceRange.trim() || (service.isCustomQuote ? 'Custom Project Scope' : service.priceDisplay)
    }).`,
    referenceLink.trim() ? `Reference Link: ${referenceLink.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const whatsappUrl = buildWhatsAppLink(settings.whatsappNumber || '+916361902619', whatsappMessage);
  const bookingPageUrl = buildServiceBookingPageUrl(service, customPriceRange, referenceLink);

  const serviceJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        name: service.title,
        serviceType: displayCategory,
        description: service.description,
        provider: {
          '@type': 'ProfessionalService',
          name: studioName,
          url: 'https://prithvieditify.netlify.app/',
          founder: {
            '@type': 'Person',
            name: creatorName,
          },
          areaServed: 'IN',
        },
        areaServed: {
          '@type': 'Country',
          name: 'India',
        },
        offers: {
          '@type': 'Offer',
          name: service.title,
          description: service.deliverablesSummary || service.description,
          priceCurrency: 'INR',
          ...(service.isCustomQuote
            ? {}
            : { price: String(service.startingPrice || 500) }),
          availability: 'https://schema.org/InStock',
        },
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `How much does ${service.title} cost at ${studioName}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: service.isCustomQuote
                ? `${service.title} is scoped on a custom INR quotation basis depending on deliverables. Contact ${creatorName} for an itemized INR quote.`
                : `${service.title} is offered at a transparent single rate of ${service.priceDisplay} in Indian Rupees (INR).`,
            },
          },
          {
            '@type': 'Question',
            name: `What is the turnaround time and revision policy for ${service.title}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Standard delivery for ${service.title} is ${
                service.turnaroundTime || '24–48 hours'
              } and includes ${
                service.revisions || '2 structured revision rounds'
              } via the Prithvi Editify Client Portal.`,
            },
          },
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://prithvieditify.netlify.app/',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Creative Services',
            item: 'https://prithvieditify.netlify.app/services',
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: service.title,
            item: `https://prithvieditify.netlify.app/services/${encodeURIComponent(
              service.slug || service.id
            )}`,
          },
        ],
      },
    ],
  };

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10 lg:py-14 space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      {/* 1. Breadcrumb & Service Marketplace Header */}
      <div className="space-y-4 border-b border-[#1E3A5F] pb-6">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center justify-between gap-4 text-xs text-[#94A3B8]"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/services" className="hover:text-[#F8FAFC] transition-colors font-medium">
              Creative Services
            </Link>
            <span aria-hidden="true">/</span>
            <Link
              to={`/services?category=${encodeURIComponent(displayCategory)}`}
              className="hover:text-[#F8FAFC] transition-colors"
            >
              {displayCategory}
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-[#F8FAFC] font-medium truncate max-w-xs sm:max-w-md">
              {service.title}
            </span>
          </div>
          <Link
            to="/services"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F8FAFC] hover:text-[#10B981] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Services</span>
          </Link>
        </nav>

        <h1 className="font-editorial text-2xl sm:text-3xl lg:text-4xl font-semibold text-[#F8FAFC] leading-tight">
          {service.title}
        </h1>

        {/* Studio Attribution Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ backgroundColor: primaryBg }}
              >
                {creatorName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#F8FAFC]">{creatorName}</span>
                  <span className="text-[11px] font-semibold text-[#16A34A] bg-[#16A34A]/10 px-2 py-0.5 rounded">
                    Verified Studio Owner
                  </span>
                </div>
                <p className="text-[11px] text-[#94A3B8]">
                  {studioName} · Creative Production Studio
                </p>
              </div>
            </div>

            <span className="hidden sm:inline text-[#1E3A5F]">|</span>

            <div className="flex flex-wrap items-center gap-3 text-xs text-[#94A3B8]">
              <span className="inline-flex items-center gap-1 font-medium text-[#F8FAFC]">
                <Clock className="w-3.5 h-3.5 text-[#10B981]" />
                <span>Delivery: {service.turnaroundTime || '24–48 hours'}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 font-medium text-[#F8FAFC]">
                <RefreshCw className="w-3.5 h-3.5 text-[#16A34A]" />
                <span>{service.revisions || '2 Revisions'}</span>
              </span>
            </div>
          </div>

          <Link
            to={bookingPageUrl}
            state={{
              service,
              customPriceRange: customPriceRange.trim() || service.priceDisplay,
              referenceLink: referenceLink.trim(),
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#10B981] hover:text-[#2DD4BF] transition-colors"
          >
            <span>Book This Service</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 2. Main 2-Column Layout — Aligned at the exact top edge */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Gallery Stage, Service Details, Requirements & Inquiry */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-8">
          {/* Interactive Gallery Stage */}
          <div className="pe-card-interactive bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-3 sm:p-4 space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
            <div
              onClick={() =>
                setPreviewMedia({
                  id: `${service.id}_${activeMediaIndex}`,
                  title:
                    galleryImages.length > 1
                      ? `${service.title} (Preview ${activeMediaIndex + 1} of ${galleryImages.length})`
                      : service.title,
                  url: currentPreviewUrl,
                  videoUrl: service.videoPreviewUrl || undefined,
                  description: service.description,
                  categoryLabel: `${displayCategory} · ${service.priceDisplay}`,
                  storageBucket: 'service-media',
                })
              }
              className="relative aspect-video max-h-[480px] w-full bg-[#040D1A] rounded-lg overflow-hidden border border-[#1E3A5F] cursor-zoom-in group flex items-center justify-center"
            >
              <LazyImage
                src={currentPreviewUrl}
                fallbackSrc={fallbackArtwork}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover blur-xl opacity-35 scale-110 pointer-events-none select-none"
              />
              <LazyImage
                src={currentPreviewUrl}
                fallbackSrc={fallbackArtwork}
                fallbackSubtitle={displayCategory}
                alt={service.title}
                eager
                className="relative z-10 w-full h-full object-contain"
              />

              {/* Prev / Next Gallery Arrows when multiple images exist */}
              {galleryImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMediaIndex((prev) =>
                        prev === 0 ? galleryImages.length - 1 : prev - 1
                      );
                    }}
                    aria-label="Previous image"
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-[#0D1F38]/90 hover:bg-[#132A4A] text-[#F8FAFC] flex items-center justify-center shadow-md transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMediaIndex((prev) =>
                        prev === galleryImages.length - 1 ? 0 : prev + 1
                      );
                    }}
                    aria-label="Next image"
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-[#0D1F38]/90 hover:bg-[#132A4A] text-[#F8FAFC] flex items-center justify-center shadow-md transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewMedia({
                    id: `${service.id}_${activeMediaIndex}`,
                    title:
                      galleryImages.length > 1
                        ? `${service.title} (Preview ${activeMediaIndex + 1} of ${galleryImages.length})`
                        : service.title,
                    url: currentPreviewUrl,
                    videoUrl: service.videoPreviewUrl || undefined,
                    description: service.description,
                    categoryLabel: `${displayCategory} · ${service.priceDisplay}`,
                    storageBucket: 'service-media',
                  });
                }}
                className="absolute bottom-3 right-3 z-20 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#040D1A]/90 hover:bg-[#040D1A] border border-white/15 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                <Eye className="w-4 h-4 text-[#10B981]" />
                <span>Open Full Preview</span>
              </button>
            </div>

            {/* Gallery Thumbnails & Optional Video Sample */}
            {(galleryImages.length > 1 || service.videoPreviewUrl) && (
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {galleryImages.map((imgUrl, idx) => (
                  <button
                    key={`${imgUrl}_${idx}`}
                    type="button"
                    onClick={() => setActiveMediaIndex(idx)}
                    className={`w-20 h-14 rounded-md overflow-hidden border bg-[#040D1A] transition-all cursor-pointer ${
                      activeMediaIndex === idx
                        ? 'border-[#10B981] ring-2 ring-[#10B981]/20'
                        : 'border-[#1E3A5F] opacity-70 hover:opacity-100'
                    }`}
                  >
                    <LazyImage
                      src={imgUrl}
                      fallbackSrc={fallbackArtwork}
                      alt={`${service.title} thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}

                {service.videoPreviewUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewMedia({
                        id: `${service.id}_video`,
                        title: `${service.title} — Video Sample`,
                        url: primaryCover,
                        videoUrl: service.videoPreviewUrl,
                        description: service.description,
                        categoryLabel: `${displayCategory} · Video Preview`,
                        storageBucket: 'service-media',
                      })
                    }
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-[#F8FAFC] bg-[#132A4A] border border-[#1E3A5F] hover:border-[#10B981] rounded-lg transition-colors cursor-pointer"
                  >
                    <Film className="w-4 h-4 text-[#10B981]" />
                    <span>Watch Video Sample</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* About This Service & Deliverables Card */}
          <section className="pe-card-interactive bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-6 sm:p-8 space-y-6 shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
            <div className="space-y-3">
              <h2 className="font-editorial text-xl font-semibold text-[#F8FAFC]">
                About This Service
              </h2>
              <p className="text-sm sm:text-base text-[#94A3B8] leading-relaxed whitespace-pre-line">
                {service.description}
              </p>
            </div>

            <div className="pt-6 border-t border-[#1E3A5F] space-y-4">
              <div>
                <h3 className="font-editorial text-lg font-semibold text-[#F8FAFC]">
                  What’s Included & Deliverables
                </h3>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Every project for {service.title} includes these studio deliverables:
                </p>
              </div>

              {deliverablesItems.length > 0 ? (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {deliverablesItems.map((item, idx) => (
                    <li
                      key={`${item}_${idx}`}
                      className="pe-card-interactive flex items-start gap-2.5 text-sm text-[#F8FAFC] bg-[#132A4A]/60 border border-[#1E3A5F] rounded-lg p-3"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[#94A3B8]">
                  {service.deliverablesSummary ||
                    'High-resolution production files scoped specifically to your project brief.'}
                </p>
              )}
            </div>

            <div className="pt-5 border-t border-[#1E3A5F] grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="pe-card-interactive p-3.5 bg-[#132A4A]/50 rounded-lg border border-[#1E3A5F]">
                <span className="block text-[#94A3B8]">Service Category</span>
                <span className="font-semibold text-[#F8FAFC] mt-1 block">{displayCategory}</span>
              </div>
              <div className="pe-card-interactive p-3.5 bg-[#132A4A]/50 rounded-lg border border-[#1E3A5F]">
                <span className="block text-[#94A3B8]">Standard Turnaround</span>
                <span className="font-semibold text-[#F8FAFC] mt-1 block">
                  {service.turnaroundTime || '24–48 hours'}
                </span>
              </div>
              <div className="pe-card-interactive p-3.5 bg-[#132A4A]/50 rounded-lg border border-[#1E3A5F]">
                <span className="block text-[#94A3B8]">Service Rate (INR)</span>
                <span className="font-mono font-semibold text-[#F8FAFC] mt-1 block tabular-nums">
                  {service.priceDisplay}
                </span>
              </div>
            </div>
          </section>

          {/* Client Requirements Section */}
          <section className="pe-card-interactive bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-6 sm:p-8 space-y-5 shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
            <div>
              <h2 className="font-editorial text-xl font-semibold text-[#F8FAFC]">
                Client Requirements
              </h2>
              <p className="text-xs text-[#94A3B8] mt-1">
                To begin work on your project smoothly, please share the following details when submitting your brief:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="pe-card-interactive p-4 bg-[#132A4A]/70 border border-[#1E3A5F] rounded-lg space-y-1">
                <p className="font-semibold text-[#F8FAFC]">01. Project Objective & Platform</p>
                <p className="text-[#94A3B8] leading-relaxed">
                  Specify where the creative or edit will be published (YouTube, Instagram, LinkedIn, Meta Ads, Print, or Web) and required dimensions.
                </p>
              </div>
              <div className="pe-card-interactive p-4 bg-[#132A4A]/70 border border-[#1E3A5F] rounded-lg space-y-1">
                <p className="font-semibold text-[#F8FAFC]">02. Copy, Script, or Key Text</p>
                <p className="text-[#94A3B8] leading-relaxed">
                  Provide any exact headlines, thumbnail titles, ad copy, or video timestamps that need to appear in the deliverable.
                </p>
              </div>
              <div className="pe-card-interactive p-4 bg-[#132A4A]/70 border border-[#1E3A5F] rounded-lg space-y-1">
                <p className="font-semibold text-[#F8FAFC]">03. Brand Assets & Raw Footage</p>
                <p className="text-[#94A3B8] leading-relaxed">
                  Attach logos, brand colors, subject photos, or footage links via the inquiry form or inside your Client Portal.
                </p>
              </div>
              <div className="pe-card-interactive p-4 bg-[#132A4A]/70 border border-[#1E3A5F] rounded-lg space-y-1">
                <p className="font-semibold text-[#F8FAFC]">04. Preferred Schedule</p>
                <p className="text-[#94A3B8] leading-relaxed">
                  Let us know your target release date so we can confirm turnaround and milestone review dates before starting.
                </p>
              </div>
            </div>
          </section>

          {/* Category-Specific Before / After Visual Quality Comparison inside Service Detail Page */}
          <BeforeAfterComparisonShowcase
            defaultPresetId={
              displayCategory.toLowerCase().includes('video') ||
              displayCategory.toLowerCase().includes('reel')
                ? 'colorgrade'
                : displayCategory.toLowerCase().includes('photo') ||
                  displayCategory.toLowerCase().includes('brand') ||
                  displayCategory.toLowerCase().includes('logo')
                ? 'retouch'
                : 'thumbnail'
            }
          />
        </div>


        {/* RIGHT STICKY COLUMN: Single Service Pricing Card */}
        <aside className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24 space-y-5">
          <div className="pe-card-interactive bg-[#0D1F38] border border-[#1E3A5F] rounded-lg overflow-hidden shadow-[0_6px_24px_rgba(23,35,51,0.06)]">
            <div className="px-6 py-4 bg-[#132A4A] text-[#F8FAFC] border-b border-[#1E3A5F] flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wide">
                {service.isCustomQuote ? 'Custom Project Scope' : 'Single Service Pricing'}
              </span>
              <span className="font-mono text-xs font-semibold text-[#10B981]">INR PRICING</span>
            </div>

            <div className="p-6 space-y-5">
              {/* Service Header & Single Price */}
              <div className="flex items-baseline justify-between gap-4 pb-4 border-b border-[#1E3A5F]">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#10B981] block">
                    {service.isCustomQuote ? 'Scoped Brief' : 'Standard Rate'}
                  </span>
                  <h2 className="text-base font-semibold text-[#F8FAFC] mt-0.5">
                    {service.title}
                  </h2>
                </div>
                <span className="font-mono text-2xl font-bold text-[#F8FAFC] tabular-nums shrink-0">
                  {service.priceDisplay}
                </span>
              </div>

              {/* Service Summary */}
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                {service.description}
              </p>

              {/* Delivery & Revisions Bar */}
              <div className="flex items-center justify-between gap-4 py-3 px-3.5 bg-[#132A4A]/80 border border-[#1E3A5F] rounded-lg text-xs font-semibold text-[#F8FAFC]">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#10B981]" />
                  <span>
                    {service.isCustomQuote
                      ? service.turnaroundTime || 'Scoped per brief'
                      : `${service.turnaroundTime || '24–48 hours'} Delivery`}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-[#16A34A]" />
                  <span>{service.revisions || '2 Revisions'}</span>
                </span>
              </div>

              {/* Included Deliverables Checklist */}
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-[#F8FAFC]">What’s Included:</p>
                {deliverablesItems.length > 0 ? (
                  <ul className="space-y-2">
                    {deliverablesItems.map((item, idx) => (
                      <li
                        key={`single_feat_${idx}`}
                        className="flex items-start gap-2 text-xs text-[#F8FAFC]"
                      >
                        <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-[#94A3B8]">
                    {service.deliverablesSummary || 'High-resolution deliverables and commercial usage rights.'}
                  </p>
                )}
              </div>

              {/* Customer Custom Price Range & Reference Link Inputs */}
              <div className="p-3.5 bg-[#040D1A]/70 border border-[#1E3A5F] rounded-lg space-y-3">
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#F8FAFC] mb-1">
                    <IndianRupee className="w-3.5 h-3.5 text-[#10B981]" />
                    <span>Your Custom Price Range (INR)</span>
                  </label>
                  <input
                    type="text"
                    value={customPriceRange}
                    onChange={(e) => setCustomPriceRange(e.target.value)}
                    placeholder={`e.g. ${service.priceDisplay} or ₹2,000 – ₹5,000`}
                    className="w-full px-3 py-2 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded-lg text-[#F8FAFC] placeholder-[#94A3B8]/60 focus:outline-none focus:border-[#10B981]"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#F8FAFC] mb-1">
                    <Link2 className="w-3.5 h-3.5 text-[#0EA5E9]" />
                    <span>Reference / Footage Link (Drive, YouTube, Figma)</span>
                  </label>
                  <input
                    type="url"
                    value={referenceLink}
                    onChange={(e) => setReferenceLink(e.target.value)}
                    placeholder="https://drive.google.com/... or reference URL"
                    className="w-full px-3 py-2 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded-lg text-[#F8FAFC] placeholder-[#94A3B8]/60 focus:outline-none focus:border-[#10B981]"
                  />
                </div>
              </div>

              {/* Primary Book Now & Secondary Action Buttons */}
              <div className="pt-2 space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    navigate(bookingPageUrl, {
                      state: {
                        service,
                        customPriceRange: customPriceRange.trim() || service.priceDisplay,
                        referenceLink: referenceLink.trim(),
                      },
                    });
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg transition-colors shadow-sm cursor-pointer"
                >
                  <span>Book Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-semibold text-white rounded-lg hover:opacity-95 transition-opacity"
                  style={{ backgroundColor: accentColor }}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Discuss on WhatsApp</span>
                </a>
              </div>
            </div>
          </div>

          {/* Studio Seller Card */}
          <div className="pe-card-interactive bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-5 space-y-3 text-xs">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ backgroundColor: primaryBg }}
              >
                {creatorName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-[#F8FAFC]">{creatorName}</p>
                <p className="text-[#94A3B8]">Founder · {studioName}</p>
              </div>
            </div>
            <p className="text-[#94A3B8] leading-relaxed">
              Every project includes written scope confirmation, private draft previews in the Client Portal, and itemized INR billing.
            </p>
            <div className="pt-2 border-t border-[#1E3A5F] flex items-center justify-between text-[11px] text-[#94A3B8]">
              <span>Currency: INR (₹)</span>
              <Link
                to={bookingPageUrl}
                state={{
                  service,
                  customPriceRange: customPriceRange.trim() || service.priceDisplay,
                  referenceLink: referenceLink.trim(),
                }}
                className="font-semibold text-[#F8FAFC] hover:text-[#10B981]"
              >
                Open Booking Page →
              </Link>
            </div>
          </div>
        </aside>
      </div>

      {/* Related Services Section */}
      {relatedServices.length > 0 && (
        <section className="pt-12 border-t border-[#1E3A5F] space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#94A3B8]">Explore More Capabilities</p>
              <h2 className="font-editorial text-2xl font-semibold text-[#F8FAFC] mt-1">
                Related Creative Services
              </h2>
            </div>
            <Link
              to="/services"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F8FAFC] hover:text-[#10B981] transition-colors"
            >
              <span>View All Services</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedServices.map((rel) => (
              <MarketplaceServiceCard
                key={rel.id}
                service={rel}
                settings={settings}
                primaryBg={primaryBg}
                secondaryBg={secondaryBg}
                accentColor={accentColor}
                onQuickPreview={(item) => setPreviewMedia(item)}
              />
            ))}
          </div>
        </section>
      )}

      <MediaPreviewModal
        item={previewMedia}
        items={galleryImages.map((imgUrl, idx) => ({
          id: `${service.id}_${idx}`,
          title:
            galleryImages.length > 1
              ? `${service.title} (Preview ${idx + 1} of ${galleryImages.length})`
              : service.title,
          url: imgUrl,
          videoUrl: service.videoPreviewUrl || undefined,
          description: service.description,
          categoryLabel: `${displayCategory} · ${service.priceDisplay}`,
          storageBucket: 'service-media',
        }))}
        onClose={() => setPreviewMedia(null)}
        onSelectItem={(next) => {
          setPreviewMedia(next);
          const idx = galleryImages.findIndex((u) => u === next.url);
          if (idx >= 0) setActiveMediaIndex(idx);
        }}
      />
    </div>
  );
};

// ============================================================================
// 2C. DEDICATED SERVICE BOOKING PAGE (/book & /book/:slug)
// ============================================================================
interface BookingLocationState {
  service?: ServiceItem;
  customPriceRange?: string;
  referenceLink?: string;
}

export const ServiceBookingPage: React.FC = () => {
  const { slug } = useParams<{ slug?: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { settings } = useOutletContext<OutletCtx>();
  const custom = mergeSiteCustomization(settings.siteCustomization || DEFAULT_SITE_CUSTOMIZATION);

  const navState = (location.state as BookingLocationState | null) || null;
  const [services, setServices] = useState<ServiceItem[]>(() => getCachedPublishedServices());
  const [loading, setLoading] = useState<boolean>(() => getCachedPublishedServices().length === 0);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [slug, searchParams]);

  useEffect(() => {
    let active = true;
    fetchPublishedServices()
      .then((list) => {
        if (!active) return;
        setServices(list);
      })
      .catch(() => {
        if (!active) return;
        setServices([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const matchedService = useMemo(() => {
    if (navState?.service) return navState.service;
    if (slug) {
      const decoded = decodeURIComponent(slug).toLowerCase();
      const bySlug = services.find(
        (s) =>
          (s.slug && s.slug.toLowerCase() === decoded) ||
          s.id.toLowerCase() === decoded
      );
      if (bySlug) return bySlug;
    }
    const queryService = searchParams.get('service');
    if (queryService) {
      const clean = queryService.toLowerCase();
      return (
        services.find(
          (s) =>
            clean.includes(s.title.toLowerCase()) ||
            s.title.toLowerCase().includes(clean)
        ) || null
      );
    }
    return null;
  }, [navState?.service, slug, services, searchParams]);

  const prefilledServiceLabel =
    searchParams.get('service') ||
    (matchedService
      ? `${matchedService.title} (${
          matchedService.isCustomQuote ? 'Custom quote' : matchedService.priceDisplay
        })`
      : undefined);

  const prefilledCustomPrice =
    searchParams.get('budget') ||
    navState?.customPriceRange ||
    matchedService?.priceDisplay ||
    '';

  const prefilledReferenceLink =
    searchParams.get('link') || navState?.referenceLink || '';

  const primaryBg = custom.primaryColor || '#040D1A';
  const secondaryBg = custom.secondaryColor || '#132A4A';
  const accentColor = custom.accentColor || '#10B981';
  const creatorName = settings.ownerName || 'Shankar Baluragi';
  const studioName = settings.businessName || 'Prithvi Editify';

  const coverSrc = matchedService
    ? matchedService.imageUrl && !matchedService.imageUrl.startsWith('data:image/svg+xml')
      ? matchedService.imageUrl
      : createStudioArtworkDataUri(
          matchedService.title,
          matchedService.category,
          accentColor,
          primaryBg,
          secondaryBg
        )
    : null;

  const deliverablesItems = matchedService
    ? parseDeliverablesList(matchedService.deliverablesSummary)
    : [];

  const whatsappMessage = [
    `Hello ${studioName}, I am booking "${
      matchedService?.title || prefilledServiceLabel || 'a Creative Service'
    }"${prefilledCustomPrice ? ` (Budget / Rate: ${prefilledCustomPrice})` : ''}.`,
    prefilledReferenceLink ? `Reference Link: ${prefilledReferenceLink}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const whatsappUrl = buildWhatsAppLink(
    settings.whatsappNumber || '+916361902619',
    whatsappMessage
  );

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10 lg:py-14 space-y-8">
      {/* Top Breadcrumb & Back Navigation */}
      <div className="border-b border-[#1E3A5F] pb-6 space-y-3">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center justify-between gap-4 text-xs text-[#94A3B8]"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/services" className="hover:text-[#F8FAFC] transition-colors font-medium">
              Creative Services
            </Link>
            {matchedService && (
              <>
                <span aria-hidden="true">/</span>
                <Link
                  to={`/services/${encodeURIComponent(matchedService.slug || matchedService.id)}`}
                  className="hover:text-[#F8FAFC] transition-colors"
                >
                  {matchedService.title}
                </Link>
              </>
            )}
            <span aria-hidden="true">/</span>
            <span className="text-[#10B981] font-semibold">Service Booking Form</span>
          </div>

          <Link
            to={
              matchedService
                ? `/services/${encodeURIComponent(matchedService.slug || matchedService.id)}`
                : '/services'
            }
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F8FAFC] hover:text-[#10B981] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{matchedService ? 'Back to Service Details' : 'Back to All Services'}</span>
          </Link>
        </nav>

        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#10B981]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Direct Studio Service Booking</span>
          </span>
          <h1 className="font-editorial text-2xl sm:text-3xl lg:text-4xl font-semibold text-[#F8FAFC] leading-tight">
            {matchedService
              ? `Book ${matchedService.title} (${matchedService.priceDisplay})`
              : 'Book a Creative Service'}
          </h1>
          <p className="text-sm text-[#94A3B8] max-w-2xl">
            Enter your service-related project details, custom price range, and reference/footage link below to book your creative project.
          </p>
        </div>
      </div>

      {/* Main 2-Column Booking Page Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Sticky Column: Selected Service Summary & Direct WhatsApp */}
        <aside className="lg:col-span-4 lg:sticky lg:top-24 space-y-5">
          {loading && !matchedService ? (
            <div className="h-80 bg-[#0D1F38] border border-[#1E3A5F] rounded-xl animate-pulse" />
          ) : matchedService ? (
            <div className="pe-card-interactive bg-[#0D1F38] border border-[#1E3A5F] rounded-xl overflow-hidden shadow-[0_6px_24px_rgba(0,0,0,0.25)]">
              {coverSrc && (
                <div className="relative aspect-[16/10] w-full bg-[#040D1A] border-b border-[#1E3A5F] overflow-hidden flex items-center justify-center">
                  <LazyImage
                    src={coverSrc}
                    alt={matchedService.title}
                    className="w-full h-full object-contain p-2"
                  />
                  <span className="absolute top-3 left-3 px-2.5 py-1 text-[11px] font-semibold text-white bg-[#040D1A]/90 border border-white/15 rounded-md">
                    {formatServiceCategoryLabel(matchedService.category, matchedService.title)}
                  </span>
                </div>
              )}

              <div className="p-5 space-y-4">
                <div className="flex items-baseline justify-between gap-3 pb-3 border-b border-[#1E3A5F]">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#10B981] block">
                      Selected Service
                    </span>
                    <h2 className="text-base font-semibold text-[#F8FAFC] mt-0.5">
                      {matchedService.title}
                    </h2>
                  </div>
                  <span className="font-mono text-xl font-bold text-[#2DD4BF] shrink-0">
                    {matchedService.priceDisplay}
                  </span>
                </div>

                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  {matchedService.description}
                </p>

                <div className="flex items-center justify-between gap-3 py-2.5 px-3 bg-[#132A4A]/80 border border-[#1E3A5F] rounded-lg text-xs font-medium text-[#F8FAFC]">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#10B981]" />
                    <span>{matchedService.turnaroundTime || '24–48 hours'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-[#16A34A]" />
                    <span>{matchedService.revisions || '2 Revisions'}</span>
                  </span>
                </div>

                {deliverablesItems.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-semibold text-[#F8FAFC]">Included Deliverables:</p>
                    <ul className="space-y-1.5">
                      {deliverablesItems.map((item, idx) => (
                        <li
                          key={`book_deliv_${idx}`}
                          className="flex items-start gap-2 text-xs text-[#94A3B8]"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="pt-2 border-t border-[#1E3A5F]">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white rounded-lg hover:opacity-95 transition-opacity"
                    style={{ backgroundColor: accentColor }}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Discuss on WhatsApp (+91 63619 02619)</span>
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="pe-card-interactive bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-6 space-y-4">
              <h2 className="text-base font-semibold text-[#F8FAFC]">
                Single-Price Studio Booking
              </h2>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                Choose your creative service in Step 1, enter your custom price range and reference link, and submit your project requirements directly to {creatorName}.
              </p>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white rounded-lg hover:opacity-95 transition-opacity"
                style={{ backgroundColor: accentColor }}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Discuss on WhatsApp (+91 63619 02619)</span>
              </a>
            </div>
          )}
        </aside>

        {/* Right Main Column: Service Booking Form */}
        <div className="lg:col-span-8">
          <InquiryForm
            key={`${matchedService?.id || 'general'}_${prefilledServiceLabel || ''}_${prefilledCustomPrice}_${prefilledReferenceLink}`}
            defaultService={prefilledServiceLabel}
            defaultCustomPrice={prefilledCustomPrice}
            defaultReferenceLink={prefilledReferenceLink}
            customBudgetRanges={custom.inquiryBudgetRanges}
            selectedServiceItem={matchedService}
          />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. PORTFOLIO SHOWCASE PAGE (/portfolio)
// ============================================================================
type PortfolioSortOption = 'recommended' | 'featured' | 'title_asc';

export const PortfolioPage: React.FC = () => {
  const { settings } = useOutletContext<OutletCtx>();
  const custom = mergeSiteCustomization(settings.siteCustomization || DEFAULT_SITE_CUSTOMIZATION);
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryScrollRef = React.useRef<HTMLDivElement>(null);

  const initialCategory = searchParams.get('category') || 'All';
  const initialQuery = searchParams.get('q') || '';

  const [items, setItems] = useState<PortfolioItem[]>(() => getCachedPublishedPortfolio());
  const [category, setCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState<string>(initialQuery);
  const [sortBy, setSortBy] = useState<PortfolioSortOption>('recommended');
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);
  const [loading, setLoading] = useState<boolean>(() => getCachedPublishedPortfolio().length === 0);

  useEffect(() => {
    const paramCat = searchParams.get('category') || 'All';
    setCategory(paramCat);
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    fetchPublishedPortfolio()
      .then((list) => {
        if (!active) return;
        setItems(list);
      })
      .catch(() => {
        if (!active) return;
        setItems([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const categoryOptions = useMemo(() => {
    const base = [...PORTFOLIO_SHOWCASE_CATEGORIES] as string[];
    const lowerKnown = new Set(base.map((c) => c.toLowerCase()));
    items.forEach((item) => {
      const displayCat = formatPortfolioCategoryLabel(item.category);
      if (displayCat && !lowerKnown.has(displayCat.toLowerCase())) {
        lowerKnown.add(displayCat.toLowerCase());
        base.push(displayCat);
      }
    });
    return base;
  }, [items]);

  const handleSelectCategory = (cat: string) => {
    const nextCategory = category === cat && cat !== 'All' ? 'All' : cat;
    setCategory(nextCategory);
    const nextParams = new URLSearchParams(searchParams);
    if (nextCategory === 'All') {
      nextParams.delete('category');
    } else {
      nextParams.set('category', nextCategory);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const scrollCategoryBar = (direction: 'left' | 'right') => {
    if (!categoryScrollRef.current) return;
    const offset = direction === 'left' ? -260 : 260;
    categoryScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = items.filter((item) => {
      if (!matchesPortfolioCategoryFilter(item, category)) return false;
      if (!q) return true;
      const displayCat = formatPortfolioCategoryLabel(item.category).toLowerCase();
      const tagsMatch =
        Array.isArray(item.tags) && item.tags.some((t) => t.toLowerCase().includes(q));
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        displayCat.includes(q) ||
        (item.metricsSummary || '').toLowerCase().includes(q) ||
        tagsMatch
      );
    });

    if (sortBy === 'featured') {
      return [...list].sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
    }
    if (sortBy === 'title_asc') {
      return [...list].sort((a, b) => a.title.localeCompare(b.title));
    }
    return [...list].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [items, category, searchQuery, sortBy]);

  const hasActiveFilters =
    category !== 'All' || searchQuery.trim() !== '' || sortBy !== 'recommended';

  const handleClearFilters = () => {
    setCategory('All');
    setSearchQuery('');
    setSortBy('recommended');
    setSearchParams({});
  };

  const primaryBg = custom.primaryColor || '#040D1A';
  const secondaryBg = custom.secondaryColor || '#132A4A';
  const accentColor = custom.accentColor || '#10B981';

  return (
    <div>
      {/* Top Horizontal Marketplace Category Filter Bar */}
      <div className="bg-[#0D1F38] border-b border-[#1E3A5F] sticky top-16 z-20 shadow-[0_1px_2px_rgba(23,35,51,0.03)]">
        <div className="max-w-[1200px] mx-auto px-6 flex items-center gap-2 py-2.5">
          <button
            type="button"
            onClick={() => scrollCategoryBar('left')}
            aria-label="Scroll categories left"
            className="hidden sm:inline-flex items-center justify-center w-7 h-7 rounded-md border border-[#1E3A5F] bg-[#0D1F38] text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#10B981]/40 shrink-0 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div
            ref={categoryScrollRef}
            role="tablist"
            aria-label="Filter portfolio projects by category"
            className="flex items-center gap-2 overflow-x-auto py-0.5 scroll-smooth flex-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {categoryOptions.map((cat) => {
              const active = category === cat;
              const matchCount =
                cat === 'All'
                  ? items.length
                  : items.filter((item) => matchesPortfolioCategoryFilter(item, cat)).length;
              if (cat !== 'All' && items.length > 0 && matchCount === 0 && !active) return null;

              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => handleSelectCategory(cat)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-lg border transition-all duration-150 whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-gradient-to-r from-[#0EA5E9] to-[#10B981] text-white border-[#10B981] font-semibold shadow-2xs'
                      : 'bg-[#132A4A]/70 text-[#94A3B8] border-[#1E3A5F] hover:bg-[#132A4A] hover:text-[#F8FAFC] hover:border-[#10B981]/40 font-medium'
                  }`}
                >
                  <span>{cat}</span>
                  {items.length > 0 && matchCount > 0 && (
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.2 rounded tabular-nums ${
                        active
                          ? 'bg-white/15 text-white'
                          : 'bg-[#1E3A5F]/70 text-[#F8FAFC]'
                      }`}
                    >
                      ({matchCount})
                    </span>
                  )}
                </button>
              );
            })}
          </div>


          <button
            type="button"
            onClick={() => scrollCategoryBar('right')}
            aria-label="Scroll categories right"
            className="hidden sm:inline-flex items-center justify-center w-7 h-7 rounded-md border border-[#1E3A5F] bg-[#0D1F38] text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#10B981]/40 shrink-0 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 py-12 lg:py-14">
        {/* Portfolio Header, Search & Sort Controls */}
        <div className="border-b border-[#1E3A5F] pb-7">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold text-[#94A3B8] tracking-wide">
                {custom.portfolioPageKicker || 'Prithvi Editify · Curated Project Showcase'}
              </p>
              <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-[#F8FAFC] mt-2">
                {category === 'All'
                  ? custom.portfolioPageTitle || 'Creative Portfolio'
                  : category}
              </h1>
              <p className="text-base text-[#94A3B8] mt-2.5 leading-relaxed">
                {custom.portfolioPageDescription ||
                  'Explore selected design, branding, thumbnail and video editing projects by Prithvi Editify.'}
              </p>
            </div>

            {/* Search & Sort Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for a project…"
                  aria-label="Search for a project"
                  className="w-full pl-10 pr-8 py-2.5 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded-lg text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-none focus:border-[#10B981] transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#F8FAFC] p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#94A3B8] shrink-0 hidden sm:block" />
                <label htmlFor="portfolio-sort" className="text-xs text-[#94A3B8] whitespace-nowrap">
                  Sort by:
                </label>
                <select
                  id="portfolio-sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as PortfolioSortOption)}
                  className="px-3 py-2.5 text-xs font-medium text-[#F8FAFC] bg-[#0D1F38] border border-[#1E3A5F] rounded-lg focus:outline-none focus:border-[#10B981] transition-colors"
                >
                  <option value="recommended">Recommended</option>
                  <option value="featured">Featured First</option>
                  <option value="title_asc">Title: A to Z</option>
                </select>
              </div>
            </div>
          </div>

          {/* Active Filter Status Strip */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#94A3B8]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono tabular-nums text-[#F8FAFC] font-semibold">
                {filtered.length} {filtered.length === 1 ? 'project' : 'projects'} available
              </span>
              {category !== 'All' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#040D1A]/5 text-[#F8FAFC] font-medium">
                  <span>Category: {category}</span>
                  <button
                    type="button"
                    onClick={() => handleSelectCategory('All')}
                    aria-label={`Remove ${category} filter`}
                    className="hover:text-[#10B981]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#F8FAFC] hover:text-[#10B981] transition-colors whitespace-nowrap"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear all filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Portfolio Gallery Grid — Fiverr-Inspired Marketplace Cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="h-[420px] bg-[#0D1F38] border border-[#1E3A5F] rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-10 bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-12 text-center max-w-xl mx-auto shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
            <h2 className="font-editorial text-xl font-semibold text-[#F8FAFC]">
              No matching portfolio projects found
            </h2>
            <p className="text-sm text-[#94A3B8] mt-2 leading-relaxed">
              Try clearing your search query or selecting another creative category, or contact Prithvi Editify to request a custom sample brief.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg transition-colors"
              >
                Reset All Filters
              </button>
              <Link
                to="/contact"
                className="px-4 py-2.5 text-xs font-semibold text-[#F8FAFC] bg-[#132A4A] hover:bg-[#1E3A5F] rounded-lg transition-colors"
              >
                Contact for a Project
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
            {filtered.map((item) => (
              <MarketplacePortfolioCard
                key={item.id}
                item={item}
                settings={settings}
                primaryBg={primaryBg}
                secondaryBg={secondaryBg}
                accentColor={accentColor}
                onQuickPreview={(selected) => setSelectedItem(selected)}
              />
            ))}
          </div>
        )}

      {/* Interactive Before / After Studio Comparison Slider */}
      <div className="mt-16">
        <BeforeAfterComparisonShowcase />
      </div>

      {/* Portfolio CTA Banner */}
      <div className="pe-card-interactive mt-16 bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
        <div className="max-w-xl">
          <p className="text-xs font-semibold text-[#94A3B8]">Start a Creative Project</p>
          <h2 className="font-editorial text-2xl font-semibold text-[#F8FAFC] mt-1">
            Looking for similar design quality or video editing for your brand?
          </h2>
          <p className="text-sm text-[#94A3B8] mt-2 leading-relaxed">
            Explore our service rates or send your project brief directly to Shankar Baluragi.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg transition-colors whitespace-nowrap"
          >
            <span>Contact for a Project</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/services"
            className="px-4 py-2.5 text-xs font-semibold text-[#F8FAFC] bg-[#132A4A] hover:bg-[#1E3A5F] rounded-lg transition-colors whitespace-nowrap"
          >
            Browse Creative Services
          </Link>
        </div>
      </div>

      {/* Interactive Portfolio Media Lightbox */}
      <MediaPreviewModal
        item={
          selectedItem
            ? {
                id: selectedItem.id,
                title: selectedItem.title,
                url:
                  selectedItem.coverImage ||
                  createStudioArtworkDataUri(
                    selectedItem.title,
                    selectedItem.category,
                    accentColor,
                    primaryBg,
                    secondaryBg
                  ),
                videoUrl: selectedItem.videoUrl || undefined,
                description: selectedItem.description,
                tags: selectedItem.tags,
                categoryLabel: `${formatPortfolioCategoryLabel(selectedItem.category)} · ${
                  selectedItem.metricsSummary || 'Studio Deliverable'
                }${selectedItem.isSampleContent ? ' (Demonstration Sample)' : ''}`,
                storageBucket: 'portfolio-media',
              }
            : null
        }
        items={filtered.map((p) => ({
          id: p.id,
          title: p.title,
          url:
            p.coverImage ||
            createStudioArtworkDataUri(p.title, p.category, accentColor, primaryBg, secondaryBg),
          videoUrl: p.videoUrl || undefined,
          description: p.description,
          tags: p.tags,
          categoryLabel: `${formatPortfolioCategoryLabel(p.category)} · ${
            p.metricsSummary || 'Studio Deliverable'
          }${p.isSampleContent ? ' (Demonstration Sample)' : ''}`,
          storageBucket: 'portfolio-media',
        }))}
        onClose={() => setSelectedItem(null)}
        onSelectItem={(next) => {
          const found = filtered.find((p) => p.id === next.id) || null;
          setSelectedItem(found);
        }}
      />
      </div>
    </div>
  );
};

// ============================================================================
// 3B. PORTFOLIO PROJECT DETAIL PAGE (/portfolio/:slug)
// ============================================================================
export const PortfolioDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { settings } = useOutletContext<OutletCtx>();
  const custom = mergeSiteCustomization(settings.siteCustomization || DEFAULT_SITE_CUSTOMIZATION);

  const [items, setItems] = useState<PortfolioItem[]>(() => getCachedPublishedPortfolio());
  const [loading, setLoading] = useState<boolean>(() => getCachedPublishedPortfolio().length === 0);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [previewMedia, setPreviewMedia] = useState<PreviewableMediaItem | null>(null);

  useEffect(() => {
    let active = true;
    const cached = getCachedPublishedPortfolio();
    if (cached.length === 0) {
      setLoading(true);
    }
    setActiveImageIndex(0);
    fetchPublishedPortfolio()
      .then((list) => {
        if (!active) return;
        setItems(list);
      })
      .catch(() => {
        if (!active) return;
        if (cached.length === 0) setItems([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const project = useMemo(() => {
    if (!slug) return null;
    const decoded = decodeURIComponent(slug).toLowerCase();
    return (
      items.find(
        (p) =>
          (p.slug && p.slug.toLowerCase() === decoded) ||
          p.id.toLowerCase() === decoded
      ) || null
    );
  }, [items, slug]);

  const relatedProjects = useMemo(() => {
    if (!project) return [];
    const sameCat = items.filter(
      (p) => p.id !== project.id && p.category === project.category
    );
    const others = items.filter(
      (p) => p.id !== project.id && !sameCat.some((sc) => sc.id === p.id)
    );
    return [...sameCat, ...others].slice(0, 3);
  }, [items, project]);

  const primaryBg = custom.primaryColor || '#040D1A';
  const secondaryBg = custom.secondaryColor || '#132A4A';
  const accentColor = custom.accentColor || '#10B981';

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-16 space-y-8">
        <div className="h-6 w-64 bg-[#0D1F38] border border-[#1E3A5F] rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 h-[480px] bg-[#0D1F38] border border-[#1E3A5F] rounded-lg animate-pulse" />
          <div className="lg:col-span-4 h-[360px] bg-[#0D1F38] border border-[#1E3A5F] rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-20 text-center space-y-4">
        <p className="text-xs font-semibold text-[#94A3B8]">Project Not Found</p>
        <h1 className="font-editorial text-3xl font-semibold text-[#F8FAFC]">
          This portfolio project is unavailable
        </h1>
        <p className="text-sm text-[#94A3B8] max-w-md mx-auto">
          The project you selected may have been moved or unpublished. Return to the portfolio gallery to explore more work.
        </p>
        <div className="pt-2 flex items-center justify-center gap-3">
          <Link
            to="/portfolio"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Creative Portfolio</span>
          </Link>
          <Link
            to="/contact"
            className="px-5 py-2.5 text-xs font-semibold text-[#F8FAFC] bg-[#0D1F38] border border-[#1E3A5F] hover:border-[#10B981] rounded-lg transition-colors"
          >
            Contact for a Project
          </Link>
        </div>
      </div>
    );
  }

  const displayCategory = formatPortfolioCategoryLabel(project.category);
  const fallbackArtwork = createStudioArtworkDataUri(
    project.title,
    displayCategory,
    accentColor,
    primaryBg,
    secondaryBg
  );
  const normalizedCover = normalizePreviewableImageUrl(project.coverImage);
  const hasCustomCover = Boolean(
    normalizedCover && !normalizedCover.startsWith('data:image/svg+xml')
  );
  const primaryCover = hasCustomCover ? normalizedCover : fallbackArtwork;

  const galleryImages = [
    primaryCover,
    ...(Array.isArray(project.galleryUrls)
      ? project.galleryUrls.map((u) => normalizePreviewableImageUrl(u)).filter(Boolean)
      : []),
  ];
  const activeImageUrl = galleryImages[activeImageIndex] || primaryCover;
  const videoEmbedInfo = project.videoUrl ? normalizeVideoEmbedUrl(project.videoUrl) : null;

  const whatsappMessage = `Hello ${
    settings.businessName || 'Prithvi Editify'
  }, I viewed "${project.title}" in your Creative Portfolio and would like to discuss a similar ${displayCategory} project.`;
  const whatsappUrl = buildWhatsAppLink(settings.whatsappNumber, whatsappMessage);

  const portfolioJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CreativeWork',
        name: project.title,
        headline: project.title,
        genre: displayCategory,
        description: project.description,
        image: primaryCover,
        keywords: Array.isArray(project.tags) ? project.tags.join(', ') : displayCategory,
        creator: {
          '@type': 'Person',
          name: settings.ownerName || 'Shankar Baluragi',
        },
        publisher: {
          '@type': 'Organization',
          name: settings.businessName || 'Prithvi Editify',
          url: 'https://prithvieditify.netlify.app/',
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://prithvieditify.netlify.app/',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Portfolio',
            item: 'https://prithvieditify.netlify.app/portfolio',
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: project.title,
            item: `https://prithvieditify.netlify.app/portfolio/${encodeURIComponent(
              project.slug || project.id
            )}`,
          },
        ],
      },
    ],
  };

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10 lg:py-14 space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(portfolioJsonLd) }}
      />
      {/* Top Breadcrumb & Project Header */}
      <div className="space-y-5 border-b border-[#1E3A5F] pb-6">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center justify-between gap-4 text-xs text-[#94A3B8]"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/portfolio" className="hover:text-[#F8FAFC] transition-colors font-medium">
              Creative Portfolio
            </Link>
            <span aria-hidden="true">/</span>
            <Link
              to={`/portfolio?category=${encodeURIComponent(displayCategory)}`}
              className="hover:text-[#F8FAFC] transition-colors"
            >
              {displayCategory}
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-[#F8FAFC] font-medium truncate max-w-xs sm:max-w-md">
              {project.title}
            </span>
          </div>
          <Link
            to="/portfolio"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F8FAFC] hover:text-[#10B981] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Portfolio</span>
          </Link>
        </nav>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#94A3B8]">
            <span className="font-semibold text-[#F8FAFC]">{displayCategory}</span>
            <span aria-hidden="true">·</span>
            <span>{project.metricsSummary || 'Studio Deliverable'}</span>
            {project.isSampleContent && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#D97706] font-medium">Demonstration Sample</span>
              </>
            )}
          </div>
          <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-[#F8FAFC] leading-tight">
            {project.title}
          </h1>
        </div>
      </div>

      {/* Main 2-Column Project Showcase Layout — Aligned at top edge */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: High-Impact Media Stage & Project Breakdown */}
        <div className="lg:col-span-8 space-y-8">
          {/* Primary Showcase Media Viewer */}
          <div className="space-y-3">
            {videoEmbedInfo ? (
              <div className="space-y-3">
                <div className="bg-[#040D1A] border border-[#1E3A5F] rounded-lg overflow-hidden">
                  {videoEmbedInfo.type === 'iframe' ? (
                    <div className="w-full aspect-video max-h-[540px] bg-black">
                      <iframe
                        src={videoEmbedInfo.src}
                        title={project.title}
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <video
                      src={videoEmbedInfo.src}
                      poster={primaryCover}
                      controls
                      playsInline
                      className="w-full max-h-[540px] object-contain bg-black"
                    />
                  )}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewMedia({
                        id: `${project.id}_${activeImageIndex}`,
                        title: project.title,
                        url: activeImageUrl,
                        videoUrl: project.videoUrl || undefined,
                        description: project.description,
                        tags: project.tags,
                        categoryLabel: `${displayCategory} · ${
                          project.metricsSummary || 'Studio Deliverable'
                        }`,
                        storageBucket: 'portfolio-media',
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#132A4A] hover:bg-[#1E3A5F] border border-[#1E3A5F] rounded-lg transition-colors cursor-pointer"
                  >
                    <Eye className="w-4 h-4 text-[#10B981]" />
                    <span>Inspect Cover Artwork & Video in Lightbox</span>
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() =>
                  setPreviewMedia({
                    id: `${project.id}_${activeImageIndex}`,
                    title:
                      galleryImages.length > 1
                        ? `${project.title} (Frame ${activeImageIndex + 1} of ${galleryImages.length})`
                        : project.title,
                    url: activeImageUrl,
                    videoUrl: project.videoUrl || undefined,
                    description: project.description,
                    tags: project.tags,
                    categoryLabel: `${displayCategory} · ${
                      project.metricsSummary || 'Studio Deliverable'
                    }`,
                    storageBucket: 'portfolio-media',
                  })
                }
                className="relative aspect-video max-h-[480px] w-full bg-[#040D1A] border border-[#1E3A5F] rounded-lg overflow-hidden cursor-zoom-in flex items-center justify-center"
              >
                <LazyImage
                  src={activeImageUrl}
                  fallbackSrc={fallbackArtwork}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover blur-xl opacity-35 scale-110 pointer-events-none select-none"
                />
                <LazyImage
                  src={activeImageUrl}
                  fallbackSrc={fallbackArtwork}
                  fallbackSubtitle={displayCategory}
                  alt={project.title}
                  eager
                  className="relative z-10 w-full h-full object-contain"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewMedia({
                      id: `${project.id}_${activeImageIndex}`,
                      title:
                        galleryImages.length > 1
                          ? `${project.title} (Frame ${activeImageIndex + 1} of ${galleryImages.length})`
                          : project.title,
                      url: activeImageUrl,
                      videoUrl: project.videoUrl || undefined,
                      description: project.description,
                      tags: project.tags,
                      categoryLabel: `${displayCategory} · ${
                        project.metricsSummary || 'Studio Deliverable'
                      }`,
                      storageBucket: 'portfolio-media',
                    });
                  }}
                  className="absolute bottom-4 right-4 z-20 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#040D1A]/90 hover:bg-[#040D1A] border border-white/15 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  <Eye className="w-4 h-4 text-[#10B981]" />
                  <span>Inspect Full Resolution</span>
                </button>
              </div>
            )}

            {/* Gallery Thumbnails */}
            {galleryImages.length > 1 && (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {galleryImages.map((imgUrl, idx) => (
                  <button
                    key={`${imgUrl}_${idx}`}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    className={`w-20 h-16 rounded-md overflow-hidden border bg-[#040D1A] transition-all cursor-pointer ${
                      activeImageIndex === idx
                        ? 'border-[#10B981] ring-2 ring-[#10B981]/20'
                        : 'border-[#1E3A5F] opacity-75 hover:opacity-100'
                    }`}
                  >
                    <LazyImage
                      src={imgUrl}
                      fallbackSrc={fallbackArtwork}
                      alt={`${project.title} frame ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Project Description & Creative Notes */}
          <section className="pe-card-interactive bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-6 sm:p-8 space-y-4 shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
            <h2 className="font-editorial text-xl font-semibold text-[#F8FAFC]">
              Project Overview
            </h2>
            <p className="text-sm sm:text-base text-[#94A3B8] leading-relaxed">
              {project.description}
            </p>

            {project.tags && project.tags.length > 0 && (
              <div className="pt-4 border-t border-[#1E3A5F] flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[#94A3B8]">
                <span className="font-semibold text-[#F8FAFC]">Keywords:</span>
                {project.tags.map((tag, idx) => (
                  <React.Fragment key={`${tag}_${idx}`}>
                    {idx > 0 && <span aria-hidden="true">·</span>}
                    <span>#{tag}</span>
                  </React.Fragment>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Sticky Project Info & Inquiry Panel */}
        <aside className="lg:col-span-4 lg:sticky lg:top-24 space-y-6">
          <div className="pe-card-interactive bg-[#0D1F38] border border-[#1E3A5F] rounded-lg overflow-hidden shadow-[0_4px_16px_rgba(23,35,51,0.05)]">
            <div className="px-6 py-4 bg-[#132A4A] text-[#F8FAFC] flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wide">Project Summary</span>
              <span className="font-mono text-xs text-[#10B981]">PORTFOLIO</span>
            </div>

            <div className="p-6 space-y-6">
              <div className="border-b border-[#1E3A5F] pb-4">
                <p className="text-xs text-[#94A3B8]">{displayCategory}</p>
                <h2 className="text-lg font-semibold text-[#F8FAFC] mt-0.5">{project.title}</h2>
              </div>

              <dl className="space-y-3.5 text-xs">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-[#94A3B8]">Category</dt>
                  <dd className="font-semibold text-[#F8FAFC] text-right">{displayCategory}</dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-[#94A3B8]">Specifications</dt>
                  <dd className="font-semibold text-[#F8FAFC] text-right">
                    {project.metricsSummary || 'Studio Deliverable'}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-[#94A3B8]">Studio</dt>
                  <dd className="font-semibold text-[#F8FAFC] text-right">
                    {settings.businessName || 'Prithvi Editify'}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-[#94A3B8]">Creative Lead</dt>
                  <dd className="font-semibold text-[#F8FAFC] text-right">
                    {settings.ownerName || 'Shankar Baluragi'}
                  </dd>
                </div>
                {project.isSampleContent && (
                  <div className="pt-2 border-t border-[#1E3A5F] text-[11px] text-[#D97706]">
                    Note: This record is labeled as a studio demonstration sample.
                  </div>
                )}
              </dl>

              {project.projectUrl && (
                <div className="pt-2 border-t border-[#1E3A5F]">
                  <a
                    href={project.projectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#F8FAFC] bg-[#132A4A] hover:bg-[#1E3A5F] rounded-lg transition-colors"
                  >
                    <span>View Live External Link</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              <div className="pt-2 border-t border-[#1E3A5F] space-y-2.5">
                <Link
                  to={`/contact?service=${encodeURIComponent(displayCategory)}`}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg transition-colors"
                >
                  <span>Contact for a Project</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>

                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-semibold text-white rounded-lg hover:opacity-95 transition-opacity"
                  style={{ backgroundColor: accentColor }}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Discuss on WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* More Portfolio Projects */}
      {relatedProjects.length > 0 && (
        <section className="pt-12 border-t border-[#1E3A5F] space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#94A3B8]">More Studio Work</p>
              <h2 className="font-editorial text-2xl font-semibold text-[#F8FAFC] mt-1">
                Related Portfolio Projects
              </h2>
            </div>
            <Link
              to="/portfolio"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F8FAFC] hover:text-[#10B981] transition-colors"
            >
              <span>View Full Portfolio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedProjects.map((rel) => (
              <MarketplacePortfolioCard
                key={rel.id}
                item={rel}
                settings={settings}
                primaryBg={primaryBg}
                secondaryBg={secondaryBg}
                accentColor={accentColor}
                onQuickPreview={(selected) =>
                  setPreviewMedia({
                    id: selected.id,
                    title: selected.title,
                    url:
                      selected.coverImage ||
                      createStudioArtworkDataUri(
                        selected.title,
                        selected.category,
                        accentColor,
                        primaryBg,
                        secondaryBg
                      ),
                    videoUrl: selected.videoUrl || undefined,
                    description: selected.description,
                    tags: selected.tags,
                    categoryLabel: `${formatPortfolioCategoryLabel(selected.category)} · ${
                      selected.metricsSummary || 'Studio Deliverable'
                    }`,
                    storageBucket: 'portfolio-media',
                  })
                }
              />
            ))}
          </div>
        </section>
      )}

      <MediaPreviewModal item={previewMedia} onClose={() => setPreviewMedia(null)} />
    </div>
  );
};

// ============================================================================
// 4. ABOUT PAGE (PRESERVED EXACTLY)
// ============================================================================
export const AboutPage: React.FC = () => {
  const { settings } = useOutletContext<OutletCtx>();
  const custom = mergeSiteCustomization(settings.siteCustomization || DEFAULT_SITE_CUSTOMIZATION);
  const primaryBg = custom.primaryColor || '#040D1A';
  const secondaryBg = custom.secondaryColor || '#132A4A';
  const accentColor = custom.accentColor || '#10B981';

  const founderSrc =
    custom.founderImageUrl ||
    createStudioArtworkDataUri(
      custom.founderName || settings.ownerName || 'Shankar Baluragi',
      custom.founderRole || 'Founder & Creative Director · Prithvi Editify',
      accentColor,
      primaryBg,
      secondaryBg
    );

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-16 space-y-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-5">
          <p className="text-xs font-semibold text-[#94A3B8] tracking-wide">{custom.aboutKicker}</p>
          <h1 className="font-editorial text-4xl font-semibold text-[#F8FAFC] leading-tight">
            {custom.aboutHeading}
          </h1>
          <p className="text-base text-[#94A3B8] leading-relaxed">{custom.aboutParagraph1}</p>
          <p className="text-sm text-[#94A3B8] leading-relaxed">{custom.aboutParagraph2}</p>
          <div className="pt-2 flex flex-wrap gap-4">
            <Link
              to="/contact"
              className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors whitespace-nowrap"
              style={{ backgroundColor: primaryBg }}
            >
              {custom.aboutPrimaryCtaLabel || 'Start a Project'}
            </Link>
            <Link
              to="/services"
              className="px-5 py-2.5 text-sm font-semibold text-[#F8FAFC] bg-[#0D1F38] border border-[#1E3A5F] hover:border-[#10B981] rounded-lg transition-colors whitespace-nowrap"
            >
              {custom.aboutSecondaryCtaLabel || 'View Services & Pricing'}
            </Link>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="pe-card-interactive bg-[#0D1F38] border border-[#1E3A5F] rounded-lg overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
            <div className="relative w-full aspect-[4/3] bg-[#040D1A] overflow-hidden flex items-center justify-center">
              <LazyImage
                src={founderSrc}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover blur-xl opacity-35 scale-110 pointer-events-none select-none"
              />
              <LazyImage
                src={founderSrc}
                alt={custom.founderName || settings.ownerName || 'Shankar Baluragi'}
                className="relative z-10 w-full h-full object-contain"
              />
            </div>
            <div className="p-6 space-y-2">
              <p className="text-sm font-semibold text-[#F8FAFC]">
                {custom.founderName || settings.ownerName || 'Shankar Baluragi'}
              </p>
              <p className="text-xs text-[#94A3B8]">{custom.founderRole}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {custom.aboutPillars.map((pillar, idx) => (
          <div
            key={`${pillar.title}_${idx}`}
            className="pe-card-interactive bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-6 shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
          >
            <h2 className="text-base font-semibold text-[#F8FAFC]">{pillar.title}</h2>
            <p className="text-sm text-[#94A3B8] mt-2 leading-relaxed">{pillar.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 5. CONTACT PAGE (PRESERVED EXACTLY)
// ============================================================================
export const ContactPage: React.FC = () => {
  const { settings } = useOutletContext<OutletCtx>();
  const custom = mergeSiteCustomization(settings.siteCustomization || DEFAULT_SITE_CUSTOMIZATION);
  const [searchParams] = useSearchParams();
  const preselectedService = searchParams.get('service') || undefined;
  const whatsappUrl = buildWhatsAppLink(settings.whatsappNumber, settings.whatsappDefaultMessage);
  const accentColor = custom.accentColor || '#10B981';

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        <div className="lg:col-span-5 space-y-6">
          <div>
            <p className="text-xs font-semibold text-[#94A3B8] tracking-wide">
              {custom.contactKicker}
            </p>
            <h1 className="font-editorial text-4xl font-semibold text-[#F8FAFC] mt-2">
              {custom.contactHeading}
            </h1>
            <p className="text-sm text-[#94A3B8] mt-3 leading-relaxed">
              {custom.contactDescription}
            </p>
          </div>

          <div className="pe-card-interactive bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-6 space-y-4 shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
            <h2 className="text-base font-semibold text-[#F8FAFC]">{custom.whatsappCardTitle}</h2>
            <p className="text-xs text-[#94A3B8] leading-relaxed">{custom.whatsappCardDesc}</p>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white rounded-lg hover:opacity-95 transition-opacity whitespace-nowrap shrink-0"
              style={{ backgroundColor: accentColor }}
            >
              <MessageSquare className="w-4 h-4" />
              <span>{custom.whatsappButtonLabel || 'Discuss on WhatsApp'}</span>
            </a>
            <p className="text-[11px] text-[#94A3B8]">
              Note: Clicking opens WhatsApp; you confirm and send the message in your WhatsApp app.
            </p>
          </div>

          <div className="pe-card-interactive bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-6 space-y-2 text-xs text-[#94A3B8] shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
            <p className="font-semibold text-[#F8FAFC]">Studio Information</p>
            <p>Business: {settings.businessName || 'Prithvi Editify'}</p>
            <p>Owner: {settings.ownerName || 'Shankar Baluragi'}</p>
            {settings.businessEmail && <p>Email: {settings.businessEmail}</p>}
            {settings.businessAddress && <p>Location: {settings.businessAddress}</p>}
            {custom.workingHours && <p>Hours: {custom.workingHours}</p>}
          </div>
        </div>

        <div className="lg:col-span-7">
          <InquiryForm
            defaultService={preselectedService}
            customBudgetRanges={custom.inquiryBudgetRanges}
          />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 6. PRIVACY POLICY, TERMS & NOT FOUND PAGES (PRESERVED EXACTLY)
// ============================================================================
export const PrivacyPolicyPage: React.FC = () => {
  const { settings } = useOutletContext<OutletCtx>();
  const custom = mergeSiteCustomization(settings.siteCustomization || DEFAULT_SITE_CUSTOMIZATION);

  return (
    <div className="max-w-3xl mx-auto px-6 py-16 space-y-6">
      <h1 className="font-editorial text-3xl font-semibold text-[#F8FAFC]">Privacy Policy</h1>
      <p className="text-xs text-[#94A3B8]">
        Effective Date: {custom.legalEffectiveDate || 'October 2026'} ·{' '}
        {settings.businessName || 'Prithvi Editify'} ({settings.ownerName || 'Shankar Baluragi'})
      </p>
      <div className="pe-card-interactive bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-8 space-y-4 text-sm text-[#F8FAFC] leading-relaxed">
        {custom.privacySections.map((sec, idx) => (
          <React.Fragment key={`${sec.heading}_${idx}`}>
            <h2 className="text-base font-semibold">{sec.heading}</h2>
            <p className="text-[#94A3B8]">{sec.body}</p>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export const TermsPage: React.FC = () => {
  const { settings } = useOutletContext<OutletCtx>();
  const custom = mergeSiteCustomization(settings.siteCustomization || DEFAULT_SITE_CUSTOMIZATION);

  return (
    <div className="max-w-3xl mx-auto px-6 py-16 space-y-6">
      <h1 className="font-editorial text-3xl font-semibold text-[#F8FAFC]">
        Terms and Conditions
      </h1>
      <p className="text-xs text-[#94A3B8]">
        Effective Date: {custom.legalEffectiveDate || 'October 2026'} ·{' '}
        {settings.businessName || 'Prithvi Editify'} ({settings.ownerName || 'Shankar Baluragi'})
      </p>
      <div className="pe-card-interactive bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-8 space-y-4 text-sm text-[#F8FAFC] leading-relaxed">
        {custom.termsSections.map((sec, idx) => (
          <React.Fragment key={`${sec.heading}_${idx}`}>
            <h2 className="text-base font-semibold">{sec.heading}</h2>
            <p className="text-[#94A3B8]">{sec.body}</p>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export const NotFoundPage: React.FC = () => (
  <div className="max-w-xl mx-auto px-6 py-24 text-center space-y-5">
    <p className="font-mono text-xs text-[#10B981] font-semibold">ERROR 404</p>
    <h1 className="font-editorial text-3xl font-semibold text-[#F8FAFC]">Page not found</h1>
    <p className="text-sm text-[#94A3B8]">
      The page you are looking for does not exist or has been moved.
    </p>
    <div className="pt-2 flex items-center justify-center gap-3">
      <Link
        to="/"
        className="px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg transition-colors"
      >
        Return Home
      </Link>
      <Link
        to="/contact"
        className="px-5 py-2.5 text-xs font-semibold text-[#F8FAFC] bg-[#0D1F38] border border-[#1E3A5F] hover:border-[#10B981] rounded-lg transition-colors"
      >
        Contact Studio
      </Link>
    </div>
  </div>
);
