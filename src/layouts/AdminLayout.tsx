import React, { useState } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { DEFAULT_STUDIO_LOGO_URL } from '../utils/seedData';

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

export const AdminLayout: React.FC = () => {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

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
        <header className="sticky top-0 z-20 h-16 bg-[#081629]/95 backdrop-blur-md border-b border-[#1E3A5F] px-4 sm:px-6 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-[#F8FAFC] hover:bg-[#132A4A] border border-[#1E3A5F] rounded-lg"
              aria-label="Open navigation menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 text-xs text-[#94A3B8] min-w-0">
              <Link
                to="/admin"
                className="hover:text-[#F8FAFC] font-medium whitespace-nowrap hidden sm:inline"
              >
                Prithvi Editify OS
              </Link>
              <span className="hidden sm:inline text-[#1E3A5F]">/</span>
              <Link to="/admin" className="hover:text-[#F8FAFC] font-medium whitespace-nowrap">
                Admin
              </Link>
              <span className="text-[#1E3A5F]">/</span>
              <span className="text-[#F8FAFC] font-semibold truncate">{currentSection}</span>
            </div>
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
