import {
  supabase,
  isSupabaseConfigured,
  handleSupabaseError,
  isMissingSchemaError,
} from '../lib/supabaseClient';
import {
  ClientRecord,
  ServiceItem,
  PortfolioItem,
  InquiryRecord,
  InquiryStatus,
  ProjectRecord,
  TaskRecord,
  DeliverableFile,
  InvoiceRecord,
  InvoiceLineItem,
  PaymentRecord,
  ProjectMessage,
  NotificationRecord,
  NotificationType,
  PublicSettings,
  PrivateSettings,
  ActivityLog,
  MediaAsset,
  MediaBucket,
  MediaCategory,
} from '../types/crm';
import {
  SEED_SERVICES,
  SEED_PORTFOLIO,
  DEFAULT_PUBLIC_SETTINGS,
  DEFAULT_PRIVATE_SETTINGS,
  createStudioArtworkDataUri,
} from '../utils/seedData';
import { slugify } from '../utils/formatters';
import {
  validateMediaFile,
  buildSafeStoragePath,
  detectMediaCategory,
  getFileExtension,
  extractMediaDimensions,
} from '../utils/mediaValidation';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toNullableUuid(value: string | undefined | null): string | null {
  const trimmed = String(value || '').trim();
  return UUID_REGEX.test(trimmed) ? trimmed : null;
}

function truncate(str: string | undefined | null, max: number): string {
  return String(str || '').trim().slice(0, max);
}

async function getCurrentUser() {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

function extractNotNullColumn(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const msg = String((error as { message?: unknown }).message || '');
  const match = msg.match(/null value in column "([^"]+)"/i);
  return match ? match[1] : null;
}

function extractMissingColumn(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const msg = String((error as { message?: unknown }).message || '');
  const m1 = msg.match(/Could not find the '([^']+)' column/i);
  if (m1) return m1[1];
  const m2 = msg.match(/column "([^"]+)" of relation/i);
  if (m2) return m2[1];
  const m3 = msg.match(/column [a-z0-9_]+\.([a-z0-9_]+) does not exist/i);
  if (m3) return m3[1];
  const m4 = msg.match(/column "([^"]+)" does not exist/i);
  if (m4) return m4[1];
  return null;
}

function resolveFallbackValueForColumn(
  col: string,
  currentPayload: Record<string, any>,
  fallbacks: Record<string, any>
): any {
  if (col in fallbacks && fallbacks[col] !== undefined && fallbacks[col] !== null) {
    return fallbacks[col];
  }
  const lower = col.toLowerCase();
  if (lower === 'name' || lower.endsWith('_name') || lower === 'title') {
    return (
      fallbacks.name ||
      currentPayload.title ||
      currentPayload.full_name ||
      currentPayload.file_name ||
      'Untitled'
    );
  }
  if (
    lower.includes('price') ||
    lower.includes('amount') ||
    lower.includes('cost') ||
    lower.includes('rate') ||
    lower.includes('budget') ||
    lower.includes('order') ||
    lower.includes('size')
  ) {
    return Number(currentPayload.starting_price ?? currentPayload.budget ?? 0) || 0;
  }
  if (
    lower.startsWith('is_') ||
    lower === 'active' ||
    lower === 'published' ||
    lower === 'featured'
  ) {
    return Boolean(currentPayload.published ?? true);
  }
  if (lower.includes('image') || lower.includes('url') || lower.includes('cover')) {
    return String(currentPayload.image_url || currentPayload.cover_image || '');
  }
  return String(currentPayload.title || currentPayload.description || 'Default');
}

async function adaptiveInsertRow(
  table: string,
  initialPayload: Record<string, any>,
  fallbacks: Record<string, any>,
  context: string
): Promise<string> {
  const workingPayload: Record<string, any> = { ...initialPayload };
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 10; attempt++) {
    const { data, error } = await supabase
      .from(table)
      .insert(workingPayload)
      .select('id')
      .single();

    if (!error && data) {
      return String(data.id);
    }

    lastError = error;

    const notNullCol = extractNotNullColumn(error);
    if (notNullCol && workingPayload[notNullCol] == null) {
      workingPayload[notNullCol] = resolveFallbackValueForColumn(
        notNullCol,
        workingPayload,
        fallbacks
      );
      continue;
    }

    const missingCol = extractMissingColumn(error);
    if (missingCol && missingCol in workingPayload) {
      delete workingPayload[missingCol];
      continue;
    }

    break;
  }

  handleSupabaseError(lastError, context);
}

async function adaptiveUpdateRow(
  table: string,
  id: string,
  initialPayload: Record<string, any>,
  fallbacks: Record<string, any>,
  context: string
): Promise<void> {
  const workingPayload: Record<string, any> = { ...initialPayload };
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 10; attempt++) {
    const { error } = await supabase.from(table).update(workingPayload).eq('id', id);

    if (!error) {
      return;
    }

    lastError = error;

    const notNullCol = extractNotNullColumn(error);
    if (notNullCol && workingPayload[notNullCol] == null) {
      workingPayload[notNullCol] = resolveFallbackValueForColumn(
        notNullCol,
        workingPayload,
        fallbacks
      );
      continue;
    }

    const missingCol = extractMissingColumn(error);
    if (missingCol && missingCol in workingPayload) {
      delete workingPayload[missingCol];
      continue;
    }

    break;
  }

  handleSupabaseError(lastError, context);
}

