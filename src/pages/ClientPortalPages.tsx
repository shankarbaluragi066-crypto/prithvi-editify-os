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
} from 'lucide-react';
import {
  fetchClientProjects,
  fetchClientVisibleTasks,
  fetchClientFiles,
  fetchClientInvoices,
  fetchProjectMessages,
  postProjectMessage,
  clientRequestRevisionOrApprove,
  resolveStoragePreviewUrl,
} from '../services/crmService';
import { MediaPreviewModal, PreviewableMediaItem } from '../components/MediaPreviewModal';
import {
  ProjectRecord,
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
  submitClientPaymentProof,
  getClientPaymentProofs,
  ClientPaymentProofSubmission,
} from '../services/workflowEnhancementsService';
import { UpiQrCodeCard } from '../components/StudioEnhancements';
import { formatINR, formatDate, formatFileSize } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

// ============================================================================
// 1. CLIENT DASHBOARD PAGE
// ============================================================================
export const ClientDashboardPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [files, setFiles] = useState<DeliverableFile[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetchClientProjects(user.uid),
      fetchClientFiles(user.uid),
      fetchClientInvoices(user.uid),
      fetchClientQuotations(user.uid, profile?.email || user.email || undefined).catch(() => []),
    ])
      .then(([p, f, inv, q]) => {
        setProjects(p);
        setFiles(f);
        setInvoices(inv);
        setQuotations(q);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, profile?.email]);

  const activeProjects = projects.filter((p) => !['Completed', 'Cancelled'].includes(p.status));
  const pendingQuotations = quotations.filter((q) => q.status === 'Sent');
  const pendingApprovals = projects.filter((p) => p.status === 'In Review');
  const unpaidInvoices = invoices.filter((i) => ['Sent', 'Partially Paid', 'Overdue'].includes(i.status));
  const paidInvoices = invoices.filter((i) => i.status === 'Paid');

  return (
    <div className="space-y-8">
      <div className="bg-white border border-[#E2E4DF] rounded-lg p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#6E7785]">Private Client Portal</p>
          <h1 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#172333] mt-1">
            Welcome, {profile?.displayName || 'Client'}
          </h1>
          <p className="text-xs text-[#6E7785] mt-1">
            Portal UID: <span className="font-mono text-[#172333] select-all">{user?.uid}</span> — Share this UID with Shankar Baluragi if you need an existing project linked to your account.
          </p>
        </div>
        <Link
          to="/contact"
          className="px-4 py-2.5 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg whitespace-nowrap shrink-0"
        >
          Submit New Brief
        </Link>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2E4DF] rounded-lg p-5">
          <p className="text-xs text-[#6E7785]">Active Projects</p>
          <p className="text-2xl font-mono font-semibold text-[#172333] mt-1 tabular-nums">
            {activeProjects.length}
          </p>
        </div>
        <div className="bg-white border border-[#E2E4DF] rounded-lg p-5">
          <p className="text-xs text-[#6E7785]">Pending Approvals & Quotes</p>
          <p className="text-2xl font-mono font-semibold text-[#A96518] mt-1 tabular-nums">
            {pendingApprovals.length + pendingQuotations.length}
          </p>
        </div>
        <div className="bg-white border border-[#E2E4DF] rounded-lg p-5">
          <p className="text-xs text-[#6E7785]">Unpaid Invoices</p>
          <p className="text-2xl font-mono font-semibold text-[#B93832] mt-1 tabular-nums">
            {unpaidInvoices.length}
          </p>
        </div>
        <div className="bg-white border border-[#E2E4DF] rounded-lg p-5">
          <p className="text-xs text-[#6E7785]">Paid Invoices</p>
          <p className="text-2xl font-mono font-semibold text-[#26734D] mt-1 tabular-nums">
            {paidInvoices.length}
          </p>
        </div>
      </div>

      {pendingQuotations.length > 0 && (
        <div className="bg-white border border-[#F18A45]/40 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#A96518]">
              Action Required · {pendingQuotations.length} Quotation / Estimate Awaiting Approval
            </p>
            <p className="text-xs text-[#6E7785] mt-0.5">
              Review scope, line items, and approve your project estimate or quotation in the billing portal.
            </p>
          </div>
          <Link
            to="/portal/invoices"
            className="px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg whitespace-nowrap shrink-0"
          >
            Review Quotations & Estimates →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E2E4DF] rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[#172333]">Recent Project Updates</h2>
            <Link to="/portal/projects" className="text-xs font-semibold text-[#172333] hover:text-[#F18A45]">
              All Projects →
            </Link>
          </div>
          {loading ? (
            <p className="text-xs text-[#6E7785]">Loading projects...</p>
          ) : projects.length === 0 ? (
            <p className="text-xs text-[#6E7785] py-6">
              No projects are currently assigned to your account.
            </p>
          ) : (
            <div className="divide-y divide-[#E2E4DF]">
              {projects.map((p) => (
                <div key={p.id} className="py-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <Link
                      to={`/portal/projects/${p.id}`}
                      className="text-sm font-semibold text-[#172333] hover:text-[#F18A45]"
                    >
                      {p.title}
                    </Link>
                    <span className="font-mono text-xs font-semibold tabular-nums">
                      {p.progress}% · {p.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#6E7785]">{p.latestUpdate}</p>
                  <p className="text-[11px] font-mono text-[#6E7785]">Deadline: {p.deadline}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E2E4DF] rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[#172333]">Latest Deliverables</h2>
            <Link to="/portal/files" className="text-xs font-semibold text-[#172333] hover:text-[#F18A45]">
              All Files →
            </Link>
          </div>
          {files.length === 0 ? (
            <p className="text-xs text-[#6E7785] py-6">
              No deliverable files have been uploaded to your projects yet.
            </p>
          ) : (
            <div className="divide-y divide-[#E2E4DF]">
              {files.slice(0, 5).map((f) => (
                <div key={f.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-[#172333]">
                      {f.fileName} ({f.versionLabel})
                    </p>
                    <p className="text-[#6E7785]">
                      {f.category} · {formatFileSize(f.fileSize)}
                    </p>
                  </div>
                  {f.downloadUrl && (
                    <a
                      href={f.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-[#172333] hover:text-[#F18A45]"
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
    </div>
  );
};

// ============================================================================
// 2. CLIENT MY PROJECTS & PROJECT DETAILS PAGES
// ============================================================================
export const ClientProjectsPage: React.FC = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchClientProjects(user.uid).then(setProjects).catch(() => {});
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-editorial text-2xl font-semibold text-[#172333]">My Projects</h1>
        <p className="text-xs text-[#6E7785] mt-1">
          View project progress, deadlines, deliverables, and leave revision feedback.
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white border border-[#E2E4DF] rounded-lg p-10 text-center space-y-3">
          <p className="text-sm font-semibold text-[#172333]">No active projects found</p>
          <p className="text-xs text-[#6E7785]">
            Submit a project brief or ask Shankar Baluragi to link your UID ({user?.uid}).
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {projects.map((p) => (
            <div
              key={p.id}
              className="bg-white border border-[#E2E4DF] rounded-lg p-6 flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-[#6E7785] mb-2">
                  <span>{p.serviceType}</span>
                  <span>Due {p.deadline}</span>
                </div>
                <h2 className="text-lg font-semibold text-[#172333]">{p.title}</h2>
                <p className="text-xs text-[#6E7785] mt-2 leading-relaxed">{p.latestUpdate}</p>
              </div>

              <div className="space-y-3 pt-4 border-t border-[#E2E4DF]">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#172333]">Status: {p.status}</span>
                  <span className="font-mono font-semibold tabular-nums">{p.progress}%</span>
                </div>
                <div className="w-full h-2 bg-[#F5F5F1] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#F18A45]"
                    style={{ width: `${Math.min(100, Math.max(0, p.progress))}%` }}
                  />
                </div>
                <div className="pt-1 flex justify-end">
                  <Link
                    to={`/portal/projects/${p.id}`}
                    className="text-xs font-semibold text-[#172333] hover:text-[#F18A45]"
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

  const loadAll = useCallback(async () => {
    if (!user || !projectId) return;
    const [projs, tsks, fls, invs, msgs] = await Promise.all([
      fetchClientProjects(user.uid),
      fetchClientVisibleTasks(user.uid),
      fetchClientFiles(user.uid),
      fetchClientInvoices(user.uid).catch(() => []),
      fetchProjectMessages(projectId, false, user.uid),
    ]);
    setProject(projs.find((p) => p.id === projectId) || null);
    setTasks(tsks.filter((t) => t.projectId === projectId));
    setFiles(fls.filter((f) => f.projectId === projectId));
    setInvoices(invs);
    setMessages(msgs);
  }, [user, projectId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (!project) {
    return (
      <div className="text-xs text-[#6E7785] py-12">
        Project not found or does not belong to your client account.
      </div>
    );
  }

  const handleAction = async (status: 'Revision Requested' | 'Completed') => {
    try {
      const note =
        revisionNote.trim() ||
        (status === 'Completed'
          ? 'Client approved deliverables.'
          : 'Client requested revision.');
      await clientRequestRevisionOrApprove(project, status, note);
      setRevisionNote('');
      showToast('success', status === 'Completed' ? 'Deliverables Approved' : 'Revision Requested');
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
      <div>
        <Link to="/portal/projects" className="text-xs text-[#6E7785] hover:text-[#172333]">
          ← Back to My Projects
        </Link>
        <h1 className="font-editorial text-2xl font-semibold text-[#172333] mt-1">{project.title}</h1>
        <p className="text-xs text-[#6E7785]">
          Status: <span className="font-semibold text-[#172333]">{project.status}</span> · Progress:{' '}
          <span className="font-mono">{project.progress}%</span> · Deadline: {project.deadline}
        </p>
      </div>

      <div className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-4">
        <h2 className="text-sm font-semibold text-[#172333]">Latest Studio Update & Brief</h2>
        <p className="text-xs text-[#172333] bg-[#F5F5F1] p-3.5 rounded-lg">{project.latestUpdate}</p>
        {project.brief && (
          <p className="text-xs text-[#6E7785] leading-relaxed">
            <span className="font-semibold text-[#172333]">Scope Brief:</span> {project.brief}
          </p>
        )}

        {!['Completed', 'Cancelled'].includes(project.status) && (
          <div className="pt-4 border-t border-[#E2E4DF] space-y-3">
            <label className="block text-xs font-semibold text-[#172333]">
              Submit Review Decision or Revision Notes
            </label>
            <input
              type="text"
              value={revisionNote}
              onChange={(e) => setRevisionNote(e.target.value)}
              placeholder="Optional note regarding revision details or final approval..."
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => handleAction('Revision Requested')}
                className="px-4 py-2 text-xs font-semibold text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-lg"
              >
                Request Revision
              </button>
              <button
                type="button"
                onClick={() => handleAction('Completed')}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#26734D] hover:bg-[#1e5c3d] rounded-lg"
              >
                Approve Final Deliverables
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Deliverables & Milestones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E2E4DF] rounded-lg p-6">
          <h3 className="text-sm font-semibold text-[#172333] mb-3">
            Client-Visible Milestones ({tasks.length})
          </h3>
          {tasks.length === 0 ? (
            <p className="text-xs text-[#6E7785]">No milestones listed yet.</p>
          ) : (
            <div className="divide-y divide-[#E2E4DF] text-xs">
              {tasks.map((t) => (
                <div key={t.id} className="py-2.5 flex justify-between">
                  <span>{t.title}</span>
                  <span className="font-semibold">{t.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-3">
          {(() => {
            const unlockStatus = checkProjectMasterUnlockStatus(project.id, invoices);
            const projectPins = getProofingPins(project.id);
            return (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#172333]">
                    Project Deliverables & Visual Proofing ({files.length})
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded text-[11px] font-semibold ${
                      unlockStatus.isUnlocked
                        ? 'bg-[#26734D]/15 text-[#26734D]'
                        : 'bg-[#F18A45]/20 text-[#B85D1D]'
                    }`}
                  >
                    {unlockStatus.isUnlocked ? 'High-Res Master Unlocked' : 'Watermarked Preview Mode'}
                  </span>
                </div>
                <p className="text-[11px] text-[#6E7785] bg-[#F5F5F1] p-2.5 rounded border border-[#E2E4DF]">
                  {unlockStatus.reason}. Click <strong>Proof & Pin Note</strong> on any image or video to drop coordinate/timestamp revision pins ({projectPins.length} pins recorded).
                </p>
                {files.length === 0 ? (
                  <p className="text-xs text-[#6E7785]">No files uploaded for this project yet.</p>
                ) : (
                  <div className="divide-y divide-[#E2E4DF] text-xs">
                    {files.map((f) => {
                      const filePins = getProofingPins(project.id, f.id);
                      const isLockedPreview = !unlockStatus.isUnlocked && f.category !== 'Reference';
                      return (
                        <div key={f.id} className="py-2.5 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <span className="font-semibold text-[#172333] block truncate">
                              {f.fileName} ({f.versionLabel})
                            </span>
                            <span className="text-[11px] text-[#6E7785]">
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
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#172333] text-white font-semibold hover:bg-[#24364A]"
                              >
                                <Eye className="w-3.5 h-3.5 text-[#F18A45]" />
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
                                  className="font-semibold text-[#26734D] hover:underline"
                                >
                                  Download Master →
                                </button>
                              ) : (
                                <Link
                                  to="/portal/invoices"
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#A96518] hover:underline"
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

      {/* Project Comments */}
      <div className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-4">
        <h3 className="text-sm font-semibold text-[#172333]">Project Discussion Thread</h3>
        <div className="space-y-2.5 max-h-72 overflow-y-auto">
          {messages.map((m) => (
            <div key={m.id} className="p-3 bg-[#F5F5F1] rounded-lg text-xs">
              <p className="font-semibold text-[#172333]">
                {m.senderName} · <span className="text-[#6E7785] font-normal">{formatDate(m.createdAt)}</span>
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
            className="flex-1 px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
          />
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-white bg-[#172333] rounded-lg"
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
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchClientVisibleTasks(user.uid).then(setTasks).catch(() => {});
  }, [user]);

  return (
    <div className="space-y-6">
      <h1 className="font-editorial text-2xl font-semibold text-[#172333]">Project Timeline & Milestones</h1>
      <div className="bg-white border border-[#E2E4DF] rounded-lg divide-y divide-[#E2E4DF]">
        {tasks.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#6E7785]">
            No client-visible tasks or milestones scheduled yet.
          </div>
        ) : (
          tasks.map((t) => (
            <div key={t.id} className="p-4 flex items-center justify-between text-xs">
              <div>
                <p className="font-semibold text-[#172333]">{t.title}</p>
                <p className="text-[#6E7785]">Due: {t.dueDate}</p>
              </div>
              <span className="font-semibold text-[#172333]">{t.status}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const ClientFilesPage: React.FC = () => {
  const { user } = useAuth();
  const [files, setFiles] = useState<DeliverableFile[]>([]);
  const [previewItem, setPreviewItem] = useState<PreviewableMediaItem | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchClientFiles(user.uid).then(setFiles).catch(() => {});
  }, [user]);

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
        <h1 className="font-editorial text-2xl font-semibold text-[#172333]">
          Deliverable Files & Previews
        </h1>
        <p className="text-xs text-[#6E7785] mt-1">
          Inspect design proofs, watch video previews, and download final deliverables via authenticated signed links.
        </p>
      </div>

      <div className="bg-white border border-[#E2E4DF] rounded-lg divide-y divide-[#E2E4DF]">
        {files.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#6E7785]">
            No deliverable files available for download yet.
          </div>
        ) : (
          files.map((f, idx) => (
            <div key={f.id} className="p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-[#172333]">
                    {f.fileName} ({f.versionLabel})
                  </p>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded">
                    <Lock className="w-2.5 h-2.5 text-[#F18A45]" />
                    Private Vault
                  </span>
                </div>
                <p className="text-[#6E7785] mt-0.5">
                  {f.category} · {formatFileSize(f.fileSize)} · Uploaded {formatDate(f.createdAt)}
                </p>
                {f.description && <p className="text-[#6E7785] mt-1">{f.description}</p>}
              </div>
              {(f.downloadUrl || f.storagePath) && (
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPreviewItem(previewGalleryItems[idx])}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-md"
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
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-md"
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
    const [invList, quoteList] = await Promise.all([
      fetchClientInvoices(user.uid).catch(() => []),
      fetchClientQuotations(user.uid, profile?.email || user.email || undefined).catch(() => []),
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
        <h1 className="font-editorial text-2xl font-semibold text-[#172333] no-print">
          My Quotations & Invoices (INR)
        </h1>
        <p className="text-xs text-[#6E7785] mt-1 no-print">
          Review and approve project estimates, scan dynamic UPI QR codes, submit UTR payment proofs, and print official PDF receipts.
        </p>
      </div>

      {/* Selected Quotation Printable Preview */}
      {selectedQuote && (
        <div className="bg-white border border-[#172333] rounded-lg p-8 space-y-5">
          <div className="flex justify-between border-b border-[#E2E4DF] pb-4">
            <div>
              <p className="text-[11px] font-semibold text-[#F18A45]">PROJECT QUOTATION · SAC 9983</p>
              <h2 className="font-editorial text-xl font-semibold text-[#172333]">
                {selectedQuote.projectTitle}
              </h2>
              <p className="text-xs text-[#6E7785]">
                Prepared for {selectedQuote.clientName} · Timeline: {selectedQuote.estimatedTimeline}
              </p>
            </div>
            <div className="text-right font-mono text-xs">
              <p className="text-base font-semibold">{selectedQuote.quotationNumber}</p>
              <p>Valid Until: {selectedQuote.expiryDate}</p>
              <p className="font-sans font-semibold mt-0.5">Status: {selectedQuote.status}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-[#F5F5F1] rounded-lg text-xs">
            <div>
              <p className="font-semibold text-[#172333]">Scope Summary</p>
              <p className="text-[#6E7785] mt-1">{selectedQuote.scopeSummary || '—'}</p>
            </div>
            <div>
              <p className="font-semibold text-[#172333]">Deliverables</p>
              <p className="text-[#6E7785] mt-1">{selectedQuote.deliverables || '—'}</p>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            {selectedQuote.lineItems.map((li, i) => (
              <div key={i} className="flex justify-between py-1.5 border-b border-[#E2E4DF]">
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

          <p className="text-xs text-[#6E7785]">{selectedQuote.termsAndConditions}</p>

          <div className="flex flex-wrap gap-3 no-print">
            {selectedQuote.status === 'Sent' && (
              <>
                <button
                  type="button"
                  onClick={() => handleDecisionOnQuote(selectedQuote, 'Accepted')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#26734D] hover:bg-[#1e5c3d] rounded-lg"
                >
                  Approve & Accept Quotation
                </button>
                <button
                  type="button"
                  onClick={() => handleDecisionOnQuote(selectedQuote, 'Rejected')}
                  className="px-4 py-2 text-xs font-semibold text-[#B93832] bg-[#B93832]/10 rounded-lg"
                >
                  Decline Quotation
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#172333] rounded-lg"
            >
              Print / Save PDF
            </button>
            <button
              type="button"
              onClick={() => setSelectedQuote(null)}
              className="px-4 py-2 text-xs font-semibold bg-[#F5F5F1] rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Client Quotations Table (when any exist) */}
      {quotations.length > 0 && (
        <div className="bg-white border border-[#E2E4DF] rounded-lg overflow-x-auto no-print">
          <div className="px-4 py-3 border-b border-[#E2E4DF]">
            <h2 className="text-sm font-semibold text-[#172333]">Project Quotations & Estimates</h2>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2E4DF] text-[11px] font-semibold text-[#6E7785]">
                <th className="py-3 px-4">Document #</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Project</th>
                <th className="py-3 px-4">Valid Until</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Total (INR)</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E4DF] text-xs">
              {quotations.map((q) => {
                const docType = inferQuotationDocumentType(q);
                return (
                  <tr key={q.id}>
                    <td className="py-3.5 px-4 font-mono font-semibold">
                      {q.quotationNumber}
                      {q.version && q.version > 1 ? ` (v${q.version})` : ''}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F5F5F1] text-[#172333]">
                        {docType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">{q.projectTitle}</td>
                    <td className="py-3.5 px-4 font-mono text-[#6E7785]">{q.expiryDate}</td>
                    <td className="py-3.5 px-4 font-semibold">{q.status}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums">
                      {formatINR(q.total)}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-3">
                      {q.status === 'Sent' && (
                        <button
                          type="button"
                          onClick={() => handleDecisionOnQuote(q, 'Accepted')}
                          className="font-semibold text-[#26734D] hover:underline"
                        >
                          Approve {docType}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedQuote(q)}
                        className="font-semibold text-[#172333] hover:text-[#F18A45]"
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
        <div className="bg-white border border-[#172333] rounded-lg p-8 space-y-5">
          <div className="flex justify-between border-b border-[#E2E4DF] pb-4">
            <div>
              <p className="text-[11px] font-semibold text-[#F18A45]">OFFICIAL TAX / STUDIO INVOICE · SAC 9983</p>
              <h2 className="font-editorial text-xl font-semibold">Prithvi Editify Invoice</h2>
              <p className="text-xs text-[#6E7785]">{selected.projectTitle}</p>
            </div>
            <div className="text-right font-mono text-xs">
              <p className="text-base font-semibold">{selected.invoiceNumber}</p>
              <p>Due: {selected.dueDate}</p>
              <p className="font-sans font-semibold mt-0.5">Status: {selected.status}</p>
            </div>
          </div>
          <p className="text-xs text-[#172333]">{selected.itemsSummary}</p>
          <div className="flex flex-wrap justify-between gap-4 text-sm font-mono font-semibold pt-3 border-t border-[#E2E4DF]">
            <span>Subtotal: {formatINR(selected.subtotal)}</span>
            {selected.taxRate > 0 && (
              <span>GST/Tax ({selected.taxRate}%): {formatINR(selected.taxAmount)}</span>
            )}
            <span>Total: {formatINR(selected.total)}</span>
            <span className={selected.balanceDue > 0 ? 'text-[#B93832]' : 'text-[#26734D]'}>
              Balance Due: {formatINR(selected.balanceDue)}
            </span>
          </div>

          {/* Dynamic Scannable UPI QR Code with Exact Balance Due */}
          <UpiQrCodeCard
            amount={selected.balanceDue}
            referenceNumber={selected.invoiceNumber}
          />

          <p className="text-xs text-[#6E7785]">{selected.paymentInstructions}</p>
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
                className="px-4 py-2 text-xs font-semibold text-white bg-[#26734D] hover:bg-[#1e5c3d] rounded-lg"
              >
                Submit UTR / Payment Proof
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#172333] rounded-lg"
            >
              Print / Save PDF
            </button>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="px-4 py-2 text-xs font-semibold bg-[#F5F5F1] rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-[#E2E4DF] rounded-lg overflow-x-auto no-print">
        <div className="px-4 py-3 border-b border-[#E2E4DF]">
          <h2 className="text-sm font-semibold text-[#172333]">Official Invoices</h2>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E2E4DF] text-[11px] font-semibold text-[#6E7785]">
              <th className="py-3 px-4">Invoice #</th>
              <th className="py-3 px-4">Project</th>
              <th className="py-3 px-4">Due Date</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Total</th>
              <th className="py-3 px-4 text-right">Balance Due</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E4DF] text-xs">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[#6E7785]">
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
                    <td className="py-3.5 px-4 font-mono text-[#6E7785]">{inv.dueDate}</td>
                    <td className="py-3.5 px-4 font-medium">
                      <span>{inv.status}</span>
                      {pendingProof && (
                        <span className="block text-[10px] text-[#A96518] font-semibold">
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
                          className="font-semibold text-[#26734D] hover:underline"
                        >
                          Submit UTR Proof
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelected(inv)}
                        className="font-semibold text-[#172333] hover:text-[#F18A45]"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#172333]/65 p-4 no-print">
          <form
            onSubmit={handleSubmitPaymentProof}
            className="bg-white border border-[#E2E4DF] rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl"
          >
            <div>
              <span className="text-[11px] font-mono font-semibold text-[#F18A45]">
                PAYMENT VERIFICATION QUEUE
              </span>
              <h3 className="text-base font-semibold text-[#172333]">
                Submit Payment Proof ({proofModalInvoice.invoiceNumber})
              </h3>
              <p className="text-xs text-[#6E7785] mt-0.5">
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
                  className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
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
                  className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                >
                  <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                  <option value="Bank Transfer (NEFT/IMPS)">Bank Transfer (NEFT/IMPS)</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172333] mb-1">
                12-Digit UPI UTR / Transaction Reference ID *
              </label>
              <input
                type="text"
                required
                value={proofForm.utrNumber}
                onChange={(e) => setProofForm({ ...proofForm, utrNumber: e.target.value })}
                placeholder="e.g. 429118394812"
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172333] mb-1">
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
                className="w-full text-xs text-[#6E7785]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172333] mb-1">
                Note (Optional)
              </label>
              <input
                type="text"
                value={proofForm.notes}
                onChange={(e) => setProofForm({ ...proofForm, notes: e.target.value })}
                placeholder="Paid via Google Pay..."
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProofModalInvoice(null)}
                className="px-4 py-2 text-xs font-medium bg-[#F5F5F1] rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#26734D] hover:bg-[#1e5c3d] rounded-lg"
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
    <h1 className="font-editorial text-2xl font-semibold text-[#172333]">
      Payment Instructions & Verification
    </h1>
    <div className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-4 text-xs leading-relaxed text-[#6E7785]">
      <h2 className="text-sm font-semibold text-[#172333]">1. Standard INR Settlement (UPI / Bank Transfer)</h2>
      <p>
        Each invoice issued in your Client Portal contains specific UPI or NEFT/IMPS bank transfer instructions along with the exact INR balance due.
      </p>
      <h2 className="text-sm font-semibold text-[#172333]">2. Payment Verification Policy</h2>
      <p>
        To maintain strict financial accuracy, clients cannot self-mark an invoice as paid. Once you complete a UPI or bank transfer, share the 12-digit UTR / transaction reference in your project message thread. Shankar Baluragi will verify receipt and record the payment on your invoice.
      </p>
      <h2 className="text-sm font-semibold text-[#172333]">3. Online Gateway Support</h2>
      <p>
        When online payment provider credentials (such as Razorpay) are configured on the server, payments are verified cryptographically via server-side HMAC signatures before updating your invoice status.
      </p>
    </div>
  </div>
);

export const ClientMessagesPage: React.FC = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchClientProjects(user.uid).then(setProjects).catch(() => {});
  }, [user]);

  return (
    <div className="space-y-6">
      <h1 className="font-editorial text-2xl font-semibold text-[#172333]">Project Messages</h1>
      <div className="bg-white border border-[#E2E4DF] rounded-lg divide-y divide-[#E2E4DF] text-xs">
        {projects.length === 0 ? (
          <div className="p-8 text-center text-[#6E7785]">
            Open any assigned project to view and post project comments.
          </div>
        ) : (
          projects.map((p) => (
            <div key={p.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-[#172333]">{p.title}</p>
                <p className="text-[#6E7785]">{p.latestUpdate}</p>
              </div>
              <Link
                to={`/portal/projects/${p.id}`}
                className="font-semibold text-[#172333] hover:text-[#F18A45]"
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
