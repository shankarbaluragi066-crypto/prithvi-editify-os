import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Menu, X, MessageSquare, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchPublicSettings } from '../services/crmService';
import {
  DEFAULT_PUBLIC_SETTINGS,
  DEFAULT_SITE_CUSTOMIZATION,
  DEFAULT_STUDIO_LOGO_URL,
  mergeSiteCustomization,
} from '../utils/seedData';
import { PublicSettings } from '../types/crm';
import { buildWhatsAppLink } from '../utils/formatters';

export const PublicLayout: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settings, setSettings] = useState<PublicSettings>(DEFAULT_PUBLIC_SETTINGS);

  useEffect(() => {
    fetchPublicSettings().then(setSettings).catch(() => {});

    const handleSettingsUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<PublicSettings>;
      if (customEvent.detail) {
        setSettings(customEvent.detail);
      } else {
        fetchPublicSettings().then(setSettings).catch(() => {});
      }
    };

    window.addEventListener('pe-public-settings-updated', handleSettingsUpdate);
    return () => {
      window.removeEventListener('pe-public-settings-updated', handleSettingsUpdate);
    };
  }, []);

  const custom = mergeSiteCustomization(settings.siteCustomization || DEFAULT_SITE_CUSTOMIZATION);

  // Sync SEO title and description when customized
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (custom.seoTitle) {
        document.title = custom.seoTitle;
      }
      if (custom.seoDescription) {
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
          metaDesc.setAttribute('content', custom.seoDescription);
        }
      }
    }
  }, [custom.seoTitle, custom.seoDescription]);

  const portalDestination = user ? (isAdmin ? '/admin' : '/portal') : '/login';
  const portalLabel = user
    ? isAdmin
      ? 'Admin Console'
      : custom.navPortalButtonLabel || 'Client Portal'
    : custom.navPortalButtonLabel || 'Client Portal';
  const whatsappUrl = buildWhatsAppLink(settings.whatsappNumber, settings.whatsappDefaultMessage);

  const primaryBg = custom.primaryColor || '#172333';
  const secondaryBg = custom.secondaryColor || '#24364A';
  const accentColor = custom.accentColor || '#F18A45';
  const pageBg = custom.backgroundColor || '#F5F5F1';

  const socialLinks = [
    { label: 'Instagram', url: custom.instagramUrl },
    { label: 'YouTube', url: custom.youtubeUrl },
    { label: 'LinkedIn', url: custom.linkedinUrl },
    { label: 'Behance', url: custom.behanceUrl },
    { label: 'X / Twitter', url: custom.twitterUrl },
  ].filter((s) => Boolean(s.url && s.url.trim()));

  return (
    <div
      className="min-h-screen flex flex-col text-[#172333]"
      style={{ backgroundColor: pageBg }}
    >
      {/* Optional Top Announcement Bar */}
      {custom.announcementEnabled && custom.announcementText && (
        <div
          className="text-xs px-6 py-2.5 border-b border-white/10 no-print"
          style={{ backgroundColor: primaryBg, color: '#F5F5F1' }}
        >
          <div className="max-w-[1200px] mx-auto flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#F5F5F1]/90">{custom.announcementText}</p>
            {custom.announcementCtaLabel && (
              <Link
                to={custom.announcementCtaLink || '/contact'}
                className="font-semibold hover:underline whitespace-nowrap shrink-0"
                style={{ color: accentColor }}
              >
                {custom.announcementCtaLabel}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Strict 3-Zone Top Bar Contract */}
      <header
        className="sticky top-0 z-40 backdrop-blur-sm border-b border-[#E2E4DF] no-print"
        style={{ backgroundColor: `${pageBg}F2` }}
      >
        <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-8 px-6 py-4">
          {/* Zone 1: Brand Wordmark & Studio Logo */}
          <Link
            to="/"
            className="inline-flex items-center gap-3 font-editorial text-xl font-semibold tracking-tight text-[#172333] whitespace-nowrap shrink-0"
          >
            <img
              src={custom.logoUrl || DEFAULT_STUDIO_LOGO_URL}
              alt={settings.businessName || 'Prithvi Editify'}
              referrerPolicy="no-referrer"
              className="h-9 sm:h-10 w-auto rounded-md bg-white px-1.5 py-0.5 object-contain border border-[#E2E4DF] shadow-2xs"
            />
            <span>{settings.businessName || 'Prithvi Editify'}</span>
          </Link>

          {/* Zone 2: Clean single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#6E7785]">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `hover:text-[#172333] transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'text-[#172333] underline underline-offset-8 decoration-[#F18A45] decoration-2'
                    : ''
                }`
              }
            >
              {custom.navHomeLabel || 'Home'}
            </NavLink>
            {custom.showServicesNav !== false && (
              <NavLink
                to="/services"
                className={({ isActive }) =>
                  `hover:text-[#172333] transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'text-[#172333] underline underline-offset-8 decoration-[#F18A45] decoration-2'
                      : ''
                  }`
                }
              >
                {custom.navServicesLabel || 'Services'}
              </NavLink>
            )}
            {custom.showPortfolioNav !== false && (
              <NavLink
                to="/portfolio"
                className={({ isActive }) =>
                  `hover:text-[#172333] transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'text-[#172333] underline underline-offset-8 decoration-[#F18A45] decoration-2'
                      : ''
                  }`
                }
              >
                {custom.navPortfolioLabel || 'Portfolio'}
              </NavLink>
            )}
            {custom.showAboutNav !== false && (
              <NavLink
                to="/about"
                className={({ isActive }) =>
                  `hover:text-[#172333] transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'text-[#172333] underline underline-offset-8 decoration-[#F18A45] decoration-2'
                      : ''
                  }`
                }
              >
                {custom.navAboutLabel || 'About'}
              </NavLink>
            )}
            {custom.showContactNav !== false && (
              <NavLink
                to="/contact"
                className={({ isActive }) =>
                  `hover:text-[#172333] transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'text-[#172333] underline underline-offset-8 decoration-[#F18A45] decoration-2'
                      : ''
                  }`
                }
              >
                {custom.navContactLabel || 'Contact'}
              </NavLink>
            )}
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to={portalDestination}
              className="px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
              style={{ backgroundColor: primaryBg }}
            >
              {portalLabel}
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 text-[#172333] hover:bg-[#E2E4DF]/60 rounded-lg"
              aria-label="Toggle navigation menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileOpen && (
          <div className="md:hidden bg-white border-b border-[#E2E4DF] px-6 py-4 space-y-3">
            <div className="flex flex-col space-y-2.5 text-sm font-medium text-[#172333]">
              <Link to="/" onClick={() => setMobileOpen(false)} className="py-1">
                {custom.navHomeLabel || 'Home'}
              </Link>
              {custom.showServicesNav !== false && (
                <Link to="/services" onClick={() => setMobileOpen(false)} className="py-1">
                  {custom.navServicesLabel || 'Services'}
                </Link>
              )}
              {custom.showPortfolioNav !== false && (
                <Link to="/portfolio" onClick={() => setMobileOpen(false)} className="py-1">
                  {custom.navPortfolioLabel || 'Portfolio'}
                </Link>
              )}
              {custom.showAboutNav !== false && (
                <Link to="/about" onClick={() => setMobileOpen(false)} className="py-1">
                  {custom.navAboutLabel || 'About'}
                </Link>
              )}
              {custom.showContactNav !== false && (
                <Link to="/contact" onClick={() => setMobileOpen(false)} className="py-1">
                  {custom.navContactLabel || 'Contact'}
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet context={{ settings }} />
      </main>

      {/* Studio Footer */}
      <footer
        className="text-[#F5F5F1] border-t border-[#24364A] no-print"
        style={{ backgroundColor: primaryBg }}
      >
        <div className="max-w-[1200px] mx-auto px-6 py-16">
          <div
            className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b"
            style={{ borderColor: secondaryBg }}
          >
            <div className="md:col-span-5 space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src={custom.logoUrl || DEFAULT_STUDIO_LOGO_URL}
                  alt={settings.businessName || 'Prithvi Editify'}
                  referrerPolicy="no-referrer"
                  className="h-11 w-auto rounded-md bg-white px-2 py-1 object-contain border border-white/15 shadow-xs"
                />
                <p className="font-editorial text-2xl font-semibold text-white">
                  {settings.businessName || 'Prithvi Editify'}
                </p>
              </div>
              <p className="text-sm text-[#9BA3B0] max-w-sm leading-relaxed">
                {settings.tagline ||
                  'Professional graphic design, thumbnails, social media creatives, and video editing for brands and creators.'}
              </p>
              <p className="text-xs text-[#9BA3B0] pt-1">
                {custom.footerStudioLabel ||
                  `Independent Creative Studio · Led by ${settings.ownerName || 'Shankar Baluragi'}`}
              </p>
              {socialLinks.length > 0 && (
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  {socialLinks.map((soc) => (
                    <a
                      key={soc.label}
                      href={soc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-[#D0D5DD] hover:text-white border border-white/10 transition-colors"
                      style={{ backgroundColor: secondaryBg }}
                    >
                      <span>{soc.label}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="md:col-span-2 space-y-2.5">
              <p className="text-xs font-semibold text-white tracking-wide">Navigation</p>
              <ul className="space-y-2 text-sm text-[#9BA3B0]">
                <li>
                  <Link to="/" className="hover:text-white transition-colors">
                    {custom.navHomeLabel || 'Home'}
                  </Link>
                </li>
                {custom.showServicesNav !== false && (
                  <li>
                    <Link to="/services" className="hover:text-white transition-colors">
                      {custom.navServicesLabel || 'Services & Pricing'}
                    </Link>
                  </li>
                )}
                {custom.showPortfolioNav !== false && (
                  <li>
                    <Link to="/portfolio" className="hover:text-white transition-colors">
                      {custom.navPortfolioLabel || 'Portfolio'}
                    </Link>
                  </li>
                )}
                {custom.showAboutNav !== false && (
                  <li>
                    <Link to="/about" className="hover:text-white transition-colors">
                      {custom.navAboutLabel || 'About Studio'}
                    </Link>
                  </li>
                )}
                {custom.showContactNav !== false && (
                  <li>
                    <Link to="/contact" className="hover:text-white transition-colors">
                      {custom.navContactLabel || 'Start a Project'}
                    </Link>
                  </li>
                )}
              </ul>
            </div>

            <div className="md:col-span-3 space-y-2.5">
              <p className="text-xs font-semibold text-white tracking-wide">Core Disciplines</p>
              <ul className="space-y-2 text-sm text-[#9BA3B0]">
                {(custom.heroDisciplines && custom.heroDisciplines.length > 0
                  ? custom.heroDisciplines
                  : [
                      'Social Media & Carousel Design',
                      'YouTube Thumbnails & Packaging',
                      'Promotional & Campaign Ads',
                      'YouTube & Instagram Reels Editing',
                    ]
                ).map((disc) => (
                  <li key={disc}>
                    <Link to="/services" className="hover:text-white transition-colors">
                      {disc}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="md:col-span-2 space-y-3">
              <p className="text-xs font-semibold text-white tracking-wide">Direct Contact</p>
              {settings.businessEmail && (
                <p className="text-xs text-[#9BA3B0] break-all">{settings.businessEmail}</p>
              )}
              {settings.whatsappNumber && (
                <p className="text-xs text-[#9BA3B0] font-mono">{settings.whatsappNumber}</p>
              )}
              {settings.businessAddress && (
                <p className="text-xs text-[#9BA3B0]">{settings.businessAddress}</p>
              )}
              <div className="pt-1">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#172333] rounded-lg transition-colors whitespace-nowrap shrink-0"
                  style={{ backgroundColor: accentColor }}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Chat on WhatsApp
                </a>
              </div>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#9BA3B0]">
            <p>
              © {new Date().getFullYear()} {settings.businessName || 'Prithvi Editify'} (
              {settings.ownerName || 'Shankar Baluragi'}).{' '}
              {custom.copyrightText || 'All rights reserved.'}
            </p>
            <div className="flex items-center gap-6">
              <Link to="/privacy" className="hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms" className="hover:text-white transition-colors">
                Terms & Conditions
              </Link>
              <Link to={portalDestination} className="hover:text-white transition-colors">
                {portalLabel}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
