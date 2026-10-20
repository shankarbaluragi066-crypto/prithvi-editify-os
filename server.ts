import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const STUDIO_ADMIN_EMAIL = (
  process.env.STUDIO_ADMIN_EMAIL || 'shankarbaluragi066@gmail.com'
).toLowerCase();

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

    let isAuthorizedAdmin = emailLower === STUDIO_ADMIN_EMAIL;

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