// ============================================================================
// ROW MAPPERS (PostgreSQL snake_case -> TypeScript camelCase)
// ============================================================================
function mapServiceRow(row: Record<string, any>, idx = 0): ServiceItem {
  const title = String(row.title || row.name || row.service_name || 'Creative Service');
  const category = String(row.category || 'Graphic Design');
  const startingPrice = Number(row.starting_price ?? row.price ?? 0) || 0;
  const isCustomQuote = Boolean(row.is_custom_quote ?? startingPrice === 0);
  const priceDisplay = String(
    row.price_display ||
      (isCustomQuote ? 'Custom quote' : `₹${startingPrice.toLocaleString('en-IN')}/design`)
  );
  return {
    id: String(row.id),
    title,
    slug: String(row.slug || slugify(title) || `service-${idx + 1}`),
    category,
    description: String(row.description || ''),
    startingPrice,
    priceDisplay,
    pricingUnit: String(row.pricing_unit || 'design'),
    isCustomQuote,
    deliverablesSummary: String(
      row.deliverables_summary || 'High-resolution export and studio revisions included.'
    ),
    turnaroundTime: String(row.turnaround_time || '24–48 hours'),
    imageUrl: String(row.image_url || createStudioArtworkDataUri(title, category, '#F18A45')),
    videoPreviewUrl: String(row.video_preview_url || ''),
    mediaUrls: Array.isArray(row.media_urls) ? row.media_urls.map(String) : [],
    published: row.published !== undefined ? Boolean(row.published) : Boolean(row.is_active ?? true),
    sortOrder: Number(row.sort_order) || idx + 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPortfolioRow(row: Record<string, any>, idx = 0): PortfolioItem {
  const title = String(row.title || row.name || 'Studio Project');
  const category = (row.category || 'Graphic Design') as PortfolioItem['category'];
  const coverImage = String(
    row.cover_image || row.image_url || createStudioArtworkDataUri(title, category, '#172333')
  );
  const videoUrl = String(row.video_url || '');
  const detectedType = videoUrl
    ? 'video'
    : detectMediaCategory('', coverImage) === 'pdf'
    ? 'pdf'
    : 'image';
  return {
    id: String(row.id),
    title,
    slug: String(row.slug || slugify(title) || `portfolio-${idx + 1}`),
    category,
    description: String(row.description || ''),
    coverImage,
    videoUrl,
    mediaType: (row.media_type || detectedType) as 'image' | 'video' | 'pdf',
    galleryUrls: Array.isArray(row.gallery_urls) ? row.gallery_urls.map(String) : [],
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    projectUrl: String(row.project_url || ''),
    featured: Boolean(row.featured),
    published: row.published !== undefined ? Boolean(row.published) : true,
    isSampleContent: Boolean(row.is_sample_content),
    sortOrder: Number(row.sort_order) || idx + 1,
    metricsSummary: String(row.metrics_summary || ''),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInquiryRow(row: Record<string, any>): InquiryRecord {
  return {
    id: String(row.id),
    fullName: String(row.full_name || row.name || ''),
    email: String(row.email || ''),
    phone: String(row.phone || ''),
    companyName: String(row.company_name || ''),
    serviceRequired: String(row.service_required || row.service || ''),
    budgetRange: String(row.budget_range || row.budget || ''),
    preferredDeadline: String(row.preferred_deadline || ''),
    description: String(row.description || row.message || ''),
    referenceFileUrl: String(row.reference_file_url || ''),
    privacyConsent: row.privacy_consent !== undefined ? Boolean(row.privacy_consent) : true,
    status: (row.status || 'New') as InquiryStatus,
    leadSource: String(row.lead_source || 'Website Inquiry Form'),
    internalNotes: String(row.internal_notes || ''),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapClientRow(row: Record<string, any>): ClientRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id || ''),
    fullName: String(row.full_name || row.name || ''),
    email: String(row.email || ''),
    phone: String(row.phone || ''),
    companyName: String(row.company_name || ''),
    country: String(row.country || 'India'),
    preferredContact: (row.preferred_contact || 'WhatsApp') as ClientRecord['preferredContact'],
    accountStatus: (row.account_status || 'active') as ClientRecord['accountStatus'],
    adminNotes: String(row.admin_notes || ''),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProjectRow(row: Record<string, any>): ProjectRecord {
  return {
    id: String(row.id),
    clientId: String(row.client_id || ''),
    clientUserId: String(row.client_user_id || ''),
    clientName: String(row.client_name || ''),
    clientEmail: String(row.client_email || ''),
    title: String(row.title || row.name || ''),
    description: String(row.description || ''),
    serviceType: String(row.service_type || ''),
    brief: String(row.brief || ''),
    budget: Number(row.budget) || 0,
    startDate: String(row.start_date || ''),
    deadline: String(row.deadline || ''),
    priority: (row.priority || 'Medium') as ProjectRecord['priority'],
    status: (row.status || 'Planned') as ProjectRecord['status'],
    progress: Number(row.progress) || 0,
    latestUpdate: String(row.latest_update || ''),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTaskRow(row: Record<string, any>): TaskRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id || ''),
    clientUserId: String(row.client_user_id || ''),
    title: String(row.title || ''),
    description: String(row.description || ''),
    status: (row.status || 'To Do') as TaskRecord['status'],
    priority: (row.priority || 'Medium') as TaskRecord['priority'],
    dueDate: String(row.due_date || ''),
    visibility: (row.visibility || 'client') as TaskRecord['visibility'],
    createdBy: String(row.created_by || ''),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFileRow(row: Record<string, any>): DeliverableFile {
  return {
    id: String(row.id),
    projectId: String(row.project_id || ''),
    clientUserId: String(row.client_user_id || ''),
    fileName: String(row.file_name || ''),
    fileType: String(row.file_type || 'application/octet-stream'),
    fileSize: Number(row.file_size) || 0,
    category: (row.category || 'Deliverable') as DeliverableFile['category'],
    downloadUrl: String(row.download_url || ''),
    storagePath: String(row.storage_path || ''),
    storageBucket: (row.storage_bucket || 'private-project-files') as MediaBucket,
    description: String(row.description || ''),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    versionLabel: String(row.version_label || 'v1.0'),
    uploadedBy: String(row.uploaded_by || ''),
    uploaderName: String(row.uploader_name || ''),
    visibility: (row.visibility || 'client') as DeliverableFile['visibility'],
    createdAt: row.created_at,
  };
}

function mapMediaAssetRow(row: Record<string, any>): MediaAsset {
  return {
    id: String(row.id),
    title: String(row.title || row.original_filename || 'Media Asset'),
    originalFilename: String(row.original_filename || row.title || 'asset'),
    storageBucket: (row.storage_bucket || 'portfolio-media') as MediaBucket,
    storagePath: String(row.storage_path || ''),
    publicUrl: String(row.public_url || ''),
    mimeType: String(row.mime_type || 'application/octet-stream'),
    fileExtension: String(row.file_extension || getFileExtension(row.original_filename || '')),
    mediaCategory: (row.media_category ||
      detectMediaCategory(row.mime_type, row.original_filename || row.public_url)) as MediaCategory,
    fileSize: Number(row.file_size) || 0,
    width: row.width ? Number(row.width) : null,
    height: row.height ? Number(row.height) : null,
    durationSeconds: row.duration_seconds ? Number(row.duration_seconds) : null,
    description: String(row.description || ''),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    isPublic: row.is_public !== undefined ? Boolean(row.is_public) : true,
    serviceId: row.service_id ? String(row.service_id) : undefined,
    portfolioId: row.portfolio_id ? String(row.portfolio_id) : undefined,
    projectId: row.project_id ? String(row.project_id) : undefined,
    clientId: row.client_id ? String(row.client_id) : undefined,
    clientUserId: row.client_user_id ? String(row.client_user_id) : undefined,
    uploadedBy: String(row.uploaded_by || ''),
    uploaderName: String(row.uploader_name || 'Shankar Baluragi'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInvoiceRow(row: Record<string, any>): InvoiceRecord {
  return {
    id: String(row.id),
    invoiceNumber: String(row.invoice_number || ''),
    clientId: String(row.client_id || ''),
    clientUserId: String(row.client_user_id || ''),
    clientName: String(row.client_name || ''),
    clientEmail: String(row.client_email || ''),
    projectId: String(row.project_id || ''),
    projectTitle: String(row.project_title || ''),
    issueDate: String(row.issue_date || ''),
    dueDate: String(row.due_date || ''),
    itemsSummary: String(row.items_summary || ''),
    subtotal: Number(row.subtotal) || 0,
    discount: Number(row.discount) || 0,
    taxRate: Number(row.tax_rate) || 0,
    taxAmount: Number(row.tax_amount) || 0,
    total: Number(row.total) || 0,
    amountPaid: Number(row.amount_paid) || 0,
    balanceDue: Number(row.balance_due) || 0,
    currency: 'INR',
    status: (row.status || 'Sent') as InvoiceRecord['status'],
    paymentInstructions: String(row.payment_instructions || ''),
    notes: String(row.notes || ''),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLineItemRow(row: Record<string, any>): InvoiceLineItem {
  return {
    id: String(row.id),
    invoiceId: String(row.invoice_id || ''),
    clientUserId: String(row.client_user_id || ''),
    description: String(row.description || ''),
    quantity: Number(row.quantity) || 1,
    unitPrice: Number(row.unit_price) || 0,
    amount: Number(row.amount) || 0,
    sortOrder: Number(row.sort_order) || 1,
  };
}

function mapPaymentRow(row: Record<string, any>): PaymentRecord {
  return {
    id: String(row.id),
    invoiceId: String(row.invoice_id || ''),
    invoiceNumber: String(row.invoice_number || ''),
    clientId: String(row.client_id || ''),
    clientUserId: String(row.client_user_id || ''),
    clientName: String(row.client_name || ''),
    amount: Number(row.amount) || 0,
    currency: 'INR',
    method: (row.method || 'UPI') as PaymentRecord['method'],
    transactionReference: String(row.transaction_reference || ''),
    verificationMode: (row.verification_mode || 'Admin Recorded') as PaymentRecord['verificationMode'],
    paymentDate: String(row.payment_date || ''),
    notes: String(row.notes || ''),
    recordedBy: String(row.recorded_by || ''),
    createdAt: row.created_at,
  };
}

function mapMessageRow(row: Record<string, any>): ProjectMessage {
  return {
    id: String(row.id),
    projectId: String(row.project_id || ''),
    clientUserId: String(row.client_user_id || ''),
    senderId: String(row.sender_id || ''),
    senderName: String(row.sender_name || ''),
    senderRole: (row.sender_role || 'client') as ProjectMessage['senderRole'],
    content: String(row.content || ''),
    visibility: (row.visibility || 'client') as ProjectMessage['visibility'],
    readByAdmin: Boolean(row.read_by_admin),
    readByClient: Boolean(row.read_by_client),
    createdAt: row.created_at,
  };
}

// ============================================================================
// ACTIVITY AUDIT LOGGING
// ============================================================================
export async function logAdminActivity(
  action: string,
  entityType: string,
  entityId: string,
  details: string
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  try {
    await supabase.from('activity_logs').insert({
      actor_uid: toNullableUuid(user.id),
      actor_email: truncate(user.email || '', 254),
      action: truncate(action, 160),
      entity_type: truncate(entityType, 60),
      entity_id: truncate(entityId, 128),
      details: truncate(details, 1000),
    });
  } catch {
    // Non-fatal audit log
  }
}

export async function fetchActivityLogs(): Promise<ActivityLog[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingSchemaError(error)) return [];
    handleSupabaseError(error, 'fetchActivityLogs');
  }
  return (data || []).map((row) => ({
    id: String(row.id),
    actorUid: String(row.actor_uid || ''),
    actorEmail: String(row.actor_email || ''),
    action: String(row.action || ''),
    entityType: String(row.entity_type || ''),
    entityId: String(row.entity_id || ''),
    details: String(row.details || ''),
    createdAt: row.created_at,
  }));
}

// ============================================================================
// NOTIFICATIONS & USER PROFILE
// ============================================================================
export async function createNotification(params: {
  recipientUserId: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string;
}): Promise<void> {
  const recipientUuid = toNullableUuid(params.recipientUserId);
  if (!isSupabaseConfigured || !recipientUuid) return;
  try {
    await supabase.from('notifications').insert({
      recipient_user_id: recipientUuid,
      type: params.type,
      title: truncate(params.title, 160),
      message: truncate(params.message, 500),
      link: truncate(params.link, 200),
      read: false,
    });
  } catch {
    // Best-effort notification
  }
}

export async function fetchUserNotifications(userId: string): Promise<NotificationRecord[]> {
  const validUuid = toNullableUuid(userId);
  if (!isSupabaseConfigured || !validUuid) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_user_id', validUuid)
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingSchemaError(error)) return [];
    handleSupabaseError(error, 'fetchUserNotifications');
  }
  return (data || []).map((row) => ({
    id: String(row.id),
    recipientUserId: String(row.recipient_user_id || ''),
    type: row.type as NotificationType,
    title: String(row.title || ''),
    message: String(row.message || ''),
    link: String(row.link || ''),
    read: Boolean(row.read),
    createdAt: row.created_at,
  }));
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);

  if (error && !isMissingSchemaError(error)) {
    handleSupabaseError(error, 'markNotificationRead');
  }
}

export async function updateUserProfileDetails(
  userId: string,
  updates: { displayName: string; phone: string; companyName: string }
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: truncate(updates.displayName, 120),
      phone: truncate(updates.phone, 40),
      company_name: truncate(updates.companyName, 150),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) handleSupabaseError(error, 'updateUserProfileDetails');
}

// ============================================================================
// PUBLIC & PRIVATE SETTINGS
// ============================================================================
export async function fetchPublicSettings(): Promise<PublicSettings> {
  if (!isSupabaseConfigured) return DEFAULT_PUBLIC_SETTINGS;
  try {
    const { data, error } = await supabase
      .from('public_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();

    if (error || !data) return DEFAULT_PUBLIC_SETTINGS;
    return {
      businessName: String(data.business_name || DEFAULT_PUBLIC_SETTINGS.businessName),
      ownerName: String(data.owner_name || DEFAULT_PUBLIC_SETTINGS.ownerName),
      tagline: String(data.tagline || DEFAULT_PUBLIC_SETTINGS.tagline),
      businessEmail: String(data.business_email || DEFAULT_PUBLIC_SETTINGS.businessEmail),
      whatsappNumber: String(data.whatsapp_number || ''),
      whatsappDefaultMessage: String(
        data.whatsapp_default_message || DEFAULT_PUBLIC_SETTINGS.whatsappDefaultMessage
      ),
      websiteUrl: String(data.website_url || ''),
      businessAddress: String(data.business_address || ''),
      defaultCurrency: 'INR',
      portfolioVisible: Boolean(data.portfolio_visible),
      updatedAt: data.updated_at,
    };
  } catch {
    return DEFAULT_PUBLIC_SETTINGS;
  }
}

export async function savePublicSettings(data: Omit<PublicSettings, 'updatedAt'>): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('public_settings').upsert({
    id: 'default',
    business_name: truncate(data.businessName || 'Prithvi Editify', 120),
    owner_name: truncate(data.ownerName || 'Shankar Baluragi', 120),
    tagline: truncate(data.tagline, 250),
    business_email: truncate(data.businessEmail, 254),
    whatsapp_number: truncate(data.whatsappNumber, 40),
    whatsapp_default_message: truncate(data.whatsappDefaultMessage, 300),
    website_url: truncate(data.websiteUrl, 250),
    business_address: truncate(data.businessAddress, 300),
    default_currency: 'INR',
    portfolio_visible: Boolean(data.portfolioVisible),
    updated_at: new Date().toISOString(),
  });

  if (error) handleSupabaseError(error, 'savePublicSettings');
  await logAdminActivity('Updated Public Studio Settings', 'settings', 'public', data.businessName);
}

export async function fetchPrivateSettings(): Promise<PrivateSettings> {
  if (!isSupabaseConfigured) return DEFAULT_PRIVATE_SETTINGS;
  try {
    const { data, error } = await supabase
      .from('private_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();

    if (error || !data) return DEFAULT_PRIVATE_SETTINGS;
    return {
      invoicePrefix: String(data.invoice_prefix || DEFAULT_PRIVATE_SETTINGS.invoicePrefix),
      defaultPaymentTerms: String(
        data.default_payment_terms || DEFAULT_PRIVATE_SETTINGS.defaultPaymentTerms
      ),
      defaultPaymentInstructions: String(
        data.default_payment_instructions || DEFAULT_PRIVATE_SETTINGS.defaultPaymentInstructions
      ),
      defaultTaxRate: Number(data.default_tax_rate) || 0,
      enableEmailNotifications: Boolean(data.enable_email_notifications),
      updatedAt: data.updated_at,
    };
  } catch {
    return DEFAULT_PRIVATE_SETTINGS;
  }
}

export async function savePrivateSettings(data: Omit<PrivateSettings, 'updatedAt'>): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('private_settings').upsert({
    id: 'default',
    invoice_prefix: truncate(data.invoicePrefix || 'PE-INV', 20),
    default_payment_terms: truncate(data.defaultPaymentTerms, 500),
    default_payment_instructions: truncate(data.defaultPaymentInstructions, 1000),
    default_tax_rate: Math.min(100, Math.max(0, Number(data.defaultTaxRate) || 0)),
    enable_email_notifications: Boolean(data.enableEmailNotifications),
    updated_at: new Date().toISOString(),
  });

  if (error) handleSupabaseError(error, 'savePrivateSettings');
  await logAdminActivity('Updated Private Admin Settings', 'settings', 'private', `Prefix: ${data.invoicePrefix}`);
}

// ============================================================================
// SERVICES & PRICING
// ============================================================================
export async function fetchPublishedServices(): Promise<ServiceItem[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('published', true)
    .order('sort_order', { ascending: true });

  if (error) {
    // Fallback if pre-existing services table lacks `published` or `sort_order` column
    if (isMissingSchemaError(error)) {
      const fallback = await supabase.from('services').select('*');
      if (!fallback.error && fallback.data && fallback.data.length > 0) {
        return fallback.data.map((r, i) => mapServiceRow(r, i)).filter((s) => s.published);
      }
      return [];
    }
    handleSupabaseError(error, 'fetchPublishedServices');
  }
  return (data || []).map((r, i) => mapServiceRow(r, i));
}

export async function fetchAllServicesAdmin(): Promise<ServiceItem[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    if (isMissingSchemaError(error)) {
      const fallback = await supabase.from('services').select('*');
      if (!fallback.error && fallback.data) {
        return fallback.data.map((r, i) => mapServiceRow(r, i));
      }
      return [];
    }
    handleSupabaseError(error, 'fetchAllServicesAdmin');
  }
  return (data || []).map((r, i) => mapServiceRow(r, i));
}

export async function saveServiceItem(
  data: Omit<ServiceItem, 'id' | 'createdAt' | 'updatedAt' | 'slug'>,
  existingService?: ServiceItem
): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const cleanTitle = truncate(data.title, 120) || 'Creative Service';
  const cleanPrice = Math.max(0, Number(data.startingPrice) || 0);
  const cleanSlug = truncate(slugify(cleanTitle) || 'service', 120);

  const payload: Record<string, any> = {
    title: cleanTitle,
    slug: cleanSlug,
    category: truncate(data.category || 'Graphic Design', 80),
    description: truncate(data.description, 1000),
    starting_price: cleanPrice,
    price_display: truncate(data.priceDisplay, 80) || `₹${cleanPrice}/design`,
    pricing_unit: truncate(data.pricingUnit || 'design', 60),
    is_custom_quote: Boolean(data.isCustomQuote),
    deliverables_summary: truncate(data.deliverablesSummary, 500),
    turnaround_time: truncate(data.turnaroundTime, 100),
    image_url: truncate(data.imageUrl, 1000),
    video_preview_url: truncate(data.videoPreviewUrl || '', 1000),
    media_urls: Array.isArray(data.mediaUrls) ? data.mediaUrls : [],
    published: Boolean(data.published),
    sort_order: Number(data.sortOrder) || 1,
    updated_at: new Date().toISOString(),
  };

  // Legacy column fallbacks if the existing Supabase services table has NOT NULL constraints on `name`, `price`, `base_price`, `service_name`, or `is_active`
  const legacyFallbacks: Record<string, any> = {
    name: cleanTitle,
    service_name: cleanTitle,
    price: cleanPrice,
    base_price: cleanPrice,
    is_active: Boolean(data.published),
    active: Boolean(data.published),
    currency: 'INR',
  };

  if (existingService?.id) {
    await adaptiveUpdateRow(
      'services',
      existingService.id,
      payload,
      legacyFallbacks,
      'saveServiceItem (update)'
    );
    await logAdminActivity('Updated Service', 'service', existingService.id, cleanTitle);
    return existingService.id;
  } else {
    const newId = await adaptiveInsertRow(
      'services',
      payload,
      legacyFallbacks,
      'saveServiceItem (insert)'
    );
    await logAdminActivity('Created Service', 'service', newId, cleanTitle);
    return newId;
  }
}

export async function deleteServiceItem(id: string, title: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('services').delete().eq('id', id);
  if (error) handleSupabaseError(error, 'deleteServiceItem');
  await logAdminActivity('Deleted Service', 'service', id, title);
}

// ============================================================================
// PORTFOLIO
// ============================================================================
export async function fetchPublishedPortfolio(): Promise<PortfolioItem[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('portfolio')
    .select('*')
    .eq('published', true)
    .order('sort_order', { ascending: true });

  if (error) {
    if (isMissingSchemaError(error)) return [];
    handleSupabaseError(error, 'fetchPublishedPortfolio');
  }
  return (data || []).map((r, i) => mapPortfolioRow(r, i));
}

export async function fetchAllPortfolioAdmin(): Promise<PortfolioItem[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('portfolio')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    if (isMissingSchemaError(error)) return [];
    handleSupabaseError(error, 'fetchAllPortfolioAdmin');
  }
  return (data || []).map((r, i) => mapPortfolioRow(r, i));
}

export async function savePortfolioItem(
  data: Omit<PortfolioItem, 'id' | 'createdAt' | 'updatedAt' | 'slug'>,
  existingItem?: PortfolioItem
): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const cleanTitle = truncate(data.title, 150) || 'Studio Project';
  const payload: Record<string, any> = {
    title: cleanTitle,
    slug: truncate(slugify(cleanTitle) || 'portfolio-item', 150),
    category: data.category,
    description: truncate(data.description, 2000),
    cover_image: truncate(data.coverImage, 1000),
    video_url: truncate(data.videoUrl || '', 1000),
    media_type: data.mediaType || (data.videoUrl ? 'video' : 'image'),
    gallery_urls: Array.isArray(data.galleryUrls) ? data.galleryUrls : [],
    tags: Array.isArray(data.tags) ? data.tags : [],
    project_url: truncate(data.projectUrl, 500),
    featured: Boolean(data.featured),
    published: Boolean(data.published),
    is_sample_content: Boolean(data.isSampleContent),
    sort_order: Number(data.sortOrder) || 1,
    metrics_summary: truncate(data.metricsSummary, 200),
    updated_at: new Date().toISOString(),
  };

  const legacyFallbacks: Record<string, any> = {
    name: cleanTitle,
    image_url: truncate(data.coverImage, 1000),
    image: truncate(data.coverImage, 1000),
  };

  if (existingItem?.id) {
    await adaptiveUpdateRow(
      'portfolio',
      existingItem.id,
      payload,
      legacyFallbacks,
      'savePortfolioItem (update)'
    );
    await logAdminActivity('Updated Portfolio Item', 'portfolio', existingItem.id, cleanTitle);
    return existingItem.id;
  } else {
    const newId = await adaptiveInsertRow(
      'portfolio',
      payload,
      legacyFallbacks,
      'savePortfolioItem (insert)'
    );
    await logAdminActivity('Created Portfolio Item', 'portfolio', newId, cleanTitle);
    return newId;
  }
}

export async function deletePortfolioItem(id: string, title: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('portfolio').delete().eq('id', id);
  if (error) handleSupabaseError(error, 'deletePortfolioItem');
  await logAdminActivity('Deleted Portfolio Item', 'portfolio', id, title);
}

// ============================================================================
// INQUIRIES / LEADS & REFERENCE FILE UPLOAD
// ============================================================================
export async function uploadInquiryReferenceFile(file: File): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `inquiries/inq_${Date.now()}_${safeName}`;
  const { error } = await supabase.storage
    .from('inquiry-references')
    .upload(filePath, file, { upsert: false });

  if (error) throw error;
  const { data } = supabase.storage.from('inquiry-references').getPublicUrl(filePath);
  return data.publicUrl;
}

