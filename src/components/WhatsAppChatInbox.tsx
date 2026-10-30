import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  Send,
  Paperclip,
  Smile,
  Check,
  CheckCheck,
  MoreVertical,
  Phone,
  ExternalLink,
  FolderKanban,
  FileText,
  Lock,
  Sparkles,
  Pin,
  CornerUpLeft,
  Copy,
  X,
  ArrowLeft,
  Info,
  RefreshCw,
  MessageSquarePlus,
  Users,
  CheckCircle2,
  Clock,
  Download,
  Image as ImageIcon,
  Link2,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchAllProjectsAdmin,
  fetchAllClientsAdmin,
  fetchAllInquiriesAdmin,
  fetchAllMessagesAdmin,
  fetchAllFilesAdmin,
  fetchClientProjects,
  fetchClientFiles,
  fetchProjectMessages,
  postProjectMessage,
  markThreadMessagesRead,
  getCachedProjectsAdmin,
  getCachedClientsAdmin,
  getCachedInquiriesAdmin,
  getCachedMessagesAdmin,
} from '../services/crmService';
import {
  ProjectRecord,
  ClientRecord,
  InquiryRecord,
  ProjectMessage,
  DeliverableFile,
} from '../types/crm';
import { formatINR } from '../utils/formatters';

export interface WhatsAppChatInboxProps {
  mode: 'admin' | 'client';
  initialThreadId?: string;
}

type ThreadKind = 'project' | 'client' | 'inquiry' | 'support';
type InboxFilterTab = 'all' | 'unread' | 'projects' | 'direct';

interface ChatThreadItem {
  threadId: string;
  kind: ThreadKind;
  title: string;
  subtitle: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientUserId: string;
  statusLabel: string;
  project?: ProjectRecord;
  client?: ClientRecord;
  inquiry?: InquiryRecord;
  lastMessage?: ProjectMessage;
  unreadCount: number;
  updatedAtMs: number;
  isPinned: boolean;
}

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '✅', '🙏', '🎬', '✨', '🚀', '🎨', '💯', '👏', '😊'];

const ADMIN_QUICK_REPLIES = [
  '🎬 First draft has been uploaded to your project deliverables — please review and share your feedback!',
  '✅ Requested revision is complete! Updated files are ready in your Client Portal.',
  '📄 Official studio invoice has been shared. You can scan the UPI QR code in Invoices & Quotes.',
  '🔓 Payment verified! All high-resolution master deliverables are now unlocked for download.',
  '👋 Hi! Sharing a quick studio update: your project is currently in active production and on schedule.',
];

const CLIENT_QUICK_REPLIES = [
  '✅ Looks great! Approved for final master delivery.',
  '🎨 Could we make a quick revision on the latest preview draft?',
  '💳 Payment completed via UPI — I have submitted the 12-digit UTR for verification.',
  '📅 Hi Shankar! Checking in for a quick update on our timeline.',
];

const PINNED_STORAGE_KEY = 'pe_whatsapp_inbox_pinned_threads_v1';
const REACTIONS_STORAGE_KEY = 'pe_whatsapp_inbox_reactions_v1';

interface ParsedMessageContent {
  replyAuthor?: string;
  replySnippet?: string;
  attachmentTitle?: string;
  attachmentUrl?: string;
  body: string;
}

function parseStructuredMessageContent(raw: string): ParsedMessageContent {
  let working = String(raw || '').trim();
  let replyAuthor: string | undefined;
  let replySnippet: string | undefined;
  let attachmentTitle: string | undefined;
  let attachmentUrl: string | undefined;

  // Parse leading reply quote: > [Reply to Name]: snippet\n
  if (working.startsWith('> [Reply to ')) {
    const firstNewline = working.indexOf('\n');
    const headerLine = firstNewline !== -1 ? working.slice(0, firstNewline) : working;
    const match = headerLine.match(/^> \[Reply to ([^\]]+)\]:\s*(.*)$/);
    if (match) {
      replyAuthor = match[1].trim();
      replySnippet = match[2].trim();
      working = firstNewline !== -1 ? working.slice(firstNewline + 1).trim() : '';
    }
  }

  // Parse attachment line: [Attachment: Title | URL]
  const attachMatch = working.match(/\[Attachment:\s*([^|\]]+)\|\s*([^\]]+)\]/);
  if (attachMatch) {
    attachmentTitle = attachMatch[1].trim();
    attachmentUrl = attachMatch[2].trim();
    working = working.replace(attachMatch[0], '').trim();
  }

  return {
    replyAuthor,
    replySnippet,
    attachmentTitle,
    attachmentUrl,
    body: working,
  };
}

function formatWhatsAppThreadTime(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return 'Yesterday';

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  });
}

