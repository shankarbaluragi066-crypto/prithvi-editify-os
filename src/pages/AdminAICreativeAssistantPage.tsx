import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Sparkles,
  Wand2,
  Image as ImageIcon,
  Layers,
  Briefcase,
  ShieldCheck,
  History,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Download,
  Eye,
  ArrowRight,
  AlertCircle,
  Upload,
  CheckCircle2,
  Sliders,
  FileText,
  Printer,
  Plus,
  Share2,
  MessageSquare,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  GitBranch,
} from 'lucide-react';
import {
  fetchAIProviderStatus,
  generateWrittenContent,
  generateStructuredServiceContent,
  generateStructuredPortfolioContent,
  refineAIImagePrompt,
  generateAIImage,
  saveGeneratedImageToMediaLibrary,
  getSavedBrandProfile,
  saveBrandProfile,
  DEFAULT_AI_BRAND_PROFILE,
  getAIUsageHistory,
  clearAIUsageHistory,
  AIProviderStatusResponse,
  AIImageGenerationResult,
  fetchAllQuotationsAdmin,
  saveQuotationAdmin,
  deleteQuotationAdmin,
  checkQuotationDeleteEligibilityAdmin,
  archiveQuotationAdmin,
  createQuotationRevisionAdmin,
  duplicateQuotationAdmin,
  generateDocumentNumber,
  inferQuotationDocumentType,
} from '../services/aiAssistantService';
import {
  DependencySafeDeleteModal,
  SafeDeleteModalConfig,
  UnsavedChangesDialog,
  RecordActionBar,
} from '../components/CrudManagementModals';
import {
  fetchAllServicesAdmin,
  fetchAllPortfolioAdmin,
  fetchAllClientsAdmin,
  fetchAllInquiriesAdmin,
  fetchAllProjectsAdmin,
  saveProjectAdmin,
  saveInvoiceWithLineItemsAdmin,
  updateInquiryAdmin,
} from '../services/crmService';
import {
  GstTaxMode,
  calculateGstBreakdown,
  getInvoiceGstMeta,
  saveInvoiceGstMeta,
  buildPublicQuotationShareUrl,
  buildWhatsAppQuotationShareUrl,
  generateAIDraftedQuotationFromInquiry,
} from '../services/workflowEnhancementsService';
import { UpiQrCodeCard } from '../components/StudioEnhancements';
import {
  AIBrandProfile,
  AIUsageHistoryEntry,
  GeneratedServiceAIContent,
  GeneratedPortfolioAIContent,
  ServiceItem,
  PortfolioItem,
  QuotationRecord,
  QuotationStatus,
  QuotationDocumentType,
  ClientRecord,
  InquiryRecord,
  ProjectRecord,
} from '../types/crm';
import { MediaPreviewModal, PreviewableMediaItem } from '../components/MediaPreviewModal';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { formatINR, calculateInvoiceTotals } from '../utils/formatters';

// ============================================================================
// CONSTANTS & SUPPORTED OPTIONS
// ============================================================================
export const WRITING_ASSISTANT_TASKS = [
  '1. Service title generator',
  '2. Service description generator',
  '3. Short service summary',
  '4. Portfolio project title',
  '5. Portfolio project description',
  '6. Project overview and creative brief',
  '7. Deliverables description',
  '8. Social media captions',
  '9. Promotional advertising copy',
  '10. YouTube video titles and descriptions',
  '11. Instagram Reels captions',
  '12. YouTube thumbnail text ideas',
  '13. SEO page titles and meta descriptions',
  '14. Client inquiry responses',
  '15. Professional emails and proposals',
  '16. Calls to action',
  '17. Grammar correction and proofreading',
  '18. Rewrite in a professional, persuasive, friendly, or concise tone',
] as const;

const TONE_OPTIONS = [
  'Professional & Editorial',
  'Persuasive & High-Converting',
  'Friendly & Approachable',
  'Concise & Direct',
  'Premium Creative Agency',
  'Bold & Energetic',
] as const;

const LENGTH_OPTIONS = [
  'Short (40–80 words)',
  'Medium (120–220 words)',
  'Detailed (250–400 words)',
  'Bullet Points / Scannable List',
] as const;

const IMAGE_TYPES = [
  'Service cover image',
  'Portfolio concept',
  'Social media creative',
  'Promotional advertisement background',
  'YouTube thumbnail concept',
  'Banner or flyer concept',
  'Abstract background',
  'General creative asset',
] as const;

const VISUAL_STYLES = [
  'Minimalist',
  'Modern corporate',
  'Editorial',
  'Premium luxury',
  'Bold and colorful',
  'Cinematic',
  'Photorealistic',
  '3D illustration',
  'Flat illustration',
  'Custom prompt',
] as const;

const ASPECT_RATIOS: Array<{ value: '1:1' | '16:9' | '4:3' | '3:4' | '9:16'; label: string }> = [
  { value: '16:9', label: '16:9 (Widescreen / YouTube / Service Cover)' },
  { value: '4:3', label: '4:3 (Portfolio Card / Presentation)' },
  { value: '1:1', label: '1:1 (Square / Social Post)' },
  { value: '3:4', label: '3:4 (Portrait / Poster)' },
  { value: '9:16', label: '9:16 (Instagram Reel / Story)' },
];

type AssistantTab = 'writing' | 'service' | 'portfolio' | 'image' | 'brand' | 'usage';