export async function submitInquiryRecord(input: {
  fullName: string;
  email: string;
  phone: string;
  companyName?: string;
  serviceRequired: string;
  budgetRange: string;
  preferredDeadline?: string;
  description: string;
  referenceFileUrl?: string;
  privacyConsent: boolean;
}): Promise<string> {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase connection is not configured yet. Please add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.'
    );
  }
  const referenceId = crypto.randomUUID();
  const cleanName = truncate(input.fullName, 120) || 'Client Inquiry';
  const payload: Record<string, any> = {
    id: referenceId,
    full_name: cleanName,
    email: truncate(input.email.toLowerCase(), 254),
    phone: truncate(input.phone, 40),
    company_name: truncate(input.companyName || '', 150),
    service_required: truncate(input.serviceRequired, 120),
    budget_range: truncate(input.budgetRange, 100),
    preferred_deadline: truncate(input.preferredDeadline || '', 80),
    description: truncate(input.description, 3000),
    reference_file_url: truncate(input.referenceFileUrl || '', 1000),
    privacy_consent: true,
    status: 'New' as InquiryStatus,
    lead_source: 'Website Inquiry Form',
    internal_notes: '',
  };

  await adaptiveInsertRow(
    'inquiries',
    payload,
    {
      name: cleanName,
      service: truncate(input.serviceRequired, 120),
      budget: truncate(input.budgetRange, 100),
      message: truncate(input.description, 3000),
    },
    'submitInquiryRecord'
  );
  return referenceId;
}

