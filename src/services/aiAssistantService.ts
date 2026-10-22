import { supabase, isSupabaseConfigured, isMissingSchemaError } from '../lib/supabaseClient';
import { uploadMediaAssetAdmin, logAdminActivity } from './crmService';
import {
  AIBrandProfile,
  AIUsageHistoryEntry,
  GeneratedServiceAIContent,
  GeneratedPortfolioAIContent,
  QuotationRecord,
  QuotationStatus,
  QuotationDocumentType,
  QuotationDeleteEligibility,
  QuotationRevisionSnapshot,
  MediaAsset,
} from '../types/crm';

const BRAND_PROFILE_STORAGE_KEY = 'pe_admin_ai_brand_profile_v1';
const AI_USAGE_HISTORY_STORAGE_KEY = 'pe_admin_ai_usage_history_v1';
const QUOTATIONS_STORAGE_KEY = 'pe_crm_quotations_v1';

export const DEFAULT_AI_BRAND_PROFILE: AIBrandProfile = {
  brandName: 'Prithvi Editify',
  ownerName: 'Shankar Baluragi',
  businessType:
    'Freelance creative design, photo editing, YouTube thumbnail design, video editing, Instagram Reels editing, social media creatives, and promotional advertisements studio',
  brandVoice:
    'Professional, editorial, trustworthy, direct, creative-agency quality, and client-focused',
  targetCustomers:
    'YouTube creators, startups, D2C brands, coaches, educators, marketing teams, and growing businesses',
  preferredWritingStyle:
    'Clear visual hierarchy, concrete deliverables, persuasive yet honest language without hype or exaggerated claims',
  brandColors:
    'Midnight Slate (#172333), Warm Alabaster (#F5F5F1), Terracotta Accent (#F18A45), Deep Slate (#24364A)',
  servicesOffered:
    'Graphic design, photo editing, YouTube thumbnail design, YouTube video editing, Instagram Reels editing, social media creatives, promotional advertisements, banners, logo & brand identity design',
  wordsToAvoid:
    'Guaranteed viral, #1 agency in the world, 1000% ROI guarantee, overnight millions, fake testimonials, invented statistics',
};

export function getSavedBrandProfile(): AIBrandProfile {
  try {
    const raw = localStorage.getItem(BRAND_PROFILE_STORAGE_KEY);
    if (!raw) return DEFAULT_AI_BRAND_PROFILE;
    const parsed = JSON.parse(raw) as Partial<AIBrandProfile>;
    return {
      ...DEFAULT_AI_BRAND_PROFILE,
      ...parsed,
    };
  } catch {
    return DEFAULT_AI_BRAND_PROFILE;
  }
}