// ============================================================================
// 1. ADMIN AI CREATIVE ASSISTANT WORKSPACE (/admin/ai-assistant)
// ============================================================================
export const AdminAICreativeAssistantPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const { showToast, confirmAction } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const initialTab = ((location.state as any)?.tab as AssistantTab) || 'writing';
  const [activeTab, setActiveTab] = useState<AssistantTab>(initialTab);

  // Provider Status & Catalog Context
  const [providerStatus, setProviderStatus] = useState<AIProviderStatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string>('');
  const [existingServices, setExistingServices] = useState<ServiceItem[]>([]);
  const [existingPortfolio, setExistingPortfolio] = useState<PortfolioItem[]>([]);

  // Brand Profile State
  const [brandProfile, setBrandProfile] = useState<AIBrandProfile>(() => getSavedBrandProfile());
  const [usageHistory, setUsageHistory] = useState<AIUsageHistoryEntry[]>(() =>
    getAIUsageHistory()
  );

  // 1. Writing Assistant State
  const [writeForm, setWriteForm] = useState({
    task: WRITING_ASSISTANT_TASKS[1] as string,
    topicOrText: '',
    targetAudience: 'YouTube creators, startups, and D2C brands',
    tone: 'Professional & Editorial',
    desiredLength: 'Medium (120–220 words)',
    keywords: '',
    language: 'English',
    additionalInstructions: '',
  });
  const [writeOutput, setWriteOutput] = useState('');
  const [writeLoading, setWriteLoading] = useState(false);
  const [writeError, setWriteError] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 2. Service Content Generator State
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [srvForm, setSrvForm] = useState({
    category: 'Graphic Design',
    serviceName: '',
    targetAudience: 'Founders, marketers, and content creators',
    mainBenefit: 'Stand out with custom, studio-grade visuals delivered on schedule',
    keywords: 'graphic design, custom creative, brand visuals',
    tone: 'Professional & Editorial',
    roughDescription: '',
    priceDetails: '',
    deliveryDetails: '',
  });
  const [srvResult, setSrvResult] = useState<GeneratedServiceAIContent | null>(null);
  const [srvLoading, setSrvLoading] = useState(false);
  const [srvError, setSrvError] = useState('');

  // 3. Portfolio Content Generator State
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('');
  const [portForm, setPortForm] = useState({
    projectTitle: '',
    category: 'Graphic Design',
    objective: '',
    clientOrIndustry: '',
    designStyle: 'Editorial, bold typography, high-contrast composition',
    toolsUsed: 'Adobe Photoshop, Illustrator, After Effects, Premiere Pro',
    existingNotes: '',
    keywords: '',
  });
  const [portResult, setPortResult] = useState<GeneratedPortfolioAIContent | null>(null);
  const [portLoading, setPortLoading] = useState(false);
  const [portError, setPortError] = useState('');

  // 4. AI Image Studio State
  const [imgForm, setImgForm] = useState({
    prompt: '',
    imageType: 'Service cover image',
    visualStyle: 'Editorial',
    aspectRatio: '16:9' as '1:1' | '16:9' | '4:3' | '3:4' | '9:16',
    imageSize: '1K' as '1K' | '2K' | '4K',
    brandColors: 'Midnight Slate (#172333), Warm Alabaster (#F5F5F1), Terracotta (#F18A45)',
    textToInclude: '',
    referenceImageBase64: '',
    referenceImageMimeType: 'image/png',
    referenceImageName: '',
  });
  const [imgResult, setImgResult] = useState<AIImageGenerationResult | null>(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [refiningPrompt, setRefiningPrompt] = useState(false);
  const [savingToLibrary, setSavingToLibrary] = useState(false);
  const [imgError, setImgError] = useState('');
  const [previewMedia, setPreviewMedia] = useState<PreviewableMediaItem | null>(null);

  const refreshStatusAndCatalog = useCallback(async () => {
    try {
      const status = await fetchAIProviderStatus();
      setProviderStatus(status);
      setStatusError('');
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Unable to check AI status.');
    }

    Promise.all([
      fetchAllServicesAdmin().catch(() => []),
      fetchAllPortfolioAdmin().catch(() => []),
    ]).then(([srvs, ports]) => {
      setExistingServices(srvs);
      setExistingPortfolio(ports);
    });
  }, []);

  useEffect(() => {
    refreshStatusAndCatalog();
  }, [refreshStatusAndCatalog]);

  // Pre-populate if navigated from AdminServicesPage or AdminPortfolioPage with context
  useEffect(() => {
    const state = location.state as any;
    if (!state) return;
    if (state.tab) setActiveTab(state.tab);
    if (state.serviceContext) {
      const sc = state.serviceContext;
      setSrvForm((prev) => ({
        ...prev,
        category: sc.category || prev.category,
        serviceName: sc.title || prev.serviceName,
        roughDescription: sc.description || prev.roughDescription,
        priceDetails: sc.priceDisplay || prev.priceDetails,
        deliveryDetails: [sc.turnaroundTime, sc.revisions, sc.deliverablesSummary]
          .filter(Boolean)
          .join(' · '),
      }));
    }
    if (state.portfolioContext) {
      const pc = state.portfolioContext;
      setPortForm((prev) => ({
        ...prev,
        projectTitle: pc.title || prev.projectTitle,
        category: pc.category || prev.category,
        existingNotes: pc.description || prev.existingNotes,
        keywords: Array.isArray(pc.tags) ? pc.tags.join(', ') : prev.keywords,
      }));
    }
    if (state.imageContext) {
      const ic = state.imageContext;
      setImgForm((prev) => ({
        ...prev,
        prompt: ic.prompt || prev.prompt,
        imageType: ic.imageType || prev.imageType,
      }));
    }
  }, [location.state]);

  if (!isAdmin) {
    return (
      <div className="bg-white border border-[#E2E4DF] rounded-lg p-8 text-center space-y-3">
        <h1 className="font-editorial text-xl font-semibold text-[#172333]">
          Administrator Access Required
        </h1>
        <p className="text-xs text-[#6E7785]">
          The Prithvi Editify AI Creative Assistant is restricted exclusively to authorized studio administrators.
        </p>
      </div>
    );
  }

  const handleCopyText = async (text: string, key: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      showToast('success', 'Copied to Clipboard');
      setTimeout(() => setCopiedKey(null), 2200);
    } catch {
      showToast('error', 'Failed to copy text');
    }
  };

  // --------------------------------------------------------------------------
  // HANDLERS: WRITING ASSISTANT
  // --------------------------------------------------------------------------
  const handleRunWritingAction = async (
    action: 'generate' | 'regenerate' | 'improve' | 'shorter' | 'longer' | 'grammar' | 'tone'
  ) => {
    if (!writeForm.topicOrText.trim() && !writeOutput.trim()) {
      setWriteError('Please enter a topic, rough draft, or existing text first.');
      return;
    }
    setWriteLoading(true);
    setWriteError('');
    try {
      const res = await generateWrittenContent({
        ...writeForm,
        action,
        currentDraft: writeOutput,
        brandProfile,
      });
      setWriteOutput(res.result);
      setUsageHistory(getAIUsageHistory());
      showToast('success', 'AI Content Ready', `Completed "${action}" using ${res.model}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI writing request failed.';
      setWriteError(message);
      setUsageHistory(getAIUsageHistory());
      showToast('error', 'AI Request Failed', message);
    } finally {
      setWriteLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // HANDLERS: SERVICE CONTENT GENERATOR
  // --------------------------------------------------------------------------
  const handleSelectExistingService = (id: string) => {
    setSelectedServiceId(id);
    const found = existingServices.find((s) => s.id === id);
    if (!found) return;
    setSrvForm((prev) => ({
      ...prev,
      category: found.category || prev.category,
      serviceName: found.title || prev.serviceName,
      roughDescription: found.description || prev.roughDescription,
      priceDetails: found.priceDisplay || `₹${found.startingPrice}/${found.pricingUnit || 'design'}`,
      deliveryDetails: `${found.turnaroundTime || '24–48 hours'} · ${
        found.revisions || '2 Revisions'
      } · Deliverables: ${found.deliverablesSummary || ''}`,
    }));
  };

  const handleGenerateServiceContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!srvForm.serviceName.trim() && !srvForm.roughDescription.trim()) {
      setSrvError('Please enter a service name/topic or rough description.');
      return;
    }
    setSrvLoading(true);
    setSrvError('');
    try {
      const res = await generateStructuredServiceContent({
        ...srvForm,
        brandProfile,
      });
      setSrvResult(res.data);
      setUsageHistory(getAIUsageHistory());
      showToast('success', 'Service Listing Generated', 'Review and edit fields below before applying.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Service content generation failed.';
      setSrvError(message);
      setUsageHistory(getAIUsageHistory());
      showToast('error', 'Generation Failed', message);
    } finally {
      setSrvLoading(false);
    }
  };

  const handleApplyServiceContentToForm = () => {
    if (!srvResult) return;
    navigate('/admin/services', {
      state: {
        aiGeneratedService: {
          existingServiceId: selectedServiceId || undefined,
          title: srvResult.title,
          category: srvForm.category,
          description: srvResult.fullDescription,
          deliverablesSummary: srvResult.deliverables,
          seoTitle: srvResult.seoTitle,
          seoMetaDescription: srvResult.seoMetaDescription,
        },
      },
    });
  };

  // --------------------------------------------------------------------------
  // HANDLERS: PORTFOLIO CONTENT GENERATOR
  // --------------------------------------------------------------------------
  const handleSelectExistingPortfolio = (id: string) => {
    setSelectedPortfolioId(id);
    const found = existingPortfolio.find((p) => p.id === id);
    if (!found) return;
    setPortForm((prev) => ({
      ...prev,
      projectTitle: found.title,
      category: found.category,
      existingNotes: found.description,
      keywords: (found.tags || []).join(', '),
    }));
  };

  const handleGeneratePortfolioContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !portForm.projectTitle.trim() &&
      !portForm.objective.trim() &&
      !portForm.existingNotes.trim()
    ) {
      setPortError('Please enter a project title, objective, or rough notes.');
      return;
    }
    setPortLoading(true);
    setPortError('');
    try {
      const res = await generateStructuredPortfolioContent({
        ...portForm,
        brandProfile,
      });
      setPortResult(res.data);
      setUsageHistory(getAIUsageHistory());
      showToast('success', 'Portfolio Case Study Generated', 'Review the fields below before applying.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Portfolio generation failed.';
      setPortError(message);
      setUsageHistory(getAIUsageHistory());
      showToast('error', 'Generation Failed', message);
    } finally {
      setPortLoading(false);
    }
  };

  const handleApplyPortfolioContentToForm = () => {
    if (!portResult) return;
    navigate('/admin/portfolio', {
      state: {
        aiGeneratedPortfolio: {
          existingPortfolioId: selectedPortfolioId || undefined,
          title: portResult.title,
          category: portForm.category,
          description: portResult.detailedDescription,
          metricsSummary: portResult.deliverablesDescription,
          tagsInput: (portResult.tags || []).join(', '),
        },
      },
    });
  };

  // --------------------------------------------------------------------------
  // HANDLERS: AI IMAGE STUDIO
  // --------------------------------------------------------------------------
  const handleReferenceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      showToast('error', 'File Too Large', 'Reference image must be under 4 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setImgForm((prev) => ({
        ...prev,
        referenceImageBase64: result,
        referenceImageMimeType: file.type || 'image/png',
        referenceImageName: file.name,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleRefinePrompt = async () => {
    if (!imgForm.prompt.trim()) {
      setImgError('Enter an initial image concept first so AI can refine it.');
      return;
    }
    setRefiningPrompt(true);
    setImgError('');
    try {
      const res = await refineAIImagePrompt({
        prompt: imgForm.prompt,
        imageType: imgForm.imageType,
        visualStyle: imgForm.visualStyle,
        aspectRatio: imgForm.aspectRatio,
        brandColors: imgForm.brandColors,
        textToInclude: imgForm.textToInclude,
      });
      if (res.refinedPrompt) {
        setImgForm((prev) => ({ ...prev, prompt: res.refinedPrompt }));
        showToast('success', 'Prompt Refined', 'Updated with art-direction details.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refine prompt.';
      setImgError(message);
      showToast('error', 'Prompt Refinement Failed', message);
    } finally {
      setRefiningPrompt(false);
    }
  };

  const executeImageGeneration = async () => {
    setImgLoading(true);
    setImgError('');
    try {
      const res = await generateAIImage({
        prompt: imgForm.prompt,
        imageType: imgForm.imageType,
        visualStyle: imgForm.visualStyle,
        aspectRatio: imgForm.aspectRatio,
        imageSize: imgForm.imageSize,
        brandColors: imgForm.brandColors,
        textToInclude: imgForm.textToInclude,
        referenceImageBase64: imgForm.referenceImageBase64 || undefined,
        referenceImageMimeType: imgForm.referenceImageMimeType || undefined,
      });
      setImgResult(res);
      setUsageHistory(getAIUsageHistory());
      showToast('success', 'Image Generated', `Created with ${res.model} (${res.aspectRatio}).`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Image generation failed.';
      setImgError(message);
      setUsageHistory(getAIUsageHistory());
      showToast('error', 'Image Generation Error', message);
    } finally {
      setImgLoading(false);
    }
  };

  const handleRequestImageGeneration = () => {
    if (!imgForm.prompt.trim()) {
      setImgError('Please describe the image you want to generate.');
      return;
    }
    const targetModel =
      imgForm.imageSize !== '1K'
        ? 'gemini-nano-banana-2.1'
        : providerStatus?.imageModel || 'gemini-3.1-flash-lite-image';

    confirmAction({
      title: 'Confirm AI Image Generation Request',
      message: `Generate a ${imgForm.imageSize} (${imgForm.aspectRatio}) "${imgForm.imageType}" using ${targetModel}? Image generation consumes provider API quota.`,
      onConfirm: executeImageGeneration,
    });
  };

  const handleDownloadGeneratedImage = () => {
    if (!imgResult?.imageDataUrl) return;
    const link = document.createElement('a');
    link.href = imgResult.imageDataUrl;
    link.download = `prithvi-editify-ai-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveImageToBucket = (bucket: 'service-media' | 'portfolio-media', destination: 'library' | 'service' | 'portfolio') => {
    if (!imgResult?.imageDataUrl) return;
    confirmAction({
      title: 'Confirm Upload to Studio Storage',
      message: `Upload this generated image to the "${bucket}" storage bucket${
        destination !== 'library' ? ` and open the ${destination} editor` : ''
      }?`,
      onConfirm: async () => {
        setSavingToLibrary(true);
        try {
          const uploaded = await saveGeneratedImageToMediaLibrary({
            imageDataUrl: imgResult.imageDataUrl,
            title: `${imgForm.imageType} — ${imgForm.prompt.slice(0, 40)}`,
            targetBucket: bucket,
            description: imgResult.compiledPrompt,
            tags: ['ai-generated', imgForm.visualStyle.toLowerCase()],
          });
          showToast('success', 'Asset Uploaded to Media Library', uploaded.publicUrl);
          if (destination === 'service') {
            navigate('/admin/services', {
              state: {
                aiGeneratedService: {
                  imageUrl: uploaded.publicUrl,
                },
              },
            });
          } else if (destination === 'portfolio') {
            navigate('/admin/portfolio', {
              state: {
                aiGeneratedPortfolio: {
                  coverImage: uploaded.publicUrl,
                },
              },
            });
          }
        } catch (err) {
          // If Supabase storage bucket requires setup, still allow passing data URL directly to draft editor after confirmation
          if (destination === 'service') {
            navigate('/admin/services', {
              state: {
                aiGeneratedService: {
                  imageUrl: imgResult.imageDataUrl,
                },
              },
            });
            showToast('info', 'Applied to Service Draft', 'Image attached directly to service form for review.');
          } else if (destination === 'portfolio') {
            navigate('/admin/portfolio', {
              state: {
                aiGeneratedPortfolio: {
                  coverImage: imgResult.imageDataUrl,
                },
              },
            });
            showToast('info', 'Applied to Portfolio Draft', 'Image attached directly to portfolio form for review.');
          } else {
            showToast(
              'error',
              'Storage Upload Failed',
              err instanceof Error ? err.message : 'Could not upload to bucket.'
            );
          }
        } finally {
          setSavingToLibrary(false);
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Studio AI Header & Provider Telemetry */}
      <div className="bg-white border border-[#E2E4DF] rounded-lg p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#6E7785]">
            <Sparkles className="w-3.5 h-3.5 text-[#F18A45]" />
            <span className="font-semibold text-[#172333]">Admin-Only Studio Workspace</span>
            <span>·</span>
            <span>Protected Server-Side Gemini Integration</span>
          </div>
          <h1 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#172333] mt-1">
            Prithvi Editify AI Creative Assistant
          </h1>
          <p className="text-xs text-[#6E7785] mt-1 max-w-2xl">
            Draft and refine service listings, portfolio case studies, promotional copy, and original studio artwork. Nothing is published or saved until you explicitly review and approve it.
          </p>
        </div>

        {/* Provider Status Box */}
        <div className="bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg px-4 py-3 text-xs shrink-0 space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#6E7785]">Server AI Key Status:</span>
            <span
              className={`font-semibold ${
                providerStatus?.configured ? 'text-[#26734D]' : 'text-[#A96518]'
              }`}
            >
              {providerStatus
                ? providerStatus.configured
                  ? 'Configured & Active'
                  : 'GEMINI_API_KEY Missing'
                : statusError
                ? 'Check Server Status'
                : 'Checking...'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#6E7785]">Text / Image Models:</span>
            <span className="font-mono text-[11px] text-[#172333]">
              {providerStatus?.textModel || 'gemini-3.8-flash'} ·{' '}
              {providerStatus?.imageModel || 'gemini-3.1-flash-lite-image'}
            </span>
          </div>
        </div>
      </div>

      {/* Main 3-Zone Workspace Grid: Left Sub-Nav (3 cols) + Center Workspace (6 cols) + Right Context Panel (3 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANEL: Tool Selector */}
        <aside className="lg:col-span-3 bg-white border border-[#E2E4DF] rounded-lg p-3 space-y-1">
          <p className="px-3 py-2 text-[11px] font-semibold text-[#6E7785]">
            Creative Assistant Tools
          </p>
          {[
            {
              id: 'writing' as AssistantTab,
              label: 'Writing Assistant (18 Tasks)',
              icon: Wand2,
              desc: 'Titles, captions, emails, SEO & rewrites',
            },
            {
              id: 'service' as AssistantTab,
              label: 'Service Content Generator',
              icon: Layers,
              desc: 'Full INR service listing & FAQ builder',
            },
            {
              id: 'portfolio' as AssistantTab,
              label: 'Portfolio Content Generator',
              icon: Briefcase,
              desc: 'Project briefs, highlights & case studies',
            },
            {
              id: 'image' as AssistantTab,
              label: 'AI Image Studio',
              icon: ImageIcon,
              desc: 'Service covers, concepts & ad creatives',
            },
            {
              id: 'brand' as AssistantTab,
              label: 'Brand Profile Context',
              icon: Sliders,
              desc: 'Voice, audience & banned claims rules',
            },
            {
              id: 'usage' as AssistantTab,
              label: 'Usage & Cost Controls',
              icon: History,
              desc: 'Rate limits, model status & request log',
            },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-start gap-3 ${
                  active
                    ? 'bg-[#172333] text-white'
                    : 'text-[#172333] hover:bg-[#F5F5F1]'
                }`}
              >
                <Icon
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    active ? 'text-[#F18A45]' : 'text-[#6E7785]'
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{item.label}</p>
                  <p
                    className={`text-[11px] truncate mt-0.5 ${
                      active ? 'text-[#D0D5DD]' : 'text-[#6E7785]'
                    }`}
                  >
                    {item.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </aside>

        {/* CENTER MAIN WORKSPACE */}
        <div className="lg:col-span-6 space-y-6">
          {/* ================================================================ */}
          {/* TAB 1: 18-TASK AI WRITING ASSISTANT                              */}
          {/* ================================================================ */}
          {activeTab === 'writing' && (
            <div className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-5">
              <div className="border-b border-[#E2E4DF] pb-4">
                <h2 className="text-base font-semibold text-[#172333]">
                  AI Writing & Content Improvement Workspace
                </h2>
                <p className="text-xs text-[#6E7785] mt-0.5">
                  Select any of the 18 creative writing tasks, enter your topic or draft, and refine the result before copying or applying.
                </p>
              </div>

              {writeError && (
                <div className="p-3.5 bg-[#B93832]/10 border border-[#B93832]/30 rounded-lg flex items-start gap-2.5 text-xs text-[#B93832]">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{writeError}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#172333] mb-1">
                    Content Type / Writing Task *
                  </label>
                  <select
                    value={writeForm.task}
                    onChange={(e) => setWriteForm({ ...writeForm, task: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg focus:outline-none focus:border-[#172333]"
                  >
                    {WRITING_ASSISTANT_TASKS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#172333] mb-1">
                    Topic or Existing Text *
                  </label>
                  <textarea
                    rows={4}
                    value={writeForm.topicOrText}
                    onChange={(e) => setWriteForm({ ...writeForm, topicOrText: e.target.value })}
                    placeholder="Enter your service topic, rough draft, client inquiry message, or project notes..."
                    className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg focus:outline-none focus:border-[#172333]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#172333] mb-1">
                      Target Audience
                    </label>
                    <input
                      type="text"
                      value={writeForm.targetAudience}
                      onChange={(e) =>
                        setWriteForm({ ...writeForm, targetAudience: e.target.value })
                      }
                      placeholder="e.g. YouTube creators, D2C brands"
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#172333] mb-1">
                      Tone of Voice
                    </label>
                    <select
                      value={writeForm.tone}
                      onChange={(e) => setWriteForm({ ...writeForm, tone: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    >
                      {TONE_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#172333] mb-1">
                      Desired Length
                    </label>
                    <select
                      value={writeForm.desiredLength}
                      onChange={(e) =>
                        setWriteForm({ ...writeForm, desiredLength: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    >
                      {LENGTH_OPTIONS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#172333] mb-1">
                      Keywords (Optional)
                    </label>
                    <input
                      type="text"
                      value={writeForm.keywords}
                      onChange={(e) => setWriteForm({ ...writeForm, keywords: e.target.value })}
                      placeholder="thumbnail design, high CTR..."
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#172333] mb-1">
                      Language
                    </label>
                    <input
                      type="text"
                      value={writeForm.language}
                      onChange={(e) => setWriteForm({ ...writeForm, language: e.target.value })}
                      placeholder="English"
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#172333] mb-1">
                    Additional Instructions (Optional)
                  </label>
                  <input
                    type="text"
                    value={writeForm.additionalInstructions}
                    onChange={(e) =>
                      setWriteForm({ ...writeForm, additionalInstructions: e.target.value })
                    }
                    placeholder="e.g. Include a call to action for WhatsApp inquiry; keep pricing as ₹500/design"
                    className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                  />
                </div>

                {/* Primary Generation Controls */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    type="button"
                    disabled={writeLoading}
                    onClick={() => handleRunWritingAction('generate')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] disabled:opacity-50 rounded-lg transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#F18A45]" />
                    <span>{writeLoading ? 'Generating...' : 'Generate'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={writeLoading}
                    onClick={() => handleRunWritingAction('regenerate')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] disabled:opacity-50 rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Regenerate</span>
                  </button>

                  <button
                    type="button"
                    disabled={writeLoading}
                    onClick={() => {
                      setWriteForm({
                        ...writeForm,
                        topicOrText: '',
                        keywords: '',
                        additionalInstructions: '',
                      });
                      setWriteOutput('');
                      setWriteError('');
                    }}
                    className="px-3 py-2 text-xs font-medium text-[#6E7785] hover:text-[#B93832] transition-colors"
                  >
                    Clear Workspace
                  </button>
                </div>
              </div>

              {/* Editable Result Area & Refinement Actions */}
              <div className="pt-4 border-t border-[#E2E4DF] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-[#172333]">
                    Generated Result (Editable Before Using)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!writeOutput}
                      onClick={() => handleCopyText(writeOutput, 'write_output')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] disabled:opacity-40 rounded-md"
                    >
                      {copiedKey === 'write_output' ? (
                        <Check className="w-3.5 h-3.5 text-[#26734D]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === 'write_output' ? 'Copied' : 'Copy to Clipboard'}</span>
                    </button>
                  </div>
                </div>

                <textarea
                  rows={8}
                  value={writeOutput}
                  onChange={(e) => setWriteOutput(e.target.value)}
                  placeholder="Generated content will appear here. You can freely edit the text or run refinement actions below..."
                  className="w-full px-3.5 py-3 text-xs leading-relaxed bg-[#F5F5F1]/70 border border-[#E2E4DF] rounded-lg focus:outline-none focus:border-[#172333]"
                />

                {/* Quick Refinement Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold text-[#6E7785] mr-1">
                    Refine Result:
                  </span>
                  {[
                    { key: 'improve' as const, label: 'Improve Writing' },
                    { key: 'shorter' as const, label: 'Make Shorter' },
                    { key: 'longer' as const, label: 'Make Longer' },
                    { key: 'grammar' as const, label: 'Fix Grammar' },
                    { key: 'tone' as const, label: 'Apply Selected Tone' },
                  ].map((act) => (
                    <button
                      key={act.key}
                      type="button"
                      disabled={writeLoading || (!writeOutput.trim() && !writeForm.topicOrText.trim())}
                      onClick={() => handleRunWritingAction(act.key)}
                      className="px-2.5 py-1.5 text-[11px] font-semibold text-[#172333] bg-white border border-[#E2E4DF] hover:border-[#172333] disabled:opacity-40 rounded-md transition-colors"
                    >
                      {act.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 2: SERVICE CONTENT GENERATOR                                 */}
          {/* ================================================================ */}
          {activeTab === 'service' && (
            <div className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-5">
              <div className="border-b border-[#E2E4DF] pb-4">
                <h2 className="text-base font-semibold text-[#172333]">
                  Generate Service Content
                </h2>
                <p className="text-xs text-[#6E7785] mt-0.5">
                  Prepare complete, honest service listings for your Services catalog. Never invents prices, turnaround times, or guarantees.
                </p>
              </div>

              {srvError && (
                <div className="p-3.5 bg-[#B93832]/10 border border-[#B93832]/30 rounded-lg text-xs text-[#B93832]">
                  {srvError}
                </div>
              )}

              <form onSubmit={handleGenerateServiceContent} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#172333] mb-1">
                    Load Context from Existing Service (Optional)
                  </label>
                  <select
                    value={selectedServiceId}
                    onChange={(e) => handleSelectExistingService(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                  >
                    <option value="">— Start New Service Draft —</option>
                    {existingServices.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} ({s.category} · {s.priceDisplay})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#172333] mb-1">
                      Service Category *
                    </label>
                    <input
                      type="text"
                      required
                      value={srvForm.category}
                      onChange={(e) => setSrvForm({ ...srvForm, category: e.target.value })}
                      placeholder="e.g. YouTube Thumbnail Design"
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#172333] mb-1">
                      Service Name or Topic *
                    </label>
                    <input
                      type="text"
                      required
                      value={srvForm.serviceName}
                      onChange={(e) => setSrvForm({ ...srvForm, serviceName: e.target.value })}
                      placeholder="e.g. High-Impact YouTube Thumbnail Design"
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#172333] mb-1">
                      Target Audience
                    </label>
                    <input
                      type="text"
                      value={srvForm.targetAudience}
                      onChange={(e) => setSrvForm({ ...srvForm, targetAudience: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#172333] mb-1">
                      Main Client Benefit
                    </label>
                    <input
                      type="text"
                      value={srvForm.mainBenefit}
                      onChange={(e) => setSrvForm({ ...srvForm, mainBenefit: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#172333] mb-1">
                      Keywords
                    </label>
                    <input
                      type="text"
                      value={srvForm.keywords}
                      onChange={(e) => setSrvForm({ ...srvForm, keywords: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#172333] mb-1">
                      Tone of Voice
                    </label>
                    <select
                      value={srvForm.tone}
                      onChange={(e) => setSrvForm({ ...srvForm, tone: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    >
                      {TONE_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#172333] mb-1">
                      Existing Price Details (Optional — Never Invented)
                    </label>
                    <input
                      type="text"
                      value={srvForm.priceDetails}
                      onChange={(e) => setSrvForm({ ...srvForm, priceDetails: e.target.value })}
                      placeholder="e.g. ₹400/thumbnail"
                      className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#172333] mb-1">
                      Delivery & Revision Details (Optional)
                    </label>
                    <input
                      type="text"
                      value={srvForm.deliveryDetails}
                      onChange={(e) => setSrvForm({ ...srvForm, deliveryDetails: e.target.value })}
                      placeholder="e.g. 24 hours · 2 Revisions"
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#172333] mb-1">
                    Optional Rough Description / Notes
                  </label>
                  <textarea
                    rows={3}
                    value={srvForm.roughDescription}
                    onChange={(e) => setSrvForm({ ...srvForm, roughDescription: e.target.value })}
                    placeholder="Any specific deliverables, file formats, or notes..."
                    className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                  />
                </div>

                <button
                  type="submit"
                  disabled={srvLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] disabled:opacity-50 rounded-lg"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#F18A45]" />
                  <span>{srvLoading ? 'Generating Service Package...' : 'Generate Service Content'}</span>
                </button>
              </form>

              {srvResult && (
                <div className="pt-5 border-t border-[#E2E4DF] space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[#172333]">
                      Generated Service Content (Editable Before Using)
                    </h3>
                    <button
                      type="button"
                      onClick={handleApplyServiceContentToForm}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#172333] bg-[#F18A45] hover:bg-[#e07934] rounded-lg transition-colors"
                    >
                      <span>Use Generated Content in Service Form</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#6E7785] mb-1">
                      Professional Service Title
                    </label>
                    <input
                      type="text"
                      value={srvResult.title}
                      onChange={(e) => setSrvResult({ ...srvResult, title: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-semibold bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#6E7785] mb-1">
                      Short Description
                    </label>
                    <textarea
                      rows={2}
                      value={srvResult.shortDescription}
                      onChange={(e) =>
                        setSrvResult({ ...srvResult, shortDescription: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#6E7785] mb-1">
                      Full Service Description
                    </label>
                    <textarea
                      rows={5}
                      value={srvResult.fullDescription}
                      onChange={(e) =>
                        setSrvResult({ ...srvResult, fullDescription: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#6E7785] mb-1">
                      Deliverables (Comma-Separated)
                    </label>
                    <textarea
                      rows={2}
                      value={srvResult.deliverables}
                      onChange={(e) => setSrvResult({ ...srvResult, deliverables: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 bg-[#F5F5F1] rounded-lg space-y-1.5">
                      <p className="text-[11px] font-semibold text-[#172333]">Key Benefits</p>
                      <ul className="text-xs text-[#6E7785] space-y-1 list-disc pl-4">
                        {(srvResult.keyBenefits || []).map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-3 bg-[#F5F5F1] rounded-lg space-y-1.5">
                      <p className="text-[11px] font-semibold text-[#172333]">
                        Client Requirements
                      </p>
                      <ul className="text-xs text-[#6E7785] space-y-1 list-disc pl-4">
                        {(srvResult.clientRequirements || []).map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="p-3 bg-[#F5F5F1] rounded-lg space-y-2">
                    <p className="text-[11px] font-semibold text-[#172333]">
                      Frequently Asked Questions
                    </p>
                    {(srvResult.faqs || []).map((faq, idx) => (
                      <div key={idx} className="text-xs border-t border-[#E2E4DF] pt-2 first:border-0 first:pt-0">
                        <p className="font-semibold text-[#172333]">Q: {faq.question}</p>
                        <p className="text-[#6E7785] mt-0.5">A: {faq.answer}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6E7785] mb-1">
                        SEO Title
                      </label>
                      <input
                        type="text"
                        value={srvResult.seoTitle}
                        onChange={(e) => setSrvResult({ ...srvResult, seoTitle: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6E7785] mb-1">
                        Call-to-Action Text
                      </label>
                      <input
                        type="text"
                        value={srvResult.ctaText}
                        onChange={(e) => setSrvResult({ ...srvResult, ctaText: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#6E7785] mb-1">
                      SEO Meta Description
                    </label>
                    <input
                      type="text"
                      value={srvResult.seoMetaDescription}
                      onChange={(e) =>
                        setSrvResult({ ...srvResult, seoMetaDescription: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 3: PORTFOLIO CONTENT GENERATOR                               */}
          {/* ================================================================ */}
          {activeTab === 'portfolio' && (
            <div className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-5">
              <div className="border-b border-[#E2E4DF] pb-4">
                <h2 className="text-base font-semibold text-[#172333]">
                  Portfolio Content Generator
                </h2>
                <p className="text-xs text-[#6E7785] mt-0.5">
                  Craft project titles, case study descriptions, creative briefs, and tags using only factual details you supply.
                </p>
              </div>

              {portError && (
                <div className="p-3.5 bg-[#B93832]/10 border border-[#B93832]/30 rounded-lg text-xs text-[#B93832]">
                  {portError}
                </div>
              )}

              <form onSubmit={handleGeneratePortfolioContent} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#172333] mb-1">
                    Load Context from Existing Portfolio Item (Optional)
                  </label>
                  <select
                    value={selectedPortfolioId}
                    onChange={(e) => handleSelectExistingPortfolio(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                  >
                    <option value="">— Start New Portfolio Case Study —</option>
                    {existingPortfolio.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#172333] mb-1">
                      Project Title or Working Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={portForm.projectTitle}
                      onChange={(e) => setPortForm({ ...portForm, projectTitle: e.target.value })}
                      placeholder="e.g. Tech Documentary YouTube Thumbnail Series"
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#172333] mb-1">
                      Project Category *
                    </label>
                    <select
                      value={portForm.category}
                      onChange={(e) => setPortForm({ ...portForm, category: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    >
                      {[
                        'Graphic Design',
                        'Social Media',
                        'YouTube Thumbnails',
                        'Video Editing',
                        'Instagram Reels',
                        'Promotional Ads',
                        'Branding',
                        'Other',
                      ].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#172333] mb-1">
                    Project Objective
                  </label>
                  <input
                    type="text"
                    value={portForm.objective}
                    onChange={(e) => setPortForm({ ...portForm, objective: e.target.value })}
                    placeholder="What visual problem or creative brief did this project solve?"
                    className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#172333] mb-1">
                      Client or Industry (Optional)
                    </label>
                    <input
                      type="text"
                      value={portForm.clientOrIndustry}
                      onChange={(e) =>
                        setPortForm({ ...portForm, clientOrIndustry: e.target.value })
                      }
                      placeholder="e.g. FinTech Education Channel"
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#172333] mb-1">
                      Design Style
                    </label>
                    <input
                      type="text"
                      value={portForm.designStyle}
                      onChange={(e) => setPortForm({ ...portForm, designStyle: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#172333] mb-1">
                      Tools Used (Optional)
                    </label>
                    <input
                      type="text"
                      value={portForm.toolsUsed}
                      onChange={(e) => setPortForm({ ...portForm, toolsUsed: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#172333] mb-1">
                      Keywords (Optional)
                    </label>
                    <input
                      type="text"
                      value={portForm.keywords}
                      onChange={(e) => setPortForm({ ...portForm, keywords: e.target.value })}
                      placeholder="thumbnail, youtube, color grading"
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#172333] mb-1">
                    Existing Notes or Rough Draft
                  </label>
                  <textarea
                    rows={3}
                    value={portForm.existingNotes}
                    onChange={(e) => setPortForm({ ...portForm, existingNotes: e.target.value })}
                    placeholder="Add any factual project notes or deliverables..."
                    className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                  />
                </div>

                <button
                  type="submit"
                  disabled={portLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] disabled:opacity-50 rounded-lg"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#F18A45]" />
                  <span>{portLoading ? 'Generating Case Study...' : 'Generate Portfolio Content'}</span>
                </button>
              </form>

              {portResult && (
                <div className="pt-5 border-t border-[#E2E4DF] space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[#172333]">
                      Generated Portfolio Content (Editable Before Using)
                    </h3>
                    <button
                      type="button"
                      onClick={handleApplyPortfolioContentToForm}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#172333] bg-[#F18A45] hover:bg-[#e07934] rounded-lg transition-colors"
                    >
                      <span>Use Generated Content in Portfolio Form</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#6E7785] mb-1">
                      Professional Project Title
                    </label>
                    <input
                      type="text"
                      value={portResult.title}
                      onChange={(e) => setPortResult({ ...portResult, title: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-semibold bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#6E7785] mb-1">
                      Short Project Summary
                    </label>
                    <textarea
                      rows={2}
                      value={portResult.shortSummary}
                      onChange={(e) =>
                        setPortResult({ ...portResult, shortSummary: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#6E7785] mb-1">
                      Detailed Project Description
                    </label>
                    <textarea
                      rows={4}
                      value={portResult.detailedDescription}
                      onChange={(e) =>
                        setPortResult({ ...portResult, detailedDescription: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6E7785] mb-1">
                        Creative Brief
                      </label>
                      <textarea
                        rows={3}
                        value={portResult.creativeBrief}
                        onChange={(e) =>
                          setPortResult({ ...portResult, creativeBrief: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6E7785] mb-1">
                        Design Approach
                      </label>
                      <textarea
                        rows={3}
                        value={portResult.designApproach}
                        onChange={(e) =>
                          setPortResult({ ...portResult, designApproach: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6E7785] mb-1">
                        Deliverables Specification
                      </label>
                      <input
                        type="text"
                        value={portResult.deliverablesDescription}
                        onChange={(e) =>
                          setPortResult({
                            ...portResult,
                            deliverablesDescription: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6E7785] mb-1">
                        Portfolio Caption
                      </label>
                      <input
                        type="text"
                        value={portResult.portfolioCaption}
                        onChange={(e) =>
                          setPortResult({ ...portResult, portfolioCaption: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 4: AI IMAGE STUDIO                                           */}
          {/* ================================================================ */}
          {activeTab === 'image' && (
            <div className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-5">
              <div className="border-b border-[#E2E4DF] pb-4">
                <h2 className="text-base font-semibold text-[#172333]">
                  AI Image Studio
                </h2>
                <p className="text-xs text-[#6E7785] mt-0.5">
                  Generate original visual assets for service covers, portfolio concepts, thumbnails, and promotional creatives via the server-side Gemini image provider.
                </p>
              </div>

              {imgError && (
                <div className="p-4 bg-[#B93832]/10 border border-[#B93832]/30 rounded-lg flex items-start gap-2.5 text-xs text-[#B93832]">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">Image Provider Notice</p>
                    <p>{imgError}</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[#172333]">
                      Image Description or Prompt *
                    </label>
                    <button
                      type="button"
                      disabled={refiningPrompt || !imgForm.prompt.trim()}
                      onClick={handleRefinePrompt}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#F18A45] hover:underline disabled:opacity-40"
                    >
                      <Wand2 className="w-3 h-3" />
                      <span>{refiningPrompt ? 'Refining Prompt...' : 'Refine Prompt with AI'}</span>
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={imgForm.prompt}
                    onChange={(e) => setImgForm({ ...imgForm, prompt: e.target.value })}
                    placeholder="Describe the subject, composition, lighting, and studio mood (e.g., Modern creative desk setup with glowing dual monitors showing video editing timelines and color wheels, warm terracotta rim lighting)..."
                    className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg focus:outline-none focus:border-[#172333]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#172333] mb-1">
                      Image Type
                    </label>
                    <select
                      value={imgForm.imageType}
                      onChange={(e) => setImgForm({ ...imgForm, imageType: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    >
                      {IMAGE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#172333] mb-1">
                      Visual Style
                    </label>
                    <select
                      value={imgForm.visualStyle}
                      onChange={(e) => setImgForm({ ...imgForm, visualStyle: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    >
                      {VISUAL_STYLES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#172333] mb-1">
                      Aspect Ratio
                    </label>
                    <select
                      value={imgForm.aspectRatio}
                      onChange={(e) =>
                        setImgForm({
                          ...imgForm,
                          aspectRatio: e.target.value as typeof imgForm.aspectRatio,
                        })
                      }
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    >
                      {ASPECT_RATIOS.map((ar) => (
                        <option key={ar.value} value={ar.value}>
                          {ar.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#172333] mb-1">
                      Resolution / Quality
                    </label>
                    <select
                      value={imgForm.imageSize}
                      onChange={(e) =>
                        setImgForm({
                          ...imgForm,
                          imageSize: e.target.value as '1K' | '2K' | '4K',
                        })
                      }
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    >
                      <option value="1K">1K Standard (gemini-3.1-flash-lite-image)</option>
                      <option value="2K">2K High-Resolution (gemini-nano-banana-2.1)</option>
                      <option value="4K">4K Ultra-HD (gemini-nano-banana-2.1)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#172333] mb-1">
                      Brand Colors (Optional)
                    </label>
                    <input
                      type="text"
                      value={imgForm.brandColors}
                      onChange={(e) => setImgForm({ ...imgForm, brandColors: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#172333] mb-1">
                      Optional Text to Include in Image
                    </label>
                    <input
                      type="text"
                      value={imgForm.textToInclude}
                      onChange={(e) => setImgForm({ ...imgForm, textToInclude: e.target.value })}
                      placeholder="Leave blank for clean visual without text"
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    />
                  </div>
                </div>

                {/* Optional Reference Image Upload */}
                <div className="p-3.5 bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs">
                    <p className="font-semibold text-[#172333]">
                      Reference Image for Editing / Style Guidance (Optional)
                    </p>
                    <p className="text-[11px] text-[#6E7785]">
                      {imgForm.referenceImageName
                        ? `Attached: ${imgForm.referenceImageName}`
                        : 'Upload a PNG/JPG under 4 MB to guide or edit an existing visual.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#172333] bg-white border border-[#E2E4DF] hover:border-[#172333] rounded-md">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Reference</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleReferenceImageUpload}
                        className="hidden"
                      />
                    </label>
                    {imgForm.referenceImageBase64 && (
                      <button
                        type="button"
                        onClick={() =>
                          setImgForm((prev) => ({
                            ...prev,
                            referenceImageBase64: '',
                            referenceImageName: '',
                          }))
                        }
                        className="text-xs text-[#B93832] hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {/* Image Generation Actions */}
                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={imgLoading}
                    onClick={handleRequestImageGeneration}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] disabled:opacity-50 rounded-lg transition-colors"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-[#F18A45]" />
                    <span>{imgLoading ? 'Generating Image...' : 'Generate Image'}</span>
                  </button>

                  {imgResult && (
                    <button
                      type="button"
                      disabled={imgLoading}
                      onClick={handleRequestImageGeneration}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-lg"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Generate Another Version</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={!imgForm.prompt}
                    onClick={() => handleCopyText(imgForm.prompt, 'img_prompt')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#172333] bg-white border border-[#E2E4DF] hover:border-[#172333] disabled:opacity-40 rounded-lg"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedKey === 'img_prompt' ? 'Prompt Copied' : 'Copy Prompt'}</span>
                  </button>
                </div>
              </div>

              {/* Generated Image Preview & Actions */}
              {imgResult && (
                <div className="pt-5 border-t border-[#E2E4DF] space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-[#172333]">
                      Generated Studio Visual ({imgResult.model} · {imgResult.aspectRatio})
                    </p>
                    <span className="font-mono text-[11px] text-[#26734D]">
                      Ready for Review
                    </span>
                  </div>

                  <div className="bg-[#0F1722] border border-[#E2E4DF] rounded-lg overflow-hidden p-4 flex items-center justify-center">
                    <img
                      src={imgResult.imageDataUrl}
                      alt={imgForm.prompt}
                      referrerPolicy="no-referrer"
                      className="max-h-[420px] w-auto object-contain rounded"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewMedia({
                          id: 'ai-generated-preview',
                          title: imgForm.imageType,
                          url: imgResult.imageDataUrl,
                          description: imgResult.compiledPrompt,
                          categoryLabel: `${imgResult.model} · ${imgResult.aspectRatio}`,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-lg"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview Image</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadGeneratedImage}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-lg"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Generated Image</span>
                    </button>

                    <button
                      type="button"
                      disabled={savingToLibrary}
                      onClick={() => handleSaveImageToBucket('service-media', 'service')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg"
                    >
                      <Layers className="w-3.5 h-3.5 text-[#F18A45]" />
                      <span>Use as Service Cover</span>
                    </button>

                    <button
                      type="button"
                      disabled={savingToLibrary}
                      onClick={() => handleSaveImageToBucket('portfolio-media', 'portfolio')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#172333] bg-[#F18A45] hover:bg-[#e07934] rounded-lg"
                    >
                      <Briefcase className="w-3.5 h-3.5" />
                      <span>Use in Portfolio</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 5: BRAND PROFILE CONTEXT                                     */}
          {/* ================================================================ */}
          {activeTab === 'brand' && (
            <div className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-5">
              <div className="border-b border-[#E2E4DF] pb-4">
                <h2 className="text-base font-semibold text-[#172333]">
                  Studio Brand Profile Context
                </h2>
                <p className="text-xs text-[#6E7785] mt-0.5">
                  Configure the brand identity and guardrails sent with your AI writing requests. Private CRM client records are never sent to the AI provider.
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#172333] mb-1">
                      Brand Name
                    </label>
                    <input
                      type="text"
                      value={brandProfile.brandName}
                      onChange={(e) =>
                        setBrandProfile({ ...brandProfile, brandName: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#172333] mb-1">
                      Studio Owner / Lead Creative
                    </label>
                    <input
                      type="text"
                      value={brandProfile.ownerName}
                      onChange={(e) =>
                        setBrandProfile({ ...brandProfile, ownerName: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#172333] mb-1">
                    Business Type
                  </label>
                  <input
                    type="text"
                    value={brandProfile.businessType}
                    onChange={(e) =>
                      setBrandProfile({ ...brandProfile, businessType: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#172333] mb-1">
                    Brand Voice
                  </label>
                  <input
                    type="text"
                    value={brandProfile.brandVoice}
                    onChange={(e) =>
                      setBrandProfile({ ...brandProfile, brandVoice: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#172333] mb-1">
                    Target Customers
                  </label>
                  <input
                    type="text"
                    value={brandProfile.targetCustomers}
                    onChange={(e) =>
                      setBrandProfile({ ...brandProfile, targetCustomers: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#172333] mb-1">
                    Preferred Writing Style
                  </label>
                  <input
                    type="text"
                    value={brandProfile.preferredWritingStyle}
                    onChange={(e) =>
                      setBrandProfile({ ...brandProfile, preferredWritingStyle: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#172333] mb-1">
                    Services Offered
                  </label>
                  <textarea
                    rows={2}
                    value={brandProfile.servicesOffered}
                    onChange={(e) =>
                      setBrandProfile({ ...brandProfile, servicesOffered: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#172333] mb-1">
                    Words or Claims to Strictly Avoid
                  </label>
                  <textarea
                    rows={2}
                    value={brandProfile.wordsToAvoid}
                    onChange={(e) =>
                      setBrandProfile({ ...brandProfile, wordsToAvoid: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const saved = saveBrandProfile(brandProfile);
                      setBrandProfile(saved);
                      showToast('success', 'Brand Profile Saved');
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg"
                  >
                    Save Brand Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const reset = saveBrandProfile(DEFAULT_AI_BRAND_PROFILE);
                      setBrandProfile(reset);
                      showToast('info', 'Reset to Prithvi Editify Defaults');
                    }}
                    className="px-4 py-2 text-xs font-semibold text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-lg"
                  >
                    Reset Defaults
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 6: USAGE & COST CONTROLS                                     */}
          {/* ================================================================ */}
          {activeTab === 'usage' && (
            <div className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-[#E2E4DF] pb-4">
                <div>
                  <h2 className="text-base font-semibold text-[#172333]">
                    AI Usage, Security & Cost Controls
                  </h2>
                  <p className="text-xs text-[#6E7785] mt-0.5">
                    Monitor active rate limits, provider configuration, and recent administrator AI activity.
                  </p>
                </div>
                {usageHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      clearAIUsageHistory();
                      setUsageHistory([]);
                      showToast('info', 'AI Usage Log Cleared');
                    }}
                    className="inline-flex items-center gap-1 text-xs text-[#B93832] hover:underline"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Log</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-[#F5F5F1] rounded-lg border border-[#E2E4DF]">
                  <p className="text-[11px] text-[#6E7785]">Rate Limit Guard</p>
                  <p className="text-lg font-mono font-semibold text-[#172333] mt-1 tabular-nums">
                    {providerStatus?.rateLimitPerMinute || 20} req / min
                  </p>
                </div>
                <div className="p-4 bg-[#F5F5F1] rounded-lg border border-[#E2E4DF]">
                  <p className="text-[11px] text-[#6E7785]">Prompt Cap</p>
                  <p className="text-lg font-mono font-semibold text-[#172333] mt-1 tabular-nums">
                    5,000 chars
                  </p>
                </div>
                <div className="p-4 bg-[#F5F5F1] rounded-lg border border-[#E2E4DF]">
                  <p className="text-[11px] text-[#6E7785]">Session Requests Logged</p>
                  <p className="text-lg font-mono font-semibold text-[#172333] mt-1 tabular-nums">
                    {usageHistory.length}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-[#172333]">Recent AI Activity Log</h3>
                {usageHistory.length === 0 ? (
                  <p className="text-xs text-[#6E7785] py-6 text-center bg-[#F5F5F1] rounded-lg">
                    No AI requests recorded in this browser session yet.
                  </p>
                ) : (
                  <div className="border border-[#E2E4DF] rounded-lg overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#F5F5F1] border-b border-[#E2E4DF] text-[11px] font-semibold text-[#6E7785]">
                          <th className="py-2.5 px-3">Time</th>
                          <th className="py-2.5 px-3">Tool & Task</th>
                          <th className="py-2.5 px-3">Model</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E4DF]">
                        {usageHistory.map((item) => (
                          <tr key={item.id}>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-[#6E7785]">
                              {new Date(item.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="py-2.5 px-3">
                              <p className="font-semibold text-[#172333]">{item.taskLabel}</p>
                              <p className="text-[11px] text-[#6E7785] line-clamp-1">
                                {item.summary}
                              </p>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-[#172333]">
                              {item.model}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`font-semibold ${
                                  item.status === 'success' ? 'text-[#26734D]' : 'text-[#B93832]'
                                }`}
                              >
                                {item.status === 'success' ? 'Success' : 'Error'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT CONTEXTUAL PANEL: Prompts, Guardrails & Quick Links */}
        <aside className="lg:col-span-3 space-y-4">
          <div className="bg-white border border-[#E2E4DF] rounded-lg p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#26734D]" />
              <h3 className="text-xs font-semibold text-[#172333]">
                Editorial & Data Safety Rules
              </h3>
            </div>
            <ul className="text-xs text-[#6E7785] space-y-2 leading-relaxed">
              <li>
                · <strong className="text-[#172333]">Admin-Only Access:</strong> Verified via Supabase JWT on every server request.
              </li>
              <li>
                · <strong className="text-[#172333]">No Auto-Publishing:</strong> Generated copy and visuals never overwrite live records without your approval.
              </li>
              <li>
                · <strong className="text-[#172333]">Factual Honesty:</strong> AI is instructed never to invent prices, turnaround times, or fake client outcomes.
              </li>
            </ul>
          </div>

          <div className="bg-white border border-[#E2E4DF] rounded-lg p-5 space-y-3">
            <h3 className="text-xs font-semibold text-[#172333]">
              Quick Prompt Templates
            </h3>
            <div className="space-y-2">
              {[
                {
                  label: 'YouTube Thumbnail Service Pitch',
                  tab: 'writing' as AssistantTab,
                  task: WRITING_ASSISTANT_TASKS[1],
                  topic:
                    'High-contrast YouTube thumbnail design service for creators and educators, custom typography, facial expression retouching, delivered in 24 hours.',
                },
                {
                  label: 'Instagram Reels Editing Description',
                  tab: 'writing' as AssistantTab,
                  task: WRITING_ASSISTANT_TASKS[1],
                  topic:
                    'Dynamic Instagram Reels & YouTube Shorts video editing with retention pacing, animated captions, sound design, and color grading.',
                },
                {
                  label: 'Client Inquiry Warm Follow-Up',
                  tab: 'writing' as AssistantTab,
                  task: WRITING_ASSISTANT_TASKS[13],
                  topic:
                    'Thank a prospective client for submitting a graphic design project inquiry to Prithvi Editify and invite them to confirm their timeline and brand assets.',
                },
              ].map((tpl, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setActiveTab(tpl.tab);
                    setWriteForm((prev) => ({
                      ...prev,
                      task: tpl.task,
                      topicOrText: tpl.topic,
                    }));
                  }}
                  className="w-full text-left p-2.5 text-xs bg-[#F5F5F1] hover:bg-[#E2E4DF]/70 rounded-lg transition-colors"
                >
                  <p className="font-semibold text-[#172333]">{tpl.label}</p>
                  <p className="text-[11px] text-[#6E7785] line-clamp-2 mt-0.5">{tpl.topic}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-[#E2E4DF] rounded-lg p-5 space-y-2.5">
            <h3 className="text-xs font-semibold text-[#172333]">Connected Studio Editors</h3>
            <Link
              to="/admin/services"
              className="flex items-center justify-between text-xs font-medium text-[#172333] hover:text-[#F18A45] py-1"
            >
              <span>Services & Pricing Editor</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/admin/portfolio"
              className="flex items-center justify-between text-xs font-medium text-[#172333] hover:text-[#F18A45] py-1"
            >
              <span>Portfolio Case Studies Editor</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/admin/media"
              className="flex items-center justify-between text-xs font-medium text-[#172333] hover:text-[#F18A45] py-1"
            >
              <span>Studio Media Library</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </aside>
      </div>

      <MediaPreviewModal item={previewMedia} onClose={() => setPreviewMedia(null)} />
    </div>
  );
};

// ============================================================================
// 2. ADMIN QUOTATIONS & ESTIMATES MANAGEMENT PAGE (/admin/quotations & /admin/estimates)
// ============================================================================
const QUOTATION_STATUSES: QuotationStatus[] = [
  'Draft',
  'Sent',
  'Accepted',
  'Rejected',
  'Expired',
  'Archived',
];

export const AdminQuotationsPage: React.FC<{
  defaultDocType?: 'All' | QuotationDocumentType;
}> = ({ defaultDocType = 'All' }) => {
  const { showToast, confirmAction } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);

  const [showBuilder, setShowBuilder] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<QuotationRecord | null>(null);
  const [formDirty, setFormDirty] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [savingDoc, setSavingDoc] = useState(false);

  const [printQuotation, setPrintQuotation] = useState<QuotationRecord | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [docTypeFilter, setDocTypeFilter] = useState<'All' | QuotationDocumentType>(defaultDocType);
  const [deleteModalConfig, setDeleteModalConfig] = useState<SafeDeleteModalConfig | null>(null);

  useEffect(() => {
    if (location.pathname.endsWith('/estimates')) {
      setDocTypeFilter('Estimate');
    } else if (defaultDocType) {
      setDocTypeFilter(defaultDocType);
    }
  }, [location.pathname, defaultDocType]);

  const today = new Date().toISOString().split('T')[0];
  const defaultExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const createEmptyDocForm = (docType: QuotationDocumentType = 'Quotation') => ({
    documentType: docType,
    quotationNumber: generateDocumentNumber(docType),
    version: 1,
    inquiryId: '',
    clientId: '',
    clientName: '',
    clientEmail: '',
    clientUserId: '',
    projectTitle: '',
    serviceCategory: 'Graphic Design',
    scopeSummary: '',
    deliverables:
      'High-resolution master exports (PNG/JPG/PDF/MP4), 2 revision rounds, commercial usage rights',
    estimatedTimeline: '3–5 business days',
    issueDate: today,
    expiryDate: defaultExpiry,
    discount: 0,
    taxRate: 0,
    status: 'Draft' as QuotationStatus,
    notes: '',
    termsAndConditions:
      '50% advance milestone to initiate production. Remaining balance upon preview approval prior to final master file release. Valid until the expiry date listed.',
    lineItems: [{ description: 'Creative Design & Production Package', quantity: 1, unitPrice: 1500 }],
  });

  const [form, setForm] = useState(() => createEmptyDocForm('Quotation'));
  const [gstMode, setGstMode] = useState<GstTaxMode>('NON_GST');
  const [clientGstin, setClientGstin] = useState('');
  const [sacCode, setSacCode] = useState('9983');
  const [aiDraftingQuote, setAiDraftingQuote] = useState(false);

  const updateForm = (patch: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setFormDirty(true);
  };

  const loadAll = useCallback(async () => {
    const [qList, cList, iList, pList, sList] = await Promise.all([
      fetchAllQuotationsAdmin(),
      fetchAllClientsAdmin().catch(() => []),
      fetchAllInquiriesAdmin().catch(() => []),
      fetchAllProjectsAdmin().catch(() => []),
      fetchAllServicesAdmin().catch(() => []),
    ]);
    setQuotations(qList);
    setClients(cList);
    setInquiries(iList);
    setProjects(pList);
    setServices(sList);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Pre-fill quotation builder if navigated from an Inquiry (with optional AI Draft)
  useEffect(() => {
    const stateObj = (location.state as any) || {};
    const fromInq = stateObj.fromInquiry as InquiryRecord | undefined;
    const aiDraft = stateObj.aiDraftedQuote as
      | Awaited<ReturnType<typeof generateAIDraftedQuotationFromInquiry>>
      | undefined;
    if (!fromInq) return;
    const matchedClient = clients.find(
      (c) => c.email.toLowerCase() === fromInq.email.toLowerCase()
    );
    setEditingId(null);
    setEditingRecord(null);
    setForm((prev) => ({
      ...prev,
      documentType: 'Quotation',
      quotationNumber: generateDocumentNumber('Quotation'),
      version: 1,
      inquiryId: fromInq.id,
      clientId: matchedClient?.id || '',
      clientName: fromInq.fullName,
      clientEmail: fromInq.email,
      clientUserId: matchedClient?.userId || '',
      projectTitle:
        aiDraft?.projectTitle ||
        `${fromInq.serviceRequired} — ${fromInq.companyName || fromInq.fullName}`,
      serviceCategory: aiDraft?.serviceCategory || fromInq.serviceRequired,
      scopeSummary: aiDraft?.scopeSummary || fromInq.description,
      deliverables: aiDraft?.deliverables || prev.deliverables,
      estimatedTimeline: aiDraft?.estimatedTimeline || prev.estimatedTimeline,
      lineItems:
        aiDraft?.lineItems && aiDraft.lineItems.length > 0
          ? aiDraft.lineItems.map((li) => ({
              description: li.description,
              quantity: li.quantity,
              unitPrice: li.unitPrice,
            }))
          : [
              {
                description: `${fromInq.serviceRequired} Deliverable Package`,
                quantity: 1,
                unitPrice: 1500,
              },
            ],
    }));
    setFormDirty(true);
    setShowBuilder(true);
  }, [location.state, clients]);

  const handleOpenCreateDoc = (docType: QuotationDocumentType) => {
    setEditingId(null);
    setEditingRecord(null);
    setGstMode('NON_GST');
    setClientGstin('');
    setSacCode('9983');
    setForm(createEmptyDocForm(docType));
    setFormDirty(false);
    setShowBuilder(true);
  };

  const handleOpenEditDoc = (q: QuotationRecord) => {
    const docType = inferQuotationDocumentType(q);
    setEditingId(q.id);
    setEditingRecord(q);
    const meta = getInvoiceGstMeta(q.id);
    setGstMode(
      meta.gstMode !== 'NON_GST'
        ? meta.gstMode
        : q.taxRate === 18
        ? 'CGST_SGST_18'
        : q.taxRate > 0
        ? 'CUSTOM'
        : 'NON_GST'
    );
    setClientGstin(meta.clientGstin || '');
    setSacCode(meta.sacCode || '9983');
    setForm({
      documentType: docType,
      quotationNumber: q.quotationNumber,
      version: q.version || 1,
      inquiryId: q.inquiryId || '',
      clientId: q.clientId,
      clientName: q.clientName,
      clientEmail: q.clientEmail,
      clientUserId: q.clientUserId,
      projectTitle: q.projectTitle,
      serviceCategory: q.serviceCategory,
      scopeSummary: q.scopeSummary,
      deliverables: q.deliverables,
      estimatedTimeline: q.estimatedTimeline,
      issueDate: q.issueDate,
      expiryDate: q.expiryDate,
      discount: q.discount,
      taxRate: q.taxRate,
      status: q.status,
      notes: q.notes || '',
      termsAndConditions: q.termsAndConditions,
      lineItems: q.lineItems.map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
      })),
    });
    setFormDirty(false);
    setShowBuilder(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRequestCloseBuilder = () => {
    if (formDirty) {
      setShowUnsavedModal(true);
      return;
    }
    setShowBuilder(false);
    setEditingId(null);
    setEditingRecord(null);
  };

  const handleAIDraftFromSelectedInquiry = async () => {
    const inq = inquiries.find((i) => i.id === form.inquiryId);
    if (!inq) {
      showToast('warning', 'Select an Inquiry', 'Choose an inquiry first or draft from Inquiries page.');
      return;
    }
    setAiDraftingQuote(true);
    try {
      const drafted = await generateAIDraftedQuotationFromInquiry(inq, services);
      updateForm({
        projectTitle: drafted.projectTitle,
        serviceCategory: drafted.serviceCategory,
        scopeSummary: drafted.scopeSummary,
        deliverables: drafted.deliverables,
        estimatedTimeline: drafted.estimatedTimeline,
        lineItems: drafted.lineItems.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
        })),
      });
      showToast('success', 'AI Scope & Line Items Drafted', 'Review the itemized INR pricing below.');
    } catch (err) {
      showToast('error', 'AI Draft Failed', err instanceof Error ? err.message : '');
    } finally {
      setAiDraftingQuote(false);
    }
  };

  const effectiveTaxRate =
    gstMode === 'NON_GST'
      ? 0
      : gstMode === 'CGST_SGST_18' || gstMode === 'IGST_18'
      ? 18
      : form.taxRate;

  const totals = calculateInvoiceTotals({
    items: form.lineItems,
    discount: form.discount,
    taxRate: effectiveTaxRate,
    amountPaid: 0,
  });

  const gstBreakdown = calculateGstBreakdown(totals.subtotal, totals.discount, gstMode, effectiveTaxRate);

  const handleSelectClient = (clientId: string) => {
    const found = clients.find((c) => c.id === clientId);
    if (!found) {
      updateForm({ clientId: '' });
      return;
    }
    updateForm({
      clientId: found.id,
      clientName: found.fullName,
      clientEmail: found.email,
      clientUserId: found.userId || '',
    });
  };

  const handleSelectInquiry = (inqId: string) => {
    const inq = inquiries.find((i) => i.id === inqId);
    if (!inq) return;
    const matchedClient = clients.find(
      (c) => c.email.toLowerCase() === inq.email.toLowerCase()
    );
    updateForm({
      inquiryId: inq.id,
      clientId: matchedClient?.id || form.clientId,
      clientName: inq.fullName,
      clientEmail: inq.email,
      clientUserId: matchedClient?.userId || form.clientUserId,
      projectTitle: `${inq.serviceRequired} — ${inq.companyName || inq.fullName}`,
      serviceCategory: inq.serviceRequired,
      scopeSummary: inq.description,
    });
  };

  const performSaveDocument = async () => {
    if (!form.clientName.trim() || !form.projectTitle.trim()) {
      showToast('error', 'Missing Fields', 'Client name and project title are required.');
      return;
    }
    if (totals.validationErrors.length > 0) {
      showToast('error', 'Validation Error', totals.validationErrors[0]);
      return;
    }

    setSavingDoc(true);
    try {
      const saved = await saveQuotationAdmin(
        {
          quotationNumber: form.quotationNumber.trim(),
          documentType: form.documentType,
          version: form.version || 1,
          parentQuotationId: editingRecord?.parentQuotationId,
          revisionHistory: editingRecord?.revisionHistory,
          inquiryId: form.inquiryId || undefined,
          clientId: form.clientId,
          clientUserId: form.clientUserId,
          clientName: form.clientName.trim(),
          clientEmail: form.clientEmail.trim(),
          projectTitle: form.projectTitle.trim(),
          serviceCategory: form.serviceCategory,
          scopeSummary: form.scopeSummary,
          deliverables: form.deliverables,
          estimatedTimeline: form.estimatedTimeline,
          issueDate: form.issueDate,
          expiryDate: form.expiryDate,
          lineItems: totals.normalizedItems.map((li) => ({
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            amount: li.amount,
          })),
          subtotal: totals.subtotal,
          discount: totals.discount,
          taxRate: effectiveTaxRate,
          taxAmount: totals.taxAmount,
          total: totals.total,
          currency: 'INR',
          status: form.status,
          notes: form.notes,
          termsAndConditions: form.termsAndConditions,
          convertedProjectId: editingRecord?.convertedProjectId,
          convertedInvoiceId: editingRecord?.convertedInvoiceId,
        },
        editingId || undefined
      );

      saveInvoiceGstMeta(saved.id, {
        gstMode,
        sacCode: sacCode || '9983',
        clientGstin: clientGstin.trim() || undefined,
      });

      if (form.inquiryId) {
        const linkedInq = inquiries.find((i) => i.id === form.inquiryId);
        if (linkedInq && linkedInq.status === 'New') {
          await updateInquiryAdmin(linkedInq, { status: 'Proposal Sent' }).catch(() => {});
        }
      }

      showToast(
        'success',
        editingId ? `${form.documentType} Updated` : `${form.documentType} Created`,
        `${saved.quotationNumber} (${formatINR(saved.total)})`
      );
      setFormDirty(false);
      setShowUnsavedModal(false);
      setShowBuilder(false);
      setEditingId(null);
      setEditingRecord(null);
      await loadAll();
    } catch (err) {
      showToast('error', `Failed to save ${form.documentType.toLowerCase()}`, err instanceof Error ? err.message : '');
    } finally {
      setSavingDoc(false);
    }
  };

  const handleSaveQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    await performSaveDocument();
  };

  const handleSaveAsNewRevision = async () => {
    if (!editingRecord) return;
    setSavingDoc(true);
    try {
      const rev = await createQuotationRevisionAdmin(editingRecord, {
        quotationNumber: editingRecord.quotationNumber,
        documentType: form.documentType,
        clientId: form.clientId,
        clientUserId: form.clientUserId,
        clientName: form.clientName.trim(),
        clientEmail: form.clientEmail.trim(),
        projectTitle: form.projectTitle.trim(),
        serviceCategory: form.serviceCategory,
        scopeSummary: form.scopeSummary,
        deliverables: form.deliverables,
        estimatedTimeline: form.estimatedTimeline,
        issueDate: form.issueDate,
        expiryDate: form.expiryDate,
        lineItems: totals.normalizedItems.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          amount: li.amount,
        })),
        subtotal: totals.subtotal,
        discount: totals.discount,
        taxRate: effectiveTaxRate,
        taxAmount: totals.taxAmount,
        total: totals.total,
        currency: 'INR',
        status: 'Sent',
        notes: form.notes,
        termsAndConditions: form.termsAndConditions,
      });
      saveInvoiceGstMeta(rev.id, {
        gstMode,
        sacCode: sacCode || '9983',
        clientGstin: clientGstin.trim() || undefined,
      });
      await loadAll();
      setFormDirty(false);
      setShowBuilder(false);
      setEditingId(null);
      setEditingRecord(null);
      showToast(
        'success',
        `Revision v${rev.version} Created`,
        `New revision ${rev.quotationNumber} saved while preserving accepted version ${editingRecord.quotationNumber}.`
      );
    } catch (err) {
      showToast('error', 'Failed to create revision', err instanceof Error ? err.message : '');
    } finally {
      setSavingDoc(false);
    }
  };

  const handleDuplicateDoc = async (q: QuotationRecord, targetType?: QuotationDocumentType) => {
    try {
      const copy = await duplicateQuotationAdmin(q, targetType);
      await loadAll();
      showToast(
        'success',
        targetType && targetType !== inferQuotationDocumentType(q)
          ? `Converted to ${targetType}`
          : `${inferQuotationDocumentType(q)} Duplicated`,
        `Created ${copy.quotationNumber} (${formatINR(copy.total)}).`
      );
    } catch (err) {
      showToast('error', 'Duplicate Failed', err instanceof Error ? err.message : '');
    }
  };

  const handleArchiveDoc = async (q: QuotationRecord) => {
    try {
      await archiveQuotationAdmin(q, 'Archived');
      await loadAll();
      showToast('success', `${inferQuotationDocumentType(q)} Archived`, `${q.quotationNumber} marked as Archived.`);
    } catch (err) {
      showToast('error', 'Archive Failed', err instanceof Error ? err.message : '');
    }
  };

  const handleOpenDeleteDocModal = async (q: QuotationRecord) => {
    const docLabel = inferQuotationDocumentType(q);
    const eligibility = checkQuotationDeleteEligibilityAdmin(q);
    setDeleteModalConfig({
      isOpen: true,
      recordType: docLabel,
      recordTitle: q.projectTitle,
      recordIdentifier: q.quotationNumber,
      clientName: q.clientName,
      monetaryTotal: q.total,
      statusLabel: q.status,
      canHardDelete: eligibility.canHardDelete,
      blockingReason: eligibility.reason,
      dependencyItems: [
        {
          label: `${docLabel} Status`,
          count: q.status,
        },
        {
          label: 'Conversion Status',
          count: eligibility.isConverted ? 'Converted to Project/Invoice' : 'Not converted',
        },
      ],
      requireExplicitCheckbox: true,
      archiveActionLabel:
        q.status !== 'Archived' ? `Archive ${docLabel} Instead (Recommended)` : undefined,
      onConfirmArchiveOrVoid:
        q.status !== 'Archived'
          ? async () => {
              await archiveQuotationAdmin(q, 'Archived');
              await loadAll();
              showToast('success', `${docLabel} Archived`, `${q.quotationNumber} marked as Archived.`);
            }
          : undefined,
      onConfirmHardDelete: async () => {
        await deleteQuotationAdmin(q.id);
        if (printQuotation?.id === q.id) setPrintQuotation(null);
        if (editingId === q.id) {
          setShowBuilder(false);
          setEditingId(null);
          setEditingRecord(null);
        }
        await loadAll();
        showToast('success', `Draft ${docLabel} Deleted`, `${q.quotationNumber} permanently removed.`);
      },
      onClose: () => setDeleteModalConfig(null),
    });
  };

  const handleConvertQuotationToProjectAndInvoice = async (q: QuotationRecord) => {
    const docLabel = inferQuotationDocumentType(q);
    if (q.convertedProjectId) {
      showToast(
        'warning',
        'Already Converted',
        `This ${docLabel.toLowerCase()} has already been converted into a project to prevent duplicate records.`
      );
      navigate(`/admin/projects/${q.convertedProjectId}`);
      return;
    }

    confirmAction({
      title: `Convert ${docLabel} to Project & Invoice`,
      message: `Create an active Project and INR Invoice (${formatINR(q.total)}) from ${docLabel.toLowerCase()} ${
        q.quotationNumber
      } for ${q.clientName}?`,
      onConfirm: async () => {
        try {
          const projectId = await saveProjectAdmin(
            {
              clientId: q.clientId || '',
              clientUserId: q.clientUserId || '',
              clientName: q.clientName,
              clientEmail: q.clientEmail,
              title: q.projectTitle,
              description: q.scopeSummary,
              serviceType: q.serviceCategory,
              brief: `${q.scopeSummary}\n\nDeliverables: ${q.deliverables}`,
              budget: q.total,
              startDate: today,
              deadline: q.expiryDate || today,
              priority: 'Medium',
              status: 'Planned',
              progress: 10,
              latestUpdate: `Initialized from accepted ${docLabel.toLowerCase()} ${q.quotationNumber}.`,
            },
            `Converted from ${docLabel.toLowerCase()} ${q.quotationNumber}`
          );

          const invoiceNumber = `PE-INV-${new Date().getFullYear()}-${String(
            Math.floor(100 + Math.random() * 900)
          )}`;
          const invoiceId = await saveInvoiceWithLineItemsAdmin(
            {
              invoiceNumber,
              clientId: q.clientId || '',
              clientUserId: q.clientUserId || '',
              clientName: q.clientName,
              clientEmail: q.clientEmail,
              projectId,
              projectTitle: q.projectTitle,
              issueDate: today,
              dueDate: q.expiryDate || today,
              itemsSummary: q.lineItems
                .map((li) => `${li.description} (${li.quantity} × ₹${li.unitPrice})`)
                .join(' · '),
              subtotal: q.subtotal,
              discount: q.discount,
              taxRate: q.taxRate,
              taxAmount: q.taxAmount,
              total: q.total,
              amountPaid: 0,
              balanceDue: q.total,
              currency: 'INR',
              status: 'Sent',
              paymentInstructions:
                'UPI or NEFT/IMPS bank transfer. Reference invoice number upon transfer.',
              notes: `Converted from ${docLabel.toLowerCase()} ${q.quotationNumber}.`,
            },
            q.lineItems.map((li, idx) => ({
              description: li.description,
              quantity: li.quantity,
              unitPrice: li.unitPrice,
              amount: li.amount,
              sortOrder: idx + 1,
            }))
          );

          await saveQuotationAdmin(
            {
              ...q,
              status: 'Accepted',
              convertedProjectId: projectId,
              convertedInvoiceId: invoiceId,
            },
            q.id
          );

          showToast(
            'success',
            'Converted to Project & Invoice',
            `Project and Invoice ${invoiceNumber} created.`
          );
          await loadAll();
          navigate(`/admin/projects/${projectId}`);
        } catch (err) {
          showToast('error', 'Conversion Failed', err instanceof Error ? err.message : '');
        }
      },
    });
  };

  const filteredQuotations = quotations.filter((q) => {
    const qDocType = inferQuotationDocumentType(q);
    const matchesDocType = docTypeFilter === 'All' || qDocType === docTypeFilter;
    const matchesStatus = statusFilter === 'All' || q.status === statusFilter;
    const query = search.toLowerCase();
    const matchesSearch =
      !query ||
      q.quotationNumber.toLowerCase().includes(query) ||
      q.clientName.toLowerCase().includes(query) ||
      q.projectTitle.toLowerCase().includes(query);
    return matchesDocType && matchesStatus && matchesSearch;
  });

  const quotationsCount = quotations.filter((q) => inferQuotationDocumentType(q) === 'Quotation').length;
  const estimatesCount = quotations.filter((q) => inferQuotationDocumentType(q) === 'Estimate').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <h1 className="font-editorial text-2xl font-semibold text-[#172333]">
            Quotations, Cost Estimates & Project Conversion
          </h1>
          <p className="text-xs text-[#6E7785] mt-1">
            Create, edit, revise (v2/v3), duplicate, archive, or convert official Quotations (PE-QTN) and Cost Estimates (PE-EST) in INR.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showBuilder ? (
            <button
              type="button"
              onClick={handleRequestCloseBuilder}
              className="px-4 py-2 text-xs font-semibold text-[#172333] bg-white border border-[#E2E4DF] hover:bg-[#F5F5F1] rounded-lg"
            >
              Close Document Editor
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleOpenCreateDoc('Quotation')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Quotation</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenCreateDoc('Estimate')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#172333] bg-[#F18A45] hover:bg-[#e07934] rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Estimate</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Document Type Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E4DF] pb-3 no-print">
        <div className="flex items-center gap-2">
          {(
            [
              { id: 'All', label: `All Documents (${quotations.length})` },
              { id: 'Quotation', label: `Quotations (${quotationsCount})` },
              { id: 'Estimate', label: `Cost Estimates (${estimatesCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setDocTypeFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                docTypeFilter === tab.id
                  ? 'bg-[#172333] text-white'
                  : 'bg-white border border-[#E2E4DF] text-[#6E7785] hover:text-[#172333]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quotation / Estimate Builder Form */}
      {showBuilder && (
        <form
          onSubmit={handleSaveQuotation}
          className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-5 no-print shadow-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E4DF] pb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-[#172333]">
                {editingId
                  ? `Edit ${form.documentType} (${form.quotationNumber})`
                  : `Create INR ${form.documentType}`}
              </h2>
              {form.version > 1 && (
                <span className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-[#F18A45]/15 text-[#F18A45] rounded">
                  Revision v{form.version}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-[#F5F5F1] p-1 rounded-lg border border-[#E2E4DF] text-xs">
                {(['Quotation', 'Estimate'] as const).map((dt) => (
                  <button
                    key={dt}
                    type="button"
                    onClick={() => {
                      const nextNum = !editingId
                        ? generateDocumentNumber(dt)
                        : dt === 'Estimate'
                        ? form.quotationNumber.replace(/^PE-QTN-/, 'PE-EST-')
                        : form.quotationNumber.replace(/^PE-EST-/, 'PE-QTN-');
                      updateForm({ documentType: dt, quotationNumber: nextNum });
                    }}
                    className={`px-3 py-1 rounded font-medium transition-colors ${
                      form.documentType === dt
                        ? 'bg-[#172333] text-white font-semibold'
                        : 'text-[#6E7785] hover:text-[#172333]'
                    }`}
                  >
                    {dt}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={form.quotationNumber}
                onChange={(e) => updateForm({ quotationNumber: e.target.value })}
                className="w-44 px-3 py-1.5 text-xs font-mono font-semibold text-[#172333] bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
          </div>

          {/* Revision Protection Banner for Accepted / Sent Quotations & Estimates */}
          {editingRecord && (editingRecord.status === 'Accepted' || editingRecord.status === 'Sent') && (
            <div className="p-3.5 bg-[#F18A45]/10 border border-[#F18A45]/30 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5">
                <GitBranch className="w-4 h-4 text-[#F18A45] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#172333]">
                    {editingRecord.status} {form.documentType} — Revision History Protection
                  </p>
                  <p className="text-[#6E7785] mt-0.5">
                    You can save direct updates to {editingRecord.quotationNumber} or click "Save as New Revision (v
                    {(editingRecord.version || 1) + 1})" to preserve the original snapshot.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={savingDoc}
                onClick={handleSaveAsNewRevision}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#F18A45] hover:bg-[#e07934] rounded-lg shrink-0"
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Save as New Revision (v{(editingRecord.version || 1) + 1})</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#172333] mb-1">
                Link Existing Client (Optional)
              </label>
              <select
                value={form.clientId}
                onChange={(e) => handleSelectClient(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              >
                <option value="">— Select Client or Type Below —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-[#172333]">
                  Pre-fill from Inquiry (Optional)
                </label>
                {form.inquiryId && (
                  <button
                    type="button"
                    disabled={aiDraftingQuote}
                    onClick={handleAIDraftFromSelectedInquiry}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#F18A45] hover:underline disabled:opacity-50"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{aiDraftingQuote ? 'Drafting...' : 'AI Draft Scope & Pricing'}</span>
                  </button>
                )}
              </div>
              <select
                value={form.inquiryId}
                onChange={(e) => handleSelectInquiry(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              >
                <option value="">— None —</option>
                {inquiries.map((inq) => (
                  <option key={inq.id} value={inq.id}>
                    {inq.fullName} · {inq.serviceRequired}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172333] mb-1">
                {form.documentType} Status
              </label>
              <select
                value={form.status}
                onChange={(e) => updateForm({ status: e.target.value as QuotationStatus })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              >
                {QUOTATION_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#172333] mb-1">
                Client Name *
              </label>
              <input
                type="text"
                required
                value={form.clientName}
                onChange={(e) => updateForm({ clientName: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#172333] mb-1">
                Client Email *
              </label>
              <input
                type="email"
                required
                value={form.clientEmail}
                onChange={(e) => updateForm({ clientEmail: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172333] mb-1">Issue Date</label>
              <input
                type="date"
                value={form.issueDate}
                onChange={(e) => updateForm({ issueDate: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172333] mb-1">Valid Until *</label>
              <input
                type="date"
                required
                value={form.expiryDate}
                onChange={(e) => updateForm({ expiryDate: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#172333] mb-1">
                Project Title *
              </label>
              <input
                type="text"
                required
                value={form.projectTitle}
                onChange={(e) => updateForm({ projectTitle: e.target.value })}
                placeholder="e.g. Monthly YouTube Thumbnail & Reels Production Package"
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172333] mb-1">
                Estimated Timeline
              </label>
              <input
                type="text"
                value={form.estimatedTimeline}
                onChange={(e) => updateForm({ estimatedTimeline: e.target.value })}
                placeholder="3–5 business days"
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#172333] mb-1">
                Project Scope Summary
              </label>
              <textarea
                rows={2}
                value={form.scopeSummary}
                onChange={(e) => updateForm({ scopeSummary: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172333] mb-1">
                Included Deliverables
              </label>
              <textarea
                rows={2}
                value={form.deliverables}
                onChange={(e) => updateForm({ deliverables: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
          </div>

          {/* Line Items with Reordering */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#172333]">
                {form.documentType} Line Items (INR)
              </span>
              <div className="flex items-center gap-2">
                {services.length > 0 && (
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const srv = services.find((s) => s.id === e.target.value);
                      if (!srv) return;
                      updateForm({
                        lineItems: [
                          ...form.lineItems,
                          {
                            description: `${srv.title} (${srv.category})`,
                            quantity: 1,
                            unitPrice: srv.startingPrice || 500,
                          },
                        ],
                      });
                      e.target.value = '';
                    }}
                    className="px-2.5 py-1 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-md"
                  >
                    <option value="">+ Add from Services Catalog...</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} ({s.priceDisplay})
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() =>
                    updateForm({
                      lineItems: [
                        ...form.lineItems,
                        { description: 'Custom Creative Deliverable', quantity: 1, unitPrice: 500 },
                      ],
                    })
                  }
                  className="text-xs font-semibold text-[#F18A45] hover:underline"
                >
                  + Add Custom Item
                </button>
              </div>
            </div>

            <div className="hidden sm:grid grid-cols-12 gap-2 px-1 text-[11px] font-semibold text-[#6E7785]">
              <div className="col-span-5">Deliverable / Service Description</div>
              <div className="col-span-2">Quantity</div>
              <div className="col-span-2">Unit Price (₹)</div>
              <div className="col-span-2 text-right">Line Total</div>
              <div className="col-span-1 text-right">Order</div>
            </div>

            {form.lineItems.map((item, idx) => {
              const lineAmount = Math.round(
                (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
              );
              return (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    required
                    value={item.description}
                    onChange={(e) => {
                      const next = [...form.lineItems];
                      next[idx] = { ...next[idx], description: e.target.value };
                      updateForm({ lineItems: next });
                    }}
                    placeholder="Service / Deliverable description"
                    className="col-span-12 sm:col-span-5 px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                  />
                  <input
                    type="number"
                    min={1}
                    step="any"
                    value={item.quantity}
                    onChange={(e) => {
                      const next = [...form.lineItems];
                      next[idx] = { ...next[idx], quantity: Number(e.target.value) };
                      updateForm({ lineItems: next });
                    }}
                    className="col-span-4 sm:col-span-2 px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                  />
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={item.unitPrice}
                    onChange={(e) => {
                      const next = [...form.lineItems];
                      next[idx] = { ...next[idx], unitPrice: Number(e.target.value) };
                      updateForm({ lineItems: next });
                    }}
                    className="col-span-4 sm:col-span-2 px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                  />
                  <div className="col-span-2 sm:col-span-2 text-right font-mono text-xs font-semibold text-[#172333] tabular-nums">
                    {formatINR(lineAmount)}
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex items-center justify-end gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => {
                        const next = [...form.lineItems];
                        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                        updateForm({ lineItems: next });
                      }}
                      title="Move Up"
                      className="p-1 text-[#6E7785] hover:text-[#172333] disabled:opacity-25"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === form.lineItems.length - 1}
                      onClick={() => {
                        const next = [...form.lineItems];
                        [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                        updateForm({ lineItems: next });
                      }}
                      title="Move Down"
                      className="p-1 text-[#6E7785] hover:text-[#172333] disabled:opacity-25"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={form.lineItems.length <= 1}
                      onClick={() =>
                        updateForm({
                          lineItems: form.lineItems.filter((_, i) => i !== idx),
                        })
                      }
                      title="Remove Item"
                      className="p-1 text-xs font-bold text-[#B93832] disabled:opacity-30"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E2E4DF]">
            <div>
              <label className="block text-xs font-medium text-[#172333] mb-1">
                Terms & Conditions
              </label>
              <textarea
                rows={2}
                value={form.termsAndConditions}
                onChange={(e) => updateForm({ termsAndConditions: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172333] mb-1">
                Additional Notes / Assumptions (Optional)
              </label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => updateForm({ notes: e.target.value })}
                placeholder="Any special assumptions, turnaround notes, or milestone details..."
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-3 border-t border-[#E2E4DF]">
            <div>
              <label className="block text-xs font-medium mb-1">Discount (INR)</label>
              <input
                type="number"
                min={0}
                value={form.discount}
                onChange={(e) => updateForm({ discount: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                GST / Tax Mode (SAC 9983)
              </label>
              <select
                value={gstMode}
                onChange={(e) => {
                  const nextMode = e.target.value as GstTaxMode;
                  setGstMode(nextMode);
                  setFormDirty(true);
                  if (nextMode === 'NON_GST') updateForm({ taxRate: 0 });
                  else if (nextMode === 'CGST_SGST_18' || nextMode === 'IGST_18')
                    updateForm({ taxRate: 18 });
                }}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              >
                <option value="NON_GST">Non-GST Billing (0% Default)</option>
                <option value="CGST_SGST_18">CGST 9% + SGST 9% (Intra-State 18%)</option>
                <option value="IGST_18">IGST 18% (Inter-State SAC 9983)</option>
                <option value="CUSTOM">Custom Tax Rate (%)</option>
              </select>
            </div>
            <div>
              {gstMode === 'CUSTOM' ? (
                <>
                  <label className="block text-xs font-medium mb-1">Custom Tax Rate (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.taxRate}
                    onChange={(e) => updateForm({ taxRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                  />
                </>
              ) : (
                <>
                  <label className="block text-xs font-medium mb-1">
                    Client GSTIN / SAC Code (Optional)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={clientGstin}
                      onChange={(e) => {
                        setClientGstin(e.target.value.toUpperCase());
                        setFormDirty(true);
                      }}
                      placeholder="Client GSTIN"
                      className="w-2/3 px-2.5 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    />
                    <input
                      type="text"
                      value={sacCode}
                      onChange={(e) => {
                        setSacCode(e.target.value);
                        setFormDirty(true);
                      }}
                      placeholder="SAC 9983"
                      className="w-1/3 px-2 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="bg-[#F5F5F1] rounded-lg p-3 text-right">
              <p className="text-xs text-[#6E7785]">Estimated Total (INR)</p>
              <p className="text-xl font-mono font-semibold text-[#172333] tabular-nums">
                {formatINR(totals.total)}
              </p>
              {gstBreakdown.mode !== 'NON_GST' && (
                <p className="text-[11px] font-mono text-[#6E7785] mt-0.5">
                  Incl. {formatINR(gstBreakdown.totalTax)} Tax ({gstBreakdown.label})
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={savingDoc}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg disabled:opacity-50"
            >
              {savingDoc
                ? 'Saving...'
                : editingId
                ? `Save ${form.documentType} Changes`
                : `Save ${form.documentType}`}
            </button>
            {editingRecord && (
              <button
                type="button"
                disabled={savingDoc}
                onClick={handleSaveAsNewRevision}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-lg"
              >
                <GitBranch className="w-3.5 h-3.5 text-[#F18A45]" />
                <span>Save as New Revision (v{(editingRecord.version || 1) + 1})</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleRequestCloseBuilder}
              className="px-4 py-2 text-xs font-medium text-[#6E7785] hover:text-[#172333]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Printable Quotation / Estimate View */}
      {printQuotation && (
        <div className="bg-white border border-[#172333] rounded-lg p-8 space-y-6">
          <div className="flex items-start justify-between border-b border-[#E2E4DF] pb-6">
            <div>
              <p className="text-xs font-semibold text-[#F18A45]">
                {inferQuotationDocumentType(printQuotation) === 'Estimate'
                  ? 'PROJECT COST ESTIMATE · SAC 9983'
                  : 'OFFICIAL PROJECT QUOTATION · SAC 9983'}
              </p>
              <h2 className="font-editorial text-2xl font-semibold text-[#172333] mt-0.5">
                Prithvi Editify
              </h2>
              <p className="text-xs text-[#6E7785]">
                Shankar Baluragi · Creative Design & Video Studio
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-2">
                <p className="font-mono text-lg font-semibold text-[#172333]">
                  {printQuotation.quotationNumber}
                </p>
                {(printQuotation.version || 1) > 1 && (
                  <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-[#F18A45]/15 text-[#F18A45] rounded">
                    v{printQuotation.version}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#6E7785]">
                Issued: {printQuotation.issueDate} · Valid Until: {printQuotation.expiryDate}
              </p>
              <p className="text-xs font-semibold text-[#172333] mt-1">
                Status: {printQuotation.status}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div>
              <p className="font-semibold text-[#6E7785]">Prepared For:</p>
              <p className="text-sm font-semibold text-[#172333] mt-0.5">
                {printQuotation.clientName}
              </p>
              <p className="text-[#6E7785]">{printQuotation.clientEmail}</p>
            </div>
            <div className="sm:text-right">
              <p className="font-semibold text-[#6E7785]">Project & Estimated Timeline:</p>
              <p className="text-sm font-semibold text-[#172333] mt-0.5">
                {printQuotation.projectTitle}
              </p>
              <p className="text-[#6E7785]">Timeline: {printQuotation.estimatedTimeline}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-[#F5F5F1] rounded-lg text-xs">
            <div>
              <p className="font-semibold text-[#172333]">Scope Summary</p>
              <p className="text-[#6E7785] mt-1">{printQuotation.scopeSummary || '—'}</p>
            </div>
            <div>
              <p className="font-semibold text-[#172333]">Deliverables</p>
              <p className="text-[#6E7785] mt-1">{printQuotation.deliverables || '—'}</p>
            </div>
          </div>

          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E2E4DF] text-[#6E7785]">
                <th className="py-2">Description</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Unit Price</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E4DF]">
              {printQuotation.lineItems.map((li, i) => (
                <tr key={i}>
                  <td className="py-2.5 font-medium text-[#172333]">{li.description}</td>
                  <td className="py-2.5 text-right font-mono">{li.quantity}</td>
                  <td className="py-2.5 text-right font-mono">{formatINR(li.unitPrice)}</td>
                  <td className="py-2.5 text-right font-mono font-semibold">
                    {formatINR(li.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {(() => {
            const qMeta = getInvoiceGstMeta(printQuotation.id);
            const activeMode: GstTaxMode =
              qMeta.gstMode !== 'NON_GST'
                ? qMeta.gstMode
                : printQuotation.taxRate === 18
                ? 'CGST_SGST_18'
                : printQuotation.taxRate > 0
                ? 'CUSTOM'
                : 'NON_GST';
            const printGst = calculateGstBreakdown(
              printQuotation.subtotal,
              printQuotation.discount,
              activeMode,
              printQuotation.taxRate,
              qMeta.sacCode
            );
            const shareUrl = buildPublicQuotationShareUrl(printQuotation);
            return (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start pt-4 border-t border-[#E2E4DF]">
                <div className="md:col-span-7 space-y-4">
                  <UpiQrCodeCard
                    amount={Math.round(printQuotation.total * 0.5)}
                    referenceNumber={`${printQuotation.quotationNumber}-ADV`}
                    clientName={printQuotation.clientName}
                    compact
                  />
                  <div className="text-xs text-[#6E7785] space-y-1">
                    <p className="font-semibold text-[#172333]">Terms & Conditions:</p>
                    <p>{printQuotation.termsAndConditions}</p>
                    {printQuotation.notes && (
                      <p className="text-[#172333] mt-1">
                        <span className="font-semibold">Notes:</span> {printQuotation.notes}
                      </p>
                    )}
                    <p className="mt-1 text-[11px]">
                      Public One-Tap Approval Link:{' '}
                      <a
                        href={shareUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[#F18A45] underline"
                      >
                        {shareUrl}
                      </a>
                    </p>
                  </div>
                </div>
                <div className="md:col-span-5 flex justify-end">
                  <div className="w-72 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#6E7785]">Subtotal:</span>
                      <span className="font-mono tabular-nums">
                        {formatINR(printQuotation.subtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6E7785]">Discount:</span>
                      <span className="font-mono tabular-nums">
                        -{formatINR(printQuotation.discount)}
                      </span>
                    </div>
                    {printGst.mode === 'CGST_SGST_18' ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-[#6E7785]">
                            CGST (9% · SAC {printGst.sacCode}):
                          </span>
                          <span className="font-mono tabular-nums">
                            {formatINR(printGst.cgstAmount)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#6E7785]">
                            SGST (9% · SAC {printGst.sacCode}):
                          </span>
                          <span className="font-mono tabular-nums">
                            {formatINR(printGst.sgstAmount)}
                          </span>
                        </div>
                      </>
                    ) : printGst.mode === 'IGST_18' ? (
                      <div className="flex justify-between">
                        <span className="text-[#6E7785]">
                          IGST (18% · SAC {printGst.sacCode}):
                        </span>
                        <span className="font-mono tabular-nums">
                          {formatINR(printGst.igstAmount)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-between">
                        <span className="text-[#6E7785]">Tax ({printQuotation.taxRate}%):</span>
                        <span className="font-mono tabular-nums">
                          {formatINR(printQuotation.taxAmount)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-[#E2E4DF] font-semibold text-sm text-[#172333]">
                      <span>Total {inferQuotationDocumentType(printQuotation)} (INR):</span>
                      <span className="font-mono tabular-nums">
                        {formatINR(printQuotation.total)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-[#F18A45] font-semibold">
                      <span>50% Advance to Start:</span>
                      <span className="font-mono tabular-nums">
                        {formatINR(Math.round(printQuotation.total * 0.5))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Revision History Trail if available */}
          {printQuotation.revisionHistory && printQuotation.revisionHistory.length > 0 && (
            <div className="p-4 bg-[#F5F5F1] rounded-lg space-y-2 text-xs no-print">
              <p className="font-semibold text-[#172333]">
                Prior Revision Snapshots ({printQuotation.revisionHistory.length})
              </p>
              <div className="divide-y divide-[#E2E4DF]">
                {printQuotation.revisionHistory.map((rev, idx) => (
                  <div key={idx} className="py-1.5 flex items-center justify-between text-[#6E7785]">
                    <span>
                      v{rev.version} · {rev.quotationNumber} ({rev.status}) · Saved{' '}
                      {rev.updatedAt?.split('T')[0]}
                    </span>
                    <span className="font-mono font-semibold text-[#172333]">
                      {formatINR(rev.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 no-print">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#172333] rounded-lg"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Export PDF</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const target = printQuotation;
                setPrintQuotation(null);
                handleOpenEditDoc(target);
              }}
              className="px-4 py-2 text-xs font-semibold text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-lg"
            >
              Edit {inferQuotationDocumentType(printQuotation)}
            </button>
            <button
              type="button"
              onClick={() => {
                const url = buildPublicQuotationShareUrl(printQuotation);
                navigator.clipboard?.writeText(url);
                showToast(
                  'success',
                  'Approval Link Copied',
                  'Public approval link copied to clipboard.'
                );
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-lg"
            >
              <Share2 className="w-3.5 h-3.5 text-[#F18A45]" />
              <span>Copy Public Approval Link</span>
            </button>
            <a
              href={buildWhatsAppQuotationShareUrl(printQuotation)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#26734D] hover:bg-[#1e5c3d] rounded-lg"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Send on WhatsApp</span>
            </a>
            <Link
              to={`/quote/${printQuotation.id}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#172333] border border-[#E2E4DF] rounded-lg hover:bg-[#F5F5F1]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Public Link</span>
            </Link>
            <button
              type="button"
              onClick={() => setPrintQuotation(null)}
              className="px-4 py-2 text-xs font-semibold text-[#6E7785] hover:text-[#172333]"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}

      {/* Search & Status Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#E2E4DF]/60 rounded-lg w-fit">
          {['All', ...QUOTATION_STATUSES].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === st
                  ? 'bg-white text-[#172333] shadow-xs font-semibold'
                  : 'text-[#6E7785] hover:text-[#172333]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search quote/estimate #, client, project..."
          className="px-3.5 py-2 text-xs bg-white border border-[#E2E4DF] rounded-lg w-full sm:w-72"
        />
      </div>

      {/* Quotations & Estimates Table */}
      <div className="bg-white border border-[#E2E4DF] rounded-lg overflow-x-auto no-print">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E2E4DF] text-[11px] font-semibold text-[#6E7785]">
              <th className="py-3 px-4">Document #</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Client & Project</th>
              <th className="py-3 px-4">Valid Until</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Total (INR)</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E4DF] text-xs">
            {filteredQuotations.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-[#6E7785]">
                  No quotations or estimates match the current filter. Use "+ New Quotation" or "+ New Estimate" above.
                </td>
              </tr>
            ) : (
              filteredQuotations.map((q) => {
                const docType = inferQuotationDocumentType(q);
                return (
                  <tr key={q.id} className="hover:bg-[#F5F5F1]/50">
                    <td className="py-3.5 px-4 font-mono font-semibold text-[#172333]">
                      <div className="flex items-center gap-1.5">
                        <span>{q.quotationNumber}</span>
                        {(q.version || 1) > 1 && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-[#F18A45]/15 text-[#F18A45] rounded">
                            v{q.version}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          docType === 'Estimate'
                            ? 'bg-[#F18A45]/15 text-[#B85D19]'
                            : 'bg-[#172333]/10 text-[#172333]'
                        }`}
                      >
                        {docType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-[#172333]">{q.projectTitle}</p>
                      <p className="text-[11px] text-[#6E7785]">
                        {q.clientName} ({q.clientEmail})
                      </p>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[#6E7785]">{q.expiryDate}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`font-semibold ${
                          q.status === 'Accepted'
                            ? 'text-[#26734D]'
                            : q.status === 'Rejected' || q.status === 'Expired'
                            ? 'text-[#B93832]'
                            : q.status === 'Archived'
                            ? 'text-[#6E7785]'
                            : 'text-[#172333]'
                        }`}
                      >
                        {q.status}
                      </span>
                      {q.convertedProjectId && (
                        <span className="block text-[10px] text-[#26734D]">Converted to Project</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-[#172333] tabular-nums">
                      {formatINR(q.total)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-2 flex-wrap">
                        {docType === 'Estimate' && (
                          <button
                            type="button"
                            onClick={() => handleDuplicateDoc(q, 'Quotation')}
                            className="px-2 py-1 text-[11px] font-semibold text-[#172333] bg-[#F18A45]/20 hover:bg-[#F18A45]/30 rounded-md"
                            title="Convert Estimate into an Official Quotation"
                          >
                            → To Quote
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleConvertQuotationToProjectAndInvoice(q)}
                          className="px-2 py-1 text-[11px] font-semibold text-[#26734D] bg-[#26734D]/10 hover:bg-[#26734D]/20 rounded-md"
                        >
                          {q.convertedProjectId ? 'View Project' : 'Convert to Project'}
                        </button>
                        <RecordActionBar
                          onView={() => setPrintQuotation(q)}
                          viewLabel="View / PDF"
                          onEdit={() => handleOpenEditDoc(q)}
                          onDuplicate={() => handleDuplicateDoc(q)}
                          onArchiveOrVoid={
                            q.status !== 'Archived' && q.status !== 'Draft'
                              ? () => handleArchiveDoc(q)
                              : undefined
                          }
                          archiveLabel="Archive"
                          onDelete={() => handleOpenDeleteDocModal(q)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Unsaved Changes Protection Modal */}
      <UnsavedChangesDialog
        isOpen={showUnsavedModal}
        recordLabel={editingRecord ? `${form.documentType} ${editingRecord.quotationNumber}` : `this ${form.documentType.toLowerCase()}`}
        onContinueEditing={() => setShowUnsavedModal(false)}
        onDiscardChanges={() => {
          setShowUnsavedModal(false);
          setFormDirty(false);
          setShowBuilder(false);
          setEditingId(null);
          setEditingRecord(null);
        }}
        onSaveAndClose={performSaveDocument}
      />

      {/* Dependency-Safe Delete / Archive Modal */}
      {deleteModalConfig && <DependencySafeDeleteModal {...deleteModalConfig} />}
    </div>
  );
};