export async function fetchAllInquiriesAdmin(): Promise<InquiryRecord[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('inquiries')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingSchemaError(error)) return [];
    handleSupabaseError(error, 'fetchAllInquiriesAdmin');
  }
  return (data || []).map(mapInquiryRow);
}

export async function updateInquiryAdmin(
  existing: InquiryRecord,
  updates: Partial<Pick<InquiryRecord, 'status' | 'internalNotes' | 'leadSource'>>
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { error } = await supabase
    .from('inquiries')
    .update({
      status: updates.status ?? existing.status,
      lead_source: truncate(updates.leadSource ?? existing.leadSource, 80),
      internal_notes: truncate(updates.internalNotes ?? existing.internalNotes, 2000),
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id);

  if (error) handleSupabaseError(error, 'updateInquiryAdmin');
  await logAdminActivity(
    `Updated Inquiry Status (${updates.status || existing.status})`,
    'inquiry',
    existing.id,
    existing.fullName
  );
}

export async function deleteInquiryAdmin(id: string, name: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('inquiries').delete().eq('id', id);
  if (error) handleSupabaseError(error, 'deleteInquiryAdmin');
  await logAdminActivity('Deleted Inquiry', 'inquiry', id, name);
}

// ============================================================================
// CLIENTS
// ============================================================================
export async function fetchAllClientsAdmin(): Promise<ClientRecord[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingSchemaError(error)) return [];
    handleSupabaseError(error, 'fetchAllClientsAdmin');
  }
  return (data || []).map(mapClientRow);
}

export async function saveClientAdmin(
  data: Omit<ClientRecord, 'id' | 'createdAt' | 'updatedAt'>,
  existingClient?: ClientRecord
): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const cleanName = truncate(data.fullName, 120) || 'Client';
  const payload: Record<string, any> = {
    user_id: toNullableUuid(data.userId),
    full_name: cleanName,
    email: truncate(data.email.toLowerCase(), 254),
    phone: truncate(data.phone, 40),
    company_name: truncate(data.companyName, 150),
    country: truncate(data.country || 'India', 80),
    preferred_contact: data.preferredContact || 'WhatsApp',
    account_status: data.accountStatus || 'active',
    admin_notes: truncate(data.adminNotes, 2000),
    updated_at: new Date().toISOString(),
  };

  const legacyFallbacks: Record<string, any> = {
    name: cleanName,
    status: data.accountStatus || 'active',
  };

  if (existingClient?.id) {
    await adaptiveUpdateRow(
      'clients',
      existingClient.id,
      payload,
      legacyFallbacks,
      'saveClientAdmin (update)'
    );
    await logAdminActivity('Updated Client Profile', 'client', existingClient.id, cleanName);
    return existingClient.id;
  } else {
    const newId = await adaptiveInsertRow(
      'clients',
      payload,
      legacyFallbacks,
      'saveClientAdmin (insert)'
    );
    await logAdminActivity('Created Client Profile', 'client', newId, cleanName);
    return newId;
  }
}

