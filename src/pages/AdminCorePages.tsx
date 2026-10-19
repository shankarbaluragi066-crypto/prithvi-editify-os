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
} from '../services/crmService';
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

        <button
          type="button"
          disabled={seeding}
          onClick={handleSeedCatalog}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#172333] bg-white border border-[#E2E4DF] hover:border-[#172333] rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Database className="w-3.5 h-3.5 text-[#F18A45]" />
          <span>{seeding ? 'Seeding Catalog...' : 'Sync Default Services & Demo Portfolio'}</span>
        </button>
      </div>

      {/* Quick Actions Bar */}
      <div className="bg-white border border-[#E2E4DF] rounded-lg p-4 flex flex-wrap items-center gap-2.5">
        <span className="text-xs font-semibold text-[#6E7785] mr-2">Quick Actions:</span>
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
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg"
                >
                  Save Notes
                </button>
                <button
                  type="button"
                  onClick={() => handleConvertInquiry(selected)}
                  className="px-4 py-2 text-xs font-semibold text-[#172333] bg-[#F18A45] hover:bg-[#e07934] rounded-lg"
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
// 3. ADMIN CLIENTS & CLIENT DETAILS PAGES
// ============================================================================
export const AdminClientsPage: React.FC = () => {
  const { showToast } = useToast();
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    companyName: '',
    country: 'India',
    preferredContact: 'WhatsApp' as 'Email' | 'WhatsApp' | 'Phone',
    accountStatus: 'active' as 'active' | 'invited' | 'deactivated',
    userId: '',
    adminNotes: '',
  });

  const loadClients = useCallback(async () => {
    try {
      setClients(await fetchAllClientsAdmin());
    } catch (err) {
      showToast('error', 'Failed to load clients', err instanceof Error ? err.message : '');
    }
  }, [showToast]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.email.trim()) return;
    // Prevent duplicate email where practical
    const exists = clients.some((c) => c.email.toLowerCase() === formData.email.trim().toLowerCase());
    if (exists) {
      showToast('warning', 'Duplicate Client Email', 'A client record with this email already exists.');
      return;
    }
    try {
      await saveClientAdmin(formData);
      showToast('success', 'Client Profile Created');
      setShowForm(false);
      setFormData({
        fullName: '',
        email: '',
        phone: '',
        companyName: '',
        country: 'India',
        preferredContact: 'WhatsApp',
        accountStatus: 'active',
        userId: '',
        adminNotes: '',
      });
      await loadClients();
    } catch (err) {
      showToast('error', 'Failed to create client', err instanceof Error ? err.message : '');
    }
  };

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      !q ||
      c.fullName.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.companyName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-editorial text-2xl font-semibold text-[#172333]">Client Directory</h1>
          <p className="text-xs text-[#6E7785] mt-1">
            Manage client profiles, portal User IDs, contact preferences, and account status.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg whitespace-nowrap"
        >
          <UserPlus className="w-4 h-4" />
          <span>{showForm ? 'Close Form' : 'New Client Profile'}</span>
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-4">
          <h2 className="text-base font-semibold text-[#172333]">Create Client Profile</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Phone / WhatsApp</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Company / Brand Name</label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Supabase Auth User UUID (Optional — links client portal)
              </label>
              <input
                type="text"
                value={formData.userId}
                onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                placeholder="Paste client UUID when registered"
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Preferred Contact</label>
              <select
                value={formData.preferredContact}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    preferredContact: e.target.value as 'Email' | 'WhatsApp' | 'Phone',
                  })
                }
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              >
                <option value="WhatsApp">WhatsApp</option>
                <option value="Email">Email</option>
                <option value="Phone">Phone</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Private Admin Notes (Never visible to client)</label>
            <textarea
              rows={2}
              value={formData.adminNotes}
              onChange={(e) => setFormData({ ...formData, adminNotes: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg"
          >
            Save Client Profile
          </button>
        </form>
      )}

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-[#6E7785] absolute left-3 top-2.5" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients by name, brand, or email..."
          className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E2E4DF] rounded-lg"
        />
      </div>

      <div className="bg-white border border-[#E2E4DF] rounded-lg overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E2E4DF] text-[11px] font-semibold text-[#6E7785]">
              <th className="py-3 px-4">Client Name</th>
              <th className="py-3 px-4">Brand / Company</th>
              <th className="py-3 px-4">Email & Phone</th>
              <th className="py-3 px-4">Preferred Contact</th>
              <th className="py-3 px-4">Account Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E4DF] text-xs">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[#6E7785]">
                  No client profiles found.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-[#F5F5F1]/50">
                  <td className="py-3.5 px-4 font-semibold text-[#172333]">{c.fullName}</td>
                  <td className="py-3.5 px-4 text-[#6E7785]">{c.companyName || '—'}</td>
                  <td className="py-3.5 px-4 text-[#6E7785]">
                    {c.email}
                    {c.phone ? ` · ${c.phone}` : ''}
                  </td>
                  <td className="py-3.5 px-4 text-[#6E7785]">{c.preferredContact}</td>
                  <td className="py-3.5 px-4 font-medium text-[#172333]">{c.accountStatus}</td>
                  <td className="py-3.5 px-4 text-right">
                    <Link
                      to={`/admin/clients/${c.id}`}
                      className="font-semibold text-[#172333] hover:text-[#F18A45]"
                    >
                      Manage →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const AdminClientDetailsPage: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const { showToast } = useToast();
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);

  const loadData = useCallback(async () => {
    const [allClients, allProjects, allInvoices] = await Promise.all([
      fetchAllClientsAdmin(),
      fetchAllProjectsAdmin(),
      fetchAllInvoicesAdmin(),
    ]);
    const found = allClients.find((c) => c.id === clientId) || null;
    setClient(found);
    setProjects(allProjects.filter((p) => p.clientId === clientId));
    setInvoices(allInvoices.filter((i) => i.clientId === clientId));
  }, [clientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!client) {
    return <div className="text-xs text-[#6E7785] py-12">Client record not found.</div>;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveClientAdmin(client, client);
      showToast('success', 'Client Profile Updated');
    } catch (err) {
      showToast('error', 'Update Failed', err instanceof Error ? err.message : '');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin/clients" className="text-xs text-[#6E7785] hover:text-[#172333]">
            ← Back to Clients
          </Link>
          <h1 className="font-editorial text-2xl font-semibold text-[#172333] mt-1">{client.fullName}</h1>
        </div>
      </div>

      <form onSubmit={handleSave} className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-4">
        <h2 className="text-base font-semibold text-[#172333]">Client Profile & Portal Access</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Full Name</label>
            <input
              type="text"
              value={client.fullName}
              onChange={(e) => setClient({ ...client, fullName: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Email</label>
            <input
              type="email"
              value={client.email}
              onChange={(e) => setClient({ ...client, email: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Phone / WhatsApp</label>
            <input
              type="text"
              value={client.phone}
              onChange={(e) => setClient({ ...client, phone: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Company / Brand</label>
            <input
              type="text"
              value={client.companyName}
              onChange={(e) => setClient({ ...client, companyName: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Portal User UID</label>
            <input
              type="text"
              value={client.userId}
              onChange={(e) => setClient({ ...client, userId: e.target.value })}
              placeholder="Authenticated Supabase User UUID"
              className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Account Status</label>
            <select
              value={client.accountStatus}
              onChange={(e) =>
                setClient({
                  ...client,
                  accountStatus: e.target.value as 'active' | 'invited' | 'deactivated',
                })
              }
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            >
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="deactivated">Deactivated</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Private Admin Notes</label>
          <textarea
            rows={3}
            value={client.adminNotes}
            onChange={(e) => setClient({ ...client, adminNotes: e.target.value })}
            className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg"
        >
          Save Changes
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E2E4DF] rounded-lg p-6">
          <h3 className="text-sm font-semibold text-[#172333] mb-3">
            Associated Projects ({projects.length})
          </h3>
          {projects.map((p) => (
            <div key={p.id} className="py-2 border-b border-[#E2E4DF] flex justify-between text-xs">
              <Link to={`/admin/projects/${p.id}`} className="font-semibold hover:text-[#F18A45]">
                {p.title}
              </Link>
              <span>{p.status}</span>
            </div>
          ))}
        </div>

        <div className="bg-white border border-[#E2E4DF] rounded-lg p-6">
          <h3 className="text-sm font-semibold text-[#172333] mb-3">
            Client Invoices ({invoices.length})
          </h3>
          {invoices.map((inv) => (
            <div key={inv.id} className="py-2 border-b border-[#E2E4DF] flex justify-between text-xs">
              <span className="font-mono font-semibold">{inv.invoiceNumber}</span>
              <span className="font-mono tabular-nums">
                {formatINR(inv.total)} ({inv.status})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. ADMIN PROJECTS & PROJECT DETAILS PAGES
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
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('All');

  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
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
  });

  const loadData = useCallback(async () => {
    const [p, c] = await Promise.all([fetchAllProjectsAdmin(), fetchAllClientsAdmin()]);
    setProjects(p);
    setClients(c);
    if (c.length > 0 && !form.clientId) {
      setForm((prev) => ({ ...prev, clientId: c[0].id }));
    }
  }, [form.clientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetClient = clients.find((c) => c.id === form.clientId);
    if (!targetClient) {
      showToast('error', 'Select a Client', 'Please create a client profile first.');
      return;
    }
    try {
      await saveProjectAdmin(
        {
          clientId: targetClient.id,
          clientUserId: targetClient.userId || '',
          clientName: targetClient.fullName,
          clientEmail: targetClient.email,
          title: form.title,
          description: form.description,
          serviceType: form.serviceType,
          brief: form.brief,
          budget: Number(form.budget) || 0,
          startDate: form.startDate,
          deadline: form.deadline,
          priority: form.priority,
          status: form.status,
          progress: Number(form.progress) || 0,
          latestUpdate: form.latestUpdate,
        },
        form.internalNotes
      );
      showToast('success', 'Project Created');
      setShowCreate(false);
      await loadData();
    } catch (err) {
      showToast('error', 'Failed to create project', err instanceof Error ? err.message : '');
    }
  };

  const filtered =
    statusFilter === 'All' ? projects : projects.filter((p) => p.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-editorial text-2xl font-semibold text-[#172333]">Projects</h1>
          <p className="text-xs text-[#6E7785] mt-1">
            Track project briefs, progress percentages, deadlines, and client-visible updates.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg"
        >
          <FolderPlus className="w-4 h-4" />
          <span>{showCreate ? 'Close Form' : 'Create Project'}</span>
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-4">
          <h2 className="text-base font-semibold text-[#172333]">Create New Project</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Client *</label>
              <select
                required
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
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
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="YouTube Channel Rebrand & 5 Thumbnails"
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Service Type *</label>
              <input
                type="text"
                required
                value={form.serviceType}
                onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Agreed Budget (INR)</label>
              <input
                type="number"
                min={0}
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Deadline</label>
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as PriorityLevel })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Project Brief (Client Visible)</label>
              <textarea
                rows={3}
                value={form.brief}
                onChange={(e) => setForm({ ...form, brief: e.target.value })}
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
                onChange={(e) => setForm({ ...form, internalNotes: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg"
          >
            Save Project
          </button>
        </form>
      )}

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

      <div className="bg-white border border-[#E2E4DF] rounded-lg overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E2E4DF] text-[11px] font-semibold text-[#6E7785]">
              <th className="py-3 px-4">Project Title</th>
              <th className="py-3 px-4">Client</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Progress</th>
              <th className="py-3 px-4">Deadline</th>
              <th className="py-3 px-4 text-right">Budget (INR)</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E4DF] text-xs">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[#6E7785]">
                  No projects found.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-[#F5F5F1]/50">
                  <td className="py-3.5 px-4 font-semibold text-[#172333]">{p.title}</td>
                  <td className="py-3.5 px-4 text-[#6E7785]">{p.clientName}</td>
                  <td className="py-3.5 px-4 font-medium text-[#172333]">{p.status}</td>
                  <td className="py-3.5 px-4 font-mono tabular-nums">{p.progress}%</td>
                  <td className="py-3.5 px-4 font-mono text-[#6E7785]">{p.deadline}</td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                    {formatINR(p.budget)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Link
                      to={`/admin/projects/${p.id}`}
                      className="font-semibold text-[#172333] hover:text-[#F18A45]"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const AdminProjectDetailsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { showToast } = useToast();
  const { profile } = useAuth();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [internalNotes, setInternalNotes] = useState('');
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [msgVisibility, setMsgVisibility] = useState<'client' | 'internal'>('client');

  const loadProject = useCallback(async () => {
    if (!projectId) return;
    const all = await fetchAllProjectsAdmin();
    const found = all.find((p) => p.id === projectId) || null;
    setProject(found);
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

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveProjectAdmin(project, internalNotes, project);
      showToast('success', 'Project & Internal Notes Updated');
    } catch (err) {
      showToast('error', 'Failed to update project', err instanceof Error ? err.message : '');
    }
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

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/projects" className="text-xs text-[#6E7785] hover:text-[#172333]">
          ← Back to Projects
        </Link>
        <h1 className="font-editorial text-2xl font-semibold text-[#172333] mt-1">{project.title}</h1>
        <p className="text-xs text-[#6E7785]">
          Client: {project.clientName} ({project.clientEmail}) · Service: {project.serviceType}
        </p>
      </div>

      <form onSubmit={handleSaveProject} className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Status</label>
            <select
              value={project.status}
              onChange={(e) => setProject({ ...project, status: e.target.value as ProjectStatus })}
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
              value={project.progress}
              onChange={(e) => setProject({ ...project, progress: Number(e.target.value) })}
              className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Deadline</label>
            <input
              type="date"
              value={project.deadline}
              onChange={(e) => setProject({ ...project, deadline: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Agreed Budget (INR)</label>
            <input
              type="number"
              min={0}
              value={project.budget}
              onChange={(e) => setProject({ ...project, budget: Number(e.target.value) })}
              className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">
            Client-Visible Status Update Banner
          </label>
          <input
            type="text"
            value={project.latestUpdate}
            onChange={(e) => setProject({ ...project, latestUpdate: e.target.value })}
            className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Project Brief (Client Visible)</label>
            <textarea
              rows={3}
              value={project.brief}
              onChange={(e) => setProject({ ...project, brief: e.target.value })}
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
              onChange={(e) => setInternalNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
        </div>

        <button
          type="submit"
          className="px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg"
        >
          Save Project Changes
        </button>
      </form>

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-editorial text-2xl font-semibold text-[#172333]">Tasks & Milestones</h1>
        <p className="text-xs text-[#6E7785] mt-1">
          Assign tasks to projects and control whether each milestone is visible to the client or internal-only.
        </p>
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
    </div>
  );
};
