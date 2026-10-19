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
import { SEED_SERVICES, SEED_PORTFOLIO, createStudioArtworkDataUri } from '../utils/seedData';
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

  return (
    <div>
      {/* HERO SECTION */}
      <section className="bg-[#172333] text-[#F5F5F1] border-b border-[#24364A]">
        <div className="max-w-[1200px] mx-auto px-6 py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
            {/* Left Copy Column */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-8">
              <div className="space-y-6">
                <p className="text-xs font-medium text-[#F18A45] tracking-wide">
                  Prithvi Editify · Independent Design & Video Studio
                </p>
                <h1
                  className="font-editorial font-semibold text-white tracking-tight leading-[1.08]"
                  style={{ fontSize: 'clamp(2.5rem, 4.2vw, 3.75rem)', textWrap: 'balance' }}
                >
                  Creative work. Clear process.
                </h1>
                <p className="text-base sm:text-lg text-[#D0D5DD] max-w-xl leading-relaxed">
                  Professional design and video editing for brands, creators, and growing businesses.
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-4">
                  <Link
                    to="/contact"
                    className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-[#172333] bg-[#F18A45] hover:bg-[#e07934] rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Start a Project</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    to="/portfolio"
                    className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-[#24364A] hover:bg-[#2F455E] border border-white/10 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Explore Portfolio</span>
                  </Link>
                </div>

                <div className="pt-4 border-t border-[#24364A] flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#9BA3B0]">
                  <span>Graphic Design</span>
                  <span aria-hidden="true">·</span>
                  <span>YouTube Thumbnails</span>
                  <span aria-hidden="true">·</span>
                  <span>Social Media Content</span>
                  <span aria-hidden="true">·</span>
                  <span>Video & Reels Editing</span>
                </div>
              </div>
            </div>

            {/* Right Visual Studio Composition */}
            <div className="lg:col-span-5 flex">
              <div className="w-full bg-[#24364A] border border-white/10 rounded-lg p-6 flex flex-col justify-between space-y-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="text-xs font-semibold text-white">Studio Production Architecture</p>
                    <p className="text-[11px] text-[#9BA3B0] mt-0.5">
                      Brief → Scope & INR Quote → Review Portal → Master Delivery
                    </p>
                  </div>
                  <span className="font-mono text-xs text-[#F18A45]">INR PRICING</span>
                </div>

                {/* Original Architectural SVG Composition */}
                <div className="relative overflow-hidden rounded-lg border border-white/10 bg-[#172333]">
                  <img
                    src={createStudioArtworkDataUri(
                      'Prithvi Editify',
                      'Design Grids · Thumbnails · Video Timelines',
                      '#F18A45'
                    )}
                    alt="Prithvi Editify creative studio composition"
                    referrerPolicy="no-referrer"
                    className="w-full h-56 object-cover"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="bg-[#172333] border border-white/10 rounded-lg p-3.5">
                    <p className="text-xs text-[#9BA3B0]">Starting Design Rates</p>
                    <p className="text-lg font-mono font-semibold text-white mt-1 tabular-nums">
                      ₹400 – ₹750
                    </p>
                    <p className="text-[11px] text-[#9BA3B0] mt-0.5">Per graphic / creative</p>
                  </div>
                  <div className="bg-[#172333] border border-white/10 rounded-lg p-3.5">
                    <p className="text-xs text-[#9BA3B0]">Client Workspace</p>
                    <p className="text-lg font-semibold text-white mt-1">Live Portal</p>
                    <p className="text-[11px] text-[#9BA3B0] mt-0.5">Files, timeline & invoices</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES PREVIEW SECTION */}
      <section className="max-w-[1200px] mx-auto px-6 py-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <p className="text-xs font-semibold text-[#6E7785] tracking-wide">01. Capabilities & Starting Rates</p>
            <h2 className="font-editorial text-3xl font-semibold text-[#172333] mt-2">
              Services built for clarity and visual impact
            </h2>
          </div>
          <Link
            to="/services"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#172333] hover:text-[#F18A45] transition-colors whitespace-nowrap shrink-0"
          >
            <span>View Full Rate Card (INR)</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.slice(0, 6).map((srv, index) => (
            <div
              key={srv.id}
              className="bg-white border border-[#E2E4DF] rounded-lg p-6 flex flex-col justify-between hover:border-[#172333] transition-colors"
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

      {/* PORTFOLIO PREVIEW SECTION */}
      {settings.portfolioVisible !== false && (
        <section className="bg-white border-y border-[#E2E4DF] py-20">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
              <div>
                <p className="text-xs font-semibold text-[#6E7785] tracking-wide">02. Selected Studio Work</p>
                <h2 className="font-editorial text-3xl font-semibold text-[#172333] mt-2">
                  Design systems, packaging, and editorial cuts
                </h2>
              </div>
              <Link
                to="/portfolio"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#172333] hover:text-[#F18A45] transition-colors whitespace-nowrap shrink-0"
              >
                <span>Browse Complete Portfolio</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-80 bg-[#F5F5F1] rounded-lg animate-pulse border border-[#E2E4DF]" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {portfolio.slice(0, 3).map((item) => (
                  <article
                    key={item.id}
                    className="bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg overflow-hidden flex flex-col justify-between"
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
                          className="w-full h-full object-cover"
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
                        className="font-semibold text-[#172333] hover:text-[#F18A45] whitespace-nowrap"
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
      <section className="max-w-[1200px] mx-auto px-6 py-20">
        <div className="max-w-2xl mb-12">
          <p className="text-xs font-semibold text-[#6E7785] tracking-wide">03. Studio Workflow</p>
          <h2 className="font-editorial text-3xl font-semibold text-[#172333] mt-2">
            A structured four-step process from brief to final files
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              step: '01. Share your brief',
              desc: 'Submit your project requirements, target platform, references, and preferred deadline through our inquiry form.',
            },
            {
              step: '02. Confirm scope & quote',
              desc: 'Receive a clear written scope, timeline, and transparent INR quote before production begins.',
            },
            {
              step: '03. Create and review',
              desc: 'Track progress inside your private Client Portal, view design previews, and leave structured feedback.',
            },
            {
              step: '04. Approve & receive files',
              desc: 'Approve final deliverables, settle the invoice balance, and download high-resolution master files.',
            },
          ].map((p) => (
            <div key={p.step} className="bg-white border border-[#E2E4DF] rounded-lg p-6">
              <h3 className="text-base font-semibold text-[#172333]">{p.step}</h3>
              <p className="text-sm text-[#6E7785] mt-2.5 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TRUST SECTION (No fake testimonials or invented metrics) */}
      <section className="bg-[#172333] text-[#F5F5F1] py-20 border-y border-[#24364A]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-semibold text-[#F18A45] tracking-wide">04. Why Work With Prithvi Editify</p>
            <h2 className="font-editorial text-3xl font-semibold text-white mt-2">
              Built on clear communication and organised delivery
            </h2>
            <p className="text-sm text-[#9BA3B0] mt-3 leading-relaxed">
              Every project is managed through a dedicated client workspace so briefs, revision notes, deliverables, and invoices never get lost in scattered chat threads.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#24364A] border border-white/10 rounded-lg p-6">
              <Clock className="w-5 h-5 text-[#F18A45] mb-3" />
              <h3 className="text-base font-semibold text-white">Organised Project Tracking</h3>
              <p className="text-sm text-[#D0D5DD] mt-2 leading-relaxed">
                Clients log in to see exact project statuses, milestone checklists, and expected delivery dates in real time.
              </p>
            </div>
            <div className="bg-[#24364A] border border-white/10 rounded-lg p-6">
              <FileCheck className="w-5 h-5 text-[#F18A45] mb-3" />
              <h3 className="text-base font-semibold text-white">Transparent INR Pricing</h3>
              <p className="text-sm text-[#D0D5DD] mt-2 leading-relaxed">
                Published starting rates for standard design assets and itemised INR invoices for custom video editing scopes.
              </p>
            </div>
            <div className="bg-[#24364A] border border-white/10 rounded-lg p-6">
              <ShieldCheck className="w-5 h-5 text-[#F18A45] mb-3" />
              <h3 className="text-base font-semibold text-white">Protected Deliverable Access</h3>
              <p className="text-sm text-[#D0D5DD] mt-2 leading-relaxed">
                Reference files, draft previews, and final master exports are privately scoped to your authenticated client account.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT / INQUIRY SECTION */}
      <section className="max-w-[1200px] mx-auto px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5 space-y-6">
            <p className="text-xs font-semibold text-[#6E7785] tracking-wide">05. Start a Project</p>
            <h2 className="font-editorial text-3xl font-semibold text-[#172333]">
              Share your project brief with Shankar Baluragi
            </h2>
            <p className="text-sm text-[#6E7785] leading-relaxed">
              Fill out the project inquiry form with your required deliverables, timeline, and budget range. You can also initiate a direct conversation on WhatsApp.
            </p>

            <div className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-4">
              <h3 className="text-sm font-semibold text-[#172333]">Direct Studio Contact</h3>
              <div className="space-y-2 text-xs text-[#6E7785]">
                <p>
                  <span className="font-semibold text-[#172333]">Studio Owner:</span>{' '}
                  {settings.ownerName || 'Shankar Baluragi'}
                </p>
                {settings.businessEmail && (
                  <p>
                    <span className="font-semibold text-[#172333]">Email:</span> {settings.businessEmail}
                  </p>
                )}
              </div>
              <div className="pt-2">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#172333] bg-[#F18A45] hover:bg-[#e07934] rounded-lg transition-colors whitespace-nowrap shrink-0"
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
            <InquiryForm />
          </div>
        </div>
      </section>
    </div>
  );
};

// ============================================================================
// 2. SERVICES & PRICING PAGE
// ============================================================================
export const ServicesPage: React.FC = () => {
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
        <p className="text-xs font-semibold text-[#6E7785] tracking-wide">Services & Starting Rates (INR)</p>
        <h1 className="font-editorial text-4xl font-semibold text-[#172333] mt-2">
          Transparent starting prices for creative production
        </h1>
        <p className="text-base text-[#6E7785] mt-3 leading-relaxed">
          All listed rates are starting prices in Indian Rupees (₹). Final quotes depend on complexity, footage duration, revision rounds, and turnaround urgency.
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
              className="bg-white border border-[#E2E4DF] rounded-lg p-6 sm:p-8 flex flex-col justify-between"
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
        <p className="text-xs font-semibold text-[#6E7785] tracking-wide">Studio Archive & Capabilities</p>
        <h1 className="font-editorial text-4xl font-semibold text-[#172333] mt-2">
          Creative Portfolio
        </h1>
        <p className="text-base text-[#6E7785] mt-3 leading-relaxed">
          Explore graphic design, social media creatives, YouTube thumbnails, and video editing layouts. Sample records are explicitly labeled as demonstration content until replaced in the Admin Console.
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
        <div className="mt-10 bg-white border border-[#E2E4DF] rounded-lg p-12 text-center">
          <p className="text-base font-semibold text-[#172333]">No portfolio items in "{category}" yet</p>
          <p className="text-sm text-[#6E7785] mt-1">Select another category or request a custom sample brief.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="bg-white border border-[#E2E4DF] rounded-lg overflow-hidden flex flex-col justify-between hover:border-[#172333] transition-colors"
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
                    className="w-full h-full object-cover"
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
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#172333] hover:text-[#F18A45] whitespace-nowrap shrink-0"
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

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-16 space-y-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-5">
          <p className="text-xs font-semibold text-[#6E7785] tracking-wide">About the Studio</p>
          <h1 className="font-editorial text-4xl font-semibold text-[#172333] leading-tight">
            Independent creative direction by {settings.ownerName || 'Shankar Baluragi'}
          </h1>
          <p className="text-base text-[#6E7785] leading-relaxed">
            Prithvi Editify helps businesses, creators, brands, and organisations communicate through professional graphic design, social media creatives, YouTube thumbnails, video editing, and promotional content.
          </p>
          <p className="text-sm text-[#6E7785] leading-relaxed">
            Instead of treating creative production like an unpredictable freelance exchange, Prithvi Editify combines studio-grade design craft with a dedicated client portal. Every client gets clear scope documentation, milestone tracking, structured revision workflows, and itemised INR billing.
          </p>
          <div className="pt-2 flex flex-wrap gap-4">
            <Link
              to="/contact"
              className="px-5 py-2.5 text-sm font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg transition-colors whitespace-nowrap"
            >
              Start a Project
            </Link>
            <Link
              to="/services"
              className="px-5 py-2.5 text-sm font-semibold text-[#172333] bg-white border border-[#E2E4DF] hover:border-[#172333] rounded-lg transition-colors whitespace-nowrap"
            >
              View Services & Pricing
            </Link>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="bg-white border border-[#E2E4DF] rounded-lg overflow-hidden">
            <img
              src={createStudioArtworkDataUri(
                'Shankar Baluragi',
                'Founder & Creative Director · Prithvi Editify',
                '#F18A45'
              )}
              alt="Shankar Baluragi Studio"
              referrerPolicy="no-referrer"
              className="w-full aspect-[4/3] object-cover"
            />
            <div className="p-6 space-y-2">
              <p className="text-sm font-semibold text-[#172333]">
                {settings.ownerName || 'Shankar Baluragi'}
              </p>
              <p className="text-xs text-[#6E7785]">
                Founder · Graphic Design, Video Editing & Social Media Content Systems
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-[#E2E4DF] rounded-lg p-6">
          <h2 className="text-base font-semibold text-[#172333]">01. Design & Editorial Restraint</h2>
          <p className="text-sm text-[#6E7785] mt-2 leading-relaxed">
            Every graphic, thumbnail, and video frame is structured around visual hierarchy, readability, and brand recognition rather than generic templates.
          </p>
        </div>
        <div className="bg-white border border-[#E2E4DF] rounded-lg p-6">
          <h2 className="text-base font-semibold text-[#172333]">02. Dedicated Client Portal</h2>
          <p className="text-sm text-[#6E7785] mt-2 leading-relaxed">
            Review drafts, track project progress percentages, download final files, and access printable INR invoices in one private workspace.
          </p>
        </div>
        <div className="bg-white border border-[#E2E4DF] rounded-lg p-6">
          <h2 className="text-base font-semibold text-[#172333]">03. Direct Studio Accountability</h2>
          <p className="text-sm text-[#6E7785] mt-2 leading-relaxed">
            Work directly with Shankar Baluragi from initial brief to final file delivery with clear turnaround commitments.
          </p>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 5. CONTACT PAGE
// ============================================================================
export const ContactPage: React.FC = () => {
  const { settings } = useOutletContext<OutletCtx>();
  const [searchParams] = useSearchParams();
  const preselectedService = searchParams.get('service') || undefined;
  const whatsappUrl = buildWhatsAppLink(settings.whatsappNumber, settings.whatsappDefaultMessage);

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        <div className="lg:col-span-5 space-y-6">
          <div>
            <p className="text-xs font-semibold text-[#6E7785] tracking-wide">Project Inquiry & Contact</p>
            <h1 className="font-editorial text-4xl font-semibold text-[#172333] mt-2">
              Let’s scope your next creative project
            </h1>
            <p className="text-sm text-[#6E7785] mt-3 leading-relaxed">
              Complete the project inquiry form to share your deliverables, timeline, and budget range. All inquiries are saved securely to our studio CRM.
            </p>
          </div>

          <div className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-4">
            <h2 className="text-base font-semibold text-[#172333]">WhatsApp Direct Chat</h2>
            <p className="text-xs text-[#6E7785] leading-relaxed">
              Prefer a quick preliminary discussion on WhatsApp? Click below to open WhatsApp with a prefilled project message.
            </p>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#172333] bg-[#F18A45] hover:bg-[#e07934] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Discuss on WhatsApp</span>
            </a>
            <p className="text-[11px] text-[#6E7785]">
              Note: Clicking opens WhatsApp; you confirm and send the message in your WhatsApp app.
            </p>
          </div>

          <div className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-2 text-xs text-[#6E7785]">
            <p className="font-semibold text-[#172333]">Studio Information</p>
            <p>Business: {settings.businessName || 'Prithvi Editify'}</p>
            <p>Owner: {settings.ownerName || 'Shankar Baluragi'}</p>
            {settings.businessEmail && <p>Email: {settings.businessEmail}</p>}
            {settings.businessAddress && <p>Location: {settings.businessAddress}</p>}
          </div>
        </div>

        <div className="lg:col-span-7">
          <InquiryForm defaultService={preselectedService} />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 6. PRIVACY POLICY, TERMS & NOT FOUND PAGES
// ============================================================================
export const PrivacyPolicyPage: React.FC = () => (
  <div className="max-w-3xl mx-auto px-6 py-16 space-y-6">
    <h1 className="font-editorial text-3xl font-semibold text-[#172333]">Privacy Policy</h1>
    <p className="text-xs text-[#6E7785]">Effective Date: October 2026 · Prithvi Editify (Shankar Baluragi)</p>
    <div className="bg-white border border-[#E2E4DF] rounded-lg p-8 space-y-4 text-sm text-[#172333] leading-relaxed">
      <h2 className="text-base font-semibold">1. Information We Collect</h2>
      <p className="text-[#6E7785]">
        When you submit a project inquiry or access the Prithvi Editify Client Portal, we collect your name, email address, phone/WhatsApp number, company or brand name, project brief details, and any reference files you upload.
      </p>
      <h2 className="text-base font-semibold">2. How Your Data Is Used</h2>
      <p className="text-[#6E7785]">
        Your information is used strictly to evaluate project inquiries, prepare scope quotes, deliver creative files, issue invoices, and communicate project updates. We never sell or rent client data to third parties.
      </p>
      <h2 className="text-base font-semibold">3. Data Isolation & Security</h2>
      <p className="text-[#6E7785]">
        All records are stored in Supabase PostgreSQL and Supabase Storage protected by Row Level Security (RLS) policies. Clients can only access their own projects, deliverables, and invoices.
      </p>
      <h2 className="text-base font-semibold">4. Data Retention & Deletion</h2>
      <p className="text-[#6E7785]">
        You may request correction or deletion of your inquiry or client profile data at any time by contacting Shankar Baluragi through the studio contact page.
      </p>
    </div>
  </div>
);

export const TermsPage: React.FC = () => (
  <div className="max-w-3xl mx-auto px-6 py-16 space-y-6">
    <h1 className="font-editorial text-3xl font-semibold text-[#172333]">Terms and Conditions</h1>
    <p className="text-xs text-[#6E7785]">Effective Date: October 2026 · Prithvi Editify (Shankar Baluragi)</p>
    <div className="bg-white border border-[#E2E4DF] rounded-lg p-8 space-y-4 text-sm text-[#172333] leading-relaxed">
      <h2 className="text-base font-semibold">1. Scope & Starting Prices</h2>
      <p className="text-[#6E7785]">
        Prices displayed on the website (in INR) are starting estimates. Every project is confirmed with a written brief and agreed budget before production begins.
      </p>
      <h2 className="text-base font-semibold">2. Revisions & Approvals</h2>
      <p className="text-[#6E7785]">
        Clients can review drafts and request revisions directly inside the Client Portal. Additional revisions outside the agreed project brief may incur an agreed supplemental fee.
      </p>
      <h2 className="text-base font-semibold">3. Invoicing & Deliverable Usage Rights</h2>
      <p className="text-[#6E7785]">
        Final master deliverables are released for commercial client use upon settlement of the corresponding invoice balance, unless otherwise specified in the written project agreement.
      </p>
    </div>
  </div>
);

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
