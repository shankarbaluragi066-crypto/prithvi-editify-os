import React, { useEffect, useState, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  X,
  MessageSquare,
  ExternalLink,
  Send,
  ChevronDown,
  LogOut,
  UserCheck,
  LayoutDashboard,
  ArrowRight,
} from 'lucide-react';
import { useAuth, GoogleBrandIcon } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { PWAInstallButton, OfflineStatusBanner } from '../components/PWAInstallPrompt';
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
  const {
    user,
    profile,
    isAdmin,
    loading,
    savedClientAccounts,
    loginWithGoogle,
    quickSignInWithGoogleAccount,
    logout,
  } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [oneTapDismissed, setOneTapDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem('pe_google_onetap_dismissed_v1') === '1';
  });
  const [googleBusy, setGoogleBusy] = useState(false);
  const [settings, setSettings] = useState<PublicSettings>(DEFAULT_PUBLIC_SETTINGS);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAccountDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
  const portalLabel = user && isAdmin ? 'Admin Portal' : custom.navPortalButtonLabel || 'Client Portal';
  const whatsappUrl = buildWhatsAppLink(settings.whatsappNumber, settings.whatsappDefaultMessage);

  const primaryBg = custom.primaryColor || '#040D1A';
  const secondaryBg = custom.secondaryColor || '#081629';
  const accentColor = custom.accentColor || '#10B981';
  const pageBg = custom.backgroundColor || '#040D1A';

  const socialLinks = [
    { label: 'Instagram', url: custom.instagramUrl },
    { label: 'YouTube', url: custom.youtubeUrl },
    { label: 'LinkedIn', url: custom.linkedinUrl },
    { label: 'Behance', url: custom.behanceUrl },
    { label: 'X / Twitter', url: custom.twitterUrl },
  ].filter((s) => Boolean(s.url && s.url.trim()));

  const handleOpenGoogleSelector = async () => {
    setGoogleBusy(true);
    setAccountDropdownOpen(false);
    setMobileOpen(false);
    try {
      const prof = await loginWithGoogle('/login');
      showToast(
        'success',
        'Signed in with Google',
        `Welcome, ${prof.displayName}! Your Client Portal is ready.`
      );
      if (
        !location.pathname.startsWith('/book') &&
        !location.pathname.startsWith('/contact')
      ) {
        navigate('/portal');
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('cancelled')) return;
      showToast(
        'error',
        'Google Sign-In Failed',
        err instanceof Error ? err.message : 'Unable to sign in with Google.'
      );
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleQuickAccountSignIn = async (
    email: string,
    displayName: string,
    phone?: string,
    companyName?: string
  ) => {
    setGoogleBusy(true);
    setAccountDropdownOpen(false);
    setMobileOpen(false);
    try {
      const prof = await quickSignInWithGoogleAccount(email, displayName, {
        phone,
        companyName,
      });
      showToast(
        'success',
        'Google Account Connected',
        `Signed in as ${prof.displayName} (${prof.email})`
      );
      if (
        !location.pathname.startsWith('/book') &&
        !location.pathname.startsWith('/contact')
      ) {
        navigate('/portal');
      }
    } catch (err) {
      showToast(
        'error',
        'Google Sign-In Failed',
        err instanceof Error ? err.message : 'Unable to switch Google account.'
      );
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleDismissOneTap = () => {
    setOneTapDismissed(true);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('pe_google_onetap_dismissed_v1', '1');
    }
  };

  const showFloatingOneTap =
    !loading &&
    !user &&
    !oneTapDismissed &&
    !location.pathname.startsWith('/login') &&
    !location.pathname.startsWith('/admin-login') &&
    !location.pathname.startsWith('/forgot-password') &&
    !location.pathname.startsWith('/reset-password');

  const userInitials = (profile?.displayName || user?.email || 'C')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="min-h-screen flex flex-col text-[#F8FAFC] pb-20 md:pb-0"
      style={{ backgroundColor: pageBg }}
    >
      <OfflineStatusBanner />
      {/* Optional Top Announcement Bar */}
      {custom.announcementEnabled && custom.announcementText && (
        <div
          className="text-xs px-6 py-2.5 border-b border-[#1E3A5F] no-print"
          style={{ backgroundColor: secondaryBg, color: '#F8FAFC' }}
        >
          <div className="max-w-[1200px] mx-auto flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#F8FAFC]/90">{custom.announcementText}</p>
            {custom.announcementCtaLabel && (
              <Link
                to={custom.announcementCtaLink || '/contact'}
                className="font-semibold hover:underline whitespace-nowrap shrink-0 text-[#2DD4BF]"
              >
                {custom.announcementCtaLabel}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Strict 3-Zone Top Bar Contract */}
      <header
        className="sticky top-0 z-40 backdrop-blur-md border-b border-[#1E3A5F] no-print"
        style={{ backgroundColor: `${pageBg}E8` }}
      >
        <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-6 px-6 py-3.5">
          {/* Zone 1: Brand Wordmark & Official Uncropped Logo */}
          <Link
            to="/"
            className="inline-flex items-center gap-3 text-lg sm:text-xl font-bold tracking-tight text-[#F8FAFC] whitespace-nowrap shrink-0"
          >
            <img
              src={custom.logoUrl || DEFAULT_STUDIO_LOGO_URL}
              alt={settings.businessName || 'Prithvi Editify OS'}
              referrerPolicy="no-referrer"
              className="h-9 sm:h-10 w-auto rounded-md bg-white px-1.5 py-0.5 object-contain border border-[#1E3A5F] shadow-2xs"
            />
            <span>{settings.businessName || 'Prithvi Editify'}</span>
          </Link>

          {/* Zone 2: Clean single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#94A3B8]">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `hover:text-[#F8FAFC] transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'text-[#F8FAFC] font-semibold underline underline-offset-8 decoration-[#10B981] decoration-2'
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
                  `hover:text-[#F8FAFC] transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'text-[#F8FAFC] font-semibold underline underline-offset-8 decoration-[#10B981] decoration-2'
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
                  `hover:text-[#F8FAFC] transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'text-[#F8FAFC] font-semibold underline underline-offset-8 decoration-[#10B981] decoration-2'
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
                  `hover:text-[#F8FAFC] transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'text-[#F8FAFC] font-semibold underline underline-offset-8 decoration-[#10B981] decoration-2'
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
                  `hover:text-[#F8FAFC] transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'text-[#F8FAFC] font-semibold underline underline-offset-8 decoration-[#10B981] decoration-2'
                      : ''
                  }`
                }
              >
                {custom.navContactLabel || 'Contact'}
              </NavLink>
            )}
          </nav>

          {/* Zone 3: Top-Website Google Account Selector / Switcher + Primary Portal Action */}
          <div className="flex items-center gap-2.5 shrink-0" ref={dropdownRef}>
            <div className="hidden lg:block">
              <PWAInstallButton compact />
            </div>

            {!user ? (
              <button
                type="button"
                disabled={googleBusy}
                onClick={handleOpenGoogleSelector}
                className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#F8FAFC] bg-[#0D1F38] hover:bg-[#132A4A] border border-[#1E3A5F] hover:border-[#10B981] rounded-lg transition-all cursor-pointer whitespace-nowrap"
                title="Sign in with your Google Account"
              >
                <span className="w-4 h-4 rounded-full bg-white flex items-center justify-center shrink-0">
                  <GoogleBrandIcon className="w-3 h-3" />
                </span>
                <span>{googleBusy ? 'Signing in...' : 'Sign in with Google'}</span>
              </button>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAccountDropdownOpen((prev) => !prev)}
                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#0D1F38] hover:bg-[#132A4A] border border-[#1E3A5F] hover:border-[#10B981] text-xs transition-all cursor-pointer"
                  title="Google Account Switcher"
                >
                  <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[#0EA5E9] to-[#10B981] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                    {userInitials}
                  </span>
                  <span className="hidden sm:inline font-semibold text-[#F8FAFC] max-w-[110px] truncate">
                    {profile?.displayName || user.email?.split('@')[0]}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
                </button>

                {/* Top-Right Google Account Switcher Dropdown */}
                {accountDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-[#0D1F38] border border-[#1E3A5F] rounded-2xl shadow-2xl overflow-hidden z-50">
                    <div className="px-4 py-3 bg-[#081629] border-b border-[#1E3A5F] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center">
                          <GoogleBrandIcon className="w-3 h-3" />
                        </span>
                        <span className="text-[11px] font-semibold text-[#94A3B8]">
                          Google Account Connected
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] text-[10px] font-semibold">
                        {isAdmin ? 'Studio Admin' : 'Client'}
                      </span>
                    </div>

                    <div className="p-4 border-b border-[#1E3A5F] flex items-center gap-3 bg-[#132A4A]/50">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0EA5E9] to-[#10B981] flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {userInitials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#F8FAFC] truncate">
                          {profile?.displayName || 'Client Account'}
                        </p>
                        <p className="text-xs text-[#94A3B8] font-mono truncate">
                          {profile?.email || user.email}
                        </p>
                      </div>
                    </div>

                    <div className="p-2.5 space-y-1.5">
                      <Link
                        to={portalDestination}
                        onClick={() => setAccountDropdownOpen(false)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 transition-opacity"
                      >
                        <span className="inline-flex items-center gap-2">
                          <LayoutDashboard className="w-3.5 h-3.5" />
                          <span>Open {portalLabel}</span>
                        </span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>

                      {!isAdmin &&
                        savedClientAccounts.filter(
                          (acc) => acc.email.toLowerCase() !== (user.email || '').toLowerCase()
                        ).length > 0 && (
                          <div className="pt-2 border-t border-[#1E3A5F] space-y-1">
                            <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                              Switch Google Account
                            </p>
                            {savedClientAccounts
                              .filter(
                                (acc) =>
                                  acc.email.toLowerCase() !== (user.email || '').toLowerCase()
                              )
                              .slice(0, 3)
                              .map((acc) => (
                                <button
                                  key={acc.email}
                                  type="button"
                                  onClick={() =>
                                    handleQuickAccountSignIn(
                                      acc.email,
                                      acc.displayName,
                                      acc.phone,
                                      acc.companyName
                                    )
                                  }
                                  className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg hover:bg-[#132A4A] text-left transition-colors cursor-pointer"
                                >
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-[#F8FAFC] truncate">
                                      {acc.displayName}
                                    </p>
                                    <p className="text-[11px] text-[#94A3B8] font-mono truncate">
                                      {acc.email}
                                    </p>
                                  </div>
                                  <ArrowRight className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
                                </button>
                              ))}
                          </div>
                        )}

                      <button
                        type="button"
                        onClick={handleOpenGoogleSelector}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[#F8FAFC] hover:bg-[#132A4A] transition-colors cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-[#0EA5E9]" />
                        <span>Use another Google account</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          setAccountDropdownOpen(false);
                          await logout();
                          showToast('info', 'Signed Out', 'You have been signed out.');
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[#F87171] hover:bg-[#DC2626]/15 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <Link
              to={portalDestination}
              className="px-4 py-2 text-xs font-semibold text-white rounded-lg bg-gradient-to-r from-[#0EA5E9] to-[#10B981] shadow-[0_8px_20px_-4px_rgba(16,185,129,0.45)] hover:opacity-95 transition-all whitespace-nowrap shrink-0"
              style={accentColor !== '#10B981' ? { backgroundColor: accentColor, backgroundImage: 'none' } : undefined}
            >
              {portalLabel}
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 text-[#F8FAFC] hover:bg-[#132A4A] border border-[#1E3A5F] rounded-lg"
              aria-label="Toggle navigation menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileOpen && (
          <div className="md:hidden bg-[#0D1F38] border-b border-[#1E3A5F] px-6 py-4 space-y-3 shadow-2xl">
            <div className="flex flex-col space-y-2.5 text-sm font-medium text-[#F8FAFC]">
              <Link to="/" onClick={() => setMobileOpen(false)} className="py-1.5 hover:text-[#10B981]">
                {custom.navHomeLabel || 'Home'}
              </Link>
              {custom.showServicesNav !== false && (
                <Link to="/services" onClick={() => setMobileOpen(false)} className="py-1.5 hover:text-[#10B981]">
                  {custom.navServicesLabel || 'Services'}
                </Link>
              )}
              {custom.showPortfolioNav !== false && (
                <Link to="/portfolio" onClick={() => setMobileOpen(false)} className="py-1.5 hover:text-[#10B981]">
                  {custom.navPortfolioLabel || 'Portfolio'}
                </Link>
              )}
              {custom.showAboutNav !== false && (
                <Link to="/about" onClick={() => setMobileOpen(false)} className="py-1.5 hover:text-[#10B981]">
                  {custom.navAboutLabel || 'About'}
                </Link>
              )}
              {custom.showContactNav !== false && (
                <Link to="/contact" onClick={() => setMobileOpen(false)} className="py-1.5 hover:text-[#10B981]">
                  {custom.navContactLabel || 'Contact'}
                </Link>
              )}
              {!user && (
                <button
                  type="button"
                  onClick={handleOpenGoogleSelector}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-[#132A4A] border border-[#1E3A5F] text-xs font-semibold text-[#F8FAFC]"
                >
                  <span className="w-4 h-4 rounded-full bg-white flex items-center justify-center">
                    <GoogleBrandIcon className="w-3 h-3" />
                  </span>
                  <span>Sign in with Google Account</span>
                </button>
              )}
              <Link
                to={portalDestination}
                onClick={() => setMobileOpen(false)}
                className="py-1.5 font-semibold text-[#2DD4BF] hover:text-[#10B981]"
              >
                {portalLabel} →
              </Link>
              <div className="pt-2 border-t border-[#1E3A5F]">
                <PWAInstallButton compact />
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Top-Right Floating Google One-Tap Account Selector Prompt (Top Website Style) */}
      {showFloatingOneTap && (
        <div
          className="fixed top-20 right-4 sm:right-6 z-40 w-[330px] max-w-[calc(100vw-2rem)] bg-[#0D1F38]/95 backdrop-blur-md border border-[#1E3A5F] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.65)] overflow-hidden no-print"
          role="region"
          aria-label="Sign in with Google"
        >
          <div className="px-4 py-2.5 bg-[#081629] border-b border-[#1E3A5F] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center shrink-0">
                <GoogleBrandIcon className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-semibold text-[#F8FAFC] truncate">
                Sign in to Prithvi Editify with Google
              </span>
            </div>
            <button
              type="button"
              onClick={handleDismissOneTap}
              aria-label="Dismiss Google sign-in prompt"
              className="p-1 text-[#94A3B8] hover:text-[#F8FAFC] rounded-md transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            {savedClientAccounts.length > 0 ? (
              <>
                <div className="space-y-2">
                  {savedClientAccounts.slice(0, 2).map((acc) => {
                    const initials = (acc.displayName || acc.email)
                      .split(' ')
                      .map((part) => part[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();
                    const firstName = (acc.displayName || 'Client').split(' ')[0];
                    return (
                      <div
                        key={acc.email}
                        className="p-2.5 rounded-xl bg-[#132A4A]/80 border border-[#1E3A5F] space-y-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0EA5E9] to-[#10B981] flex items-center justify-center text-xs font-bold text-white shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-[#F8FAFC] truncate">
                              {acc.displayName}
                            </p>
                            <p className="text-[11px] text-[#94A3B8] font-mono truncate">
                              {acc.email}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={googleBusy}
                          onClick={() =>
                            handleQuickAccountSignIn(
                              acc.email,
                              acc.displayName,
                              acc.phone,
                              acc.companyName
                            )
                          }
                          className="w-full py-2 px-3 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 transition-opacity cursor-pointer"
                        >
                          Continue as {firstName}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  disabled={googleBusy}
                  onClick={handleOpenGoogleSelector}
                  className="w-full py-1.5 text-center text-xs font-semibold text-[#38BDF8] hover:text-[#10B981] transition-colors cursor-pointer"
                >
                  Choose another Google account →
                </button>
              </>
            ) : (
              <>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  One-tap client login to track live project milestones, preview deliverables, and download INR invoices.
                </p>
                <button
                  type="button"
                  disabled={googleBusy}
                  onClick={handleOpenGoogleSelector}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 px-3.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 shadow-md transition-all cursor-pointer"
                >
                  <span className="w-4 h-4 rounded-full bg-white flex items-center justify-center shrink-0">
                    <GoogleBrandIcon className="w-3 h-3" />
                  </span>
                  <span>Select Google Account</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 pe-page-enter">
        <Outlet context={{ settings }} />
      </main>

      {/* Studio Footer */}
      <footer
        className="text-[#F8FAFC] border-t border-[#1E3A5F] no-print"
        style={{ backgroundColor: secondaryBg }}
      >
        <div className="max-w-[1200px] mx-auto px-6 py-16">
          <div
            className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-[#1E3A5F]"
          >
            <div className="md:col-span-5 space-y-3.5">
              <div className="flex items-center gap-3">
                <img
                  src={custom.logoUrl || DEFAULT_STUDIO_LOGO_URL}
                  alt={settings.businessName || 'Prithvi Editify OS'}
                  referrerPolicy="no-referrer"
                  className="h-11 w-auto rounded-md bg-white px-2 py-1 object-contain border border-[#1E3A5F] shadow-xs"
                />
                <div>
                  <p className="text-xl font-bold tracking-tight text-[#F8FAFC]">
                    {settings.businessName || 'Prithvi Editify'}
                  </p>
                </div>
              </div>
              <p className="text-sm text-[#94A3B8] max-w-sm leading-relaxed">
                {settings.tagline ||
                  'Professional graphic design, thumbnails, social media creatives, and video editing for brands and creators.'}
              </p>
              <p className="text-xs text-[#94A3B8] pt-1">
                {custom.footerStudioLabel ||
                  `Independent Creative Studio · Led by ${settings.ownerName || 'Shankar Baluragi'}`}
              </p>
              {socialLinks.length > 0 && (
                <div className="pt-2 flex flex-wrap items-center gap-2.5">
                  {socialLinks.map((soc) => (
                    <a
                      key={soc.label}
                      href={soc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#94A3B8] hover:text-[#F8FAFC] bg-[#0D1F38] hover:bg-[#132A4A] border border-[#1E3A5F] transition-colors"
                    >
                      <span>{soc.label}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="md:col-span-2 space-y-2.5">
              <p className="text-xs font-semibold text-[#F8FAFC] tracking-wide">Navigation</p>
              <ul className="space-y-2 text-sm text-[#94A3B8]">
                <li>
                  <Link to="/" className="hover:text-[#F8FAFC] transition-colors">
                    {custom.navHomeLabel || 'Home'}
                  </Link>
                </li>
                {custom.showServicesNav !== false && (
                  <li>
                    <Link to="/services" className="hover:text-[#F8FAFC] transition-colors">
                      {custom.navServicesLabel || 'Services & Pricing'}
                    </Link>
                  </li>
                )}
                {custom.showPortfolioNav !== false && (
                  <li>
                    <Link to="/portfolio" className="hover:text-[#F8FAFC] transition-colors">
                      {custom.navPortfolioLabel || 'Portfolio'}
                    </Link>
                  </li>
                )}
                {custom.showAboutNav !== false && (
                  <li>
                    <Link to="/about" className="hover:text-[#F8FAFC] transition-colors">
                      {custom.navAboutLabel || 'About Studio'}
                    </Link>
                  </li>
                )}
                {custom.showContactNav !== false && (
                  <li>
                    <Link to="/contact" className="hover:text-[#F8FAFC] transition-colors">
                      {custom.navContactLabel || 'Start a Project'}
                    </Link>
                  </li>
                )}
              </ul>
            </div>

            <div className="md:col-span-3 space-y-2.5">
              <p className="text-xs font-semibold text-[#F8FAFC] tracking-wide">Core Disciplines</p>
              <ul className="space-y-2 text-sm text-[#94A3B8]">
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
                    <Link to="/services" className="hover:text-[#F8FAFC] transition-colors">
                      {disc}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="md:col-span-2 space-y-3">
              <p className="text-xs font-semibold text-[#F8FAFC] tracking-wide">Direct Contact</p>
              {settings.businessEmail && (
                <p className="text-xs text-[#94A3B8] break-all">{settings.businessEmail}</p>
              )}
              {settings.whatsappNumber && (
                <p className="text-xs text-[#94A3B8] font-mono">{settings.whatsappNumber}</p>
              )}
              {settings.businessAddress && (
                <p className="text-xs text-[#94A3B8]">{settings.businessAddress}</p>
              )}
              <div className="pt-1">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white rounded-lg bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 transition-opacity whitespace-nowrap shrink-0"
                  style={accentColor !== '#10B981' ? { backgroundColor: accentColor, backgroundImage: 'none' } : undefined}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Chat on WhatsApp
                </a>
              </div>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#94A3B8]">
            <p>
              © {new Date().getFullYear()} {settings.businessName || 'Prithvi Editify'} (
              {settings.ownerName || 'Shankar Baluragi'}).{' '}
              {custom.copyrightText || 'All rights reserved.'}
            </p>
            <div className="flex items-center gap-6">
              <Link to="/privacy" className="hover:text-[#F8FAFC] transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms" className="hover:text-[#F8FAFC] transition-colors">
                Terms & Conditions
              </Link>
              <Link to={portalDestination} className="hover:text-[#F8FAFC] transition-colors">
                {portalLabel}
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Sticky Mobile "Quick Brief / WhatsApp" Bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#081629]/95 backdrop-blur-md border-t border-[#1E3A5F] px-3 py-2.5 flex items-center gap-2.5 shadow-[0_-8px_24px_rgba(0,0,0,0.45)] no-print">
        <Link
          to="/contact"
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold text-[#040D1A] bg-gradient-to-r from-[#10B981] via-[#2DD4BF] to-[#0EA5E9] shadow-sm"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Start a Project</span>
        </Link>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold text-[#F8FAFC] bg-[#0D1F38] hover:bg-[#132A4A] border border-[#10B981]/40"
        >
          <MessageSquare className="w-3.5 h-3.5 text-[#10B981]" />
          <span>WhatsApp Direct</span>
        </a>
      </div>
    </div>
  );
};