// ============================================================================
// PROJECTS & INTERNAL NOTES
// ============================================================================
export async function fetchAllProjectsAdmin(): Promise<ProjectRecord[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingSchemaError(error)) return [];
    handleSupabaseError(error, 'fetchAllProjectsAdmin');
  }
  return (data || []).map(mapProjectRow);
}

export async function fetchClientProjects(clientUserId: string): Promise<ProjectRecord[]> {
  const validUuid = toNullableUuid(clientUserId);
  if (!isSupabaseConfigured || !validUuid) return [];
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('client_user_id', validUuid)
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingSchemaError(error)) return [];
    handleSupabaseError(error, 'fetchClientProjects');
  }
  return (data || []).map(mapProjectRow);
}

export async function saveProjectAdmin(
  data: Omit<ProjectRecord, 'id' | 'createdAt' | 'updatedAt'>,
  internalNotes: string,
  existingProject?: ProjectRecord
): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const user = await getCurrentUser();
  const cleanTitle = truncate(data.title, 160) || 'Studio Project';
  const payload: Record<string, any> = {
    client_id: toNullableUuid(data.clientId),
    client_user_id: toNullableUuid(data.clientUserId),
    client_name: truncate(data.clientName, 120),
    client_email: truncate(data.clientEmail, 254),
    title: cleanTitle,
    description: truncate(data.description, 2500),
    service_type: truncate(data.serviceType, 120),
    brief: truncate(data.brief, 3000),
    budget: Math.max(0, Number(data.budget) || 0),
    start_date: truncate(data.startDate, 40),
    deadline: truncate(data.deadline, 40),
    priority: data.priority,
    status: data.status,
    progress: Math.min(100, Math.max(0, Number(data.progress) || 0)),
    latest_update: truncate(data.latestUpdate, 1500),
    updated_at: new Date().toISOString(),
  };

  const legacyFallbacks: Record<string, any> = {
    name: cleanTitle,
    project_name: cleanTitle,
  };

  let projectId = existingProject?.id || '';

  if (existingProject?.id) {
    await adaptiveUpdateRow(
      'projects',
      existingProject.id,
      payload,
      legacyFallbacks,
      'saveProjectAdmin (update)'
    );
    await logAdminActivity(`Updated Project (${payload.status})`, 'project', projectId, cleanTitle);
  } else {
    projectId = await adaptiveInsertRow(
      'projects',
      payload,
      legacyFallbacks,
      'saveProjectAdmin (insert)'
    );
    await logAdminActivity('Created Project', 'project', projectId, cleanTitle);
  }

  if (user && projectId) {
    await supabase.from('project_internal_notes').upsert({
      project_id: projectId,
      notes: truncate(internalNotes, 5000),
      updated_by: toNullableUuid(user.id),
      updated_at: new Date().toISOString(),
    });
  }

  if (payload.client_user_id) {
    await createNotification({
      recipientUserId: payload.client_user_id,
      type: existingProject ? 'Project status updated' : 'New project assigned',
      title: existingProject ? `Project Updated: ${payload.title}` : `New Project: ${payload.title}`,
      message: `${payload.status} (${payload.progress}% complete) — ${payload.latest_update}`,
      link: `/portal/projects/${projectId}`,
    });
  }

  return projectId;
}

export async function fetchProjectInternalNoteAdmin(projectId: string): Promise<string> {
  const validUuid = toNullableUuid(projectId);
  if (!isSupabaseConfigured || !validUuid) return '';
  try {
    const { data, error } = await supabase
      .from('project_internal_notes')
      .select('notes')
      .eq('project_id', validUuid)
      .maybeSingle();

    if (error || !data) return '';
    return String(data.notes || '');
  } catch {
    return '';
  }
}

export async function clientRequestRevisionOrApprove(
  project: ProjectRecord,
  newStatus: 'Revision Requested' | 'Completed',
  feedbackNote: string
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { error } = await supabase
    .from('projects')
    .update({
      status: newStatus,
      latest_update: truncate(feedbackNote, 1500),
      updated_at: new Date().toISOString(),
    })
    .eq('id', project.id);

  if (error) handleSupabaseError(error, 'clientRequestRevisionOrApprove');
}

// ============================================================================
// TASKS & MILESTONES
// ============================================================================
export async function fetchAllTasksAdmin(): Promise<TaskRecord[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingSchemaError(error)) return [];
    handleSupabaseError(error, 'fetchAllTasksAdmin');
  }
  return (data || []).map(mapTaskRow);
}

export async function fetchClientVisibleTasks(clientUserId: string): Promise<TaskRecord[]> {
  const validUuid = toNullableUuid(clientUserId);
  if (!isSupabaseConfigured || !validUuid) return [];
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('client_user_id', validUuid)
    .eq('visibility', 'client')
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingSchemaError(error)) return [];
    handleSupabaseError(error, 'fetchClientVisibleTasks');
  }
  return (data || []).map(mapTaskRow);
}

export async function saveTaskAdmin(
  data: Omit<TaskRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>,
  existingTask?: TaskRecord
): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const user = await getCurrentUser();
  const payload = {
    project_id: data.projectId,
    client_user_id: toNullableUuid(data.clientUserId),
    title: truncate(data.title, 160),
    description: truncate(data.description, 1000),
    status: data.status,
    priority: data.priority,
    due_date: truncate(data.dueDate, 40),
    visibility: data.visibility,
    created_by: toNullableUuid(existingTask?.createdBy || user?.id),
    updated_at: new Date().toISOString(),
  };

  if (existingTask?.id) {
    const { error } = await supabase.from('tasks').update(payload).eq('id', existingTask.id);
    if (error) handleSupabaseError(error, 'saveTaskAdmin (update)');
    return existingTask.id;
  } else {
    const { data: inserted, error } = await supabase
      .from('tasks')
      .insert(payload)
      .select('id')
      .single();

    if (error) handleSupabaseError(error, 'saveTaskAdmin (insert)');
    return String(inserted.id);
  }
}

export async function deleteTaskAdmin(id: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) handleSupabaseError(error, 'deleteTaskAdmin');
}

