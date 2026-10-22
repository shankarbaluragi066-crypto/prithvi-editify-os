import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Database,
  ArrowRight,
  UserPlus,
  FolderPlus,
  Trash2,
  Edit3,
  CheckCircle2,
  Send,
  Lock,
  Eye,
  Clock,
  FileText,
  FolderKanban,
  Sparkles,
  LayoutGrid,
  List,
  MapPin,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  fetchAllClientsAdmin,
  saveClientAdmin,
  fetchAllInquiriesAdmin,
  updateInquiryAdmin,
  deleteInquiryAdmin,
  fetchAllProjectsAdmin,
  saveProjectAdmin,
  fetchProjectInternalNoteAdmin,
  fetchAllTasksAdmin,
  saveTaskAdmin,
  deleteTaskAdmin,
  fetchAllInvoicesAdmin,
  fetchAllPaymentsAdmin,
  fetchProjectMessages,
  postProjectMessage,
  seedInitialStudioCatalog,
  fetchAllServicesAdmin,
  fetchAllFilesAdmin,
  checkClientDependenciesAdmin,
  archiveClientAdmin,
  deleteClientAdmin,
  checkProjectDependenciesAdmin,
  archiveProjectAdmin,
  deleteProjectAdmin,
  duplicateProjectAdmin,
} from '../services/crmService';
import {
  fetchAllQuotationsAdmin,
  inferQuotationDocumentType,
} from '../services/aiAssistantService';
import {
  PROJECT_MILESTONE_TEMPLATES,
  buildTasksFromMilestoneTemplate,
  generateAIDraftedQuotationFromInquiry,
  getProofingPins,
  checkProjectMasterUnlockStatus,
} from '../services/workflowEnhancementsService';
import {
  DependencySafeDeleteModal,
  SafeDeleteModalConfig,
  UnsavedChangesDialog,
  RecordActionBar,
} from '../components/CrudManagementModals';
import {
  ClientRecord,
  InquiryRecord,
  InquiryStatus,
  ProjectRecord,
  ProjectStatus,
  PriorityLevel,
  TaskRecord,
  TaskStatus,
  InvoiceRecord,
  PaymentRecord,
  ProjectMessage,
  QuotationRecord,
  DeliverableFile,
} from '../types/crm';
import { formatINR, formatDate } from '../utils/formatters';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

