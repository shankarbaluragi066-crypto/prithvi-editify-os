/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Copy, Check, Database } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  isSupabaseConfigured,
  getMissingSchemaStatus,
  subscribeMissingSchemaStatus,
} from './lib/supabaseClient';
import migrationSql from '../supabase/migrations/20261018000000_prithvi_editify_schema_and_rls.sql?raw';
import { PublicLayout } from './layouts/PublicLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { ClientLayout } from './layouts/ClientLayout';

import {
  HomePage,
  ServicesPage,
  ServiceDetailPage,
  PortfolioPage,
  PortfolioDetailPage,
  AboutPage,
  ContactPage,
  PrivacyPolicyPage,
  TermsPage,
  NotFoundPage,
} from './pages/PublicPages';

import { LoginPage, AdminLoginPage, ForgotPasswordPage } from './pages/AuthPages';

import {
  AdminDashboardPage,
  AdminInquiriesPage,
  AdminClientsPage,
  AdminClientDetailsPage,
  AdminProjectsPage,
  AdminProjectDetailsPage,
  AdminTasksPage,
} from './pages/AdminCorePages';

import {
  AdminServicesPage,
  AdminPortfolioPage,
  AdminInvoicesPage,
  AdminPaymentsPage,
  AdminFilesPage,
  AdminMediaLibraryPage,
  AdminReportsPage,
  AdminSettingsPage,
  SharedNotificationsPage,
  SharedProfilePage,
} from './pages/AdminBusinessPages';
import { AdminSiteCustomizerPage } from './pages/AdminSiteCustomizerPage';
import {
  AdminAICreativeAssistantPage,
  AdminQuotationsPage,
} from './pages/AdminAICreativeAssistantPage';
import { PublicQuotationApprovalPage } from './components/StudioEnhancements';

import {
  ClientDashboardPage,
  ClientProjectsPage,
  ClientProjectDetailsPage,
  ClientTimelinePage,
  ClientFilesPage,
  ClientInvoicesPage,
  ClientPaymentInstructionsPage,
  ClientMessagesPage,
} from './pages/ClientPortalPages';

const SupabaseSchemaBanner: React.FC = () => {
  const { isAdmin } = useAuth();
  const [missingSchema, setMissingSchema] = useState(getMissingSchemaStatus());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return subscribeMissingSchemaStatus(setMissingSchema);
  }, []);

  if (!isAdmin) return null;

  if (!isSupabaseConfigured) {
    return (
      <div className="bg-[#172333] text-[#F5F5F1] px-4 py-2 text-xs text-center border-b border-[#24364A]">
        <span className="font-semibold text-[#F18A45]">Supabase Setup Pending:</span> Configure{' '}
        <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
        <code className="font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</code> in your environment and run{' '}
        <code className="font-mono">supabase/migrations/20261018000000_prithvi_editify_schema_and_rls.sql</code>{' '}
        to activate live Supabase Auth, PostgreSQL, and Storage.
      </div>
    );
  }

  if (!missingSchema) return null;

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(migrationSql);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="bg-[#172333] text-[#F5F5F1] px-4 py-2.5 text-xs border-b border-[#24364A] flex flex-wrap items-center justify-center gap-3">
      <div className="flex items-center gap-2">
        <Database className="w-3.5 h-3.5 text-[#F18A45] shrink-0" />
        <span>
          <strong className="text-[#F18A45]">Database Tables Need Migration:</strong> Your Supabase project is connected, but the CRM tables/columns need to be created in your Supabase SQL Editor.
        </span>
      </div>
      <button
        type="button"
        onClick={handleCopySql}
        className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold text-[#172333] bg-[#F18A45] hover:bg-[#e07934] rounded-md transition-colors whitespace-nowrap shrink-0"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        <span>{copied ? 'Copied SQL Script! Paste in Supabase SQL Editor' : 'Copy SQL Migration Script'}</span>
      </button>
    </div>
  );
};

