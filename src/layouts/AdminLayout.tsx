import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  FolderKanban,
  CheckSquare,
  Briefcase,
  Layers,
  FileText,
  CreditCard,
  FolderOpen,
  Bell,
  BarChart3,
  Settings,
  UserCircle,
  LogOut,
  Menu,
  X,
  ExternalLink,
  Image as ImageIcon,
  Palette,
  Sparkles,
  FileCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { DEFAULT_STUDIO_LOGO_URL } from '../utils/seedData';
import {
  fetchAllClientsAdmin,
  fetchAllProjectsAdmin,
  fetchAllInvoicesAdmin,
} from '../services/crmService';
import { ClientRecord, ProjectRecord, InvoiceRecord } from '../types/crm';
import { formatINR } from '../utils/formatters';

interface AdminNavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  group: string;
}

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true, group: 'Workspace & AI' },
  { to: '/admin/ai-assistant', label: 'AI Creative Assistant', icon: Sparkles, group: 'Workspace & AI' },
  { to: '/admin/website-customizer', label: 'Website Customizer (A–Z)', icon: Palette, group: 'Workspace & AI' },
  { to: '/admin/inquiries', label: 'Leads & Inquiries', icon: MessageSquare, group: 'CRM & Pipeline' },
  { to: '/admin/clients', label: 'Clients', icon: Users, group: 'CRM & Pipeline' },
  { to: '/admin/quotations', label: 'Quotations (PE-QTN)', icon: FileCheck, group: 'CRM & Pipeline' },
  { to: '/admin/estimates', label: 'Cost Estimates (PE-EST)', icon: FileText, group: 'CRM & Pipeline' },
  { to: '/admin/projects', label: 'Projects', icon: FolderKanban, group: 'Production & Delivery' },
  { to: '/admin/tasks', label: 'Tasks & Milestones', icon: CheckSquare, group: 'Production & Delivery' },
  { to: '/admin/files', label: 'Deliverable Files', icon: FolderOpen, group: 'Production & Delivery' },
  { to: '/admin/media', label: 'Media Library', icon: ImageIcon, group: 'Production & Delivery' },
  { to: '/admin/invoices', label: 'Invoices', icon: FileText, group: 'Finance & Analytics' },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard, group: 'Finance & Analytics' },
  { to: '/admin/reports', label: 'Reports & Analytics', icon: BarChart3, group: 'Finance & Analytics' },
  { to: '/admin/services', label: 'Services & Pricing', icon: Layers, group: 'Studio & System' },
  { to: '/admin/portfolio', label: 'Portfolio', icon: Briefcase, group: 'Studio & System' },
  { to: '/admin/notifications', label: 'Notifications', icon: Bell, group: 'Studio & System' },
  { to: '/admin/settings', label: 'Studio Settings', icon: Settings, group: 'Studio & System' },
  { to: '/admin/profile', label: 'Account Profile', icon: UserCircle, group: 'Studio & System' },
];

const NAV_GROUPS = [
  'Workspace & AI',
  'CRM & Pipeline',
  'Production & Delivery',
  'Finance & Analytics',
  'Studio & System',
];

type SearchCategory = 'all' | 'clients' | 'projects' | 'invoices';

interface GlobalSearchResultItem {
  id: string;
  category: 'clients' | 'projects' | 'invoices';
  title: string;
  subtitle: string;
  badgeText: string;
  badgeTone: string;
  href: string;
}

