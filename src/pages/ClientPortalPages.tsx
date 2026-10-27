import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  Download,
  FileText,
  FolderKanban,
  MessageSquare,
  Printer,
  RotateCcw,
  Eye,
  Lock,
  Unlock,
  ShieldCheck,
  MapPin,
} from 'lucide-react';
import {
  fetchClientProjects,
  fetchClientInquiries,
  fetchClientVisibleTasks,
  fetchClientFiles,
  fetchClientInvoices,
  fetchProjectMessages,
  postProjectMessage,
  clientRequestRevisionOrApprove,
  resolveStoragePreviewUrl,
} from '../services/crmService';
import { MediaPreviewModal, PreviewableMediaItem } from '../components/MediaPreviewModal';
import { InquiryForm } from '../components/InquiryForm';
import { ProjectStatusBadge, getProjectStatusBadgeConfig } from './AdminCorePages';
import {
  ProjectRecord,
  InquiryRecord,
  TaskRecord,
  DeliverableFile,
  InvoiceRecord,
  ProjectMessage,
  QuotationRecord,
} from '../types/crm';
import {
  fetchClientQuotations,
  clientRespondToQuotation,
  inferQuotationDocumentType,
} from '../services/aiAssistantService';
import {
  checkProjectMasterUnlockStatus,
  getProofingPins,
  formatVideoTimestamp,
  getMilestoneApprovalSignOff,
  recordMilestoneApprovalSignOff,
  MilestoneApprovalSignOffRecord,
  submitClientPaymentProof,
  getClientPaymentProofs,
  ClientPaymentProofSubmission,
  getClientRetainerPlan,
  getProjectTestimonials,
  submitProjectTestimonial,
  buildPublicProjectTrackerUrl,
} from '../services/workflowEnhancementsService';
import {
  UpiQrCodeCard,
  CrmStatusBadge,
  ProjectLifecycleStepper,
} from '../components/StudioEnhancements';
import { formatINR, formatDate, formatFileSize } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';


