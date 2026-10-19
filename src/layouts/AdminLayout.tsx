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
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ADMIN_NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/inquiries', label: 'Leads & Inquiries', icon: MessageSquare },
  { to: '/admin/clients', label: 'Clients', icon: Users },
  { to: '/admin/projects', label: 'Projects', icon: FolderKanban },
  { to: '/admin/tasks', label: 'Tasks & Milestones', icon: CheckSquare },
  { to: '/admin/invoices', label: 'Invoices', icon: FileText },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard },
  { to: '/admin/media', label: 'Media Library', icon: ImageIcon },
  { to: '/admin/files', label: 'Deliverable Files', icon: FolderOpen },
  { to: '/admin/services', label: 'Services & Pricing', icon: Layers },
  { to: '/admin/portfolio', label: 'Portfolio', icon: Briefcase },
  { to: '/admin/reports', label: 'Reports & Analytics', icon: BarChart3 },
  { to: '/admin/notifications', label: 'Notifications', icon: Bell },
  { to: '/admin/settings', label: 'Studio Settings', icon: Settings },
  { to: '/admin/profile', label: 'Account Profile', icon: UserCircle },
];

export const AdminLayout: React.FC = () => {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const pathSegments = location.pathname.split('/').filter(Boolean);
  const currentSection = pathSegments[1]
    ? pathSegments[1].charAt(0).toUpperCase() + pathSegments[1].slice(1)
    : 'Dashboard';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-[#F5F5F1] text-[#172333]">
      {/* Sidebar Navigation (260px desktop) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[260px] bg-[#172333] text-[#F5F5F1] flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 no-print ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-6 py-5 border-b border-[#24364A] flex items-center justify-between">
          <div>
            <Link to="/admin" className="font-editorial text-lg font-semibold text-white block">
              Prithvi Editify
            </Link>
            <p className="text-xs text-[#9BA3B0] mt-0.5">Studio Admin CRM</p>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 text-[#9BA3B0] hover:text-white"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {ADMIN_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#F18A45] text-[#172333] font-semibold'
                      : 'text-[#D0D5DD] hover:bg-[#24364A] hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#24364A] space-y-2">
          <div className="px-2 py-1">
            <p className="text-xs font-semibold text-white truncate">
              {profile?.displayName || 'Shankar Baluragi'}
            </p>
            <p className="text-[11px] text-[#9BA3B0] truncate">{profile?.email}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#F5F5F1] bg-[#24364A] hover:bg-[#B93832] rounded-lg transition-colors whitespace-nowrap"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar with Breadcrumbs and Single Action */}
        <header className="bg-white border-b border-[#E2E4DF] px-6 py-3.5 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 text-[#172333] hover:bg-[#F5F5F1] rounded-lg"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs text-[#6E7785] truncate">
              <Link to="/admin" className="hover:text-[#172333] font-medium">
                Admin Console
              </Link>
              <span>/</span>
              <span className="text-[#172333] font-semibold truncate">{currentSection}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <span>Public Studio Site</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 max-w-[1360px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