export const AdminLayout: React.FC = () => {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  // Global Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchCategory, setSearchCategory] = useState<SearchCategory>('all');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchLoadedOnce, setSearchLoadedOnce] = useState(false);
  const [clientsData, setClientsData] = useState<ClientRecord[]>([]);
  const [projectsData, setProjectsData] = useState<ProjectRecord[]>([]);
  const [invoicesData, setInvoicesData] = useState<InvoiceRecord[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadSearchIndex = useCallback(async (force = false) => {
    if (searchLoading || (searchLoadedOnce && !force)) return;
    setSearchLoading(true);
    try {
      const [cli, proj, inv] = await Promise.all([
        fetchAllClientsAdmin().catch(() => []),
        fetchAllProjectsAdmin().catch(() => []),
        fetchAllInvoicesAdmin().catch(() => []),
      ]);
      setClientsData(cli);
      setProjectsData(proj);
      setInvoicesData(inv);
      setSearchLoadedOnce(true);
    } finally {
      setSearchLoading(false);
    }
  }, [searchLoading, searchLoadedOnce]);

  // Close search dropdown on route change
  useEffect(() => {
    setSearchOpen(false);
  }, [location.pathname, location.search]);

  // Keyboard shortcut Ctrl+K / Cmd+K to focus global search
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        loadSearchIndex();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [searchOpen, loadSearchIndex]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const matchedClients = useMemo<GlobalSearchResultItem[]>(() => {
    const list = normalizedQuery
      ? clientsData.filter(
          (c) =>
            c.fullName.toLowerCase().includes(normalizedQuery) ||
            (c.companyName || '').toLowerCase().includes(normalizedQuery) ||
            c.email.toLowerCase().includes(normalizedQuery) ||
            c.phone.toLowerCase().includes(normalizedQuery)
        )
      : clientsData.slice(0, 4);

    return list.slice(0, 6).map((c) => ({
      id: `client-${c.id}`,
      category: 'clients',
      title: c.fullName,
      subtitle: [c.companyName, c.email, c.phone].filter(Boolean).join(' · '),
      badgeText: c.accountStatus.toUpperCase(),
      badgeTone:
        c.accountStatus === 'active'
          ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30'
          : 'bg-[#132A4A] text-[#94A3B8] border-[#1E3A5F]',
      href: `/admin/clients/${c.id}`,
    }));
  }, [clientsData, normalizedQuery]);

  const matchedProjects = useMemo<GlobalSearchResultItem[]>(() => {
    const list = normalizedQuery
      ? projectsData.filter(
          (p) =>
            p.title.toLowerCase().includes(normalizedQuery) ||
            p.clientName.toLowerCase().includes(normalizedQuery) ||
            p.serviceType.toLowerCase().includes(normalizedQuery) ||
            p.status.toLowerCase().includes(normalizedQuery)
        )
      : projectsData.slice(0, 4);

    return list.slice(0, 6).map((p) => ({
      id: `project-${p.id}`,
      category: 'projects',
      title: p.title,
      subtitle: `${p.clientName} · ${p.serviceType} · ${formatINR(p.budget)}`,
      badgeText: p.status,
      badgeTone:
        p.status === 'Completed'
          ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30'
          : p.status === 'In Progress' || p.status === 'In Review'
          ? 'bg-[#0EA5E9]/15 text-[#38BDF8] border-[#0EA5E9]/30'
          : 'bg-[#132A4A] text-[#94A3B8] border-[#1E3A5F]',
      href: `/admin/projects/${p.id}`,
    }));
  }, [projectsData, normalizedQuery]);

  const matchedInvoices = useMemo<GlobalSearchResultItem[]>(() => {
    const list = normalizedQuery
      ? invoicesData.filter(
          (inv) =>
            inv.invoiceNumber.toLowerCase().includes(normalizedQuery) ||
            inv.clientName.toLowerCase().includes(normalizedQuery) ||
            inv.projectTitle.toLowerCase().includes(normalizedQuery) ||
            inv.status.toLowerCase().includes(normalizedQuery) ||
            String(inv.total).includes(normalizedQuery)
        )
      : invoicesData.slice(0, 4);

    return list.slice(0, 6).map((inv) => ({
      id: `invoice-${inv.id}`,
      category: 'invoices',
      title: `${inv.invoiceNumber} — ${inv.clientName}`,
      subtitle: `${inv.projectTitle || 'General Billing'} · Total ${formatINR(inv.total)}${
        inv.balanceDue > 0 ? ` (Due ${formatINR(inv.balanceDue)})` : ''
      }`,
      badgeText: inv.status,
      badgeTone:
        inv.status === 'Paid'
          ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30'
          : inv.status === 'Overdue'
          ? 'bg-[#EF4444]/15 text-[#F87171] border-[#EF4444]/30'
          : 'bg-[#F59E0B]/15 text-[#FBBF24] border-[#F59E0B]/30',
      href: `/admin/invoices?q=${encodeURIComponent(inv.invoiceNumber)}`,
    }));
  }, [invoicesData, normalizedQuery]);

  const visibleResults = useMemo<GlobalSearchResultItem[]>(() => {
    if (searchCategory === 'clients') return matchedClients;
    if (searchCategory === 'projects') return matchedProjects;
    if (searchCategory === 'invoices') return matchedInvoices;
    return [
      ...matchedClients.slice(0, 3),
      ...matchedProjects.slice(0, 3),
      ...matchedInvoices.slice(0, 3),
    ];
  }, [searchCategory, matchedClients, matchedProjects, matchedInvoices]);

  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery, searchCategory]);

  const handleSelectResult = (item: GlobalSearchResultItem) => {
    setSearchOpen(false);
    navigate(item.href);
  };

  const handleSearchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!searchOpen) setSearchOpen(true);
      setActiveIndex((prev) =>
        visibleResults.length > 0 ? (prev + 1) % visibleResults.length : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!searchOpen) setSearchOpen(true);
      setActiveIndex((prev) =>
        visibleResults.length > 0
          ? (prev - 1 + visibleResults.length) % visibleResults.length
          : 0
      );
    } else if (e.key === 'Enter' && searchOpen && visibleResults[activeIndex]) {
      e.preventDefault();
      handleSelectResult(visibleResults[activeIndex]);
    }
  };

  const matchedItem = ADMIN_NAV_ITEMS.find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
  );
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const currentSection =
    matchedItem?.label ||
    (pathSegments[1]
      ? pathSegments[1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : 'Dashboard');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initials = (profile?.displayName || 'Shankar Baluragi')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen flex bg-[#040D1A] text-[#F8FAFC]">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-[#040D1A]/75 backdrop-blur-xs lg:hidden no-print"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Collapsible SaaS Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 bg-[#081629] text-[#F8FAFC] border-r border-[#1E3A5F] flex flex-col transition-all duration-200 lg:static lg:translate-x-0 no-print ${
          sidebarOpen ? 'translate-x-0 w-[268px]' : '-translate-x-full w-[268px]'
        } ${desktopCollapsed ? 'lg:w-[76px]' : 'lg:w-[268px]'}`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 border-b border-[#1E3A5F] flex items-center justify-between gap-2 shrink-0">
          <Link
            to="/admin"
            className="flex items-center gap-2.5 min-w-0"
            title="Prithvi Editify OS — Admin Workspace"
          >
            <img
              src={DEFAULT_STUDIO_LOGO_URL}
              alt="Prithvi Editify OS"
              className="h-9 w-auto rounded-md bg-white px-1.5 py-0.5 object-contain border border-[#1E3A5F] shrink-0"
            />
            {!desktopCollapsed && (
              <div className="min-w-0">
                <span className="text-sm font-bold tracking-tight text-[#F8FAFC] block truncate">
                  Prithvi Editify OS
                </span>
                <p className="text-[11px] text-[#94A3B8] truncate">Studio Admin Workspace</p>
              </div>
            )}
          </Link>

          <button
            type="button"
            onClick={() => setDesktopCollapsed((prev) => !prev)}
            className="hidden lg:inline-flex p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#132A4A] rounded-lg transition-colors shrink-0"
            title={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {desktopCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#132A4A] rounded-lg"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Grouped Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {NAV_GROUPS.map((groupName) => {
            const groupItems = ADMIN_NAV_ITEMS.filter((item) => item.group === groupName);
            return (
              <div key={groupName} className="space-y-1">
                {!desktopCollapsed && (
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]/70">
                    {groupName}
                  </p>
                )}
                {groupItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      title={desktopCollapsed ? item.label : undefined}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center ${
                          desktopCollapsed ? 'lg:justify-center lg:px-2' : 'gap-3 px-3'
                        } py-2.5 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap ${
                          isActive
                            ? 'bg-gradient-to-r from-[#0EA5E9] to-[#10B981] text-white font-semibold shadow-[0_6px_16px_-4px_rgba(16,185,129,0.45)]'
                            : 'text-[#94A3B8] hover:bg-[#132A4A] hover:text-[#F8FAFC]'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!desktopCollapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Sidebar Account Footer */}
        <div className="p-3 border-t border-[#1E3A5F] bg-[#081629] space-y-2 shrink-0">
          <div
            className={`flex items-center ${
              desktopCollapsed ? 'lg:justify-center' : 'gap-2.5 px-2'
            } py-1.5`}
          >
            <div className="w-8 h-8 rounded-lg bg-[#132A4A] border border-[#1E3A5F] flex items-center justify-center text-xs font-bold text-[#2DD4BF] shrink-0">
              {initials}
            </div>
            {!desktopCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#F8FAFC] truncate">
                  {profile?.displayName || 'Shankar Baluragi'}
                </p>
                <p className="text-[11px] text-[#94A3B8] truncate">{profile?.email}</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Sign Out"
            className={`w-full flex items-center ${
              desktopCollapsed ? 'lg:justify-center px-2' : 'gap-2.5 px-3'
            } py-2 text-xs font-medium text-[#F8FAFC] bg-[#132A4A] border border-[#1E3A5F] hover:bg-[#DC2626] hover:border-[#DC2626] rounded-lg transition-colors whitespace-nowrap`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!desktopCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top SaaS Workspace Bar */}
        <header className="sticky top-0 z-20 h-16 bg-[#081629]/95 backdrop-blur-md border-b border-[#1E3A5F] px-4 sm:px-6 flex items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-[#F8FAFC] hover:bg-[#132A4A] border border-[#1E3A5F] rounded-lg"
              aria-label="Open navigation menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="hidden md:flex items-center gap-2 text-xs text-[#94A3B8] min-w-0">
              <Link
                to="/admin"
                className="hover:text-[#F8FAFC] font-medium whitespace-nowrap hidden xl:inline"
              >
                Prithvi Editify OS
              </Link>
              <span className="hidden xl:inline text-[#1E3A5F]">/</span>
              <Link to="/admin" className="hover:text-[#F8FAFC] font-medium whitespace-nowrap">
                Admin
              </Link>
              <span className="text-[#1E3A5F]">/</span>
              <span className="text-[#F8FAFC] font-semibold truncate max-w-[160px]">
                {currentSection}
              </span>
            </div>
          </div>

          {/* Global Admin Search Bar (Clients, Projects, Invoices) */}
          <div ref={searchContainerRef} className="relative flex-1 max-w-md mx-auto">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onFocus={() => {
                  setSearchOpen(true);
                  loadSearchIndex();
                }}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!searchOpen) setSearchOpen(true);
                }}
                onKeyDown={handleSearchInputKeyDown}
                placeholder="Search clients, projects, invoices..."
                aria-label="Global admin search across clients, projects, and invoices"
                className="w-full pl-9 pr-16 py-1.5 text-xs bg-[#0D1F38] border border-[#1E3A5F] focus:border-[#10B981] rounded-lg text-[#F8FAFC] placeholder-[#64748B] outline-none transition-colors"
              />
              <div className="absolute right-2 flex items-center gap-1">
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="p-0.5 text-[#94A3B8] hover:text-[#F8FAFC] rounded"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-[#94A3B8] bg-[#132A4A] border border-[#1E3A5F] rounded">
                    ⌘K
                  </kbd>
                )}
              </div>
            </div>

            {/* Global Search Results Popover */}
            {searchOpen && (
              <div className="absolute left-0 right-0 mt-2 bg-[#081629] border border-[#1E3A5F] rounded-xl shadow-2xl overflow-hidden z-50">
                {/* Category Filter Tabs */}
                <div className="px-3 py-2 bg-[#0D1F38] border-b border-[#1E3A5F] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 overflow-x-auto">
                    {(
                      [
                        { id: 'all', label: 'All', count: matchedClients.length + matchedProjects.length + matchedInvoices.length },
                        { id: 'clients', label: 'Clients', count: matchedClients.length },
                        { id: 'projects', label: 'Projects', count: matchedProjects.length },
                        { id: 'invoices', label: 'Invoices', count: matchedInvoices.length },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSearchCategory(tab.id)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap ${
                          searchCategory === tab.id
                            ? 'bg-[#10B981] text-[#040D1A]'
                            : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#132A4A]'
                        }`}
                      >
                        {tab.label}{' '}
                        <span className="opacity-80">({tab.count})</span>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => loadSearchIndex(true)}
                    title="Refresh search index"
                    className="p-1 text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#132A4A] rounded-md transition-colors shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${searchLoading ? 'animate-spin text-[#10B981]' : ''}`} />
                  </button>
                </div>

                {/* Results List */}
                <div className="max-h-80 overflow-y-auto divide-y divide-[#1E3A5F]/60">
                  {searchLoading && !searchLoadedOnce ? (
                    <div className="p-6 text-center text-xs text-[#94A3B8]">
                      Loading studio clients, projects, and invoices...
                    </div>
                  ) : visibleResults.length === 0 ? (
                    <div className="p-6 text-center space-y-1">
                      <p className="text-xs font-semibold text-[#F8FAFC]">
                        No matching records found
                      </p>
                      <p className="text-[11px] text-[#94A3B8]">
                        Try searching by client name, project title, or invoice number (e.g. PE-INV).
                      </p>
                    </div>
                  ) : (
                    visibleResults.map((item, idx) => {
                      const isSelected = idx === activeIndex;
                      const CategoryIcon =
                        item.category === 'clients'
                          ? Users
                          : item.category === 'projects'
                          ? FolderKanban
                          : FileText;
                      const categoryLabel =
                        item.category === 'clients'
                          ? 'Client'
                          : item.category === 'projects'
                          ? 'Project'
                          : 'Invoice';

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => handleSelectResult(item)}
                          className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-3 transition-colors ${
                            isSelected ? 'bg-[#132A4A]' : 'hover:bg-[#0D1F38]'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="mt-0.5 w-7 h-7 rounded-lg bg-[#0D1F38] border border-[#1E3A5F] flex items-center justify-center shrink-0 text-[#2DD4BF]">
                              <CategoryIcon className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#2DD4BF]">
                                  {categoryLabel}
                                </span>
                                <span className="text-xs font-semibold text-[#F8FAFC] truncate">
                                  {item.title}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#94A3B8] truncate mt-0.5">
                                {item.subtitle}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border ${item.badgeTone}`}
                            >
                              {item.badgeText}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-[#94A3B8]" />
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Footer Shortcut Hints */}
                <div className="px-3 py-2 bg-[#0D1F38] border-t border-[#1E3A5F] flex items-center justify-between text-[10px] text-[#94A3B8]">
                  <span>
                    {normalizedQuery
                      ? `Showing matches for "${searchQuery}"`
                      : 'Recent studio records — type to filter'}
                  </span>
                  <span className="hidden sm:inline">↑↓ to navigate · Enter to open · Esc to close</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              to="/admin/projects"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg transition-all whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Projects</span>
            </Link>
            <Link
              to="/admin/invoices"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#F8FAFC] bg-[#132A4A] hover:bg-[#1E293B] border border-[#1E3A5F] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <FileText className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Invoices</span>
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#F8FAFC] bg-[#132A4A] hover:bg-[#1E293B] border border-[#1E3A5F] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <span>Public Site</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#94A3B8]" />
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto pe-page-enter">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