// ============================================================================
// DELIVERABLE FILES, SIGNED URLS & ADVANCED MEDIA ASSET MANAGER
// ============================================================================
export async function resolveStoragePreviewUrl(params: {
  storageBucket?: MediaBucket | string;
  storagePath?: string;
  fallbackUrl?: string;
  expiresInSeconds?: number;
}): Promise<string> {
  if (!isSupabaseConfigured) return params.fallbackUrl || '';
  const bucket = String(params.storageBucket || '').trim();
  const path = String(params.storagePath || '').trim();

  if (!bucket || !path) {
    return params.fallbackUrl || '';
  }

  // Private bucket requires a short-lived signed URL
  if (bucket === 'private-project-files') {
    const { data, error } = await supabase.storage
      .from('private-project-files')
      .createSignedUrl(path, params.expiresInSeconds || 3600);
    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  }

  if (params.fallbackUrl) return params.fallbackUrl;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadFileWithMetadata(params: {
  file?: File | null;
  externalUrl?: string;
  projectId: string;
  clientUserId: string;
  fileName: string;
  category: DeliverableFile['category'];
  versionLabel: string;
  visibility: 'client' | 'internal';
  uploaderName: string;
  description?: string;
  tags?: string[];
  onProgress?: (pct: number) => void;
}): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Authentication required');

  let downloadUrl = params.externalUrl || '';
  let storagePath = '';
  let storageBucket: MediaBucket = 'private-project-files';
  let fileType = 'application/octet-stream';
  let fileSize = 0;

  if (params.file) {
    const check = validateMediaFile(params.file, 'private-project-files');
    if (!check.valid) {
      throw new Error(check.error || 'File validation failed.');
    }

    fileType = params.file.type || 'application/octet-stream';
    fileSize = params.file.size;
    storagePath = buildSafeStoragePath(params.file.name, `projects/${params.projectId}`);

    if (params.onProgress) params.onProgress(20);

    // Try uploading to `private-project-files` first; fall back to `project-files` if bucket not yet migrated
    let uploadRes = await supabase.storage
      .from('private-project-files')
      .upload(storagePath, params.file, { upsert: false, contentType: fileType });

    if (uploadRes.error) {
      storageBucket = 'project-files';
      uploadRes = await supabase.storage
        .from('project-files')
        .upload(storagePath, params.file, { upsert: false, contentType: fileType });
    }

    if (uploadRes.error) handleSupabaseError(uploadRes.error, 'Supabase Storage upload');
    if (params.onProgress) params.onProgress(90);

    if (storageBucket === 'private-project-files') {
      const signed = await supabase.storage
        .from('private-project-files')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
      downloadUrl =
        signed.data?.signedUrl ||
        supabase.storage.from('private-project-files').getPublicUrl(storagePath).data.publicUrl;
    } else {
      const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(storagePath);
      downloadUrl = urlData.publicUrl;
    }
    if (params.onProgress) params.onProgress(100);
  }

  const basePayload: Record<string, any> = {
    project_id: params.projectId,
    client_user_id: toNullableUuid(params.clientUserId),
    file_name: truncate(params.fileName || params.file?.name || 'Deliverable Asset', 200),
    file_type: truncate(fileType, 100),
    file_size: fileSize,
    category: params.category,
    download_url: truncate(downloadUrl, 1500),
    storage_path: truncate(storagePath, 500),
    version_label: truncate(params.versionLabel || 'v1.0', 40),
    uploaded_by: toNullableUuid(user.id),
    uploader_name: truncate(params.uploaderName, 120),
    visibility: params.visibility,
  };

  const extendedPayload: Record<string, any> = {
    ...basePayload,
    storage_bucket: storageBucket,
    description: truncate(params.description || '', 1000),
    tags: Array.isArray(params.tags) ? params.tags : [],
  };

  let { data: inserted, error } = await supabase
    .from('files')
    .insert(extendedPayload)
    .select('id')
    .single();

  if (error && isMissingSchemaError(error)) {
    const retry = await supabase.from('files').insert(basePayload).select('id').single();
    inserted = retry.data;
    error = retry.error;
  }

  if (error || !inserted) handleSupabaseError(error, 'uploadFileWithMetadata');
  const newId = String(inserted!.id);

  // Also register in media_assets table if file was uploaded to storage
  if (params.file && storagePath) {
    try {
      const dims = await extractMediaDimensions(params.file);
      await supabase.from('media_assets').insert({
        title: basePayload.file_name,
        original_filename: truncate(params.file.name, 250),
        storage_bucket: storageBucket,
        storage_path: storagePath,
        public_url: truncate(downloadUrl, 1500),
        mime_type: truncate(fileType, 120),
        file_extension: getFileExtension(params.file.name),
        media_category: detectMediaCategory(fileType, params.file.name),
        file_size: fileSize,
        width: dims.width ?? null,
        height: dims.height ?? null,
        duration_seconds: dims.durationSeconds ?? null,
        description: truncate(params.description || `${params.category} (${params.versionLabel})`, 1000),
        tags: Array.isArray(params.tags) ? params.tags : [params.category.toLowerCase()],
        is_public: false,
        project_id: toNullableUuid(params.projectId),
        client_user_id: toNullableUuid(params.clientUserId),
        uploaded_by: toNullableUuid(user.id),
        uploader_name: truncate(params.uploaderName, 120),
      });
    } catch {
      // Non-blocking if media_assets table hasn't been migrated yet
    }
  }

  if (params.visibility === 'client' && basePayload.client_user_id) {
    await createNotification({
      recipientUserId: basePayload.client_user_id,
      type: 'New deliverable uploaded',
      title: `New ${params.category}: ${basePayload.file_name}`,
      message: `Version ${basePayload.version_label} is ready in your client portal.`,
      link: `/portal/files`,
    });
  }

  return newId;
}

export async function fetchAllFilesAdmin(): Promise<DeliverableFile[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingSchemaError(error)) return [];
    handleSupabaseError(error, 'fetchAllFilesAdmin');
  }
  return (data || []).map(mapFileRow);
}

export async function fetchClientFiles(clientUserId: string): Promise<DeliverableFile[]> {
  const validUuid = toNullableUuid(clientUserId);
  if (!isSupabaseConfigured || !validUuid) return [];
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('client_user_id', validUuid)
    .eq('visibility', 'client')
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingSchemaError(error)) return [];
    handleSupabaseError(error, 'fetchClientFiles');
  }
  return (data || []).map(mapFileRow);
}

export async function deleteFileAdmin(file: DeliverableFile): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  if (file.storagePath) {
    const bucketToUse = file.storageBucket || 'private-project-files';
    try {
      await supabase.storage.from(bucketToUse).remove([file.storagePath]);
      if (bucketToUse !== 'project-files') {
        await supabase.storage.from('project-files').remove([file.storagePath]);
      }
    } catch {
      // Ignore if file already removed from bucket
    }
  }
  const { error } = await supabase.from('files').delete().eq('id', file.id);
  if (error) handleSupabaseError(error, 'deleteFileAdmin');
  await logAdminActivity('Deleted File', 'file', file.id, file.fileName);
}

// ============================================================================
// ADMIN MEDIA LIBRARY (SUPABASE STORAGE + MEDIA_ASSETS TABLE)
// ============================================================================
export interface MediaAssetQueryFilters {
  mimeType?: 'all' | MediaCategory | string;
  searchQuery?: string;
  tag?: string;
  projectId?: string;
  bucket?: 'all' | MediaBucket;
  sortBy?: 'newest' | 'oldest' | 'name_asc' | 'size_desc' | 'size_asc';
}

