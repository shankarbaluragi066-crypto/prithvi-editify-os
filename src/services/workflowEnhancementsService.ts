import {
  InquiryRecord,
  InvoiceRecord,
  QuotationLineItem,
  QuotationRecord,
  ServiceItem,
  TaskRecord,
} from '../types/crm';
import {
  fetchAllQuotationsAdmin,
  generateWrittenContent,
  saveQuotationAdmin,
} from './aiAssistantService';

// ============================================================================
// 1. INTERACTIVE VISUAL PROOFING & PIN ANNOTATIONS
// ============================================================================
export interface ProofingPinAnnotation {
  id: string;
  projectId: string;
  deliverableId: string;
  deliverableTitle: string;
  mediaType: 'image' | 'video';
  xPercent: number; // 0 - 100 for image coordinates (or video frame x)
  yPercent: number; // 0 - 100 for image coordinates (or video frame y)
  timestampSeconds?: number | null; // For video proofs e.g., 18.5 -> 00:18
  comment: string;
  authorName: string;
  authorRole: 'admin' | 'client';
  resolved: boolean;
  createdAt: string;
}

const PROOFING_PINS_KEY = 'pe_crm_proofing_pins_v1';

export function getProofingPins(projectId: string, deliverableId?: string): ProofingPinAnnotation[] {
  try {
    const raw = localStorage.getItem(PROOFING_PINS_KEY);
    const list: ProofingPinAnnotation[] = raw ? JSON.parse(raw) : [];
    return list
      .filter(
        (pin) =>
          pin.projectId === projectId &&
          (!deliverableId || pin.deliverableId === deliverableId)
      )
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } catch {
    return [];
  }
}