// ============================================================================
// 1. CLIENT DASHBOARD PAGE
// ============================================================================
export const ClientDashboardPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [files, setFiles] = useState<DeliverableFile[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const clientEmail = profile?.email || user?.email || undefined;

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetchClientProjects(user.uid, clientEmail),
      fetchClientInquiries(user.uid, clientEmail).catch(() => []),
      fetchClientFiles(user.uid, clientEmail),
      fetchClientInvoices(user.uid, clientEmail),
      fetchClientQuotations(user.uid, clientEmail).catch(() => []),
    ])
      .then(([p, inq, f, inv, q]) => {
        setProjects(p);
        setInquiries(inq);
        setFiles(f);
        setInvoices(inv);
        setQuotations(q);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, clientEmail]);

  const activeProjects = projects.filter((p) => !['Completed', 'Cancelled'].includes(p.status));
  const pendingQuotations = quotations.filter((q) => q.status === 'Sent');
  const pendingApprovals = projects.filter((p) => p.status === 'In Review');
  const unpaidInvoices = invoices.filter((i) => ['Sent', 'Partially Paid', 'Overdue'].includes(i.status));
  const paidInvoices = invoices.filter((i) => i.status === 'Paid');

  return (
    <div className="space-y-8">
      <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#94A3B8]">Private Client Portal</p>
          <h1 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#F8FAFC] mt-1">
            Welcome, {profile?.displayName || 'Client'}
          </h1>
          <p className="text-xs text-[#94A3B8] mt-1">
            Portal UID: <span className="font-mono text-[#F8FAFC] select-all">{user?.uid}</span> — Share this UID with Shankar Baluragi if you need an existing project linked to your account.
          </p>
        </div>
        <Link
          to="/portal/book"
          className="px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg whitespace-nowrap shrink-0"
        >
          Submit New Brief
        </Link>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-5">
          <p className="text-xs text-[#94A3B8]">Active Projects</p>
          <p className="text-2xl font-mono font-semibold text-[#F8FAFC] mt-1 tabular-nums">
            {activeProjects.length}
          </p>
        </div>
        <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-5">
          <p className="text-xs text-[#94A3B8]">Pending Approvals & Quotes</p>
          <p className="text-2xl font-mono font-semibold text-[#D97706] mt-1 tabular-nums">
            {pendingApprovals.length + pendingQuotations.length}
          </p>
        </div>
        <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-5">
          <p className="text-xs text-[#94A3B8]">Unpaid Invoices</p>
          <p className="text-2xl font-mono font-semibold text-[#DC2626] mt-1 tabular-nums">
            {unpaidInvoices.length}
          </p>
        </div>
        <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-5">
          <p className="text-xs text-[#94A3B8]">Paid Invoices</p>
          <p className="text-2xl font-mono font-semibold text-[#16A34A] mt-1 tabular-nums">
            {paidInvoices.length}
          </p>
        </div>
      </div>

      {/* Unified Action Required Priority Banner */}
      {(pendingApprovals.length > 0 || pendingQuotations.length > 0 || unpaidInvoices.length > 0) && (
        <div className="bg-gradient-to-r from-[#0D1F38] via-[#132A4A] to-[#0D1F38] border border-[#10B981]/50 rounded-xl p-5 space-y-3 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] animate-pulse" />
              <p className="text-xs font-bold uppercase tracking-wider text-[#FBBF24]">
                Unified Action Required · {pendingApprovals.length + pendingQuotations.length + unpaidInvoices.length} Pending Studio Items
              </p>
            </div>
            <span className="text-[11px] font-mono text-[#94A3B8]">
              Complete actions below to keep production moving on schedule
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {pendingApprovals.length > 0 && (
              <div className="p-3.5 rounded-lg bg-[#040D1A]/75 border border-purple-500/35 flex flex-col justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-purple-300 font-bold">
                    Draft Deliverable Review
                  </span>
                  <p className="font-semibold text-[#F8FAFC] mt-0.5">
                    {pendingApprovals.length} {pendingApprovals.length === 1 ? 'project draft' : 'project drafts'} awaiting your approval or timestamped revision notes
                  </p>
                </div>
                <Link
                  to={`/portal/projects/${pendingApprovals[0].id}`}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2DD4BF] hover:underline"
                >
                  <span>Review & Approve Draft →</span>
                </Link>
              </div>
            )}

            {pendingQuotations.length > 0 && (
              <div className="p-3.5 rounded-lg bg-[#040D1A]/75 border border-amber-500/35 flex flex-col justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-amber-300 font-bold">
                    Quotation Sign-Off
                  </span>
                  <p className="font-semibold text-[#F8FAFC] mt-0.5">
                    Quotation {pendingQuotations[0].quotationNumber} ({formatINR(pendingQuotations[0].total)}) awaiting your sign-off
                  </p>
                </div>
                <Link
                  to="/portal/invoices"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FBBF24] hover:underline"
                >
                  <span>Review & Accept Quotation →</span>
                </Link>
              </div>
            )}

            {unpaidInvoices.length > 0 && (
              <div className="p-3.5 rounded-lg bg-[#040D1A]/75 border border-rose-500/35 flex flex-col justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-rose-300 font-bold">
                    Master File Unlock Balance
                  </span>
                  <p className="font-semibold text-[#F8FAFC] mt-0.5">
                    Invoice {unpaidInvoices[0].invoiceNumber} has {formatINR(unpaidInvoices[0].balanceDue)} balance due to unlock unwatermarked master files
                  </p>
                </div>
                <Link
                  to="/portal/invoices"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#38BDF8] hover:underline"
                >
                  <span>Scan UPI QR / Submit UTR →</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Monthly Creative Retainer & Deliverable Quota Tracker */}
      {(() => {
        const retainer = getClientRetainerPlan(
          profile?.email || user?.email || user?.uid || 'client',
          Math.max(1, projects.length)
        );
        if (!retainer) return null;
        const totalQuota = Math.max(1, retainer.monthlyDeliverableQuota);
        const totalUsed = Math.min(totalQuota, retainer.usedDeliverablesCount);
        const usagePercent = Math.min(100, Math.round((totalUsed / totalQuota) * 100));

        return (
          <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#10B981]/15 text-[#2DD4BF] border border-[#10B981]/30">
                    Renews {retainer.renewalDate} · Quota Meter
                  </span>
                  <h2 className="text-sm font-semibold text-[#F8FAFC]">{retainer.planName}</h2>
                </div>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  {retainer.includedServicesSummary}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-[#F8FAFC]">
                  {totalUsed} / {totalQuota} Deliverables Used ({usagePercent}%)
                </span>
                <p className="text-[11px] text-[#94A3B8]">
                  Plan Rate: {formatINR(retainer.monthlyRateInr)}/mo
                </p>
              </div>
            </div>

            <div className="w-full h-2 bg-[#040D1A] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#0EA5E9] to-[#10B981] rounded-full transition-all"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>
        );
      })()}



      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[#F8FAFC]">Recent Project Updates</h2>
            <Link to="/portal/projects" className="text-xs font-semibold text-[#F8FAFC] hover:text-[#10B981]">
              All Projects →
            </Link>
          </div>
          {loading ? (
            <p className="text-xs text-[#94A3B8]">Loading projects...</p>
          ) : projects.length === 0 ? (
            <p className="text-xs text-[#94A3B8] py-6">
              No projects are currently assigned to your account.
            </p>
          ) : (
            <div className="divide-y divide-[#1E3A5F]">
              {projects.map((p) => (
                <div key={p.id} className="py-3.5 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      to={`/portal/projects/${p.id}`}
                      className="text-sm font-semibold text-[#F8FAFC] hover:text-[#10B981] truncate"
                    >
                      {p.title}
                    </Link>
                    <div className="flex items-center gap-2 shrink-0">
                      <ProjectStatusBadge status={p.status} />
                      <span className="font-mono text-xs font-semibold tabular-nums text-[#F8FAFC]">
                        {p.progress}%
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-[#94A3B8]">{p.latestUpdate}</p>
                  <p className="text-[11px] font-mono text-[#94A3B8]">Deadline: {p.deadline}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[#F8FAFC]">Latest Deliverables</h2>
            <Link to="/portal/files" className="text-xs font-semibold text-[#F8FAFC] hover:text-[#10B981]">
              All Files →
            </Link>
          </div>
          {files.length === 0 ? (
            <p className="text-xs text-[#94A3B8] py-6">
              No deliverable files have been uploaded to your projects yet.
            </p>
          ) : (
            <div className="divide-y divide-[#1E3A5F]">
              {files.slice(0, 5).map((f) => (
                <div key={f.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-[#F8FAFC]">
                      {f.fileName} ({f.versionLabel})
                    </p>
                    <p className="text-[#94A3B8]">
                      {f.category} · {formatFileSize(f.fileSize)}
                    </p>
                  </div>
                  {f.downloadUrl && (
                    <a
                      href={f.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-[#F8FAFC] hover:text-[#10B981]"
                    >
                      Download →
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {inquiries.length > 0 && (
        <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#F8FAFC]">
                Booked Service Orders ({inquiries.length})
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Service bookings submitted under {clientEmail || 'your account'} are automatically synced to your project workspace.
              </p>
            </div>
            <Link
              to="/portal/book"
              className="text-xs font-semibold text-[#10B981] hover:underline"
            >
              + Book Another Service
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {inquiries.slice(0, 4).map((inq) => (
              <div
                key={inq.id}
                className="p-3.5 bg-[#132A4A]/70 border border-[#1E3A5F] rounded-lg flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-[#F8FAFC] truncate">{inq.serviceRequired}</p>
                  <p className="text-[#94A3B8] mt-0.5">
                    Budget: <span className="font-mono text-[#2DD4BF]">{inq.budgetRange || 'Scoped per brief'}</span> · Target: {inq.preferredDeadline || 'Flexible'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <CrmStatusBadge status={inq.status} />
                  <Link
                    to={`/portal/projects/${inq.id}`}
                    className="font-semibold text-[#F8FAFC] hover:text-[#10B981]"
                  >
                    Open →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 2. CLIENT MY PROJECTS & PROJECT DETAILS PAGES
// ============================================================================
export const ClientProjectsPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const clientEmail = profile?.email || user?.email || undefined;

  useEffect(() => {
    if (!user) return;
    fetchClientProjects(user.uid, clientEmail).then(setProjects).catch(() => {});
  }, [user, clientEmail]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-editorial text-2xl font-semibold text-[#F8FAFC]">My Projects & Booked Orders</h1>
          <p className="text-xs text-[#94A3B8] mt-1">
            View project progress, studio updates, deadlines, deliverables, and leave revision feedback.
          </p>
        </div>
        <Link
          to="/portal/book"
          className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg"
        >
          + Book New Service
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-10 text-center space-y-3">
          <p className="text-sm font-semibold text-[#F8FAFC]">No active projects found</p>
          <p className="text-xs text-[#94A3B8]">
            Submit a project brief or ask Shankar Baluragi to link your UID ({user?.uid}).
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {projects.map((p) => (
            <div
              key={p.id}
              className="bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-6 flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-2">
                  <span>{p.serviceType}</span>
                  <span>Due {p.deadline}</span>
                </div>
                <h2 className="text-lg font-semibold text-[#F8FAFC]">{p.title}</h2>
                <p className="text-xs text-[#94A3B8] mt-2 leading-relaxed">{p.latestUpdate}</p>
              </div>

              <div className="space-y-3 pt-4 border-t border-[#1E3A5F]">
                <div className="flex items-center justify-between text-xs">
                  <ProjectStatusBadge status={p.status} />
                  <span className="font-mono font-semibold tabular-nums">{p.progress}%</span>
                </div>
                <div className="w-full h-2 bg-[#132A4A] rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${getProjectStatusBadgeConfig(p.status).barClass}`}
                    style={{ width: `${Math.min(100, Math.max(0, p.progress))}%` }}
                  />
                </div>
                <div className="pt-1 flex justify-end">
                  <Link
                    to={`/portal/projects/${p.id}`}
                    className="text-xs font-semibold text-[#F8FAFC] hover:text-[#10B981]"
                  >
                    Open Project Workspace →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const ClientProjectDetailsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [files, setFiles] = useState<DeliverableFile[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [commentText, setCommentText] = useState('');
  const [revisionNote, setRevisionNote] = useState('');
  const [previewItem, setPreviewItem] = useState<PreviewableMediaItem | null>(null);
  const [signOffRecord, setSignOffRecord] = useState<MilestoneApprovalSignOffRecord | null>(null);
  const [testimonialRating, setTestimonialRating] = useState<number>(5);
  const [testimonialFeedback, setTestimonialFeedback] = useState<string>('');
  const [testimonialSubmitted, setTestimonialSubmitted] = useState<boolean>(false);

  const clientEmail = profile?.email || user?.email || undefined;

  const loadAll = useCallback(async () => {
    if (!user || !projectId) return;
    const [projs, tsks, fls, invs, msgs] = await Promise.all([
      fetchClientProjects(user.uid, clientEmail),
      fetchClientVisibleTasks(user.uid, clientEmail),
      fetchClientFiles(user.uid, clientEmail),
      fetchClientInvoices(user.uid, clientEmail).catch(() => []),
      fetchProjectMessages(projectId, false, user.uid),
    ]);
    setProject(projs.find((p) => p.id === projectId) || null);
    setTasks(tsks.filter((t) => t.projectId === projectId));
    setFiles(fls.filter((f) => f.projectId === projectId));
    setInvoices(invs);
    setMessages(msgs);
    setSignOffRecord(getMilestoneApprovalSignOff(projectId));
  }, [user, projectId, clientEmail]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (!project) {
    return (
      <div className="text-xs text-[#94A3B8] py-12">
        Project not found or does not belong to your client account.
      </div>
    );
  }

  const handleAction = async (status: 'Revision Requested' | 'Completed') => {
    try {
      const note =
        revisionNote.trim() ||
        (status === 'Completed'
          ? 'Client formally approved final deliverables and signed off on project milestones.'
          : 'Client requested revision.');
      await clientRequestRevisionOrApprove(project, status, note);
      if (status === 'Completed') {
        const approver = profile?.displayName || user?.email || 'Client';
        const recorded = recordMilestoneApprovalSignOff(project.id, approver, note);
        setSignOffRecord(recorded);
        if (user) {
          await postProjectMessage({
            projectId: project.id,
            clientUserId: user.uid,
            senderName: approver,
            senderRole: 'client',
            content: `✅ MILESTONE APPROVAL SIGN-OFF: Formally approved final deliverables on ${new Date(
              recorded.approvedAt
            ).toLocaleString('en-IN')}. Note: ${note}`,
            visibility: 'client',
          }).catch(() => {});
        }
      }
      setRevisionNote('');
      showToast(
        'success',
        status === 'Completed'
          ? 'Final Deliverable Formally Approved & Timestamp Logged!'
          : 'Revision Requested'
      );
      await loadAll();
    } catch (err) {
      showToast('error', 'Action Failed', err instanceof Error ? err.message : '');
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !user) return;
    try {
      await postProjectMessage({
        projectId: project.id,
        clientUserId: user.uid,
        senderName: profile?.displayName || 'Client',
        senderRole: 'client',
        content: commentText,
        visibility: 'client',
      });
      setCommentText('');
      await loadAll();
      showToast('success', 'Comment Sent');
    } catch (err) {
      showToast('error', 'Failed to send comment', err instanceof Error ? err.message : '');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/portal/projects" className="text-xs text-[#94A3B8] hover:text-[#F8FAFC]">
            ← Back to My Projects
          </Link>
          <div className="flex flex-wrap items-center gap-2.5 mt-1">
            <h1 className="font-editorial text-2xl font-semibold text-[#F8FAFC]">{project.title}</h1>
            <ProjectStatusBadge status={project.status} />
          </div>
          <p className="text-xs text-[#94A3B8] mt-1">
            Progress: <span className="font-mono text-[#F8FAFC]">{project.progress}%</span> · Deadline: {project.deadline}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            const url = buildPublicProjectTrackerUrl(project);
            navigator.clipboard.writeText(url);
            showToast('success', 'Live Project Tracker Link Copied', url);
          }}
          className="px-3.5 py-2 text-xs font-semibold text-[#2DD4BF] bg-[#10B981]/10 hover:bg-[#10B981]/20 border border-[#10B981]/30 rounded-lg transition-colors"
        >
          Copy Shareable Tracker Link
        </button>
      </div>

      {/* 5-Step Horizontal Visual Project Lifecycle Stepper */}
      <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-5 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[#F8FAFC]">Project Production Lifecycle</span>
          <span className="font-mono text-[11px] text-[#2DD4BF]">
            {project.progress}% Complete
          </span>
        </div>
        <ProjectLifecycleStepper
          status={project.status}
          progress={project.progress}
          isMasterUnlocked={checkProjectMasterUnlockStatus(project.id, invoices).isUnlocked}
        />
      </div>

      <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-6 space-y-4">

        <h2 className="text-sm font-semibold text-[#F8FAFC]">Latest Studio Update & Brief</h2>
        <p className="text-xs text-[#F8FAFC] bg-[#132A4A] p-3.5 rounded-lg">{project.latestUpdate}</p>
        {project.brief && (
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            <span className="font-semibold text-[#F8FAFC]">Scope Brief:</span> {project.brief}
          </p>
        )}

        {(() => {
          const unlockStatus = checkProjectMasterUnlockStatus(project.id, invoices);
          const isApproved = project.status === 'Completed' || Boolean(signOffRecord);
          return (
            <div className="pt-4 border-t border-[#1E3A5F] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                  <span className="text-xs font-semibold text-[#F8FAFC]">
                    Formal Milestone Approval Sign-Off & Master File Unlock
                  </span>
                </div>
                {isApproved && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-[#16A34A]/15 text-[#16A34A] text-[11px] font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Signed Off</span>
                  </span>
                )}
              </div>

              {isApproved ? (
                <div className="p-4 rounded-lg bg-[#16A34A]/10 border border-[#16A34A]/30 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-[#4ADE80]">
                      ✓ Final Deliverable Formally Approved by{' '}
                      {signOffRecord?.approvedBy || profile?.displayName || 'Client'}
                    </p>
                    <span className="font-mono text-[11px] text-[#94A3B8]">
                      Logged:{' '}
                      {signOffRecord?.approvedAt
                        ? new Date(signOffRecord.approvedAt).toLocaleString('en-IN')
                        : formatDate(project.updatedAt)}
                    </span>
                  </div>
                  <p className="text-[#F8FAFC]/90">{signOffRecord?.signOffNote || project.latestUpdate}</p>
                  <div className="pt-2 border-t border-[#16A34A]/20 flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-[#94A3B8]">
                      {unlockStatus.isUnlocked ? (
                        <>
                          <Unlock className="w-3.5 h-3.5 text-[#10B981]" />
                          <span className="text-[#10B981] font-semibold">
                            Invoice Balance Settled (₹0 Due) — All Unwatermarked Master Source Files Unlocked Below!
                          </span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5 text-[#D97706]" />
                          <span className="text-[#FBBF24]">
                            Approval logged! Settle remaining invoice balance ({formatINR(unlockStatus.balanceDue)}) to unlock master source file downloads.
                          </span>
                        </>
                      )}
                    </span>
                    {!unlockStatus.isUnlocked && (
                      <Link
                        to="/portal/invoices"
                        className="px-3 py-1 rounded bg-[#10B981] text-[#040D1A] font-bold text-[11px] hover:opacity-95"
                      >
                        Pay Invoice via UPI QR →
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-[#94A3B8]">
                    Review your drafts below using timestamped video notes or graphic frame pins. Click any timestamp chip below to insert it directly into your revision note, or click{' '}
                    <strong className="text-[#F8FAFC]">Approve Final Deliverable</strong> to log your formal approval timestamp.
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-[#94A3B8] mr-1">Quick-Insert Video Timestamp:</span>
                    {['[00:15]', '[00:30]', '[00:45]', '[01:15]', '[02:00]', '[Color Grade]', '[Audio Mix]'].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() =>
                          setRevisionNote((prev) => `${prev ? `${prev.trim()} ` : ''}${chip} `)
                        }
                        className="px-2 py-0.5 rounded bg-[#132A4A] hover:bg-[#1E3A5F] text-[#2DD4BF] border border-[#1E3A5F] font-mono text-[10px] transition-colors"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={revisionNote}
                    onChange={(e) => setRevisionNote(e.target.value)}
                    placeholder="e.g. [00:42] Boost vocal clarity and brighten headline contrast..."
                    className="w-full px-3 py-2 text-xs bg-[#132A4A] border border-[#1E3A5F] rounded-lg"
                  />
                  <div className="flex flex-wrap gap-3">

                    <button
                      type="button"
                      onClick={() => handleAction('Completed')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#16A34A] hover:bg-[#15803D] rounded-lg shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approve Final Deliverable</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction('Revision Requested')}
                      className="px-4 py-2 text-xs font-semibold text-[#F8FAFC] bg-[#132A4A] hover:bg-[#1E3A5F] border border-[#1E3A5F] rounded-lg"
                    >
                      Request Revision
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Deliverables & Milestones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-6">
          <h3 className="text-sm font-semibold text-[#F8FAFC] mb-3">
            Client-Visible Milestones ({tasks.length})
          </h3>
          {tasks.length === 0 ? (
            <p className="text-xs text-[#94A3B8]">No milestones listed yet.</p>
          ) : (
            <div className="divide-y divide-[#1E3A5F] text-xs">
              {tasks.map((t) => (
                <div key={t.id} className="py-2.5 flex justify-between">
                  <span>{t.title}</span>
                  <span className="font-semibold">{t.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-6 space-y-3">
          {(() => {
            const unlockStatus = checkProjectMasterUnlockStatus(project.id, invoices);
            const projectPins = getProofingPins(project.id);
            return (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#F8FAFC]">
                    Project Deliverables & Visual Proofing ({files.length})
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded text-[11px] font-semibold ${
                      unlockStatus.isUnlocked
                        ? 'bg-[#16A34A]/15 text-[#16A34A]'
                        : 'bg-[#10B981]/20 text-[#0EA5E9]'
                    }`}
                  >
                    {unlockStatus.isUnlocked ? 'High-Res Master Unlocked' : 'Watermarked Preview Mode'}
                  </span>
                </div>
                <p className="text-[11px] text-[#94A3B8] bg-[#132A4A] p-2.5 rounded border border-[#1E3A5F]">
                  {unlockStatus.reason}. Click <strong>Proof & Pin Note</strong> on any image or video to drop coordinate/timestamp revision pins ({projectPins.length} pins recorded).
                </p>
                {files.length === 0 ? (
                  <p className="text-xs text-[#94A3B8]">No files uploaded for this project yet.</p>
                ) : (
                  <div className="divide-y divide-[#1E3A5F] text-xs">
                    {files.map((f) => {
                      const filePins = getProofingPins(project.id, f.id);
                      const isLockedPreview = !unlockStatus.isUnlocked && f.category !== 'Reference';
                      return (
                        <div key={f.id} className="py-2.5 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <span className="font-semibold text-[#F8FAFC] block truncate">
                              {f.fileName} ({f.versionLabel})
                            </span>
                            <span className="text-[11px] text-[#94A3B8]">
                              {f.category} · {formatFileSize(f.fileSize)}
                              {filePins.length > 0 ? ` · ${filePins.length} Pin Notes` : ''}
                            </span>
                          </div>
                          {(f.downloadUrl || f.storagePath) && (
                            <div className="flex items-center gap-2.5 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewItem({
                                    id: f.id,
                                    title: `${f.fileName} (${f.versionLabel})`,
                                    url: f.downloadUrl,
                                    mimeType: f.fileType,
                                    fileSize: f.fileSize,
                                    storageBucket: f.storageBucket || 'private-project-files',
                                    storagePath: f.storagePath,
                                    description: f.description,
                                    tags: f.tags,
                                    categoryLabel: `${f.category} · ${f.versionLabel}`,
                                    createdAt: f.createdAt,
                                    uploaderName: f.uploaderName,
                                    watermarkText: isLockedPreview
                                      ? 'PRITHVI EDITIFY — PREVIEW PROOF'
                                      : undefined,
                                    masterDownloadLocked: isLockedPreview,
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#132A4A] text-[#F8FAFC] font-semibold hover:bg-[#132A4A]"
                              >
                                <Eye className="w-3.5 h-3.5 text-[#10B981]" />
                                <span>Proof & Pin Note</span>
                              </button>
                              {!isLockedPreview ? (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const url = await resolveStoragePreviewUrl({
                                      storageBucket: f.storageBucket || 'private-project-files',
                                      storagePath: f.storagePath,
                                      fallbackUrl: f.downloadUrl,
                                      expiresInSeconds: 3600,
                                    });
                                    if (url) window.open(url, '_blank', 'noopener,noreferrer');
                                  }}
                                  className="font-semibold text-[#16A34A] hover:underline"
                                >
                                  Download Master →
                                </button>
                              ) : (
                                <Link
                                  to="/portal/invoices"
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#D97706] hover:underline"
                                  title="Settle project invoice balance to ₹0 to unlock high-res master download"
                                >
                                  <Lock className="w-3 h-3" />
                                  <span>Locked</span>
                                </Link>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Timestamped Video & Frame-Pinning Feedback Summary */}
      {(() => {
        const allProjectPins = getProofingPins(project.id);
        return (
          <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#10B981]" />
                <h3 className="text-sm font-semibold text-[#F8FAFC]">
                  Timestamped Video & Frame-Pinning Feedback ({allProjectPins.length})
                </h3>
              </div>
              <span className="text-[11px] font-mono text-[#2DD4BF]">
                Click "Proof & Pin Note" on any file above to pin a spot or video timestamp (e.g., 01:14)
              </span>
            </div>
            {allProjectPins.length === 0 ? (
              <p className="text-xs text-[#94A3B8]">
                No timestamped or frame-pinned revision notes recorded yet. Open any deliverable preview above and click on the video timeline or graphic canvas to drop a pin.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {allProjectPins.map((pin, idx) => (
                  <div
                    key={pin.id}
                    className="p-3 rounded-lg bg-[#132A4A] border border-[#1E3A5F] flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-[#10B981]/20 text-[#2DD4BF] font-mono font-bold text-[10px]">
                          Pin #{idx + 1} · ({pin.xPercent}%, {pin.yPercent}%)
                        </span>
                        {pin.timestampSeconds !== undefined && pin.timestampSeconds !== null && (
                          <span className="px-2 py-0.5 rounded bg-[#0EA5E9]/20 text-[#38BDF8] font-mono font-bold text-[10px]">
                            ⏱ {formatVideoTimestamp(pin.timestampSeconds)}
                          </span>
                        )}
                        <span className="text-[11px] text-[#94A3B8]">by {pin.authorName}</span>
                      </div>
                      <p className="text-[#F8FAFC]">{pin.comment}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          pin.resolved
                            ? 'bg-[#16A34A]/20 text-[#4ADE80]'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {pin.resolved ? 'Resolved' : 'Open'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const tag =
                            pin.timestampSeconds !== undefined && pin.timestampSeconds !== null
                              ? `[${formatVideoTimestamp(pin.timestampSeconds)}]`
                              : `[Pin #${idx + 1} (${pin.xPercent}%,${pin.yPercent}%)]`;
                          setRevisionNote((prev) =>
                            `${prev ? `${prev.trim()} ` : ''}${tag} ${pin.comment}`
                          );
                          showToast('info', 'Inserted into Revision Note', `${tag} added above.`);
                        }}
                        className="text-[10px] font-semibold text-[#38BDF8] hover:underline"
                      >
                        + Insert into Revision Note
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Client 5-Star Testimonial & Review Submission on Completed Projects */}
      {project.status === 'Completed' && (
        <div className="bg-[#0D1F38] border border-[#10B981]/40 rounded-lg p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#10B981]">
                Project Completed · Client Feedback
              </span>
              <h3 className="text-sm font-semibold text-[#F8FAFC] mt-0.5">
                Rate Your Studio Experience with Prithvi Editify
              </h3>
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setTestimonialRating(star)}
                  className={`text-lg transition-transform hover:scale-110 ${
                    star <= testimonialRating ? 'text-amber-400' : 'text-[#475569]'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          {testimonialSubmitted ||
          getProjectTestimonials().some((t) => t.projectId === project.id) ? (
            <div className="p-3.5 rounded-lg bg-[#16A34A]/15 border border-[#16A34A]/30 text-xs text-[#4ADE80] font-medium">
              ★ Thank you for sharing your review! Your feedback has been recorded for Shankar Baluragi.
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={testimonialFeedback}
                onChange={(e) => setTestimonialFeedback(e.target.value)}
                placeholder="Share a quick testimonial on editing quality, turnaround speed, or communication..."
                className="flex-1 px-3 py-2 text-xs bg-[#132A4A] border border-[#1E3A5F] rounded-lg text-[#F8FAFC]"
              />
              <button
                type="button"
                onClick={() => {
                  if (!testimonialFeedback.trim()) {
                    showToast('error', 'Review Text Required', 'Please write a short note.');
                    return;
                  }
                  submitProjectTestimonial({
                    projectId: project.id,
                    projectTitle: project.title,
                    serviceType: project.serviceType,
                    clientName: profile?.displayName || 'Verified Client',
                    rating: testimonialRating,
                    reviewText: testimonialFeedback.trim(),
                  });

                  setTestimonialSubmitted(true);
                  setTestimonialFeedback('');
                  showToast('success', 'Thank You for Your 5-Star Review!');
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg shrink-0"
              >
                Submit Review ({testimonialRating}★)
              </button>
            </div>
          )}
        </div>
      )}


      {/* Project Comments */}
      <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-6 space-y-4">
        <h3 className="text-sm font-semibold text-[#F8FAFC]">Project Discussion Thread</h3>
        <div className="space-y-2.5 max-h-72 overflow-y-auto">
          {messages.map((m) => (
            <div key={m.id} className="p-3 bg-[#132A4A] rounded-lg text-xs">
              <p className="font-semibold text-[#F8FAFC]">
                {m.senderName} · <span className="text-[#94A3B8] font-normal">{formatDate(m.createdAt)}</span>
              </p>
              <p className="mt-1">{m.content}</p>
            </div>
          ))}
        </div>
        <form onSubmit={handlePostComment} className="flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Write a comment or feedback note..."
            className="flex-1 px-3 py-2 text-xs bg-[#132A4A] border border-[#1E3A5F] rounded-lg"
          />
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg"
          >
            Send
          </button>
        </form>
      </div>

      <MediaPreviewModal
        item={previewItem}
        onClose={() => setPreviewItem(null)}
        proofingContext={
          user
            ? {
                projectId: project.id,
                authorName: profile?.displayName || 'Client',
                authorRole: 'client',
                onPinAdded: async (formattedPinComment) => {
                  try {
                    await postProjectMessage({
                      projectId: project.id,
                      clientUserId: user.uid,
                      senderName: profile?.displayName || 'Client',
                      senderRole: 'client',
                      content: formattedPinComment,
                      visibility: 'client',
                    });
                    await loadAll();
                    showToast('success', 'Pin Revision Note Saved & Posted');
                  } catch {
                    showToast('info', 'Pin Saved Locally');
                  }
                },
              }
            : undefined
        }
      />
    </div>
  );
};

// ============================================================================
// 3. CLIENT TIMELINE, FILES, INVOICES, PAYMENT GUIDE & MESSAGES PAGES
// ============================================================================
export const ClientTimelinePage: React.FC = () => {
  const { user, profile } = useAuth();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const clientEmail = profile?.email || user?.email || undefined;

  useEffect(() => {
    if (!user) return;
    fetchClientVisibleTasks(user.uid, clientEmail).then(setTasks).catch(() => {});
  }, [user, clientEmail]);

  return (
    <div className="space-y-6">
      <h1 className="font-editorial text-2xl font-semibold text-[#F8FAFC]">Project Timeline & Milestones</h1>
      <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-lg divide-y divide-[#1E3A5F]">
        {tasks.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#94A3B8]">
            No client-visible tasks or milestones scheduled yet.
          </div>
        ) : (
          tasks.map((t) => (
            <div key={t.id} className="p-4 flex items-center justify-between text-xs">
              <div>
                <p className="font-semibold text-[#F8FAFC]">{t.title}</p>
                <p className="text-[#94A3B8]">Due: {t.dueDate}</p>
              </div>
              <CrmStatusBadge status={t.status} />
            </div>
          ))
        )}
      </div>
    </div>
  );
};


export const ClientFilesPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [files, setFiles] = useState<DeliverableFile[]>([]);
  const [previewItem, setPreviewItem] = useState<PreviewableMediaItem | null>(null);
  const clientEmail = profile?.email || user?.email || undefined;

  useEffect(() => {
    if (!user) return;
    fetchClientFiles(user.uid, clientEmail).then(setFiles).catch(() => {});
  }, [user, clientEmail]);

  const previewGalleryItems: PreviewableMediaItem[] = files.map((f) => ({
    id: f.id,
    title: `${f.fileName} (${f.versionLabel})`,
    url: f.downloadUrl,
    mimeType: f.fileType,
    fileSize: f.fileSize,
    storageBucket: f.storageBucket || 'private-project-files',
    storagePath: f.storagePath,
    description: f.description,
    tags: f.tags,
    categoryLabel: `${f.category} · ${f.versionLabel}`,
    createdAt: f.createdAt,
    uploaderName: f.uploaderName,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-editorial text-2xl font-semibold text-[#F8FAFC]">
          Deliverable Files & Previews
        </h1>
        <p className="text-xs text-[#94A3B8] mt-1">
          Inspect design proofs, watch video previews, and download final deliverables via authenticated signed links.
        </p>
      </div>

      <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-lg divide-y divide-[#1E3A5F]">
        {files.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#94A3B8]">
            No deliverable files available for download yet.
          </div>
        ) : (
          files.map((f, idx) => (
            <div key={f.id} className="p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-[#F8FAFC]">
                    {f.fileName} ({f.versionLabel})
                  </p>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono bg-[#132A4A] border border-[#1E3A5F] rounded">
                    <Lock className="w-2.5 h-2.5 text-[#10B981]" />
                    Private Vault
                  </span>
                </div>
                <p className="text-[#94A3B8] mt-0.5">
                  {f.category} · {formatFileSize(f.fileSize)} · Uploaded {formatDate(f.createdAt)}
                </p>
                {f.description && <p className="text-[#94A3B8] mt-1">{f.description}</p>}
              </div>
              {(f.downloadUrl || f.storagePath) && (
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPreviewItem(previewGalleryItems[idx])}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold text-[#F8FAFC] bg-[#132A4A] hover:bg-[#1E3A5F] rounded-md"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const signed = await resolveStoragePreviewUrl({
                        storageBucket: f.storageBucket || 'private-project-files',
                        storagePath: f.storagePath,
                        fallbackUrl: f.downloadUrl,
                        expiresInSeconds: 3600,
                      });
                      if (signed) window.open(signed, '_blank', 'noopener,noreferrer');
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-md"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download File</span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <MediaPreviewModal
        item={previewItem}
        items={previewGalleryItems}
        onClose={() => setPreviewItem(null)}
        onSelectItem={(next) => setPreviewItem(next)}
      />
    </div>
  );
};

export const ClientInvoicesPage: React.FC = () => {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [paymentProofs, setPaymentProofs] = useState<ClientPaymentProofSubmission[]>([]);
  const [selected, setSelected] = useState<InvoiceRecord | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<QuotationRecord | null>(null);
  const [proofModalInvoice, setProofModalInvoice] = useState<InvoiceRecord | null>(null);
  const [proofForm, setProofForm] = useState({
    amount: 0,
    method: 'UPI' as 'UPI' | 'Bank Transfer (NEFT/IMPS)' | 'Other',
    utrNumber: '',
    receiptScreenshotDataUrl: '',
    notes: '',
  });

  const loadClientBilling = useCallback(async () => {
    if (!user) return;
    const clientEmail = profile?.email || user.email || undefined;
    const [invList, quoteList] = await Promise.all([
      fetchClientInvoices(user.uid, clientEmail).catch(() => []),
      fetchClientQuotations(user.uid, clientEmail).catch(() => []),
    ]);
    setInvoices(invList);
    setQuotations(quoteList);
    setPaymentProofs(getClientPaymentProofs(user.uid));
  }, [user, profile?.email]);

  useEffect(() => {
    loadClientBilling();
  }, [loadClientBilling]);

  const handleDecisionOnQuote = async (
    q: QuotationRecord,
    decision: 'Accepted' | 'Rejected'
  ) => {
    try {
      await clientRespondToQuotation({
        quotationId: q.id,
        decision,
        clientEmail: profile?.email || user?.email || q.clientEmail,
        clientUserId: user?.uid || q.clientUserId || '',
      });
      showToast(
        'success',
        decision === 'Accepted' ? 'Quotation Approved' : 'Quotation Declined',
        `${q.quotationNumber} marked as ${decision}.`
      );
      await loadClientBilling();
      if (selectedQuote?.id === q.id) {
        setSelectedQuote({ ...q, status: decision });
      }
    } catch (err) {
      showToast('error', 'Failed to update quotation', err instanceof Error ? err.message : '');
    }
  };

  const handleSubmitPaymentProof = (e: React.FormEvent) => {
    e.preventDefault();
    if (!proofModalInvoice || !user) return;
    if (!proofForm.utrNumber.trim()) {
      showToast('error', 'UTR / Reference Required', 'Please enter your 12-digit UPI UTR or bank reference ID.');
      return;
    }
    submitClientPaymentProof({
      invoiceId: proofModalInvoice.id,
      invoiceNumber: proofModalInvoice.invoiceNumber,
      clientId: proofModalInvoice.clientId,
      clientUserId: user.uid,
      clientName: profile?.displayName || proofModalInvoice.clientName,
      clientEmail: profile?.email || user.email || proofModalInvoice.clientEmail,
      amount: Number(proofForm.amount) || proofModalInvoice.balanceDue,
      method: proofForm.method,
      utrNumber: proofForm.utrNumber.trim(),
      receiptScreenshotDataUrl: proofForm.receiptScreenshotDataUrl || undefined,
      notes: proofForm.notes.trim(),
    });
    setPaymentProofs(getClientPaymentProofs(user.uid));
    setProofModalInvoice(null);
    showToast(
      'success',
      'Payment Proof Submitted for Verification',
      'Shankar Baluragi will verify your UTR in the Admin Payments queue.'
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-editorial text-2xl font-semibold text-[#F8FAFC] no-print">
          My Quotations & Invoices (INR)
        </h1>
        <p className="text-xs text-[#94A3B8] mt-1 no-print">
          Review and approve project estimates, scan dynamic UPI QR codes, submit UTR payment proofs, and print official PDF receipts.
        </p>
      </div>

      {/* Selected Quotation Printable Preview */}
      {selectedQuote && (
        <div className="bg-[#0D1F38] border border-[#10B981] rounded-lg p-8 space-y-5">
          <div className="flex justify-between border-b border-[#1E3A5F] pb-4">
            <div>
              <p className="text-[11px] font-semibold text-[#10B981]">PROJECT QUOTATION · SAC 9983</p>
              <h2 className="font-editorial text-xl font-semibold text-[#F8FAFC]">
                {selectedQuote.projectTitle}
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Prepared for {selectedQuote.clientName} · Timeline: {selectedQuote.estimatedTimeline}
              </p>
            </div>
            <div className="text-right font-mono text-xs">
              <p className="text-base font-semibold">{selectedQuote.quotationNumber}</p>
              <p>Valid Until: {selectedQuote.expiryDate}</p>
              <p className="font-sans font-semibold mt-0.5">Status: {selectedQuote.status}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-[#132A4A] rounded-lg text-xs">
            <div>
              <p className="font-semibold text-[#F8FAFC]">Scope Summary</p>
              <p className="text-[#94A3B8] mt-1">{selectedQuote.scopeSummary || '—'}</p>
            </div>
            <div>
              <p className="font-semibold text-[#F8FAFC]">Deliverables</p>
              <p className="text-[#94A3B8] mt-1">{selectedQuote.deliverables || '—'}</p>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            {selectedQuote.lineItems.map((li, i) => (
              <div key={i} className="flex justify-between py-1.5 border-b border-[#1E3A5F]">
                <span>
                  {li.description} ({li.quantity} × {formatINR(li.unitPrice)})
                </span>
                <span className="font-mono font-semibold">{formatINR(li.amount)}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between text-sm font-mono font-semibold pt-2">
            <span>Total Quoted (INR):</span>
            <span>{formatINR(selectedQuote.total)}</span>
          </div>

          <UpiQrCodeCard
            amount={Math.round(selectedQuote.total * 0.5)}
            referenceNumber={selectedQuote.quotationNumber}
            label={`50% Kickoff Advance (${formatINR(Math.round(selectedQuote.total * 0.5))}) — Scan via GPay / PhonePe`}
            compact
          />

          <p className="text-xs text-[#94A3B8]">{selectedQuote.termsAndConditions}</p>

          <div className="flex flex-wrap gap-3 no-print">
            {selectedQuote.status === 'Sent' && (
              <>
                <button
                  type="button"
                  onClick={() => handleDecisionOnQuote(selectedQuote, 'Accepted')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#16A34A] hover:bg-[#15803D] rounded-lg"
                >
                  Approve & Accept Quotation
                </button>
                <button
                  type="button"
                  onClick={() => handleDecisionOnQuote(selectedQuote, 'Rejected')}
                  className="px-4 py-2 text-xs font-semibold text-[#DC2626] bg-[#DC2626]/10 rounded-lg"
                >
                  Decline Quotation
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg"
            >
              Print / Save PDF
            </button>
            <button
              type="button"
              onClick={() => setSelectedQuote(null)}
              className="px-4 py-2 text-xs font-semibold bg-[#132A4A] rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Client Quotations Table (when any exist) */}
      {quotations.length > 0 && (
        <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-lg overflow-x-auto no-print">
          <div className="px-4 py-3 border-b border-[#1E3A5F]">
            <h2 className="text-sm font-semibold text-[#F8FAFC]">Project Quotations & Estimates</h2>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1E3A5F] text-[11px] font-semibold text-[#94A3B8]">
                <th className="py-3 px-4">Document #</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Project</th>
                <th className="py-3 px-4">Valid Until</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Total (INR)</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3A5F] text-xs">
              {quotations.map((q) => {
                const docType = inferQuotationDocumentType(q);
                return (
                  <tr key={q.id}>
                    <td className="py-3.5 px-4 font-mono font-semibold">
                      {q.quotationNumber}
                      {q.version && q.version > 1 ? ` (v${q.version})` : ''}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#132A4A] text-[#F8FAFC]">
                        {docType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">{q.projectTitle}</td>
                    <td className="py-3.5 px-4 font-mono text-[#94A3B8]">{q.expiryDate}</td>
                    <td className="py-3.5 px-4">
                      <CrmStatusBadge status={q.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums">

                      {formatINR(q.total)}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-3">
                      {q.status === 'Sent' && (
                        <button
                          type="button"
                          onClick={() => handleDecisionOnQuote(q, 'Accepted')}
                          className="font-semibold text-[#16A34A] hover:underline"
                        >
                          Approve {docType}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedQuote(q)}
                        className="font-semibold text-[#F8FAFC] hover:text-[#10B981]"
                      >
                        Inspect / Print →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="bg-[#0D1F38] border border-[#10B981] rounded-lg p-8 space-y-5">
          <div className="flex justify-between border-b border-[#1E3A5F] pb-4">
            <div>
              <p className="text-[11px] font-semibold text-[#10B981]">OFFICIAL TAX / STUDIO INVOICE · SAC 9983</p>
              <h2 className="font-editorial text-xl font-semibold">Prithvi Editify Invoice</h2>
              <p className="text-xs text-[#94A3B8]">{selected.projectTitle}</p>
            </div>
            <div className="text-right font-mono text-xs">
              <p className="text-base font-semibold">{selected.invoiceNumber}</p>
              <p>Due: {selected.dueDate}</p>
              <p className="font-sans font-semibold mt-0.5">Status: {selected.status}</p>
            </div>
          </div>
          <p className="text-xs text-[#F8FAFC]">{selected.itemsSummary}</p>
          <div className="flex flex-wrap justify-between gap-4 text-sm font-mono font-semibold pt-3 border-t border-[#1E3A5F]">
            <span>Subtotal: {formatINR(selected.subtotal)}</span>
            {selected.taxRate > 0 && (
              <span>GST/Tax ({selected.taxRate}%): {formatINR(selected.taxAmount)}</span>
            )}
            <span>Total: {formatINR(selected.total)}</span>
            <span className={selected.balanceDue > 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'}>
              Balance Due: {formatINR(selected.balanceDue)}
            </span>
          </div>

          {/* Dynamic Scannable UPI QR Code with Exact Balance Due + 1-Click UTR Submission */}
          <UpiQrCodeCard
            amount={selected.balanceDue}
            referenceNumber={selected.invoiceNumber}
            onSubmitUtrClick={
              selected.balanceDue > 0
                ? () => {
                    setProofModalInvoice(selected);
                    setProofForm({
                      amount: selected.balanceDue,
                      method: 'UPI',
                      utrNumber: '',
                      receiptScreenshotDataUrl: '',
                      notes: '',
                    });
                  }
                : undefined
            }
          />

          <p className="text-xs text-[#94A3B8]">{selected.paymentInstructions}</p>
          <div className="flex flex-wrap gap-3 no-print">
            {selected.balanceDue > 0 && (
              <button
                type="button"
                onClick={() => {
                  setProofModalInvoice(selected);
                  setProofForm({
                    amount: selected.balanceDue,
                    method: 'UPI',
                    utrNumber: '',
                    receiptScreenshotDataUrl: '',
                    notes: '',
                  });
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#16A34A] hover:bg-[#15803D] rounded-lg"
              >
                Submit UTR / Payment Proof
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg"
            >
              Print / Save PDF
            </button>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="px-4 py-2 text-xs font-semibold bg-[#132A4A] rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-lg overflow-x-auto no-print">
        <div className="px-4 py-3 border-b border-[#1E3A5F]">
          <h2 className="text-sm font-semibold text-[#F8FAFC]">Official Invoices</h2>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#1E3A5F] text-[11px] font-semibold text-[#94A3B8]">
              <th className="py-3 px-4">Invoice #</th>
              <th className="py-3 px-4">Project</th>
              <th className="py-3 px-4">Due Date</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Total</th>
              <th className="py-3 px-4 text-right">Balance Due</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E3A5F] text-xs">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[#94A3B8]">
                  No invoices issued to your account yet.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => {
                const pendingProof = paymentProofs.find(
                  (p) => p.invoiceId === inv.id && p.status === 'Pending Verification'
                );
                return (
                  <tr key={inv.id}>
                    <td className="py-3.5 px-4 font-mono font-semibold">{inv.invoiceNumber}</td>
                    <td className="py-3.5 px-4">{inv.projectTitle}</td>
                    <td className="py-3.5 px-4 font-mono text-[#94A3B8]">{inv.dueDate}</td>
                    <td className="py-3.5 px-4 font-medium">
                      <CrmStatusBadge status={inv.status} />
                      {pendingProof && (
                        <span className="block text-[10px] text-[#D97706] font-semibold mt-1">
                          UTR Submitted (Pending Admin Verification)
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">

                      {formatINR(inv.total)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums">
                      {formatINR(inv.balanceDue)}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-3 whitespace-nowrap">
                      {inv.balanceDue > 0 && !pendingProof && (
                        <button
                          type="button"
                          onClick={() => {
                            setProofModalInvoice(inv);
                            setProofForm({
                              amount: inv.balanceDue,
                              method: 'UPI',
                              utrNumber: '',
                              receiptScreenshotDataUrl: '',
                              notes: '',
                            });
                          }}
                          className="font-semibold text-[#16A34A] hover:underline"
                        >
                          Submit UTR Proof
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelected(inv)}
                        className="font-semibold text-[#F8FAFC] hover:text-[#10B981]"
                      >
                        UPI QR / Print →
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Client Payment Proof Upload Modal */}
      {proofModalInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#040D1A]/65 p-4 no-print">
          <form
            onSubmit={handleSubmitPaymentProof}
            className="bg-[#0D1F38] border border-[#1E3A5F] rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl"
          >
            <div>
              <span className="text-[11px] font-mono font-semibold text-[#10B981]">
                PAYMENT VERIFICATION QUEUE
              </span>
              <h3 className="text-base font-semibold text-[#F8FAFC]">
                Submit Payment Proof ({proofModalInvoice.invoiceNumber})
              </h3>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Share your UPI UTR / Bank Reference ID or screenshot. Once verified by Shankar Baluragi, your invoice balance updates to ₹0 and master deliverables unlock automatically.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Amount Paid (INR) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={proofModalInvoice.balanceDue}
                  value={proofForm.amount}
                  onChange={(e) => setProofForm({ ...proofForm, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-mono bg-[#132A4A] border border-[#1E3A5F] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Transfer Method</label>
                <select
                  value={proofForm.method}
                  onChange={(e) =>
                    setProofForm({
                      ...proofForm,
                      method: e.target.value as 'UPI' | 'Bank Transfer (NEFT/IMPS)' | 'Other',
                    })
                  }
                  className="w-full px-3 py-2 text-xs bg-[#132A4A] border border-[#1E3A5F] rounded-lg"
                >
                  <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                  <option value="Bank Transfer (NEFT/IMPS)">Bank Transfer (NEFT/IMPS)</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                12-Digit UPI UTR / Transaction Reference ID *
              </label>
              <input
                type="text"
                required
                value={proofForm.utrNumber}
                onChange={(e) => setProofForm({ ...proofForm, utrNumber: e.target.value })}
                placeholder="e.g. 429118394812"
                className="w-full px-3 py-2 text-xs font-mono bg-[#132A4A] border border-[#1E3A5F] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#F8FAFC] mb-1">
                Optional Payment Screenshot (PNG/JPG)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    if (typeof reader.result === 'string') {
                      setProofForm((prev) => ({
                        ...prev,
                        receiptScreenshotDataUrl: reader.result as string,
                      }));
                    }
                  };
                  reader.readAsDataURL(file);
                }}
                className="w-full text-xs text-[#94A3B8]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#F8FAFC] mb-1">
                Note (Optional)
              </label>
              <input
                type="text"
                value={proofForm.notes}
                onChange={(e) => setProofForm({ ...proofForm, notes: e.target.value })}
                placeholder="Paid via Google Pay..."
                className="w-full px-3 py-2 text-xs bg-[#132A4A] border border-[#1E3A5F] rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProofModalInvoice(null)}
                className="px-4 py-2 text-xs font-medium bg-[#132A4A] rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#16A34A] hover:bg-[#15803D] rounded-lg"
              >
                Submit for Admin Verification
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export const ClientPaymentInstructionsPage: React.FC = () => (
  <div className="max-w-2xl space-y-6">
    <h1 className="font-editorial text-2xl font-semibold text-[#F8FAFC]">
      Payment Instructions & Verification
    </h1>
    <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-6 space-y-4 text-xs leading-relaxed text-[#94A3B8]">
      <h2 className="text-sm font-semibold text-[#F8FAFC]">1. Standard INR Settlement (UPI / Bank Transfer)</h2>
      <p>
        Each invoice issued in your Client Portal contains specific UPI or NEFT/IMPS bank transfer instructions along with the exact INR balance due.
      </p>
      <h2 className="text-sm font-semibold text-[#F8FAFC]">2. Payment Verification Policy</h2>
      <p>
        To maintain strict financial accuracy, clients cannot self-mark an invoice as paid. Once you complete a UPI or bank transfer, share the 12-digit UTR / transaction reference in your project message thread. Shankar Baluragi will verify receipt and record the payment on your invoice.
      </p>
      <h2 className="text-sm font-semibold text-[#F8FAFC]">3. Online Gateway Support</h2>
      <p>
        When online payment provider credentials (such as Razorpay) are configured on the server, payments are verified cryptographically via server-side HMAC signatures before updating your invoice status.
      </p>
    </div>
  </div>
);

export const ClientMessagesPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const clientEmail = profile?.email || user?.email || undefined;

  useEffect(() => {
    if (!user) return;
    fetchClientProjects(user.uid, clientEmail).then(setProjects).catch(() => {});
  }, [user, clientEmail]);

  return (
    <div className="space-y-6">
      <h1 className="font-editorial text-2xl font-semibold text-[#F8FAFC]">Project Messages</h1>
      <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-lg divide-y divide-[#1E3A5F] text-xs">
        {projects.length === 0 ? (
          <div className="p-8 text-center text-[#94A3B8]">
            Open any assigned project to view and post project comments.
          </div>
        ) : (
          projects.map((p) => (
            <div key={p.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-[#F8FAFC]">{p.title}</p>
                <p className="text-[#94A3B8]">{p.latestUpdate}</p>
              </div>
              <Link
                to={`/portal/projects/${p.id}`}
                className="font-semibold text-[#F8FAFC] hover:text-[#10B981]"
              >
                Open Thread →
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const ClientNewInquiryPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#10B981] uppercase tracking-wider">
            Client Portal · Service Booking
          </p>
          <h1 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#F8FAFC] mt-1">
            Request a New Project or Service
          </h1>
          <p className="text-xs text-[#94A3B8] mt-1">
            Submit your project brief, custom INR budget range, and reference links directly from your Client Portal.
          </p>
        </div>
        <Link
          to="/portal"
          className="px-3.5 py-2 text-xs font-semibold text-[#F8FAFC] bg-[#132A4A] hover:bg-[#1E3A5F] border border-[#1E3A5F] rounded-lg transition-colors"
        >
          ← Back to Overview
        </Link>
      </div>

      <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-6 sm:p-8 shadow-xl">
        <InquiryForm />
      </div>
    </div>
  );
};

