import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Menu, X, MessageSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchPublicSettings } from '../services/crmService';
import { DEFAULT_PUBLIC_SETTINGS } from '../utils/seedData';
import { PublicSettings } from '../types/crm';
import { buildWhatsAppLink } from '../utils/formatters';

export const PublicLayout: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settings, setSettings] = useState<PublicSettings>(DEFAULT_PUBLIC_SETTINGS);

  useEffect(() => {
    fetchPublicSettings().then(setSettings).catch(() => {});
  }, []);

  const portalDestination = user ? (isAdmin ? '/admin' : '/portal') : '/login';
  const portalLabel = user ? (isAdmin ? 'Admin Console' : 'Client Portal') : 'Client Portal';
  const whatsappUrl = buildWhatsAppLink(settings.whatsappNumber, settings.whatsappDefaultMessage);

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F1] text-[#172333]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-[#F5F5F1]/95 backdrop-blur-sm border-b border-[#E2E4DF] no-print">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-8 px-6 py-4">
          {/* Zone 1: Single text element wordmark */}
          <Link
            to="/"
            className="font-editorial text-xl font-semibold tracking-tight text-[#172333] whitespace-nowrap shrink-0"
          >
            {settings.businessName || 'Prithvi Editify'}
          </Link>

          {/* Zone 2: 5 clean single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#6E7785]">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `hover:text-[#172333] transition-colors whitespace-nowrap shrink-0 ${
                  isActive ? 'text-[#172333] underline underline-offset-8 decoration-[#F18A45] decoration-2' : ''
                }`
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/services"
              className={({ isActive }) =>
                `hover:text-[#172333] transition-colors whitespace-nowrap shrink-0 ${
                  isActive ? 'text-[#172333] underline underline-offset-8 decoration-[#F18A45] decoration-2' : ''
                }`
              }
            >
              Services
            </NavLink>
            <NavLink
              to="/portfolio"
              className={({ isActive }) =>
                `hover:text-[#172333] transition-colors whitespace-nowrap shrink-0 ${
                  isActive ? 'text-[#172333] underline underline-offset-8 decoration-[#F18A45] decoration-2' : ''
                }`
              }
            >
              Portfolio
            </NavLink>
            <NavLink
              to="/about"
              className={({ isActive }) =>
                `hover:text-[#172333] transition-colors whitespace-nowrap shrink-0 ${
                  isActive ? 'text-[#172333] underline underline-offset-8 decoration-[#F18A45] decoration-2' : ''
                }`
              }
            >
              About
            </NavLink>
            <NavLink
              to="/contact"
              className={({ isActive }) =>
                `hover:text-[#172333] transition-colors whitespace-nowrap shrink-0 ${
                  isActive ? 'text-[#172333] underline underline-offset-8 decoration-[#F18A45] decoration-2' : ''
                }`
              }
            >
              Contact
            </NavLink>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to={portalDestination}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg transition-colors whitespace-nowrap shrink-0"
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
                Home
              </Link>
              <Link to="/services" onClick={() => setMobileOpen(false)} className="py-1">
                Services
              </Link>
              <Link to="/portfolio" onClick={() => setMobileOpen(false)} className="py-1">
                Portfolio
              </Link>
              <Link to="/about" onClick={() => setMobileOpen(false)} className="py-1">
                About
              </Link>
              <Link to="/contact" onClick={() => setMobileOpen(false)} className="py-1">
                Contact
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet context={{ settings }} />
      </main>

      {/* Studio Footer */}
      <footer className="bg-[#172333] text-[#F5F5F1] border-t border-[#24364A] no-print">
        <div className="max-w-[1200px] mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-[#24364A]">
            <div className="md:col-span-5 space-y-3">
              <p className="font-editorial text-2xl font-semibold text-white">
                {settings.businessName || 'Prithvi Editify'}
              </p>
              <p className="text-sm text-[#9BA3B0] max-w-sm leading-relaxed">
                {settings.tagline ||
                  'Professional graphic design, thumbnails, social media creatives, and video editing for brands and creators.'}
              </p>
              <p className="text-xs text-[#9BA3B0] pt-1">
                Independent Creative Studio · Led by {settings.ownerName || 'Shankar Baluragi'}
              </p>
            </div>

            <div className="md:col-span-2 space-y-2.5">
              <p className="text-xs font-semibold text-white tracking-wide">Navigation</p>
              <ul className="space-y-2 text-sm text-[#9BA3B0]">
                <li>
                  <Link to="/" className="hover:text-white transition-colors">
                    Home
                  </Link>
                </li>
                <li>
                  <Link to="/services" className="hover:text-white transition-colors">
                    Services & Pricing
                  </Link>
                </li>
                <li>
                  <Link to="/portfolio" className="hover:text-white transition-colors">
                    Portfolio
                  </Link>
                </li>
                <li>
                  <Link to="/about" className="hover:text-white transition-colors">
                    About Studio
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="hover:text-white transition-colors">
                    Start a Project
                  </Link>
                </li>
              </ul>
            </div>

            <div className="md:col-span-3 space-y-2.5">
              <p className="text-xs font-semibold text-white tracking-wide">Core Disciplines</p>
              <ul className="space-y-2 text-sm text-[#9BA3B0]">
                <li>
                  <Link to="/services" className="hover:text-white transition-colors">
                    Social Media & Carousel Design
                  </Link>
                </li>
                <li>
                  <Link to="/services" className="hover:text-white transition-colors">
                    YouTube Thumbnails & Packaging
                  </Link>
                </li>
                <li>
                  <Link to="/services" className="hover:text-white transition-colors">
                    Promotional & Campaign Ads
                  </Link>
                </li>
                <li>
                  <Link to="/services" className="hover:text-white transition-colors">
                    YouTube & Instagram Reels Editing
                  </Link>
                </li>
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
              <div className="pt-1">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#172333] bg-[#F18A45] hover:bg-[#e07934] rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Chat on WhatsApp
                </a>
              </div>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#9BA3B0]">
            <p>
              © {new Date().getFullYear()} {settings.businessName || 'Prithvi Editify'} ({settings.ownerName || 'Shankar Baluragi'}). All rights reserved.
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
