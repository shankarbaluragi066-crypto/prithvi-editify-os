import React, { useEffect, useState } from 'react';
import { Link, useSearchParams, useOutletContext } from 'react-router-dom';
import {
  ArrowRight,
  Layers,
  Film,
  Sparkles,
  CheckCircle2,
  MessageSquare,
  ExternalLink,
  Clock,
  FileCheck,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import { fetchPublishedServices, fetchPublishedPortfolio } from '../services/crmService';
import {
  SEED_SERVICES,
  SEED_PORTFOLIO,
  DEFAULT_SITE_CUSTOMIZATION,
  mergeSiteCustomization,
  createStudioArtworkDataUri,
} from '../utils/seedData';
import { ServiceItem, PortfolioItem, PublicSettings } from '../types/crm';
import { InquiryForm } from '../components/InquiryForm';
import { MediaPreviewModal, PreviewableMediaItem } from '../components/MediaPreviewModal';
import { buildWhatsAppLink } from '../utils/formatters';

interface OutletCtx {
  settings: PublicSettings;
}

const PORTFOLIO_CATEGORIES = [
  'All',
  'Graphic Design',
  'Social Media',
  'YouTube Thumbnails',
  'Video Editing',
  'Instagram Reels',
  'Promotional Ads',
  'Branding',
] as const;

// ============================================================================
// 1. HOME PAGE
// ============================================================================
export const HomePage: React.FC = () => {
  const { settings } = useOutletContext<OutletCtx>();
  const custom = mergeSiteCustomization(settings.siteCustomization || DEFAULT_SITE_CUSTOMIZATION);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([fetchPublishedServices(), fetchPublishedPortfolio()])
      .then(([srv, port]) => {
        if (!active) return;
        setServices(
          srv.length > 0
            ? srv
            : SEED_SERVICES.map((s, idx) => ({ ...s, id: `seed_srv_${idx}` }))
        );
        setPortfolio(
          port.length > 0
            ? port
            : SEED_PORTFOLIO.map((p, idx) => ({ ...p, id: `seed_port_${idx}` }))
        );
      })
      .catch(() => {
        if (!active) return;
        setServices(SEED_SERVICES.map((s, idx) => ({ ...s, id: `seed_srv_${idx}` })));
        setPortfolio(SEED_PORTFOLIO.map((p, idx) => ({ ...p, id: `seed_port_${idx}` })));
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.slice(0, 6).map((srv, index) => (
              <div
                key={srv.id}
                className="bg-white border border-[#E2E4DF] rounded-lg p-6 flex flex-col justify-between shadow-[0_1px_2px_rgba(23,35,51,0.04)] hover:border-[#172333]/60 hover:shadow-[0_6px_20px_rgba(23,35,51,0.06)] transition-all duration-200"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-[#6E7785] mb-3">
                    <span>
                      {String(index + 1).padStart(2, '0')}. {srv.category}
                    </span>
                    <span>·</span>
                    <span>{srv.turnaroundTime || '24–72 hours'}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-[#172333]">{srv.title}</h3>
                  <p className="text-sm text-[#6E7785] mt-2 leading-relaxed">{srv.description}</p>
                </div>

                <div className="mt-6 pt-4 border-t border-[#E2E4DF] flex items-center justify-between gap-4">
                  <div>
                    <span className="block text-[11px] text-[#6E7785]">
                      {srv.isCustomQuote ? 'Scoped Quote' : 'Starting from'}
                    </span>
                    <span className="font-mono text-base font-semibold text-[#172333] tabular-nums">
                      {srv.priceDisplay}
                    </span>
                  </div>
                  <Link
                    to={`/contact?service=${encodeURIComponent(srv.title)}`}
                    className="px-3.5 py-2 text-xs font-semibold text-[#172333] bg-[#F5F5F1] hover:bg-[#172333] hover:text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Request Brief
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* PORTFOLIO PREVIEW SECTION */}
      {settings.portfolioVisible !== false && (
        <section className="bg-white border-y border-[#E2E4DF] py-20">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
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

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-80 bg-[#F5F5F1] rounded-lg animate-pulse border border-[#E2E4DF]"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {portfolio.slice(0, 3).map((item) => (
                  <article
                    key={item.id}
                    className="group bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg overflow-hidden flex flex-col justify-between shadow-[0_1px_2px_rgba(23,35,51,0.04)] hover:border-[#172333]/60 hover:shadow-[0_6px_20px_rgba(23,35,51,0.06)] transition-all duration-200"
                  >
                    <div>
                      <div className="aspect-[4/3] bg-[#172333] overflow-hidden border-b border-[#E2E4DF]">
                        <img
                          src={
                            item.coverImage ||
                            createStudioArtworkDataUri(
                              item.title,
                              item.category,
                              accentColor,
                              primaryBg,
                              secondaryBg
                            )
                          }
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                        />
                      </div>
                      <div className="p-6">
                        <div className="flex items-center gap-2 text-xs text-[#6E7785] mb-2">
                          <span>{item.category}</span>
                          {item.isSampleContent && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#A96518] font-medium">
                                Demonstration Sample
                              </span>
                            </>
                          )}
                        </div>
                        <h3 className="text-lg font-semibold text-[#172333]">{item.title}</h3>
                        <p className="text-sm text-[#6E7785] mt-2 line-clamp-3 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <div className="px-6 pb-5 pt-3 border-t border-[#E2E4DF] flex items-center justify-between text-xs text-[#6E7785]">
                      <span>{item.metricsSummary || 'Studio Deliverable'}</span>
                      <Link
                        to="/portfolio"
                        className="font-semibold text-[#172333] hover:text-[#F18A45] whitespace-nowrap transition-colors"
                      >
                        Inspect →
                      </Link>
                    </div>
                  </article>
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
    </div>
  );
};

// ============================================================================
// 2. SERVICES & PRICING PAGE
// ============================================================================
export const ServicesPage: React.FC = () => {
  const { settings } = useOutletContext<OutletCtx>();
  const custom = mergeSiteCustomization(settings.siteCustomization || DEFAULT_SITE_CUSTOMIZATION);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [previewService, setPreviewService] = useState<PreviewableMediaItem | null>(null);

  useEffect(() => {
    fetchPublishedServices()
      .then((list) => {
        setServices(
          list.length > 0
            ? list
            : SEED_SERVICES.map((s, idx) => ({ ...s, id: `seed_srv_${idx}` }))
        );
      })
      .catch(() => {
        setServices(SEED_SERVICES.map((s, idx) => ({ ...s, id: `seed_srv_${idx}` })));
      })
      .finally(() => setLoading(false));
  }, []);

  const categories = ['All', ...Array.from(new Set(services.map((s) => s.category)))];
  const filtered =
    selectedCategory === 'All'
      ? services
      : services.filter((s) => s.category === selectedCategory);

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-16">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold text-[#6E7785] tracking-wide">
          {custom.servicesPageKicker}
        </p>
        <h1 className="font-editorial text-4xl font-semibold text-[#172333] mt-2">
          {custom.servicesPageTitle}
        </h1>
        <p className="text-base text-[#6E7785] mt-3 leading-relaxed">
          {custom.servicesPageDescription}
        </p>
      </div>

      {/* Interactive Category Filter Controls */}
      <div className="mt-8 flex flex-wrap items-center gap-1.5 p-1.5 bg-[#E2E4DF]/60 rounded-lg w-fit">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              selectedCategory === cat
                ? 'bg-white text-[#172333] shadow-sm font-semibold'
                : 'text-[#6E7785] hover:text-[#172333]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-56 bg-white border border-[#E2E4DF] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
          {filtered.map((srv, idx) => (
            <div
              key={srv.id}
              className="bg-white border border-[#E2E4DF] rounded-lg p-6 sm:p-8 flex flex-col justify-between shadow-[0_1px_2px_rgba(23,35,51,0.04)] hover:border-[#172333]/60 hover:shadow-[0_6px_20px_rgba(23,35,51,0.06)] transition-all duration-200"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-[#6E7785] mb-3">
                  <span>
                    {String(idx + 1).padStart(2, '0')}. {srv.category}
                  </span>
                  <span>Turnaround: {srv.turnaroundTime || '2–4 business days'}</span>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-xl font-semibold text-[#172333]">{srv.title}</h2>
                  <span className="font-mono text-lg font-semibold text-[#172333] tabular-nums shrink-0">
                    {srv.priceDisplay}
                  </span>
                </div>
                <p className="text-sm text-[#6E7785] mt-3 leading-relaxed">{srv.description}</p>
                {srv.deliverablesSummary && (
                  <p className="text-xs text-[#172333] mt-4 pt-4 border-t border-[#E2E4DF]">
                    <span className="font-semibold">Included Deliverables:</span> {srv.deliverablesSummary}
                  </p>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-[#E2E4DF] flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-[#6E7785]">
                  {srv.isCustomQuote ? 'Scoped to your project brief' : `Starting rate per ${srv.pricingUnit}`}
                </span>
                <div className="flex items-center gap-2">
                  {(srv.imageUrl || srv.videoPreviewUrl) && (
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewService({
                          id: srv.id,
                          title: srv.title,
                          url:
                            srv.imageUrl ||
                            createStudioArtworkDataUri(srv.title, srv.category, '#F18A45'),
                          videoUrl: srv.videoPreviewUrl || undefined,
                          description: `${srv.description} — Included: ${srv.deliverablesSummary}`,
                          categoryLabel: `${srv.category} · ${srv.priceDisplay}`,
                          storageBucket: 'service-media',
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview Sample</span>
                    </button>
                  )}
                  <Link
                    to={`/contact?service=${encodeURIComponent(srv.title)}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Inquire</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <MediaPreviewModal item={previewService} onClose={() => setPreviewService(null)} />
    </div>
  );
};

// ============================================================================
// 3. PORTFOLIO PAGE
// ============================================================================
export const PortfolioPage: React.FC = () => {
  const { settings } = useOutletContext<OutletCtx>();
  const custom = mergeSiteCustomization(settings.siteCustomization || DEFAULT_SITE_CUSTOMIZATION);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [category, setCategory] = useState<string>('All');
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublishedPortfolio()
      .then((list) => {
        setItems(
          list.length > 0
            ? list
            : SEED_PORTFOLIO.map((p, idx) => ({ ...p, id: `seed_port_${idx}` }))
        );
      })
      .catch(() => {
        setItems(SEED_PORTFOLIO.map((p, idx) => ({ ...p, id: `seed_port_${idx}` })));
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered =
    category === 'All' ? items : items.filter((item) => item.category === category);

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-16">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold text-[#6E7785] tracking-wide">
          {custom.portfolioPageKicker}
        </p>
        <h1 className="font-editorial text-4xl font-semibold text-[#172333] mt-2">
          {custom.portfolioPageTitle}
        </h1>
        <p className="text-base text-[#6E7785] mt-3 leading-relaxed">
          {custom.portfolioPageDescription}
        </p>
      </div>

      {/* Category Filter Buttons */}
      <div className="mt-8 flex flex-wrap items-center gap-1.5 p-1.5 bg-[#E2E4DF]/60 rounded-lg w-fit">
        {PORTFOLIO_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              category === cat
                ? 'bg-white text-[#172333] shadow-sm font-semibold'
                : 'text-[#6E7785] hover:text-[#172333]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-80 bg-white border border-[#E2E4DF] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-10 bg-white border border-[#E2E4DF] rounded-lg p-12 text-center shadow-[0_1px_2px_rgba(23,35,51,0.04)]">
          <p className="text-base font-semibold text-[#172333]">No portfolio items in "{category}" yet</p>
          <p className="text-sm text-[#6E7785] mt-1">Select another category or request a custom sample brief.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="group bg-white border border-[#E2E4DF] rounded-lg overflow-hidden flex flex-col justify-between shadow-[0_1px_2px_rgba(23,35,51,0.04)] hover:border-[#172333]/60 hover:shadow-[0_6px_20px_rgba(23,35,51,0.06)] transition-all duration-200"
            >
              <div>
                <div className="aspect-[4/3] bg-[#172333] overflow-hidden border-b border-[#E2E4DF]">
                  <img
                    src={
                      item.coverImage ||
                      createStudioArtworkDataUri(item.title, item.category, '#F18A45')
                    }
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  />
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-2 text-xs text-[#6E7785] mb-2">
                    <span>{item.category}</span>
                    {item.isSampleContent && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#A96518] font-medium">Demonstration Sample</span>
                      </>
                    )}
                  </div>
                  <h2 className="text-lg font-semibold text-[#172333]">{item.title}</h2>
                  <p className="text-sm text-[#6E7785] mt-2 leading-relaxed">{item.description}</p>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-[#E2E4DF] flex items-center justify-between gap-4">
                <span className="text-xs text-[#6E7785] truncate">
                  {item.metricsSummary || 'Prithvi Editify Studio'}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedItem(item)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#172333] hover:text-[#F18A45] whitespace-nowrap shrink-0 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Interactive Preview →</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Interactive Portfolio Media Lightbox (Supports Zoomable Images, Video Reels & PDFs) */}
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
                    '#F18A45'
                  ),
                videoUrl: selectedItem.videoUrl || undefined,
                description: selectedItem.description,
                tags: selectedItem.tags,
                categoryLabel: `${selectedItem.category} · ${
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
            createStudioArtworkDataUri(p.title, p.category, '#F18A45'),
          videoUrl: p.videoUrl || undefined,
          description: p.description,
          tags: p.tags,
          categoryLabel: `${p.category} · ${p.metricsSummary || 'Studio Deliverable'}${
            p.isSampleContent ? ' (Demonstration Sample)' : ''
          }`,
          storageBucket: 'portfolio-media',
        }))}
        onClose={() => setSelectedItem(null)}
        onSelectItem={(next) => {
          const found = filtered.find((p) => p.id === next.id) || null;
          setSelectedItem(found);
        }}
      />
    </div>
  );
};

// ============================================================================
// 4. ABOUT PAGE
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
// 5. CONTACT PAGE
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
// 6. PRIVACY POLICY, TERMS & NOT FOUND PAGES
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