// ============================================================================
// 1. ADMIN DASHBOARD PAGE
// ============================================================================
export const AdminDashboardPage: React.FC = () => {
  const { showToast } = useToast();
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [c, inq, p, inv, pay] = await Promise.all([
        fetchAllClientsAdmin(),
        fetchAllInquiriesAdmin(),
        fetchAllProjectsAdmin(),
        fetchAllInvoicesAdmin(),
        fetchAllPaymentsAdmin(),
      ]);
      setClients(c);
      setInquiries(inq);
      setProjects(p);
      setInvoices(inv);
      setPayments(pay);
    } catch (err) {
      showToast('error', 'Failed to load dashboard metrics', err instanceof Error ? err.message : '');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleSeedCatalog = async () => {
    setSeeding(true);
    try {
      const res = await seedInitialStudioCatalog();
      showToast(
        'success',
        'Studio Catalog Synchronized',
        `Seeded ${res.servicesSeeded} services and ${res.portfolioSeeded} demonstration portfolio items.`
      );
    } catch (err) {
      showToast('error', 'Seed Failed', err instanceof Error ? err.message : '');
    } finally {
      setSeeding(false);
    }
  };

  const pendingProjects = useMemo(
    () =>
      projects.filter((p) =>
        [
          'Inquiry',
          'Planned',
          'In Progress',
          'Waiting for Client',
          'In Review',
          'Revision Requested',
          'On Hold',
        ].includes(p.status)
      ),
    [projects]
  );

  const activeProjects = projects.filter((p) =>
    ['Planned', 'In Progress', 'Waiting for Client', 'Revision Requested'].includes(p.status)
  );
  const reviewProjects = projects.filter((p) => p.status === 'In Review');
  const completedProjects = projects.filter((p) => p.status === 'Completed');
  const openInquiries = inquiries.filter((i) =>
    ['New', 'Contacted', 'Qualified', 'Proposal Sent'].includes(i.status)
  );
  const unpaidInvoices = invoices.filter((i) => ['Sent', 'Partially Paid'].includes(i.status));
  const overdueInvoices = invoices.filter((i) => i.status === 'Overdue');
  const totalRecordedPayments = payments.reduce((sum, pay) => sum + (Number(pay.amount) || 0), 0);

  // 1. Recharts Data: Pending Projects Status Breakdown
  const projectStatusChartData = useMemo(() => {
    const groups: { name: string; value: number; color: string }[] = [
      {
        name: 'In Progress',
        value: projects.filter((p) => p.status === 'In Progress').length,
        color: '#172333',
      },
      {
        name: 'Planned / Inquiry',
        value: projects.filter((p) => ['Planned', 'Inquiry'].includes(p.status)).length,
        color: '#24364A',
      },
      {
        name: 'In Review',
        value: projects.filter((p) => p.status === 'In Review').length,
        color: '#F18A45',
      },
      {
        name: 'Revision / Waiting',
        value: projects.filter((p) =>
          ['Revision Requested', 'Waiting for Client', 'On Hold'].includes(p.status)
        ).length,
        color: '#A96518',
      },
      {
        name: 'Completed',
        value: projects.filter((p) => p.status === 'Completed').length,
        color: '#26734D',
      },
    ];
    const activeSlices = groups.filter((g) => g.value > 0);
    return activeSlices.length > 0
      ? activeSlices
      : [{ name: 'No Projects Yet', value: 1, color: '#E2E4DF' }];
  }, [projects]);

  // 2. Recharts Data: Upcoming Deadlines Horizon
  const { deadlineChartData, sortedUpcomingDeadlines, urgentDeadlinesCount } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const buckets = [
      { horizon: 'Overdue', count: 0, color: '#B93832' },
      { horizon: '≤ 3 Days', count: 0, color: '#F18A45' },
      { horizon: '4–7 Days', count: 0, color: '#A96518' },
      { horizon: '8–14 Days', count: 0, color: '#172333' },
      { horizon: '15+ Days', count: 0, color: '#24364A' },
    ];

    const withDays: { project: ProjectRecord; diffDays: number }[] = [];

    pendingProjects.forEach((proj) => {
      if (!proj.deadline) {
        buckets[4].count += 1;
        return;
      }
      const d = new Date(proj.deadline);
      if (Number.isNaN(d.getTime())) {
        buckets[4].count += 1;
        return;
      }
      d.setHours(0, 0, 0, 0);
      const diffDays = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      withDays.push({ project: proj, diffDays });

      if (diffDays < 0) buckets[0].count += 1;
      else if (diffDays <= 3) buckets[1].count += 1;
      else if (diffDays <= 7) buckets[2].count += 1;
      else if (diffDays <= 14) buckets[3].count += 1;
      else buckets[4].count += 1;
    });

    withDays.sort((a, b) => a.diffDays - b.diffDays);

    return {
      deadlineChartData: buckets,
      sortedUpcomingDeadlines: withDays.slice(0, 4),
      urgentDeadlinesCount: buckets[0].count + buckets[1].count + buckets[2].count,
    };
  }, [pendingProjects]);

  // 3. Recharts Data: Recent Invoices (Billed vs Paid vs Balance Due)
  const { recentInvoicesChartData, totalOutstandingINR } = useMemo(() => {
    const activeInvs = invoices.filter((i) => i.status !== 'Cancelled');
    const recentSlice = activeInvs.slice(0, 6);

    const chartData =
      recentSlice.length > 0
        ? recentSlice.map((inv) => ({
            invoice: inv.invoiceNumber.replace(/^PE-INV-\d{4}-/, '#'),
            fullNumber: inv.invoiceNumber,
            client: inv.clientName,
            billed: Number(inv.total) || 0,
            paid: Number(inv.amountPaid) || 0,
            due: Number(inv.balanceDue) || 0,
          }))
        : [
            {
              invoice: 'None',
              fullNumber: 'No Invoices Yet',
              client: '—',
              billed: 0,
              paid: 0,
              due: 0,
            },
          ];

    const outstanding = activeInvs.reduce((sum, inv) => sum + (Number(inv.balanceDue) || 0), 0);
    return { recentInvoicesChartData: chartData, totalOutstandingINR: outstanding };
  }, [invoices]);

  return (
    <div className="space-y-8">
      {/* Header & Seed Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#172333]">
            Studio Command Center
          </h1>
          <p className="text-xs text-[#6E7785] mt-1">
            Live metrics and visual telemetry derived directly from Supabase PostgreSQL records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link
            to="/admin/website-customizer"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#172333] bg-[#F18A45] hover:bg-[#e07934] rounded-lg transition-colors whitespace-nowrap"
          >
            <span>Customize Website (A–Z)</span>
          </Link>
          <button
            type="button"
            disabled={seeding}
            onClick={handleSeedCatalog}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#172333] bg-white border border-[#E2E4DF] hover:border-[#172333] rounded-lg transition-colors whitespace-nowrap"
          >
            <Database className="w-3.5 h-3.5 text-[#F18A45]" />
            <span>{seeding ? 'Seeding Catalog...' : 'Sync Default Services & Demo Portfolio'}</span>
          </button>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="bg-white border border-[#E2E4DF] rounded-lg p-4 flex flex-wrap items-center gap-2.5">
        <span className="text-xs font-semibold text-[#6E7785] mr-2">Quick Actions:</span>
        <Link
          to="/admin/ai-assistant"
          className="px-3 py-1.5 text-xs font-semibold text-[#172333] bg-[#F18A45] hover:bg-[#e07934] rounded-md transition-colors whitespace-nowrap"
        >
          ✦ AI Creative Assistant
        </Link>
        <Link
          to="/admin/website-customizer"
          className="px-3 py-1.5 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-md transition-colors whitespace-nowrap"
        >
          Customize Website (A–Z)
        </Link>
        <Link
          to="/admin/quotations"
          className="px-3 py-1.5 text-xs font-medium text-white bg-[#172333] hover:bg-[#24364A] rounded-md transition-colors whitespace-nowrap"
        >
          + New Quotation
        </Link>
        <Link
          to="/admin/clients"
          className="px-3 py-1.5 text-xs font-medium text-white bg-[#172333] hover:bg-[#24364A] rounded-md transition-colors whitespace-nowrap"
        >
          + Add Client
        </Link>
        <Link
          to="/admin/projects"
          className="px-3 py-1.5 text-xs font-medium text-white bg-[#172333] hover:bg-[#24364A] rounded-md transition-colors whitespace-nowrap"
        >
          + Create Project
        </Link>
        <Link
          to="/admin/invoices"
          className="px-3 py-1.5 text-xs font-medium text-white bg-[#172333] hover:bg-[#24364A] rounded-md transition-colors whitespace-nowrap"
        >
          + Create Invoice
        </Link>
        <Link
          to="/admin/inquiries"
          className="px-3 py-1.5 text-xs font-medium text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-md transition-colors whitespace-nowrap"
        >
          Review Inquiries ({openInquiries.length})
        </Link>
        <Link
          to="/admin/portfolio"
          className="px-3 py-1.5 text-xs font-medium text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-md transition-colors whitespace-nowrap"
        >
          + Add Portfolio Item
        </Link>
        <Link
          to="/admin/services"
          className="px-3 py-1.5 text-xs font-medium text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-md transition-colors whitespace-nowrap"
        >
          + Add Service
        </Link>
      </div>

      {/* 8 Summary Metric Cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div key={n} className="h-24 bg-white border border-[#E2E4DF] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E2E4DF] rounded-lg p-5">
            <p className="text-xs text-[#6E7785]">Total Clients</p>
            <p className="text-2xl font-mono font-semibold text-[#172333] mt-1 tabular-nums">
              {clients.length}
            </p>
          </div>
          <div className="bg-white border border-[#E2E4DF] rounded-lg p-5">
            <p className="text-xs text-[#6E7785]">Active Projects</p>
            <p className="text-2xl font-mono font-semibold text-[#172333] mt-1 tabular-nums">
              {activeProjects.length}
            </p>
          </div>
          <div className="bg-white border border-[#E2E4DF] rounded-lg p-5">
            <p className="text-xs text-[#6E7785]">Awaiting Review</p>
            <p className="text-2xl font-mono font-semibold text-[#A96518] mt-1 tabular-nums">
              {reviewProjects.length}
            </p>
          </div>
          <div className="bg-white border border-[#E2E4DF] rounded-lg p-5">
            <p className="text-xs text-[#6E7785]">Completed Projects</p>
            <p className="text-2xl font-mono font-semibold text-[#26734D] mt-1 tabular-nums">
              {completedProjects.length}
            </p>
          </div>
          <div className="bg-white border border-[#E2E4DF] rounded-lg p-5">
            <p className="text-xs text-[#6E7785]">Open Inquiries</p>
            <p className="text-2xl font-mono font-semibold text-[#172333] mt-1 tabular-nums">
              {openInquiries.length}
            </p>
          </div>
          <div className="bg-white border border-[#E2E4DF] rounded-lg p-5">
            <p className="text-xs text-[#6E7785]">Unpaid Invoices</p>
            <p className="text-2xl font-mono font-semibold text-[#A96518] mt-1 tabular-nums">
              {unpaidInvoices.length}
            </p>
          </div>
          <div className="bg-white border border-[#E2E4DF] rounded-lg p-5">
            <p className="text-xs text-[#6E7785]">Overdue Invoices</p>
            <p className="text-2xl font-mono font-semibold text-[#B93832] mt-1 tabular-nums">
              {overdueInvoices.length}
            </p>
          </div>
          <div className="bg-white border border-[#E2E4DF] rounded-lg p-5">
            <p className="text-xs text-[#6E7785]">Total Recorded Payments</p>
            <p className="text-2xl font-mono font-semibold text-[#26734D] mt-1 tabular-nums">
              {formatINR(totalRecordedPayments)}
            </p>
          </div>
        </div>
      )}

      {/* RECHARTS VISUAL SUMMARY CARDS: Pending Projects, Upcoming Deadlines, Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visual Summary Card 1: Total Pending Projects & Status Breakdown */}
        <div className="bg-white border border-[#E2E4DF] rounded-lg p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-[#6E7785]">Pending Projects Pipeline</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-mono font-semibold text-[#172333] tabular-nums">
                    {pendingProjects.length}
                  </span>
                  <span className="text-xs text-[#6E7785]">
                    pending · {completedProjects.length} completed
                  </span>
                </div>
              </div>
              <FolderKanban className="w-4 h-4 text-[#F18A45] shrink-0 mt-1" />
            </div>

            <div className="h-48 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={projectStatusChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                    stroke="#FFFFFF"
                    strokeWidth={2}
                  >
                    {projectStatusChartData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E4DF',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#172333',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E2E4DF] space-y-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[#6E7785]">
                <span>In Progress</span>
                <span className="font-mono font-semibold text-[#172333] tabular-nums">
                  {projects.filter((p) => p.status === 'In Progress').length}
                </span>
              </div>
              <div className="flex items-center justify-between text-[#6E7785]">
                <span>In Review</span>
                <span className="font-mono font-semibold text-[#F18A45] tabular-nums">
                  {reviewProjects.length}
                </span>
              </div>
              <div className="flex items-center justify-between text-[#6E7785]">
                <span>Planned / Brief</span>
                <span className="font-mono font-semibold text-[#172333] tabular-nums">
                  {projects.filter((p) => ['Planned', 'Inquiry'].includes(p.status)).length}
                </span>
              </div>
              <div className="flex items-center justify-between text-[#6E7785]">
                <span>Revisions</span>
                <span className="font-mono font-semibold text-[#A96518] tabular-nums">
                  {projects.filter((p) => p.status === 'Revision Requested').length}
                </span>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <Link
                to="/admin/projects"
                className="text-xs font-semibold text-[#172333] hover:text-[#F18A45]"
              >
                Open Project Board →
              </Link>
            </div>
          </div>
        </div>

        {/* Visual Summary Card 2: Upcoming Deadlines Horizon */}
        <div className="bg-white border border-[#E2E4DF] rounded-lg p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-[#6E7785]">Upcoming Deadlines (7-Day Alert)</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-mono font-semibold text-[#172333] tabular-nums">
                    {urgentDeadlinesCount}
                  </span>
                  <span className="text-xs text-[#6E7785]">due within 7 days or overdue</span>
                </div>
              </div>
              <Clock className="w-4 h-4 text-[#F18A45] shrink-0 mt-1" />
            </div>

            <div className="h-48 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={deadlineChartData}
                  margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E4DF" vertical={false} />
                  <XAxis
                    dataKey="horizon"
                    tick={{ fontSize: 10, fill: '#6E7785' }}
                    axisLine={{ stroke: '#E2E4DF' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: '#6E7785' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: '#F5F5F1' }}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E4DF',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#172333',
                    }}
                  />
                  <Bar dataKey="count" name="Pending Projects" radius={[4, 4, 0, 0]}>
                    {deadlineChartData.map((entry, idx) => (
                      <Cell key={`dl-cell-${idx}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E2E4DF] space-y-2">
            {sortedUpcomingDeadlines.length === 0 ? (
              <p className="text-xs text-[#6E7785]">No scheduled pending deadlines.</p>
            ) : (
              <div className="space-y-1.5">
                {sortedUpcomingDeadlines.slice(0, 2).map(({ project, diffDays }) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <Link
                      to={`/admin/projects/${project.id}`}
                      className="font-medium text-[#172333] hover:text-[#F18A45] truncate"
                    >
                      {project.title}
                    </Link>
                    <span
                      className={`font-mono shrink-0 tabular-nums ${
                        diffDays < 0
                          ? 'text-[#B93832] font-semibold'
                          : diffDays <= 3
                          ? 'text-[#A96518] font-semibold'
                          : 'text-[#6E7785]'
                      }`}
                    >
                      {diffDays < 0
                        ? `${Math.abs(diffDays)}d overdue`
                        : diffDays === 0
                        ? 'Due today'
                        : `In ${diffDays}d`}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="pt-1 flex justify-end">
              <Link
                to="/admin/tasks"
                className="text-xs font-semibold text-[#172333] hover:text-[#F18A45]"
              >
                Manage Milestones →
              </Link>
            </div>
          </div>
        </div>

        {/* Visual Summary Card 3: Recent Invoices (Billed vs Paid in INR) */}
        <div className="bg-white border border-[#E2E4DF] rounded-lg p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-[#6E7785]">Recent Invoices & Balance Due</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-mono font-semibold text-[#172333] tabular-nums">
                    {formatINR(totalOutstandingINR)}
                  </span>
                  <span className="text-xs text-[#6E7785]">outstanding across {unpaidInvoices.length + overdueInvoices.length} invoices</span>
                </div>
              </div>
              <FileText className="w-4 h-4 text-[#F18A45] shrink-0 mt-1" />
            </div>

            <div className="h-48 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={recentInvoicesChartData}
                  margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E4DF" vertical={false} />
                  <XAxis
                    dataKey="invoice"
                    tick={{ fontSize: 10, fill: '#6E7785' }}
                    axisLine={{ stroke: '#E2E4DF' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#6E7785' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => (val >= 1000 ? `₹${Math.round(val / 1000)}k` : `₹${val}`)}
                  />
                  <Tooltip
                    cursor={{ fill: '#F5F5F1' }}
                    formatter={(value) => formatINR(Number(value) || 0)}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E4DF',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#172333',
                    }}
                  />
                  <Bar dataKey="paid" name="Paid (INR)" stackId="a" fill="#26734D" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="due" name="Balance Due (INR)" stackId="a" fill="#F18A45" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E2E4DF] space-y-2">
            {invoices.length === 0 ? (
              <p className="text-xs text-[#6E7785]">No invoices issued yet.</p>
            ) : (
              <div className="space-y-1.5">
                {invoices.slice(0, 2).map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-medium text-[#172333] truncate">
                      {inv.invoiceNumber} · {inv.clientName}
                    </span>
                    <span className="font-mono font-semibold text-[#172333] tabular-nums shrink-0">
                      {formatINR(inv.total)} ({inv.status})
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="pt-1 flex justify-end">
              <Link
                to="/admin/invoices"
                className="text-xs font-semibold text-[#172333] hover:text-[#F18A45]"
              >
                Open Invoices Ledger →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Projects & Inquiries Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E2E4DF] rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[#172333]">Recent Projects & Deadlines</h2>
            <Link to="/admin/projects" className="text-xs font-semibold text-[#172333] hover:text-[#F18A45]">
              View All →
            </Link>
          </div>
          {projects.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#6E7785]">
              No projects created yet. Convert an inquiry or click "+ Create Project".
            </div>
          ) : (
            <div className="divide-y divide-[#E2E4DF]">
              {projects.slice(0, 5).map((proj) => (
                <div key={proj.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <Link
                      to={`/admin/projects/${proj.id}`}
                      className="text-sm font-semibold text-[#172333] hover:text-[#F18A45] truncate block"
                    >
                      {proj.title}
                    </Link>
                    <p className="text-xs text-[#6E7785] truncate">
                      {proj.clientName} · {proj.status} · Due {proj.deadline || 'TBD'}
                    </p>
                  </div>
                  <span className="font-mono text-xs font-semibold text-[#172333] tabular-nums shrink-0">
                    {proj.progress}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E2E4DF] rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[#172333]">Recent Lead Inquiries</h2>
            <Link to="/admin/inquiries" className="text-xs font-semibold text-[#172333] hover:text-[#F18A45]">
              Manage Leads →
            </Link>
          </div>
          {inquiries.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#6E7785]">
              No inquiries received yet. Public contact form submissions appear here automatically.
            </div>
          ) : (
            <div className="divide-y divide-[#E2E4DF]">
              {inquiries.slice(0, 5).map((inq) => (
                <div key={inq.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#172333] truncate">{inq.fullName}</p>
                    <p className="text-xs text-[#6E7785] truncate">
                      {inq.serviceRequired} · {inq.budgetRange}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-[#172333] shrink-0">{inq.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. ADMIN LEADS & INQUIRIES PAGE
// ============================================================================
const INQUIRY_STATUSES: InquiryStatus[] = [
  'New',
  'Contacted',
  'Qualified',
  'Proposal Sent',
  'Converted',
  'Closed',
  'Spam',
];

export const AdminInquiriesPage: React.FC = () => {
  const { showToast, confirmAction } = useToast();
  const navigate = useNavigate();
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<InquiryRecord | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [sourceDraft, setSourceDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiDraftingId, setAiDraftingId] = useState<string | null>(null);

  const loadInquiries = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchAllInquiriesAdmin();
      setInquiries(list);
    } catch (err) {
      showToast('error', 'Failed to load inquiries', err instanceof Error ? err.message : '');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadInquiries();
  }, [loadInquiries]);

  const filtered = inquiries.filter((i) => {
    const matchesStatus = filterStatus === 'All' || i.status === filterStatus;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      i.fullName.toLowerCase().includes(q) ||
      i.email.toLowerCase().includes(q) ||
      i.serviceRequired.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const handleSelect = (inq: InquiryRecord) => {
    setSelected(inq);
    setNotesDraft(inq.internalNotes || '');
    setSourceDraft(inq.leadSource || 'Website Inquiry Form');
  };

  const handleSaveDetails = async (newStatus?: InquiryStatus) => {
    if (!selected) return;
    try {
      await updateInquiryAdmin(selected, {
        status: newStatus || selected.status,
        internalNotes: notesDraft,
        leadSource: sourceDraft,
      });
      showToast('success', 'Inquiry Updated');
      await loadInquiries();
      setSelected((prev) =>
        prev
          ? {
              ...prev,
              status: newStatus || prev.status,
              internalNotes: notesDraft,
              leadSource: sourceDraft,
            }
          : null
      );
    } catch (err) {
      showToast('error', 'Update Failed', err instanceof Error ? err.message : '');
    }
  };

  const handleConvertInquiry = async (inq: InquiryRecord) => {
    try {
      const clientId = await saveClientAdmin({
        userId: '',
        fullName: inq.fullName,
        email: inq.email,
        phone: inq.phone,
        companyName: inq.companyName || inq.fullName,
        country: 'India',
        preferredContact: 'WhatsApp',
        accountStatus: 'active',
        adminNotes: `Converted from inquiry (${inq.id}). Budget range: ${inq.budgetRange}`,
      });

      const today = new Date().toISOString().split('T')[0];
      const projectId = await saveProjectAdmin(
        {
          clientId,
          clientUserId: '',
          clientName: inq.fullName,
          clientEmail: inq.email,
          title: `${inq.serviceRequired} — ${inq.companyName || inq.fullName}`,
          description: inq.description,
          serviceType: inq.serviceRequired,
          brief: inq.description,
          budget: 0,
          startDate: today,
          deadline: inq.preferredDeadline || today,
          priority: 'Medium',
          status: 'Planned',
          progress: 10,
          latestUpdate: 'Converted from inquiry. Scope and project brief initialized.',
        },
        `Converted from inquiry ID ${inq.id}. Internal notes: ${inq.internalNotes || 'None'}`
      );

      await updateInquiryAdmin(inq, { status: 'Converted' });
      showToast(
        'success',
        'Converted to Client & Project',
        `Client and Project created for ${inq.fullName}.`
      );
      navigate(`/admin/projects/${projectId}`);
    } catch (err) {
      showToast('error', 'Conversion Failed', err instanceof Error ? err.message : '');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-editorial text-2xl font-semibold text-[#172333]">Leads & Inquiries</h1>
          <p className="text-xs text-[#6E7785] mt-1">
            Review incoming briefs, qualify leads, and convert inquiries directly into clients and projects.
          </p>
        </div>
      </div>

      {/* Search & Status Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#E2E4DF]/60 rounded-lg w-fit">
          {['All', ...INQUIRY_STATUSES].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                filterStatus === st
                  ? 'bg-white text-[#172333] shadow-sm font-semibold'
                  : 'text-[#6E7785] hover:text-[#172333]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-[#6E7785] absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, service..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E2E4DF] rounded-lg"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Inquiries List */}
        <div className="lg:col-span-7 bg-white border border-[#E2E4DF] rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-xs text-[#6E7785]">Loading inquiries...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#6E7785]">
              No inquiries match the current filter.
            </div>
          ) : (
            <div className="divide-y divide-[#E2E4DF]">
              {filtered.map((inq) => (
                <div
                  key={inq.id}
                  onClick={() => handleSelect(inq)}
                  className={`p-4 cursor-pointer hover:bg-[#F5F5F1]/60 transition-colors ${
                    selected?.id === inq.id ? 'bg-[#F5F5F1]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-[#172333]">{inq.fullName}</p>
                    <span className="text-xs font-medium text-[#172333]">{inq.status}</span>
                  </div>
                  <p className="text-xs text-[#6E7785] mt-1">
                    {inq.serviceRequired} · {inq.budgetRange} · {inq.phone}
                  </p>
                  <p className="text-xs text-[#6E7785] mt-1 line-clamp-1">{inq.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Inquiry Detail Inspector */}
        <div className="lg:col-span-5 bg-white border border-[#E2E4DF] rounded-lg p-6">
          {!selected ? (
            <p className="text-xs text-[#6E7785] text-center py-12">
              Select an inquiry on the left to inspect its project brief, add internal notes, or convert to a client and project.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-[#E2E4DF] pb-4">
                <div>
                  <h2 className="text-lg font-semibold text-[#172333]">{selected.fullName}</h2>
                  <p className="text-xs text-[#6E7785]">
                    {selected.email} · {selected.phone}
                  </p>
                  {selected.companyName && (
                    <p className="text-xs text-[#6E7785]">Brand: {selected.companyName}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    confirmAction({
                      title: 'Delete Inquiry',
                      message: `Permanently delete the inquiry from ${selected.fullName}?`,
                      onConfirm: async () => {
                        await deleteInquiryAdmin(selected.id, selected.fullName);
                        setSelected(null);
                        await loadInquiries();
                        showToast('success', 'Inquiry Deleted');
                      },
                    })
                  }
                  className="text-xs text-[#B93832] hover:underline"
                >
                  Delete
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <p>
                  <span className="font-semibold">Service:</span> {selected.serviceRequired}
                </p>
                <p>
                  <span className="font-semibold">Budget Range:</span> {selected.budgetRange}
                </p>
                <p>
                  <span className="font-semibold">Preferred Deadline:</span>{' '}
                  {selected.preferredDeadline || 'Flexible'}
                </p>
                <div className="p-3 bg-[#F5F5F1] rounded-lg text-[#172333] leading-relaxed">
                  {selected.description}
                </div>
                {selected.referenceFileUrl && (
                  <p className="text-xs">
                    <span className="font-semibold">Attachment:</span>{' '}
                    {selected.referenceFileUrl.startsWith('http') ? (
                      <a
                        href={selected.referenceFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-[#F18A45]"
                      >
                        View Reference File
                      </a>
                    ) : (
                      selected.referenceFileUrl
                    )}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172333] mb-1">Update Status</label>
                <select
                  value={selected.status}
                  onChange={(e) => handleSaveDetails(e.target.value as InquiryStatus)}
                  className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                >
                  {INQUIRY_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172333] mb-1">Lead Source</label>
                <input
                  type="text"
                  value={sourceDraft}
                  onChange={(e) => setSourceDraft(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172333] mb-1">
                  Internal Studio Notes (Admin Only)
                </label>
                <textarea
                  rows={3}
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleSaveDetails()}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg"
                >
                  Save Notes
                </button>
                <button
                  type="button"
                  disabled={aiDraftingId === selected.id}
                  onClick={async () => {
                    setAiDraftingId(selected.id);
                    try {
                      const servicesList = await fetchAllServicesAdmin().catch(() => []);
                      const aiDraftedQuote = await generateAIDraftedQuotationFromInquiry(
                        selected,
                        servicesList
                      );
                      showToast(
                        'success',
                        'AI Quotation Drafted',
                        `Drafted ${aiDraftedQuote.lineItems.length} line items for ${selected.fullName}.`
                      );
                      navigate('/admin/quotations', {
                        state: { fromInquiry: selected, aiDraftedQuote },
                      });
                    } catch (err) {
                      showToast(
                        'error',
                        'AI Quote Draft Failed',
                        err instanceof Error ? err.message : ''
                      );
                    } finally {
                      setAiDraftingId(null);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#F18A45] hover:bg-[#e07934] rounded-lg disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {aiDraftingId === selected.id ? 'Drafting with AI...' : 'Draft Quote with AI'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate('/admin/quotations', {
                      state: { fromInquiry: selected },
                    })
                  }
                  className="px-3.5 py-2 text-xs font-semibold text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] border border-[#E2E4DF] rounded-lg"
                >
                  Prepare Blank Quote →
                </button>
                <button
                  type="button"
                  onClick={() => handleConvertInquiry(selected)}
                  className="px-3.5 py-2 text-xs font-semibold text-[#172333] border border-[#172333] hover:bg-[#172333] hover:text-white rounded-lg transition-colors"
                >
                  Convert to Client & Project →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. ADMIN CLIENTS & CLIENT DETAILS PAGES (COMPLETE CRUD & DEPENDENCY SAFETY)
// ============================================================================
export const AdminClientsPage: React.FC = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'invited' | 'deactivated'>('all');

  // Create / Edit Form Modal State
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRecord | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [savingClient, setSavingClient] = useState(false);

  // Quick View Client Details Modal State
  const [viewingClient, setViewingClient] = useState<ClientRecord | null>(null);

  // Safe Delete Modal State
  const [deleteModal, setDeleteModal] = useState<SafeDeleteModalConfig | null>(null);

  const emptyClientForm = {
    fullName: '',
    email: '',
    phone: '',
    companyName: '',
    country: 'India',
    preferredContact: 'WhatsApp' as 'Email' | 'WhatsApp' | 'Phone',
    accountStatus: 'active' as 'active' | 'invited' | 'deactivated',
    userId: '',
    adminNotes: '',
  };

  const [formData, setFormData] = useState(emptyClientForm);

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const [cList, pList, invList, qList, inqList] = await Promise.all([
        fetchAllClientsAdmin(),
        fetchAllProjectsAdmin().catch(() => []),
        fetchAllInvoicesAdmin().catch(() => []),
        fetchAllQuotationsAdmin().catch(() => []),
        fetchAllInquiriesAdmin().catch(() => []),
      ]);
      setClients(cList);
      setProjects(pList);
      setInvoices(invList);
      setQuotations(qList);
      setInquiries(inqList);
    } catch (err) {
      showToast('error', 'Failed to load clients', err instanceof Error ? err.message : '');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const handleOpenCreate = () => {
    setEditingClient(null);
    setFormData(emptyClientForm);
    setIsDirty(false);
    setShowForm(true);
  };

  const handleOpenEdit = (client: ClientRecord) => {
    setEditingClient(client);
    setFormData({
      fullName: client.fullName,
      email: client.email,
      phone: client.phone,
      companyName: client.companyName,
      country: client.country || 'India',
      preferredContact: client.preferredContact || 'WhatsApp',
      accountStatus: client.accountStatus || 'active',
      userId: client.userId || '',
      adminNotes: client.adminNotes || '',
    });
    setIsDirty(false);
    setShowForm(true);
  };

  const handleAttemptCloseForm = () => {
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      setShowForm(false);
      setEditingClient(null);
      setIsDirty(false);
    }
  };

  const updateFormField = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const saveClientRecord = async (): Promise<boolean> => {
    if (!formData.fullName.trim()) {
      showToast('error', 'Name Required', 'Please enter the client full name.');
      return false;
    }
    const cleanEmail = formData.email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      showToast('error', 'Valid Email Required', 'Please enter a valid client email address.');
      return false;
    }

    const duplicate = clients.some(
      (c) => c.id !== editingClient?.id && c.email.toLowerCase() === cleanEmail
    );
    if (duplicate) {
      showToast(
        'warning',
        'Duplicate Client Email',
        'Another client profile already uses this email address.'
      );
      return false;
    }

    setSavingClient(true);
    try {
      await saveClientAdmin(
        {
          ...formData,
          fullName: formData.fullName.trim(),
          email: cleanEmail,
          phone: formData.phone.trim(),
          companyName: formData.companyName.trim(),
          country: formData.country.trim() || 'India',
          adminNotes: formData.adminNotes.trim(),
        },
        editingClient || undefined
      );
      showToast(
        'success',
        editingClient ? 'Client Profile Updated' : 'Client Profile Created',
        `${formData.fullName.trim()} saved to database.`
      );
      setShowForm(false);
      setEditingClient(null);
      setIsDirty(false);
      setShowUnsavedDialog(false);
      await loadClients();
      return true;
    } catch (err) {
      showToast(
        'error',
        editingClient ? 'Failed to update client' : 'Failed to create client',
        err instanceof Error ? err.message : ''
      );
      return false;
    } finally {
      setSavingClient(false);
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveClientRecord();
  };

  const handleTriggerDeleteClient = async (client: ClientRecord) => {
    try {
      const deps = await checkClientDependenciesAdmin(client, quotations);
      setDeleteModal({
        isOpen: true,
        recordType: 'Client Profile',
        recordTitle: client.fullName,
        recordIdentifier: client.email,
        clientName: client.companyName || client.fullName,
        monetaryTotal: deps.outstandingBalance > 0 ? deps.outstandingBalance : undefined,
        statusLabel: client.accountStatus,
        canHardDelete: deps.canHardDelete,
        blockingReason: deps.canHardDelete
          ? `This client profile has 0 linked projects, invoices, quotations, estimates, or payments. It can be safely deleted from the database.`
          : `Cannot permanently delete "${client.fullName}" because this client has ${deps.blockingReasons.join(', ')}. Permanent deletion would break project and financial history. Mark the client as Deactivated / Archived instead.`,
        dependencyItems: [
          { label: 'Projects', count: deps.projectsCount },
          { label: 'Invoices', count: deps.invoicesCount },
          { label: 'Quotations', count: deps.quotationsCount },
          { label: 'Estimates', count: deps.estimatesCount },
          { label: 'Payments', count: deps.paymentsCount },
          { label: 'Inquiries', count: deps.inquiriesCount },
        ],
        requireExplicitCheckbox: true,
        archiveActionLabel:
          client.accountStatus === 'deactivated'
            ? 'Reactivate Client Profile'
            : 'Archive / Mark Inactive Instead',
        onConfirmArchiveOrVoid: async () => {
          const nextStatus = client.accountStatus === 'deactivated' ? 'active' : 'deactivated';
          await archiveClientAdmin(client, nextStatus);
          showToast(
            'success',
            nextStatus === 'deactivated' ? 'Client Archived' : 'Client Reactivated',
            `${client.fullName} is now marked as ${nextStatus}.`
          );
          if (viewingClient?.id === client.id) {
            setViewingClient({ ...client, accountStatus: nextStatus });
          }
          await loadClients();
        },
        onConfirmHardDelete: async () => {
          await deleteClientAdmin(client, quotations);
          showToast('success', 'Client Profile Deleted', `${client.fullName} was permanently removed.`);
          if (viewingClient?.id === client.id) setViewingClient(null);
          await loadClients();
        },
        onClose: () => setDeleteModal(null),
      });
    } catch (err) {
      showToast('error', 'Dependency Check Failed', err instanceof Error ? err.message : '');
    }
  };

  const handleToggleArchiveClient = async (client: ClientRecord) => {
    const nextStatus = client.accountStatus === 'deactivated' ? 'active' : 'deactivated';
    try {
      await archiveClientAdmin(client, nextStatus);
      showToast(
        'success',
        nextStatus === 'deactivated' ? 'Client Marked Inactive' : 'Client Reactivated',
        `${client.fullName} status updated to ${nextStatus}.`
      );
      await loadClients();
    } catch (err) {
      showToast('error', 'Failed to update client status', err instanceof Error ? err.message : '');
    }
  };

  // Precompute per-client metrics
  const clientMetricsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        projectsCount: number;
        invoicesCount: number;
        quotationsCount: number;
        outstandingBalance: number;
        totalPaid: number;
      }
    >();
    for (const c of clients) {
      const emailLower = c.email.toLowerCase();
      const cProjects = projects.filter(
        (p) => p.clientId === c.id || (emailLower && p.clientEmail.toLowerCase() === emailLower)
      );
      const cInvoices = invoices.filter(
        (i) => i.clientId === c.id || (emailLower && i.clientEmail.toLowerCase() === emailLower)
      );
      const cQuotes = quotations.filter(
        (q) => q.clientId === c.id || (emailLower && q.clientEmail.toLowerCase() === emailLower)
      );
      const outstandingBalance = cInvoices
        .filter((i) => i.status !== 'Void' && i.status !== 'Cancelled' && i.status !== 'Draft')
        .reduce((sum, i) => sum + (Number(i.balanceDue) || 0), 0);
      const totalPaid = cInvoices.reduce((sum, i) => sum + (Number(i.amountPaid) || 0), 0);

      map.set(c.id, {
        projectsCount: cProjects.length,
        invoicesCount: cInvoices.length,
        quotationsCount: cQuotes.length,
        outstandingBalance,
        totalPaid,
      });
    }
    return map;
  }, [clients, projects, invoices, quotations]);

  const filtered = clients.filter((c) => {
    const matchesStatus = statusFilter === 'all' || c.accountStatus === statusFilter;
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      c.fullName.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.companyName.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-editorial text-2xl font-semibold text-[#172333]">Client Directory</h1>
          <p className="text-xs text-[#6E7785] mt-1">
            Create, view, edit, archive, and safely manage client profiles, portal access, and linked financial records.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg whitespace-nowrap"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ New Client Profile</span>
        </button>
      </div>

      {/* Create / Edit Client Modal / Panel */}
      {showForm && (
        <form
          onSubmit={handleSubmitForm}
          className="bg-white border border-[#172333] rounded-lg p-6 space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-[#E2E4DF] pb-3">
            <div>
              <h2 className="text-base font-semibold text-[#172333]">
                {editingClient
                  ? `Edit Client Profile: ${editingClient.fullName}`
                  : 'Create New Client Profile'}
              </h2>
              <p className="text-xs text-[#6E7785] mt-0.5">
                {editingClient
                  ? 'Changes to client name or email automatically synchronize across linked projects and invoices.'
                  : 'Add a client record to link projects, quotations, estimates, and INR invoices.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleAttemptCloseForm}
              className="text-xs font-medium text-[#6E7785] hover:text-[#172333]"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => updateFormField('fullName', e.target.value)}
                placeholder="e.g. Rohan Deshmukh"
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => updateFormField('email', e.target.value)}
                placeholder="client@company.com"
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Phone / WhatsApp Number</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => updateFormField('phone', e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Company / Brand Name</label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => updateFormField('companyName', e.target.value)}
                placeholder="e.g. Apex Creator Studio"
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Billing Location / Country</label>
              <input
                type="text"
                value={formData.country}
                onChange={(e) => updateFormField('country', e.target.value)}
                placeholder="Bengaluru, Karnataka, India"
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Preferred Contact Method</label>
              <select
                value={formData.preferredContact}
                onChange={(e) =>
                  updateFormField(
                    'preferredContact',
                    e.target.value as 'Email' | 'WhatsApp' | 'Phone'
                  )
                }
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              >
                <option value="WhatsApp">WhatsApp</option>
                <option value="Email">Email</option>
                <option value="Phone">Phone</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Account Status</label>
              <select
                value={formData.accountStatus}
                onChange={(e) =>
                  updateFormField(
                    'accountStatus',
                    e.target.value as 'active' | 'invited' | 'deactivated'
                  )
                }
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              >
                <option value="active">Active</option>
                <option value="invited">Invited</option>
                <option value="deactivated">Deactivated / Archived</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">
                Supabase Auth User UUID (Optional — links Client Portal login)
              </label>
              <input
                type="text"
                value={formData.userId}
                onChange={(e) => updateFormField('userId', e.target.value)}
                placeholder="Paste client UUID when registered in Supabase Auth"
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Private Admin Notes (Never visible to client)
            </label>
            <textarea
              rows={2}
              value={formData.adminNotes}
              onChange={(e) => updateFormField('adminNotes', e.target.value)}
              placeholder="Internal notes on brand guidelines, GSTIN, billing preferences..."
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#E2E4DF]">
            <button
              type="button"
              disabled={savingClient}
              onClick={handleAttemptCloseForm}
              className="px-4 py-2 text-xs font-medium text-[#6E7785] hover:text-[#172333]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingClient}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg disabled:opacity-50"
            >
              {savingClient
                ? 'Saving...'
                : editingClient
                ? 'Save Client Changes'
                : 'Save Client Profile'}
            </button>
          </div>
        </form>
      )}

      {/* Search & Status Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#E2E4DF]/60 rounded-lg w-fit">
          {(
            [
              { id: 'all', label: `All (${clients.length})` },
              {
                id: 'active',
                label: `Active (${clients.filter((c) => c.accountStatus === 'active').length})`,
              },
              {
                id: 'invited',
                label: `Invited (${clients.filter((c) => c.accountStatus === 'invited').length})`,
              },
              {
                id: 'deactivated',
                label: `Archived / Inactive (${
                  clients.filter((c) => c.accountStatus === 'deactivated').length
                })`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === tab.id
                  ? 'bg-white text-[#172333] shadow-xs font-semibold'
                  : 'text-[#6E7785] hover:text-[#172333]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#6E7785] absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, brand, email, phone..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E2E4DF] rounded-lg"
          />
        </div>
      </div>

      {/* Clients Table */}
      <div className="bg-white border border-[#E2E4DF] rounded-lg overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E2E4DF] text-[11px] font-semibold text-[#6E7785]">
              <th className="py-3 px-4">Client Name & Brand</th>
              <th className="py-3 px-4">Email & WhatsApp / Phone</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-center">Related Projects</th>
              <th className="py-3 px-4 text-right">Outstanding Balance</th>
              <th className="py-3 px-4">Created</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E4DF] text-xs">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[#6E7785]">
                  Loading client directory...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[#6E7785]">
                  No client profiles match the current filter.
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
                const metrics = clientMetricsMap.get(c.id) || {
                  projectsCount: 0,
                  invoicesCount: 0,
                  quotationsCount: 0,
                  outstandingBalance: 0,
                  totalPaid: 0,
                };
                return (
                  <tr key={c.id} className="hover:bg-[#F5F5F1]/50">
                    <td className="py-3.5 px-4">
                      <Link
                        to={`/admin/clients/${c.id}`}
                        className="font-semibold text-[#172333] hover:text-[#F18A45]"
                      >
                        {c.fullName}
                      </Link>
                      <p className="text-[11px] text-[#6E7785]">
                        {c.companyName || 'Independent Client'} · {c.country || 'India'}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-[#6E7785]">
                      <span className="text-[#172333]">{c.email}</span>
                      <span className="block text-[11px]">
                        {c.phone || 'No phone'} · Prefers {c.preferredContact}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`font-semibold ${
                          c.accountStatus === 'active'
                            ? 'text-[#26734D]'
                            : c.accountStatus === 'deactivated'
                            ? 'text-[#B93832]'
                            : 'text-[#A96518]'
                        }`}
                      >
                        {c.accountStatus === 'active'
                          ? 'Active'
                          : c.accountStatus === 'deactivated'
                          ? 'Archived'
                          : 'Invited'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono">
                      <span className="font-semibold text-[#172333]">{metrics.projectsCount}</span>
                      {metrics.quotationsCount > 0 && (
                        <span className="block text-[10px] text-[#6E7785]">
                          {metrics.quotationsCount} quote(s)
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      <span
                        className={
                          metrics.outstandingBalance > 0
                            ? 'font-semibold text-[#B93832]'
                            : 'text-[#6E7785]'
                        }
                      >
                        {formatINR(metrics.outstandingBalance)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#6E7785] whitespace-nowrap">
                      {formatDate(c.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <RecordActionBar
                        onView={() => setViewingClient(c)}
                        onEdit={() => handleOpenEdit(c)}
                        onArchiveOrVoid={() => handleToggleArchiveClient(c)}
                        archiveLabel={c.accountStatus === 'deactivated' ? 'Activate' : 'Archive'}
                        onDelete={() => handleTriggerDeleteClient(c)}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Quick View Client Details Modal */}
      {viewingClient && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#172333]/65 p-4 overflow-y-auto"
        >
          <div className="bg-white border border-[#E2E4DF] rounded-lg max-w-3xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E2E4DF] pb-4">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#F18A45]">
                  Client Profile Inspector
                </span>
                <h2 className="font-editorial text-xl font-semibold text-[#172333] mt-0.5">
                  {viewingClient.fullName}
                </h2>
                <p className="text-xs text-[#6E7785]">
                  {viewingClient.companyName || 'Independent Client'} · {viewingClient.email} ·{' '}
                  {viewingClient.phone || 'No phone'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = viewingClient;
                    setViewingClient(null);
                    handleOpenEdit(target);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg"
                >
                  Edit Profile
                </button>
                <Link
                  to={`/admin/clients/${viewingClient.id}`}
                  className="px-3 py-1.5 text-xs font-semibold text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-lg"
                >
                  Full Page →
                </Link>
                <button
                  type="button"
                  onClick={() => setViewingClient(null)}
                  className="px-2.5 py-1.5 text-xs text-[#6E7785] hover:text-[#172333]"
                >
                  Close
                </button>
              </div>
            </div>

            {(() => {
              const emailLower = viewingClient.email.toLowerCase();
              const cProjects = projects.filter(
                (p) =>
                  p.clientId === viewingClient.id ||
                  (emailLower && p.clientEmail.toLowerCase() === emailLower)
              );
              const cInvoices = invoices.filter(
                (i) =>
                  i.clientId === viewingClient.id ||
                  (emailLower && i.clientEmail.toLowerCase() === emailLower)
              );
              const cQuotes = quotations.filter(
                (q) =>
                  q.clientId === viewingClient.id ||
                  (emailLower && q.clientEmail.toLowerCase() === emailLower)
              );
              const cInquiries = inquiries.filter(
                (inq) => emailLower && inq.email.toLowerCase() === emailLower
              );
              const totalBilled = cInvoices
                .filter((i) => i.status !== 'Void' && i.status !== 'Cancelled')
                .reduce((s, i) => s + i.total, 0);
              const totalPaid = cInvoices.reduce((s, i) => s + i.amountPaid, 0);
              const balanceDue = cInvoices
                .filter((i) => i.status !== 'Void' && i.status !== 'Cancelled')
                .reduce((s, i) => s + i.balanceDue, 0);

              return (
                <div className="space-y-5 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-[#F5F5F1] rounded-lg">
                      <p className="text-[#6E7785]">Account Status</p>
                      <p className="font-semibold text-[#172333] mt-0.5 capitalize">
                        {viewingClient.accountStatus}
                      </p>
                    </div>
                    <div className="p-3 bg-[#F5F5F1] rounded-lg">
                      <p className="text-[#6E7785]">Total Billed</p>
                      <p className="font-mono font-semibold text-[#172333] mt-0.5">
                        {formatINR(totalBilled)}
                      </p>
                    </div>
                    <div className="p-3 bg-[#F5F5F1] rounded-lg">
                      <p className="text-[#6E7785]">Total Paid</p>
                      <p className="font-mono font-semibold text-[#26734D] mt-0.5">
                        {formatINR(totalPaid)}
                      </p>
                    </div>
                    <div className="p-3 bg-[#F5F5F1] rounded-lg">
                      <p className="text-[#6E7785]">Balance Due</p>
                      <p className="font-mono font-semibold text-[#B93832] mt-0.5">
                        {formatINR(balanceDue)}
                      </p>
                    </div>
                  </div>

                  {viewingClient.adminNotes && (
                    <div className="p-3.5 bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg">
                      <p className="font-semibold text-[#172333] mb-1">Private Admin Notes:</p>
                      <p className="text-[#6E7785] whitespace-pre-wrap">{viewingClient.adminNotes}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="border border-[#E2E4DF] rounded-lg p-4 space-y-2">
                      <p className="font-semibold text-[#172333]">
                        Related Projects ({cProjects.length})
                      </p>
                      {cProjects.length === 0 ? (
                        <p className="text-[#6E7785]">No projects linked yet.</p>
                      ) : (
                        cProjects.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between py-1.5 border-b border-[#E2E4DF] last:border-0"
                          >
                            <Link
                              to={`/admin/projects/${p.id}`}
                              className="font-semibold text-[#172333] hover:text-[#F18A45]"
                            >
                              {p.title}
                            </Link>
                            <span className="text-[#6E7785]">
                              {p.status} · {formatINR(p.budget)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="border border-[#E2E4DF] rounded-lg p-4 space-y-2">
                      <p className="font-semibold text-[#172333]">
                        Invoices ({cInvoices.length}) & Quotes/Estimates ({cQuotes.length})
                      </p>
                      {cInvoices.map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between py-1 border-b border-[#E2E4DF] last:border-0"
                        >
                          <span className="font-mono font-semibold">{inv.invoiceNumber}</span>
                          <span className="font-mono">
                            {formatINR(inv.total)} ({inv.status})
                          </span>
                        </div>
                      ))}
                      {cQuotes.map((q) => (
                        <div
                          key={q.id}
                          className="flex items-center justify-between py-1 border-b border-[#E2E4DF] last:border-0"
                        >
                          <span className="font-mono text-[#6E7785]">
                            {q.quotationNumber} ({inferQuotationDocumentType(q)})
                          </span>
                          <span className="font-mono">
                            {formatINR(q.total)} ({q.status})
                          </span>
                        </div>
                      ))}
                      {cInvoices.length === 0 && cQuotes.length === 0 && (
                        <p className="text-[#6E7785]">No invoices or quotations yet.</p>
                      )}
                    </div>
                  </div>

                  {cInquiries.length > 0 && (
                    <div className="border border-[#E2E4DF] rounded-lg p-4 space-y-1.5">
                      <p className="font-semibold text-[#172333]">
                        Original Website Inquiries ({cInquiries.length})
                      </p>
                      {cInquiries.map((inq) => (
                        <p key={inq.id} className="text-[#6E7785]">
                          {inq.serviceRequired} · {inq.budgetRange} · Status: {inq.status} (
                          {formatDate(inq.createdAt)})
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Unsaved Changes Protection Modal */}
      <UnsavedChangesDialog
        isOpen={showUnsavedDialog}
        recordLabel={editingClient ? `Client "${editingClient.fullName}"` : 'this new client profile'}
        onSaveAndClose={async () => {
          await saveClientRecord();
        }}
        onDiscardChanges={() => {
          setShowUnsavedDialog(false);
          setShowForm(false);
          setEditingClient(null);
          setIsDirty(false);
        }}
        onContinueEditing={() => setShowUnsavedDialog(false)}
      />

      {/* Dependency-Safe Delete / Archive Modal */}
      {deleteModal && <DependencySafeDeleteModal {...deleteModal} />}
    </div>
  );
};

export const AdminClientDetailsPage: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState<SafeDeleteModalConfig | null>(null);

  const loadData = useCallback(async () => {
    const [allClients, allProjects, allInvoices, allQuotes, allInquiries] = await Promise.all([
      fetchAllClientsAdmin(),
      fetchAllProjectsAdmin().catch(() => []),
      fetchAllInvoicesAdmin().catch(() => []),
      fetchAllQuotationsAdmin().catch(() => []),
      fetchAllInquiriesAdmin().catch(() => []),
    ]);
    const found = allClients.find((c) => c.id === clientId) || null;
    setClient(found);
    setIsDirty(false);
    const emailLower = (found?.email || '').toLowerCase();
    setProjects(
      allProjects.filter(
        (p) => p.clientId === clientId || (emailLower && p.clientEmail.toLowerCase() === emailLower)
      )
    );
    setInvoices(
      allInvoices.filter(
        (i) => i.clientId === clientId || (emailLower && i.clientEmail.toLowerCase() === emailLower)
      )
    );
    setQuotations(
      allQuotes.filter(
        (q) => q.clientId === clientId || (emailLower && q.clientEmail.toLowerCase() === emailLower)
      )
    );
    setInquiries(
      allInquiries.filter((inq) => emailLower && inq.email.toLowerCase() === emailLower)
    );
  }, [clientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!client) {
    return <div className="text-xs text-[#6E7785] py-12">Client record not found.</div>;
  }

  const updateField = <K extends keyof ClientRecord>(key: K, val: ClientRecord[K]) => {
    setClient((prev) => (prev ? { ...prev, [key]: val } : prev));
    setIsDirty(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client.fullName.trim() || !client.email.trim()) {
      showToast('error', 'Required Fields', 'Client full name and email are required.');
      return;
    }
    setSaving(true);
    try {
      await saveClientAdmin(client, client);
      setIsDirty(false);
      showToast('success', 'Client Profile Updated', `${client.fullName} saved.`);
      await loadData();
    } catch (err) {
      showToast('error', 'Update Failed', err instanceof Error ? err.message : '');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDelete = async () => {
    const deps = await checkClientDependenciesAdmin(client, quotations);
    setDeleteModal({
      isOpen: true,
      recordType: 'Client Profile',
      recordTitle: client.fullName,
      recordIdentifier: client.email,
      clientName: client.companyName || client.fullName,
      monetaryTotal: deps.outstandingBalance > 0 ? deps.outstandingBalance : undefined,
      statusLabel: client.accountStatus,
      canHardDelete: deps.canHardDelete,
      blockingReason: deps.canHardDelete
        ? `This client profile has 0 linked records and can be permanently removed.`
        : `Cannot permanently delete "${client.fullName}" because this client has ${deps.blockingReasons.join(', ')}. Mark the client as Archived / Inactive instead.`,
      dependencyItems: [
        { label: 'Projects', count: deps.projectsCount },
        { label: 'Invoices', count: deps.invoicesCount },
        { label: 'Quotations', count: deps.quotationsCount },
        { label: 'Estimates', count: deps.estimatesCount },
        { label: 'Payments', count: deps.paymentsCount },
        { label: 'Inquiries', count: deps.inquiriesCount },
      ],
      requireExplicitCheckbox: true,
      archiveActionLabel:
        client.accountStatus === 'deactivated'
          ? 'Reactivate Client Profile'
          : 'Archive / Mark Inactive Instead',
      onConfirmArchiveOrVoid: async () => {
        const nextStatus = client.accountStatus === 'deactivated' ? 'active' : 'deactivated';
        await archiveClientAdmin(client, nextStatus);
        showToast('success', 'Client Status Updated', `Marked as ${nextStatus}.`);
        await loadData();
      },
      onConfirmHardDelete: async () => {
        await deleteClientAdmin(client, quotations);
        showToast('success', 'Client Profile Deleted');
        navigate('/admin/clients');
      },
      onClose: () => setDeleteModal(null),
    });
  };

  const totalBilled = invoices
    .filter((i) => i.status !== 'Void' && i.status !== 'Cancelled')
    .reduce((sum, i) => sum + i.total, 0);
  const totalPaid = invoices.reduce((sum, i) => sum + i.amountPaid, 0);
  const outstandingBalance = invoices
    .filter((i) => i.status !== 'Void' && i.status !== 'Cancelled')
    .reduce((sum, i) => sum + i.balanceDue, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/admin/clients" className="text-xs text-[#6E7785] hover:text-[#172333]">
            ← Back to Client Directory
          </Link>
          <h1 className="font-editorial text-2xl font-semibold text-[#172333] mt-1">
            {client.fullName}
          </h1>
          <p className="text-xs text-[#6E7785]">
            {client.companyName || 'Independent Client'} · {client.email} · {client.phone || 'No phone'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              const nextStatus = client.accountStatus === 'deactivated' ? 'active' : 'deactivated';
              await archiveClientAdmin(client, nextStatus);
              showToast('success', `Client Marked ${nextStatus}`);
              await loadData();
            }}
            className="px-3.5 py-2 text-xs font-semibold text-[#172333] bg-white border border-[#E2E4DF] hover:border-[#172333] rounded-lg"
          >
            {client.accountStatus === 'deactivated' ? 'Reactivate Client' : 'Archive / Mark Inactive'}
          </button>
          <button
            type="button"
            onClick={handleOpenDelete}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#B93832] hover:bg-[#992B26] rounded-lg"
          >
            Delete Client
          </button>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div className="bg-white border border-[#E2E4DF] rounded-lg p-4">
          <p className="text-[#6E7785]">Total Projects</p>
          <p className="text-lg font-mono font-semibold text-[#172333] mt-1">{projects.length}</p>
        </div>
        <div className="bg-white border border-[#E2E4DF] rounded-lg p-4">
          <p className="text-[#6E7785]">Total Billed (INR)</p>
          <p className="text-lg font-mono font-semibold text-[#172333] mt-1">
            {formatINR(totalBilled)}
          </p>
        </div>
        <div className="bg-white border border-[#E2E4DF] rounded-lg p-4">
          <p className="text-[#6E7785]">Total Paid (INR)</p>
          <p className="text-lg font-mono font-semibold text-[#26734D] mt-1">
            {formatINR(totalPaid)}
          </p>
        </div>
        <div className="bg-white border border-[#E2E4DF] rounded-lg p-4">
          <p className="text-[#6E7785]">Outstanding Balance</p>
          <p className="text-lg font-mono font-semibold text-[#B93832] mt-1">
            {formatINR(outstandingBalance)}
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#172333]">
            Edit Client Profile & Portal Access
          </h2>
          {isDirty && (
            <span className="text-[11px] font-semibold text-[#A96518]">Unsaved edits</span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={client.fullName}
              onChange={(e) => updateField('fullName', e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Email *</label>
            <input
              type="email"
              required
              value={client.email}
              onChange={(e) => updateField('email', e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Phone / WhatsApp</label>
            <input
              type="text"
              value={client.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Company / Brand</label>
            <input
              type="text"
              value={client.companyName}
              onChange={(e) => updateField('companyName', e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Location / Billing Address</label>
            <input
              type="text"
              value={client.country || 'India'}
              onChange={(e) => updateField('country', e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Preferred Contact</label>
            <select
              value={client.preferredContact}
              onChange={(e) =>
                updateField(
                  'preferredContact',
                  e.target.value as 'Email' | 'WhatsApp' | 'Phone'
                )
              }
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            >
              <option value="WhatsApp">WhatsApp</option>
              <option value="Email">Email</option>
              <option value="Phone">Phone</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Portal User UID</label>
            <input
              type="text"
              value={client.userId}
              onChange={(e) => updateField('userId', e.target.value)}
              placeholder="Authenticated Supabase User UUID"
              className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Account Status</label>
            <select
              value={client.accountStatus}
              onChange={(e) =>
                updateField(
                  'accountStatus',
                  e.target.value as 'active' | 'invited' | 'deactivated'
                )
              }
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            >
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="deactivated">Deactivated / Archived</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Private Admin Notes</label>
          <textarea
            rows={3}
            value={client.adminNotes}
            onChange={(e) => updateField('adminNotes', e.target.value)}
            className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          {isDirty && (
            <button
              type="button"
              onClick={() => loadData()}
              className="px-3.5 py-2 text-xs font-medium text-[#6E7785] hover:text-[#172333]"
            >
              Discard Unsaved Edits
            </button>
          )}
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-[#E2E4DF] rounded-lg p-6">
          <h3 className="text-sm font-semibold text-[#172333] mb-3">
            Associated Projects ({projects.length})
          </h3>
          {projects.length === 0 ? (
            <p className="text-xs text-[#6E7785]">No projects linked to this client.</p>
          ) : (
            projects.map((p) => (
              <div
                key={p.id}
                className="py-2 border-b border-[#E2E4DF] last:border-0 flex justify-between text-xs"
              >
                <Link to={`/admin/projects/${p.id}`} className="font-semibold hover:text-[#F18A45]">
                  {p.title}
                </Link>
                <span className="text-[#6E7785]">
                  {p.status} · {formatINR(p.budget)}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="bg-white border border-[#E2E4DF] rounded-lg p-6">
          <h3 className="text-sm font-semibold text-[#172333] mb-3">
            Quotations & Estimates ({quotations.length})
          </h3>
          {quotations.length === 0 ? (
            <p className="text-xs text-[#6E7785]">No quotations or estimates for this client.</p>
          ) : (
            quotations.map((q) => (
              <div
                key={q.id}
                className="py-2 border-b border-[#E2E4DF] last:border-0 flex justify-between text-xs"
              >
                <Link
                  to="/admin/quotations"
                  className="font-mono font-semibold hover:text-[#F18A45]"
                >
                  {q.quotationNumber}
                </Link>
                <span className="font-mono tabular-nums">
                  {formatINR(q.total)} ({q.status})
                </span>
              </div>
            ))
          )}
        </div>

        <div className="bg-white border border-[#E2E4DF] rounded-lg p-6">
          <h3 className="text-sm font-semibold text-[#172333] mb-3">
            Client Invoices ({invoices.length})
          </h3>
          {invoices.length === 0 ? (
            <p className="text-xs text-[#6E7785]">No invoices issued to this client.</p>
          ) : (
            invoices.map((inv) => (
              <div
                key={inv.id}
                className="py-2 border-b border-[#E2E4DF] last:border-0 flex justify-between text-xs"
              >
                <Link
                  to="/admin/invoices"
                  className="font-mono font-semibold hover:text-[#F18A45]"
                >
                  {inv.invoiceNumber}
                </Link>
                <span className="font-mono tabular-nums">
                  {formatINR(inv.total)} ({inv.status})
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {inquiries.length > 0 && (
        <div className="bg-white border border-[#E2E4DF] rounded-lg p-6">
          <h3 className="text-sm font-semibold text-[#172333] mb-3">
            Related Inquiries ({inquiries.length})
          </h3>
          <div className="divide-y divide-[#E2E4DF] text-xs">
            {inquiries.map((inq) => (
              <div key={inq.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-[#172333]">{inq.serviceRequired}</span>
                  <span className="text-[#6E7785]"> · {inq.budgetRange}</span>
                  <p className="text-[#6E7785] mt-0.5">{inq.description}</p>
                </div>
                <span className="font-medium text-[#172333]">{inq.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {deleteModal && <DependencySafeDeleteModal {...deleteModal} />}
    </div>
  );
};

// ============================================================================
// 4. ADMIN PROJECTS & PROJECT DETAILS PAGES (COMPLETE CRUD & DEPENDENCY SAFETY)
// ============================================================================
const PROJECT_STATUSES: ProjectStatus[] = [
  'Inquiry',
  'Planned',
  'In Progress',
  'Waiting for Client',
  'In Review',
  'Revision Requested',
  'Completed',
  'On Hold',
  'Cancelled',
];

export const AdminProjectsPage: React.FC = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [files, setFiles] = useState<DeliverableFile[]>([]);

  const [showBuilder, setShowBuilder] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);
  const [viewingProject, setViewingProject] = useState<ProjectRecord | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [deleteModal, setDeleteModal] = useState<SafeDeleteModalConfig | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [milestoneTemplateId, setMilestoneTemplateId] = useState<string>('tpl-yt-video');

  const today = new Date().toISOString().split('T')[0];
  const emptyForm = {
    clientId: '',
    title: '',
    serviceType: 'Social Media Post Design',
    description: '',
    brief: '',
    budget: 1500,
    startDate: today,
    deadline: today,
    priority: 'Medium' as PriorityLevel,
    status: 'Planned' as ProjectStatus,
    progress: 10,
    latestUpdate: 'Project brief confirmed and queued for design.',
    internalNotes: '',
  };

  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    const [p, c, q, inv, t, f] = await Promise.all([
      fetchAllProjectsAdmin(),
      fetchAllClientsAdmin().catch(() => []),
      fetchAllQuotationsAdmin().catch(() => []),
      fetchAllInvoicesAdmin().catch(() => []),
      fetchAllTasksAdmin().catch(() => []),
      fetchAllFilesAdmin().catch(() => []),
    ]);
    setProjects(p);
    setClients(c);
    setQuotations(q);
    setInvoices(inv);
    setTasks(t);
    setFiles(f);
    if (c.length > 0 && !form.clientId) {
      setForm((prev) => ({ ...prev, clientId: c[0].id }));
    }
  }, [form.clientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenCreate = () => {
    setEditingProject(null);
    setForm({
      ...emptyForm,
      clientId: clients[0]?.id || '',
    });
    setIsDirty(false);
    setShowBuilder(true);
  };

  const handleOpenEdit = async (proj: ProjectRecord) => {
    const notes = await fetchProjectInternalNoteAdmin(proj.id).catch(() => '');
    setEditingProject(proj);
    setForm({
      clientId: proj.clientId || clients.find((c) => c.email === proj.clientEmail)?.id || '',
      title: proj.title,
      serviceType: proj.serviceType,
      description: proj.description,
      brief: proj.brief,
      budget: proj.budget,
      startDate: proj.startDate || today,
      deadline: proj.deadline || today,
      priority: proj.priority,
      status: proj.status,
      progress: proj.progress,
      latestUpdate: proj.latestUpdate,
      internalNotes: notes,
    });
    setIsDirty(false);
    setShowBuilder(true);
  };

  const updateFormField = <K extends keyof typeof form>(key: K, val: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    setIsDirty(true);
  };

  const handleAttemptCloseBuilder = () => {
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      setShowBuilder(false);
      setEditingProject(null);
      setIsDirty(false);
    }
  };

  const saveProjectRecord = async (): Promise<boolean> => {
    if (!form.title.trim()) {
      showToast('error', 'Project Title Required', 'Please enter a title for the project.');
      return false;
    }
    const targetClient = clients.find((c) => c.id === form.clientId);
    if (!targetClient && !editingProject) {
      showToast('error', 'Select a Client', 'Please create and select a client profile first.');
      return false;
    }
    if (Number(form.budget) < 0) {
      showToast('error', 'Invalid Budget', 'Project budget cannot be negative.');
      return false;
    }

    setSavingProject(true);
    try {
      const projectId = await saveProjectAdmin(
        {
          clientId: targetClient?.id || editingProject?.clientId || '',
          clientUserId: targetClient?.userId || editingProject?.clientUserId || '',
          clientName: targetClient?.fullName || editingProject?.clientName || 'Studio Client',
          clientEmail: targetClient?.email || editingProject?.clientEmail || '',
          title: form.title.trim(),
          description: form.description.trim(),
          serviceType: form.serviceType.trim(),
          brief: form.brief.trim(),
          budget: Math.max(0, Number(form.budget) || 0),
          startDate: form.startDate,
          deadline: form.deadline,
          priority: form.priority,
          status: form.status,
          progress: Math.min(100, Math.max(0, Number(form.progress) || 0)),
          latestUpdate: form.latestUpdate.trim(),
        },
        form.internalNotes,
        editingProject || undefined
      );

      if (!editingProject && milestoneTemplateId && milestoneTemplateId !== 'none') {
        const templateTasks = buildTasksFromMilestoneTemplate(
          milestoneTemplateId,
          projectId,
          targetClient?.userId || '',
          form.startDate
        );
        for (const t of templateTasks) {
          await saveTaskAdmin(t);
        }
        showToast(
          'success',
          'Project & Milestone Tasks Created',
          `Initialized ${form.title} with ${templateTasks.length} production milestones.`
        );
      } else {
        showToast(
          'success',
          editingProject ? 'Project Updated' : 'Project Created',
          `${form.title.trim()} saved to database.`
        );
      }

      setShowBuilder(false);
      setEditingProject(null);
      setIsDirty(false);
      setShowUnsavedDialog(false);
      await loadData();
      return true;
    } catch (err) {
      showToast('error', 'Failed to save project', err instanceof Error ? err.message : '');
      return false;
    } finally {
      setSavingProject(false);
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveProjectRecord();
  };

  const handleDuplicateProject = async (proj: ProjectRecord) => {
    try {
      const newId = await duplicateProjectAdmin(proj);
      showToast('success', 'Project Duplicated', `Created copy of "${proj.title}".`);
      await loadData();
      navigate(`/admin/projects/${newId}`);
    } catch (err) {
      showToast('error', 'Duplicate Failed', err instanceof Error ? err.message : '');
    }
  };

  const handleTriggerDeleteProject = async (proj: ProjectRecord) => {
    try {
      const deps = await checkProjectDependenciesAdmin(proj, quotations);
      setDeleteModal({
        isOpen: true,
        recordType: 'Project',
        recordTitle: proj.title,
        clientName: proj.clientName,
        monetaryTotal: proj.budget,
        statusLabel: proj.status,
        canHardDelete: deps.canHardDelete,
        blockingReason: deps.canHardDelete
          ? `This project has 0 linked invoices, payments, quotations, or deliverable files. Deleting it will also clean up ${deps.tasksCount} task(s) and ${deps.messagesCount} comment(s).`
          : `Cannot permanently delete "${proj.title}" because it has ${deps.blockingReasons.join(', ')}. Permanent deletion is blocked to protect client billing and deliverable history. Mark the project as Cancelled or On Hold instead.`,
        dependencyItems: [
          { label: 'Invoices', count: deps.invoicesCount },
          { label: 'Payments', count: deps.paymentsCount },
          { label: 'Quotes/Est.', count: deps.quotationsCount },
          { label: 'Deliverables', count: deps.filesCount },
          { label: 'Tasks', count: deps.tasksCount },
          { label: 'Messages', count: deps.messagesCount },
        ],
        requireExplicitCheckbox: true,
        archiveActionLabel:
          proj.status === 'Cancelled' ? 'Mark Project On Hold' : 'Archive / Mark Cancelled Instead',
        requiresReasonForArchive: true,
        defaultArchiveReason: 'Project archived / cancelled by studio administrator',
        onConfirmArchiveOrVoid: async (reason) => {
          const targetStatus = proj.status === 'Cancelled' ? 'On Hold' : 'Cancelled';
          await archiveProjectAdmin(proj, targetStatus, reason);
          showToast('success', `Project Marked ${targetStatus}`, proj.title);
          if (viewingProject?.id === proj.id) {
            setViewingProject({ ...proj, status: targetStatus });
          }
          await loadData();
        },
        onConfirmHardDelete: async () => {
          await deleteProjectAdmin(proj, quotations);
          showToast('success', 'Project Deleted', `"${proj.title}" was permanently removed.`);
          if (viewingProject?.id === proj.id) setViewingProject(null);
          await loadData();
        },
        onClose: () => setDeleteModal(null),
      });
    } catch (err) {
      showToast('error', 'Dependency Check Failed', err instanceof Error ? err.message : '');
    }
  };

  const handleQuickProjectStatusChange = async (
    project: ProjectRecord,
    nextStatus: ProjectStatus
  ) => {
    const progressByStatus: Partial<Record<ProjectStatus, number>> = {
      Planned: 15,
      'In Progress': 50,
      'In Review': 80,
      'Revision Requested': 70,
      Completed: 100,
    };
    try {
      const notes = await fetchProjectInternalNoteAdmin(project.id).catch(() => '');
      await saveProjectAdmin(
        {
          ...project,
          status: nextStatus,
          progress: progressByStatus[nextStatus] ?? project.progress,
          latestUpdate: `Moved to ${nextStatus} stage on studio Kanban board.`,
        },
        notes,
        project
      );
      showToast('success', 'Stage Updated', `${project.title} → ${nextStatus}`);
      await loadData();
    } catch (err) {
      showToast('error', 'Failed to update stage', err instanceof Error ? err.message : '');
    }
  };

  const filtered = projects.filter((p) => {
    const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.clientName.toLowerCase().includes(q) ||
      p.serviceType.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const KANBAN_COLUMNS: Array<{ label: string; status: ProjectStatus; match: ProjectStatus[] }> = [
    { label: 'Planned', status: 'Planned', match: ['Inquiry', 'Planned', 'On Hold'] },
    { label: 'In Progress', status: 'In Progress', match: ['In Progress', 'Waiting for Client'] },
    { label: 'Review', status: 'In Review', match: ['In Review'] },
    { label: 'Revision', status: 'Revision Requested', match: ['Revision Requested'] },
    { label: 'Completed', status: 'Completed', match: ['Completed'] },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-editorial text-2xl font-semibold text-[#172333]">Projects</h1>
          <p className="text-xs text-[#6E7785] mt-1">
            Create, view, edit, duplicate, archive, and safely manage studio projects across Table & Kanban Board views.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center p-1 bg-[#E2E4DF]/60 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-[#172333] shadow-xs font-semibold'
                  : 'text-[#6E7785] hover:text-[#172333]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-white text-[#172333] shadow-xs font-semibold'
                  : 'text-[#6E7785] hover:text-[#172333]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Kanban Board</span>
            </button>
          </div>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg"
          >
            <FolderPlus className="w-4 h-4" />
            <span>+ Create Project</span>
          </button>
        </div>
      </div>

      {/* Create / Edit Project Builder Modal / Form */}
      {showBuilder && (
        <form
          onSubmit={handleSubmitForm}
          className="bg-white border border-[#172333] rounded-lg p-6 space-y-4 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E4DF] pb-3">
            <div>
              <h2 className="text-base font-semibold text-[#172333]">
                {editingProject ? `Edit Project: ${editingProject.title}` : 'Create New Project'}
              </h2>
              <p className="text-xs text-[#6E7785] mt-0.5">
                {editingProject
                  ? 'Update project scope, client association, timeline, status, budget, or private admin notes.'
                  : 'Configure project details and optionally initialize production milestone tasks.'}
              </p>
            </div>
            {!editingProject && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-[#172333]">
                  Milestone Template:
                </label>
                <select
                  value={milestoneTemplateId}
                  onChange={(e) => setMilestoneTemplateId(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg font-medium text-[#172333]"
                >
                  <option value="none">— No Milestone Template (Blank) —</option>
                  {PROJECT_MILESTONE_TEMPLATES.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {!editingProject && milestoneTemplateId !== 'none' && (
            <div className="p-3 bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg text-xs">
              <p className="font-semibold text-[#172333]">
                Auto-Populated Production Milestones:{' '}
                <span className="text-[#F18A45]">
                  {PROJECT_MILESTONE_TEMPLATES.find((t) => t.id === milestoneTemplateId)?.name}
                </span>
              </p>
              <p className="text-[#6E7785] mt-1">
                {PROJECT_MILESTONE_TEMPLATES.find((t) => t.id === milestoneTemplateId)
                  ?.tasks.map((t) => t.title)
                  .join(' → ')}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Client *</label>
              <select
                required
                value={form.clientId}
                onChange={(e) => updateFormField('clientId', e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              >
                <option value="">Select client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.companyName || c.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Project Title *</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => updateFormField('title', e.target.value)}
                placeholder="YouTube Channel Rebrand & 5 Thumbnails"
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Service Category *</label>
              <input
                type="text"
                required
                value={form.serviceType}
                onChange={(e) => updateFormField('serviceType', e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => updateFormField('status', e.target.value as ProjectStatus)}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              >
                {PROJECT_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Progress (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.progress}
                onChange={(e) => updateFormField('progress', Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => updateFormField('priority', e.target.value as PriorityLevel)}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => updateFormField('startDate', e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Due Date / Deadline</label>
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => updateFormField('deadline', e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Agreed Budget (INR)</label>
              <input
                type="number"
                min={0}
                value={form.budget}
                onChange={(e) => updateFormField('budget', Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">
                Project Description / Scope Summary
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => updateFormField('description', e.target.value)}
                placeholder="Short summary of project deliverables..."
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Client-Visible Status Update Banner
              </label>
              <input
                type="text"
                value={form.latestUpdate}
                onChange={(e) => updateFormField('latestUpdate', e.target.value)}
                placeholder="Latest milestone update shown in Client Portal..."
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">
                Project Brief & Deliverables (Client Visible)
              </label>
              <textarea
                rows={3}
                value={form.brief}
                onChange={(e) => updateFormField('brief', e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Internal Admin Notes (Isolated from Client)
              </label>
              <textarea
                rows={3}
                value={form.internalNotes}
                onChange={(e) => updateFormField('internalNotes', e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#E2E4DF]">
            <button
              type="button"
              disabled={savingProject}
              onClick={handleAttemptCloseBuilder}
              className="px-4 py-2 text-xs font-medium text-[#6E7785] hover:text-[#172333]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingProject}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg disabled:opacity-50"
            >
              {savingProject
                ? 'Saving...'
                : editingProject
                ? 'Save Project Changes'
                : 'Save Project'}
            </button>
          </div>
        </form>
      )}

      {viewMode === 'table' ? (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-[#E2E4DF]/60 rounded-lg w-fit">
              {['All', ...PROJECT_STATUSES].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-white text-[#172333] shadow-sm font-semibold'
                      : 'text-[#6E7785] hover:text-[#172333]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-[#6E7785] absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search project, client, service..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E2E4DF] rounded-lg"
              />
            </div>
          </div>

          <div className="bg-white border border-[#E2E4DF] rounded-lg overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E4DF] text-[11px] font-semibold text-[#6E7785]">
                  <th className="py-3 px-4">Project Title & Service</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Progress</th>
                  <th className="py-3 px-4">Deadline</th>
                  <th className="py-3 px-4 text-right">Budget (INR)</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E4DF] text-xs">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#6E7785]">
                      No projects match the current filter.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-[#F5F5F1]/50">
                      <td className="py-3.5 px-4">
                        <Link
                          to={`/admin/projects/${p.id}`}
                          className="font-semibold text-[#172333] hover:text-[#F18A45]"
                        >
                          {p.title}
                        </Link>
                        <p className="text-[11px] text-[#6E7785]">
                          {p.serviceType} · Priority: {p.priority}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-[#6E7785]">{p.clientName}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`font-semibold ${
                            p.status === 'Completed'
                              ? 'text-[#26734D]'
                              : p.status === 'Cancelled'
                              ? 'text-[#B93832]'
                              : p.status === 'Revision Requested' || p.status === 'On Hold'
                              ? 'text-[#A96518]'
                              : 'text-[#172333]'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums">{p.progress}%</td>
                      <td className="py-3.5 px-4 font-mono text-[#6E7785]">{p.deadline || '—'}</td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                        {formatINR(p.budget)}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <RecordActionBar
                          onView={() => setViewingProject(p)}
                          onEdit={() => handleOpenEdit(p)}
                          onDuplicate={() => handleDuplicateProject(p)}
                          onArchiveOrVoid={async () => {
                            const nextStatus = p.status === 'Cancelled' ? 'Planned' : 'Cancelled';
                            await archiveProjectAdmin(p, nextStatus as 'Cancelled' | 'On Hold');
                            showToast('success', `Project Marked ${nextStatus}`, p.title);
                            await loadData();
                          }}
                          archiveLabel={p.status === 'Cancelled' ? 'Restore' : 'Cancel'}
                          onDelete={() => handleTriggerDeleteProject(p)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {KANBAN_COLUMNS.map((col, colIdx) => {
            const colProjects = projects.filter((p) => col.match.includes(p.status));
            const prevCol = colIdx > 0 ? KANBAN_COLUMNS[colIdx - 1] : null;
            const nextCol = colIdx < KANBAN_COLUMNS.length - 1 ? KANBAN_COLUMNS[colIdx + 1] : null;

            return (
              <div
                key={col.label}
                className="bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg p-3 flex flex-col min-h-[420px]"
              >
                <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#E2E4DF]">
                  <span className="text-xs font-semibold text-[#172333]">{col.label}</span>
                  <span className="text-[11px] font-mono font-semibold text-[#6E7785]">
                    {colProjects.length}
                  </span>
                </div>
                <div className="space-y-3 flex-1">
                  {colProjects.length === 0 ? (
                    <p className="text-[11px] text-[#6E7785] text-center py-8">
                      No projects in {col.label}
                    </p>
                  ) : (
                    colProjects.map((p) => (
                      <div
                        key={p.id}
                        className="bg-white border border-[#E2E4DF] rounded-lg p-3.5 space-y-2.5 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            to={`/admin/projects/${p.id}`}
                            className="text-xs font-semibold text-[#172333] hover:text-[#F18A45] leading-snug"
                          >
                            {p.title}
                          </Link>
                          <span className="font-mono text-[10px] text-[#6E7785]">
                            {p.progress}%
                          </span>
                        </div>
                        <p className="text-[11px] text-[#6E7785]">
                          {p.clientName} · {p.serviceType}
                        </p>
                        <div className="w-full h-1 bg-[#F5F5F1] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#F18A45]"
                            style={{ width: `${Math.min(100, Math.max(0, p.progress))}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] pt-1">
                          <span className="font-mono font-semibold text-[#172333]">
                            {formatINR(p.budget)}
                          </span>
                          <span className="font-mono text-[#6E7785]">Due {p.deadline || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-1 pt-2 border-t border-[#E2E4DF] text-[10px]">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(p)}
                            className="font-semibold text-[#172333] hover:text-[#F18A45]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTriggerDeleteProject(p)}
                            className="font-semibold text-[#B93832] hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-1 pt-1">
                          {prevCol ? (
                            <button
                              type="button"
                              onClick={() => handleQuickProjectStatusChange(p, prevCol.status)}
                              className="text-[10px] font-semibold text-[#6E7785] hover:text-[#172333]"
                            >
                              ← {prevCol.label}
                            </button>
                          ) : (
                            <span />
                          )}
                          {nextCol && (
                            <button
                              type="button"
                              onClick={() => handleQuickProjectStatusChange(p, nextCol.status)}
                              className="text-[10px] font-semibold text-[#F18A45] hover:underline"
                            >
                              {nextCol.label} →
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick View Project Inspector Modal */}
      {viewingProject && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#172333]/65 p-4 overflow-y-auto"
        >
          <div className="bg-white border border-[#E2E4DF] rounded-lg max-w-3xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E2E4DF] pb-4">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#F18A45]">
                  Project Overview · {viewingProject.serviceType}
                </span>
                <h2 className="font-editorial text-xl font-semibold text-[#172333] mt-0.5">
                  {viewingProject.title}
                </h2>
                <p className="text-xs text-[#6E7785]">
                  Client: {viewingProject.clientName} ({viewingProject.clientEmail}) · Status:{' '}
                  <strong>{viewingProject.status}</strong> ({viewingProject.progress}%)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = viewingProject;
                    setViewingProject(null);
                    handleOpenEdit(target);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg"
                >
                  Edit Project
                </button>
                <Link
                  to={`/admin/projects/${viewingProject.id}`}
                  className="px-3 py-1.5 text-xs font-semibold text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-lg"
                >
                  Full Workspace →
                </Link>
                <button
                  type="button"
                  onClick={() => setViewingProject(null)}
                  className="px-2.5 py-1.5 text-xs text-[#6E7785] hover:text-[#172333]"
                >
                  Close
                </button>
              </div>
            </div>

            {(() => {
              const pTasks = tasks.filter((t) => t.projectId === viewingProject.id);
              const pInvoices = invoices.filter((i) => i.projectId === viewingProject.id);
              const pFiles = files.filter((f) => f.projectId === viewingProject.id);

              return (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-[#F5F5F1] rounded-lg">
                      <p className="text-[#6E7785]">Budget (INR)</p>
                      <p className="font-mono font-semibold text-[#172333] mt-0.5">
                        {formatINR(viewingProject.budget)}
                      </p>
                    </div>
                    <div className="p-3 bg-[#F5F5F1] rounded-lg">
                      <p className="text-[#6E7785]">Timeline</p>
                      <p className="font-mono text-[#172333] mt-0.5">
                        {viewingProject.startDate || '—'} → {viewingProject.deadline || '—'}
                      </p>
                    </div>
                    <div className="p-3 bg-[#F5F5F1] rounded-lg">
                      <p className="text-[#6E7785]">Milestones / Tasks</p>
                      <p className="font-mono font-semibold text-[#172333] mt-0.5">
                        {pTasks.filter((t) => t.status === 'Done').length} / {pTasks.length} Done
                      </p>
                    </div>
                    <div className="p-3 bg-[#F5F5F1] rounded-lg">
                      <p className="text-[#6E7785]">Deliverables & Invoices</p>
                      <p className="font-mono font-semibold text-[#172333] mt-0.5">
                        {pFiles.length} file(s) · {pInvoices.length} inv.
                      </p>
                    </div>
                  </div>

                  {viewingProject.brief && (
                    <div className="p-3.5 bg-[#F5F5F1] rounded-lg">
                      <p className="font-semibold text-[#172333] mb-1">Creative Brief:</p>
                      <p className="text-[#6E7785] whitespace-pre-wrap">{viewingProject.brief}</p>
                    </div>
                  )}

                  {viewingProject.latestUpdate && (
                    <div className="p-3.5 bg-[#F5F5F1] rounded-lg">
                      <p className="font-semibold text-[#172333] mb-1">Latest Client Status Update:</p>
                      <p className="text-[#6E7785]">{viewingProject.latestUpdate}</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Unsaved Changes Protection Modal */}
      <UnsavedChangesDialog
        isOpen={showUnsavedDialog}
        recordLabel={editingProject ? `Project "${editingProject.title}"` : 'this new project'}
        onSaveAndClose={async () => {
          await saveProjectRecord();
        }}
        onDiscardChanges={() => {
          setShowUnsavedDialog(false);
          setShowBuilder(false);
          setEditingProject(null);
          setIsDirty(false);
        }}
        onContinueEditing={() => setShowUnsavedDialog(false)}
      />

      {deleteModal && <DependencySafeDeleteModal {...deleteModal} />}
    </div>
  );
};

export const AdminProjectDetailsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { profile } = useAuth();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [internalNotes, setInternalNotes] = useState('');
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [msgVisibility, setMsgVisibility] = useState<'client' | 'internal'>('client');
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState<SafeDeleteModalConfig | null>(null);

  const loadProject = useCallback(async () => {
    if (!projectId) return;
    const [all, allClients, allQuotes, allTasks, allInvoices] = await Promise.all([
      fetchAllProjectsAdmin(),
      fetchAllClientsAdmin().catch(() => []),
      fetchAllQuotationsAdmin().catch(() => []),
      fetchAllTasksAdmin().catch(() => []),
      fetchAllInvoicesAdmin().catch(() => []),
    ]);
    const found = all.find((p) => p.id === projectId) || null;
    setProject(found);
    setClients(allClients);
    setQuotations(allQuotes);
    setTasks(allTasks.filter((t) => t.projectId === projectId));
    setInvoices(allInvoices.filter((inv) => inv.projectId === projectId));
    setIsDirty(false);
    if (found) {
      const notes = await fetchProjectInternalNoteAdmin(found.id);
      setInternalNotes(notes);
      const msgs = await fetchProjectMessages(found.id, true);
      setMessages(msgs);
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  if (!project) {
    return <div className="text-xs text-[#6E7785] py-12">Project not found.</div>;
  }

  const updateProjectField = <K extends keyof ProjectRecord>(key: K, val: ProjectRecord[K]) => {
    setProject((prev) => (prev ? { ...prev, [key]: val } : prev));
    setIsDirty(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project.title.trim()) {
      showToast('error', 'Project Title Required', 'Please enter a valid project title.');
      return;
    }
    setSaving(true);
    try {
      await saveProjectAdmin(project, internalNotes, project);
      setIsDirty(false);
      showToast('success', 'Project & Internal Notes Updated');
      await loadProject();
    } catch (err) {
      showToast('error', 'Failed to update project', err instanceof Error ? err.message : '');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDelete = async () => {
    const deps = await checkProjectDependenciesAdmin(project, quotations);
    setDeleteModal({
      isOpen: true,
      recordType: 'Project',
      recordTitle: project.title,
      clientName: project.clientName,
      monetaryTotal: project.budget,
      statusLabel: project.status,
      canHardDelete: deps.canHardDelete,
      blockingReason: deps.canHardDelete
        ? `This project has 0 linked financial or deliverable records and can be permanently removed.`
        : `Cannot permanently delete "${project.title}" because it has ${deps.blockingReasons.join(', ')}. Mark the project as Cancelled or On Hold instead.`,
      dependencyItems: [
        { label: 'Invoices', count: deps.invoicesCount },
        { label: 'Payments', count: deps.paymentsCount },
        { label: 'Quotes/Est.', count: deps.quotationsCount },
        { label: 'Deliverables', count: deps.filesCount },
        { label: 'Tasks', count: deps.tasksCount },
        { label: 'Messages', count: deps.messagesCount },
      ],
      requireExplicitCheckbox: true,
      archiveActionLabel:
        project.status === 'Cancelled' ? 'Mark Project On Hold' : 'Archive / Mark Cancelled Instead',
      requiresReasonForArchive: true,
      defaultArchiveReason: 'Project archived / cancelled by studio administrator',
      onConfirmArchiveOrVoid: async (reason) => {
        const nextStatus = project.status === 'Cancelled' ? 'On Hold' : 'Cancelled';
        await archiveProjectAdmin(project, nextStatus, reason);
        showToast('success', `Project Marked ${nextStatus}`);
        await loadProject();
      },
      onConfirmHardDelete: async () => {
        await deleteProjectAdmin(project, quotations);
        showToast('success', 'Project Deleted');
        navigate('/admin/projects');
      },
      onClose: () => setDeleteModal(null),
    });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    try {
      await postProjectMessage({
        projectId: project.id,
        clientUserId: project.clientUserId,
        senderName: profile?.displayName || 'Shankar Baluragi',
        senderRole: 'admin',
        content: newMessage,
        visibility: msgVisibility,
      });
      setNewMessage('');
      setMessages(await fetchProjectMessages(project.id, true));
      showToast('success', 'Comment Posted');
    } catch (err) {
      showToast('error', 'Failed to post comment', err instanceof Error ? err.message : '');
    }
  };

  const unlockInfo = checkProjectMasterUnlockStatus(project.id, invoices);
  const proofingPins = getProofingPins(project.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/admin/projects" className="text-xs text-[#6E7785] hover:text-[#172333]">
            ← Back to Projects
          </Link>
          <h1 className="font-editorial text-2xl font-semibold text-[#172333] mt-1">
            {project.title}
          </h1>
          <p className="text-xs text-[#6E7785]">
            Client: {project.clientName} ({project.clientEmail}) · Service: {project.serviceType}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-right text-xs">
            <span
              className={`font-semibold ${
                unlockInfo.isUnlocked ? 'text-[#26734D]' : 'text-[#A96518]'
              }`}
            >
              {unlockInfo.isUnlocked
                ? 'Master Files Unlocked (Invoice Settled)'
                : 'Watermarked Preview Mode Active'}
            </span>
            <p className="text-[11px] text-[#6E7785]">{unlockInfo.reason}</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              const newId = await duplicateProjectAdmin(project);
              showToast('success', 'Project Duplicated');
              navigate(`/admin/projects/${newId}`);
            }}
            className="px-3 py-2 text-xs font-semibold text-[#172333] bg-white border border-[#E2E4DF] hover:border-[#172333] rounded-lg"
          >
            Duplicate Project
          </button>
          <button
            type="button"
            onClick={handleOpenDelete}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#B93832] hover:bg-[#992B26] rounded-lg"
          >
            Delete / Archive Project
          </button>
        </div>
      </div>

      <form onSubmit={handleSaveProject} className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#172333]">
            Edit Project Details, Timeline & Scope
          </h2>
          {isDirty && (
            <span className="text-[11px] font-semibold text-[#A96518]">Unsaved edits</span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Project Title *</label>
            <input
              type="text"
              required
              value={project.title}
              onChange={(e) => updateProjectField('title', e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Client Association</label>
            <select
              value={project.clientId}
              onChange={(e) => {
                const found = clients.find((c) => c.id === e.target.value);
                if (found) {
                  setProject({
                    ...project,
                    clientId: found.id,
                    clientUserId: found.userId || '',
                    clientName: found.fullName,
                    clientEmail: found.email,
                  });
                  setIsDirty(true);
                }
              }}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            >
              <option value={project.clientId}>{project.clientName}</option>
              {clients
                .filter((c) => c.id !== project.clientId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.email})
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Service Category</label>
            <input
              type="text"
              value={project.serviceType}
              onChange={(e) => updateProjectField('serviceType', e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Status</label>
            <select
              value={project.status}
              onChange={(e) => updateProjectField('status', e.target.value as ProjectStatus)}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            >
              {PROJECT_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Priority</label>
            <select
              value={project.priority}
              onChange={(e) => updateProjectField('priority', e.target.value as PriorityLevel)}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Progress (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={project.progress}
              onChange={(e) => updateProjectField('progress', Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Start Date</label>
            <input
              type="date"
              value={project.startDate}
              onChange={(e) => updateProjectField('startDate', e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Deadline</label>
            <input
              type="date"
              value={project.deadline}
              onChange={(e) => updateProjectField('deadline', e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Agreed Budget (INR)</label>
            <input
              type="number"
              min={0}
              value={project.budget}
              onChange={(e) => updateProjectField('budget', Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">
              Project Scope Description
            </label>
            <input
              type="text"
              value={project.description}
              onChange={(e) => updateProjectField('description', e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Client-Visible Status Update Banner
            </label>
            <input
              type="text"
              value={project.latestUpdate}
              onChange={(e) => updateProjectField('latestUpdate', e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Project Brief (Client Visible)</label>
            <textarea
              rows={3}
              value={project.brief}
              onChange={(e) => updateProjectField('brief', e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#A96518] mb-1">
              <Lock className="w-3.5 h-3.5" />
              <span>Private Admin Notes (Stored in isolated /projectInternalNotes)</span>
            </label>
            <textarea
              rows={3}
              value={internalNotes}
              onChange={(e) => {
                setInternalNotes(e.target.value);
                setIsDirty(true);
              }}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Project Changes'}
          </button>
          {isDirty && (
            <button
              type="button"
              onClick={() => loadProject()}
              className="px-3.5 py-2 text-xs font-medium text-[#6E7785] hover:text-[#172333]"
            >
              Discard Unsaved Edits
            </button>
          )}
        </div>
      </form>

      {/* Project Milestones & Proofing Pins */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-[#172333]">
              Production Milestones ({tasks.length})
            </h2>
            <select
              defaultValue=""
              onChange={async (e) => {
                const tplId = e.target.value;
                if (!tplId) return;
                e.target.value = '';
                const generated = buildTasksFromMilestoneTemplate(
                  tplId,
                  project.id,
                  project.clientUserId || '',
                  project.startDate
                );
                for (const item of generated) {
                  await saveTaskAdmin(item);
                }
                showToast(
                  'success',
                  'Milestone Template Applied',
                  `Added ${generated.length} production tasks to ${project.title}.`
                );
                await loadProject();
              }}
              className="px-2.5 py-1.5 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg font-medium text-[#172333]"
            >
              <option value="">+ Load Milestone Template...</option>
              {PROJECT_MILESTONE_TEMPLATES.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </option>
              ))}
            </select>
          </div>
          {tasks.length === 0 ? (
            <p className="text-xs text-[#6E7785]">
              No milestone tasks yet. Select a template above to populate standard studio tasks in one click.
            </p>
          ) : (
            <div className="divide-y divide-[#E2E4DF] text-xs">
              {tasks.map((t) => (
                <div key={t.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <p
                      className={
                        t.status === 'Done'
                          ? 'line-through text-[#6E7785]'
                          : 'font-semibold text-[#172333]'
                      }
                    >
                      {t.title}
                    </p>
                    {t.description && (
                      <p className="text-[11px] text-[#6E7785]">{t.description}</p>
                    )}
                  </div>
                  <select
                    value={t.status}
                    onChange={async (e) => {
                      await saveTaskAdmin(
                        { ...t, status: e.target.value as TaskStatus },
                        t
                      );
                      await loadProject();
                    }}
                    className="px-2 py-1 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded"
                  >
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Blocked">Blocked</option>
                    <option value="Done">Done</option>
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#172333] inline-flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#F18A45]" />
              <span>Client Visual Proofing Pins ({proofingPins.length})</span>
            </h2>
          </div>
          {proofingPins.length === 0 ? (
            <p className="text-xs text-[#6E7785]">
              When clients click on design proofs or video timestamps in the Client Portal, their coordinate pins and revision notes appear here.
            </p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {proofingPins.map((pin, idx) => (
                <div
                  key={pin.id}
                  className="p-3 bg-[#F5F5F1] rounded-lg text-xs flex items-start justify-between gap-3"
                >
                  <div>
                    <span className="font-mono font-semibold text-[#F18A45]">#{idx + 1}</span>{' '}
                    <span className="font-semibold text-[#172333]">{pin.authorName}:</span>{' '}
                    <span className={pin.resolved ? 'line-through text-[#6E7785]' : 'text-[#172333]'}>
                      {pin.comment}
                    </span>
                    <p className="text-[10px] font-mono text-[#6E7785] mt-0.5">
                      {pin.deliverableTitle} · Coord ({pin.xPercent.toFixed(0)}%, {pin.yPercent.toFixed(0)}%)
                    </p>
                  </div>
                  <span className="text-[10px] font-mono font-semibold text-[#6E7785]">
                    {pin.resolved ? 'Resolved' : 'Open'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Project Messages / Comments */}
      <div className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-4">
        <h2 className="text-base font-semibold text-[#172333]">Project Comments & Feedback Thread</h2>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-xs text-[#6E7785]">No messages posted on this project yet.</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="p-3 bg-[#F5F5F1] rounded-lg text-xs">
                <div className="flex items-center justify-between text-[#6E7785] mb-1">
                  <span className="font-semibold text-[#172333]">
                    {m.senderName} ({m.senderRole})
                  </span>
                  <span>
                    {m.visibility === 'internal' ? 'Internal Note' : 'Client Visible'} ·{' '}
                    {formatDate(m.createdAt)}
                  </span>
                </div>
                <p className="text-[#172333]">{m.content}</p>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleSendMessage} className="flex flex-col sm:flex-row gap-3 pt-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Write a project update or comment..."
            className="flex-1 px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
          />
          <select
            value={msgVisibility}
            onChange={(e) => setMsgVisibility(e.target.value as 'client' | 'internal')}
            className="px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
          >
            <option value="client">Client Visible</option>
            <option value="internal">Internal Only</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg whitespace-nowrap"
          >
            Post Message
          </button>
        </form>
      </div>

      {deleteModal && <DependencySafeDeleteModal {...deleteModal} />}
    </div>
  );
};

// ============================================================================
// 5. ADMIN TASKS & MILESTONES PAGE
// ============================================================================
export const AdminTasksPage: React.FC = () => {
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [form, setForm] = useState({
    projectId: '',
    title: '',
    description: '',
    status: 'To Do' as TaskStatus,
    priority: 'Medium' as 'Low' | 'Medium' | 'High',
    dueDate: new Date().toISOString().split('T')[0],
    visibility: 'client' as 'client' | 'internal',
  });

  const loadData = useCallback(async () => {
    const [t, p] = await Promise.all([fetchAllTasksAdmin(), fetchAllProjectsAdmin()]);
    setTasks(t);
    setProjects(p);
    if (p.length > 0 && !form.projectId) {
      setForm((prev) => ({ ...prev, projectId: p[0].id }));
    }
  }, [form.projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetProj = projects.find((p) => p.id === form.projectId);
    if (!targetProj || !form.title.trim()) return;
    try {
      await saveTaskAdmin({
        projectId: targetProj.id,
        clientUserId: targetProj.clientUserId || '',
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
        dueDate: form.dueDate,
        visibility: form.visibility,
      });
      setForm({ ...form, title: '', description: '' });
      showToast('success', 'Task Added');
      await loadData();
    } catch (err) {
      showToast('error', 'Failed to save task', err instanceof Error ? err.message : '');
    }
  };

  const handleToggleStatus = async (task: TaskRecord, nextStatus: TaskStatus) => {
    try {
      await saveTaskAdmin({ ...task, status: nextStatus }, task);
      await loadData();
    } catch (err) {
      showToast('error', 'Failed to update task', err instanceof Error ? err.message : '');
    }
  };

  const TASK_COLUMNS: TaskStatus[] = ['To Do', 'In Progress', 'Blocked', 'Done'];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-editorial text-2xl font-semibold text-[#172333]">
            Tasks & Milestones
          </h1>
          <p className="text-xs text-[#6E7785] mt-1">
            Assign tasks to projects and switch between List & Kanban Board views.
          </p>
        </div>
        <div className="inline-flex items-center p-1 bg-[#E2E4DF]/60 rounded-lg">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'table'
                ? 'bg-white text-[#172333] shadow-xs font-semibold'
                : 'text-[#6E7785] hover:text-[#172333]'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>List View</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('kanban')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'kanban'
                ? 'bg-white text-[#172333] shadow-xs font-semibold'
                : 'text-[#6E7785] hover:text-[#172333]'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Kanban Board</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleCreateTask} className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-4">
        <h2 className="text-sm font-semibold text-[#172333]">Add Project Task / Milestone</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Project *</label>
            <select
              required
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            >
              <option value="">Select project...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Task Title *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="First cut assembly & color pass"
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Due Date</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Visibility</label>
            <select
              value={form.visibility}
              onChange={(e) => setForm({ ...form, visibility: e.target.value as 'client' | 'internal' })}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            >
              <option value="client">Client Visible</option>
              <option value="internal">Internal Studio Only</option>
            </select>
          </div>
        </div>
        <button
          type="submit"
          className="px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg"
        >
          Add Task
        </button>
      </form>

      {viewMode === 'table' ? (
        <div className="bg-white border border-[#E2E4DF] rounded-lg divide-y divide-[#E2E4DF]">
          {tasks.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#6E7785]">No tasks created yet.</div>
          ) : (
            tasks.map((t) => {
              const proj = projects.find((p) => p.id === t.projectId);
              return (
                <div key={t.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <p className="font-semibold text-[#172333]">{t.title}</p>
                    <p className="text-[#6E7785] mt-0.5">
                      {proj?.title || t.projectId} · Due {t.dueDate} ·{' '}
                      {t.visibility === 'client' ? 'Client Visible' : 'Internal Only'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={t.status}
                      onChange={(e) => handleToggleStatus(t, e.target.value as TaskStatus)}
                      className="px-2.5 py-1.5 bg-[#F5F5F1] border border-[#E2E4DF] rounded-md"
                    >
                      <option value="To Do">To Do</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Blocked">Blocked</option>
                      <option value="Done">Done</option>
                    </select>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteTaskAdmin(t.id);
                        await loadData();
                      }}
                      className="text-[#B93832] hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TASK_COLUMNS.map((colStatus, colIdx) => {
            const colTasks = tasks.filter((t) => t.status === colStatus);
            const prevStatus = colIdx > 0 ? TASK_COLUMNS[colIdx - 1] : null;
            const nextStatus = colIdx < TASK_COLUMNS.length - 1 ? TASK_COLUMNS[colIdx + 1] : null;

            return (
              <div
                key={colStatus}
                className="bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg p-3 flex flex-col min-h-[380px]"
              >
                <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#E2E4DF]">
                  <span className="text-xs font-semibold text-[#172333]">{colStatus}</span>
                  <span className="text-[11px] font-mono font-semibold text-[#6E7785]">
                    {colTasks.length}
                  </span>
                </div>
                <div className="space-y-2.5 flex-1">
                  {colTasks.length === 0 ? (
                    <p className="text-[11px] text-[#6E7785] text-center py-8">
                      No tasks in {colStatus}
                    </p>
                  ) : (
                    colTasks.map((t) => {
                      const proj = projects.find((p) => p.id === t.projectId);
                      return (
                        <div
                          key={t.id}
                          className="bg-white border border-[#E2E4DF] rounded-lg p-3 space-y-2 shadow-2xs"
                        >
                          <p
                            className={`text-xs font-semibold leading-snug ${
                              t.status === 'Done' ? 'line-through text-[#6E7785]' : 'text-[#172333]'
                            }`}
                          >
                            {t.title}
                          </p>
                          <p className="text-[11px] text-[#6E7785]">{proj?.title || 'Project Task'}</p>
                          <div className="flex items-center justify-between text-[10px] font-mono text-[#6E7785]">
                            <span>Due {t.dueDate}</span>
                            <span>{t.priority}</span>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-[#E2E4DF]">
                            {prevStatus ? (
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(t, prevStatus)}
                                className="text-[10px] font-semibold text-[#6E7785] hover:text-[#172333]"
                              >
                                ← {prevStatus}
                              </button>
                            ) : (
                              <span />
                            )}
                            {nextStatus && (
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(t, nextStatus)}
                                className="text-[10px] font-semibold text-[#F18A45] hover:underline"
                              >
                                {nextStatus} →
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