export async function fetchMediaAssetsAdmin(
  filters?: MediaAssetQueryFilters
): Promise<MediaAsset[]> {
  if (!isSupabaseConfigured) return [];

  let query = supabase.from('media_assets').select('*');

  // 1. Filter by exact MIME type (.eq('mime_type', ...)) or media category
  if (filters?.mimeType && filters.mimeType !== 'all') {
    if (filters.mimeType.includes('/')) {
      query = query.eq('mime_type', filters.mimeType);
    } else if (filters.mimeType === 'pdf') {
      query = query.eq('mime_type', 'application/pdf');
    } else if (filters.mimeType === 'image') {
      query = query.or('mime_type.ilike.image/%,media_category.eq.image');
    } else if (filters.mimeType === 'video') {
      query = query.or('mime_type.ilike.video/%,media_category.eq.video');
    } else if (filters.mimeType === 'document') {
      query = query.eq('media_category', 'document');
    }
  }

  // 2. Filter by Storage Bucket
  if (filters?.bucket && filters.bucket !== 'all') {
    query = query.eq('storage_bucket', filters.bucket);
  }

  // 3. Filter by Associated Project ID
  if (filters?.projectId && filters.projectId !== 'all') {
    const validProjUuid = toNullableUuid(filters.projectId);
    if (validProjUuid) {
      query = query.eq('project_id', validProjUuid);
    }
  }

  // 4. Filter by specific associated project tag using PostgreSQL array containment (.contains)
  if (filters?.tag && filters.tag.trim()) {
    const cleanTag = filters.tag.trim().replace(/^#/, '').toLowerCase();
    if (cleanTag) {
      query = query.contains('tags', [cleanTag]);
    }
  }

  // 5. Search by file title using .ilike('title', ...) or associated project tags using .contains('tags', ...)
  if (filters?.searchQuery && filters.searchQuery.trim()) {
    const raw = filters.searchQuery.trim();
    const sanitizedText = raw.replace(/[,()"{}]/g, '').trim();
    const sanitizedTag = sanitizedText.replace(/^#/, '').toLowerCase();

    if (sanitizedText) {
      if (raw.startsWith('#') && sanitizedTag) {
        query = query.contains('tags', [sanitizedTag]);
      } else {
        query = query.ilike('title', `%${sanitizedText}%`);
      }
    }
  }

  // 6. Server-side ordering
  const sortBy = filters?.sortBy || 'newest';
  if (sortBy === 'oldest') {
    query = query.order('created_at', { ascending: true });
  } else if (sortBy === 'name_asc') {
    query = query.order('title', { ascending: true });
  } else if (sortBy === 'size_desc') {
    query = query.order('file_size', { ascending: false });
  } else if (sortBy === 'size_asc') {
    query = query.order('file_size', { ascending: true });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingSchemaError(error)) return [];
    handleSupabaseError(error, 'fetchMediaAssetsAdmin');
  }
  return (data || []).map(mapMediaAssetRow);
}

export async function uploadMediaAssetAdmin(params: {
  file: File;
  targetBucket: 'portfolio-media' | 'service-media' | 'private-project-files';
  title?: string;
  description?: string;
  tags?: string[];
  isPublic?: boolean;
  serviceId?: string;
  portfolioId?: string;
  projectId?: string;
  clientId?: string;
  clientUserId?: string;
  uploaderName?: string;
  onProgress?: (pct: number) => void;
}): Promise<MediaAsset> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Administrator authentication is required to upload media.');
  }

  const validation = validateMediaFile(params.file, params.targetBucket);
  if (!validation.valid) {
    throw new Error(validation.error || 'File failed validation.');
  }

  if (params.onProgress) params.onProgress(15);
  const dims = await extractMediaDimensions(params.file);
  if (params.onProgress) params.onProgress(30);

  const folderPrefix =
    params.targetBucket === 'portfolio-media'
      ? 'portfolio'
      : params.targetBucket === 'service-media'
      ? 'services'
      : params.projectId
      ? `projects/${params.projectId}`
      : 'private';

  const storagePath = buildSafeStoragePath(params.file.name, folderPrefix);
  const mimeType = params.file.type || 'application/octet-stream';

  let actualBucket: MediaBucket = params.targetBucket;
  let uploadRes = await supabase.storage
    .from(actualBucket)
    .upload(storagePath, params.file, { upsert: false, contentType: mimeType });

  // Graceful fallback if the new bucket hasn't been created in Supabase SQL Editor yet
  if (uploadRes.error) {
    const fallbackBucket: MediaBucket =
      params.targetBucket === 'private-project-files' ? 'project-files' : 'public-assets';
    const retryRes = await supabase.storage
      .from(fallbackBucket)
      .upload(storagePath, params.file, { upsert: false, contentType: mimeType });
    if (!retryRes.error) {
      actualBucket = fallbackBucket;
      uploadRes = retryRes;
    }
  }

  if (uploadRes.error) {
    const msg = uploadRes.error.message || 'Storage upload failed.';
    if (msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('exceeded')) {
      throw new Error('Supabase Storage quota or file size limit exceeded.');
    }
    handleSupabaseError(uploadRes.error, 'uploadMediaAssetAdmin (storage)');
  }

  if (params.onProgress) params.onProgress(80);

  let publicOrSignedUrl = '';
  const isPrivateBucket = actualBucket === 'private-project-files';

  if (isPrivateBucket) {
    const signed = await supabase.storage
      .from('private-project-files')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
    publicOrSignedUrl =
      signed.data?.signedUrl ||
      supabase.storage.from('private-project-files').getPublicUrl(storagePath).data.publicUrl;
  } else {
    const { data: pubData } = supabase.storage.from(actualBucket).getPublicUrl(storagePath);
    publicOrSignedUrl = pubData.publicUrl;
  }

  const cleanTitle = truncate(
    params.title || params.file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' '),
    160
  );

  const insertPayload = {
    title: cleanTitle || params.file.name,
    original_filename: truncate(params.file.name, 250),
    storage_bucket: actualBucket,
    storage_path: storagePath,
    public_url: truncate(publicOrSignedUrl, 1500),
    mime_type: truncate(mimeType, 120),
    file_extension: validation.extension,
    media_category: validation.mediaCategory,
    file_size: params.file.size,
    width: dims.width ?? null,
    height: dims.height ?? null,
    duration_seconds: dims.durationSeconds ?? null,
    description: truncate(params.description || '', 1000),
    tags: Array.isArray(params.tags)
      ? params.tags.map((t) => truncate(t, 40)).filter(Boolean)
      : [],
    is_public: isPrivateBucket ? false : params.isPublic ?? true,
    service_id: toNullableUuid(params.serviceId),
    portfolio_id: toNullableUuid(params.portfolioId),
    project_id: toNullableUuid(params.projectId),
    client_id: toNullableUuid(params.clientId),
    client_user_id: toNullableUuid(params.clientUserId),
    uploaded_by: toNullableUuid(user.id),
    uploader_name: truncate(params.uploaderName || user.email || 'Shankar Baluragi', 120),
  };

  const { data: inserted, error: dbErr } = await supabase
    .from('media_assets')
    .insert(insertPayload)
    .select('*')
    .single();

  if (params.onProgress) params.onProgress(100);

  if (dbErr) {
    handleSupabaseError(dbErr, 'uploadMediaAssetAdmin (database)');
  }

  await logAdminActivity(
    `Uploaded Media Asset (${actualBucket})`,
    'media_asset',
    String(inserted?.id || ''),
    `${insertPayload.title} (${validation.mediaCategory})`
  );

  return mapMediaAssetRow(inserted);
}

export async function updateMediaAssetAdmin(
  assetId: string,
  updates: {
    title: string;
    description: string;
    tags: string[];
    isPublic: boolean;
    serviceId?: string;
    portfolioId?: string;
    projectId?: string;
    clientId?: string;
    clientUserId?: string;
  }
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { error } = await supabase
    .from('media_assets')
    .update({
      title: truncate(updates.title, 160),
      description: truncate(updates.description, 1000),
      tags: updates.tags.map((t) => truncate(t, 40)).filter(Boolean),
      is_public: Boolean(updates.isPublic),
      service_id: toNullableUuid(updates.serviceId),
      portfolio_id: toNullableUuid(updates.portfolioId),
      project_id: toNullableUuid(updates.projectId),
      client_id: toNullableUuid(updates.clientId),
      client_user_id: toNullableUuid(updates.clientUserId),
      updated_at: new Date().toISOString(),
    })
    .eq('id', assetId);

  if (error) handleSupabaseError(error, 'updateMediaAssetAdmin');
  await logAdminActivity('Updated Media Asset Metadata', 'media_asset', assetId, updates.title);
}

export async function deleteMediaAssetAdmin(asset: MediaAsset): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  if (asset.storagePath && asset.storageBucket) {
    try {
      await supabase.storage.from(asset.storageBucket).remove([asset.storagePath]);
    } catch {
      // Continue deleting metadata record if object already removed
    }
  }
  const { error } = await supabase.from('media_assets').delete().eq('id', asset.id);
  if (error) handleSupabaseError(error, 'deleteMediaAssetAdmin');
  await logAdminActivity('Deleted Media Asset', 'media_asset', asset.id, asset.title);
}

// ============================================================================
// INVOICES & PAYMENTS
// ============================================================================
export async function fetchAllInvoicesAdmin(): Promise<InvoiceRecord[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingSchemaError(error)) return [];
    handleSupabaseError(error, 'fetchAllInvoicesAdmin');
  }
  return (data || []).map(mapInvoiceRow);
}

export async function fetchClientInvoices(clientUserId: string): Promise<InvoiceRecord[]> {
  const validUuid = toNullableUuid(clientUserId);
  if (!isSupabaseConfigured || !validUuid) return [];
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('client_user_id', validUuid)
    .neq('status', 'Draft')
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingSchemaError(error)) return [];
    handleSupabaseError(error, 'fetchClientInvoices');
  }
  return (data || []).map(mapInvoiceRow);
}

export async function fetchInvoiceLineItems(
  invoiceId: string,
  clientUserId?: string
): Promise<InvoiceLineItem[]> {
  const validInvId = toNullableUuid(invoiceId);
  if (!isSupabaseConfigured || !validInvId) return [];
  let q = supabase
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', validInvId)
    .order('sort_order', { ascending: true });

  const validClientUuid = toNullableUuid(clientUserId);
  if (validClientUuid) {
    q = q.eq('client_user_id', validClientUuid);
  }

  const { data, error } = await q;
  if (error) {
    if (isMissingSchemaError(error)) return [];
    handleSupabaseError(error, 'fetchInvoiceLineItems');
  }
  return (data || []).map(mapLineItemRow);
}

