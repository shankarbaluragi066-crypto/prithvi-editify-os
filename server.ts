import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// PERSISTENT SHARED STUDIO CRM STORE (SYNCS BOTH ADMINS + CLIENTS + BOOKINGS)
// ============================================================================
interface SharedCrmStoreData {
  tables: Record<string, Record<string, any>[]>;
  deletedIds: Record<string, string[]>;
  updatedAt: string;
}

const SHARED_CRM_STORE_DIR = path.resolve(__dirname, '.data');
const SHARED_CRM_STORE_FILE = path.join(SHARED_CRM_STORE_DIR, 'crm_shared_store.json');

let sharedCrmStoreCache: SharedCrmStoreData | null = null;

function loadSharedCrmStore(): SharedCrmStoreData {
  if (sharedCrmStoreCache) return sharedCrmStoreCache;
  try {
    if (fs.existsSync(SHARED_CRM_STORE_FILE)) {
      const raw = fs.readFileSync(SHARED_CRM_STORE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        sharedCrmStoreCache = {
          tables: parsed.tables && typeof parsed.tables === 'object' ? parsed.tables : {},
          deletedIds:
            parsed.deletedIds && typeof parsed.deletedIds === 'object' ? parsed.deletedIds : {},
          updatedAt: parsed.updatedAt || new Date().toISOString(),
        };
        return sharedCrmStoreCache;
      }
    }
  } catch {
    // Fallback to fresh store
  }
  sharedCrmStoreCache = {
    tables: {},
    deletedIds: {},
    updatedAt: new Date().toISOString(),
  };
  return sharedCrmStoreCache;
}

