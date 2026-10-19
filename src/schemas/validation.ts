import { z } from 'zod';

// Synced with Supabase PostgreSQL schema & Row Level Security (RLS) constraints

export const inquirySchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(120, 'Maximum 120 characters'),
  email: z.string().trim().email('Enter a valid email address').max(254),
  phone: z.string().trim().min(5, 'Enter a valid WhatsApp or phone number').max(40, 'Maximum 40 characters'),
  companyName: z.string().trim().max(150, 'Maximum 150 characters'),
  serviceRequired: z.string().trim().min(1, 'Please select a required service').max(120),
  budgetRange: z.string().trim().min(1, 'Please select a budget range').max(100),
  preferredDeadline: z.string().trim().max(80),
  description: z
    .string()
    .trim()
    .min(10, 'Please share at least 10 characters describing your project brief')
    .max(3000, 'Maximum 3000 characters'),
  privacyConsent: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the privacy policy to submit an inquiry',
  }),
});

export type InquiryFormValues = z.infer<typeof inquirySchema>;

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address').max(254),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  displayName: z.string().trim().min(2, 'Full name is required').max(120),
  email: z.string().trim().email('Enter a valid email address').max(254),
  phone: z.string().trim().max(40),
  companyName: z.string().trim().max(150),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export type RegisterFormValues = z.infer<typeof registerSchema>;

export const serviceSchema = z.object({
  title: z.string().trim().min(1, 'Service title is required').max(120),
  category: z.string().trim().min(1, 'Category is required').max(80),
  description: z.string().trim().min(5, 'Description is required').max(1000),
  startingPrice: z.coerce.number().min(0, 'Price must be 0 or greater'),
  priceDisplay: z.string().trim().min(1, 'Display price is required (e.g., ₹500/design or Custom quote)').max(80),
  pricingUnit: z.string().trim().max(60).default('design'),
  isCustomQuote: z.boolean().default(false),
  deliverablesSummary: z.string().trim().max(500).default(''),
  turnaroundTime: z.string().trim().max(100).default('2–4 business days'),
  imageUrl: z.string().trim().max(1000).default(''),
  published: z.boolean().default(true),
  sortOrder: z.coerce.number().default(1),
});

export type ServiceFormValues = z.infer<typeof serviceSchema>;

export const portfolioSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(150),
  category: z.enum([
    'Graphic Design',
    'Social Media',
    'YouTube Thumbnails',
    'Video Editing',
    'Instagram Reels',
    'Promotional Ads',
    'Branding',
    'Other',
  ]),
  description: z.string().trim().min(5, 'Description is required').max(2000),
  coverImage: z.string().trim().max(1000).default(''),
  projectUrl: z.string().trim().max(500).default(''),
  metricsSummary: z.string().trim().max(200).default(''),
  featured: z.boolean().default(false),
  published: z.boolean().default(true),
  isSampleContent: z.boolean().default(false),
  sortOrder: z.coerce.number().default(1),
});

export type PortfolioFormValues = z.infer<typeof portfolioSchema>;

export const clientSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(120),
  email: z.string().trim().email('Valid email is required').max(254),
  phone: z.string().trim().max(40).default(''),
  companyName: z.string().trim().max(150).default(''),
  country: z.string().trim().max(80).default('India'),
  preferredContact: z.enum(['Email', 'WhatsApp', 'Phone']).default('WhatsApp'),
  accountStatus: z.enum(['active', 'invited', 'deactivated']).default('active'),
  userId: z.string().trim().max(128).default(''),
  adminNotes: z.string().trim().max(2000).default(''),
});

export type ClientFormValues = z.infer<typeof clientSchema>;

export const projectSchema = z.object({
  clientId: z.string().trim().min(1, 'Please select a client').max(128),
  title: z.string().trim().min(1, 'Project title is required').max(160),
  serviceType: z.string().trim().min(1, 'Service type is required').max(120),
  description: z.string().trim().max(2500).default(''),
  brief: z.string().trim().max(3000).default(''),
  budget: z.coerce.number().min(0, 'Budget must be 0 or greater'),
  startDate: z.string().trim().min(1, 'Start date is required').max(40),
  deadline: z.string().trim().min(1, 'Deadline is required').max(40),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).default('Medium'),
  status: z
    .enum([
      'Inquiry',
      'Planned',
      'In Progress',
      'Waiting for Client',
      'In Review',
      'Revision Requested',
      'Completed',
      'On Hold',
      'Cancelled',
    ])
    .default('Planned'),
  progress: z.coerce.number().min(0).max(100).default(10),
  latestUpdate: z.string().trim().max(1500).default('Project initialized and brief confirmed.'),
  internalNotes: z.string().trim().max(5000).default(''),
});

export type ProjectFormValues = z.infer<typeof projectSchema>;