export async function saveInvoiceWithLineItemsAdmin(
  invoiceData: Omit<InvoiceRecord, 'id' | 'createdAt' | 'updatedAt'>,
  lineItems: Omit<InvoiceLineItem, 'id' | 'invoiceId' | 'clientUserId'>[],
  existingInvoice?: InvoiceRecord
): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const itemsSummary = lineItems
    .map((li) => `${li.description} (${li.quantity} × ₹${li.unitPrice})`)
    .join(' · ');

  const payload = {
    invoice_number: truncate(invoiceData.invoiceNumber, 60),
    client_id: toNullableUuid(invoiceData.clientId),
    client_user_id: toNullableUuid(invoiceData.clientUserId),
    client_name: truncate(invoiceData.clientName, 120),
    client_email: truncate(invoiceData.clientEmail, 254),
    project_id: toNullableUuid(invoiceData.projectId),
    project_title: truncate(invoiceData.projectTitle, 160),
    issue_date: truncate(invoiceData.issueDate, 40),
    due_date: truncate(invoiceData.dueDate, 40),
    items_summary: truncate(itemsSummary || invoiceData.itemsSummary || 'Creative Services', 2000),
    subtotal: Math.max(0, Number(invoiceData.subtotal) || 0),
    discount: Math.max(0, Number(invoiceData.discount) || 0),
    tax_rate: Math.min(100, Math.max(0, Number(invoiceData.taxRate) || 0)),
    tax_amount: Math.max(0, Number(invoiceData.taxAmount) || 0),
    total: Math.max(0, Number(invoiceData.total) || 0),
    amount_paid: Math.max(0, Number(invoiceData.amountPaid) || 0),
    balance_due: Math.max(0, Number(invoiceData.balanceDue) || 0),
    currency: 'INR',
    status: invoiceData.status,
    payment_instructions: truncate(invoiceData.paymentInstructions, 1000),
    notes: truncate(invoiceData.notes, 1000),
    updated_at: new Date().toISOString(),
  };

  let invoiceId = existingInvoice?.id || '';

  if (existingInvoice?.id) {
    const { error } = await supabase
      .from('invoices')
      .update(payload)
      .eq('id', existingInvoice.id);
    if (error) handleSupabaseError(error, 'saveInvoiceWithLineItemsAdmin (update)');
  } else {
    const { data: inserted, error } = await supabase
      .from('invoices')
      .insert(payload)
      .select('id')
      .single();
    if (error) handleSupabaseError(error, 'saveInvoiceWithLineItemsAdmin (insert)');
    invoiceId = String(inserted.id);
  }

  await supabase.from('invoice_line_items').delete().eq('invoice_id', invoiceId);
  if (lineItems.length > 0) {
    const rows = lineItems.map((item, idx) => ({
      invoice_id: invoiceId,
      client_user_id: payload.client_user_id,
      description: truncate(item.description, 300),
      quantity: Math.max(1, Number(item.quantity) || 1),
      unit_price: Math.max(0, Number(item.unitPrice) || 0),
      amount: Math.max(0, Number(item.amount) || 0),
      sort_order: idx + 1,
    }));
    const { error: liErr } = await supabase.from('invoice_line_items').insert(rows);
    if (liErr) handleSupabaseError(liErr, 'saveInvoiceWithLineItemsAdmin (lineItems)');
  }

  await logAdminActivity(
    existingInvoice ? 'Updated Invoice' : 'Created Invoice',
    'invoice',
    invoiceId,
    `${payload.invoice_number} — ₹${payload.total}`
  );

  if (payload.client_user_id && payload.status !== 'Draft') {
    await createNotification({
      recipientUserId: payload.client_user_id,
      type: 'Invoice created',
      title: `Invoice ${payload.invoice_number} (${payload.status})`,
      message: `Total: ₹${payload.total.toLocaleString('en-IN')} · Due: ${payload.due_date}`,
      link: `/portal/invoices/${invoiceId}`,
    });
  }

  return invoiceId;
}

export async function recordPaymentAdmin(params: {
  invoice: InvoiceRecord;
  amount: number;
  method: PaymentRecord['method'];
  transactionReference: string;
  paymentDate: string;
  notes: string;
}): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Admin authentication required');
  const paidAmt = Math.max(1, Math.round(Number(params.amount) || 0));

  const { data: inserted, error } = await supabase
    .from('payments')
    .insert({
      invoice_id: params.invoice.id,
      invoice_number: truncate(params.invoice.invoiceNumber, 60),
      client_id: toNullableUuid(params.invoice.clientId),
      client_user_id: toNullableUuid(params.invoice.clientUserId),
      client_name: truncate(params.invoice.clientName, 120),
      amount: paidAmt,
      currency: 'INR',
      method: params.method,
      transaction_reference: truncate(params.transactionReference, 120),
      verification_mode: 'Admin Recorded',
      payment_date: truncate(params.paymentDate, 40),
      notes: truncate(params.notes, 500),
      recorded_by: toNullableUuid(user.id),
    })
    .select('id')
    .single();

  if (error) handleSupabaseError(error, 'recordPaymentAdmin');
  const payId = String(inserted.id);

  const newAmountPaid = (params.invoice.amountPaid || 0) + paidAmt;
  const newBalanceDue = Math.max(0, params.invoice.total - newAmountPaid);
  const newStatus = newBalanceDue === 0 ? 'Paid' : 'Partially Paid';

  const { error: invErr } = await supabase
    .from('invoices')
    .update({
      amount_paid: newAmountPaid,
      balance_due: newBalanceDue,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.invoice.id);

  if (invErr) handleSupabaseError(invErr, 'recordPaymentAdmin (invoice update)');

  await logAdminActivity(
    'Recorded Payment',
    'payment',
    payId,
    `${params.invoice.invoiceNumber} — ₹${paidAmt} via ${params.method}`
  );

  if (params.invoice.clientUserId) {
    await createNotification({
      recipientUserId: params.invoice.clientUserId,
      type: 'Payment recorded',
      title: `Payment Recorded for ${params.invoice.invoiceNumber}`,
      message: `₹${paidAmt.toLocaleString('en-IN')} recorded via ${params.method}. Remaining balance: ₹${newBalanceDue.toLocaleString('en-IN')}.`,
      link: `/portal/invoices/${params.invoice.id}`,
    });
  }

  return payId;
}

export async function fetchAllPaymentsAdmin(): Promise<PaymentRecord[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingSchemaError(error)) return [];
    handleSupabaseError(error, 'fetchAllPaymentsAdmin');
  }
  return (data || []).map(mapPaymentRow);
}

export async function fetchClientPayments(clientUserId: string): Promise<PaymentRecord[]> {
  const validUuid = toNullableUuid(clientUserId);
  if (!isSupabaseConfigured || !validUuid) return [];
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('client_user_id', validUuid)
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingSchemaError(error)) return [];
    handleSupabaseError(error, 'fetchClientPayments');
  }
  return (data || []).map(mapPaymentRow);
}

// ============================================================================
// PROJECT MESSAGES / COMMENTS
// ============================================================================
export async function fetchProjectMessages(
  projectId: string,
  isAdminUser: boolean,
  clientUserId?: string
): Promise<ProjectMessage[]> {
  const validProjId = toNullableUuid(projectId);
  if (!isSupabaseConfigured || !validProjId) return [];

  let q = supabase
    .from('project_messages')
    .select('*')
    .eq('project_id', validProjId)
    .order('created_at', { ascending: true });

  if (!isAdminUser) {
    const validClientUuid = toNullableUuid(clientUserId);
    if (!validClientUuid) return [];
    q = q.eq('client_user_id', validClientUuid).eq('visibility', 'client');
  }

  const { data, error } = await q;
  if (error) {
    if (isMissingSchemaError(error)) return [];
    handleSupabaseError(error, 'fetchProjectMessages');
  }
  return (data || []).map(mapMessageRow);
}

export async function postProjectMessage(params: {
  projectId: string;
  clientUserId: string;
  senderName: string;
  senderRole: 'admin' | 'client';
  content: string;
  visibility: 'client' | 'internal';
}): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Authentication required');

  const payload = {
    project_id: params.projectId,
    client_user_id: toNullableUuid(params.clientUserId),
    sender_id: toNullableUuid(user.id),
    sender_name: truncate(params.senderName, 120),
    sender_role: params.senderRole,
    content: truncate(params.content, 2000),
    visibility: params.senderRole === 'client' ? 'client' : params.visibility,
    read_by_admin: params.senderRole === 'admin',
    read_by_client: params.senderRole === 'client',
  };

  const { data: inserted, error } = await supabase
    .from('project_messages')
    .insert(payload)
    .select('id')
    .single();

  if (error) handleSupabaseError(error, 'postProjectMessage');
  const msgId = String(inserted.id);

  if (params.senderRole === 'admin' && params.visibility === 'client' && payload.client_user_id) {
    await createNotification({
      recipientUserId: payload.client_user_id,
      type: 'New project comment',
      title: `New Studio Message from ${params.senderName}`,
      message: truncate(params.content, 160),
      link: `/portal/projects/${params.projectId}`,
    });
  }

  return msgId;
}

// ============================================================================
// SEED STUDIO CATALOG (SERVICES, DEMO PORTFOLIO, SETTINGS)
// ============================================================================
export async function seedInitialStudioCatalog(): Promise<{
  servicesSeeded: number;
  portfolioSeeded: number;
}> {
  const existingServices = await fetchAllServicesAdmin();
  const existingPortfolio = await fetchAllPortfolioAdmin();

  let servicesSeeded = 0;
  let portfolioSeeded = 0;

  if (existingServices.length === 0) {
    for (const srv of SEED_SERVICES) {
      await saveServiceItem(srv);
      servicesSeeded++;
    }
  }

  if (existingPortfolio.length === 0) {
    for (const item of SEED_PORTFOLIO) {
      await savePortfolioItem(item);
      portfolioSeeded++;
    }
  }

  await savePublicSettings(DEFAULT_PUBLIC_SETTINGS);
  await savePrivateSettings(DEFAULT_PRIVATE_SETTINGS);

  return { servicesSeeded, portfolioSeeded };
}
