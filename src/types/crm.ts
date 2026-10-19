export type UserRole = 'admin' | 'client';
export type AccountStatus = 'active' | 'invited' | 'deactivated';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: 'active' | 'deactivated';
  phone: string;
  companyName: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClientRecord {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  country: string;
  preferredContact: 'Email' | 'WhatsApp' | 'Phone';
  accountStatus: AccountStatus;
  adminNotes: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ServiceItem {
  id: string;
  title: string;
  slug: string;
  category: string;
  description: string;
  startingPrice: number;
  priceDisplay: string;
  pricingUnit: string;
  isCustomQuote: boolean;
  deliverablesSummary: string;
  turnaroundTime: string;
  imageUrl: string;
  videoPreviewUrl?: string;
  mediaUrls?: string[];
  published: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export type PortfolioCategory =
  | 'Graphic Design'
  | 'Social Media'
  | 'YouTube Thumbnails'
  | 'Video Editing'
  | 'Instagram Reels'
  | 'Promotional Ads'
  | 'Branding'
  | 'Other';

export interface PortfolioItem {
  id: string;
  title: string;
  slug: string;
  category: PortfolioCategory;
  description: string;
  coverImage: string;
  videoUrl?: string;
  mediaType?: 'image' | 'video' | 'pdf';
  galleryUrls?: string[];
  tags?: string[];
  projectUrl: string;
  featured: boolean;
  published: boolean;
  isSampleContent: boolean;
  sortOrder: number;
  metricsSummary: string;
  createdAt?: string;
  updatedAt?: string;
}

export type InquiryStatus =
  | 'New'
  | 'Contacted'
  | 'Qualified'
  | 'Proposal Sent'
  | 'Converted'
  | 'Closed'
  | 'Spam';

export interface InquiryRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  serviceRequired: string;
  budgetRange: string;
  preferredDeadline: string;
  description: string;
  referenceFileUrl: string;
  privacyConsent: boolean;
  status: InquiryStatus;
  leadSource: string;
  internalNotes: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ProjectStatus =
  | 'Inquiry'
  | 'Planned'
  | 'In Progress'
  | 'Waiting for Client'
  | 'In Review'
  | 'Revision Requested'
  | 'Completed'
  | 'On Hold'
  | 'Cancelled';

export type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface ProjectRecord {
  id: string;
  clientId: string;
  clientUserId: string;
  clientName: string;
  clientEmail: string;
  title: string;
  description: string;
  serviceType: string;
  brief: string;
  budget: number;
  startDate: string;
  deadline: string;
  priority: PriorityLevel;
  status: ProjectStatus;
  progress: number;
  latestUpdate: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectInternalNote {
  projectId: string;
  notes: string;
  updatedBy: string;
  updatedAt?: string;
}

export type TaskStatus = 'To Do' | 'In Progress' | 'Blocked' | 'Done';

export interface TaskRecord {
  id: string;
  projectId: string;
  clientUserId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: 'Low' | 'Medium' | 'High';
  dueDate: string;
  visibility: 'client' | 'internal';
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export type FileCategory = 'Deliverable' | 'Preview' | 'Reference' | 'Invoice Attachment';

export type MediaBucket =
  | 'portfolio-media'
  | 'service-media'
  | 'private-project-files'
  | 'project-files'
  | 'public-assets'
  | 'inquiry-references';

export type MediaCategory = 'image' | 'video' | 'pdf' | 'document';

export interface DeliverableFile {
  id: string;
  projectId: string;
  clientUserId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  category: FileCategory;
  downloadUrl: string;
  storagePath: string;
  storageBucket?: MediaBucket;
  description?: string;
  tags?: string[];
  versionLabel: string;
  uploadedBy: string;
  uploaderName: string;
  visibility: 'client' | 'internal';
  createdAt?: string;
}

export interface MediaAsset {
  id: string;
  title: string;
  originalFilename: string;
  storageBucket: MediaBucket;
  storagePath: string;
  publicUrl: string;
  mimeType: string;
  fileExtension: string;
  mediaCategory: MediaCategory;
  fileSize: number;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  description: string;
  tags: string[];
  isPublic: boolean;
  serviceId?: string;
  portfolioId?: string;
  projectId?: string;
  clientId?: string;
  clientUserId?: string;
  uploadedBy: string;
  uploaderName: string;
  createdAt?: string;
  updatedAt?: string;
}

export type InvoiceStatus =
  | 'Draft'
  | 'Sent'
  | 'Partially Paid'
  | 'Paid'
  | 'Overdue'
  | 'Cancelled';

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  clientUserId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  sortOrder: number;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientUserId: string;
  clientName: string;
  clientEmail: string;
  projectId: string;
  projectTitle: string;
  issueDate: string;
  dueDate: string;
  itemsSummary: string;
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  currency: 'INR';
  status: InvoiceStatus;
  paymentInstructions: string;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

export type PaymentMethod = 'UPI' | 'Bank Transfer (NEFT/IMPS)' | 'Razorpay' | 'Cash' | 'Other';

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  clientUserId: string;
  clientName: string;
  amount: number;
  currency: 'INR';
  method: PaymentMethod;
  transactionReference: string;
  verificationMode: 'Admin Recorded' | 'Webhook Verified';
  paymentDate: string;
  notes: string;
  recordedBy: string;
  createdAt?: string;
}

export interface ProjectMessage {
  id: string;
  projectId: string;
  clientUserId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  content: string;
  visibility: 'client' | 'internal';
  readByAdmin: boolean;
  readByClient: boolean;
  createdAt?: string;
}

export type NotificationType =
  | 'New inquiry'
  | 'Project status updated'
  | 'New project assigned'
  | 'New deliverable uploaded'
  | 'Revision requested'
  | 'Invoice created'
  | 'Invoice due soon'
  | 'Payment recorded'
  | 'New project comment';

export interface NotificationRecord {
  id: string;
  recipientUserId: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string;
  read: boolean;
  createdAt?: string;
}

export interface PublicSettings {
  businessName: string;
  ownerName: string;
  tagline: string;
  businessEmail: string;
  whatsappNumber: string;
  whatsappDefaultMessage: string;
  websiteUrl: string;
  businessAddress: string;
  defaultCurrency: 'INR';
  portfolioVisible: boolean;
  updatedAt?: string;
}

export interface PrivateSettings {
  invoicePrefix: string;
  defaultPaymentTerms: string;
  defaultPaymentInstructions: string;
  defaultTaxRate: number;
  enableEmailNotifications: boolean;
  updatedAt?: string;
}

export interface ActivityLog {
  id: string;
  actorUid: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  createdAt?: string;
}