export function saveBrandProfile(profile: AIBrandProfile): AIBrandProfile {
  const clean: AIBrandProfile = {
    brandName: (profile.brandName || DEFAULT_AI_BRAND_PROFILE.brandName).trim(),
    ownerName: (profile.ownerName || DEFAULT_AI_BRAND_PROFILE.ownerName).trim(),
    businessType: (profile.businessType || DEFAULT_AI_BRAND_PROFILE.businessType).trim(),
    brandVoice: (profile.brandVoice || DEFAULT_AI_BRAND_PROFILE.brandVoice).trim(),
    targetCustomers: (profile.targetCustomers || DEFAULT_AI_BRAND_PROFILE.targetCustomers).trim(),
    preferredWritingStyle: (
      profile.preferredWritingStyle || DEFAULT_AI_BRAND_PROFILE.preferredWritingStyle
    ).trim(),
    brandColors: (profile.brandColors || DEFAULT_AI_BRAND_PROFILE.brandColors).trim(),
    servicesOffered: (profile.servicesOffered || DEFAULT_AI_BRAND_PROFILE.servicesOffered).trim(),
    wordsToAvoid: (profile.wordsToAvoid || DEFAULT_AI_BRAND_PROFILE.wordsToAvoid).trim(),
  };
  try {
    localStorage.setItem(BRAND_PROFILE_STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Ignore storage quota errors
  }
  return clean;
}

export function getAIUsageHistory(): AIUsageHistoryEntry[] {
  try {
    const raw = localStorage.getItem(AI_USAGE_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordAIUsageHistory(
  entry: Omit<AIUsageHistoryEntry, 'id' | 'timestamp'>
): AIUsageHistoryEntry[] {
  const nextEntry: AIUsageHistoryEntry = {
    ...entry,
    id: `ai_log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  const existing = getAIUsageHistory();
  const updated = [nextEntry, ...existing].slice(0, 60);
  try {
    localStorage.setItem(AI_USAGE_HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
  return updated;
}

export function clearAIUsageHistory(): void {
  try {
    localStorage.removeItem(AI_USAGE_HISTORY_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (isSupabaseConfigured) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error(
        'Administrator session required. Please sign in at /admin-login to use the AI Creative Assistant.'
      );
    }
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  return headers;
}

export interface AIProviderStatusResponse {
  configured: boolean;
  provider: string;
  textModel: string;
  imageModel: string;
  highResImageModel: string;
  rateLimitPerMinute: number;
  cooldownMs: number;
  message: string;
}

export async function fetchAIProviderStatus(): Promise<AIProviderStatusResponse> {
  const headers = await getAdminAuthHeaders();
  const res = await fetch('/api/admin/ai/status', {
    method: 'GET',
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      'AI backend endpoint (/api/admin/ai/status) is not reachable on this host. Run the full-stack server or configure server-side functions.'
    );
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to check AI provider status.');
  }
  return data as AIProviderStatusResponse;
}

export interface AIWriteRequestParams {
  task: string;
  action?: 'generate' | 'regenerate' | 'improve' | 'shorter' | 'longer' | 'grammar' | 'tone';
  topicOrText: string;
  currentDraft?: string;
  targetAudience?: string;
  tone?: string;
  desiredLength?: string;
  keywords?: string;
  language?: string;
  additionalInstructions?: string;
  brandProfile?: AIBrandProfile;
}

export async function generateWrittenContent(params: AIWriteRequestParams): Promise<{
  result: string;
  model: string;
  timestamp: string;
}> {
  const headers = await getAdminAuthHeaders();
  const brandProfile = params.brandProfile || getSavedBrandProfile();

  const res = await fetch('/api/admin/ai/write', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...params,
      brandProfile,
    }),
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      'Server-side AI endpoint (/api/admin/ai/write) is unavailable. Ensure GEMINI_API_KEY and the backend server are running.'
    );
  }

  const data = await res.json();
  if (!res.ok) {
    recordAIUsageHistory({
      workspace: 'writing',
      taskLabel: `${params.task} (${params.action || 'generate'})`,
      model: 'gemini-3.8-flash',
      status: 'error',
      summary: data.error || 'Request failed',
    });
    throw new Error(data.error || 'Failed to generate written content.');
  }

  recordAIUsageHistory({
    workspace: 'writing',
    taskLabel: `${params.task} (${params.action || 'generate'})`,
    model: data.model || 'gemini-3.8-flash',
    status: 'success',
    summary: (data.result || '').slice(0, 120),
  });

  return data;
}

export interface AIServiceContentParams {
  category: string;
  serviceName: string;
  targetAudience?: string;
  mainBenefit?: string;
  keywords?: string;
  tone?: string;
  roughDescription?: string;
  priceDetails?: string;
  deliveryDetails?: string;
  brandProfile?: AIBrandProfile;
}

export async function generateStructuredServiceContent(
  params: AIServiceContentParams
): Promise<{
  data: GeneratedServiceAIContent;
  model: string;
  timestamp: string;
}> {
  const headers = await getAdminAuthHeaders();
  const brandProfile = params.brandProfile || getSavedBrandProfile();

  const res = await fetch('/api/admin/ai/service-content', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...params,
      brandProfile,
    }),
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Server-side AI endpoint (/api/admin/ai/service-content) is unavailable.');
  }

  const data = await res.json();
  if (!res.ok) {
    recordAIUsageHistory({
      workspace: 'service',
      taskLabel: `Service Generator: ${params.serviceName || params.category}`,
      model: 'gemini-3.8-flash',
      status: 'error',
      summary: data.error || 'Service generation failed',
    });
    throw new Error(data.error || 'Failed to generate service listing content.');
  }

  recordAIUsageHistory({
    workspace: 'service',
    taskLabel: `Service Generator: ${data.data?.title || params.serviceName}`,
    model: data.model || 'gemini-3.8-flash',
    status: 'success',
    summary: data.data?.shortDescription || 'Structured service content generated',
  });

  return data;
}

export interface AIPortfolioContentParams {
  projectTitle: string;
  category: string;
  objective?: string;
  clientOrIndustry?: string;
  designStyle?: string;
  toolsUsed?: string;
  existingNotes?: string;
  keywords?: string;
  brandProfile?: AIBrandProfile;
}

export async function generateStructuredPortfolioContent(
  params: AIPortfolioContentParams
): Promise<{
  data: GeneratedPortfolioAIContent;
  model: string;
  timestamp: string;
}> {
  const headers = await getAdminAuthHeaders();
  const brandProfile = params.brandProfile || getSavedBrandProfile();

  const res = await fetch('/api/admin/ai/portfolio-content', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...params,
      brandProfile,
    }),
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Server-side AI endpoint (/api/admin/ai/portfolio-content) is unavailable.');
  }

  const data = await res.json();
  if (!res.ok) {
    recordAIUsageHistory({
      workspace: 'portfolio',
      taskLabel: `Portfolio Generator: ${params.projectTitle || params.category}`,
      model: 'gemini-3.8-flash',
      status: 'error',
      summary: data.error || 'Portfolio generation failed',
    });
    throw new Error(data.error || 'Failed to generate portfolio project content.');
  }

  recordAIUsageHistory({
    workspace: 'portfolio',
    taskLabel: `Portfolio Generator: ${data.data?.title || params.projectTitle}`,
    model: data.model || 'gemini-3.8-flash',
    status: 'success',
    summary: data.data?.shortSummary || 'Structured portfolio case study generated',
  });

  return data;
}

export async function refineAIImagePrompt(params: {
  prompt: string;
  imageType: string;
  visualStyle: string;
  aspectRatio: string;
  brandColors?: string;
  textToInclude?: string;
}): Promise<{ refinedPrompt: string; model: string }> {
  const headers = await getAdminAuthHeaders();
  const res = await fetch('/api/admin/ai/refine-prompt', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Server-side AI endpoint (/api/admin/ai/refine-prompt) is unavailable.');
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to refine image prompt.');
  }
  return data;
}

export interface AIImageGenerationParams {
  prompt: string;
  imageType: string;
  visualStyle: string;
  aspectRatio: '1:1' | '16:9' | '4:3' | '3:4' | '9:16';
  imageSize?: '1K' | '2K' | '4K';
  brandColors?: string;
  textToInclude?: string;
  referenceImageBase64?: string;
  referenceImageMimeType?: string;
}

export interface AIImageGenerationResult {
  imageDataUrl: string;
  mimeType: string;
  model: string;
  aspectRatio: string;
  imageSize: string;
  compiledPrompt: string;
  notes?: string;
  timestamp: string;
}

export async function generateAIImage(
  params: AIImageGenerationParams
): Promise<AIImageGenerationResult> {
  const headers = await getAdminAuthHeaders();
  const res = await fetch('/api/admin/ai/image', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Server-side AI image endpoint (/api/admin/ai/image) is unavailable.');
  }

  const data = await res.json();
  if (!res.ok) {
    recordAIUsageHistory({
      workspace: 'image',
      taskLabel: `${params.imageType} (${params.aspectRatio})`,
      model: params.imageSize && params.imageSize !== '1K' ? 'gemini-nano-banana-2.1' : 'gemini-3.1-flash-lite-image',
      status: 'error',
      summary: data.error || 'Image generation failed',
    });
    throw new Error(data.error || 'Failed to generate image.');
  }

  recordAIUsageHistory({
    workspace: 'image',
    taskLabel: `${params.imageType} (${params.aspectRatio} · ${params.imageSize || '1K'})`,
    model: data.model || 'gemini-3.1-flash-lite-image',
    status: 'success',
    summary: params.prompt.slice(0, 120),
  });

  return data as AIImageGenerationResult;
}

export function dataUrlToFile(dataUrl: string, fileName: string): File {
  const [header, base64Data] = dataUrl.split(',');
  const mimeMatch = header?.match(/:(.*?);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
  const binaryString = atob(base64Data || '');
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new File([bytes], fileName, { type: mimeType });
}

export async function saveGeneratedImageToMediaLibrary(params: {
  imageDataUrl: string;
  title: string;
  targetBucket: 'service-media' | 'portfolio-media';
  description?: string;
  tags?: string[];
}): Promise<MediaAsset> {
  const safeSlug =
    params.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'ai-studio-asset';
  const fileName = `${safeSlug}-${Date.now()}.png`;
  const file = dataUrlToFile(params.imageDataUrl, fileName);

  return uploadMediaAssetAdmin({
    file,
    targetBucket: params.targetBucket,
    title: params.title,
    description: params.description || 'AI Image Studio generated visual asset',
    tags: params.tags || ['ai-studio', params.targetBucket],
    isPublic: true,
  });
}

// ============================================================================
// QUOTATIONS & ESTIMATES STORAGE LAYER (SUPABASE + LOCAL FALLBACK)
// ============================================================================
export function inferQuotationDocumentType(
  record: Pick<QuotationRecord, 'documentType' | 'quotationNumber'>
): QuotationDocumentType {
  if (record.documentType === 'Estimate' || record.documentType === 'Quotation') {
    return record.documentType;
  }
  const num = String(record.quotationNumber || '').toUpperCase();
  if (num.startsWith('PE-EST') || num.startsWith('EST-')) {
    return 'Estimate';
  }
  return 'Quotation';
}

export function generateDocumentNumber(docType: QuotationDocumentType, version = 1): string {
  const prefix = docType === 'Estimate' ? 'PE-EST' : 'PE-QTN';
  const year = new Date().getFullYear();
  const seq = String(Math.floor(100 + Math.random() * 900));
  return version > 1 ? `${prefix}-${year}-${seq}-v${version}` : `${prefix}-${year}-${seq}`;
}

function getLocalQuotations(): QuotationRecord[] {
  try {
    const raw = localStorage.getItem(QUOTATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setLocalQuotations(list: QuotationRecord[]): void {
  try {
    localStorage.setItem(QUOTATIONS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Ignore quota errors
  }
}

function computeEffectiveQuotationStatus(q: QuotationRecord): QuotationStatus {
  if (q.status === 'Sent' || q.status === 'Draft') {
    if (q.expiryDate) {
      const exp = new Date(q.expiryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (!Number.isNaN(exp.getTime()) && exp < today) {
        return 'Expired';
      }
    }
  }
  return q.status;
}

function mapSupabaseQuotationRow(row: Record<string, any>): QuotationRecord {
  const quotationNumber = String(row.quotation_number || '');
  const documentType = inferQuotationDocumentType({
    documentType: row.document_type,
    quotationNumber,
  });
  return {
    id: String(row.id),
    quotationNumber,
    documentType,
    version: Number(row.version) || 1,
    parentQuotationId: row.parent_quotation_id ? String(row.parent_quotation_id) : undefined,
    revisionHistory: Array.isArray(row.revision_history) ? row.revision_history : undefined,
    inquiryId: row.inquiry_id ? String(row.inquiry_id) : undefined,
    clientId: String(row.client_id || ''),
    clientUserId: String(row.client_user_id || ''),
    clientName: String(row.client_name || ''),
    clientEmail: String(row.client_email || ''),
    projectTitle: String(row.project_title || ''),
    serviceCategory: String(row.service_category || 'Graphic Design'),
    scopeSummary: String(row.scope_summary || ''),
    deliverables: String(row.deliverables || ''),
    estimatedTimeline: String(row.estimated_timeline || ''),
    issueDate: String(row.issue_date || ''),
    expiryDate: String(row.expiry_date || ''),
    lineItems: Array.isArray(row.line_items) ? row.line_items : [],
    subtotal: Number(row.subtotal) || 0,
    discount: Number(row.discount) || 0,
    taxRate: Number(row.tax_rate) || 0,
    taxAmount: Number(row.tax_amount) || 0,
    total: Number(row.total) || 0,
    currency: 'INR',
    status: (row.status || 'Draft') as QuotationStatus,
    termsAndConditions: String(row.terms_and_conditions || ''),
    notes: row.notes ? String(row.notes) : undefined,
    convertedProjectId: row.converted_project_id ? String(row.converted_project_id) : undefined,
    convertedInvoiceId: row.converted_invoice_id ? String(row.converted_invoice_id) : undefined,
    clientDecisionAt: row.client_decision_at ? String(row.client_decision_at) : undefined,
    clientDecisionBy: row.client_decision_by ? String(row.client_decision_by) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchAllQuotationsAdmin(): Promise<QuotationRecord[]> {
  const localList = getLocalQuotations();
  const mergedMap = new Map<string, QuotationRecord>();

  for (const item of localList) {
    mergedMap.set(item.id, {
      ...item,
      documentType: inferQuotationDocumentType(item),
      version: item.version || 1,
      status: computeEffectiveQuotationStatus(item),
    });
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const mapped = mapSupabaseQuotationRow(row);
          mergedMap.set(mapped.id, {
            ...mapped,
            status: computeEffectiveQuotationStatus(mapped),
          });
        }
        setLocalQuotations(Array.from(mergedMap.values()));
      }
    } catch {
      // Fallback to local records if table is not yet migrated
    }
  }

  return Array.from(mergedMap.values()).sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
}

export async function fetchClientQuotations(
  clientUserId: string,
  clientEmail?: string
): Promise<QuotationRecord[]> {
  const all = await fetchAllQuotationsAdmin();
  const emailLower = (clientEmail || '').toLowerCase();
  return all.filter((q) => {
    if (q.status === 'Draft' || q.status === 'Archived') return false;
    if (clientUserId && q.clientUserId && q.clientUserId === clientUserId) return true;
    if (emailLower && q.clientEmail && q.clientEmail.toLowerCase() === emailLower) return true;
    return false;
  });
}

async function trySyncQuotationToSupabase(record: QuotationRecord): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const payload: Record<string, any> = {
      id: record.id,
      quotation_number: record.quotationNumber,
      document_type: inferQuotationDocumentType(record),
      version: record.version || 1,
      parent_quotation_id: record.parentQuotationId || null,
      revision_history: record.revisionHistory || [],
      inquiry_id: record.inquiryId || null,
      client_id: record.clientId || null,
      client_user_id: record.clientUserId || null,
      client_name: record.clientName,
      client_email: record.clientEmail,
      project_title: record.projectTitle,
      service_category: record.serviceCategory,
      scope_summary: record.scopeSummary,
      deliverables: record.deliverables,
      estimated_timeline: record.estimatedTimeline,
      issue_date: record.issueDate,
      expiry_date: record.expiryDate,
      line_items: record.lineItems,
      subtotal: record.subtotal,
      discount: record.discount,
      tax_rate: record.taxRate,
      tax_amount: record.taxAmount,
      total: record.total,
      currency: 'INR',
      status: record.status,
      terms_and_conditions: record.termsAndConditions,
      notes: record.notes || '',
      converted_project_id: record.convertedProjectId || null,
      converted_invoice_id: record.convertedInvoiceId || null,
      client_decision_at: record.clientDecisionAt || null,
      client_decision_by: record.clientDecisionBy || null,
      updated_at: record.updatedAt || new Date().toISOString(),
    };
    await supabase.from('quotations').upsert(payload);
  } catch {
    // Non-fatal if quotations table is not yet created in Supabase
  }
}

export async function saveQuotationAdmin(
  record: Omit<QuotationRecord, 'id' | 'createdAt' | 'updatedAt'>,
  existingId?: string
): Promise<QuotationRecord> {
  const list = getLocalQuotations();
  const now = new Date().toISOString();
  const docType = inferQuotationDocumentType(record);

  if (existingId) {
    const idx = list.findIndex((q) => q.id === existingId);
    const updatedRecord: QuotationRecord = {
      ...(idx >= 0 ? list[idx] : {}),
      ...record,
      documentType: docType,
      version: record.version || (idx >= 0 ? list[idx].version || 1 : 1),
      id: existingId,
      createdAt: idx >= 0 ? list[idx].createdAt : now,
      updatedAt: now,
    };
    if (idx >= 0) {
      list[idx] = updatedRecord;
    } else {
      list.unshift(updatedRecord);
    }
    setLocalQuotations(list);
    await trySyncQuotationToSupabase(updatedRecord);
    await logAdminActivity(
      `Updated ${docType}`,
      docType.toLowerCase(),
      updatedRecord.id,
      `${updatedRecord.quotationNumber} (${updatedRecord.status}) — ₹${updatedRecord.total.toLocaleString('en-IN')}`
    );
    return updatedRecord;
  }

  const newRecord: QuotationRecord = {
    ...record,
    documentType: docType,
    version: record.version || 1,
    id: `quo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: now,
    updatedAt: now,
  };
  setLocalQuotations([newRecord, ...list]);
  await trySyncQuotationToSupabase(newRecord);
  await logAdminActivity(
    `Created ${docType}`,
    docType.toLowerCase(),
    newRecord.id,
    `${newRecord.quotationNumber} (${newRecord.status}) — ₹${newRecord.total.toLocaleString('en-IN')}`
  );
  return newRecord;
}

export function checkQuotationDeleteEligibilityAdmin(
  quote: QuotationRecord
): QuotationDeleteEligibility {
  const docType = inferQuotationDocumentType(quote);
  const isConverted = Boolean(quote.convertedProjectId || quote.convertedInvoiceId);

  if (isConverted) {
    return {
      quotationId: quote.id,
      quotationNumber: quote.quotationNumber,
      documentType: docType,
      canHardDelete: false,
      status: quote.status,
      isConverted: true,
      reason: `This ${docType.toLowerCase()} has already been converted into an active Project or Invoice. Permanent deletion is blocked to preserve financial and project audit history. You can Archive it instead.`,
    };
  }

  if (quote.status !== 'Draft') {
    return {
      quotationId: quote.id,
      quotationNumber: quote.quotationNumber,
      documentType: docType,
      canHardDelete: false,
      status: quote.status,
      isConverted: false,
      reason: `Only Draft ${docType.toLowerCase()}s can be permanently deleted. Because this ${docType.toLowerCase()} is currently marked "${quote.status}", please Archive it or mark it as Expired/Rejected to preserve client proposal records.`,
    };
  }

  return {
    quotationId: quote.id,
    quotationNumber: quote.quotationNumber,
    documentType: docType,
    canHardDelete: true,
    status: quote.status,
    isConverted: false,
    reason: `This ${docType.toLowerCase()} is an unconverted Draft and can be permanently deleted.`,
  };
}

export async function deleteQuotationAdmin(id: string): Promise<void> {
  const list = getLocalQuotations();
  const target = list.find((q) => q.id === id);
  if (target) {
    const check = checkQuotationDeleteEligibilityAdmin(target);
    if (!check.canHardDelete) {
      throw new Error(check.reason);
    }
  }

  const nextList = list.filter((q) => q.id !== id);
  setLocalQuotations(nextList);

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('quotations').delete().eq('id', id);
      if (error && !isMissingSchemaError(error)) {
        // Ignore if table not created yet
      }
    } catch {
      // Non-fatal
    }
  }

  if (target) {
    const docType = inferQuotationDocumentType(target);
    await logAdminActivity(
      `Deleted Draft ${docType}`,
      docType.toLowerCase(),
      id,
      `${target.quotationNumber} (${target.clientName})`
    );
  }
}

export async function archiveQuotationAdmin(
  quote: QuotationRecord,
  targetStatus: 'Archived' | 'Expired' | 'Rejected' = 'Archived',
  reason?: string
): Promise<QuotationRecord> {
  const docType = inferQuotationDocumentType(quote);
  const updatedNotes = reason
    ? `${quote.notes ? `${quote.notes}\n` : ''}[${targetStatus.toUpperCase()} ${new Date().toISOString().split('T')[0]}]: ${reason}`
    : quote.notes;

  const saved = await saveQuotationAdmin(
    {
      ...quote,
      documentType: docType,
      status: targetStatus,
      notes: updatedNotes,
    },
    quote.id
  );

  await logAdminActivity(
    `Marked ${docType} as ${targetStatus}`,
    docType.toLowerCase(),
    quote.id,
    `${quote.quotationNumber} — ${quote.clientName}${reason ? ` (${reason})` : ''}`
  );

  return saved;
}

export async function createQuotationRevisionAdmin(
  existingQuote: QuotationRecord,
  updatedFields: Omit<QuotationRecord, 'id' | 'createdAt' | 'updatedAt'>,
  revisionSummary = 'Updated scope and pricing revision'
): Promise<QuotationRecord> {
  const docType = inferQuotationDocumentType(updatedFields);
  const currentVersion = existingQuote.version || 1;
  const nextVersion = currentVersion + 1;

  const snapshot: QuotationRevisionSnapshot = {
    version: currentVersion,
    quotationNumber: existingQuote.quotationNumber,
    total: existingQuote.total,
    status: existingQuote.status,
    updatedAt: existingQuote.updatedAt || new Date().toISOString(),
    summary: revisionSummary,
  };

  const baseNumber = existingQuote.quotationNumber.replace(/-v\d+$/i, '');
  const nextQuotationNumber = `${baseNumber}-v${nextVersion}`;
  const priorHistory = Array.isArray(existingQuote.revisionHistory)
    ? existingQuote.revisionHistory
    : [];

  const saved = await saveQuotationAdmin(
    {
      ...updatedFields,
      documentType: docType,
      quotationNumber: nextQuotationNumber,
      version: nextVersion,
      parentQuotationId: existingQuote.parentQuotationId || existingQuote.id,
      revisionHistory: [...priorHistory, snapshot],
    },
    existingQuote.id
  );

  await logAdminActivity(
    `Created ${docType} Revision v${nextVersion}`,
    docType.toLowerCase(),
    saved.id,
    `${nextQuotationNumber} (from ${existingQuote.quotationNumber}) — ₹${saved.total.toLocaleString('en-IN')}`
  );

  return saved;
}

export async function duplicateQuotationAdmin(
  source: QuotationRecord,
  targetDocType?: QuotationDocumentType
): Promise<QuotationRecord> {
  const docType = targetDocType || inferQuotationDocumentType(source);
  const today = new Date().toISOString().split('T')[0];
  const expiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const freshNumber = generateDocumentNumber(docType, 1);

  return saveQuotationAdmin({
    quotationNumber: freshNumber,
    documentType: docType,
    version: 1,
    inquiryId: source.inquiryId,
    clientId: source.clientId,
    clientUserId: source.clientUserId,
    clientName: source.clientName,
    clientEmail: source.clientEmail,
    projectTitle: `${source.projectTitle}${targetDocType && targetDocType !== inferQuotationDocumentType(source) ? '' : ' (Copy)'}`,
    serviceCategory: source.serviceCategory,
    scopeSummary: source.scopeSummary,
    deliverables: source.deliverables,
    estimatedTimeline: source.estimatedTimeline,
    issueDate: today,
    expiryDate: expiry,
    lineItems: source.lineItems.map((li) => ({ ...li })),
    subtotal: source.subtotal,
    discount: source.discount,
    taxRate: source.taxRate,
    taxAmount: source.taxAmount,
    total: source.total,
    currency: 'INR',
    status: 'Draft',
    termsAndConditions: source.termsAndConditions,
    notes: source.notes,
  });
}

export async function clientRespondToQuotation(params: {
  quotationId: string;
  decision: 'Accepted' | 'Rejected';
  clientEmail: string;
  clientUserId: string;
}): Promise<QuotationRecord> {
  const list = getLocalQuotations();
  const idx = list.findIndex((q) => q.id === params.quotationId);
  if (idx < 0) {
    throw new Error('Quotation record not found.');
  }
  const target = list[idx];
  const emailMatch =
    params.clientEmail &&
    target.clientEmail.toLowerCase() === params.clientEmail.toLowerCase();
  const uidMatch =
    params.clientUserId && target.clientUserId && target.clientUserId === params.clientUserId;

  if (!emailMatch && !uidMatch) {
    throw new Error('Unauthorized: You can only respond to quotations issued to your account.');
  }

  const updated: QuotationRecord = {
    ...target,
    status: params.decision,
    clientDecisionAt: new Date().toISOString(),
    clientDecisionBy: params.clientEmail || params.clientUserId,
    updatedAt: new Date().toISOString(),
  };
  list[idx] = updated;
  setLocalQuotations(list);
  await trySyncQuotationToSupabase(updated);
  return updated;
}