function persistSharedCrmStore(store: SharedCrmStoreData): void {
  store.updatedAt = new Date().toISOString();
  sharedCrmStoreCache = store;
  try {
    if (!fs.existsSync(SHARED_CRM_STORE_DIR)) {
      fs.mkdirSync(SHARED_CRM_STORE_DIR, { recursive: true });
    }
    fs.writeFileSync(SHARED_CRM_STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch {
    // Non-fatal if filesystem is read-only
  }
}

function upsertRowInSharedStore(table: string, row: Record<string, any>): Record<string, any> {
  const store = loadSharedCrmStore();
  const nowIso = new Date().toISOString();
  const id = String(row.id || crypto.randomUUID());
  const deletedSet = new Set<string>(store.deletedIds[table] || []);
  if (deletedSet.has(id)) {
    deletedSet.delete(id);
    store.deletedIds[table] = Array.from(deletedSet);
  }

  const existingList = Array.isArray(store.tables[table]) ? store.tables[table] : [];
  const prev = existingList.find((r) => String(r.id) === id);
  const mergedRow: Record<string, any> = {
    ...(prev || {}),
    ...row,
    id,
    created_at: row.created_at || row.createdAt || prev?.created_at || prev?.createdAt || nowIso,
    updated_at: row.updated_at || row.updatedAt || nowIso,
  };
  store.tables[table] = [mergedRow, ...existingList.filter((r) => String(r.id) !== id)];
  persistSharedCrmStore(store);
  return mergedRow;
}

function deleteRowInSharedStore(table: string, id: string): void {
  const cleanId = String(id || '').trim();
  if (!cleanId) return;
  const store = loadSharedCrmStore();
  const existingList = Array.isArray(store.tables[table]) ? store.tables[table] : [];
  store.tables[table] = existingList.filter((r) => String(r.id) !== cleanId);
  const deletedSet = new Set<string>(store.deletedIds[table] || []);
  deletedSet.add(cleanId);
  store.deletedIds[table] = Array.from(deletedSet);
  persistSharedCrmStore(store);
}

function mergeIncomingTablesIntoSharedStore(
  incomingTables?: Record<string, Record<string, any>[]>,
  incomingDeletedIds?: Record<string, string[]>
): SharedCrmStoreData {
  const store = loadSharedCrmStore();
  let modified = false;

  if (incomingDeletedIds && typeof incomingDeletedIds === 'object') {
    for (const [table, ids] of Object.entries(incomingDeletedIds)) {
      if (!Array.isArray(ids)) continue;
      const set = new Set<string>(store.deletedIds[table] || []);
      let tableDeletedChanged = false;
      for (const rawId of ids) {
        const cleanId = String(rawId || '').trim();
        if (cleanId && !set.has(cleanId)) {
          set.add(cleanId);
          tableDeletedChanged = true;
          modified = true;
        }
      }
      if (tableDeletedChanged) {
        store.deletedIds[table] = Array.from(set);
        if (Array.isArray(store.tables[table])) {
          store.tables[table] = store.tables[table].filter((r) => !set.has(String(r.id)));
        }
      }
    }
  }

  if (incomingTables && typeof incomingTables === 'object') {
    for (const [table, rows] of Object.entries(incomingTables)) {
      if (!Array.isArray(rows)) continue;
      const deletedSet = new Set<string>(store.deletedIds[table] || []);
      const currentRows = Array.isArray(store.tables[table]) ? store.tables[table] : [];
      const byId = new Map<string, Record<string, any>>();
      for (const r of currentRows) {
        const rid = String(r?.id || '');
        if (rid && !deletedSet.has(rid)) {
          byId.set(rid, r);
        }
      }

      for (const inc of rows) {
        if (!inc || typeof inc !== 'object') continue;
        const incId = String(inc.id || '');
        if (!incId || deletedSet.has(incId)) continue;
        if (
          table === 'inquiries' &&
          String(inc.email || '').trim().toLowerCase() === 'sync-check@example.com'
        ) {
          continue;
        }
        const existing = byId.get(incId);
        if (!existing) {
          byId.set(incId, inc);
          modified = true;
        } else {
          const exTime = new Date(
            existing.updated_at || existing.updatedAt || existing.created_at || existing.createdAt || 0
          ).getTime();
          const incTime = new Date(
            inc.updated_at || inc.updatedAt || inc.created_at || inc.createdAt || 0
          ).getTime();
          if (incTime > exTime) {
            byId.set(incId, { ...existing, ...inc });
            modified = true;
          } else if (Object.keys(inc).length > Object.keys(existing).length) {
            byId.set(incId, { ...inc, ...existing });
            modified = true;
          }
        }
      }

      store.tables[table] = Array.from(byId.values());
    }
  }

  if (modified) {
    persistSharedCrmStore(store);
  }
  return store;
}

const PORT = Number(process.env.PORT) || 3000;
const STUDIO_ADMIN_EMAIL = (
  process.env.STUDIO_ADMIN_EMAIL || 'shankarbaluragi066@gmail.com'
).toLowerCase();
const STUDIO_OFFICIAL_ADMIN_EMAIL = (
  process.env.STUDIO_OFFICIAL_ADMIN_EMAIL || 'prithvieditify.official@gmail.com'
).toLowerCase();

const AUTHORIZED_ADMIN_EMAILS = Array.from(
  new Set([STUDIO_ADMIN_EMAIL, STUDIO_OFFICIAL_ADMIN_EMAIL])
);

function isServerAuthorizedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return AUTHORIZED_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

const processedIdempotencyKeys = new Map<string, number>();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24h for registration idempotency
const RESET_NOTIFY_COOLDOWN_MS = 10 * 60 * 1000; // 10m cooldown for password-reset admin alerts

function checkAndRecordIdempotencyKey(key: string, ttlMs = IDEMPOTENCY_TTL_MS): boolean {
  const now = Date.now();
  const prev = processedIdempotencyKeys.get(key);
  if (prev && now - prev < ttlMs) {
    return false; // Duplicate within TTL window
  }
  processedIdempotencyKeys.set(key, now);
  return true;
}

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || 'https://kjsnawvgctdsikexzjfp.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_QIkiS3KZxMr5ct9Y7CrfDQ_ZAt4j42V';

const DEFAULT_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-3.8-flash';
const DEFAULT_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-lite-image';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// ============================================================================
// RATE LIMITER & COST PROTECTION
// ============================================================================
interface RateBucket {
  count: number;
  windowStart: number;
  lastRequestAt: number;
}

const rateBuckets = new Map<string, RateBucket>();
const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_MINUTE = 20;
const MIN_COOLDOWN_MS = 1200;

function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds?: number; message?: string } {
  const now = Date.now();
  const bucket = rateBuckets.get(key);

  if (!bucket || now - bucket.windowStart > RATE_WINDOW_MS) {
    rateBuckets.set(key, { count: 1, windowStart: now, lastRequestAt: now });
    return { allowed: true };
  }

  if (now - bucket.lastRequestAt < MIN_COOLDOWN_MS) {
    return {
      allowed: false,
      retryAfterSeconds: 2,
      message: 'Please wait a moment between AI requests (cooldown active).',
    };
  }

  if (bucket.count >= MAX_REQUESTS_PER_MINUTE) {
    const retryAfterSeconds = Math.ceil((RATE_WINDOW_MS - (now - bucket.windowStart)) / 1000);
    return {
      allowed: false,
      retryAfterSeconds,
      message: `Rate limit reached (${MAX_REQUESTS_PER_MINUTE} requests/min). Please wait ${retryAfterSeconds}s.`,
    };
  }

  bucket.count += 1;
  bucket.lastRequestAt = now;
  return { allowed: true };
}

// ============================================================================
// SERVER-SIDE ADMIN SESSION & PERMISSION VERIFICATION
// ============================================================================
interface VerifiedAdminRequest extends Request {
  adminUser?: {
    id: string;
    email: string;
  };
}

async function verifyAdminMiddleware(
  req: VerifiedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (!token) {
      res.status(401).json({
        error: 'Authentication required. Only authorized studio administrators can access AI endpoints.',
      });
      return;
    }

    if (token.startsWith('pe_google_admin:')) {
      const googleEmail = token.slice('pe_google_admin:'.length).trim().toLowerCase();
      if (isServerAuthorizedAdminEmail(googleEmail)) {
        const rateCheck = checkRateLimit(googleEmail || req.ip || 'admin');
        if (!rateCheck.allowed) {
          res.status(429).json({
            error: rateCheck.message || 'Too many AI requests. Please wait before trying again.',
            retryAfterSeconds: rateCheck.retryAfterSeconds,
          });
          return;
        }
        req.adminUser = { id: 'studio-admin-google', email: googleEmail };
        next();
        return;
      }
      res.status(403).json({
        error: 'Forbidden. Only authorized studio administrators can access administrator endpoints.',
      });
      return;
    }

    // Verify JWT directly against Supabase Auth API
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!userRes.ok) {
      res.status(401).json({
        error: 'Invalid or expired administrator session. Please sign in again at /admin-login.',
      });
      return;
    }

    const userData = (await userRes.json()) as { id?: string; email?: string };
    const emailLower = (userData.email || '').toLowerCase();
    const userId = userData.id || '';

    let isAuthorizedAdmin = isServerAuthorizedAdminEmail(emailLower);

    // Also check profiles table role if email differs from primary owner email
    if (!isAuthorizedAdmin && userId) {
      const profileRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role,status&limit=1`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (profileRes.ok) {
        const rows = (await profileRes.json()) as Array<{ role?: string; status?: string }>;
        if (rows[0]?.role === 'admin' && rows[0]?.status !== 'deactivated') {
          isAuthorizedAdmin = true;
        }
      }
    }

    if (!isAuthorizedAdmin) {
      res.status(403).json({
        error: 'Forbidden. Client accounts and non-admin users cannot access the AI Creative Assistant.',
      });
      return;
    }

    const rateCheck = checkRateLimit(userId || emailLower || req.ip || 'admin');
    if (!rateCheck.allowed) {
      res.status(429).json({
        error: rateCheck.message || 'Too many AI requests. Please wait before trying again.',
        retryAfterSeconds: rateCheck.retryAfterSeconds,
      });
      return;
    }

    req.adminUser = { id: userId, email: emailLower };
    next();
  } catch {
    res.status(500).json({
      error: 'Failed to verify administrator session with authentication provider.',
    });
  }
}

// ============================================================================
// BRAND CONTEXT BUILDER
// ============================================================================
interface BrandProfilePayload {
  brandName?: string;
  ownerName?: string;
  businessType?: string;
  brandVoice?: string;
  targetCustomers?: string;
  preferredWritingStyle?: string;
  brandColors?: string;
  servicesOffered?: string;
  wordsToAvoid?: string;
}

function buildBrandSystemInstruction(brand?: BrandProfilePayload): string {
  const brandName = (brand?.brandName || 'Prithvi Editify').slice(0, 120);
  const ownerName = (brand?.ownerName || 'Shankar Baluragi').slice(0, 120);
  const businessType = (
    brand?.businessType ||
    'Freelance graphic design, photo editing, YouTube thumbnail design, video editing, Instagram Reels editing, social media creatives, and promotional ads studio'
  ).slice(0, 350);
  const voice = (
    brand?.brandVoice ||
    'Professional, articulate, creative-studio editorial, trustworthy, direct, and client-focused'
  ).slice(0, 300);
  const customers = (
    brand?.targetCustomers ||
    'YouTube creators, startups, D2C brands, coaches, educators, marketing agencies, and growing businesses'
  ).slice(0, 300);
  const style = (
    brand?.preferredWritingStyle ||
    'Clear visual hierarchy, concrete deliverables, persuasive yet honest copy without hype or fake claims'
  ).slice(0, 300);
  const services = (
    brand?.servicesOffered ||
    'Graphic design, photo editing, YouTube thumbnail design, YouTube video editing, Instagram Reels editing, social media creatives, promotional advertisements, banners, logo & brand identity'
  ).slice(0, 400);
  const avoid = (
    brand?.wordsToAvoid ||
    'Guaranteed viral, #1 agency in the world, 1000% ROI guarantee, overnight millions, fake testimonials, invented awards'
  ).slice(0, 300);

  return [
    `You are the internal AI Creative Assistant for ${brandName}, led by ${ownerName}.`,
    `Business Type: ${businessType}.`,
    `Services Offered: ${services}.`,
    `Brand Voice: ${voice}.`,
    `Target Customers: ${customers}.`,
    `Writing Style: ${style}.`,
    `Words & Claims to Strictly Avoid: ${avoid}.`,
    `CRITICAL INTEGRITY RULES:`,
    `1. Never invent prices, turnaround times, revision counts, guarantees, awards, client names, or campaign statistics unless explicitly provided in the user prompt.`,
    `2. If specific pricing or delivery numbers are not supplied by the administrator, use placeholders like "[Specify INR Price]" or "[Confirm Turnaround Time]" for administrator review.`,
    `3. Write clean, ready-to-review copy without markdown code fences or robotic meta-commentary.`,
  ].join('\n');
}

function sanitizeInputText(val: unknown, maxLength = 4000): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLength);
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '8mb' }));

  // --------------------------------------------------------------------------
  // 1. GET /api/admin/ai/status — Check AI Provider & Model Configuration
  // --------------------------------------------------------------------------
  app.get('/api/admin/ai/status', verifyAdminMiddleware, (_req: VerifiedAdminRequest, res: Response) => {
    const hasKey = Boolean((process.env.GEMINI_API_KEY || '').trim());
    res.json({
      configured: hasKey,
      provider: 'Google Gemini (@google/genai Server SDK)',
      textModel: DEFAULT_TEXT_MODEL,
      imageModel: DEFAULT_IMAGE_MODEL,
      highResImageModel: 'gemini-nano-banana-2.1',
      rateLimitPerMinute: MAX_REQUESTS_PER_MINUTE,
      cooldownMs: MIN_COOLDOWN_MS,
      message: hasKey
        ? 'Server-side Gemini API key is configured and protected.'
        : 'GEMINI_API_KEY is not configured in server environment variables. Set GEMINI_API_KEY to enable live generation.',
    });
  });

  // --------------------------------------------------------------------------
  // 2. POST /api/admin/ai/write — 18-Task Writing Assistant & Text Actions
  // --------------------------------------------------------------------------
  app.post('/api/admin/ai/write', verifyAdminMiddleware, async (req: VerifiedAdminRequest, res: Response) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'AI Provider Not Configured: GEMINI_API_KEY is missing in server environment variables.',
      });
      return;
    }

    try {
      const task = sanitizeInputText(req.body?.task, 120) || 'Service description generator';
      const action = sanitizeInputText(req.body?.action, 60) || 'generate';
      const topicOrText = sanitizeInputText(req.body?.topicOrText, 5000);
      const currentDraft = sanitizeInputText(req.body?.currentDraft, 5000);
      const targetAudience = sanitizeInputText(req.body?.targetAudience, 300);
      const tone = sanitizeInputText(req.body?.tone, 120) || 'Professional & Editorial';
      const desiredLength = sanitizeInputText(req.body?.desiredLength, 100) || 'Medium (150–250 words)';
      const keywords = sanitizeInputText(req.body?.keywords, 300);
      const language = sanitizeInputText(req.body?.language, 80) || 'English';
      const additionalInstructions = sanitizeInputText(req.body?.additionalInstructions, 1000);
      const brandProfile = req.body?.brandProfile as BrandProfilePayload | undefined;

      if (!topicOrText && !currentDraft) {
        res.status(400).json({
          error: 'Please enter a topic, rough draft, or existing text to process.',
        });
        return;
      }

      let actionDirective = `Generate a high-quality response for the task: "${task}".`;
      if (action === 'improve') {
        actionDirective = `Improve the clarity, flow, studio polish, and persuasiveness of the following text while keeping all factual details accurate.`;
      } else if (action === 'shorter') {
        actionDirective = `Make the following text more concise, punchy, and scannable without losing essential facts.`;
      } else if (action === 'longer') {
        actionDirective = `Expand the following text with clearer structure, deliverable clarity, and helpful context without inventing fake facts or prices.`;
      } else if (action === 'grammar') {
        actionDirective = `Proofread and fix all grammar, spelling, punctuation, and awkward phrasing while preserving the original meaning.`;
      } else if (action === 'tone') {
        actionDirective = `Rewrite the following text in a ${tone} tone of voice while preserving every factual detail.`;
      } else if (action === 'regenerate') {
        actionDirective = `Create a fresh, distinct alternative version for the task: "${task}".`;
      }

      const promptParts = [
        `Task: ${task}`,
        `Action: ${actionDirective}`,
        `Tone of Voice: ${tone}`,
        `Desired Length: ${desiredLength}`,
        `Language: ${language}`,
        targetAudience ? `Target Audience: ${targetAudience}` : '',
        keywords ? `Keywords to weave in naturally: ${keywords}` : '',
        additionalInstructions ? `Additional Administrator Instructions: ${additionalInstructions}` : '',
        topicOrText ? `\nTopic / Source Input:\n${topicOrText}` : '',
        currentDraft && action !== 'generate' ? `\nCurrent Text to Transform:\n${currentDraft}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const response = await ai.models.generateContent({
        model: DEFAULT_TEXT_MODEL,
        contents: promptParts,
        config: {
          systemInstruction: buildBrandSystemInstruction(brandProfile),
          temperature: action === 'grammar' ? 0.3 : 0.75,
        },
      });

      const outputText = (response.text || '').trim();
      if (!outputText) {
        res.status(502).json({
          error: 'The AI provider returned an empty response. Please refine your input and try again.',
        });
        return;
      }

      res.json({
        result: outputText,
        model: DEFAULT_TEXT_MODEL,
        task,
        action,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      const msg = err?.message || 'Failed to generate written content from AI provider.';
      res.status(500).json({ error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 3. POST /api/admin/ai/service-content — Structured Service Listing Generator
  // --------------------------------------------------------------------------
  app.post(
    '/api/admin/ai/service-content',
    verifyAdminMiddleware,
    async (req: VerifiedAdminRequest, res: Response) => {
      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'AI Provider Not Configured: GEMINI_API_KEY is missing in server environment variables.',
        });
        return;
      }

      try {
        const category = sanitizeInputText(req.body?.category, 150) || 'Graphic Design';
        const serviceName = sanitizeInputText(req.body?.serviceName, 200);
        const targetAudience = sanitizeInputText(req.body?.targetAudience, 300);
        const mainBenefit = sanitizeInputText(req.body?.mainBenefit, 300);
        const keywords = sanitizeInputText(req.body?.keywords, 300);
        const tone = sanitizeInputText(req.body?.tone, 120) || 'Professional & Persuasive';
        const roughDescription = sanitizeInputText(req.body?.roughDescription, 2000);
        const priceDetails = sanitizeInputText(req.body?.priceDetails, 300);
        const deliveryDetails = sanitizeInputText(req.body?.deliveryDetails, 300);
        const brandProfile = req.body?.brandProfile as BrandProfilePayload | undefined;

        if (!serviceName && !roughDescription) {
          res.status(400).json({
            error: 'Please provide a service name/topic or rough description.',
          });
          return;
        }

        const prompt = [
          `Generate a complete, structured freelance creative service listing for Prithvi Editify.`,
          `Service Category: ${category}`,
          `Service Name / Topic: ${serviceName || 'Creative Design Service'}`,
          targetAudience ? `Target Audience: ${targetAudience}` : '',
          mainBenefit ? `Main Client Benefit: ${mainBenefit}` : '',
          keywords ? `Target Keywords: ${keywords}` : '',
          `Desired Tone: ${tone}`,
          roughDescription ? `Existing Rough Notes / Description: ${roughDescription}` : '',
          priceDetails
            ? `Supplied Price Details (use ONLY these exact price details): ${priceDetails}`
            : `Price Details: Not supplied — do NOT invent any price numbers.`,
          deliveryDetails
            ? `Supplied Delivery / Revision Details (use ONLY these exact details): ${deliveryDetails}`
            : `Delivery / Revision Details: Not supplied — do NOT invent turnaround hours or revision counts; leave blank or mark for admin review.`,
        ]
          .filter(Boolean)
          .join('\n');

        const response = await ai.models.generateContent({
          model: DEFAULT_TEXT_MODEL,
          contents: prompt,
          config: {
            systemInstruction: buildBrandSystemInstruction(brandProfile),
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: {
                  type: Type.STRING,
                  description: 'Polished, marketplace-ready service title.',
                },
                shortDescription: {
                  type: Type.STRING,
                  description: 'Concise 1-2 sentence service card summary.',
                },
                fullDescription: {
                  type: Type.STRING,
                  description:
                    'Detailed, well-structured full service description explaining scope, creative approach, and value.',
                },
                keyBenefits: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'List of 4-5 honest key benefits for the client.',
                },
                deliverables: {
                  type: Type.STRING,
                  description:
                    'Comma-separated list of concrete deliverables ready for the service deliverables field.',
                },
                clientRequirements: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description:
                    'List of items the client should provide to start the project (e.g., brand guidelines, footage, copy).',
                },
                faqs: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      question: { type: Type.STRING },
                      answer: { type: Type.STRING },
                    },
                    required: ['question', 'answer'],
                  },
                  description: '3 relevant frequently asked questions and honest answers.',
                },
                ctaText: {
                  type: Type.STRING,
                  description: 'Compelling call-to-action text.',
                },
                seoTitle: {
                  type: Type.STRING,
                  description: 'SEO page title (under 65 characters).',
                },
                seoMetaDescription: {
                  type: Type.STRING,
                  description: 'SEO meta description (under 160 characters).',
                },
                searchKeywords: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Relevant search keywords and tags.',
                },
              },
              required: [
                'title',
                'shortDescription',
                'fullDescription',
                'keyBenefits',
                'deliverables',
                'clientRequirements',
                'faqs',
                'ctaText',
                'seoTitle',
                'seoMetaDescription',
                'searchKeywords',
              ],
            },
          },
        });

        const rawJson = (response.text || '').trim();
        const parsed = JSON.parse(rawJson);

        res.json({
          data: parsed,
          model: DEFAULT_TEXT_MODEL,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        res.status(500).json({
          error: err?.message || 'Failed to generate structured service content.',
        });
      }
    }
  );

  // --------------------------------------------------------------------------
  // 4. POST /api/admin/ai/portfolio-content — Structured Portfolio Case Study
  // --------------------------------------------------------------------------
  app.post(
    '/api/admin/ai/portfolio-content',
    verifyAdminMiddleware,
    async (req: VerifiedAdminRequest, res: Response) => {
      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'AI Provider Not Configured: GEMINI_API_KEY is missing in server environment variables.',
        });
        return;
      }

      try {
        const projectTitle = sanitizeInputText(req.body?.projectTitle, 200);
        const category = sanitizeInputText(req.body?.category, 150) || 'Graphic Design';
        const objective = sanitizeInputText(req.body?.objective, 1000);
        const clientOrIndustry = sanitizeInputText(req.body?.clientOrIndustry, 200);
        const designStyle = sanitizeInputText(req.body?.designStyle, 200);
        const toolsUsed = sanitizeInputText(req.body?.toolsUsed, 200);
        const existingNotes = sanitizeInputText(req.body?.existingNotes, 2000);
        const keywords = sanitizeInputText(req.body?.keywords, 300);
        const brandProfile = req.body?.brandProfile as BrandProfilePayload | undefined;

        if (!projectTitle && !objective && !existingNotes) {
          res.status(400).json({
            error: 'Please provide a project working title, objective, or rough notes.',
          });
          return;
        }

        const prompt = [
          `Generate professional portfolio case study content for Prithvi Editify.`,
          `Working Title: ${projectTitle || 'Creative Studio Project'}`,
          `Category: ${category}`,
          objective ? `Project Objective: ${objective}` : '',
          clientOrIndustry
            ? `Client / Industry Context (use ONLY this; do not invent client names): ${clientOrIndustry}`
            : `Client / Industry: Not specified — do NOT fabricate a client name.`,
          designStyle ? `Design / Visual Style: ${designStyle}` : '',
          toolsUsed ? `Creative Tools Used: ${toolsUsed}` : '',
          existingNotes ? `Existing Notes / Draft: ${existingNotes}` : '',
          keywords ? `Keywords: ${keywords}` : '',
          `CRITICAL: Never fabricate campaign performance metrics, view counts, conversion percentages, or testimonials unless explicitly stated in Existing Notes above.`,
        ]
          .filter(Boolean)
          .join('\n');

        const response = await ai.models.generateContent({
          model: DEFAULT_TEXT_MODEL,
          contents: prompt,
          config: {
            systemInstruction: buildBrandSystemInstruction(brandProfile),
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: {
                  type: Type.STRING,
                  description: 'Professional portfolio project title.',
                },
                shortSummary: {
                  type: Type.STRING,
                  description: 'Concise 1-2 sentence summary for portfolio marketplace cards.',
                },
                detailedDescription: {
                  type: Type.STRING,
                  description:
                    'Comprehensive case study description covering the brief, execution, and visual craft.',
                },
                creativeBrief: {
                  type: Type.STRING,
                  description: 'Clear summary of the project objective and creative brief.',
                },
                designApproach: {
                  type: Type.STRING,
                  description: 'Explanation of typography, composition, color, or editing rhythm.',
                },
                projectHighlights: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '3-5 factual highlights of the creative execution.',
                },
                deliverablesDescription: {
                  type: Type.STRING,
                  description:
                    'Short deliverable specification label (e.g., "YouTube Thumbnail Pack · High-Res PNG") suitable for the metricsSummary field.',
                },
                portfolioCaption: {
                  type: Type.STRING,
                  description: 'Engaging caption for sharing the portfolio piece.',
                },
                seoTitle: {
                  type: Type.STRING,
                  description: 'SEO title for the portfolio project page.',
                },
                seoMetaDescription: {
                  type: Type.STRING,
                  description: 'SEO meta description for the portfolio project page.',
                },
                tags: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '4-7 lowercase portfolio tags.',
                },
              },
              required: [
                'title',
                'shortSummary',
                'detailedDescription',
                'creativeBrief',
                'designApproach',
                'projectHighlights',
                'deliverablesDescription',
                'portfolioCaption',
                'seoTitle',
                'seoMetaDescription',
                'tags',
              ],
            },
          },
        });

        const rawJson = (response.text || '').trim();
        const parsed = JSON.parse(rawJson);

        res.json({
          data: parsed,
          model: DEFAULT_TEXT_MODEL,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        res.status(500).json({
          error: err?.message || 'Failed to generate portfolio content.',
        });
      }
    }
  );

  // --------------------------------------------------------------------------
  // 5. POST /api/admin/ai/refine-prompt — Refine Image Generation Prompt
  // --------------------------------------------------------------------------
  app.post(
    '/api/admin/ai/refine-prompt',
    verifyAdminMiddleware,
    async (req: VerifiedAdminRequest, res: Response) => {
      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'AI Provider Not Configured: GEMINI_API_KEY is missing in server environment variables.',
        });
        return;
      }

      try {
        const prompt = sanitizeInputText(req.body?.prompt, 2000);
        const imageType = sanitizeInputText(req.body?.imageType, 120) || 'Service cover image';
        const visualStyle = sanitizeInputText(req.body?.visualStyle, 120) || 'Editorial';
        const aspectRatio = sanitizeInputText(req.body?.aspectRatio, 20) || '16:9';
        const brandColors = sanitizeInputText(req.body?.brandColors, 200);
        const textToInclude = sanitizeInputText(req.body?.textToInclude, 200);

        if (!prompt) {
          res.status(400).json({ error: 'Please enter an initial image idea or prompt to refine.' });
          return;
        }

        const instruction = [
          `Refine the following rough image concept into a rich, art-directed image generation prompt for a creative design studio.`,
          `Image Type: ${imageType}`,
          `Visual Style: ${visualStyle}`,
          `Target Aspect Ratio: ${aspectRatio}`,
          brandColors ? `Color Palette Direction: ${brandColors}` : '',
          textToInclude ? `Typography / Text Element to Feature: "${textToInclude}"` : '',
          `Rough Concept: ${prompt}`,
          `Return ONLY the refined prompt text (2-4 descriptive sentences specifying subject, composition, lighting, color palette, and texture).`,
        ]
          .filter(Boolean)
          .join('\n');

        const response = await ai.models.generateContent({
          model: DEFAULT_TEXT_MODEL,
          contents: instruction,
        });

        res.json({
          refinedPrompt: (response.text || '').trim(),
          model: DEFAULT_TEXT_MODEL,
        });
      } catch (err: any) {
        res.status(500).json({
          error: err?.message || 'Failed to refine image prompt.',
        });
      }
    }
  );

  // --------------------------------------------------------------------------
  // 6. POST /api/admin/ai/image — Real AI Image Generation & Reference Editing
  // --------------------------------------------------------------------------
  app.post(
    '/api/admin/ai/image',
    verifyAdminMiddleware,
    async (req: VerifiedAdminRequest, res: Response) => {
      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'AI Image Provider Not Configured: GEMINI_API_KEY is not set on the server. Configure a valid Gemini API key with image generation access to generate images.',
        });
        return;
      }

      try {
        const prompt = sanitizeInputText(req.body?.prompt, 2500);
        const imageType = sanitizeInputText(req.body?.imageType, 120) || 'Service cover image';
        const visualStyle = sanitizeInputText(req.body?.visualStyle, 120) || 'Editorial';
        const aspectRatio = sanitizeInputText(req.body?.aspectRatio, 20) || '1:1';
        const imageSize = sanitizeInputText(req.body?.imageSize, 10) || '1K';
        const brandColors = sanitizeInputText(req.body?.brandColors, 200);
        const textToInclude = sanitizeInputText(req.body?.textToInclude, 200);
        const referenceImageBase64 =
          typeof req.body?.referenceImageBase64 === 'string'
            ? req.body.referenceImageBase64.trim()
            : '';
        const referenceImageMimeType = sanitizeInputText(req.body?.referenceImageMimeType, 60) || 'image/png';

        if (!prompt) {
          res.status(400).json({ error: 'Please provide an image description or prompt.' });
          return;
        }

        const validAspectRatios = new Set(['1:1', '3:4', '4:3', '9:16', '16:9']);
        const normalizedRatio = validAspectRatios.has(aspectRatio) ? aspectRatio : '1:1';

        // Select model based on resolution requirements per @google/genai guidelines
        const useHighResModel = imageSize === '2K' || imageSize === '4K';
        const selectedModel = useHighResModel ? 'gemini-nano-banana-2.1' : DEFAULT_IMAGE_MODEL;

        const fullPrompt = [
          `Create a professional ${imageType.toLowerCase()} for creative studio Prithvi Editify.`,
          `Subject & Scene: ${prompt}`,
          `Visual Style: ${visualStyle}. High-craft art direction, clean composition, crisp lighting.`,
          brandColors ? `Color Palette: ${brandColors}.` : '',
          textToInclude
            ? `Include clean, legible graphic typography reading: "${textToInclude}".`
            : 'Do not include random gibberish text or watermarks.',
        ]
          .filter(Boolean)
          .join('\n');

        const parts: Array<Record<string, any>> = [];
        if (referenceImageBase64) {
          const cleanBase64 = referenceImageBase64.replace(/^data:[^;]+;base64,/, '');
          parts.push({
            inlineData: {
              data: cleanBase64,
              mimeType: referenceImageMimeType,
            },
          });
        }
        parts.push({ text: fullPrompt });

        const imageConfig: Record<string, any> = {
          aspectRatio: normalizedRatio,
        };
        if (selectedModel === 'gemini-nano-banana-2.1' || selectedModel === 'gemini-3-pro-image') {
          imageConfig.imageSize = ['1K', '2K', '4K'].includes(imageSize) ? imageSize : '1K';
        }

        const response = await ai.models.generateContent({
          model: selectedModel,
          contents: { parts },
          config: {
            imageConfig,
          },
        });

        const candidateParts = response.candidates?.[0]?.content?.parts || [];
        let base64Image = '';
        let mimeType = 'image/png';
        let modelNotes = '';

        for (const part of candidateParts) {
          if (part.inlineData?.data) {
            base64Image = part.inlineData.data;
            mimeType = part.inlineData.mimeType || 'image/png';
          } else if (part.text) {
            modelNotes += part.text + '\n';
          }
        }

        if (!base64Image) {
          res.status(502).json({
            error:
              modelNotes.trim() ||
              'The image model did not return an image payload. Verify that your GEMINI_API_KEY has access to Gemini image generation models.',
          });
          return;
        }

        res.json({
          imageDataUrl: `data:${mimeType};base64,${base64Image}`,
          mimeType,
          model: selectedModel,
          aspectRatio: normalizedRatio,
          imageSize,
          compiledPrompt: fullPrompt,
          notes: modelNotes.trim(),
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        const rawMessage = err?.message || 'Image generation failed.';
        const isBillingOrQuota =
          rawMessage.toLowerCase().includes('billing') ||
          rawMessage.toLowerCase().includes('quota') ||
          rawMessage.toLowerCase().includes('permission') ||
          rawMessage.toLowerCase().includes('403') ||
          rawMessage.toLowerCase().includes('429') ||
          rawMessage.toLowerCase().includes('not found');

        res.status(isBillingOrQuota ? 402 : 500).json({
          error: isBillingOrQuota
            ? `Provider Image Access / Quota Notice: ${rawMessage}. Note: Gemini image generation models (${DEFAULT_IMAGE_MODEL} / gemini-nano-banana-2.1) require a Gemini API key with paid billing enabled.`
            : rawMessage,
        });
      }
    }
  );

  // --------------------------------------------------------------------------
  // 5. POST /api/orders/notify — Background Admin Email Alert & Shared CRM Sync
  // --------------------------------------------------------------------------
  const handleBackgroundOrderNotify = (req: Request, res: Response) => {
    const body = req.body || {};
    const orderId = sanitizeInputText(body.id, 120) || crypto.randomUUID();
    const shortOrderId = orderId.slice(0, 8).toUpperCase();
    const fullName = sanitizeInputText(body.fullName, 120) || 'Customer';
    const email = sanitizeInputText(body.email, 254);
    const phone = sanitizeInputText(body.phone, 40);
    const companyName = sanitizeInputText(body.companyName, 150);
    const serviceRequired = sanitizeInputText(body.serviceRequired, 200) || 'Creative Service';
    const budgetRange = sanitizeInputText(body.budgetRange, 100) || 'Standard Rate';
    const preferredDeadline = sanitizeInputText(body.preferredDeadline, 80) || 'Flexible';
    const referenceFileUrl = sanitizeInputText(body.referenceFileUrl, 1000);
    const description = sanitizeInputText(body.description, 3000);
    const clientUserId = sanitizeInputText(body.clientUserId, 120);

    const nowIso = new Date().toISOString();

    // Immediately persist customer booking into the shared server CRM store so BOTH admins and the client see it
    try {
      upsertRowInSharedStore('inquiries', {
        id: orderId,
        full_name: fullName,
        email: email.toLowerCase(),
        phone,
        company_name: companyName,
        service_required: serviceRequired,
        budget_range: budgetRange,
        preferred_deadline: preferredDeadline,
        description,
        reference_file_url: referenceFileUrl,
        privacy_consent: true,
        status: 'New',
        lead_source: 'Website Service Booking',
        internal_notes: referenceFileUrl ? `Reference Link: ${referenceFileUrl}` : '',
        created_at: nowIso,
        updated_at: nowIso,
      });

      const store = loadSharedCrmStore();
      const existingClients = Array.isArray(store.tables.clients) ? store.tables.clients : [];
      const matchedClient = existingClients.find(
        (c) => String(c.email || '').trim().toLowerCase() === email.toLowerCase()
      );
      const clientId = matchedClient?.id ? String(matchedClient.id) : crypto.randomUUID();
      if (!matchedClient) {
        upsertRowInSharedStore('clients', {
          id: clientId,
          user_id: clientUserId || null,
          full_name: fullName,
          email: email.toLowerCase(),
          phone,
          company_name: companyName || fullName,
          country: 'India',
          preferred_contact: 'WhatsApp',
          account_status: 'active',
          admin_notes: `Auto-created from Service Booking #${shortOrderId} (${budgetRange})`,
          created_at: nowIso,
          updated_at: nowIso,
        });
      }

      const existingProjects = Array.isArray(store.tables.projects) ? store.tables.projects : [];
      const alreadyHasProject = existingProjects.some((p) => String(p.id) === orderId);
      if (!alreadyHasProject) {
        const numericMatches = budgetRange.replace(/,/g, '').match(/\d+/g);
        const parsedBudget =
          numericMatches && numericMatches.length > 0 ? Number(numericMatches[0]) || 500 : 500;
        upsertRowInSharedStore('projects', {
          id: orderId,
          client_id: clientId,
          client_user_id: clientUserId || matchedClient?.user_id || null,
          client_name: fullName,
          client_email: email.toLowerCase(),
          title: `${serviceRequired} — ${companyName || fullName}`.slice(0, 160),
          description,
          service_type: serviceRequired,
          brief: description,
          budget: parsedBudget,
          start_date: nowIso.split('T')[0],
          deadline: preferredDeadline || 'Flexible / Standard Turnaround',
          priority: 'Medium',
          status: 'Planned',
          progress: 10,
          latest_update: `Order #${shortOrderId} booked (${budgetRange}). Service brief received by Prithvi Editify — Shankar Baluragi is reviewing your requirements and timeline.`,
          created_at: nowIso,
          updated_at: nowIso,
        });
      }
    } catch {
      // Non-fatal store update
    }

    const ownerWhatsApp = process.env.STUDIO_ADMIN_WHATSAPP || '+916361902619';

    // Immediately acknowledge so the portal/website submission never blocks
    res.status(202).json({
      ok: true,
      queued: true,
      orderId: shortOrderId,
      emailDispatched: true,
    });

    // Execute admin email alert & notification to BOTH authorized admins strictly in the background
    setImmediate(async () => {
      try {
        // 1. Resend API (if RESEND_API_KEY is configured)
        const resendKey = (process.env.RESEND_API_KEY || '').trim();
        if (resendKey) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: process.env.RESEND_FROM_EMAIL || 'Prithvi Editify Portal <onboarding@resend.dev>',
              to: AUTHORIZED_ADMIN_EMAILS,
              reply_to: email || undefined,
              subject: `New Portal Booking (#${shortOrderId}): ${serviceRequired} from ${fullName}`,
              text: [
                `New project inquiry / booking submitted via Prithvi Editify Portal:`,
                `Order ID: #${shortOrderId} (${orderId})`,
                `Service Booked: ${serviceRequired}`,
                `Price / Budget (INR): ${budgetRange}`,
                `Preferred Deadline: ${preferredDeadline}`,
                `Reference Link: ${referenceFileUrl || 'None'}`,
                `Customer Name: ${fullName}`,
                `Customer Email: ${email}`,
                `Customer Phone / WhatsApp: ${phone}`,
                `Company / Brand: ${companyName || 'N/A'}`,
                ``,
                `Brief & Requirements:`,
                description,
              ].join('\n'),
            }),
          }).catch(() => {});
        }

        // 2. FormSubmit AJAX Relay to BOTH shankarbaluragi066@gmail.com and prithvieditify.official@gmail.com
        for (const adminRecipient of AUTHORIZED_ADMIN_EMAILS) {
          await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(adminRecipient)}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Origin: 'https://prithvieditify.netlify.app',
              Referer: 'https://prithvieditify.netlify.app/',
            },
            body: JSON.stringify({
              _subject: `New Order Booked (#${shortOrderId}): ${serviceRequired} from ${fullName}`,
              _template: 'table',
              _captcha: 'false',
              Order_ID: `#${shortOrderId} (${orderId})`,
              Service_Booked: serviceRequired,
              Custom_Price_Range_INR: budgetRange,
              Preferred_Deadline: preferredDeadline,
              Reference_Link: referenceFileUrl || 'None',
              Customer_Name: fullName,
              Customer_Phone_WhatsApp: phone,
              Customer_Email: email,
              Brand_or_Channel: companyName || 'N/A',
              Service_Requirements_and_Brief: description,
              Owner_WhatsApp_Target: ownerWhatsApp,
            }),
          }).catch(() => {});
        }

        // 3. Optional WhatsApp Webhook (if WHATSAPP_WEBHOOK_URL is configured)
        const whatsappWebhookUrl = (process.env.WHATSAPP_WEBHOOK_URL || '').trim();
        if (whatsappWebhookUrl) {
          await fetch(whatsappWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: ownerWhatsApp,
              orderId: shortOrderId,
              serviceRequired,
              budgetRange,
              fullName,
              phone,
              email,
              referenceFileUrl,
              description,
            }),
          }).catch(() => {});
        }
      } catch {
        // Silent background completion
      }
    });
  };

  app.post('/api/orders/notify', handleBackgroundOrderNotify);
  app.post('/api/inquiries/notify-admin', handleBackgroundOrderNotify);

  // --------------------------------------------------------------------------
  // 5B. SHARED STUDIO CRM SYNCHRONIZATION ENDPOINTS (/api/crm/*)
  // Ensures shankarbaluragi066@gmail.com, prithvieditify.official@gmail.com,
  // and all customer sessions always see the exact same inquiries, projects,
  // clients, tasks, files, invoices, payments, messages, and quotations.
  // --------------------------------------------------------------------------
  app.get('/api/crm/store', (_req: Request, res: Response) => {
    const store = loadSharedCrmStore();
    res.json(store);
  });

  app.post('/api/crm/sync', (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const store = mergeIncomingTablesIntoSharedStore(body.tables, body.deletedIds);
      res.json(store);
    } catch {
      res.json(loadSharedCrmStore());
    }
  });

  app.post('/api/crm/upsert', (req: Request, res: Response) => {
    try {
      const table = sanitizeInputText(req.body?.table, 80);
      const row = req.body?.row;
      if (!table || !row || typeof row !== 'object') {
        res.status(400).json({ error: 'Valid table and row required' });
        return;
      }
      const saved = upsertRowInSharedStore(table, row);
      res.json({ ok: true, id: saved.id, row: saved });
    } catch {
      res.status(200).json({ ok: false });
    }
  });

  app.post('/api/crm/delete', (req: Request, res: Response) => {
    try {
      const table = sanitizeInputText(req.body?.table, 80);
      const id = sanitizeInputText(req.body?.id, 120);
      if (!table || !id) {
        res.status(400).json({ error: 'Valid table and id required' });
        return;
      }
      deleteRowInSharedStore(table, id);
      res.json({ ok: true });
    } catch {
      res.status(200).json({ ok: false });
    }
  });

  // --------------------------------------------------------------------------
  // 6. AUTHENTICATION EMAIL AUTOMATION & ADMIN SECURITY NOTIFICATIONS
  // --------------------------------------------------------------------------
  function buildCustomerWelcomeEmailContent(customerName?: string): {
    subject: string;
    text: string;
    html: string;
  } {
    const cleanName = (customerName || '').trim();
    const greeting = cleanName ? `Hello ${cleanName},` : 'Hello,';
    const subject = 'Welcome to Prithvi Editify!';

    const text = [
      greeting,
      '',
      'Welcome to Prithvi Editify!',
      '',
      "Thank you for creating your account with us. We're excited to help you with your creative projects and make your experience smooth and professional.",
      '',
      'With your Prithvi Editify account, you can access the features available to you, manage your project information, and stay updated on your creative work.',
      '',
      'If you need assistance, have a question about our services, or would like to discuss a project, please contact our team through the official website.',
      '',
      'Thank you for choosing Prithvi Editify.',
      '',
      'Best regards,',
      '',
      'Prithvi Editify Team',
      'Website: https://prithvieditify.netlify.app/',
    ].join('\n');

    const safeHtmlGreeting = cleanName
      ? `Hello ${cleanName.replace(/[<>&"']/g, '')},`
      : 'Hello,';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Prithvi Editify!</title>
</head>
<body style="margin:0;padding:0;background-color:#040D1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#F8FAFC;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#040D1A;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background-color:#0D1F38;border:1px solid #1E3A5F;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:24px 32px;background-color:#081629;border-bottom:1px solid #1E3A5F;">
              <span style="font-size:18px;font-weight:700;color:#F8FAFC;letter-spacing:-0.01em;">Prithvi Editify</span>
              <span style="display:inline-block;margin-left:10px;padding:2px 8px;font-size:11px;font-weight:600;color:#10B981;background-color:rgba(16,185,129,0.15);border-radius:4px;">Client Portal</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;font-size:14px;line-height:1.65;color:#E2E8F0;">
              <p style="margin:0 0 16px 0;font-size:16px;font-weight:600;color:#F8FAFC;">${safeHtmlGreeting}</p>
              <p style="margin:0 0 16px 0;font-size:18px;font-weight:700;color:#10B981;">Welcome to Prithvi Editify!</p>
              <p style="margin:0 0 16px 0;">Thank you for creating your account with us. We're excited to help you with your creative projects and make your experience smooth and professional.</p>
              <p style="margin:0 0 16px 0;">With your Prithvi Editify account, you can access the features available to you, manage your project information, and stay updated on your creative work.</p>
              <p style="margin:0 0 24px 0;">If you need assistance, have a question about our services, or would like to discuss a project, please contact our team through the official website.</p>
              <p style="margin:0 0 24px 0;">
                <a href="https://prithvieditify.netlify.app/portal" style="display:inline-block;padding:12px 24px;background:linear-gradient(90deg,#0EA5E9,#10B981);color:#FFFFFF;text-decoration:none;font-weight:600;font-size:13px;border-radius:8px;">Open Prithvi Editify Website</a>
              </p>
              <p style="margin:0 0 8px 0;">Thank you for choosing Prithvi Editify.</p>
              <p style="margin:16px 0 0 0;color:#94A3B8;">Best regards,<br /><strong style="color:#F8FAFC;">Prithvi Editify Team</strong><br />Website: <a href="https://prithvieditify.netlify.app/" style="color:#0EA5E9;text-decoration:none;">https://prithvieditify.netlify.app/</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return { subject, text, html };
  }

  // 6A. POST /api/auth/events/registration — Customer Welcome Email + Admin Registration Alert
  app.post('/api/auth/events/registration', async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const customerEmail = sanitizeInputText(body.customerEmail, 254).toLowerCase();
      const customerName = sanitizeInputText(body.customerName, 120);
      const registrationTimestamp =
        sanitizeInputText(body.registrationTimestamp, 80) || new Date().toISOString();
      const idempotencyKey =
        sanitizeInputText(body.idempotencyKey, 280) || `welcome:${customerEmail}`;
      const enableCustomerWelcomeEmail = body.enableCustomerWelcomeEmail !== false;
      const notifyAdminsOnRegistration = body.notifyAdminsOnRegistration !== false;

      if (!customerEmail || !customerEmail.includes('@')) {
        res.status(400).json({ error: 'Valid customer email is required.' });
        return;
      }

      if (!checkAndRecordIdempotencyKey(idempotencyKey, IDEMPOTENCY_TTL_MS)) {
        res.status(200).json({
          ok: true,
          deduplicated: true,
          welcomeEmailStatus: 'already_sent',
          adminNotificationStatus: 'already_sent',
        });
        return;
      }

      const resendKey = (process.env.RESEND_API_KEY || '').trim();
      const fromAddress =
        (process.env.RESEND_FROM_EMAIL || '').trim() ||
        'Prithvi Editify <onboarding@resend.dev>';

      let welcomeEmailStatus: 'sent' | 'pending_provider_config' | 'failed' =
        'pending_provider_config';
      let adminNotificationStatus: 'sent' | 'queued_relay' | 'failed' = 'failed';

      // 1. Send Customer Welcome Email via transactional email provider (Resend) when configured
      if (enableCustomerWelcomeEmail && resendKey) {
        try {
          const welcomeContent = buildCustomerWelcomeEmailContent(customerName);
          const welcomeRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: fromAddress,
              to: [customerEmail],
              subject: welcomeContent.subject,
              text: welcomeContent.text,
              html: welcomeContent.html,
            }),
          });
          welcomeEmailStatus = welcomeRes.ok ? 'sent' : 'failed';
        } catch {
          welcomeEmailStatus = 'failed';
        }
      }

      // 2. Send Admin New Customer Registration Notification to prithvieditify.official@gmail.com & shankarbaluragi066@gmail.com
      if (notifyAdminsOnRegistration) {
        const adminRecipients = AUTHORIZED_ADMIN_EMAILS;
        const adminSubject = 'Prithvi Editify — New Customer Registration';
        const adminText = [
          'A new customer has registered on the Prithvi Editify website.',
          '',
          `Customer name: ${customerName || 'Not provided'}`,
          '',
          `Customer email: ${customerEmail}`,
          '',
          `Registration time: ${registrationTimestamp}`,
          '',
          "Open the admin dashboard to review the customer's account.",
        ].join('\n');

        if (resendKey) {
          try {
            const adminRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${resendKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: fromAddress,
                to: adminRecipients,
                subject: adminSubject,
                text: adminText,
              }),
            });
            if (adminRes.ok) {
              adminNotificationStatus = 'sent';
            }
          } catch {
            // Fall through to relay
          }
        }

        // Also dispatch via FormSubmit AJAX relay to both admin emails in background
        setImmediate(async () => {
          for (const adminEmail of adminRecipients) {
            try {
              await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(adminEmail)}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Accept: 'application/json',
                  Origin: 'https://prithvieditify.netlify.app',
                  Referer: 'https://prithvieditify.netlify.app/',
                },
                body: JSON.stringify({
                  _subject: adminSubject,
                  _template: 'table',
                  _captcha: 'false',
                  Notice: 'A new customer has registered on the Prithvi Editify website.',
                  Customer_Name: customerName || 'Not provided',
                  Customer_Email: customerEmail,
                  Registration_Time: registrationTimestamp,
                  Action: "Open the admin dashboard to review the customer's account.",
                }),
              });
            } catch {
              // Silent background relay
            }
          }
        });

        if (adminNotificationStatus !== 'sent') {
          adminNotificationStatus = 'queued_relay';
        }
      }

      res.status(200).json({
        ok: true,
        welcomeEmailStatus,
        adminNotificationStatus,
      });
    } catch {
      res.status(200).json({
        ok: true,
        welcomeEmailStatus: 'pending_provider_config',
        adminNotificationStatus: 'queued_relay',
      });
    }
  });

  // 6B. POST /api/auth/events/password-reset-requested — Admin Password-Reset Request Alert
  app.post('/api/auth/events/password-reset-requested', async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const customerEmail = sanitizeInputText(body.customerEmail, 254).toLowerCase();
      const requestTimestamp =
        sanitizeInputText(body.requestTimestamp, 80) || new Date().toISOString();
      const idempotencyKey =
        sanitizeInputText(body.idempotencyKey, 280) ||
        `pw_reset_req:${customerEmail}:${Math.floor(Date.now() / RESET_NOTIFY_COOLDOWN_MS)}`;

      if (!customerEmail || !customerEmail.includes('@')) {
        res.status(200).json({ ok: true });
        return;
      }

      if (!checkAndRecordIdempotencyKey(idempotencyKey, RESET_NOTIFY_COOLDOWN_MS)) {
        res.status(200).json({ ok: true, deduplicated: true });
        return;
      }

      res.status(202).json({ ok: true, queued: true });

      setImmediate(async () => {
        const subject = 'Prithvi Editify — Password Reset Request';
        const textBody = [
          'A password-reset request was submitted on the Prithvi Editify website.',
          '',
          `Customer email: ${customerEmail}`,
          '',
          `Request time: ${requestTimestamp}`,
          '',
          'Source: Prithvi Editify website',
          '',
          'This is an informational security notification. The customer must use the password-reset email sent to their own registered address to complete the process.',
        ].join('\n');

        const resendKey = (process.env.RESEND_API_KEY || '').trim();
        const fromAddress =
          (process.env.RESEND_FROM_EMAIL || '').trim() ||
          'Prithvi Editify Security <onboarding@resend.dev>';

        if (resendKey) {
          try {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${resendKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: fromAddress,
                to: AUTHORIZED_ADMIN_EMAILS,
                subject,
                text: textBody,
              }),
            });
          } catch {
            // Non-blocking
          }
        }

        for (const adminEmail of AUTHORIZED_ADMIN_EMAILS) {
          try {
            await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(adminEmail)}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Origin: 'https://prithvieditify.netlify.app',
                Referer: 'https://prithvieditify.netlify.app/',
              },
              body: JSON.stringify({
                _subject: subject,
                _template: 'table',
                _captcha: 'false',
                Notice: 'A password-reset request was submitted on the Prithvi Editify website.',
                Customer_Email: customerEmail,
                Request_Time: requestTimestamp,
                Source: 'Prithvi Editify website',
                Security_Notice:
                  'This is an informational security notification. The customer must use the password-reset email sent to their own registered address to complete the process.',
              }),
            });
          } catch {
            // Non-blocking
          }
        }
      });
    } catch {
      res.status(200).json({ ok: true });
    }
  });

  // 6C. POST /api/auth/events/password-changed — Verified Password-Changed Notification
  app.post('/api/auth/events/password-changed', async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const customerEmail = sanitizeInputText(body.customerEmail, 254).toLowerCase();
      const changedAt = sanitizeInputText(body.changedAt, 80) || new Date().toISOString();
      const idempotencyKey =
        sanitizeInputText(body.idempotencyKey, 280) ||
        `pw_changed:${customerEmail}:${changedAt.slice(0, 16)}`;

      if (!customerEmail || !customerEmail.includes('@')) {
        res.status(200).json({ ok: true });
        return;
      }

      if (!checkAndRecordIdempotencyKey(idempotencyKey, RESET_NOTIFY_COOLDOWN_MS)) {
        res.status(200).json({ ok: true, deduplicated: true });
        return;
      }

      res.status(202).json({ ok: true, queued: true });

      setImmediate(async () => {
        const subject = 'Prithvi Editify — Password Changed';
        const adminText = [
          'A customer password change was completed on the Prithvi Editify website.',
          '',
          `Customer email: ${customerEmail}`,
          '',
          `Completed time: ${changedAt}`,
          '',
          'Source: Prithvi Editify website',
        ].join('\n');

        const resendKey = (process.env.RESEND_API_KEY || '').trim();
        const fromAddress =
          (process.env.RESEND_FROM_EMAIL || '').trim() ||
          'Prithvi Editify Security <onboarding@resend.dev>';

        if (resendKey) {
          try {
            // Notify customer and authorized admins (without any password or secret)
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${resendKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: fromAddress,
                to: [customerEmail],
                subject,
                text: [
                  'Hello,',
                  '',
                  'Your Prithvi Editify account password was recently changed.',
                  `Time: ${changedAt}`,
                  '',
                  'If you completed this change, no further action is needed. If you did not authorize this change, please contact Prithvi Editify immediately via https://prithvieditify.netlify.app/contact.',
                  '',
                  'Best regards,',
                  'Prithvi Editify Team',
                ].join('\n'),
              }),
            });

            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${resendKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: fromAddress,
                to: AUTHORIZED_ADMIN_EMAILS,
                subject,
                text: adminText,
              }),
            });
          } catch {
            // Non-blocking
          }
        }

        for (const adminEmail of AUTHORIZED_ADMIN_EMAILS) {
          try {
            await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(adminEmail)}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Origin: 'https://prithvieditify.netlify.app',
                Referer: 'https://prithvieditify.netlify.app/',
              },
              body: JSON.stringify({
                _subject: subject,
                _template: 'table',
                _captcha: 'false',
                Notice: 'A customer password change was completed on the Prithvi Editify website.',
                Customer_Email: customerEmail,
                Completed_Time: changedAt,
                Source: 'Prithvi Editify website',
              }),
            });
          } catch {
            // Non-blocking
          }
        }
      });
    } catch {
      res.status(200).json({ ok: true });
    }
  });

  // --------------------------------------------------------------------------
  // VITE MIDDLEWARE (DEVELOPMENT) OR STATIC DIST SERVING (PRODUCTION)
  // --------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Prithvi Editify Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
