import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { uploadMediaAssetAdmin } from './crmService';
import {
  AIBrandProfile,
  AIUsageHistoryEntry,
  GeneratedServiceAIContent,
  GeneratedPortfolioAIContent,
  QuotationRecord,
  QuotationStatus,
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
// QUOTATIONS & PROJECT CONVERSION STORAGE LAYER (SUPABASE + LOCAL FALLBACK)
// ============================================================================
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

export async function fetchAllQuotationsAdmin(): Promise<QuotationRecord[]> {
  const local = getLocalQuotations().map((q) => ({
    ...q,
    status: computeEffectiveQuotationStatus(q),
  }));
  return local.sort(
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
    if (q.status === 'Draft') return false;
    if (clientUserId && q.clientUserId && q.clientUserId === clientUserId) return true;
    if (emailLower && q.clientEmail && q.clientEmail.toLowerCase() === emailLower) return true;
    return false;
  });
}

export async function saveQuotationAdmin(
  record: Omit<QuotationRecord, 'id' | 'createdAt' | 'updatedAt'>,
  existingId?: string
): Promise<QuotationRecord> {
  const list = getLocalQuotations();
  const now = new Date().toISOString();

  if (existingId) {
    const idx = list.findIndex((q) => q.id === existingId);
    const updatedRecord: QuotationRecord = {
      ...(idx >= 0 ? list[idx] : {}),
      ...record,
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
    return updatedRecord;
  }

  const newRecord: QuotationRecord = {
    ...record,
    id: `quo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: now,
    updatedAt: now,
  };
  setLocalQuotations([newRecord, ...list]);
  return newRecord;
}

export async function deleteQuotationAdmin(id: string): Promise<void> {
  const list = getLocalQuotations().filter((q) => q.id !== id);
  setLocalQuotations(list);
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
  return updated;
}
