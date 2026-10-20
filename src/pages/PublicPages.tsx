import React, { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams, useOutletContext, useParams } from 'react-router-dom';
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
} from 'lucide-react';
import {
  fetchPublishedServices,
  fetchPublishedPortfolio,
  buildDefaultServicePackages,
} from '../services/crmService';
import {
  DEFAULT_SITE_CUSTOMIZATION,
  mergeSiteCustomization,
  createStudioArtworkDataUri,
} from '../utils/seedData';
import { ServiceItem, ServicePackageTier, PortfolioItem, PublicSettings } from '../types/crm';
import { InquiryForm } from '../components/InquiryForm';
import { MediaPreviewModal, PreviewableMediaItem } from '../components/MediaPreviewModal';
import { buildWhatsAppLink } from '../utils/formatters';

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
  const detailPath = `/services/${encodeURIComponent(srv.slug || srv.id)}`;
  const hasCustomImage = Boolean(srv.imageUrl);
  const coverSrc =
    srv.imageUrl ||
    createStudioArtworkDataUri(srv.title, srv.category, accentColor, primaryBg, secondaryBg);
  const displayCategory = formatServiceCategoryLabel(srv.category, srv.title);
  const creatorName = settings.ownerName || 'Shankar Baluragi';
  const studioName = settings.businessName || 'Prithvi Editify';

  return (
    <article className="group bg-white border border-[#E2E4DF] rounded-xl overflow-hidden flex flex-col justify-between shadow-[0_1px_3px_rgba(23,35,51,0.04)] hover:-translate-y-0.5 hover:border-[#172333]/50 hover:shadow-[0_14px_32px_-8px_rgba(23,35,51,0.12)] transition-all duration-200">
      <div>
        {/* 1. Consistent 16:10 Media Stage — Preserves full artwork without cropping */}
        <div className="relative aspect-[16/10] w-full bg-[#0F1722] overflow-hidden border-b border-[#E2E4DF]">
          <Link
            to={detailPath}
            className="relative flex items-center justify-center w-full h-full overflow-hidden"
          >
            {hasCustomImage && (
              <img
                src={coverSrc}
                alt=""
                aria-hidden="true"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover blur-md opacity-35 scale-110 pointer-events-none"
              />
            )}
            <img
              src={coverSrc}
              alt={srv.title}
              referrerPolicy="no-referrer"
              className={`relative z-10 transition-transform duration-300 ease-out group-hover:scale-[1.03] ${
                hasCustomImage
                  ? 'max-h-full max-w-full w-auto h-auto object-contain p-2.5 drop-shadow-[0_6px_16px_rgba(0,0,0,0.35)]'
                  : 'w-full h-full object-cover'
              }`}
            />
          </Link>

          {/* Category Tag Overlay */}
          <span className="absolute top-3 left-3 z-20 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white bg-[#172333]/90 backdrop-blur-xs border border-white/15 rounded-md">
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
              className="absolute bottom-3 right-3 z-20 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-[#172333]/90 hover:bg-[#172333] rounded-md border border-white/15 shadow-xs transition-all duration-150"
            >
              <Eye className="w-3.5 h-3.5 text-[#F18A45]" />
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
                <p className="text-xs font-semibold text-[#172333] truncate leading-tight">
                  {creatorName}
                </p>
                <p className="text-[11px] text-[#6E7785] truncate leading-tight mt-0.5">
                  {studioName}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#26734D] bg-[#26734D]/10 px-2 py-0.5 rounded shrink-0">
              Verified Studio
            </span>
          </div>

          {/* Service Title */}
          <h3 className="text-[15px] font-semibold text-[#172333] group-hover:text-[#F18A45] transition-colors leading-snug line-clamp-2 min-h-[2.6rem]">
            <Link to={detailPath} className="focus:outline-none">
              {srv.title}
            </Link>
          </h3>

          {/* Short Description */}
          <p className="text-xs text-[#6E7785] line-clamp-2 leading-relaxed min-h-[2.25rem]">
            {srv.description}
          </p>

          {/* Delivery Time & Revisions Meta Strip */}
          <div className="pt-2.5 border-t border-[#E2E4DF]/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6E7785]">
            <span className="inline-flex items-center gap-1.5 font-medium text-[#172333]">
              <Clock className="w-3.5 h-3.5 text-[#F18A45] shrink-0" />
              <span>{srv.turnaroundTime || '24–48 hours'}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <RefreshCw className="w-3 h-3 text-[#6E7785] shrink-0" />
              <span>{srv.revisions || '2 Revisions'}</span>
            </span>
            {!srv.isCustomQuote && (
              <span className="text-[#26734D] font-semibold">3 Packages</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Marketplace Price & Dual Action Footer */}
      <div className="px-5 py-3.5 bg-[#F5F5F1]/75 border-t border-[#E2E4DF] space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6E7785]">
            {srv.isCustomQuote ? 'Project Scope' : 'Starting At'}
          </span>
          <span className="font-mono text-base font-bold text-[#172333] tabular-nums">
            {srv.priceDisplay}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link
            to={`/contact?service=${encodeURIComponent(srv.title)}`}
            className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-[#172333] bg-white border border-[#E2E4DF] hover:border-[#172333] hover:bg-[#F5F5F1]/50 rounded-lg transition-colors text-center"
          >
            Contact for a Project
          </Link>
          <Link
            to={detailPath}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg transition-colors text-center"
          >
            <span>View Service</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
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
  const hasCustomCover = Boolean(item.coverImage);
  const coverSrc =
    item.coverImage ||
    createStudioArtworkDataUri(item.title, item.category, accentColor, primaryBg, secondaryBg);
  const displayCat = formatPortfolioCategoryLabel(item.category);
  const creatorName = settings?.ownerName || 'Shankar Baluragi';
  const studioName = settings?.businessName || 'Prithvi Editify';
  const galleryCount = 1 + (Array.isArray(item.galleryUrls) ? item.galleryUrls.filter(Boolean).length : 0);

  return (
    <article className="group bg-white border border-[#E2E4DF] rounded-xl overflow-hidden flex flex-col justify-between shadow-[0_1px_3px_rgba(23,35,51,0.04)] hover:-translate-y-0.5 hover:border-[#172333]/50 hover:shadow-[0_14px_32px_-8px_rgba(23,35,51,0.12)] transition-all duration-200">
      <div>
        {/* 1. Consistent 16:10 Media Stage — Preserves full artwork without cropping */}
        <div className="relative aspect-[16/10] w-full bg-[#0F1722] overflow-hidden border-b border-[#E2E4DF]">
          <Link
            to={detailPath}
            className="relative flex items-center justify-center w-full h-full overflow-hidden"
          >
            {hasCustomCover && (
              <img
                src={coverSrc}
                alt=""
                aria-hidden="true"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover blur-md opacity-35 scale-110 pointer-events-none"
              />
            )}
            <img
              src={coverSrc}
              alt={item.title}
              referrerPolicy="no-referrer"
              className={`relative z-10 transition-transform duration-300 ease-out group-hover:scale-[1.03] ${
                hasCustomCover
                  ? 'max-h-full max-w-full w-auto h-auto object-contain p-2.5 drop-shadow-[0_6px_16px_rgba(0,0,0,0.35)]'
                  : 'w-full h-full object-cover'
              }`}
            />
          </Link>

          {/* Category Tag Overlay */}
          <span className="absolute top-3 left-3 z-20 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white bg-[#172333]/90 backdrop-blur-xs border border-white/15 rounded-md">
            {displayCat}
          </span>

          {/* Quick Lightbox Preview Trigger */}
          {onQuickPreview && (
            <button
              type="button"
              onClick={() => onQuickPreview(item)}
              title="Quick preview project"
              className="absolute bottom-3 right-3 z-20 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-[#172333]/90 hover:bg-[#172333] rounded-md border border-white/15 shadow-xs transition-all duration-150"
            >
              {item.videoUrl ? (
                <Film className="w-3.5 h-3.5 text-[#F18A45]" />
              ) : (
                <Eye className="w-3.5 h-3.5 text-[#F18A45]" />
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
                <p className="text-xs font-semibold text-[#172333] truncate leading-tight">
                  {creatorName}
                </p>
                <p className="text-[11px] text-[#6E7785] truncate leading-tight mt-0.5">
                  {studioName}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#26734D] bg-[#26734D]/10 px-2 py-0.5 rounded shrink-0">
              Verified Studio
            </span>
          </div>

          {/* Project Title */}
          <h3 className="text-[15px] font-semibold text-[#172333] group-hover:text-[#F18A45] transition-colors leading-snug line-clamp-2 min-h-[2.6rem]">
            <Link to={detailPath} className="focus:outline-none">
              {item.title}
            </Link>
          </h3>

          {/* Short Description */}
          <p className="text-xs text-[#6E7785] line-clamp-2 leading-relaxed min-h-[2.25rem]">
            {item.description}
          </p>

          {/* Project Meta Strip */}
          <div className="pt-2.5 border-t border-[#E2E4DF]/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6E7785]">
            <span className="inline-flex items-center gap-1.5 font-medium text-[#172333]">
              <Clock className="w-3.5 h-3.5 text-[#F18A45] shrink-0" />
              <span>{item.videoUrl ? 'Video Production' : '24–48 hours'}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <RefreshCw className="w-3 h-3 text-[#6E7785] shrink-0" />
              <span>{galleryCount > 1 ? `${galleryCount} Previews` : 'High-Res Export'}</span>
            </span>
            <span className="text-[#26734D] font-semibold">
              {item.featured ? 'Featured Work' : 'Case Study'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Deliverable & Dual Action Footer */}
      <div className="px-5 py-3.5 bg-[#F5F5F1]/75 border-t border-[#E2E4DF] space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6E7785]">
            Deliverable
          </span>
          <span className="font-mono text-sm font-bold text-[#172333] truncate max-w-[190px]">
            {item.metricsSummary || displayCat}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link
            to={`/contact?service=${encodeURIComponent(displayCat)}`}
            className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-[#172333] bg-white border border-[#E2E4DF] hover:border-[#172333] hover:bg-[#F5F5F1]/50 rounded-lg transition-colors text-center"
          >
            Contact for a Project
          </Link>
          <Link
            to={detailPath}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg transition-colors text-center"
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
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [portfolioCategory, setPortfolioCategory] = useState<string>('All');
  const [previewMedia, setPreviewMedia] = useState<PreviewableMediaItem | null>(null);
  const [loading, setLoading] = useState(true);

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
  const primaryBg = custom.primaryColor || '#172333';
  const secondaryBg = custom.secondaryColor || '#24364A';
  const accentColor = custom.accentColor || '#F18A45';

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
        className="text-[#F5F5F1] border-b"
        style={{ backgroundColor: primaryBg, borderColor: secondaryBg }}
      >
        <div className="max-w-[1200px] mx-auto px-6 py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
            {/* Left Copy Column */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-8">
              <div className="space-y-6">
                <p
                  className="text-xs font-medium tracking-wide"
                  style={{ color: accentColor }}
                >
                  {custom.heroKicker}
                </p>
                <h1
                  className="font-editorial font-semibold text-white tracking-tight leading-[1.08]"
                  style={{ fontSize: 'clamp(2.5rem, 4.2vw, 3.75rem)', textWrap: 'balance' }}
                >
                  {custom.heroHeadline}
                </h1>
                <p className="text-base sm:text-lg text-[#D0D5DD] max-w-xl leading-relaxed">
                  {custom.heroSubheadline}
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-4">
                  <Link
                    to={custom.heroPrimaryCtaLink || '/contact'}
                    className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-[#172333] rounded-lg transition-colors whitespace-nowrap shrink-0"
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
                </div>

                {custom.heroDisciplines && custom.heroDisciplines.length > 0 && (
                  <div
                    className="pt-4 border-t flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#9BA3B0]"
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
                className="w-full border border-white/10 rounded-lg p-6 flex flex-col justify-between space-y-6"
                style={{ backgroundColor: secondaryBg }}
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="text-xs font-semibold text-white">{custom.showcaseTitle}</p>
                    <p className="text-[11px] text-[#9BA3B0] mt-0.5">{custom.showcaseSubtitle}</p>
                  </div>
                  <span className="font-mono text-xs" style={{ color: accentColor }}>
                    {custom.showcaseBadge}
                  </span>
                </div>

                {/* Custom Image or Architectural SVG Composition */}
                <div
                  className="relative overflow-hidden rounded-lg border border-white/10"
                  style={{ backgroundColor: primaryBg }}
                >
                  <img
                    src={heroPreviewSrc}
                    alt={`${settings.businessName || 'Prithvi Editify'} studio showcase`}
                    referrerPolicy="no-referrer"
                    className="w-full h-56 object-cover"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div
                    className="border border-white/10 rounded-lg p-3.5"
                    style={{ backgroundColor: primaryBg }}
                  >
                    <p className="text-xs text-[#9BA3B0]">{custom.stat1Label}</p>
                    <p className="text-lg font-mono font-semibold text-white mt-1 tabular-nums">
                      {custom.stat1Value}
                    </p>
                    <p className="text-[11px] text-[#9BA3B0] mt-0.5">{custom.stat1Subtext}</p>
                  </div>
                  <div
                    className="border border-white/10 rounded-lg p-3.5"
                    style={{ backgroundColor: primaryBg }}
                  >
                    <p className="text-xs text-[#9BA3B0]">{custom.stat2Label}</p>
                    <p className="text-lg font-semibold text-white mt-1">{custom.stat2Value}</p>
                    <p className="text-[11px] text-[#9BA3B0] mt-0.5">{custom.stat2Subtext}</p>
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
              <p className="text-xs font-semibold text-[#6E7785] tracking-wide">
                {custom.homeServicesKicker}
              </p>
              <h2 className="font-editorial text-3xl font-semibold text-[#172333] mt-2">
                {custom.homeServicesHeading}
              </h2>
            </div>
            <Link
              to="/services"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#172333] hover:text-[#F18A45] transition-colors whitespace-nowrap shrink-0"
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
                  className="h-96 bg-white rounded-lg animate-pulse border border-[#E2E4DF]"
                />
              ))}
            </div>
          ) : services.length === 0 ? (
            <div className="bg-white border border-[#E2E4DF] rounded-lg p-10 text-center">
              <p className="font-editorial text-lg font-semibold text-[#172333]">
                Custom Creative Services Available
              </p>
              <p className="text-sm text-[#6E7785] mt-1.5 max-w-md mx-auto">
                Contact {settings.businessName || 'Prithvi Editify'} directly to discuss your graphic design, thumbnail, or video editing project scope.
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <Link
                  to="/contact"
                  className="px-4 py-2.5 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg transition-colors"
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
        <section className="bg-white border-y border-[#E2E4DF] py-20">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#E2E4DF]">
              <div>
                <p className="text-xs font-semibold text-[#6E7785] tracking-wide">
                  {custom.homePortfolioKicker}
                </p>
                <h2 className="font-editorial text-3xl font-semibold text-[#172333] mt-2">
                  {custom.homePortfolioHeading}
                </h2>
              </div>
              <Link
                to="/portfolio"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#172333] hover:text-[#F18A45] transition-colors whitespace-nowrap shrink-0"
              >
                <span>{custom.homePortfolioCtaLabel}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Horizontal Category Filter Bar for Home Portfolio Section */}
            <div
              role="tablist"
              aria-label="Filter featured portfolio projects by category"
              className="flex items-center gap-2 overflow-x-auto py-4 border-b border-[#E2E4DF] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
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
                        ? 'bg-[#172333] text-white border-[#172333] font-semibold shadow-2xs'
                        : 'bg-[#F5F5F1]/70 text-[#6E7785] border-[#E2E4DF] hover:bg-white hover:text-[#172333] hover:border-[#172333]/40 font-medium'
                    }`}
                  >
                    <span>{cat}</span>
                    {matchCount > 0 && (
                      <span
                        className={`font-mono text-[10px] px-1.5 py-0.2 rounded tabular-nums ${
                          active
                            ? 'bg-white/15 text-white'
                            : 'bg-[#E2E4DF]/70 text-[#172333]'
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
                    className="h-96 bg-[#F5F5F1] rounded-lg animate-pulse border border-[#E2E4DF]"
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

      {/* PROCESS SECTION */}
      {custom.showProcessSection !== false && (
        <section className="max-w-[1200px] mx-auto px-6 py-20">
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-semibold text-[#6E7785] tracking-wide">
              {custom.processKicker}
            </p>
            <h2 className="font-editorial text-3xl font-semibold text-[#172333] mt-2">
              {custom.processHeading}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {custom.processSteps.map((p, idx) => (
              <div
                key={`${p.step}_${idx}`}
                className="bg-white border border-[#E2E4DF] rounded-lg p-6 shadow-[0_1px_2px_rgba(23,35,51,0.04)]"
              >
                <h3 className="text-base font-semibold text-[#172333]">{p.step}</h3>
                <p className="text-sm text-[#6E7785] mt-2.5 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TRUST SECTION */}
      {custom.showTrustSection !== false && (
        <section
          className="text-[#F5F5F1] py-20 border-y"
          style={{ backgroundColor: primaryBg, borderColor: secondaryBg }}
        >
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="max-w-2xl mb-12">
              <p className="text-xs font-semibold tracking-wide" style={{ color: accentColor }}>
                {custom.trustKicker}
              </p>
              <h2 className="font-editorial text-3xl font-semibold text-white mt-2">
                {custom.trustHeading}
              </h2>
              <p className="text-sm text-[#9BA3B0] mt-3 leading-relaxed">{custom.trustSubtitle}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {custom.trustPillars.map((pillar, idx) => {
                const IconComp = trustIcons[idx % trustIcons.length];
                return (
                  <div
                    key={`${pillar.title}_${idx}`}
                    className="border border-white/10 rounded-lg p-6"
                    style={{ backgroundColor: secondaryBg }}
                  >
                    <IconComp className="w-5 h-5 mb-3" style={{ color: accentColor }} />
                    <h3 className="text-base font-semibold text-white">{pillar.title}</h3>
                    <p className="text-sm text-[#D0D5DD] mt-2 leading-relaxed">{pillar.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* CONTACT / INQUIRY SECTION */}
      {custom.showHomeContactSection !== false && (
        <section className="max-w-[1200px] mx-auto px-6 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-5 space-y-6">
              <p className="text-xs font-semibold text-[#6E7785] tracking-wide">
                {custom.homeContactKicker}
              </p>
              <h2 className="font-editorial text-3xl font-semibold text-[#172333]">
                {custom.homeContactHeading}
              </h2>
              <p className="text-sm text-[#6E7785] leading-relaxed">{custom.homeContactDesc}</p>

              <div className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-4">
                <h3 className="text-sm font-semibold text-[#172333]">Direct Studio Contact</h3>
                <div className="space-y-2 text-xs text-[#6E7785]">
                  <p>
                    <span className="font-semibold text-[#172333]">Studio Owner:</span>{' '}
                    {settings.ownerName || 'Shankar Baluragi'}
                  </p>
                  {settings.businessEmail && (
                    <p>
                      <span className="font-semibold text-[#172333]">Email:</span>{' '}
                      {settings.businessEmail}
                    </p>
                  )}
                  {custom.workingHours && (
                    <p>
                      <span className="font-semibold text-[#172333]">Hours:</span>{' '}
                      {custom.workingHours}
                    </p>
                  )}
                </div>
                <div className="pt-2">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#172333] rounded-lg transition-colors whitespace-nowrap shrink-0"
                    style={{ backgroundColor: accentColor }}
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Open WhatsApp Chat</span>
                  </a>
                  <p className="text-[11px] text-[#6E7785] mt-2">
                    Opens WhatsApp with a prefilled inquiry message. You confirm and send the message directly in WhatsApp.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <InquiryForm customBudgetRanges={custom.inquiryBudgetRanges} />
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

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState<string>(initialQuery);
  const [sortBy, setSortBy] = useState<ServiceSortOption>('recommended');
  const [loading, setLoading] = useState(true);
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

  const primaryBg = custom.primaryColor || '#172333';
  const secondaryBg = custom.secondaryColor || '#24364A';
  const accentColor = custom.accentColor || '#F18A45';

  return (
    <div>
      {/* Top Horizontal Marketplace Category Filter Bar */}
      <div className="bg-white border-b border-[#E2E4DF] sticky top-16 z-20 shadow-[0_1px_2px_rgba(23,35,51,0.03)]">
        <div className="max-w-[1200px] mx-auto px-6 flex items-center gap-2 py-2.5">
          <button
            type="button"
            onClick={() => scrollCategoryBar('left')}
            aria-label="Scroll categories left"
            className="hidden sm:inline-flex items-center justify-center w-7 h-7 rounded-md border border-[#E2E4DF] bg-white text-[#6E7785] hover:text-[#172333] hover:border-[#172333]/40 shrink-0 transition-colors"
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

              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => handleSelectCategory(cat)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-lg border transition-all duration-150 whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#172333] text-white border-[#172333] font-semibold shadow-2xs'
                      : 'bg-[#F5F5F1]/70 text-[#6E7785] border-[#E2E4DF] hover:bg-white hover:text-[#172333] hover:border-[#172333]/40 font-medium'
                  }`}
                >
                  <span>{cat}</span>
                  {services.length > 0 && matchCount > 0 && (
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.2 rounded tabular-nums ${
                        active
                          ? 'bg-white/15 text-white'
                          : 'bg-[#E2E4DF]/70 text-[#172333]'
                      }`}
                    >
                      {matchCount}
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
            className="hidden sm:inline-flex items-center justify-center w-7 h-7 rounded-md border border-[#E2E4DF] bg-white text-[#6E7785] hover:text-[#172333] hover:border-[#172333]/40 shrink-0 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 py-12 lg:py-14">
        {/* Marketplace Header, Search & Sort Controls */}
        <div className="border-b border-[#E2E4DF] pb-7">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold text-[#6E7785] tracking-wide">
                {custom.servicesPageKicker || 'Prithvi Editify · Creative Services'}
              </p>
              <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-[#172333] mt-2">
                {selectedCategory === 'All'
                  ? custom.servicesPageTitle || 'Creative Services'
                  : selectedCategory}
              </h1>
              <p className="text-base text-[#6E7785] mt-2.5 leading-relaxed">
                {custom.servicesPageDescription ||
                  'Professional design, video editing and digital creative solutions for your brand.'}
              </p>
            </div>

            {/* Search & Sort Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="w-4 h-4 text-[#6E7785] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for a service…"
                  aria-label="Search for a service"
                  className="w-full pl-10 pr-8 py-2.5 text-xs bg-white border border-[#E2E4DF] rounded-lg text-[#172333] placeholder-[#6E7785] focus:outline-none focus:border-[#172333] transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6E7785] hover:text-[#172333] p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#6E7785] shrink-0 hidden sm:block" />
                <label htmlFor="service-sort" className="text-xs text-[#6E7785] whitespace-nowrap">
                  Sort by:
                </label>
                <select
                  id="service-sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as ServiceSortOption)}
                  className="px-3 py-2.5 text-xs font-medium text-[#172333] bg-white border border-[#E2E4DF] rounded-lg focus:outline-none focus:border-[#172333] transition-colors"
                >
                  <option value="recommended">Recommended</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                </select>
              </div>
            </div>
          </div>

          {/* Active Filter Status Strip */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#6E7785]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono tabular-nums text-[#172333] font-semibold">
                {filteredAndSortedServices.length}{' '}
                {filteredAndSortedServices.length === 1 ? 'service' : 'services'} available
              </span>
              {selectedCategory !== 'All' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#172333]/5 text-[#172333] font-medium">
                  <span>Category: {selectedCategory}</span>
                  <button
                    type="button"
                    onClick={() => handleSelectCategory('All')}
                    aria-label={`Remove ${selectedCategory} filter`}
                    className="hover:text-[#F18A45]"
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
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#172333] hover:text-[#F18A45] transition-colors whitespace-nowrap"
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
              className="h-[420px] bg-white border border-[#E2E4DF] rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : filteredAndSortedServices.length === 0 ? (
        <div className="mt-10 bg-white border border-[#E2E4DF] rounded-lg p-12 text-center max-w-xl mx-auto shadow-[0_1px_2px_rgba(23,35,51,0.04)]">
          <h2 className="font-editorial text-xl font-semibold text-[#172333]">
            No matching services found
          </h2>
          <p className="text-sm text-[#6E7785] mt-2 leading-relaxed">
            No services matched your current search or category selection. Try clearing your filters or contact Prithvi Editify directly for a custom project scope.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-4 py-2.5 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg transition-colors"
            >
              Reset All Filters
            </button>
            <Link
              to="/contact"
              className="px-4 py-2.5 text-xs font-semibold text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-lg transition-colors"
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

      {/* Custom Scope Banner */}
      <div className="mt-16 bg-white border border-[#E2E4DF] rounded-lg p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-[0_1px_2px_rgba(23,35,51,0.04)]">
        <div className="max-w-xl">
          <p className="text-xs font-semibold text-[#6E7785]">Custom Creative Production</p>
          <h2 className="font-editorial text-2xl font-semibold text-[#172333] mt-1">
            Need a multi-deliverable package or monthly creative retainer?
          </h2>
          <p className="text-sm text-[#6E7785] mt-2 leading-relaxed">
            Share your brand requirements, volume of creatives, and target schedule with Shankar Baluragi for a tailored studio quote.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg transition-colors whitespace-nowrap"
          >
            <span>Contact for a Project</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/portfolio"
            className="px-4 py-2.5 text-xs font-semibold text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-lg transition-colors whitespace-nowrap"
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
  const { settings } = useOutletContext<OutletCtx>();
  const custom = mergeSiteCustomization(settings.siteCustomization || DEFAULT_SITE_CUSTOMIZATION);

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [selectedTier, setSelectedTier] = useState<'Basic' | 'Standard' | 'Premium'>('Basic');
  const [previewMedia, setPreviewMedia] = useState<PreviewableMediaItem | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setActiveMediaIndex(0);
    setSelectedTier('Basic');
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

  const primaryBg = custom.primaryColor || '#172333';
  const secondaryBg = custom.secondaryColor || '#24364A';
  const accentColor = custom.accentColor || '#F18A45';

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-16 space-y-8">
        <div className="h-6 w-64 bg-white border border-[#E2E4DF] rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 h-[480px] bg-white border border-[#E2E4DF] rounded-lg animate-pulse" />
          <div className="lg:col-span-4 h-[420px] bg-white border border-[#E2E4DF] rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-20 text-center space-y-4">
        <p className="text-xs font-semibold text-[#6E7785]">Service Not Found</p>
        <h1 className="font-editorial text-3xl font-semibold text-[#172333]">
          This service listing is unavailable
        </h1>
        <p className="text-sm text-[#6E7785] max-w-md mx-auto">
          The service you selected may have been updated or unpublished. Browse all available creative services below.
        </p>
        <div className="pt-2 flex items-center justify-center gap-3">
          <Link
            to="/services"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Creative Services</span>
          </Link>
          <Link
            to="/contact"
            className="px-5 py-2.5 text-xs font-semibold text-[#172333] bg-white border border-[#E2E4DF] hover:border-[#172333] rounded-lg transition-colors"
          >
            Contact for a Project
          </Link>
        </div>
      </div>
    );
  }

  const displayCategory = formatServiceCategoryLabel(service.category, service.title);
  const hasCustomImage = Boolean(service.imageUrl);
  const primaryCover =
    service.imageUrl ||
    createStudioArtworkDataUri(
      service.title,
      service.category,
      accentColor,
      primaryBg,
      secondaryBg
    );

  // Build gallery list from cover image + any additional configured mediaUrls
  const galleryImages = [
    primaryCover,
    ...(Array.isArray(service.mediaUrls) ? service.mediaUrls.filter(Boolean) : []),
  ];
  const currentPreviewUrl = galleryImages[activeMediaIndex] || primaryCover;

  // Resolve 3-Tier Packages (Basic, Standard, Premium)
  const packages: ServicePackageTier[] =
    service.packages && service.packages.length > 0
      ? service.packages
      : buildDefaultServicePackages(
          service.startingPrice,
          service.pricingUnit,
          service.turnaroundTime,
          service.deliverablesSummary,
          service.revisions || '2 Revisions'
        );

  const activePackage =
    packages.find((p) => p.tier === selectedTier) || packages[0];

  const deliverablesItems = parseDeliverablesList(service.deliverablesSummary);
  const creatorName = settings.ownerName || 'Shankar Baluragi';
  const studioName = settings.businessName || 'Prithvi Editify';

  const whatsappMessage = `Hello ${studioName}, I would like to discuss the "${
    service.title
  }" service (${
    service.isCustomQuote
      ? 'Custom Project Scope'
      : `${activePackage.tier} Package — ${activePackage.priceDisplay}`
  }).`;
  const whatsappUrl = buildWhatsAppLink(settings.whatsappNumber, whatsappMessage);

  const prefilledServiceOption = `${service.title} (${
    service.isCustomQuote ? 'Custom quote' : `Starting ${service.priceDisplay}`
  })`;

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10 lg:py-14 space-y-10">
      {/* 1. Breadcrumb & Service Marketplace Header */}
      <div className="space-y-4 border-b border-[#E2E4DF] pb-6">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center justify-between gap-4 text-xs text-[#6E7785]"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/services" className="hover:text-[#172333] transition-colors font-medium">
              Creative Services
            </Link>
            <span aria-hidden="true">/</span>
            <Link
              to={`/services?category=${encodeURIComponent(displayCategory)}`}
              className="hover:text-[#172333] transition-colors"
            >
              {displayCategory}
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-[#172333] font-medium truncate max-w-xs sm:max-w-md">
              {service.title}
            </span>
          </div>
          <Link
            to="/services"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#172333] hover:text-[#F18A45] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Services</span>
          </Link>
        </nav>

        <h1 className="font-editorial text-2xl sm:text-3xl lg:text-4xl font-semibold text-[#172333] leading-tight">
          {service.title}
        </h1>

        {/* Fiverr-Style Seller / Studio Attribution Bar */}
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
                  <span className="text-xs font-semibold text-[#172333]">{creatorName}</span>
                  <span className="text-[11px] font-semibold text-[#26734D] bg-[#26734D]/10 px-2 py-0.5 rounded">
                    Verified Studio Owner
                  </span>
                </div>
                <p className="text-[11px] text-[#6E7785]">
                  {studioName} · Creative Production Studio
                </p>
              </div>
            </div>

            <span className="hidden sm:inline text-[#E2E4DF]">|</span>

            <div className="flex flex-wrap items-center gap-3 text-xs text-[#6E7785]">
              <span className="inline-flex items-center gap-1 font-medium text-[#172333]">
                <Clock className="w-3.5 h-3.5 text-[#F18A45]" />
                <span>Delivery: {service.turnaroundTime || '24–48 hours'}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 font-medium text-[#172333]">
                <RefreshCw className="w-3.5 h-3.5 text-[#26734D]" />
                <span>{service.revisions || '2 Revisions'}</span>
              </span>
            </div>
          </div>

          <a
            href="#compare-packages"
            className="text-xs font-semibold text-[#172333] hover:text-[#F18A45] transition-colors"
          >
            Compare Packages ↓
          </a>
        </div>
      </div>

      {/* 2. Main 2-Column Fiverr Marketplace Layout — Aligned at the exact top edge */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Gallery Stage, Service Details, Package Comparison Table, Requirements & Inquiry */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-8">
          {/* Interactive Gallery Stage — Fixed height + w-full h-full object-contain so posters NEVER crop */}
          <div className="bg-white border border-[#E2E4DF] rounded-lg p-3 sm:p-4 space-y-3 shadow-[0_1px_3px_rgba(23,35,51,0.04)]">
            <div className="relative h-[340px] sm:h-[460px] w-full bg-[#0F1722] rounded-lg overflow-hidden border border-[#E2E4DF]">
              {hasCustomImage && (
                <img
                  src={currentPreviewUrl}
                  alt=""
                  aria-hidden="true"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover blur-xl opacity-30 scale-110 pointer-events-none"
                />
              )}
              <img
                src={currentPreviewUrl}
                alt={service.title}
                referrerPolicy="no-referrer"
                className={`relative z-10 w-full h-full ${
                  hasCustomImage ? 'object-contain p-2 sm:p-4' : 'object-cover'
                }`}
              />

              {/* Prev / Next Gallery Arrows when multiple images exist */}
              {galleryImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveMediaIndex((prev) =>
                        prev === 0 ? galleryImages.length - 1 : prev - 1
                      )
                    }
                    aria-label="Previous image"
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-[#172333] flex items-center justify-center shadow-md transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveMediaIndex((prev) =>
                        prev === galleryImages.length - 1 ? 0 : prev + 1
                      )
                    }
                    aria-label="Next image"
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-[#172333] flex items-center justify-center shadow-md transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() =>
                  setPreviewMedia({
                    id: service.id,
                    title: service.title,
                    url: currentPreviewUrl,
                    videoUrl: service.videoPreviewUrl || undefined,
                    description: service.description,
                    categoryLabel: `${displayCategory} · ${service.priceDisplay}`,
                    storageBucket: 'service-media',
                  })
                }
                className="absolute bottom-3 right-3 z-20 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#172333]/90 hover:bg-[#172333] border border-white/15 rounded-lg shadow-sm transition-colors"
              >
                <Eye className="w-4 h-4 text-[#F18A45]" />
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
                    className={`w-20 h-14 rounded-md overflow-hidden border bg-[#0F1722] transition-all ${
                      activeMediaIndex === idx
                        ? 'border-[#172333] ring-2 ring-[#172333]/20'
                        : 'border-[#E2E4DF] opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={imgUrl}
                      alt={`${service.title} thumbnail ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
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
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-[#172333] bg-[#F5F5F1] border border-[#E2E4DF] hover:border-[#172333] rounded-lg transition-colors"
                  >
                    <Film className="w-4 h-4 text-[#F18A45]" />
                    <span>Watch Video Sample</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* About This Service & Deliverables Card */}
          <section className="bg-white border border-[#E2E4DF] rounded-lg p-6 sm:p-8 space-y-6 shadow-[0_1px_2px_rgba(23,35,51,0.04)]">
            <div className="space-y-3">
              <h2 className="font-editorial text-xl font-semibold text-[#172333]">
                About This Service
              </h2>
              <p className="text-sm sm:text-base text-[#6E7785] leading-relaxed whitespace-pre-line">
                {service.description}
              </p>
            </div>

            <div className="pt-6 border-t border-[#E2E4DF] space-y-4">
              <div>
                <h3 className="font-editorial text-lg font-semibold text-[#172333]">
                  What’s Included & Deliverables
                </h3>
                <p className="text-xs text-[#6E7785] mt-0.5">
                  Every project for {service.title} includes these studio deliverables:
                </p>
              </div>

              {deliverablesItems.length > 0 ? (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {deliverablesItems.map((item, idx) => (
                    <li
                      key={`${item}_${idx}`}
                      className="flex items-start gap-2.5 text-sm text-[#172333] bg-[#F5F5F1]/60 border border-[#E2E4DF] rounded-lg p-3"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#26734D] shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[#6E7785]">
                  {service.deliverablesSummary ||
                    'High-resolution production files scoped specifically to your project brief.'}
                </p>
              )}
            </div>

            <div className="pt-5 border-t border-[#E2E4DF] grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 bg-[#F5F5F1]/50 rounded-lg border border-[#E2E4DF]">
                <span className="block text-[#6E7785]">Service Category</span>
                <span className="font-semibold text-[#172333] mt-1 block">{displayCategory}</span>
              </div>
              <div className="p-3.5 bg-[#F5F5F1]/50 rounded-lg border border-[#E2E4DF]">
                <span className="block text-[#6E7785]">Standard Turnaround</span>
                <span className="font-semibold text-[#172333] mt-1 block">
                  {service.turnaroundTime || '24–48 hours'}
                </span>
              </div>
              <div className="p-3.5 bg-[#F5F5F1]/50 rounded-lg border border-[#E2E4DF]">
                <span className="block text-[#6E7785]">Starting Rate (INR)</span>
                <span className="font-mono font-semibold text-[#172333] mt-1 block tabular-nums">
                  {service.priceDisplay}
                </span>
              </div>
            </div>
          </section>

          {/* Fiverr-Style Compare Packages Section (Basic vs Standard vs Premium) */}
          {!service.isCustomQuote && packages.length > 0 && (
            <section
              id="compare-packages"
              className="scroll-mt-24 bg-white border border-[#E2E4DF] rounded-lg overflow-hidden shadow-[0_1px_2px_rgba(23,35,51,0.04)]"
            >
              <div className="p-6 border-b border-[#E2E4DF]">
                <h2 className="font-editorial text-xl font-semibold text-[#172333]">
                  Compare Packages
                </h2>
                <p className="text-xs text-[#6E7785] mt-1">
                  Select a package tier based on your required deliverables, turnaround time, and revision rounds.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-[#E2E4DF] bg-[#F5F5F1]/50">
                      <th className="p-4 text-xs font-semibold text-[#6E7785] w-1/4">
                        Package Tier
                      </th>
                      {packages.map((pkg) => (
                        <th
                          key={pkg.tier}
                          className={`p-4 w-1/4 border-l border-[#E2E4DF] ${
                            selectedTier === pkg.tier ? 'bg-[#172333]/[0.03]' : ''
                          }`}
                        >
                          <span className="text-xs font-bold uppercase tracking-wider text-[#F18A45] block">
                            {pkg.tier}
                          </span>
                          <span className="font-mono text-xl font-bold text-[#172333] mt-1 block tabular-nums">
                            {pkg.priceDisplay}
                          </span>
                          <span className="text-xs font-semibold text-[#172333] mt-1 block">
                            {pkg.name}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E4DF] text-xs">
                    <tr>
                      <td className="p-4 font-semibold text-[#172333]">Scope Summary</td>
                      {packages.map((pkg) => (
                        <td
                          key={`${pkg.tier}_desc`}
                          className="p-4 text-[#6E7785] border-l border-[#E2E4DF] leading-relaxed"
                        >
                          {pkg.description}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-4 font-semibold text-[#172333]">Delivery Time</td>
                      {packages.map((pkg) => (
                        <td
                          key={`${pkg.tier}_deliv`}
                          className="p-4 font-medium text-[#172333] border-l border-[#E2E4DF]"
                        >
                          {pkg.deliveryTime}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-4 font-semibold text-[#172333]">Revisions</td>
                      {packages.map((pkg) => (
                        <td
                          key={`${pkg.tier}_rev`}
                          className="p-4 font-medium text-[#172333] border-l border-[#E2E4DF]"
                        >
                          {pkg.revisions}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-4 font-semibold text-[#172333]">What’s Included</td>
                      {packages.map((pkg) => (
                        <td
                          key={`${pkg.tier}_feat`}
                          className="p-4 border-l border-[#E2E4DF] align-top"
                        >
                          <ul className="space-y-1.5">
                            {pkg.features.map((feat, i) => (
                              <li
                                key={`${pkg.tier}_f_${i}`}
                                className="flex items-start gap-1.5 text-[#172333]"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#26734D] shrink-0 mt-0.5" />
                                <span>{feat}</span>
                              </li>
                            ))}
                          </ul>
                        </td>
                      ))}
                    </tr>
                    <tr className="bg-[#F5F5F1]/40">
                      <td className="p-4 font-semibold text-[#172333]">Action</td>
                      {packages.map((pkg) => (
                        <td
                          key={`${pkg.tier}_btn`}
                          className="p-4 border-l border-[#E2E4DF]"
                        >
                          <a
                            href="#service-inquiry"
                            onClick={() => setSelectedTier(pkg.tier)}
                            className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
                              selectedTier === pkg.tier
                                ? 'bg-[#172333] text-white hover:bg-[#24364A]'
                                : 'bg-white text-[#172333] border border-[#E2E4DF] hover:border-[#172333]'
                            }`}
                          >
                            <span>Select {pkg.tier}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </a>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Client Requirements Section */}
          <section className="bg-white border border-[#E2E4DF] rounded-lg p-6 sm:p-8 space-y-5 shadow-[0_1px_2px_rgba(23,35,51,0.04)]">
            <div>
              <h2 className="font-editorial text-xl font-semibold text-[#172333]">
                Client Requirements
              </h2>
              <p className="text-xs text-[#6E7785] mt-1">
                To begin work on your project smoothly, please share the following details when submitting your brief:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-[#F5F5F1]/70 border border-[#E2E4DF] rounded-lg space-y-1">
                <p className="font-semibold text-[#172333]">01. Project Objective & Platform</p>
                <p className="text-[#6E7785] leading-relaxed">
                  Specify where the creative or edit will be published (YouTube, Instagram, LinkedIn, Meta Ads, Print, or Web) and required dimensions.
                </p>
              </div>
              <div className="p-4 bg-[#F5F5F1]/70 border border-[#E2E4DF] rounded-lg space-y-1">
                <p className="font-semibold text-[#172333]">02. Copy, Script, or Key Text</p>
                <p className="text-[#6E7785] leading-relaxed">
                  Provide any exact headlines, thumbnail titles, ad copy, or video timestamps that need to appear in the deliverable.
                </p>
              </div>
              <div className="p-4 bg-[#F5F5F1]/70 border border-[#E2E4DF] rounded-lg space-y-1">
                <p className="font-semibold text-[#172333]">03. Brand Assets & Raw Footage</p>
                <p className="text-[#6E7785] leading-relaxed">
                  Attach logos, brand colors, subject photos, or footage links via the inquiry form or inside your Client Portal.
                </p>
              </div>
              <div className="p-4 bg-[#F5F5F1]/70 border border-[#E2E4DF] rounded-lg space-y-1">
                <p className="font-semibold text-[#172333]">04. Preferred Schedule</p>
                <p className="text-[#6E7785] leading-relaxed">
                  Let us know your target release date so we can confirm turnaround and milestone review dates before starting.
                </p>
              </div>
            </div>
          </section>

          {/* Direct Service Inquiry Form Section */}
          <section id="service-inquiry" className="scroll-mt-24 space-y-4">
            <div>
              <p className="text-xs font-semibold text-[#6E7785]">Start a Project Brief</p>
              <h2 className="font-editorial text-2xl font-semibold text-[#172333] mt-1">
                Inquire About {service.title}{' '}
                {!service.isCustomQuote && `(${activePackage.tier} — ${activePackage.priceDisplay})`}
              </h2>
              <p className="text-sm text-[#6E7785] mt-1">
                Your inquiry is prefilled with{' '}
                <span className="font-semibold text-[#172333]">{service.title}</span>. Submit your project details below to receive a confirmed scope and timeline.
              </p>
            </div>
            <InquiryForm
              key={prefilledServiceOption}
              defaultService={prefilledServiceOption}
              customBudgetRanges={custom.inquiryBudgetRanges}
            />
          </section>
        </div>

        {/* RIGHT STICKY COLUMN: Fiverr-Style Interactive Package Tabs (Basic | Standard | Premium) */}
        <aside className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24 space-y-5">
          <div className="bg-white border border-[#E2E4DF] rounded-lg overflow-hidden shadow-[0_6px_24px_rgba(23,35,51,0.06)]">
            {/* Top Interactive Package Tier Tabs (Basic | Standard | Premium) */}
            {!service.isCustomQuote && packages.length > 0 ? (
              <div
                role="tablist"
                aria-label="Service packages"
                className="grid grid-cols-3 border-b border-[#E2E4DF] bg-[#F5F5F1]"
              >
                {packages.map((pkg) => {
                  const isAct = selectedTier === pkg.tier;
                  return (
                    <button
                      key={pkg.tier}
                      type="button"
                      role="tab"
                      aria-selected={isAct}
                      onClick={() => setSelectedTier(pkg.tier)}
                      className={`py-3.5 px-2 text-xs font-bold transition-all border-b-2 ${
                        isAct
                          ? 'bg-white text-[#172333] border-[#F18A45]'
                          : 'text-[#6E7785] border-transparent hover:text-[#172333]'
                      }`}
                    >
                      {pkg.tier}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-6 py-4 bg-[#172333] text-white flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wide">Custom Project Scope</span>
                <span className="font-mono text-xs text-[#F18A45]">INR PRICING</span>
              </div>
            )}

            <div className="p-6 space-y-5">
              {/* Selected Package Header & Price */}
              <div className="flex items-baseline justify-between gap-4 pb-4 border-b border-[#E2E4DF]">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#F18A45] block">
                    {service.isCustomQuote ? 'Scoped Brief' : `${activePackage.tier} Package`}
                  </span>
                  <h2 className="text-base font-semibold text-[#172333] mt-0.5">
                    {service.isCustomQuote ? service.title : activePackage.name}
                  </h2>
                </div>
                <span className="font-mono text-2xl font-bold text-[#172333] tabular-nums shrink-0">
                  {service.isCustomQuote ? service.priceDisplay : activePackage.priceDisplay}
                </span>
              </div>

              {/* Package Description */}
              <p className="text-xs text-[#6E7785] leading-relaxed">
                {service.isCustomQuote ? service.description : activePackage.description}
              </p>

              {/* Delivery & Revisions Bar (Fiverr Style) */}
              <div className="flex items-center justify-between gap-4 py-3 px-3.5 bg-[#F5F5F1]/80 border border-[#E2E4DF] rounded-lg text-xs font-semibold text-[#172333]">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#F18A45]" />
                  <span>
                    {service.isCustomQuote
                      ? service.turnaroundTime || 'Scoped per brief'
                      : `${activePackage.deliveryTime} Delivery`}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-[#26734D]" />
                  <span>
                    {service.isCustomQuote
                      ? service.revisions || '2 Revisions'
                      : activePackage.revisions}
                  </span>
                </span>
              </div>

              {/* Included Features Checklist */}
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-[#172333]">What’s Included:</p>
                <ul className="space-y-2">
                  {(service.isCustomQuote ? deliverablesItems : activePackage.features).map(
                    (item, idx) => (
                      <li
                        key={`pkg_feat_${idx}`}
                        className="flex items-start gap-2 text-xs text-[#172333]"
                      >
                        <CheckCircle2 className="w-4 h-4 text-[#26734D] shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    )
                  )}
                </ul>
              </div>

              {/* Primary & Secondary Action Buttons */}
              <div className="pt-2 space-y-2.5">
                <a
                  href="#service-inquiry"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg transition-colors"
                >
                  <span>
                    {service.isCustomQuote
                      ? 'Contact for a Project'
                      : `Continue (${activePackage.priceDisplay})`}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>

                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-semibold text-[#172333] rounded-lg transition-colors"
                  style={{ backgroundColor: accentColor }}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Discuss on WhatsApp</span>
                </a>

                {!service.isCustomQuote && (
                  <a
                    href="#compare-packages"
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#6E7785] hover:text-[#172333] transition-colors"
                  >
                    <span>Compare All 3 Packages</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Studio Seller Card */}
          <div className="bg-white border border-[#E2E4DF] rounded-lg p-5 space-y-3 text-xs">
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
                <p className="font-semibold text-[#172333]">{creatorName}</p>
                <p className="text-[#6E7785]">Founder · {studioName}</p>
              </div>
            </div>
            <p className="text-[#6E7785] leading-relaxed">
              Every project includes written scope confirmation, private draft previews in the Client Portal, and itemized INR billing.
            </p>
            <div className="pt-2 border-t border-[#E2E4DF] flex items-center justify-between text-[11px] text-[#6E7785]">
              <span>Currency: INR (₹)</span>
              <Link
                to={`/contact?service=${encodeURIComponent(service.title)}`}
                className="font-semibold text-[#172333] hover:text-[#F18A45]"
              >
                Send Custom Brief →
              </Link>
            </div>
          </div>
        </aside>
      </div>

      {/* Related Services Section */}
      {relatedServices.length > 0 && (
        <section className="pt-12 border-t border-[#E2E4DF] space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#6E7785]">Explore More Capabilities</p>
              <h2 className="font-editorial text-2xl font-semibold text-[#172333] mt-1">
                Related Creative Services
              </h2>
            </div>
            <Link
              to="/services"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#172333] hover:text-[#F18A45] transition-colors"
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

      <MediaPreviewModal item={previewMedia} onClose={() => setPreviewMedia(null)} />
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

  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [category, setCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState<string>(initialQuery);
  const [sortBy, setSortBy] = useState<PortfolioSortOption>('recommended');
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);
  const [loading, setLoading] = useState(true);

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

  const primaryBg = custom.primaryColor || '#172333';
  const secondaryBg = custom.secondaryColor || '#24364A';
  const accentColor = custom.accentColor || '#F18A45';

  return (
    <div>
      {/* Top Horizontal Marketplace Category Filter Bar */}
      <div className="bg-white border-b border-[#E2E4DF] sticky top-16 z-20 shadow-[0_1px_2px_rgba(23,35,51,0.03)]">
        <div className="max-w-[1200px] mx-auto px-6 flex items-center gap-2 py-2.5">
          <button
            type="button"
            onClick={() => scrollCategoryBar('left')}
            aria-label="Scroll categories left"
            className="hidden sm:inline-flex items-center justify-center w-7 h-7 rounded-md border border-[#E2E4DF] bg-white text-[#6E7785] hover:text-[#172333] hover:border-[#172333]/40 shrink-0 transition-colors"
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

              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => handleSelectCategory(cat)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-lg border transition-all duration-150 whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#172333] text-white border-[#172333] font-semibold shadow-2xs'
                      : 'bg-[#F5F5F1]/70 text-[#6E7785] border-[#E2E4DF] hover:bg-white hover:text-[#172333] hover:border-[#172333]/40 font-medium'
                  }`}
                >
                  <span>{cat}</span>
                  {items.length > 0 && matchCount > 0 && (
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.2 rounded tabular-nums ${
                        active
                          ? 'bg-white/15 text-white'
                          : 'bg-[#E2E4DF]/70 text-[#172333]'
                      }`}
                    >
                      {matchCount}
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
            className="hidden sm:inline-flex items-center justify-center w-7 h-7 rounded-md border border-[#E2E4DF] bg-white text-[#6E7785] hover:text-[#172333] hover:border-[#172333]/40 shrink-0 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 py-12 lg:py-14">
        {/* Portfolio Header, Search & Sort Controls */}
        <div className="border-b border-[#E2E4DF] pb-7">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold text-[#6E7785] tracking-wide">
                {custom.portfolioPageKicker || 'Prithvi Editify · Curated Project Showcase'}
              </p>
              <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-[#172333] mt-2">
                {category === 'All'
                  ? custom.portfolioPageTitle || 'Creative Portfolio'
                  : category}
              </h1>
              <p className="text-base text-[#6E7785] mt-2.5 leading-relaxed">
                {custom.portfolioPageDescription ||
                  'Explore selected design, branding, thumbnail and video editing projects by Prithvi Editify.'}
              </p>
            </div>

            {/* Search & Sort Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="w-4 h-4 text-[#6E7785] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for a project…"
                  aria-label="Search for a project"
                  className="w-full pl-10 pr-8 py-2.5 text-xs bg-white border border-[#E2E4DF] rounded-lg text-[#172333] placeholder-[#6E7785] focus:outline-none focus:border-[#172333] transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6E7785] hover:text-[#172333] p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#6E7785] shrink-0 hidden sm:block" />
                <label htmlFor="portfolio-sort" className="text-xs text-[#6E7785] whitespace-nowrap">
                  Sort by:
                </label>
                <select
                  id="portfolio-sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as PortfolioSortOption)}
                  className="px-3 py-2.5 text-xs font-medium text-[#172333] bg-white border border-[#E2E4DF] rounded-lg focus:outline-none focus:border-[#172333] transition-colors"
                >
                  <option value="recommended">Recommended</option>
                  <option value="featured">Featured First</option>
                  <option value="title_asc">Title: A to Z</option>
                </select>
              </div>
            </div>
          </div>

          {/* Active Filter Status Strip */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#6E7785]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono tabular-nums text-[#172333] font-semibold">
                {filtered.length} {filtered.length === 1 ? 'project' : 'projects'} available
              </span>
              {category !== 'All' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#172333]/5 text-[#172333] font-medium">
                  <span>Category: {category}</span>
                  <button
                    type="button"
                    onClick={() => handleSelectCategory('All')}
                    aria-label={`Remove ${category} filter`}
                    className="hover:text-[#F18A45]"
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
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#172333] hover:text-[#F18A45] transition-colors whitespace-nowrap"
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
                className="h-[420px] bg-white border border-[#E2E4DF] rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-10 bg-white border border-[#E2E4DF] rounded-lg p-12 text-center max-w-xl mx-auto shadow-[0_1px_2px_rgba(23,35,51,0.04)]">
            <h2 className="font-editorial text-xl font-semibold text-[#172333]">
              No matching portfolio projects found
            </h2>
            <p className="text-sm text-[#6E7785] mt-2 leading-relaxed">
              Try clearing your search query or selecting another creative category, or contact Prithvi Editify to request a custom sample brief.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-4 py-2.5 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg transition-colors"
              >
                Reset All Filters
              </button>
              <Link
                to="/contact"
                className="px-4 py-2.5 text-xs font-semibold text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-lg transition-colors"
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

      {/* Portfolio CTA Banner */}
      <div className="mt-16 bg-white border border-[#E2E4DF] rounded-lg p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-[0_1px_2px_rgba(23,35,51,0.04)]">
        <div className="max-w-xl">
          <p className="text-xs font-semibold text-[#6E7785]">Start a Creative Project</p>
          <h2 className="font-editorial text-2xl font-semibold text-[#172333] mt-1">
            Looking for similar design quality or video editing for your brand?
          </h2>
          <p className="text-sm text-[#6E7785] mt-2 leading-relaxed">
            Explore our service rates or send your project brief directly to Shankar Baluragi.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg transition-colors whitespace-nowrap"
          >
            <span>Contact for a Project</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/services"
            className="px-4 py-2.5 text-xs font-semibold text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-lg transition-colors whitespace-nowrap"
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

  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [previewMedia, setPreviewMedia] = useState<PreviewableMediaItem | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setActiveImageIndex(0);
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

  const primaryBg = custom.primaryColor || '#172333';
  const secondaryBg = custom.secondaryColor || '#24364A';
  const accentColor = custom.accentColor || '#F18A45';

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-16 space-y-8">
        <div className="h-6 w-64 bg-white border border-[#E2E4DF] rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 h-[480px] bg-white border border-[#E2E4DF] rounded-lg animate-pulse" />
          <div className="lg:col-span-4 h-[360px] bg-white border border-[#E2E4DF] rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-20 text-center space-y-4">
        <p className="text-xs font-semibold text-[#6E7785]">Project Not Found</p>
        <h1 className="font-editorial text-3xl font-semibold text-[#172333]">
          This portfolio project is unavailable
        </h1>
        <p className="text-sm text-[#6E7785] max-w-md mx-auto">
          The project you selected may have been moved or unpublished. Return to the portfolio gallery to explore more work.
        </p>
        <div className="pt-2 flex items-center justify-center gap-3">
          <Link
            to="/portfolio"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Creative Portfolio</span>
          </Link>
          <Link
            to="/contact"
            className="px-5 py-2.5 text-xs font-semibold text-[#172333] bg-white border border-[#E2E4DF] hover:border-[#172333] rounded-lg transition-colors"
          >
            Contact for a Project
          </Link>
        </div>
      </div>
    );
  }

  const displayCategory = formatPortfolioCategoryLabel(project.category);
  const hasCustomCover = Boolean(project.coverImage);
  const primaryCover =
    project.coverImage ||
    createStudioArtworkDataUri(
      project.title,
      project.category,
      accentColor,
      primaryBg,
      secondaryBg
    );

  const galleryImages = [
    primaryCover,
    ...(Array.isArray(project.galleryUrls) ? project.galleryUrls.filter(Boolean) : []),
  ];
  const activeImageUrl = galleryImages[activeImageIndex] || primaryCover;

  const whatsappMessage = `Hello ${
    settings.businessName || 'Prithvi Editify'
  }, I viewed "${project.title}" in your Creative Portfolio and would like to discuss a similar ${displayCategory} project.`;
  const whatsappUrl = buildWhatsAppLink(settings.whatsappNumber, whatsappMessage);

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10 lg:py-14 space-y-10">
      {/* Top Breadcrumb & Project Header */}
      <div className="space-y-5 border-b border-[#E2E4DF] pb-6">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center justify-between gap-4 text-xs text-[#6E7785]"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/portfolio" className="hover:text-[#172333] transition-colors font-medium">
              Creative Portfolio
            </Link>
            <span aria-hidden="true">/</span>
            <Link
              to={`/portfolio?category=${encodeURIComponent(displayCategory)}`}
              className="hover:text-[#172333] transition-colors"
            >
              {displayCategory}
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-[#172333] font-medium truncate max-w-xs sm:max-w-md">
              {project.title}
            </span>
          </div>
          <Link
            to="/portfolio"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#172333] hover:text-[#F18A45] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Portfolio</span>
          </Link>
        </nav>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#6E7785]">
            <span className="font-semibold text-[#172333]">{displayCategory}</span>
            <span aria-hidden="true">·</span>
            <span>{project.metricsSummary || 'Studio Deliverable'}</span>
            {project.isSampleContent && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#A96518] font-medium">Demonstration Sample</span>
              </>
            )}
          </div>
          <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-[#172333] leading-tight">
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
            {project.videoUrl ? (
              <div className="bg-[#0F1722] border border-[#E2E4DF] rounded-lg overflow-hidden">
                <video
                  src={project.videoUrl}
                  poster={primaryCover}
                  controls
                  playsInline
                  className="w-full max-h-[540px] object-contain bg-black"
                />
              </div>
            ) : (
              <div className="relative h-[340px] sm:h-[460px] w-full bg-[#0F1722] border border-[#E2E4DF] rounded-lg overflow-hidden">
                {hasCustomCover && (
                  <img
                    src={activeImageUrl}
                    alt=""
                    aria-hidden="true"
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover blur-xl opacity-30 scale-110 pointer-events-none"
                  />
                )}
                <img
                  src={activeImageUrl}
                  alt={project.title}
                  referrerPolicy="no-referrer"
                  className={`relative z-10 w-full h-full ${
                    hasCustomCover ? 'object-contain p-3 sm:p-4' : 'object-cover'
                  }`}
                />
                <button
                  type="button"
                  onClick={() =>
                    setPreviewMedia({
                      id: project.id,
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
                  className="absolute bottom-4 right-4 z-20 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#172333]/90 hover:bg-[#172333] border border-white/15 rounded-lg shadow-sm transition-colors"
                >
                  <Eye className="w-4 h-4 text-[#F18A45]" />
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
                    className={`w-20 h-16 rounded-md overflow-hidden border bg-[#0F1722] transition-all ${
                      activeImageIndex === idx
                        ? 'border-[#172333] ring-2 ring-[#172333]/20'
                        : 'border-[#E2E4DF] opacity-75 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={imgUrl}
                      alt={`${project.title} frame ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Project Description & Creative Notes */}
          <section className="bg-white border border-[#E2E4DF] rounded-lg p-6 sm:p-8 space-y-4 shadow-[0_1px_2px_rgba(23,35,51,0.04)]">
            <h2 className="font-editorial text-xl font-semibold text-[#172333]">
              Project Overview
            </h2>
            <p className="text-sm sm:text-base text-[#6E7785] leading-relaxed">
              {project.description}
            </p>

            {project.tags && project.tags.length > 0 && (
              <div className="pt-4 border-t border-[#E2E4DF] flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[#6E7785]">
                <span className="font-semibold text-[#172333]">Keywords:</span>
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
          <div className="bg-white border border-[#E2E4DF] rounded-lg overflow-hidden shadow-[0_4px_16px_rgba(23,35,51,0.05)]">
            <div className="px-6 py-4 bg-[#172333] text-white flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wide">Project Summary</span>
              <span className="font-mono text-xs text-[#F18A45]">PORTFOLIO</span>
            </div>

            <div className="p-6 space-y-6">
              <div className="border-b border-[#E2E4DF] pb-4">
                <p className="text-xs text-[#6E7785]">{displayCategory}</p>
                <h2 className="text-lg font-semibold text-[#172333] mt-0.5">{project.title}</h2>
              </div>

              <dl className="space-y-3.5 text-xs">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-[#6E7785]">Category</dt>
                  <dd className="font-semibold text-[#172333] text-right">{displayCategory}</dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-[#6E7785]">Specifications</dt>
                  <dd className="font-semibold text-[#172333] text-right">
                    {project.metricsSummary || 'Studio Deliverable'}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-[#6E7785]">Studio</dt>
                  <dd className="font-semibold text-[#172333] text-right">
                    {settings.businessName || 'Prithvi Editify'}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-[#6E7785]">Creative Lead</dt>
                  <dd className="font-semibold text-[#172333] text-right">
                    {settings.ownerName || 'Shankar Baluragi'}
                  </dd>
                </div>
                {project.isSampleContent && (
                  <div className="pt-2 border-t border-[#E2E4DF] text-[11px] text-[#A96518]">
                    Note: This record is labeled as a studio demonstration sample.
                  </div>
                )}
              </dl>

              {project.projectUrl && (
                <div className="pt-2 border-t border-[#E2E4DF]">
                  <a
                    href={project.projectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-lg transition-colors"
                  >
                    <span>View Live External Link</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              <div className="pt-2 border-t border-[#E2E4DF] space-y-2.5">
                <Link
                  to={`/contact?service=${encodeURIComponent(displayCategory)}`}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg transition-colors"
                >
                  <span>Contact for a Project</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>

                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-semibold text-[#172333] rounded-lg transition-colors"
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
        <section className="pt-12 border-t border-[#E2E4DF] space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#6E7785]">More Studio Work</p>
              <h2 className="font-editorial text-2xl font-semibold text-[#172333] mt-1">
                Related Portfolio Projects
              </h2>
            </div>
            <Link
              to="/portfolio"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#172333] hover:text-[#F18A45] transition-colors"
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
  const primaryBg = custom.primaryColor || '#172333';
  const secondaryBg = custom.secondaryColor || '#24364A';
  const accentColor = custom.accentColor || '#F18A45';

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
          <p className="text-xs font-semibold text-[#6E7785] tracking-wide">{custom.aboutKicker}</p>
          <h1 className="font-editorial text-4xl font-semibold text-[#172333] leading-tight">
            {custom.aboutHeading}
          </h1>
          <p className="text-base text-[#6E7785] leading-relaxed">{custom.aboutParagraph1}</p>
          <p className="text-sm text-[#6E7785] leading-relaxed">{custom.aboutParagraph2}</p>
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
              className="px-5 py-2.5 text-sm font-semibold text-[#172333] bg-white border border-[#E2E4DF] hover:border-[#172333] rounded-lg transition-colors whitespace-nowrap"
            >
              {custom.aboutSecondaryCtaLabel || 'View Services & Pricing'}
            </Link>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="bg-white border border-[#E2E4DF] rounded-lg overflow-hidden shadow-[0_1px_2px_rgba(23,35,51,0.04)]">
            <img
              src={founderSrc}
              alt={custom.founderName || settings.ownerName || 'Shankar Baluragi'}
              referrerPolicy="no-referrer"
              className="w-full aspect-[4/3] object-cover"
            />
            <div className="p-6 space-y-2">
              <p className="text-sm font-semibold text-[#172333]">
                {custom.founderName || settings.ownerName || 'Shankar Baluragi'}
              </p>
              <p className="text-xs text-[#6E7785]">{custom.founderRole}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {custom.aboutPillars.map((pillar, idx) => (
          <div
            key={`${pillar.title}_${idx}`}
            className="bg-white border border-[#E2E4DF] rounded-lg p-6 shadow-[0_1px_2px_rgba(23,35,51,0.04)]"
          >
            <h2 className="text-base font-semibold text-[#172333]">{pillar.title}</h2>
            <p className="text-sm text-[#6E7785] mt-2 leading-relaxed">{pillar.desc}</p>
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
  const accentColor = custom.accentColor || '#F18A45';

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        <div className="lg:col-span-5 space-y-6">
          <div>
            <p className="text-xs font-semibold text-[#6E7785] tracking-wide">
              {custom.contactKicker}
            </p>
            <h1 className="font-editorial text-4xl font-semibold text-[#172333] mt-2">
              {custom.contactHeading}
            </h1>
            <p className="text-sm text-[#6E7785] mt-3 leading-relaxed">
              {custom.contactDescription}
            </p>
          </div>

          <div className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-4 shadow-[0_1px_2px_rgba(23,35,51,0.04)]">
            <h2 className="text-base font-semibold text-[#172333]">{custom.whatsappCardTitle}</h2>
            <p className="text-xs text-[#6E7785] leading-relaxed">{custom.whatsappCardDesc}</p>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#172333] rounded-lg transition-colors whitespace-nowrap shrink-0"
              style={{ backgroundColor: accentColor }}
            >
              <MessageSquare className="w-4 h-4" />
              <span>{custom.whatsappButtonLabel || 'Discuss on WhatsApp'}</span>
            </a>
            <p className="text-[11px] text-[#6E7785]">
              Note: Clicking opens WhatsApp; you confirm and send the message in your WhatsApp app.
            </p>
          </div>

          <div className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-2 text-xs text-[#6E7785] shadow-[0_1px_2px_rgba(23,35,51,0.04)]">
            <p className="font-semibold text-[#172333]">Studio Information</p>
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
      <h1 className="font-editorial text-3xl font-semibold text-[#172333]">Privacy Policy</h1>
      <p className="text-xs text-[#6E7785]">
        Effective Date: {custom.legalEffectiveDate || 'October 2026'} ·{' '}
        {settings.businessName || 'Prithvi Editify'} ({settings.ownerName || 'Shankar Baluragi'})
      </p>
      <div className="bg-white border border-[#E2E4DF] rounded-lg p-8 space-y-4 text-sm text-[#172333] leading-relaxed">
        {custom.privacySections.map((sec, idx) => (
          <React.Fragment key={`${sec.heading}_${idx}`}>
            <h2 className="text-base font-semibold">{sec.heading}</h2>
            <p className="text-[#6E7785]">{sec.body}</p>
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
      <h1 className="font-editorial text-3xl font-semibold text-[#172333]">
        Terms and Conditions
      </h1>
      <p className="text-xs text-[#6E7785]">
        Effective Date: {custom.legalEffectiveDate || 'October 2026'} ·{' '}
        {settings.businessName || 'Prithvi Editify'} ({settings.ownerName || 'Shankar Baluragi'})
      </p>
      <div className="bg-white border border-[#E2E4DF] rounded-lg p-8 space-y-4 text-sm text-[#172333] leading-relaxed">
        {custom.termsSections.map((sec, idx) => (
          <React.Fragment key={`${sec.heading}_${idx}`}>
            <h2 className="text-base font-semibold">{sec.heading}</h2>
            <p className="text-[#6E7785]">{sec.body}</p>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export const NotFoundPage: React.FC = () => (
  <div className="max-w-xl mx-auto px-6 py-24 text-center space-y-5">
    <p className="font-mono text-xs text-[#F18A45] font-semibold">ERROR 404</p>
    <h1 className="font-editorial text-3xl font-semibold text-[#172333]">Page not found</h1>
    <p className="text-sm text-[#6E7785]">
      The page you are looking for does not exist or has been moved.
    </p>
    <div className="pt-2 flex items-center justify-center gap-3">
      <Link
        to="/"
        className="px-5 py-2.5 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg transition-colors"
      >
        Return Home
      </Link>
      <Link
        to="/contact"
        className="px-5 py-2.5 text-xs font-semibold text-[#172333] bg-white border border-[#E2E4DF] hover:border-[#172333] rounded-lg transition-colors"
      >
        Contact Studio
      </Link>
    </div>
  </div>
);
