import React, { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  Clock,
  FolderOpen,
  FileText,
  CreditCard,
  MessageSquare,
  Bell,
  UserCircle,
  LogOut,
  Menu,
  X,
  ExternalLink,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { DEFAULT_STUDIO_LOGO_URL } from '../utils/seedData';

const CLIENT_NAV_ITEMS = [
  { to: '/portal', label: 'Overview', icon: LayoutDashboard, end: true, group: 'Workspace' },
  { to: '/portal/projects', label: 'My Projects', icon: FolderKanban, group: 'Workspace' },
  { to: '/portal/timeline', label: 'Project Timeline', icon: Clock, group: 'Workspace' },
  { to: '/portal/files', label: 'Deliverable Files', icon: FolderOpen, group: 'Workspace' },
  { to: '/portal/invoices', label: 'Invoices & Quotes', icon: FileText, group: 'Billing & Support' },
  { to: '/portal/payment-instructions', label: 'Payment Guide', icon: CreditCard, group: 'Billing & Support' },
  { to: '/portal/messages', label: 'Project Messages', icon: MessageSquare, group: 'Billing & Support' },
  { to: '/portal/notifications', label: 'Notifications', icon: Bell, group: 'Account' },
  { to: '/portal/profile', label: 'Profile & Settings', icon: UserCircle, group: 'Account' },
];

const CLIENT_GROUPS = ['Workspace', 'Billing & Support', 'Account'];

export const ClientLayout: React.FC = () => {
  const { profile, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  const matchedItem = CLIENT_NAV_ITEMS.find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
  );
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const currentSection =
    matchedItem?.label ||
    (pathSegments[1]
      ? pathSegments[1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : 'Client Overview');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initials = (profile?.displayName || 'Client Account')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen flex bg-[#040D1A] text-[#F8FAFC]">
      {/* Mobile Drawer Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-[#040D1A]/75 backdrop-blur-xs lg:hidden no-print"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Client Portal Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 bg-[#081629] text-[#F8FAFC] border-r border-[#1E3A5F] flex flex-col transition-all duration-200 lg:static lg:translate-x-0 no-print ${
          sidebarOpen ? 'translate-x-0 w-[260px]' : '-translate-x-full w-[260px]'
        } ${desktopCollapsed ? 'lg:w-[76px]' : 'lg:w-[260px]'}`}
      >
        <div className="h-16 px-4 border-b border-[#1E3A5F] flex items-center justify-between gap-2 shrink-0">
          <Link
            to="/portal"
            className="flex items-center gap-2.5 min-w-0"
            title="Prithvi Editify OS — Client Portal"
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
                <p className="text-[11px] text-[#94A3B8] truncate">Client Portal</p>
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

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {CLIENT_GROUPS.map((groupName) => {
            const items = CLIENT_NAV_ITEMS.filter((item) => item.group === groupName);
            return (
              <div key={groupName} className="space-y-1">
                {!desktopCollapsed && (
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]/70">
                    {groupName}
                  </p>
                )}
                {items.map((item) => {
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
                  {profile?.displayName || 'Client Account'}
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-16 bg-[#081629]/95 backdrop-blur-md border-b border-[#1E3A5F] px-4 sm:px-6 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-[#F8FAFC] hover:bg-[#132A4A] border border-[#1E3A5F] rounded-lg"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-xs text-[#94A3B8] min-w-0">
              <Link
                to="/portal"
                className="hover:text-[#F8FAFC] font-medium whitespace-nowrap hidden sm:inline"
              >
                Prithvi Editify OS
              </Link>
              <span className="hidden sm:inline text-[#1E3A5F]">/</span>
              <Link to="/portal" className="hover:text-[#F8FAFC] font-medium whitespace-nowrap">
                Client Portal
              </Link>
              <span className="text-[#1E3A5F]">/</span>
              <span className="text-[#F8FAFC] font-semibold truncate">{currentSection}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {isAdmin && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#040D1A] bg-[#2DD4BF] hover:bg-[#10B981] rounded-lg transition-all whitespace-nowrap shrink-0"
              >
                <span>Admin Portal →</span>
              </Link>
            )}
            <Link
              to="/portal/book"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg transition-all whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Request New Project</span>
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#F8FAFC] bg-[#132A4A] hover:bg-[#1E293B] border border-[#1E3A5F] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <span className="hidden sm:inline">Studio Website</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#94A3B8]" />
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1320px] w-full mx-auto pe-page-enter">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