function formatBubbleTime(iso?: string): string {
  if (!iso) return 'Just now';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDateSeparator(iso?: string): string {
  if (!iso) return 'Today';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Today';
  const now = new Date();
  if (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  ) {
    return 'Today';
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return 'Yesterday';
  }
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function sanitizePhoneForWhatsApp(rawPhone?: string): string {
  const digits = String(rawPhone || '').replace(/\D+/g, '');
  if (!digits) return '919000000000';
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export const WhatsAppChatInbox: React.FC<WhatsAppChatInboxProps> = ({
  mode,
  initialThreadId,
}) => {
  const { user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = mode === 'admin';

  // CRM Data
  const [projects, setProjects] = useState<ProjectRecord[]>(() =>
    isAdmin ? getCachedProjectsAdmin() : []
  );
  const [clients, setClients] = useState<ClientRecord[]>(() =>
    isAdmin ? getCachedClientsAdmin() : []
  );
  const [inquiries, setInquiries] = useState<InquiryRecord[]>(() =>
    isAdmin ? getCachedInquiriesAdmin() : []
  );
  const [allMessages, setAllMessages] = useState<ProjectMessage[]>(() =>
    getCachedMessagesAdmin()
  );
  const [files, setFiles] = useState<DeliverableFile[]>([]);
  const [loading, setLoading] = useState(false);

  // Inbox UI State
  const [selectedThreadId, setSelectedThreadId] = useState<string>(
    initialThreadId || searchParams.get('thread') || ''
  );
  const [mobileShowChat, setMobileShowChat] = useState<boolean>(
    Boolean(initialThreadId || searchParams.get('thread'))
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<InboxFilterTab>('all');
  const [inChatSearchOpen, setInChatSearchOpen] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState('');
  const [infoDrawerOpen, setInfoDrawerOpen] = useState(false);
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);

  // Composer State
  const [messageInput, setMessageInput] = useState('');
  const [visibility, setVisibility] = useState<'client' | 'internal'>('client');
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ProjectMessage | null>(null);
  const [stagedAttachment, setStagedAttachment] = useState<{
    title: string;
    url: string;
  } | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [customLinkTitle, setCustomLinkTitle] = useState('');
  const [customLinkUrl, setCustomLinkUrl] = useState('');
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  // Pinned threads & local emoji reactions
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(PINNED_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [reactionsMap, setReactionsMap] = useState<Record<string, string[]>>(() => {
    try {
      const raw = window.localStorage.getItem(REACTIONS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const clientEmail = (profile?.email || user?.email || '').trim().toLowerCase();
  const currentUserId = user?.uid || profile?.uid || '';
  const senderDisplayName =
    profile?.displayName ||
    (isAdmin ? 'Shankar Baluragi (Studio Admin)' : user?.email || 'Client');

  const loadInboxData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        if (isAdmin) {
          const [projList, cliList, inqList, msgList, fileList] = await Promise.all([
            fetchAllProjectsAdmin().catch(() => []),
            fetchAllClientsAdmin().catch(() => []),
            fetchAllInquiriesAdmin().catch(() => []),
            fetchAllMessagesAdmin().catch(() => []),
            fetchAllFilesAdmin().catch(() => []),
          ]);
          setProjects(projList);
          setClients(cliList);
          setInquiries(inqList);
          setAllMessages(msgList);
          setFiles(fileList);
        } else if (currentUserId || clientEmail) {
          const [projList, msgList, fileList] = await Promise.all([
            fetchClientProjects(currentUserId, clientEmail || undefined).catch(() => []),
            fetchAllMessagesAdmin().catch(() => []),
            fetchClientFiles(currentUserId, clientEmail || undefined).catch(() => []),
          ]);
          setProjects(projList);
          // Filter messages visible to client
          setAllMessages(msgList.filter((m) => m.visibility === 'client'));
          setFiles(fileList);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [isAdmin, currentUserId, clientEmail]
  );

  useEffect(() => {
    loadInboxData(false);
    const interval = window.setInterval(() => {
      loadInboxData(true);
    }, 10000);
    return () => window.clearInterval(interval);
  }, [loadInboxData]);

  // Build unified WhatsApp conversation threads
  const threads = useMemo<ChatThreadItem[]>(() => {
    const messagesByThread = new Map<string, ProjectMessage[]>();
    for (const msg of allMessages) {
      if (!isAdmin && msg.visibility !== 'client') continue;
      const list = messagesByThread.get(msg.projectId) || [];
      list.push(msg);
      messagesByThread.set(msg.projectId, list);
    }

    const items: ChatThreadItem[] = [];
    const seenThreadIds = new Set<string>();

    // 1. Project Threads
    for (const proj of projects) {
      seenThreadIds.add(proj.id);
      const threadMsgs = messagesByThread.get(proj.id) || [];
      const lastMsg = threadMsgs[threadMsgs.length - 1];
      const unreadCount = threadMsgs.filter((m) =>
        isAdmin ? !m.readByAdmin && m.senderRole === 'client' : !m.readByClient && m.senderRole === 'admin'
      ).length;

      const matchedClient = clients.find(
        (c) =>
          c.id === proj.clientId ||
          (proj.clientEmail && c.email.toLowerCase() === proj.clientEmail.toLowerCase())
      );

      const updatedAtMs = lastMsg?.createdAt
        ? new Date(lastMsg.createdAt).getTime()
        : new Date(proj.updatedAt || proj.createdAt || 0).getTime();

      items.push({
        threadId: proj.id,
        kind: 'project',
        title: proj.title,
        subtitle: `${proj.clientName || 'Studio Client'} · ${proj.serviceType}`,
        clientName: proj.clientName || matchedClient?.fullName || 'Client',
        clientEmail: proj.clientEmail || matchedClient?.email || '',
        clientPhone: matchedClient?.phone || '',
        clientUserId: proj.clientUserId || matchedClient?.userId || '',
        statusLabel: proj.status,
        project: proj,
        client: matchedClient,
        lastMessage: lastMsg,
        unreadCount,
        updatedAtMs: Number.isNaN(updatedAtMs) ? 0 : updatedAtMs,
        isPinned: pinnedIds.includes(proj.id),
      });
    }

    if (isAdmin) {
      // 2. Direct Client Threads (for clients without a project or with direct messages)
      for (const cli of clients) {
        const directThreadId = `client:${cli.id}`;
        seenThreadIds.add(directThreadId);
        const threadMsgs = messagesByThread.get(directThreadId) || [];
        const hasProject = projects.some(
          (p) =>
            p.clientId === cli.id ||
            (cli.email && p.clientEmail.toLowerCase() === cli.email.toLowerCase())
        );
        if (threadMsgs.length === 0 && hasProject) {
          continue;
        }
        const lastMsg = threadMsgs[threadMsgs.length - 1];
        const unreadCount = threadMsgs.filter(
          (m) => !m.readByAdmin && m.senderRole === 'client'
        ).length;
        const updatedAtMs = lastMsg?.createdAt
          ? new Date(lastMsg.createdAt).getTime()
          : new Date(cli.updatedAt || cli.createdAt || 0).getTime();

        items.push({
          threadId: directThreadId,
          kind: 'client',
          title: cli.fullName,
          subtitle: `${cli.companyName || 'Direct Client'} · ${cli.preferredContact}`,
          clientName: cli.fullName,
          clientEmail: cli.email,
          clientPhone: cli.phone,
          clientUserId: cli.userId || '',
          statusLabel: cli.accountStatus === 'active' ? 'Active Client' : cli.accountStatus,
          client: cli,
          lastMessage: lastMsg,
          unreadCount,
          updatedAtMs: Number.isNaN(updatedAtMs) ? 0 : updatedAtMs,
          isPinned: pinnedIds.includes(directThreadId),
        });
      }

      // 3. Lead / Inquiry Threads
      for (const inq of inquiries) {
        if (inq.status === 'Spam') continue;
        const inqThreadId = `inquiry:${inq.id}`;
        seenThreadIds.add(inqThreadId);
        const threadMsgs = messagesByThread.get(inqThreadId) || [];
        const lastMsg = threadMsgs[threadMsgs.length - 1];
        const unreadCount = threadMsgs.filter(
          (m) => !m.readByAdmin && m.senderRole === 'client'
        ).length;
        const updatedAtMs = lastMsg?.createdAt
          ? new Date(lastMsg.createdAt).getTime()
          : new Date(inq.updatedAt || inq.createdAt || 0).getTime();

        items.push({
          threadId: inqThreadId,
          kind: 'inquiry',
          title: `${inq.fullName} — ${inq.serviceRequired}`,
          subtitle: `Lead Inquiry · ${inq.budgetRange || 'Custom Quote'}`,
          clientName: inq.fullName,
          clientEmail: inq.email,
          clientPhone: inq.phone,
          clientUserId: '',
          statusLabel: `Lead: ${inq.status}`,
          inquiry: inq,
          lastMessage: lastMsg,
          unreadCount,
          updatedAtMs: Number.isNaN(updatedAtMs) ? 0 : updatedAtMs,
          isPinned: pinnedIds.includes(inqThreadId),
        });
      }

      // 4. Any Client Studio Support threads initiated by clients (`support:<uid>`)
      for (const [tId, threadMsgs] of messagesByThread.entries()) {
        if (seenThreadIds.has(tId) || !tId.startsWith('support:')) continue;
        seenThreadIds.add(tId);
        const lastMsg = threadMsgs[threadMsgs.length - 1];
        const unreadCount = threadMsgs.filter(
          (m) => !m.readByAdmin && m.senderRole === 'client'
        ).length;
        const clientMsg = threadMsgs.find((m) => m.senderRole === 'client') || lastMsg;
        const updatedAtMs = lastMsg?.createdAt ? new Date(lastMsg.createdAt).getTime() : Date.now();

        items.push({
          threadId: tId,
          kind: 'support',
          title: `${clientMsg?.senderName || 'Client'} — Studio Support`,
          subtitle: 'Direct Client Portal Support Chat',
          clientName: clientMsg?.senderName || 'Client',
          clientEmail: '',
          clientPhone: '',
          clientUserId: tId.slice('support:'.length),
          statusLabel: 'Direct Support',
          lastMessage: lastMsg,
          unreadCount,
          updatedAtMs,
          isPinned: pinnedIds.includes(tId),
        });
      }
    } else {
      // Client Mode: Always include a dedicated "Shankar Baluragi · Studio Direct Support" thread at top
      const supportThreadId = `support:${currentUserId || clientEmail || 'client'}`;
      seenThreadIds.add(supportThreadId);
      const supportMsgs = messagesByThread.get(supportThreadId) || [];
      const lastMsg = supportMsgs[supportMsgs.length - 1];
      const unreadCount = supportMsgs.filter(
        (m) => !m.readByClient && m.senderRole === 'admin'
      ).length;
      const updatedAtMs = lastMsg?.createdAt
        ? new Date(lastMsg.createdAt).getTime()
        : Date.now() - 3600_000;

      items.push({
        threadId: supportThreadId,
        kind: 'support',
        title: 'Prithvi Editify — Studio Support',
        subtitle: 'Shankar Baluragi · Founder & Creative Director',
        clientName: profile?.displayName || 'Client',
        clientEmail: clientEmail,
        clientPhone: profile?.phone || '',
        clientUserId: currentUserId,
        statusLabel: 'Online · Direct Support',
        lastMessage: lastMsg,
        unreadCount,
        updatedAtMs,
        isPinned: true,
      });
    }

    return items.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
      return b.updatedAtMs - a.updatedAtMs;
    });
  }, [projects, clients, inquiries, allMessages, isAdmin, pinnedIds, currentUserId, clientEmail, profile]);

  // Select first thread automatically on desktop if none selected
  useEffect(() => {
    if (!selectedThreadId && threads.length > 0) {
      setSelectedThreadId(threads[0].threadId);
    }
  }, [threads, selectedThreadId]);

  const activeThread = useMemo(
    () => threads.find((t) => t.threadId === selectedThreadId) || null,
    [threads, selectedThreadId]
  );

  // Active thread messages
  const activeMessages = useMemo(() => {
    if (!activeThread) return [];
    const list = allMessages
      .filter((m) => {
        if (m.projectId !== activeThread.threadId) return false;
        if (!isAdmin && m.visibility !== 'client') return false;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
      );

    // If it's a Lead Inquiry thread with no messages yet, synthesize the initial inquiry brief as an incoming card
    if (activeThread.kind === 'inquiry' && activeThread.inquiry && list.length === 0) {
      const inq = activeThread.inquiry;
      return [
        {
          id: `inq-initial-${inq.id}`,
          projectId: activeThread.threadId,
          clientUserId: '',
          senderId: inq.id,
          senderName: inq.fullName,
          senderRole: 'client' as const,
          content: `📋 Project Inquiry Brief (${inq.serviceRequired})\nBudget: ${inq.budgetRange || 'Custom'}\nDeadline: ${inq.preferredDeadline || 'Flexible'}\n\n${inq.description}`,
          visibility: 'client' as const,
          readByAdmin: true,
          readByClient: true,
          createdAt: inq.createdAt,
        },
      ];
    }

    return list;
  }, [activeThread, allMessages, isAdmin]);

  // Mark messages as read when opening a thread
  useEffect(() => {
    if (!activeThread || activeThread.unreadCount === 0) return;
    markThreadMessagesRead(activeThread.threadId, isAdmin ? 'admin' : 'client')
      .then(() => {
        setAllMessages((prev) =>
          prev.map((m) => {
            if (m.projectId !== activeThread.threadId) return m;
            return isAdmin ? { ...m, readByAdmin: true } : { ...m, readByClient: true };
          })
        );
      })
      .catch(() => {});
  }, [activeThread, isAdmin]);

  // Scroll to bottom when active thread or message count changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread?.threadId, activeMessages.length]);

  const filteredThreads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return threads.filter((t) => {
      if (activeTab === 'unread' && t.unreadCount === 0) return false;
      if (activeTab === 'projects' && t.kind !== 'project') return false;
      if (activeTab === 'direct' && t.kind === 'project') return false;

      if (!q) return true;
      const lastBody = t.lastMessage?.content?.toLowerCase() || '';
      return (
        t.title.toLowerCase().includes(q) ||
        t.subtitle.toLowerCase().includes(q) ||
        t.clientName.toLowerCase().includes(q) ||
        t.clientEmail.toLowerCase().includes(q) ||
        t.clientPhone.toLowerCase().includes(q) ||
        lastBody.includes(q)
      );
    });
  }, [threads, activeTab, searchQuery]);

  const totalUnreadThreads = useMemo(
    () => threads.filter((t) => t.unreadCount > 0).length,
    [threads]
  );

  const threadDeliverables = useMemo(() => {
    if (!activeThread || activeThread.kind !== 'project') return [];
    return files.filter((f) => f.projectId === activeThread.threadId);
  }, [activeThread, files]);

  const togglePinThread = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedIds((prev) => {
      const next = prev.includes(threadId)
        ? prev.filter((id) => id !== threadId)
        : [threadId, ...prev];
      try {
        window.localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const toggleReaction = (msgId: string, emoji: string) => {
    setReactionsMap((prev) => {
      const current = prev[msgId] || [];
      const nextForMsg = current.includes(emoji)
        ? current.filter((e) => e !== emoji)
        : [...current, emoji];
      const next = { ...prev, [msgId]: nextForMsg };
      try {
        window.localStorage.setItem(REACTIONS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    setMobileShowChat(true);
    setReplyingTo(null);
    setStagedAttachment(null);
    setSearchParams({ thread: threadId }, { replace: true });
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeThread || sending) return;
    const trimmed = messageInput.trim();
    if (!trimmed && !stagedAttachment) return;

    let composedContent = '';
    if (replyingTo) {
      const cleanSnippet = parseStructuredMessageContent(replyingTo.content)
        .body.replace(/\s+/g, ' ')
        .slice(0, 90);
      composedContent += `> [Reply to ${replyingTo.senderName}]: ${cleanSnippet}\n`;
    }
    if (stagedAttachment) {
      composedContent += `[Attachment: ${stagedAttachment.title} | ${stagedAttachment.url}]\n`;
    }
    composedContent += trimmed || (stagedAttachment ? `Shared ${stagedAttachment.title}` : '');

    setSending(true);
    try {
      await postProjectMessage({
        projectId: activeThread.threadId,
        clientUserId: activeThread.clientUserId,
        senderName: senderDisplayName,
        senderRole: isAdmin ? 'admin' : 'client',
        content: composedContent,
        visibility: isAdmin ? visibility : 'client',
      });

      setMessageInput('');
      setReplyingTo(null);
      setStagedAttachment(null);
      setEmojiOpen(false);
      setAttachMenuOpen(false);

      const refreshedThreadMsgs = await fetchProjectMessages(
        activeThread.threadId,
        isAdmin,
        activeThread.clientUserId
      ).catch(() => []);

      setAllMessages((prev) => {
        const others = prev.filter((m) => m.projectId !== activeThread.threadId);
        return [...others, ...refreshedThreadMsgs];
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopyMessage = (msgId: string, rawContent: string) => {
    const clean = parseStructuredMessageContent(rawContent).body;
    navigator.clipboard?.writeText(clean).catch(() => {});
    setCopiedMsgId(msgId);
    window.setTimeout(() => setCopiedMsgId(null), 1800);
  };

  // Group active messages with date headers
  const visibleActiveMessages = useMemo(() => {
    const q = inChatSearchQuery.trim().toLowerCase();
    if (!q) return activeMessages;
    return activeMessages.filter(
      (m) =>
        m.content.toLowerCase().includes(q) || m.senderName.toLowerCase().includes(q)
    );
  }, [activeMessages, inChatSearchQuery]);

  const externalWhatsAppUrl = useMemo(() => {
    if (!activeThread) return 'https://wa.me/919000000000';
    const phone = sanitizePhoneForWhatsApp(activeThread.clientPhone);
    const intro = isAdmin
      ? `Hi ${activeThread.clientName}, this is Shankar Baluragi from Prithvi Editify Studio regarding "${activeThread.title}".`
      : `Hi Shankar (Prithvi Editify Studio), messaging from my Client Portal regarding "${activeThread.title}".`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(intro)}`;
  }, [activeThread, isAdmin]);

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)] min-h-[620px] bg-[#081629] border border-[#1E3A5F] rounded-2xl overflow-hidden shadow-2xl">
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* =====================================================================
            LEFT PANE: WHATSAPP CONVERSATION LIST
           ===================================================================== */}
        <aside
          className={`w-full md:w-[350px] lg:w-[390px] shrink-0 border-r border-[#1E3A5F] bg-[#0B192C] flex flex-col min-h-0 ${
            mobileShowChat ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Left Top Header */}
          <div className="h-16 px-4 bg-[#0D1F38] border-b border-[#1E3A5F] flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0EA5E9] to-[#10B981] flex items-center justify-center text-xs font-bold text-[#040D1A] shadow-md">
                  {isAdmin ? 'SB' : (profile?.displayName || 'CL').slice(0, 2).toUpperCase()}
                </div>
                <span
                  className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#10B981] ring-2 ring-[#0D1F38]"
                  title="Online"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-[#F8FAFC] truncate">
                    {isAdmin ? 'Studio Chat Inbox' : 'Studio Direct Chat'}
                  </h2>
                  {totalUnreadThreads > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#10B981] text-[#040D1A] rounded-full">
                      {totalUnreadThreads}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#94A3B8] truncate">
                  {isAdmin
                    ? `${threads.length} conversations · Real-time sync`
                    : 'Direct line with Shankar Baluragi'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setNewChatModalOpen(true)}
                  className="p-2 text-[#94A3B8] hover:text-[#10B981] hover:bg-[#132A4A] rounded-lg transition-colors"
                  title="Start New Conversation"
                >
                  <MessageSquarePlus className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => loadInboxData(false)}
                className="p-2 text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#132A4A] rounded-lg transition-colors"
                title="Sync Inbox"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#10B981]' : ''}`} />
              </button>
            </div>
          </div>

          {/* Search & Filter Tabs */}
          <div className="p-3 bg-[#0B192C] border-b border-[#1E3A5F] space-y-2.5 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search or start a new chat..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-[#132A4A] border border-[#1E3A5F] focus:border-[#10B981] rounded-xl text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#F8FAFC]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 bg-[#081629] p-1 rounded-lg border border-[#1E3A5F]/60">
              {(
                [
                  { id: 'all', label: 'All' },
                  {
                    id: 'unread',
                    label: totalUnreadThreads > 0 ? `Unread (${totalUnreadThreads})` : 'Unread',
                  },
                  { id: 'projects', label: 'Projects' },
                  { id: 'direct', label: isAdmin ? 'Clients & Leads' : 'Support' },
                ] as { id: InboxFilterTab; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-1.5 px-2 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-[#10B981] text-[#040D1A] shadow-xs'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#1E3A5F]/40">
            {filteredThreads.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-xs font-semibold text-[#F8FAFC]">No conversations found</p>
                <p className="text-[11px] text-[#94A3B8]">
                  {searchQuery
                    ? 'Try clearing your search filter.'
                    : 'Your project and support threads will appear here automatically.'}
                </p>
              </div>
            ) : (
              filteredThreads.map((item) => {
                const isSelected = item.threadId === activeThread?.threadId;
                const parsedLast = item.lastMessage
                  ? parseStructuredMessageContent(item.lastMessage.content)
                  : null;
                const previewText = parsedLast
                  ? parsedLast.attachmentTitle
                    ? `📎 ${parsedLast.attachmentTitle}`
                    : parsedLast.body
                  : item.project?.latestUpdate || item.subtitle;

                const isOutgoingLast = item.lastMessage
                  ? (isAdmin && item.lastMessage.senderRole === 'admin') ||
                    (!isAdmin && item.lastMessage.senderRole === 'client')
                  : false;

                const isLastRead = item.lastMessage
                  ? isAdmin
                    ? item.lastMessage.readByClient
                    : item.lastMessage.readByAdmin
                  : false;

                const initials = item.title
                  .replace(/[^a-zA-Z0-9 ]/g, '')
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase();

                return (
                  <div
                    key={item.threadId}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectThread(item.threadId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectThread(item.threadId);
                      }
                    }}
                    className={`group w-full px-3.5 py-3 flex items-start gap-3 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#132A4A] border-l-4 border-l-[#10B981]'
                        : 'hover:bg-[#132A4A]/50'
                    }`}
                  >
                    {/* Thread Avatar */}
                    <div className="relative shrink-0 mt-0.5">
                      <div
                        className={`w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold border ${
                          item.kind === 'project'
                            ? 'bg-[#0D1F38] border-[#10B981]/40 text-[#2DD4BF]'
                            : item.kind === 'support'
                            ? 'bg-gradient-to-br from-[#0EA5E9] to-[#10B981] border-transparent text-[#040D1A]'
                            : item.kind === 'inquiry'
                            ? 'bg-[#1E1B4B] border-[#818CF8]/40 text-[#A5B4FC]'
                            : 'bg-[#132A4A] border-[#38BDF8]/40 text-[#38BDF8]'
                        }`}
                      >
                        {initials || 'PE'}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#0B192C] flex items-center justify-center border border-[#1E3A5F]`}
                      >
                        {item.kind === 'project' ? (
                          <FolderKanban className="w-2.5 h-2.5 text-[#10B981]" />
                        ) : item.kind === 'inquiry' ? (
                          <Sparkles className="w-2.5 h-2.5 text-[#F59E0B]" />
                        ) : (
                          <Users className="w-2.5 h-2.5 text-[#38BDF8]" />
                        )}
                      </span>
                    </div>

                    {/* Thread Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-[#F8FAFC] truncate">{item.title}</p>
                        <span
                          className={`text-[10px] shrink-0 ${
                            item.unreadCount > 0
                              ? 'text-[#10B981] font-bold'
                              : 'text-[#94A3B8]'
                          }`}
                        >
                          {formatWhatsAppThreadTime(
                            item.lastMessage?.createdAt ||
                              item.project?.updatedAt ||
                              item.client?.updatedAt ||
                              item.inquiry?.createdAt
                          )}
                        </span>
                      </div>

                      <p className="text-[11px] text-[#38BDF8] truncate mt-0.5">
                        {item.clientName}
                        <span className="text-[#94A3B8]"> · {item.statusLabel}</span>
                      </p>

                      <div className="flex items-center justify-between gap-2 mt-1">
                        <div className="flex items-center gap-1 min-w-0 text-[11px] text-[#94A3B8]">
                          {item.lastMessage?.visibility === 'internal' && (
                            <Lock className="w-3 h-3 text-[#F59E0B] shrink-0" />
                          )}
                          {isOutgoingLast && item.lastMessage?.visibility !== 'internal' && (
                            <CheckCheck
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isLastRead ? 'text-[#38BDF8]' : 'text-[#94A3B8]'
                              }`}
                            />
                          )}
                          <span
                            className={`truncate ${
                              item.unreadCount > 0 ? 'text-[#F8FAFC] font-semibold' : ''
                            }`}
                          >
                            {previewText}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.isPinned && (
                            <Pin className="w-3 h-3 text-[#94A3B8] rotate-45" />
                          )}
                          {item.unreadCount > 0 && (
                            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#10B981] text-[#040D1A] text-[10px] font-bold flex items-center justify-center">
                              {item.unreadCount}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => togglePinThread(item.threadId, e)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-[#94A3B8] hover:text-[#F8FAFC] transition-opacity"
                            title={item.isPinned ? 'Unpin chat' : 'Pin chat to top'}
                          >
                            <Pin className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* =====================================================================
            RIGHT PANE: WHATSAPP ACTIVE CONVERSATION WINDOW
           ===================================================================== */}
        {activeThread ? (
          <section
            className={`flex-1 flex flex-col min-w-0 min-h-0 bg-[#06101E] ${
              !mobileShowChat ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* Conversation Top Bar */}
            <header className="h-16 px-4 bg-[#0D1F38] border-b border-[#1E3A5F] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setMobileShowChat(false)}
                  className="md:hidden p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] bg-[#132A4A] rounded-lg"
                  aria-label="Back to chat list"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setInfoDrawerOpen((prev) => !prev)}
                  className="flex items-center gap-3 min-w-0 text-left group"
                >
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-[#132A4A] border border-[#10B981]/40 flex items-center justify-center text-xs font-bold text-[#2DD4BF]">
                      {activeThread.title.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#10B981] ring-2 ring-[#0D1F38]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[#F8FAFC] group-hover:text-[#10B981] transition-colors truncate">
                      {activeThread.title}
                    </h3>
                    <p className="text-[11px] text-[#94A3B8] truncate">
                      {activeThread.clientName}
                      <span> · </span>
                      <span className="text-[#2DD4BF]">{activeThread.statusLabel}</span>
                      {activeThread.clientPhone ? ` · ${activeThread.clientPhone}` : ''}
                    </p>
                  </div>
                </button>
              </div>

              {/* Conversation Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setInChatSearchOpen((prev) => !prev);
                    setInChatSearchQuery('');
                  }}
                  className={`p-2 rounded-lg transition-colors ${
                    inChatSearchOpen
                      ? 'bg-[#10B981] text-[#040D1A]'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#132A4A]'
                  }`}
                  title="Search messages in this chat"
                >
                  <Search className="w-4 h-4" />
                </button>

                <a
                  href={externalWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#040D1A] bg-[#25D366] hover:bg-[#20BD5A] rounded-lg transition-colors shadow-xs"
                  title="Open conversation in external WhatsApp App / Web"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">WhatsApp App</span>
                </a>

                {activeThread.kind === 'project' && (
                  <Link
                    to={
                      isAdmin
                        ? `/admin/projects/${activeThread.threadId}`
                        : `/portal/projects/${activeThread.threadId}`
                    }
                    className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#F8FAFC] bg-[#132A4A] hover:bg-[#1E3A5F] border border-[#1E3A5F] rounded-lg transition-colors"
                  >
                    <FolderKanban className="w-3.5 h-3.5 text-[#10B981]" />
                    <span>Project Workspace</span>
                  </Link>
                )}

                <button
                  type="button"
                  onClick={() => setInfoDrawerOpen((prev) => !prev)}
                  className={`p-2 rounded-lg transition-colors ${
                    infoDrawerOpen
                      ? 'bg-[#132A4A] text-[#10B981] border border-[#10B981]/40'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#132A4A]'
                  }`}
                  title="Toggle Project & Contact Info"
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* In-Chat Search Bar */}
            {inChatSearchOpen && (
              <div className="px-4 py-2 bg-[#0B192C] border-b border-[#1E3A5F] flex items-center gap-2 shrink-0">
                <Search className="w-3.5 h-3.5 text-[#94A3B8]" />
                <input
                  type="text"
                  autoFocus
                  value={inChatSearchQuery}
                  onChange={(e) => setInChatSearchQuery(e.target.value)}
                  placeholder="Filter messages in this conversation..."
                  className="flex-1 bg-transparent text-xs text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-none"
                />
                <span className="text-[11px] text-[#94A3B8]">
                  {visibleActiveMessages.length} match(es)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setInChatSearchOpen(false);
                    setInChatSearchQuery('');
                  }}
                  className="p-1 text-[#94A3B8] hover:text-[#F8FAFC]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Main Chat Body + Optional Right Contact Info Drawer */}
            <div className="flex-1 flex min-h-0 overflow-hidden">
              <div className="flex-1 flex flex-col min-w-0 min-h-0">
                {/* Scrollable WhatsApp Message Stream */}
                <div
                  className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-3"
                  style={{
                    backgroundImage:
                      'radial-gradient(rgba(30, 58, 95, 0.32) 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                  }}
                >
                  {/* Synced Encryption / Studio Banner */}
                  <div className="flex justify-center mb-4">
                    <div className="max-w-md px-3.5 py-2 rounded-xl bg-[#0D1F38]/90 border border-[#1E3A5F] text-[11px] text-[#94A3B8] text-center flex items-center gap-2 shadow-sm">
                      <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0" />
                      <span>
                        Messages, deliverables, and revision notes in this thread are synced with{' '}
                        <strong className="text-[#F8FAFC]">Prithvi Editify Studio CRM</strong>.
                      </span>
                    </div>
                  </div>

                  {visibleActiveMessages.length === 0 ? (
                    <div className="py-12 text-center space-y-2">
                      <p className="text-xs font-semibold text-[#F8FAFC]">
                        No messages in this thread yet
                      </p>
                      <p className="text-[11px] text-[#94A3B8] max-w-sm mx-auto">
                        Send a message below or pick one of the studio quick-reply templates to kick off the conversation.
                      </p>
                    </div>
                  ) : (
                    visibleActiveMessages.map((msg, idx) => {
                      const prevMsg = idx > 0 ? visibleActiveMessages[idx - 1] : null;
                      const currentDateLabel = formatDateSeparator(msg.createdAt);
                      const prevDateLabel = prevMsg
                        ? formatDateSeparator(prevMsg.createdAt)
                        : null;
                      const showDateDivider = currentDateLabel !== prevDateLabel;

                      const isOutgoing =
                        (isAdmin && msg.senderRole === 'admin') ||
                        (!isAdmin && msg.senderRole === 'client');
                      const isInternal = msg.visibility === 'internal';
                      const isRead = isAdmin ? msg.readByClient : msg.readByAdmin;
                      const parsed = parseStructuredMessageContent(msg.content);
                      const msgReactions = reactionsMap[msg.id] || [];

                      return (
                        <React.Fragment key={msg.id}>
                          {showDateDivider && (
                            <div className="flex justify-center my-3">
                              <span className="px-3 py-1 rounded-lg bg-[#0D1F38] border border-[#1E3A5F] text-[11px] font-medium text-[#94A3B8] shadow-xs">
                                {currentDateLabel}
                              </span>
                            </div>
                          )}

                          <div
                            className={`group flex flex-col ${
                              isOutgoing ? 'items-end' : 'items-start'
                            }`}
                          >
                            <div
                              className={`relative max-w-[85%] sm:max-w-[72%] rounded-2xl px-3.5 py-2.5 shadow-md transition-all ${
                                isInternal
                                  ? 'bg-[#3B1D06] border border-[#F59E0B]/40 text-[#FEF3C7] rounded-tr-xs'
                                  : isOutgoing
                                  ? 'bg-gradient-to-br from-[#064E3B] to-[#065F46] border border-[#10B981]/35 text-[#F8FAFC] rounded-tr-xs'
                                  : 'bg-[#132A4A] border border-[#1E3A5F] text-[#F8FAFC] rounded-tl-xs'
                              }`}
                            >
                              {/* Sender Header */}
                              <div className="flex items-center justify-between gap-3 mb-1">
                                <span
                                  className={`text-[11px] font-bold ${
                                    isInternal
                                      ? 'text-[#FBBF24]'
                                      : isOutgoing
                                      ? 'text-[#34D399]'
                                      : 'text-[#38BDF8]'
                                  }`}
                                >
                                  {msg.senderName}
                                </span>
                                {isInternal && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#FBBF24]">
                                    <Lock className="w-2.5 h-2.5" />
                                    Internal Note
                                  </span>
                                )}
                              </div>

                              {/* Quoted Reply Box */}
                              {parsed.replyAuthor && (
                                <div className="mb-2 pl-2.5 py-1.5 pr-2 rounded-lg bg-[#040D1A]/40 border-l-3 border-l-[#10B981] text-[11px]">
                                  <p className="font-bold text-[#2DD4BF]">{parsed.replyAuthor}</p>
                                  <p className="text-[#94A3B8] line-clamp-2">{parsed.replySnippet}</p>
                                </div>
                              )}

                              {/* Attached File / Deliverable Card */}
                              {parsed.attachmentTitle && parsed.attachmentUrl && (
                                <a
                                  href={parsed.attachmentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mb-2 flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#040D1A]/50 border border-[#1E3A5F] hover:border-[#10B981] transition-colors"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-[#10B981]/20 flex items-center justify-center text-[#2DD4BF] shrink-0">
                                      <FileText className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-[#F8FAFC] truncate">
                                        {parsed.attachmentTitle}
                                      </p>
                                      <p className="text-[10px] text-[#94A3B8]">
                                        Click to open / download attachment
                                      </p>
                                    </div>
                                  </div>
                                  <Download className="w-4 h-4 text-[#2DD4BF] shrink-0" />
                                </a>
                              )}

                              {/* Message Text Body */}
                              {parsed.body && (
                                <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">
                                  {parsed.body}
                                </p>
                              )}

                              {/* Timestamp & WhatsApp Double-Check Ticks */}
                              <div className="flex items-center justify-end gap-1.5 mt-1 select-none">
                                <span className="text-[10px] text-[#94A3B8]/90">
                                  {formatBubbleTime(msg.createdAt)}
                                </span>
                                {isOutgoing && !isInternal && (
                                  <span
                                    title={
                                      isRead
                                        ? 'Read by recipient'
                                        : 'Delivered to studio cloud'
                                    }
                                  >
                                    {isRead ? (
                                      <CheckCheck className="w-3.5 h-3.5 text-[#38BDF8]" />
                                    ) : (
                                      <CheckCheck className="w-3.5 h-3.5 text-[#94A3B8]" />
                                    )}
                                  </span>
                                )}
                              </div>

                              {/* Hover Quick Actions Bar (Reply / React / Copy) */}
                              <div
                                className={`opacity-0 group-hover:opacity-100 transition-opacity absolute -top-3 ${
                                  isOutgoing ? 'left-2' : 'right-2'
                                } flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg bg-[#0D1F38] border border-[#1E3A5F] shadow-lg z-10`}
                              >
                                {['👍', '❤️', '🔥', '✅'].map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => toggleReaction(msg.id, emoji)}
                                    className="px-1 py-0.5 text-xs hover:scale-125 transition-transform"
                                    title={`React with ${emoji}`}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyingTo(msg);
                                    textareaRef.current?.focus();
                                  }}
                                  className="p-1 text-[#94A3B8] hover:text-[#10B981]"
                                  title="Reply to message"
                                >
                                  <CornerUpLeft className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCopyMessage(msg.id, msg.content)}
                                  className="p-1 text-[#94A3B8] hover:text-[#F8FAFC]"
                                  title="Copy text"
                                >
                                  {copiedMsgId === msg.id ? (
                                    <Check className="w-3 h-3 text-[#10B981]" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Active Reactions Row */}
                            {msgReactions.length > 0 && (
                              <div className="flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-[#0D1F38] border border-[#1E3A5F] text-xs shadow-xs">
                                {msgReactions.map((r) => (
                                  <button
                                    key={r}
                                    type="button"
                                    onClick={() => toggleReaction(msg.id, r)}
                                    className="hover:scale-110 transition-transform"
                                  >
                                    {r}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </React.Fragment>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Studio Reply Templates Strip */}
                <div className="px-4 py-2 bg-[#0B192C] border-t border-[#1E3A5F]/70 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowQuickReplies((prev) => !prev)}
                    className="text-[10px] font-bold uppercase tracking-wider text-[#10B981] shrink-0 hover:underline"
                  >
                    {showQuickReplies ? 'Quick Replies ▾' : 'Quick Replies ▸'}
                  </button>
                  {showQuickReplies &&
                    (isAdmin ? ADMIN_QUICK_REPLIES : CLIENT_QUICK_REPLIES).map((tpl, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setMessageInput(tpl);
                          textareaRef.current?.focus();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#132A4A] hover:bg-[#1E3A5F] border border-[#1E3A5F] text-[11px] text-[#F8FAFC] whitespace-nowrap transition-colors shrink-0"
                      >
                        {tpl.length > 48 ? `${tpl.slice(0, 48)}...` : tpl}
                      </button>
                    ))}
                </div>

                {/* Staged Reply / Attachment Preview Banner */}
                {(replyingTo || stagedAttachment) && (
                  <div className="px-4 py-2.5 bg-[#0D1F38] border-t border-[#1E3A5F] flex items-center justify-between gap-3 shrink-0">
                    <div className="space-y-1 min-w-0 flex-1">
                      {replyingTo && (
                        <div className="flex items-center gap-2 text-xs border-l-3 border-l-[#10B981] pl-2.5">
                          <CornerUpLeft className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
                          <div className="min-w-0">
                            <span className="font-bold text-[#2DD4BF] block">
                              Replying to {replyingTo.senderName}
                            </span>
                            <span className="text-[#94A3B8] truncate block text-[11px]">
                              {parseStructuredMessageContent(replyingTo.content).body}
                            </span>
                          </div>
                        </div>
                      )}
                      {stagedAttachment && (
                        <div className="flex items-center gap-2 text-xs text-[#2DD4BF]">
                          <Paperclip className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-semibold truncate">
                            Attached: {stagedAttachment.title}
                          </span>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingTo(null);
                        setStagedAttachment(null);
                      }}
                      className="p-1 text-[#94A3B8] hover:text-[#F8FAFC]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Bottom WhatsApp Composer Bar */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-3 bg-[#0D1F38] border-t border-[#1E3A5F] flex items-end gap-2 relative shrink-0"
                >
                  {/* Emoji Picker Popover */}
                  {emojiOpen && (
                    <div className="absolute bottom-16 left-3 z-30 p-3 rounded-xl bg-[#0D1F38] border border-[#1E3A5F] shadow-2xl grid grid-cols-6 gap-2">
                      {QUICK_EMOJIS.map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => {
                            setMessageInput((prev) => `${prev}${em}`);
                            setEmojiOpen(false);
                            textareaRef.current?.focus();
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#132A4A] text-base transition-colors"
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Attachment / Deliverable Picker Popover */}
                  {attachMenuOpen && (
                    <div className="absolute bottom-16 left-12 z-30 w-80 p-4 rounded-xl bg-[#0D1F38] border border-[#1E3A5F] shadow-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#F8FAFC]">
                          Attach Deliverable or Link
                        </span>
                        <button
                          type="button"
                          onClick={() => setAttachMenuOpen(false)}
                          className="text-[#94A3B8] hover:text-[#F8FAFC]"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {threadDeliverables.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                            Project Deliverables
                          </p>
                          <div className="max-h-32 overflow-y-auto space-y-1">
                            {threadDeliverables.map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => {
                                  setStagedAttachment({
                                    title: `${f.fileName} (${f.versionLabel})`,
                                    url: f.downloadUrl,
                                  });
                                  setAttachMenuOpen(false);
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-[#132A4A] hover:bg-[#1E3A5F] text-left text-xs flex items-center justify-between gap-2"
                              >
                                <span className="truncate text-[#F8FAFC]">{f.fileName}</span>
                                <span className="text-[10px] text-[#2DD4BF] shrink-0">
                                  {f.versionLabel}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2 pt-1 border-t border-[#1E3A5F]">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                          Share Reference Link / Google Drive URL
                        </p>
                        <input
                          type="text"
                          value={customLinkTitle}
                          onChange={(e) => setCustomLinkTitle(e.target.value)}
                          placeholder="Label (e.g., Draft Cut v2 / Moodboard)"
                          className="w-full px-2.5 py-1.5 text-xs bg-[#132A4A] border border-[#1E3A5F] rounded-lg text-[#F8FAFC]"
                        />
                        <input
                          type="url"
                          value={customLinkUrl}
                          onChange={(e) => setCustomLinkUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full px-2.5 py-1.5 text-xs bg-[#132A4A] border border-[#1E3A5F] rounded-lg text-[#F8FAFC]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!customLinkUrl.trim()) return;
                            setStagedAttachment({
                              title: customLinkTitle.trim() || 'Shared Reference Link',
                              url: customLinkUrl.trim(),
                            });
                            setCustomLinkTitle('');
                            setCustomLinkUrl('');
                            setAttachMenuOpen(false);
                          }}
                          className="w-full py-1.5 text-xs font-semibold text-[#040D1A] bg-[#10B981] hover:bg-[#059669] rounded-lg"
                        >
                          Attach to Message
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setEmojiOpen((prev) => !prev);
                      setAttachMenuOpen(false);
                    }}
                    className="p-2.5 text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#132A4A] rounded-xl transition-colors shrink-0"
                    title="Insert Emoji"
                  >
                    <Smile className="w-5 h-5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAttachMenuOpen((prev) => !prev);
                      setEmojiOpen(false);
                    }}
                    className="p-2.5 text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#132A4A] rounded-xl transition-colors shrink-0"
                    title="Attach Deliverable or Link"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>

                  {isAdmin && (
                    <div className="hidden sm:flex items-center bg-[#081629] p-1 rounded-xl border border-[#1E3A5F] shrink-0">
                      <button
                        type="button"
                        onClick={() => setVisibility('client')}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                          visibility === 'client'
                            ? 'bg-[#10B981] text-[#040D1A]'
                            : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                        }`}
                      >
                        Client Chat
                      </button>
                      <button
                        type="button"
                        onClick={() => setVisibility('internal')}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                          visibility === 'internal'
                            ? 'bg-[#F59E0B] text-[#040D1A]'
                            : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                        }`}
                      >
                        <Lock className="w-3 h-3" />
                        <span>Internal</span>
                      </button>
                    </div>
                  )}

                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      isAdmin && visibility === 'internal'
                        ? 'Write a private internal studio note (hidden from client)...'
                        : `Type a message to ${activeThread.clientName}... (Enter to send)`
                    }
                    className="flex-1 max-h-32 min-h-[42px] px-4 py-2.5 text-xs bg-[#132A4A] border border-[#1E3A5F] focus:border-[#10B981] rounded-xl text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-none resize-none"
                  />

                  <button
                    type="submit"
                    disabled={sending || (!messageInput.trim() && !stagedAttachment)}
                    className="w-10 h-10 rounded-full bg-[#10B981] hover:bg-[#059669] disabled:opacity-40 text-[#040D1A] flex items-center justify-center shadow-lg transition-all shrink-0 cursor-pointer"
                    title="Send Message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>

              {/* =================================================================
                  COLLAPSIBLE RIGHT DRAWER: CONTACT & PROJECT CONTEXT
                 ================================================================= */}
              {infoDrawerOpen && (
                <aside className="w-72 lg:w-80 border-l border-[#1E3A5F] bg-[#0B192C] overflow-y-auto p-4 space-y-5 shrink-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
                      Thread Details
                    </h4>
                    <button
                      type="button"
                      onClick={() => setInfoDrawerOpen(false)}
                      className="p-1 text-[#94A3B8] hover:text-[#F8FAFC]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="text-center space-y-2 pb-4 border-b border-[#1E3A5F]">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0EA5E9] to-[#10B981] text-[#040D1A] font-bold text-lg flex items-center justify-center mx-auto shadow-md">
                      {activeThread.title.slice(0, 2).toUpperCase()}
                    </div>
                    <h3 className="text-sm font-bold text-[#F8FAFC]">{activeThread.title}</h3>
                    <p className="text-xs text-[#2DD4BF]">{activeThread.clientName}</p>
                    {activeThread.clientEmail && (
                      <p className="text-[11px] text-[#94A3B8]">{activeThread.clientEmail}</p>
                    )}
                    {activeThread.clientPhone && (
                      <p className="text-[11px] font-mono text-[#94A3B8]">
                        {activeThread.clientPhone}
                      </p>
                    )}
                  </div>

                  {activeThread.project && (
                    <div className="space-y-3 text-xs">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                        Project Snapshot
                      </p>
                      <div className="p-3 rounded-xl bg-[#0D1F38] border border-[#1E3A5F] space-y-2.5">
                        <div className="flex justify-between">
                          <span className="text-[#94A3B8]">Status</span>
                          <span className="font-semibold text-[#2DD4BF]">
                            {activeThread.project.status}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#94A3B8]">Budget</span>
                          <span className="font-mono font-semibold text-[#F8FAFC]">
                            {formatINR(activeThread.project.budget)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#94A3B8]">Deadline</span>
                          <span className="font-mono text-[#F8FAFC]">
                            {activeThread.project.deadline || 'Flexible'}
                          </span>
                        </div>
                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-[#94A3B8]">Completion</span>
                            <span className="font-mono font-semibold text-[#10B981]">
                              {activeThread.project.progress}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-[#132A4A] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#0EA5E9] to-[#10B981]"
                              style={{ width: `${activeThread.project.progress}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <Link
                        to={
                          isAdmin
                            ? `/admin/projects/${activeThread.project.id}`
                            : `/portal/projects/${activeThread.project.id}`
                        }
                        className="w-full py-2 px-3 rounded-xl bg-[#132A4A] hover:bg-[#1E3A5F] text-xs font-semibold text-[#F8FAFC] flex items-center justify-between"
                      >
                        <span>Open Full Project Workspace</span>
                        <ChevronRight className="w-4 h-4 text-[#10B981]" />
                      </Link>
                    </div>
                  )}

                  {threadDeliverables.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                        Deliverable Files ({threadDeliverables.length})
                      </p>
                      <div className="space-y-1.5">
                        {threadDeliverables.map((f) => (
                          <div
                            key={f.id}
                            className="p-2.5 rounded-xl bg-[#0D1F38] border border-[#1E3A5F] flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-[#F8FAFC] truncate">{f.fileName}</p>
                              <p className="text-[10px] text-[#94A3B8]">{f.versionLabel}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setStagedAttachment({
                                  title: `${f.fileName} (${f.versionLabel})`,
                                  url: f.downloadUrl,
                                })
                              }
                              className="px-2 py-1 text-[10px] font-semibold bg-[#132A4A] hover:bg-[#10B981] hover:text-[#040D1A] rounded-md shrink-0 transition-colors"
                            >
                              Share in Chat
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </aside>
              )}
            </div>
          </section>
        ) : (
          <div className="hidden md:flex flex-1 flex-col items-center justify-center p-8 text-center bg-[#06101E]">
            <div className="w-16 h-16 rounded-2xl bg-[#132A4A] border border-[#1E3A5F] flex items-center justify-center text-[#10B981] mb-4">
              <MessageSquarePlus className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-[#F8FAFC]">
              Prithvi Editify WhatsApp Studio Inbox
            </h3>
            <p className="text-xs text-[#94A3B8] max-w-sm mt-1">
              Select any project, client, or inquiry conversation on the left to view messages, share deliverables, or launch external WhatsApp.
            </p>
          </div>
        )}
      </div>

      {/* =====================================================================
          NEW CHAT MODAL (ADMIN)
         ===================================================================== */}
      {isAdmin && newChatModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#040D1A]/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#F8FAFC]">Start or Jump to Conversation</h3>
                <p className="text-[11px] text-[#94A3B8]">
                  Choose a project, client, or inquiry thread
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNewChatModalOpen(false)}
                className="p-1 text-[#94A3B8] hover:text-[#F8FAFC]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-[#1E3A5F]/50 border border-[#1E3A5F] rounded-xl">
              {threads.map((t) => (
                <button
                  key={t.threadId}
                  type="button"
                  onClick={() => {
                    handleSelectThread(t.threadId);
                    setNewChatModalOpen(false);
                  }}
                  className="w-full p-3 text-left hover:bg-[#132A4A] flex items-center justify-between gap-2 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#F8FAFC] truncate">{t.title}</p>
                    <p className="text-[11px] text-[#94A3B8] truncate">
                      {t.clientName} · {t.statusLabel}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#10B981] shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