const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F1] text-xs text-[#6E7785]">
        Verifying administrator session...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/admin-login" replace />;
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F1] p-6">
        <div className="bg-white border border-[#E2E4DF] rounded-lg max-w-md w-full p-8 space-y-4">
          <h1 className="font-editorial text-xl font-semibold text-[#172333]">
            Administrator Access Restricted
          </h1>
          <p className="text-xs text-[#6E7785] leading-relaxed">
            Your current session has standard client permissions. Studio Administrator access is strictly restricted to the verified studio owner.
          </p>
          <div className="flex gap-3 pt-2">
            <Link
              to="/portal"
              className="px-4 py-2 text-xs font-semibold text-white bg-[#172333] rounded-lg"
            >
              Open My Client Portal
            </Link>
            <Link
              to="/"
              className="px-4 py-2 text-xs font-semibold text-[#172333] bg-[#F5F5F1] rounded-lg"
            >
              Public Website
            </Link>
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
};

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F1] text-xs text-[#6E7785]">
        Loading client portal workspace...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

function getRouterBasename(): string {
  const configuredBase = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    if (
      configuredBase &&
      configuredBase !== '' &&
      configuredBase !== '.' &&
      (pathname === configuredBase || pathname.startsWith(`${configuredBase}/`))
    ) {
      return configuredBase;
    }
    if (pathname === '/prithvi-editify' || pathname.startsWith('/prithvi-editify/')) {
      return '/prithvi-editify';
    }
    return '/';
  }
  return configuredBase && configuredBase !== '.' ? configuredBase : '/';
}

export default function App() {
  const routerBasename = getRouterBasename();

  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter basename={routerBasename}>
            <SupabaseSchemaBanner />
            <Routes>
              {/* Unlisted Private Studio Owner Login Routes */}
              <Route path="/admin-login" element={<AdminLoginPage />} />
              <Route path="/studio-admin" element={<AdminLoginPage />} />
              <Route path="/admin/login" element={<AdminLoginPage />} />

              {/* Public Studio Website Routes */}
              <Route element={<PublicLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/services" element={<ServicesPage />} />
                <Route path="/services/:slug" element={<ServiceDetailPage />} />
                <Route path="/portfolio" element={<PortfolioPage />} />
                <Route path="/portfolio/:slug" element={<PortfolioDetailPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/quote/:quoteId" element={<PublicQuotationApprovalPage />} />
                <Route path="/privacy" element={<PrivacyPolicyPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>

              {/* Protected Admin CRM Routes */}
              <Route
                path="/admin"
                element={
                  <RequireAdmin>
                    <AdminLayout />
                  </RequireAdmin>
                }
              >
                <Route index element={<AdminDashboardPage />} />
                <Route path="ai-assistant" element={<AdminAICreativeAssistantPage />} />
                <Route path="website-customizer" element={<AdminSiteCustomizerPage />} />
                <Route path="inquiries" element={<AdminInquiriesPage />} />
                <Route path="quotations" element={<AdminQuotationsPage />} />
                <Route path="estimates" element={<AdminQuotationsPage defaultDocType="Estimate" />} />
                <Route path="clients" element={<AdminClientsPage />} />
                <Route path="clients/:clientId" element={<AdminClientDetailsPage />} />
                <Route path="projects" element={<AdminProjectsPage />} />
                <Route path="projects/:projectId" element={<AdminProjectDetailsPage />} />
                <Route path="tasks" element={<AdminTasksPage />} />
                <Route path="services" element={<AdminServicesPage />} />
                <Route path="portfolio" element={<AdminPortfolioPage />} />
                <Route path="invoices" element={<AdminInvoicesPage />} />
                <Route path="payments" element={<AdminPaymentsPage />} />
                <Route path="media" element={<AdminMediaLibraryPage />} />
                <Route path="files" element={<AdminFilesPage />} />
                <Route path="reports" element={<AdminReportsPage />} />
                <Route path="notifications" element={<SharedNotificationsPage />} />
                <Route path="settings" element={<AdminSettingsPage />} />
                <Route path="profile" element={<SharedProfilePage />} />
              </Route>

              {/* Protected Client Portal Routes */}
              <Route
                path="/portal"
                element={
                  <RequireAuth>
                    <ClientLayout />
                  </RequireAuth>
                }
              >
                <Route index element={<ClientDashboardPage />} />
                <Route path="projects" element={<ClientProjectsPage />} />
                <Route path="projects/:projectId" element={<ClientProjectDetailsPage />} />
                <Route path="timeline" element={<ClientTimelinePage />} />
                <Route path="files" element={<ClientFilesPage />} />
                <Route path="invoices" element={<ClientInvoicesPage />} />
                <Route path="invoices/:invoiceId" element={<ClientInvoicesPage />} />
                <Route path="payment-instructions" element={<ClientPaymentInstructionsPage />} />
                <Route path="messages" element={<ClientMessagesPage />} />
                <Route path="notifications" element={<SharedNotificationsPage />} />
                <Route path="profile" element={<SharedProfilePage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