export function addProofingPin(
  pin: Omit<ProofingPinAnnotation, 'id' | 'createdAt' | 'resolved'>
): ProofingPinAnnotation {
  try {
    const raw = localStorage.getItem(PROOFING_PINS_KEY);
    const list: ProofingPinAnnotation[] = raw ? JSON.parse(raw) : [];
    const created: ProofingPinAnnotation = {
      ...pin,
      id: `pin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      resolved: false,
      createdAt: new Date().toISOString(),
    };
    list.push(created);
    localStorage.setItem(PROOFING_PINS_KEY, JSON.stringify(list));
    return created;
  } catch {
    return {
      ...pin,
      id: `pin_${Date.now()}`,
      resolved: false,
      createdAt: new Date().toISOString(),
    };
  }
}

export function toggleProofingPinResolved(pinId: string): void {
  try {
    const raw = localStorage.getItem(PROOFING_PINS_KEY);
    const list: ProofingPinAnnotation[] = raw ? JSON.parse(raw) : [];
    const updated = list.map((p) => (p.id === pinId ? { ...p, resolved: !p.resolved } : p));
    localStorage.setItem(PROOFING_PINS_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export function deleteProofingPin(pinId: string): void {
  try {
    const raw = localStorage.getItem(PROOFING_PINS_KEY);
    const list: ProofingPinAnnotation[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(
      PROOFING_PINS_KEY,
      JSON.stringify(list.filter((p) => p.id !== pinId))
    );
  } catch {
    // ignore
  }
}

export function formatVideoTimestamp(seconds?: number | null): string {
  if (seconds === undefined || seconds === null || Number.isNaN(seconds)) return '00:00';
  const totalSec = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ============================================================================
// 2. WATERMARKED PREVIEW MODE VS. FINAL UNLOCK CHECK
// ============================================================================
const MANUAL_UNLOCK_PROJECTS_KEY = 'pe_crm_unlocked_projects_v1';

export function isProjectManuallyUnlocked(projectId: string): boolean {
  try {
    const raw = localStorage.getItem(MANUAL_UNLOCK_PROJECTS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    return ids.includes(projectId);
  } catch {
    return false;
  }
}

export function setProjectManualUnlock(projectId: string, unlocked: boolean): void {
  try {
    const raw = localStorage.getItem(MANUAL_UNLOCK_PROJECTS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    const next = unlocked
      ? Array.from(new Set([...ids, projectId]))
      : ids.filter((id) => id !== projectId);
    localStorage.setItem(MANUAL_UNLOCK_PROJECTS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function checkProjectMasterUnlockStatus(
  projectId: string,
  invoices: InvoiceRecord[]
): {
  isUnlocked: boolean;
  reason: string;
  totalBilled: number;
  balanceDue: number;
} {
  if (isProjectManuallyUnlocked(projectId)) {
    return {
      isUnlocked: true,
      reason: 'Unlocked by Studio Administrator',
      totalBilled: 0,
      balanceDue: 0,
    };
  }

  const projectInvoices = invoices.filter(
    (inv) => inv.projectId === projectId && inv.status !== 'Cancelled'
  );

  if (projectInvoices.length === 0) {
    return {
      isUnlocked: false,
      reason: 'Watermarked Preview Proof (Pending Final Invoice Settlement)',
      totalBilled: 0,
      balanceDue: 0,
    };
  }

  const totalBilled = projectInvoices.reduce((acc, i) => acc + (Number(i.total) || 0), 0);
  const balanceDue = projectInvoices.reduce((acc, i) => acc + (Number(i.balanceDue) || 0), 0);
  const allPaid = balanceDue <= 0 && totalBilled > 0;

  return {
    isUnlocked: allPaid,
    reason: allPaid
      ? 'Full Invoice Settled (₹0 Balance Due) — High-Res Master Unlocked'
      : `Watermarked Preview Proof — Unlocks automatically when ₹${balanceDue.toLocaleString('en-IN')} balance is settled`,
    totalBilled,
    balanceDue,
  };
}

// ============================================================================
// 3. PUBLIC SHAREABLE QUOTATION LINK (/quote/:quoteId)
// ============================================================================
export function buildPublicQuotationShareUrl(quotation: QuotationRecord): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const basePath =
    typeof window !== 'undefined' &&
    window.location.pathname.startsWith('/prithvi-editify')
      ? '/prithvi-editify'
      : '';
  try {
    const compactPayload = btoa(
      encodeURIComponent(
        JSON.stringify({
          id: quotation.id,
          quotationNumber: quotation.quotationNumber,
          clientName: quotation.clientName,
          clientEmail: quotation.clientEmail,
          projectTitle: quotation.projectTitle,
          serviceCategory: quotation.serviceCategory,
          scopeSummary: quotation.scopeSummary,
          deliverables: quotation.deliverables,
          estimatedTimeline: quotation.estimatedTimeline,
          issueDate: quotation.issueDate,
          expiryDate: quotation.expiryDate,
          lineItems: quotation.lineItems,
          subtotal: quotation.subtotal,
          discount: quotation.discount,
          taxRate: quotation.taxRate,
          taxAmount: quotation.taxAmount,
          total: quotation.total,
          currency: 'INR',
          status: quotation.status,
          termsAndConditions: quotation.termsAndConditions,
        })
      )
    );
    return `${origin}${basePath}/quote/${encodeURIComponent(quotation.id)}?d=${compactPayload}`;
  } catch {
    return `${origin}${basePath}/quote/${encodeURIComponent(quotation.id)}`;
  }
}

export async function resolvePublicQuotationByIdOrToken(
  quoteId: string,
  encodedData?: string | null
): Promise<QuotationRecord | null> {
  const all = await fetchAllQuotationsAdmin().catch(() => []);
  const found = all.find(
    (q) =>
      q.id === quoteId ||
      q.quotationNumber.toLowerCase() === quoteId.toLowerCase()
  );
  if (found) return found;

  if (encodedData) {
    try {
      const decoded = JSON.parse(decodeURIComponent(atob(encodedData)));
      if (decoded && decoded.quotationNumber) {
        return decoded as QuotationRecord;
      }
    } catch {
      // ignore malformed payload
    }
  }
  return null;
}

export async function publicRespondToQuotation(
  quotation: QuotationRecord,
  decision: 'Accepted' | 'Rejected',
  clientNote?: string
): Promise<QuotationRecord> {
  const updated = await saveQuotationAdmin(
    {
      quotationNumber: quotation.quotationNumber,
      inquiryId: quotation.inquiryId,
      clientId: quotation.clientId || '',
      clientUserId: quotation.clientUserId || '',
      clientName: quotation.clientName,
      clientEmail: quotation.clientEmail,
      projectTitle: quotation.projectTitle,
      serviceCategory: quotation.serviceCategory,
      scopeSummary: quotation.scopeSummary,
      deliverables: quotation.deliverables,
      estimatedTimeline: quotation.estimatedTimeline,
      issueDate: quotation.issueDate,
      expiryDate: quotation.expiryDate,
      lineItems: quotation.lineItems,
      subtotal: quotation.subtotal,
      discount: quotation.discount,
      taxRate: quotation.taxRate,
      taxAmount: quotation.taxAmount,
      total: quotation.total,
      currency: 'INR',
      status: decision,
      termsAndConditions: clientNote
        ? `${quotation.termsAndConditions}\n\n[Client Decision Note (${decision})]: ${clientNote}`
        : quotation.termsAndConditions,
      convertedProjectId: quotation.convertedProjectId,
      convertedInvoiceId: quotation.convertedInvoiceId,
      clientDecisionAt: new Date().toISOString(),
      clientDecisionBy: `${quotation.clientName} (Public Quote Link)`,
    },
    quotation.id
  );
  return updated;
}

// ============================================================================
// 4. CLIENT PAYMENT PROOF SUBMISSIONS & UPI / GST HELPERS
// ============================================================================
export interface ClientPaymentProofSubmission {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  clientUserId: string;
  clientName: string;
  clientEmail: string;
  amount: number;
  method: 'UPI' | 'Bank Transfer (NEFT/IMPS)' | 'Other';
  utrNumber: string;
  receiptScreenshotDataUrl?: string;
  notes: string;
  status: 'Pending Verification' | 'Approved' | 'Rejected';
  submittedAt: string;
  reviewedAt?: string;
}

const PAYMENT_PROOFS_KEY = 'pe_crm_client_payment_proofs_v1';
const STUDIO_UPI_SETTINGS_KEY = 'pe_crm_studio_upi_settings_v1';

export interface StudioBillingUpiSettings {
  upiId: string;
  payeeName: string;
  gstin: string;
  sacCode: string;
}

export function getStudioUpiSettings(): StudioBillingUpiSettings {
  try {
    const raw = localStorage.getItem(STUDIO_UPI_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        upiId: parsed.upiId || 'shankarbaluragi@upi',
        payeeName: parsed.payeeName || 'Prithvi Editify (Shankar Baluragi)',
        gstin: parsed.gstin || '',
        sacCode: parsed.sacCode || '9983',
      };
    }
  } catch {
    // ignore
  }
  return {
    upiId: 'shankarbaluragi@upi',
    payeeName: 'Prithvi Editify (Shankar Baluragi)',
    gstin: '',
    sacCode: '9983',
  };
}

export function saveStudioUpiSettings(settings: StudioBillingUpiSettings): void {
  try {
    localStorage.setItem(STUDIO_UPI_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export function buildUpiPaymentUri(params: {
  upiId?: string;
  payeeName?: string;
  amount: number;
  transactionNote: string;
}): string {
  const defaults = getStudioUpiSettings();
  const pa = encodeURIComponent(params.upiId || defaults.upiId);
  const pn = encodeURIComponent(params.payeeName || defaults.payeeName);
  const am = Math.max(0, Math.round(params.amount));
  const tn = encodeURIComponent(params.transactionNote);
  return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=INR&tn=${tn}`;
}

export function getClientPaymentProofs(clientUserId?: string): ClientPaymentProofSubmission[] {
  try {
    const raw = localStorage.getItem(PAYMENT_PROOFS_KEY);
    const list: ClientPaymentProofSubmission[] = raw ? JSON.parse(raw) : [];
    const filtered = clientUserId
      ? list.filter((item) => item.clientUserId === clientUserId)
      : list;
    return filtered.sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  } catch {
    return [];
  }
}

export function submitClientPaymentProof(
  submission: Omit<ClientPaymentProofSubmission, 'id' | 'status' | 'submittedAt'>
): ClientPaymentProofSubmission {
  const list = getClientPaymentProofs();
  const created: ClientPaymentProofSubmission = {
    ...submission,
    id: `payproof_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    status: 'Pending Verification',
    submittedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(PAYMENT_PROOFS_KEY, JSON.stringify([created, ...list]));
  } catch {
    // ignore
  }
  return created;
}

export function updateClientPaymentProofStatus(
  proofId: string,
  status: 'Approved' | 'Rejected',
  _reviewedBy?: string
): ClientPaymentProofSubmission | null {
  const list = getClientPaymentProofs();
  const idx = list.findIndex((p) => p.id === proofId);
  if (idx < 0) return null;
  const updated: ClientPaymentProofSubmission = {
    ...list[idx],
    status,
    reviewedAt: new Date().toISOString(),
  };
  list[idx] = updated;
  try {
    localStorage.setItem(PAYMENT_PROOFS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
  return updated;
}

export type GstTaxMode =
  | 'non_gst'
  | 'cgst_sgst_18'
  | 'igst_18'
  | 'custom'
  | 'NON_GST'
  | 'CGST_SGST_18'
  | 'IGST_18'
  | 'CUSTOM';

export function computeGstBreakdown(params: {
  taxableAmount: number;
  taxRate: number;
  gstMode: GstTaxMode;
}): {
  sacCode: string;
  taxRate: number;
  totalTax: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  label: string;
} {
  const sacCode = '9983'; // HSN/SAC 9983: Creative Design, Advertising & Video Editing Services
  const taxable = Math.max(0, Number(params.taxableAmount) || 0);
  if (params.gstMode === 'non_gst') {
    return {
      sacCode,
      taxRate: 0,
      totalTax: 0,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: 0,
      igstAmount: 0,
      label: 'Non-GST Billing (0% Tax)',
    };
  }

  if (params.gstMode === 'cgst_sgst_18') {
    const cgstAmount = Math.round(taxable * 0.09);
    const sgstAmount = Math.round(taxable * 0.09);
    return {
      sacCode,
      taxRate: 18,
      totalTax: cgstAmount + sgstAmount,
      cgstRate: 9,
      cgstAmount,
      sgstRate: 9,
      sgstAmount,
      igstRate: 0,
      igstAmount: 0,
      label: 'GST 18% (CGST 9% + SGST 9% · SAC 9983)',
    };
  }

  if (params.gstMode === 'igst_18') {
    const igstAmount = Math.round(taxable * 0.18);
    return {
      sacCode,
      taxRate: 18,
      totalTax: igstAmount,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: 18,
      igstAmount,
      label: 'IGST 18% (Inter-State · SAC 9983)',
    };
  }

  const rate = Math.max(0, Number(params.taxRate) || 0);
  const totalTax = Math.round((taxable * rate) / 100);
  return {
    sacCode,
    taxRate: rate,
    totalTax,
    cgstRate: rate / 2,
    cgstAmount: Math.round(totalTax / 2),
    sgstRate: rate / 2,
    sgstAmount: totalTax - Math.round(totalTax / 2),
    igstRate: 0,
    igstAmount: 0,
    label: rate > 0 ? `Tax (${rate}% · SAC 9983)` : 'Non-GST (0%)',
  };
}

// ============================================================================
// 5. PROJECT MILESTONE TEMPLATES & ONE-CLICK WHATSAPP DISPATCHER
// ============================================================================
export interface MilestoneTemplateItem {
  title: string;
  description: string;
  daysOffset: number;
  priority: 'Low' | 'Medium' | 'High';
  visibility: 'client' | 'internal';
}

export const STUDIO_MILESTONE_TEMPLATES: Record<string, MilestoneTemplateItem[]> = {
  'YouTube Video Editing & Reels': [
    {
      title: '01. Raw Footage Ingestion & Storyboard Assembly',
      description: 'Sync audio, organize B-roll, and assemble the primary narrative A-roll cut.',
      daysOffset: 1,
      priority: 'High',
      visibility: 'client',
    },
    {
      title: '02. Motion Graphics, Captions & SFX Polish',
      description: 'Add dynamic retention captions, sound design risers, and visual callouts.',
      daysOffset: 2,
      priority: 'Medium',
      visibility: 'client',
    },
    {
      title: '03. Color Grading & Watermarked Client Review Proof',
      description: 'Upload watermarked 1080p preview to Client Portal for frame-accurate feedback.',
      daysOffset: 3,
      priority: 'High',
      visibility: 'client',
    },
    {
      title: '04. Final 4K Master Export & Source Delivery',
      description: 'Render final unwatermarked master after revision sign-off and invoice settlement.',
      daysOffset: 4,
      priority: 'High',
      visibility: 'client',
    },
  ],
  'YouTube Thumbnail Design': [
    {
      title: '01. CTR Hook Concept & Composition Sketch',
      description: 'Develop 2 high-contrast visual hook concepts and subject cutout layout.',
      daysOffset: 1,
      priority: 'High',
      visibility: 'client',
    },
    {
      title: '02. Subject Retouching, Rim Lighting & Typography',
      description: 'Apply expressive skin retouching, dramatic rim lighting, and bold 3-word hook text.',
      daysOffset: 1,
      priority: 'Medium',
      visibility: 'client',
    },
    {
      title: '03. Final 1920×1080 PNG Master & A/B Variant Delivery',
      description: 'Export crisp under-2MB YouTube-ready PNG masters in the Client Portal.',
      daysOffset: 2,
      priority: 'High',
      visibility: 'client',
    },
  ],
  'Social Media & Ad Creatives': [
    {
      title: '01. Brand Direction & Ad Copy Alignment',
      description: 'Lock typography, brand color palette, and primary CTA hierarchy.',
      daysOffset: 1,
      priority: 'Medium',
      visibility: 'client',
    },
    {
      title: '02. First Proof Upload (Feed & Story Formats)',
      description: 'Upload 1080×1350 and 1080×1920 design proofs for client pin-comments.',
      daysOffset: 2,
      priority: 'High',
      visibility: 'client',
    },
    {
      title: '03. Final Revision Polish & High-Res Export',
      description: 'Apply client feedback and unlock final print/web-ready master deliverables.',
      daysOffset: 3,
      priority: 'High',
      visibility: 'client',
    },
  ],
};

export function inferMilestoneTemplateKey(serviceCategory: string): string {
  const lower = (serviceCategory || '').toLowerCase();
  if (lower.includes('video') || lower.includes('reel') || lower.includes('short')) {
    return 'YouTube Video Editing & Reels';
  }
  if (lower.includes('thumbnail') || lower.includes('youtube')) {
    return 'YouTube Thumbnail Design';
  }
  return 'Social Media & Ad Creatives';
}

// ============================================================================
// 6. ONE-CLICK AI INQUIRY-TO-QUOTATION AUTO-DRAFTER
// ============================================================================
export async function generateAIQuotationDraftFromInquiry(
  inquiry: InquiryRecord,
  services: ServiceItem[]
): Promise<{
  projectTitle: string;
  serviceCategory: string;
  estimatedTimeline: string;
  scopeSummary: string;
  deliverables: string;
  lineItems: QuotationLineItem[];
}> {
  // Match relevant service from catalog
  const lowerReq = (inquiry.serviceRequired || '').toLowerCase();
  const matchedService =
    services.find(
      (s) =>
        s.title.toLowerCase().includes(lowerReq) ||
        lowerReq.includes(s.title.toLowerCase()) ||
        s.category.toLowerCase().includes(lowerReq)
    ) || services[0];

  // Parse budget hint
  let unitPrice = matchedService?.startingPrice || 1500;
  const nums = (inquiry.budgetRange || '').replace(/,/g, '').match(/\d+/g);
  if (nums && nums.length > 0) {
    const parsed = Number(nums[0]);
    if (parsed >= 300 && parsed <= 250000) {
      unitPrice = parsed;
    }
  }

  const baseLineItems: QuotationLineItem[] = [
    {
      description: `${inquiry.serviceRequired || matchedService?.title || 'Creative Design & Production'} — Core Deliverable Package`,
      quantity: 1,
      unitPrice,
      amount: unitPrice,
    },
  ];

  // Try AI enhancement for scopeSummary & deliverables; fall back gracefully if AI key isn't active
  try {
    const aiRes = await generateWrittenContent({
      task: 'Client proposal or quotation summary',
      action: 'generate',
      topicOrText: `Client: ${inquiry.fullName} (${inquiry.companyName || 'Direct Brand'}). Requested Service: ${inquiry.serviceRequired}. Budget Range: ${inquiry.budgetRange}. Client Brief: ${inquiry.description}. Write a concise 2-sentence Project Scope Summary followed by a bulleted list of 3 included deliverables.`,
      tone: 'Professional',
    });

    const text = (aiRes.result || '').trim();
    if (text) {
      const paragraphs = text.split(/\n\n+/);
      const scopeSummary = paragraphs[0]?.replace(/^#+\s*/g, '').trim() || inquiry.description;
      const deliverables =
        paragraphs.slice(1).join('\n').trim() ||
        matchedService?.deliverablesSummary ||
        'High-resolution master exports, 2 rounds of client revisions, and private portal delivery.';

      return {
        projectTitle: `${inquiry.serviceRequired} — ${inquiry.companyName || inquiry.fullName}`,
        serviceCategory: inquiry.serviceRequired,
        estimatedTimeline: matchedService?.turnaroundTime || '3–5 business days',
        scopeSummary,
        deliverables,
        lineItems: baseLineItems,
      };
    }
  } catch {
    // Fallback to smart deterministic template below
  }

  return {
    projectTitle: `${inquiry.serviceRequired} — ${inquiry.companyName || inquiry.fullName}`,
    serviceCategory: inquiry.serviceRequired,
    estimatedTimeline: matchedService?.turnaroundTime || '3–5 business days',
    scopeSummary: `Custom ${inquiry.serviceRequired} production tailored for ${
      inquiry.companyName || inquiry.fullName
    }. Scope based on brief: "${inquiry.description.slice(0, 180)}"`,
    deliverables:
      matchedService?.deliverablesSummary ||
      'High-resolution ready-to-publish master files, 2 rounds of structured revisions via Client Portal, and commercial usage rights.',
    lineItems: baseLineItems,
  };
}

// ============================================================================
// 7. WHATSAPP INVOICE & QUOTATION DISPATCHER LINKS
// ============================================================================
export function buildWhatsAppQuotationShareLink(
  quotation: QuotationRecord,
  clientPhone?: string
): string {
  const publicQuoteUrl = buildPublicQuotationShareUrl(quotation);
  const itemsText = quotation.lineItems
    .map((li) => `• ${li.description} (${li.quantity} × ₹${li.unitPrice.toLocaleString('en-IN')})`)
    .join('\n');

  const message = [
    `Hello ${quotation.clientName},`,
    ``,
    `Here is your official project quotation from *Prithvi Editify*:`,
    `*Quote #:* ${quotation.quotationNumber}`,
    `*Project:* ${quotation.projectTitle}`,
    `*Estimated Timeline:* ${quotation.estimatedTimeline}`,
    ``,
    `*Deliverables & Breakdown:*`,
    itemsText,
    ``,
    `*Total Quoted Amount:* ₹${quotation.total.toLocaleString('en-IN')} INR`,
    `*Valid Until:* ${quotation.expiryDate}`,
    ``,
    `Review, print PDF, or approve this quotation in one tap here:`,
    publicQuoteUrl,
    ``,
    `— Shankar Baluragi · Prithvi Editify`,
  ].join('\n');

  const digits = (clientPhone || '').replace(/\D/g, '');
  const normalizedPhone =
    digits.length === 10 ? `91${digits}` : digits.length >= 11 ? digits : '';

  return normalizedPhone
    ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function buildWhatsAppInvoiceShareLink(
  invoice: InvoiceRecord,
  clientPhone?: string
): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const portalUrl = `${origin}/portal/invoices`;
  const upiSettings = getStudioUpiSettings();

  const message = [
    `Hello ${invoice.clientName},`,
    ``,
    `Your official invoice from *Prithvi Editify* is ready:`,
    `*Invoice #:* ${invoice.invoiceNumber}`,
    `*Project:* ${invoice.projectTitle}`,
    `*Total Amount:* ₹${invoice.total.toLocaleString('en-IN')} INR`,
    `*Balance Due:* ₹${invoice.balanceDue.toLocaleString('en-IN')} INR`,
    `*Due Date:* ${invoice.dueDate}`,
    ``,
    `*Instant UPI Payment:*`,
    `UPI ID: ${upiSettings.upiId} (Ref: ${invoice.invoiceNumber})`,
    ``,
    `View printable invoice, scan UPI QR code, or submit UTR payment proof in your Client Portal:`,
    portalUrl,
    ``,
    `— Shankar Baluragi · Prithvi Editify`,
  ].join('\n');

  const digits = (clientPhone || '').replace(/\D/g, '');
  const normalizedPhone =
    digits.length === 10 ? `91${digits}` : digits.length >= 11 ? digits : '';

  return normalizedPhone
    ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
}

// ============================================================================
// 8. UNIFIED ALIASES & GST METADATA PERSISTENCE
// ============================================================================
export type UnifiedGstMode =
  | GstTaxMode
  | 'NON_GST'
  | 'CGST_SGST_18'
  | 'IGST_18'
  | 'CUSTOM';

export interface InvoiceGstMetaRecord {
  gstMode: GstTaxMode;
  sacCode: string;
  clientGstin?: string;
}

const GST_META_STORAGE_KEY = 'pe_invoice_gst_meta_v1';

export function getInvoiceGstMeta(recordId: string): InvoiceGstMetaRecord {
  try {
    const raw = localStorage.getItem(GST_META_STORAGE_KEY);
    const map: Record<string, InvoiceGstMetaRecord> = raw ? JSON.parse(raw) : {};
    return (
      map[recordId] || {
        gstMode: 'NON_GST',
        sacCode: '9983',
      }
    );
  } catch {
    return { gstMode: 'NON_GST', sacCode: '9983' };
  }
}

export function saveInvoiceGstMeta(
  recordId: string,
  meta: InvoiceGstMetaRecord
): void {
  try {
    const raw = localStorage.getItem(GST_META_STORAGE_KEY);
    const map: Record<string, InvoiceGstMetaRecord> = raw ? JSON.parse(raw) : {};
    map[recordId] = meta;
    localStorage.setItem(GST_META_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

export function calculateGstBreakdown(
  subtotal: number,
  discount: number,
  mode: UnifiedGstMode,
  customRate = 0,
  sacCode = '9983'
): {
  mode: 'NON_GST' | 'CGST_SGST_18' | 'IGST_18' | 'CUSTOM';
  sacCode: string;
  taxableAmount: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTax: number;
  grandTotal: number;
  label: string;
} {
  const taxableAmount = Math.max(0, (Number(subtotal) || 0) - (Number(discount) || 0));
  const norm = String(mode).toUpperCase();
  if (norm === 'CGST_SGST_18') {
    const cgstAmount = Math.round(taxableAmount * 0.09);
    const sgstAmount = Math.round(taxableAmount * 0.09);
    const totalTax = cgstAmount + sgstAmount;
    return {
      mode: 'CGST_SGST_18',
      sacCode: sacCode || '9983',
      taxableAmount,
      cgstRate: 9,
      cgstAmount,
      sgstRate: 9,
      sgstAmount,
      igstRate: 0,
      igstAmount: 0,
      totalTax,
      grandTotal: taxableAmount + totalTax,
      label: `CGST 9% + SGST 9% (SAC ${sacCode || '9983'})`,
    };
  }
  if (norm === 'IGST_18') {
    const igstAmount = Math.round(taxableAmount * 0.18);
    return {
      mode: 'IGST_18',
      sacCode: sacCode || '9983',
      taxableAmount,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: 18,
      igstAmount,
      totalTax: igstAmount,
      grandTotal: taxableAmount + igstAmount,
      label: `IGST 18% (SAC ${sacCode || '9983'})`,
    };
  }
  if (norm === 'CUSTOM' && customRate > 0) {
    const totalTax = Math.round((taxableAmount * customRate) / 100);
    return {
      mode: 'CUSTOM',
      sacCode: sacCode || '9983',
      taxableAmount,
      cgstRate: customRate / 2,
      cgstAmount: Math.round(totalTax / 2),
      sgstRate: customRate / 2,
      sgstAmount: totalTax - Math.round(totalTax / 2),
      igstRate: 0,
      igstAmount: 0,
      totalTax,
      grandTotal: taxableAmount + totalTax,
      label: `Tax ${customRate}% (SAC ${sacCode || '9983'})`,
    };
  }
  return {
    mode: 'NON_GST',
    sacCode: sacCode || '9983',
    taxableAmount,
    cgstRate: 0,
    cgstAmount: 0,
    sgstRate: 0,
    sgstAmount: 0,
    igstRate: 0,
    igstAmount: 0,
    totalTax: 0,
    grandTotal: taxableAmount,
    label: 'Non-GST (0%)',
  };
}

export const buildWhatsAppQuotationShareUrl = buildWhatsAppQuotationShareLink;
export const buildWhatsAppInvoiceShareUrl = buildWhatsAppInvoiceShareLink;
export const generateAIDraftedQuotationFromInquiry = generateAIQuotationDraftFromInquiry;

export interface ProjectMilestoneTemplateDef {
  id: string;
  name: string;
  serviceCategory: string;
  tasks: MilestoneTemplateItem[];
}

export const PROJECT_MILESTONE_TEMPLATES: ProjectMilestoneTemplateDef[] = [
  {
    id: 'tpl-yt-video',
    name: 'YouTube Video & Reels Production (4 Milestones)',
    serviceCategory: 'YouTube Video Editing & Reels',
    tasks: STUDIO_MILESTONE_TEMPLATES['YouTube Video Editing & Reels'],
  },
  {
    id: 'tpl-yt-thumb',
    name: 'YouTube High-CTR Thumbnail Pack (3 Milestones)',
    serviceCategory: 'YouTube Thumbnail Design',
    tasks: STUDIO_MILESTONE_TEMPLATES['YouTube Thumbnail Design'],
  },
  {
    id: 'tpl-social-ads',
    name: 'Social Media & Brand Ad Campaign (3 Milestones)',
    serviceCategory: 'Social Media & Ad Creatives',
    tasks: STUDIO_MILESTONE_TEMPLATES['Social Media & Ad Creatives'],
  },
];

export function buildTasksFromMilestoneTemplate(
  templateId: string,
  projectId: string,
  clientUserId: string,
  startDateIso?: string
): Array<Omit<TaskRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>> {
  const found =
    PROJECT_MILESTONE_TEMPLATES.find((t) => t.id === templateId) ||
    PROJECT_MILESTONE_TEMPLATES[0];
  const baseTime = startDateIso ? new Date(startDateIso).getTime() : Date.now();

  return found.tasks.map((item) => {
    const due = new Date(
      (Number.isNaN(baseTime) ? Date.now() : baseTime) + item.daysOffset * 86400000
    )
      .toISOString()
      .split('T')[0];
    return {
      projectId,
      clientUserId: clientUserId || '',
      title: item.title,
      description: item.description,
      status: 'To Do',
      priority: item.priority,
      dueDate: due,
      visibility: item.visibility,
    };
  });
}

