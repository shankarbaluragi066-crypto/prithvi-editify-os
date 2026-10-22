import React, { useEffect, useState, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Plus,
  Printer,
  Upload,
  Trash2,
  CheckCircle2,
  FileText,
  CreditCard,
  BarChart3,
  Settings,
  Bell,
  Eye,
  Image as ImageIcon,
  Film,
  Lock,
  Search,
  Filter,
  Sparkles,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
} from 'lucide-react';
import {
  fetchAllServicesAdmin,
  saveServiceItem,
  deleteServiceItem,
  buildDefaultServicePackages,
  fetchAllPortfolioAdmin,
  savePortfolioItem,
  deletePortfolioItem,
  fetchAllClientsAdmin,
  fetchAllProjectsAdmin,
  fetchAllInvoicesAdmin,
  fetchInvoiceLineItems,
  saveInvoiceWithLineItemsAdmin,
  checkInvoiceDeleteEligibilityAdmin,
  voidInvoiceAdmin,
  deleteInvoiceAdmin,
  duplicateInvoiceAdmin,
  recordPaymentAdmin,
  fetchAllPaymentsAdmin,
  fetchAllFilesAdmin,
  uploadFileWithMetadata,
  deleteFileAdmin,
  resolveStoragePreviewUrl,
  fetchAllInquiriesAdmin,
  fetchPublicSettings,
  savePublicSettings,
  fetchPrivateSettings,
  savePrivateSettings,
  fetchActivityLogs,
  seedInitialStudioCatalog,
  fetchUserNotifications,
  markNotificationRead,
  updateUserProfileDetails,
} from '../services/crmService';
import {
  DependencySafeDeleteModal,
  SafeDeleteModalConfig,
  UnsavedChangesDialog,
  RecordActionBar,
} from '../components/CrudManagementModals';
import { MediaLibraryManager } from '../components/MediaLibraryManager';
import { MediaPreviewModal, PreviewableMediaItem } from '../components/MediaPreviewModal';
import { MediaSearchFilterState } from '../components/MediaSearchFilterBar';
import { UpiQrCodeCard } from '../components/StudioEnhancements';
import {
  GstTaxMode,
  computeGstBreakdown,
  buildWhatsAppInvoiceShareLink,
  getClientPaymentProofs,
  updateClientPaymentProofStatus,
  ClientPaymentProofSubmission,
} from '../services/workflowEnhancementsService';
import {
  ServiceItem,
  ServicePackageTier,
  PortfolioItem,
  PortfolioCategory,
  ClientRecord,
  ProjectRecord,
  InvoiceRecord,
  InvoiceLineItem,
  InvoiceStatus,
  PaymentRecord,
  DeliverableFile,
  InquiryRecord,
  PublicSettings,
  PrivateSettings,
  ActivityLog,
} from '../types/crm';
import {
  formatINR,
  formatDate,
  calculateInvoiceTotals,
  formatFileSize,
} from '../utils/formatters';
import {
  DEFAULT_PUBLIC_SETTINGS,
  DEFAULT_PRIVATE_SETTINGS,
  createStudioArtworkDataUri,
} from '../utils/seedData';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import {
  generateStructuredServiceContent,
  generateStructuredPortfolioContent,
  generateWrittenContent,
} from '../services/aiAssistantService';

const ADMIN_SERVICE_CATEGORIES = [
  'Graphic Design',
  'YouTube Thumbnail Design',
  'Social Media Design',
  'Logo and Brand Design',
  'Banner and Flyer Design',
  'Promotional Ad Creatives',
  'YouTube Video Editing',
  'Instagram Reels Editing',
  'Social Media Content',
  'Photo Editing',
];

// ============================================================================
// 1. ADMIN SERVICES & PRICING MANAGEMENT PAGE
// ============================================================================
export const AdminServicesPage: React.FC = () => {
  const { showToast, confirmAction } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [editing, setEditing] = useState<ServiceItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState<'image' | 'gallery' | 'video' | null>(null);
  const [previewMedia, setPreviewMedia] = useState<PreviewableMediaItem | null>(null);
  const [activePackageTab, setActivePackageTab] = useState<'Basic' | 'Standard' | 'Premium'>('Basic');
  const [aiBusyAction, setAiBusyAction] = useState<string | null>(null);
  const [seoSuggestion, setSeoSuggestion] = useState<{
    seoTitle: string;
    seoMetaDescription: string;
    keywords: string;
  } | null>(null);

  const [form, setForm] = useState<{
    title: string;
    category: string;
    description: string;
    startingPrice: number;
    priceDisplay: string;
    pricingUnit: string;
    isCustomQuote: boolean;
    deliverablesSummary: string;
    turnaroundTime: string;
    revisions: string;
    imageUrl: string;
    videoPreviewUrl: string;
    mediaUrls: string[];
    packages: ServicePackageTier[];
    published: boolean;
    sortOrder: number;
  }>({
    title: '',
    category: 'Graphic Design',
    description: '',
    startingPrice: 500,
    priceDisplay: '₹500/design',
    pricingUnit: 'design',
    isCustomQuote: false,
    deliverablesSummary:
      'Custom creative concept, High-resolution PNG/JPG/PDF export, 2 revision rounds, Commercial usage rights',
    turnaroundTime: '24–48 hours',
    revisions: '2 Revisions',
    imageUrl: '',
    videoPreviewUrl: '',
    mediaUrls: [],
    packages: buildDefaultServicePackages(
      500,
      'design',
      '24–48 hours',
      'Custom creative concept, High-resolution PNG/JPG/PDF export, 2 revision rounds, Commercial usage rights',
      '2 Revisions'
    ),
    published: true,
    sortOrder: 1,
  });

  const loadServices = useCallback(async () => {
    setServices(await fetchAllServicesAdmin());
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  // Pre-fill Service Editor from AI Creative Assistant (non-destructive, never auto-saved)
  useEffect(() => {
    const aiPayload = (location.state as any)?.aiGeneratedService;
    if (!aiPayload) return;

    const matchedExisting = aiPayload.existingServiceId
      ? services.find((s) => s.id === aiPayload.existingServiceId) || null
      : null;

    setEditing(matchedExisting);
    setForm((prev) => ({
      ...prev,
      title: aiPayload.title || matchedExisting?.title || prev.title,
      category: aiPayload.category || matchedExisting?.category || prev.category,
      description: aiPayload.description || matchedExisting?.description || prev.description,
      deliverablesSummary:
        aiPayload.deliverablesSummary ||
        matchedExisting?.deliverablesSummary ||
        prev.deliverablesSummary,
      startingPrice: matchedExisting?.startingPrice ?? prev.startingPrice,
      priceDisplay: matchedExisting?.priceDisplay || prev.priceDisplay,
      pricingUnit: matchedExisting?.pricingUnit || prev.pricingUnit,
      turnaroundTime: matchedExisting?.turnaroundTime || prev.turnaroundTime,
      revisions: matchedExisting?.revisions || prev.revisions,
      imageUrl: matchedExisting?.imageUrl || prev.imageUrl,
      videoPreviewUrl: matchedExisting?.videoPreviewUrl || prev.videoPreviewUrl,
      mediaUrls: matchedExisting?.mediaUrls || prev.mediaUrls,
      packages: matchedExisting?.packages || prev.packages,
      published: matchedExisting ? matchedExisting.published : true,
      sortOrder: matchedExisting ? matchedExisting.sortOrder : services.length + 1,
    }));
    if (aiPayload.seoTitle || aiPayload.seoMetaDescription) {
      setSeoSuggestion({
        seoTitle: aiPayload.seoTitle || '',
        seoMetaDescription: aiPayload.seoMetaDescription || '',
        keywords: Array.isArray(aiPayload.searchKeywords)
          ? aiPayload.searchKeywords.join(', ')
          : '',
      });
    }
    setShowForm(true);
    showToast(
      'info',
      'AI Draft Applied to Editor',
      'Review and click Publish / Update when ready. Nothing was saved automatically.'
    );
  }, [location.state, services, showToast]);

  const handleContextualGenerateServiceAI = async () => {
    if (!form.title.trim() && !form.category.trim()) {
      showToast('error', 'Enter a Service Title or Category first');
      return;
    }

    const executeGeneration = async () => {
      setAiBusyAction('generate');
      try {
        const res = await generateStructuredServiceContent({
          category: form.category,
          serviceName: form.title || `${form.category} Service`,
          roughDescription: form.description,
          priceDetails: form.priceDisplay,
          deliveryDetails: `${form.turnaroundTime} · ${form.revisions}`,
        });
        setForm((prev) => ({
          ...prev,
          title: res.data.title || prev.title,
          description: res.data.fullDescription || prev.description,
          deliverablesSummary: res.data.deliverables || prev.deliverablesSummary,
        }));
        setSeoSuggestion({
          seoTitle: res.data.seoTitle,
          seoMetaDescription: res.data.seoMetaDescription,
          keywords: (res.data.searchKeywords || []).join(', '),
        });
        showToast(
          'success',
          'AI Service Draft Generated',
          'Review the fields below and click Save when approved.'
        );
      } catch (err) {
        showToast('error', 'AI Generation Failed', err instanceof Error ? err.message : '');
      } finally {
        setAiBusyAction(null);
      }
    };

    if (form.description.trim().length > 20) {
      confirmAction({
        title: 'Replace Current Service Description with AI Draft?',
        message:
          'Your form already contains a description. Replace the draft fields with freshly generated AI content? (Not saved to database until you click Save)',
        onConfirm: executeGeneration,
      });
    } else {
      await executeGeneration();
    }
  };

  const handleContextualImproveServiceDescription = async () => {
    if (!form.description.trim()) {
      showToast('error', 'Write a rough service description first or click "Generate with AI"');
      return;
    }
    setAiBusyAction('improve');
    try {
      const res = await generateWrittenContent({
        task: 'Service description generator',
        action: 'improve',
        topicOrText: `${form.title} (${form.category})`,
        currentDraft: form.description,
        tone: 'Professional',
      });
      setForm((prev) => ({ ...prev, description: res.result }));
      showToast('success', 'Description Improved', 'Review the updated description before saving.');
    } catch (err) {
      showToast('error', 'Failed to improve description', err instanceof Error ? err.message : '');
    } finally {
      setAiBusyAction(null);
    }
  };

  const handleContextualGenerateServiceSEO = async () => {
    setAiBusyAction('seo');
    try {
      const res = await generateStructuredServiceContent({
        category: form.category,
        serviceName: form.title || form.category,
        roughDescription: form.description,
        priceDetails: form.priceDisplay,
        deliveryDetails: form.turnaroundTime,
      });
      setSeoSuggestion({
        seoTitle: res.data.seoTitle,
        seoMetaDescription: res.data.seoMetaDescription,
        keywords: (res.data.searchKeywords || []).join(', '),
      });
      showToast('success', 'SEO Metadata Generated');
    } catch (err) {
      showToast('error', 'SEO Generation Failed', err instanceof Error ? err.message : '');
    } finally {
      setAiBusyAction(null);
    }
  };

  const handleAutoRegeneratePackages = () => {
    const generated = buildDefaultServicePackages(
      form.startingPrice,
      form.pricingUnit,
      form.turnaroundTime,
      form.deliverablesSummary,
      form.revisions
    );
    setForm((prev) => ({ ...prev, packages: generated }));
    showToast('success', 'Packages Synced', 'Basic, Standard & Premium tiers updated from base price.');
  };

  const updatePackageField = (
    tier: 'Basic' | 'Standard' | 'Premium',
    field: keyof ServicePackageTier,
    value: any
  ) => {
    setForm((prev) => {
      const updated = prev.packages.map((pkg) => {
        if (pkg.tier !== tier) return pkg;
        const nextPkg = { ...pkg, [field]: value };
        if (field === 'price') {
          const num = Math.max(0, Number(value) || 0);
          nextPkg.price = num;
          nextPkg.priceDisplay = `₹${num.toLocaleString('en-IN')}`;
        }
        return nextPkg;
      });
      const basicPkg = updated.find((p) => p.tier === 'Basic');
      return {
        ...prev,
        packages: updated,
        startingPrice: basicPkg ? basicPkg.price : prev.startingPrice,
        priceDisplay:
          !prev.isCustomQuote && basicPkg
            ? `₹${basicPkg.price.toLocaleString('en-IN')}/${prev.pricingUnit || 'design'}`
            : prev.priceDisplay,
      };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const imageUrl =
        form.imageUrl || createStudioArtworkDataUri(form.title, form.category, '#F18A45');
      await saveServiceItem({ ...form, imageUrl }, editing || undefined);
      showToast('success', editing ? 'Service Updated' : 'Service Created');
      setShowForm(false);
      setEditing(null);
      await loadServices();
    } catch (err) {
      showToast('error', 'Failed to save service', err instanceof Error ? err.message : '');
    }
  };

  const handleSeedIfEmpty = async () => {
    const res = await seedInitialStudioCatalog();
    showToast('success', `Seeded ${res.servicesSeeded} default INR services`);
    await loadServices();
  };

  const currentPkg =
    form.packages.find((p) => p.tier === activePackageTab) ||
    form.packages[0] ||
    buildDefaultServicePackages(form.startingPrice, form.pricingUnit)[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-editorial text-2xl font-semibold text-[#172333]">
            Services & INR Pricing Management
          </h1>
          <p className="text-xs text-[#6E7785] mt-1">
            Create and manage creative services, gallery samples, deliverables, and Basic / Standard / Premium packages.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/services"
            className="px-3.5 py-2 text-xs font-semibold text-[#172333] bg-white border border-[#E2E4DF] hover:border-[#172333] rounded-lg transition-colors"
          >
            View Public Services Page →
          </Link>
          {services.length === 0 && (
            <button
              type="button"
              onClick={handleSeedIfEmpty}
              className="px-3.5 py-2 text-xs font-semibold text-[#172333] bg-white border border-[#E2E4DF] rounded-lg"
            >
              Seed 10 Starting-Price Services
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              const defaultDeliv =
                'Custom creative concept, High-resolution PNG/JPG/PDF export, 2 revision rounds, Commercial usage rights';
              setForm({
                title: '',
                category: 'Graphic Design',
                description: '',
                startingPrice: 500,
                priceDisplay: '₹500/design',
                pricingUnit: 'design',
                isCustomQuote: false,
                deliverablesSummary: defaultDeliv,
                turnaroundTime: '24–48 hours',
                revisions: '2 Revisions',
                imageUrl: '',
                videoPreviewUrl: '',
                mediaUrls: [],
                packages: buildDefaultServicePackages(
                  500,
                  'design',
                  '24–48 hours',
                  defaultDeliv,
                  '2 Revisions'
                ),
                published: true,
                sortOrder: services.length + 1,
              });
              setShowForm(!showForm);
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg"
          >
            {showForm ? 'Close Editor' : '+ Add Service'}
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleSave}
          className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-6 shadow-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E4DF] pb-4">
            <div>
              <h2 className="text-base font-semibold text-[#172333]">
                {editing ? `Edit Service: ${editing.title}` : 'New Creative Service Listing'}
              </h2>
              <p className="text-xs text-[#6E7785] mt-0.5">
                Configure service overview, media gallery, deliverables, and 3-tier packages (Basic, Standard, Premium).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={aiBusyAction !== null}
                onClick={handleContextualGenerateServiceAI}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#172333] bg-[#F18A45]/20 hover:bg-[#F18A45]/30 border border-[#F18A45]/40 rounded-lg transition-colors disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#B85D1D]" />
                <span>
                  {aiBusyAction === 'generate' ? 'Generating with AI...' : 'Generate with AI'}
                </span>
              </button>
              <button
                type="button"
                disabled={aiBusyAction !== null}
                onClick={handleContextualImproveServiceDescription}
                className="px-3 py-1.5 text-xs font-semibold text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-lg transition-colors disabled:opacity-50"
              >
                {aiBusyAction === 'improve' ? 'Improving...' : 'Improve Description'}
              </button>
              <button
                type="button"
                disabled={aiBusyAction !== null}
                onClick={handleContextualGenerateServiceSEO}
                className="px-3 py-1.5 text-xs font-semibold text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-lg transition-colors disabled:opacity-50"
              >
                {aiBusyAction === 'seo' ? 'Generating SEO...' : 'Generate SEO Content'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/ai-assistant')}
                className="px-3 py-1.5 text-xs font-semibold text-[#172333] bg-white border border-[#E2E4DF] hover:border-[#172333] rounded-lg transition-colors"
              >
                Generate Cover Image →
              </button>
            </div>
          </div>

          {seoSuggestion && (
            <div className="p-4 bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#172333]">
                  AI SEO Suggestions (Ready to Copy or Reference)
                </span>
                <button
                  type="button"
                  onClick={() => setSeoSuggestion(null)}
                  className="text-[11px] text-[#6E7785] hover:text-[#172333]"
                >
                  Dismiss
                </button>
              </div>
              <p className="text-[#172333]">
                <strong>SEO Title:</strong> {seoSuggestion.seoTitle}
              </p>
              <p className="text-[#6E7785]">
                <strong>Meta Description:</strong> {seoSuggestion.seoMetaDescription}
              </p>
              {seoSuggestion.keywords && (
                <p className="font-mono text-[11px] text-[#6E7785]">
                  Keywords: {seoSuggestion.keywords}
                </p>
              )}
            </div>
          )}

          {/* Row 1: Title, Category, Pricing Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-[#172333] mb-1">
                Service Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. High-CTR YouTube Thumbnail Design"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg focus:outline-none focus:border-[#172333]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172333] mb-1">Category *</label>
              <select
                value={
                  ADMIN_SERVICE_CATEGORIES.includes(form.category) ? form.category : '__custom__'
                }
                onChange={(e) => {
                  if (e.target.value !== '__custom__') {
                    setForm({ ...form, category: e.target.value });
                  }
                }}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg focus:outline-none focus:border-[#172333]"
              >
                {ADMIN_SERVICE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                {!ADMIN_SERVICE_CATEGORIES.includes(form.category) && (
                  <option value="__custom__">{form.category} (Custom)</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172333] mb-1">
                Pricing Unit (e.g. design, thumbnail, video, reel)
              </label>
              <input
                type="text"
                value={form.pricingUnit}
                onChange={(e) => {
                  const unit = e.target.value;
                  setForm({
                    ...form,
                    pricingUnit: unit,
                    priceDisplay: form.isCustomQuote
                      ? 'Custom quote'
                      : `₹${form.startingPrice.toLocaleString('en-IN')}/${unit || 'design'}`,
                  });
                }}
                placeholder="design"
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg focus:outline-none focus:border-[#172333]"
              />
            </div>
          </div>

          {/* Row 2: Starting Price, Display Price, Turnaround, Revisions, Sort Order */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#172333] mb-1">
                Starting Price (INR)
              </label>
              <input
                type="number"
                min={0}
                value={form.startingPrice}
                onChange={(e) => {
                  const num = Math.max(0, Number(e.target.value) || 0);
                  setForm({
                    ...form,
                    startingPrice: num,
                    priceDisplay: form.isCustomQuote
                      ? 'Custom quote'
                      : `₹${num.toLocaleString('en-IN')}/${form.pricingUnit || 'design'}`,
                  });
                }}
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172333] mb-1">
                Display Price *
              </label>
              <input
                type="text"
                required
                value={form.priceDisplay}
                onChange={(e) => setForm({ ...form, priceDisplay: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172333] mb-1">
                Delivery Time
              </label>
              <input
                type="text"
                value={form.turnaroundTime}
                onChange={(e) => setForm({ ...form, turnaroundTime: e.target.value })}
                placeholder="24–48 hours"
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172333] mb-1">
                Revisions Included
              </label>
              <input
                type="text"
                value={form.revisions}
                onChange={(e) => setForm({ ...form, revisions: e.target.value })}
                placeholder="2 Revisions"
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172333] mb-1">Sort Order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
          </div>

          {/* Row 3: Full Description & Deliverables Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#172333] mb-1">
                About This Service (Full Description) *
              </label>
              <textarea
                rows={4}
                required
                placeholder="Describe what you will design or edit, your creative approach, and why brands choose this service..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172333] mb-1">
                What’s Included / Deliverables (comma-separated) *
              </label>
              <textarea
                rows={4}
                required
                placeholder="High-resolution PNG/JPG/PDF export, 2 revision rounds, Custom typography & color grading, Commercial usage rights"
                value={form.deliverablesSummary}
                onChange={(e) => setForm({ ...form, deliverablesSummary: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
          </div>

          {/* Row 4: Service Packages Builder (Basic / Standard / Premium) */}
          <div className="border border-[#E2E4DF] rounded-lg p-5 bg-[#F5F5F1]/60 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#172333]">
                  Service Packages (Basic · Standard · Premium)
                </h3>
                <p className="text-xs text-[#6E7785]">
                  Visitors can switch between Basic, Standard, and Premium tabs on the Service Detail page.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAutoRegeneratePackages}
                className="px-3 py-1.5 text-xs font-semibold text-[#172333] bg-white border border-[#E2E4DF] hover:border-[#172333] rounded-lg transition-colors"
              >
                Auto-Calculate Tiers from ₹{form.startingPrice}
              </button>
            </div>

            <div className="flex items-center gap-2 border-b border-[#E2E4DF] pb-3">
              {(['Basic', 'Standard', 'Premium'] as const).map((tier) => {
                const pkg = form.packages.find((p) => p.tier === tier);
                const isAct = activePackageTab === tier;
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setActivePackageTab(tier)}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                      isAct
                        ? 'bg-[#172333] text-white border-[#172333]'
                        : 'bg-white text-[#6E7785] border-[#E2E4DF] hover:text-[#172333]'
                    }`}
                  >
                    {tier} ({pkg?.priceDisplay || '₹0'})
                  </button>
                );
              })}
            </div>

            {currentPkg && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-white p-4 rounded-lg border border-[#E2E4DF]">
                <div>
                  <label className="block text-[11px] font-semibold text-[#6E7785] mb-1">
                    {currentPkg.tier} Package Title
                  </label>
                  <input
                    type="text"
                    value={currentPkg.name}
                    onChange={(e) => updatePackageField(currentPkg.tier, 'name', e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#6E7785] mb-1">
                    {currentPkg.tier} Price (INR)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={currentPkg.price}
                    onChange={(e) =>
                      updatePackageField(currentPkg.tier, 'price', Number(e.target.value))
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#6E7785] mb-1">
                    Delivery Time
                  </label>
                  <input
                    type="text"
                    value={currentPkg.deliveryTime}
                    onChange={(e) =>
                      updatePackageField(currentPkg.tier, 'deliveryTime', e.target.value)
                    }
                    className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#6E7785] mb-1">
                    Revisions
                  </label>
                  <input
                    type="text"
                    value={currentPkg.revisions}
                    onChange={(e) =>
                      updatePackageField(currentPkg.tier, 'revisions', e.target.value)
                    }
                    className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-[#6E7785] mb-1">
                    Short Package Summary
                  </label>
                  <input
                    type="text"
                    value={currentPkg.description}
                    onChange={(e) =>
                      updatePackageField(currentPkg.tier, 'description', e.target.value)
                    }
                    className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-[#6E7785] mb-1">
                    Included Deliverables (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={currentPkg.features.join(', ')}
                    onChange={(e) =>
                      updatePackageField(
                        currentPkg.tier,
                        'features',
                        e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean)
                      )
                    }
                    className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Row 5: Cover Image, Gallery Images & Video Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-[#172333]">
                  Primary Cover Image URL (service-media)
                </label>
                <button
                  type="button"
                  onClick={() => setShowMediaPicker('image')}
                  className="text-[11px] font-semibold text-[#F18A45] hover:underline"
                >
                  + Upload / Pick Cover Image
                </button>
              </div>
              <input
                type="text"
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                placeholder="https://... or select from service-media bucket"
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-[#172333]">
                  Sample Video / Reel Preview URL (Optional)
                </label>
                <button
                  type="button"
                  onClick={() => setShowMediaPicker('video')}
                  className="text-[11px] font-semibold text-[#F18A45] hover:underline"
                >
                  + Upload / Pick Video
                </button>
              </div>
              <input
                type="text"
                value={form.videoPreviewUrl}
                onChange={(e) => setForm({ ...form, videoPreviewUrl: e.target.value })}
                placeholder="https://... (.mp4 / .webm)"
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-[#172333]">
                  Additional Gallery Preview Images (comma-separated URLs)
                </label>
                <button
                  type="button"
                  onClick={() => setShowMediaPicker('gallery')}
                  className="text-[11px] font-semibold text-[#F18A45] hover:underline"
                >
                  + Add Image to Gallery
                </button>
              </div>
              <input
                type="text"
                value={form.mediaUrls.join(', ')}
                onChange={(e) =>
                  setForm({
                    ...form,
                    mediaUrls: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="Add 2–4 extra sample images so clients can browse a gallery carousel on the service page"
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-6 pt-2 border-t border-[#E2E4DF]">
            <div className="flex flex-wrap items-center gap-6 text-xs">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isCustomQuote}
                  onChange={(e) => setForm({ ...form, isCustomQuote: e.target.checked })}
                />
                <span>Mark as Custom Quote</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={(e) => setForm({ ...form, published: e.target.checked })}
                />
                <span>Published on Public Website</span>
              </label>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
                className="px-4 py-2 text-xs font-medium text-[#6E7785] hover:text-[#172333]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg"
              >
                {editing ? 'Update Service Listing' : 'Publish Service Listing'}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="bg-white border border-[#E2E4DF] rounded-lg overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E2E4DF] text-[11px] font-semibold text-[#6E7785]">
              <th className="py-3 px-4">#</th>
              <th className="py-3 px-4">Service Listing</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Starting Price</th>
              <th className="py-3 px-4">Delivery & Packages</th>
              <th className="py-3 px-4">Visibility</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E4DF] text-xs">
            {services.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[#6E7785]">
                  No services stored in Supabase yet. Click "Seed 10 Starting-Price Services" above.
                </td>
              </tr>
            ) : (
              services.map((srv) => (
                <tr key={srv.id} className="hover:bg-[#F5F5F1]/50">
                  <td className="py-3.5 px-4 font-mono">{srv.sortOrder}</td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={
                          srv.imageUrl ||
                          createStudioArtworkDataUri(srv.title, srv.category, '#F18A45')
                        }
                        alt={srv.title}
                        referrerPolicy="no-referrer"
                        className="w-12 h-9 rounded object-cover bg-[#172333] border border-[#E2E4DF] shrink-0"
                      />
                      <div>
                        <p className="font-semibold text-[#172333]">{srv.title}</p>
                        <p className="text-[11px] text-[#6E7785] line-clamp-1 max-w-xs">
                          {srv.deliverablesSummary}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-[#6E7785]">{srv.category}</td>
                  <td className="py-3.5 px-4 font-mono font-semibold text-[#172333] tabular-nums">
                    {srv.priceDisplay}
                  </td>
                  <td className="py-3.5 px-4 text-[#6E7785]">
                    <span>{srv.turnaroundTime || '24–48 hours'}</span>
                    <span className="block text-[11px] text-[#26734D]">
                      3 Packages (Basic · Std · Prem)
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {srv.published ? 'Published' : 'Unpublished Draft'}
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-3 whitespace-nowrap">
                    <Link
                      to={`/services/${encodeURIComponent(srv.slug || srv.id)}`}
                      className="font-semibold text-[#26734D] hover:underline"
                    >
                      View Page
                    </Link>
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewMedia({
                          id: srv.id,
                          title: srv.title,
                          url: srv.imageUrl,
                          videoUrl: srv.videoPreviewUrl || undefined,
                          description: srv.description,
                          categoryLabel: `${srv.category} · ${srv.priceDisplay}`,
                          storageBucket: 'service-media',
                        })
                      }
                      className="font-semibold text-[#172333] hover:text-[#F18A45]"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(srv);
                        setForm({
                          title: srv.title,
                          category: srv.category,
                          description: srv.description,
                          startingPrice: srv.startingPrice,
                          priceDisplay: srv.priceDisplay,
                          pricingUnit: srv.pricingUnit || 'design',
                          isCustomQuote: srv.isCustomQuote,
                          deliverablesSummary: srv.deliverablesSummary,
                          turnaroundTime: srv.turnaroundTime,
                          revisions: srv.revisions || '2 Revisions',
                          imageUrl: srv.imageUrl,
                          videoPreviewUrl: srv.videoPreviewUrl || '',
                          mediaUrls: Array.isArray(srv.mediaUrls) ? srv.mediaUrls : [],
                          packages:
                            srv.packages && srv.packages.length > 0
                              ? srv.packages
                              : buildDefaultServicePackages(
                                  srv.startingPrice,
                                  srv.pricingUnit,
                                  srv.turnaroundTime,
                                  srv.deliverablesSummary,
                                  srv.revisions || '2 Revisions'
                                ),
                          published: srv.published,
                          sortOrder: srv.sortOrder,
                        });
                        setShowForm(true);
                      }}
                      className="font-semibold text-[#172333] hover:text-[#F18A45]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        confirmAction({
                          title: 'Delete Service',
                          message: `Remove "${srv.title}" from the catalog?`,
                          onConfirm: async () => {
                            await deleteServiceItem(srv.id, srv.title);
                            await loadServices();
                            showToast('success', 'Service Deleted');
                          },
                        })
                      }
                      className="text-[#B93832] hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showMediaPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#172333]/75 p-4 overflow-y-auto">
          <div className="bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <MediaLibraryManager
              mode="picker"
              defaultBucket="service-media"
              allowedCategories={showMediaPicker === 'video' ? ['video'] : ['image', 'pdf']}
              onClosePicker={() => setShowMediaPicker(null)}
              onSelectAsset={(asset) => {
                if (showMediaPicker === 'video') {
                  setForm((prev) => ({ ...prev, videoPreviewUrl: asset.publicUrl }));
                } else if (showMediaPicker === 'gallery') {
                  setForm((prev) => ({
                    ...prev,
                    mediaUrls: prev.mediaUrls.includes(asset.publicUrl)
                      ? prev.mediaUrls
                      : [...prev.mediaUrls, asset.publicUrl],
                  }));
                } else {
                  setForm((prev) => ({ ...prev, imageUrl: asset.publicUrl }));
                }
                setShowMediaPicker(null);
                showToast('success', 'Media Linked to Service', asset.title);
              }}
            />
          </div>
        </div>
      )}

      <MediaPreviewModal item={previewMedia} onClose={() => setPreviewMedia(null)} />
    </div>
  );
};

// ============================================================================
// 2. ADMIN PORTFOLIO MANAGEMENT PAGE
// ============================================================================
const CATEGORIES: PortfolioCategory[] = [
  'Graphic Design',
  'Social Media',
  'YouTube Thumbnails',
  'Video Editing',
  'Instagram Reels',
  'Promotional Ads',
  'Branding',
  'Other',
];

export const AdminPortfolioPage: React.FC = () => {
  const { showToast, confirmAction } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [editing, setEditing] = useState<PortfolioItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState<'cover' | 'video' | null>(null);
  const [previewMedia, setPreviewMedia] = useState<PreviewableMediaItem | null>(null);
  const [aiBusyAction, setAiBusyAction] = useState<string | null>(null);
  const [portfolioSeoSuggestion, setPortfolioSeoSuggestion] = useState<{
    seoTitle: string;
    seoMetaDescription: string;
    caption: string;
  } | null>(null);

  const [form, setForm] = useState({
    title: '',
    category: 'Graphic Design' as PortfolioCategory,
    description: '',
    coverImage: '',
    videoUrl: '',
    tagsInput: '',
    projectUrl: '',
    metricsSummary: 'Studio Deliverable · 1080p Master',
    featured: false,
    published: true,
    isSampleContent: false,
    sortOrder: 1,
  });

  const loadPortfolio = useCallback(async () => {
    setItems(await fetchAllPortfolioAdmin());
  }, []);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  // Pre-fill Portfolio Editor from AI Creative Assistant (non-destructive, never auto-saved)
  useEffect(() => {
    const aiPort = (location.state as any)?.aiGeneratedPortfolio;
    if (!aiPort) return;

    const matchedExisting = aiPort.existingPortfolioId
      ? items.find((i) => i.id === aiPort.existingPortfolioId) || null
      : null;

    setEditing(matchedExisting);
    setForm((prev) => ({
      ...prev,
      title: aiPort.title || matchedExisting?.title || prev.title,
      category:
        (CATEGORIES.includes(aiPort.category) ? aiPort.category : matchedExisting?.category) ||
        prev.category,
      description: aiPort.description || matchedExisting?.description || prev.description,
      metricsSummary:
        aiPort.metricsSummary || matchedExisting?.metricsSummary || prev.metricsSummary,
      tagsInput:
        Array.isArray(aiPort.tags) && aiPort.tags.length > 0
          ? aiPort.tags.join(', ')
          : matchedExisting?.tags?.join(', ') || prev.tagsInput,
      coverImage: matchedExisting?.coverImage || prev.coverImage,
      videoUrl: matchedExisting?.videoUrl || prev.videoUrl,
      projectUrl: matchedExisting?.projectUrl || prev.projectUrl,
      featured: matchedExisting ? matchedExisting.featured : prev.featured,
      published: matchedExisting ? matchedExisting.published : true,
      isSampleContent: matchedExisting ? Boolean(matchedExisting.isSampleContent) : false,
      sortOrder: matchedExisting ? matchedExisting.sortOrder : items.length + 1,
    }));
    if (aiPort.seoTitle || aiPort.seoMetaDescription || aiPort.portfolioCaption) {
      setPortfolioSeoSuggestion({
        seoTitle: aiPort.seoTitle || '',
        seoMetaDescription: aiPort.seoMetaDescription || '',
        caption: aiPort.portfolioCaption || '',
      });
    }
    setShowForm(true);
    showToast(
      'info',
      'AI Portfolio Draft Applied',
      'Review the fields below and click Save Portfolio Entry when approved.'
    );
  }, [location.state, items, showToast]);

  const handleContextualGeneratePortfolioAI = async () => {
    if (!form.title.trim()) {
      showToast('error', 'Enter a Portfolio Project Title first');
      return;
    }

    const executeGen = async () => {
      setAiBusyAction('generate');
      try {
        const res = await generateStructuredPortfolioContent({
          projectTitle: form.title,
          category: form.category,
          existingNotes: form.description,
          keywords: form.tagsInput,
        });
        setForm((prev) => ({
          ...prev,
          title: res.data.title || prev.title,
          description: res.data.detailedDescription || prev.description,
          metricsSummary: res.data.deliverablesDescription || prev.metricsSummary,
          tagsInput:
            Array.isArray(res.data.tags) && res.data.tags.length > 0
              ? res.data.tags.join(', ')
              : prev.tagsInput,
        }));
        setPortfolioSeoSuggestion({
          seoTitle: res.data.seoTitle,
          seoMetaDescription: res.data.seoMetaDescription,
          caption: res.data.portfolioCaption,
        });
        showToast(
          'success',
          'AI Portfolio Content Generated',
          'Review and click Save Portfolio Entry when approved.'
        );
      } catch (err) {
        showToast('error', 'AI Generation Failed', err instanceof Error ? err.message : '');
      } finally {
        setAiBusyAction(null);
      }
    };

    if (form.description.trim().length > 20) {
      confirmAction({
        title: 'Replace Current Portfolio Description with AI Draft?',
        message:
          'Your form already has a description. Replace the draft fields with generated AI copy? (Nothing is saved until you click Save Portfolio Entry)',
        onConfirm: executeGen,
      });
    } else {
      await executeGen();
    }
  };

  const handleContextualImprovePortfolioDesc = async () => {
    if (!form.description.trim()) {
      showToast('error', 'Enter a rough description first or click "Generate with AI"');
      return;
    }
    setAiBusyAction('improve');
    try {
      const res = await generateWrittenContent({
        task: 'Portfolio project description',
        action: 'improve',
        topicOrText: `${form.title} (${form.category})`,
        currentDraft: form.description,
        tone: 'Creative',
      });
      setForm((prev) => ({ ...prev, description: res.result }));
      showToast('success', 'Portfolio Description Improved');
    } catch (err) {
      showToast('error', 'Improvement Failed', err instanceof Error ? err.message : '');
    } finally {
      setAiBusyAction(null);
    }
  };

  const handleContextualPortfolioSEO = async () => {
    setAiBusyAction('seo');
    try {
      const res = await generateStructuredPortfolioContent({
        projectTitle: form.title || form.category,
        category: form.category,
        existingNotes: form.description,
        keywords: form.tagsInput,
      });
      setPortfolioSeoSuggestion({
        seoTitle: res.data.seoTitle,
        seoMetaDescription: res.data.seoMetaDescription,
        caption: res.data.portfolioCaption,
      });
      if (!form.tagsInput.trim() && res.data.tags?.length) {
        setForm((prev) => ({ ...prev, tagsInput: res.data.tags.join(', ') }));
      }
      showToast('success', 'Portfolio SEO & Tags Generated');
    } catch (err) {
      showToast('error', 'SEO Generation Failed', err instanceof Error ? err.message : '');
    } finally {
      setAiBusyAction(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const coverImage =
        form.coverImage || createStudioArtworkDataUri(form.title, form.category, '#F18A45');
      const tags = form.tagsInput
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      await savePortfolioItem(
        {
          title: form.title,
          category: form.category,
          description: form.description,
          coverImage,
          videoUrl: form.videoUrl,
          mediaType: form.videoUrl ? 'video' : 'image',
          tags,
          projectUrl: form.projectUrl,
          metricsSummary: form.metricsSummary,
          featured: form.featured,
          published: form.published,
          isSampleContent: form.isSampleContent,
          sortOrder: form.sortOrder,
        },
        editing || undefined
      );
      showToast('success', editing ? 'Portfolio Entry Updated' : 'Portfolio Entry Added');
      setShowForm(false);
      setEditing(null);
      await loadPortfolio();
    } catch (err) {
      showToast('error', 'Failed to save portfolio item', err instanceof Error ? err.message : '');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-editorial text-2xl font-semibold text-[#172333]">
            Portfolio Management
          </h1>
          <p className="text-xs text-[#6E7785] mt-1">
            Publish, feature, reorder, or upload live studio artwork and video reels to <code className="font-mono">portfolio-media</code>.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setForm({
              title: '',
              category: 'Graphic Design',
              description: '',
              coverImage: '',
              videoUrl: '',
              tagsInput: '',
              projectUrl: '',
              metricsSummary: 'Studio Deliverable',
              featured: false,
              published: true,
              isSampleContent: false,
              sortOrder: items.length + 1,
            });
            setShowForm(!showForm);
          }}
          className="px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg"
        >
          {showForm ? 'Close Editor' : '+ Add Portfolio Entry'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E4DF] pb-3">
            <h2 className="text-base font-semibold text-[#172333]">
              {editing ? `Edit Entry: ${editing.title}` : 'Create Portfolio Entry'}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={aiBusyAction !== null}
                onClick={handleContextualGeneratePortfolioAI}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#172333] bg-[#F18A45]/20 hover:bg-[#F18A45]/30 border border-[#F18A45]/40 rounded-lg transition-colors disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#B85D1D]" />
                <span>
                  {aiBusyAction === 'generate' ? 'Generating...' : 'Generate with AI'}
                </span>
              </button>
              <button
                type="button"
                disabled={aiBusyAction !== null}
                onClick={handleContextualImprovePortfolioDesc}
                className="px-3 py-1.5 text-xs font-semibold text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-lg transition-colors disabled:opacity-50"
              >
                {aiBusyAction === 'improve' ? 'Improving...' : 'Improve Description'}
              </button>
              <button
                type="button"
                disabled={aiBusyAction !== null}
                onClick={handleContextualPortfolioSEO}
                className="px-3 py-1.5 text-xs font-semibold text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-lg transition-colors disabled:opacity-50"
              >
                {aiBusyAction === 'seo' ? 'Generating SEO...' : 'Generate SEO Content'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/ai-assistant')}
                className="px-3 py-1.5 text-xs font-semibold text-[#172333] bg-white border border-[#E2E4DF] hover:border-[#172333] rounded-lg transition-colors"
              >
                Generate Cover Image →
              </button>
            </div>
          </div>

          {portfolioSeoSuggestion && (
            <div className="p-4 bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#172333]">
                  AI Portfolio SEO & Caption Suggestions
                </span>
                <button
                  type="button"
                  onClick={() => setPortfolioSeoSuggestion(null)}
                  className="text-[11px] text-[#6E7785] hover:text-[#172333]"
                >
                  Dismiss
                </button>
              </div>
              <p className="text-[#172333]">
                <strong>SEO Title:</strong> {portfolioSeoSuggestion.seoTitle}
              </p>
              <p className="text-[#6E7785]">
                <strong>Meta Description:</strong> {portfolioSeoSuggestion.seoMetaDescription}
              </p>
              {portfolioSeoSuggestion.caption && (
                <p className="text-[#6E7785]">
                  <strong>Social Caption:</strong> {portfolioSeoSuggestion.caption}
                </p>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Title *</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Category *</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as PortfolioCategory })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Deliverable Specs / Kicker</label>
              <input
                type="text"
                value={form.metricsSummary}
                onChange={(e) => setForm({ ...form, metricsSummary: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium">Cover Artwork / Image URL</label>
                <button
                  type="button"
                  onClick={() => setShowMediaPicker('cover')}
                  className="text-[11px] font-semibold text-[#F18A45] hover:underline"
                >
                  + Upload / Pick Cover
                </button>
              </div>
              <input
                type="text"
                value={form.coverImage}
                onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
                placeholder="https://... (from portfolio-media)"
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium">Video Reel / MP4 URL (Optional)</label>
                <button
                  type="button"
                  onClick={() => setShowMediaPicker('video')}
                  className="text-[11px] font-semibold text-[#F18A45] hover:underline"
                >
                  + Upload / Pick Video
                </button>
              </div>
              <input
                type="text"
                value={form.videoUrl}
                onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
                placeholder="https://... (.mp4 / .webm)"
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Tags (comma-separated)</label>
              <input
                type="text"
                value={form.tagsInput}
                onChange={(e) => setForm({ ...form, tagsInput: e.target.value })}
                placeholder="youtube, thumbnail, ctr, reel"
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Description *</label>
            <textarea
              rows={3}
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
              />
              <span>Published</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
              />
              <span>Featured on Homepage</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isSampleContent}
                onChange={(e) => setForm({ ...form, isSampleContent: e.target.checked })}
              />
              <span>Label as Demonstration Sample</span>
            </label>
          </div>

          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg"
          >
            Save Portfolio Entry
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => (
          <div
            key={item.id}
            className="bg-white border border-[#E2E4DF] rounded-lg overflow-hidden flex flex-col justify-between"
          >
            <div>
              <div
                onClick={() =>
                  setPreviewMedia({
                    id: item.id,
                    title: item.title,
                    url:
                      item.coverImage ||
                      createStudioArtworkDataUri(item.title, item.category, '#F18A45'),
                    videoUrl: item.videoUrl || undefined,
                    description: item.description,
                    tags: item.tags,
                    categoryLabel: `${item.category} · ${item.metricsSummary || 'Portfolio'}`,
                    storageBucket: 'portfolio-media',
                  })
                }
                className="cursor-pointer relative aspect-[4/3] bg-[#172333] overflow-hidden border-b border-[#E2E4DF] group"
              >
                <img
                  src={
                    item.coverImage ||
                    createStudioArtworkDataUri(item.title, item.category, '#F18A45')
                  }
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                {item.videoUrl && (
                  <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#172333]/90 text-[10px] font-mono text-[#F18A45] border border-white/10">
                    <Film className="w-3 h-3" />
                    VIDEO
                  </span>
                )}
              </div>
              <div className="p-5">
                <p className="text-xs text-[#6E7785]">
                  {item.category} · {item.published ? 'Published' : 'Hidden'}
                  {item.isSampleContent ? ' · Sample' : ''}
                </p>
                <h3 className="text-base font-semibold text-[#172333] mt-1">{item.title}</h3>
                <p className="text-xs text-[#6E7785] mt-1.5 line-clamp-2">{item.description}</p>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-[#E2E4DF] flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setPreviewMedia({
                      id: item.id,
                      title: item.title,
                      url:
                        item.coverImage ||
                        createStudioArtworkDataUri(item.title, item.category, '#F18A45'),
                      videoUrl: item.videoUrl || undefined,
                      description: item.description,
                      tags: item.tags,
                      categoryLabel: `${item.category} · ${item.metricsSummary || 'Portfolio'}`,
                      storageBucket: 'portfolio-media',
                    })
                  }
                  className="font-semibold text-[#172333] hover:text-[#F18A45]"
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(item);
                    setForm({
                      title: item.title,
                      category: item.category,
                      description: item.description,
                      coverImage: item.coverImage,
                      videoUrl: item.videoUrl || '',
                      tagsInput: (item.tags || []).join(', '),
                      projectUrl: item.projectUrl,
                      metricsSummary: item.metricsSummary,
                      featured: item.featured,
                      published: item.published,
                      isSampleContent: item.isSampleContent,
                      sortOrder: item.sortOrder,
                    });
                    setShowForm(true);
                  }}
                  className="font-semibold text-[#172333] hover:text-[#F18A45]"
                >
                  Edit Entry
                </button>
              </div>
              <button
                type="button"
                onClick={() =>
                  confirmAction({
                    title: 'Delete Portfolio Item',
                    message: `Delete "${item.title}" permanently?`,
                    onConfirm: async () => {
                      await deletePortfolioItem(item.id, item.title);
                      await loadPortfolio();
                      showToast('success', 'Portfolio Item Deleted');
                    },
                  })
                }
                className="text-[#B93832] hover:underline"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {showMediaPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#172333]/75 p-4 overflow-y-auto">
          <div className="bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <MediaLibraryManager
              mode="picker"
              defaultBucket="portfolio-media"
              allowedCategories={showMediaPicker === 'video' ? ['video'] : ['image', 'pdf']}
              onClosePicker={() => setShowMediaPicker(null)}
              onSelectAsset={(asset) => {
                if (showMediaPicker === 'video') {
                  setForm((prev) => ({ ...prev, videoUrl: asset.publicUrl }));
                } else {
                  setForm((prev) => ({ ...prev, coverImage: asset.publicUrl }));
                }
                setShowMediaPicker(null);
                showToast('success', 'Media Linked to Portfolio Entry', asset.title);
              }}
            />
          </div>
        </div>
      )}

      <MediaPreviewModal item={previewMedia} onClose={() => setPreviewMedia(null)} />
    </div>
  );
};

// ============================================================================
// 3. ADMIN INVOICES & PAYMENT RECORDING PAGE (COMPLETE CRUD + VOID + PRINT)
// ============================================================================
const INVOICE_STATUS_OPTIONS: InvoiceStatus[] = [
  'Draft',
  'Sent',
  'Partially Paid',
  'Paid',
  'Overdue',
  'Void',
];

export const AdminInvoicesPage: React.FC = () => {
  const { showToast, confirmAction } = useToast();
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);

  const [showBuilder, setShowBuilder] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceRecord | null>(null);
  const [formDirty, setFormDirty] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);

  const [payModalInvoice, setPayModalInvoice] = useState<InvoiceRecord | null>(null);
  const [printInvoice, setPrintInvoice] = useState<InvoiceRecord | null>(null);
  const [printLineItems, setPrintLineItems] = useState<InvoiceLineItem[]>([]);
  const [gstMode, setGstMode] = useState<GstTaxMode>('non_gst');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [deleteModalConfig, setDeleteModalConfig] = useState<SafeDeleteModalConfig | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const defaultDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const createEmptyInvoiceForm = (defaultClientId = '') => ({
    invoiceNumber: `PE-INV-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 900))}`,
    clientId: defaultClientId,
    projectId: '',
    issueDate: today,
    dueDate: defaultDue,
    discount: 0,
    taxRate: 0,
    amountPaid: 0,
    status: 'Sent' as InvoiceStatus,
    paymentInstructions: DEFAULT_PRIVATE_SETTINGS.defaultPaymentInstructions,
    notes: 'Thank you for working with Prithvi Editify.',
    lineItems: [{ description: 'Social Media Post Design', quantity: 2, unitPrice: 500 }],
  });

  const [invForm, setInvForm] = useState(() => createEmptyInvoiceForm());

  const [payForm, setPayForm] = useState({
    amount: 0,
    method: 'UPI' as PaymentRecord['method'],
    transactionReference: '',
    paymentDate: today,
    notes: 'Verified by Admin',
  });

  const loadData = useCallback(async () => {
    const [inv, cli, proj, payList, srvList] = await Promise.all([
      fetchAllInvoicesAdmin(),
      fetchAllClientsAdmin(),
      fetchAllProjectsAdmin(),
      fetchAllPaymentsAdmin().catch(() => []),
      fetchAllServicesAdmin().catch(() => []),
    ]);
    setInvoices(inv);
    setClients(cli);
    setProjects(proj);
    setPayments(payList);
    setServices(srvList);
    if (cli.length > 0 && !invForm.clientId) {
      setInvForm((prev) => ({ ...prev, clientId: cli[0].id }));
    }
  }, [invForm.clientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateInvForm = (patch: Partial<typeof invForm>) => {
    setInvForm((prev) => ({ ...prev, ...patch }));
    setFormDirty(true);
  };

  const parseSummaryFallbackItems = (inv: InvoiceRecord) => {
    if (!inv.itemsSummary) {
      return [{ description: inv.projectTitle || 'Creative Design Service', quantity: 1, unitPrice: inv.subtotal || inv.total || 500 }];
    }
    const parts = inv.itemsSummary.split(' · ').map((s) => s.trim()).filter(Boolean);
    const parsed = parts.map((part) => {
      const match = part.match(/^(.*?)\s*\((\d+(?:\.\d+)?)\s*[×x]\s*₹?(\d+(?:\.\d+)?)\)$/);
      if (match) {
        return {
          description: match[1].trim(),
          quantity: Number(match[2]) || 1,
          unitPrice: Number(match[3]) || 0,
        };
      }
      return {
        description: part,
        quantity: 1,
        unitPrice: Math.round((inv.subtotal || inv.total || 500) / Math.max(1, parts.length)),
      };
    });
    return parsed.length > 0
      ? parsed
      : [{ description: inv.projectTitle || 'Creative Service', quantity: 1, unitPrice: inv.subtotal || 500 }];
  };

  const handleOpenCreateInvoice = () => {
    setEditingInvoice(null);
    setGstMode('non_gst');
    setInvForm(createEmptyInvoiceForm(clients[0]?.id || ''));
    setFormDirty(false);
    setShowBuilder(true);
  };

  const handleOpenEditInvoice = async (inv: InvoiceRecord) => {
    setEditingInvoice(inv);
    let loadedItems: Array<{ description: string; quantity: number; unitPrice: number }> = [];
    try {
      const dbItems = await fetchInvoiceLineItems(inv.id);
      if (dbItems.length > 0) {
        loadedItems = dbItems.map((li) => ({
          description: li.description,
          quantity: Number(li.quantity) || 1,
          unitPrice: Number(li.unitPrice) || 0,
        }));
      }
    } catch {
      // Fallback below
    }
    if (loadedItems.length === 0) {
      loadedItems = parseSummaryFallbackItems(inv);
    }

    if (inv.taxRate === 18) {
      setGstMode(inv.notes?.includes('IGST') ? 'igst_18' : 'cgst_sgst_18');
    } else if (inv.taxRate > 0) {
      setGstMode('custom');
    } else {
      setGstMode('non_gst');
    }

    setInvForm({
      invoiceNumber: inv.invoiceNumber,
      clientId: inv.clientId,
      projectId: inv.projectId || '',
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      discount: inv.discount,
      taxRate: inv.taxRate,
      amountPaid: inv.amountPaid,
      status: inv.status,
      paymentInstructions:
        inv.paymentInstructions || DEFAULT_PRIVATE_SETTINGS.defaultPaymentInstructions,
      notes: (inv.notes || '').replace(/\s*\[.*?\]\s*$/, ''),
      lineItems: loadedItems,
    });
    setFormDirty(false);
    setShowBuilder(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenPrintInvoice = async (inv: InvoiceRecord) => {
    setPrintInvoice(inv);
    try {
      const dbItems = await fetchInvoiceLineItems(inv.id);
      if (dbItems.length > 0) {
        setPrintLineItems(dbItems);
      } else {
        const fallback = parseSummaryFallbackItems(inv);
        setPrintLineItems(
          fallback.map((li, idx) => ({
            id: `temp-${idx}`,
            invoiceId: inv.id,
            clientUserId: inv.clientUserId,
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            amount: Math.round(li.quantity * li.unitPrice),
            sortOrder: idx + 1,
          }))
        );
      }
    } catch {
      setPrintLineItems([]);
    }
  };

  const effectiveTaxRate =
    gstMode === 'non_gst'
      ? 0
      : gstMode === 'cgst_sgst_18' || gstMode === 'igst_18'
      ? 18
      : invForm.taxRate;

  const totals = calculateInvoiceTotals({
    items: invForm.lineItems,
    discount: invForm.discount,
    taxRate: effectiveTaxRate,
    amountPaid: editingInvoice ? editingInvoice.amountPaid : invForm.amountPaid,
  });

  const gstDetails = computeGstBreakdown({
    taxableAmount: Math.max(0, totals.subtotal - totals.discount),
    taxRate: effectiveTaxRate,
    gstMode,
  });

  const performSaveInvoice = async () => {
    const client = clients.find((c) => c.id === invForm.clientId);
    if (!client && !editingInvoice) {
      showToast('error', 'Client Required', 'Please select a client for this invoice.');
      return;
    }
    if (!invForm.invoiceNumber.trim()) {
      showToast('error', 'Invoice Number Required', 'Please enter a valid invoice number.');
      return;
    }
    if (totals.validationErrors.length > 0) {
      showToast('error', 'Validation Error', totals.validationErrors[0]);
      return;
    }

    const proj = projects.find((p) => p.id === invForm.projectId);
    const cleanNotes = invForm.notes.replace(/\s*\[.*?\]\s*$/, '').trim();

    setSavingInvoice(true);
    try {
      await saveInvoiceWithLineItemsAdmin(
        {
          invoiceNumber: invForm.invoiceNumber.trim(),
          clientId: client?.id || editingInvoice?.clientId || '',
          clientUserId: client?.userId || editingInvoice?.clientUserId || '',
          clientName: client?.fullName || editingInvoice?.clientName || 'Client',
          clientEmail: client?.email || editingInvoice?.clientEmail || '',
          projectId: proj?.id || '',
          projectTitle: proj?.title || editingInvoice?.projectTitle || 'General Creative Services',
          issueDate: invForm.issueDate,
          dueDate: invForm.dueDate,
          itemsSummary: totals.normalizedItems
            .map((li) => `${li.description} (${li.quantity} × ₹${li.unitPrice})`)
            .join(' · '),
          subtotal: totals.subtotal,
          discount: totals.discount,
          taxRate: effectiveTaxRate,
          taxAmount: totals.taxAmount,
          total: totals.total,
          amountPaid: totals.amountPaid,
          balanceDue: totals.balanceDue,
          currency: 'INR',
          status: invForm.status,
          paymentInstructions: invForm.paymentInstructions,
          notes: gstMode !== 'non_gst' ? `${cleanNotes} [${gstDetails.label}]` : cleanNotes,
        },
        totals.normalizedItems.map((li, idx) => ({
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          amount: li.amount,
          sortOrder: idx + 1,
        })),
        editingInvoice || undefined
      );

      showToast(
        'success',
        editingInvoice ? 'Invoice Updated' : 'Invoice Created',
        `${invForm.invoiceNumber} saved (${formatINR(totals.total)}).`
      );
      setFormDirty(false);
      setShowUnsavedModal(false);
      setShowBuilder(false);
      setEditingInvoice(null);
      await loadData();
    } catch (err) {
      showToast('error', 'Failed to save invoice', err instanceof Error ? err.message : '');
    } finally {
      setSavingInvoice(false);
    }
  };

  const handleSaveInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performSaveInvoice();
  };

  const handleRequestCloseBuilder = () => {
    if (formDirty) {
      setShowUnsavedModal(true);
      return;
    }
    setShowBuilder(false);
    setEditingInvoice(null);
  };

  const handleDuplicateInvoice = async (inv: InvoiceRecord) => {
    try {
      await duplicateInvoiceAdmin(inv);
      await loadData();
      showToast('success', 'Invoice Duplicated', `Created a new Draft copy of ${inv.invoiceNumber}.`);
    } catch (err) {
      showToast('error', 'Duplicate Failed', err instanceof Error ? err.message : '');
    }
  };

  const handleVoidInvoice = (inv: InvoiceRecord) => {
    confirmAction({
      title: `Void / Cancel Invoice ${inv.invoiceNumber}`,
      message: `Mark invoice ${inv.invoiceNumber} as Void? All recorded payments (${formatINR(
        inv.amountPaid
      )}) will remain preserved in the audit log, and the active balance due will be set to ₹0.`,
      confirmLabel: 'Void Invoice',
      onConfirm: async () => {
        try {
          await voidInvoiceAdmin(inv, 'Marked Void by Admin');
          await loadData();
          if (printInvoice?.id === inv.id) {
            setPrintInvoice((prev) => (prev ? { ...prev, status: 'Void', balanceDue: 0 } : null));
          }
          showToast('success', 'Invoice Voided', `${inv.invoiceNumber} has been marked as Void.`);
        } catch (err) {
          showToast('error', 'Failed to void invoice', err instanceof Error ? err.message : '');
        }
      },
    });
  };

  const handleOpenDeleteInvoiceModal = async (inv: InvoiceRecord) => {
    try {
      const eligibility = await checkInvoiceDeleteEligibilityAdmin(inv);
      setDeleteModalConfig({
        isOpen: true,
        recordType: 'Invoice',
        recordTitle: inv.projectTitle || inv.invoiceNumber,
        recordIdentifier: inv.invoiceNumber,
        clientName: inv.clientName,
        monetaryTotal: inv.total,
        statusLabel: inv.status,
        canHardDelete: eligibility.canHardDelete,
        blockingReason: eligibility.reason,
        dependencyItems: [
          {
            label: 'Invoice Status',
            count: inv.status,
          },
          {
            label: 'Recorded Payments',
            count: `${eligibility.paymentsCount} (${formatINR(eligibility.amountPaid)})`,
          },
        ],
        requireExplicitCheckbox: true,
        archiveActionLabel:
          inv.status !== 'Void' ? 'Void / Cancel Invoice Instead (Recommended)' : undefined,
        requiresReasonForArchive: true,
        defaultArchiveReason: 'Cancelled / Voided by Studio Admin',
        onConfirmArchiveOrVoid:
          inv.status !== 'Void'
            ? async (reason) => {
                await voidInvoiceAdmin(inv, reason || 'Voided via safe deletion guard');
                await loadData();
                showToast('success', 'Invoice Voided', `${inv.invoiceNumber} marked as Void.`);
              }
            : undefined,
        onConfirmHardDelete: async () => {
          await deleteInvoiceAdmin(inv);
          if (printInvoice?.id === inv.id) setPrintInvoice(null);
          if (editingInvoice?.id === inv.id) {
            setShowBuilder(false);
            setEditingInvoice(null);
          }
          await loadData();
          showToast('success', 'Draft Invoice Deleted', `${inv.invoiceNumber} permanently removed.`);
        },
        onClose: () => setDeleteModalConfig(null),
      });
    } catch (err) {
      showToast('error', 'Check Failed', err instanceof Error ? err.message : '');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalInvoice) return;
    try {
      await recordPaymentAdmin({
        invoice: payModalInvoice,
        amount: payForm.amount,
        method: payForm.method,
        transactionReference: payForm.transactionReference,
        paymentDate: payForm.paymentDate,
        notes: payForm.notes,
      });
      showToast('success', 'Payment Recorded', 'Invoice balance updated automatically.');
      setPayModalInvoice(null);
      await loadData();
    } catch (err) {
      showToast('error', 'Failed to record payment', err instanceof Error ? err.message : '');
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesStatus = statusFilter === 'All' || inv.status === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.clientName.toLowerCase().includes(q) ||
      inv.projectTitle.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const clientProjects = projects.filter(
    (p) => !invForm.clientId || p.clientId === invForm.clientId
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <h1 className="font-editorial text-2xl font-semibold text-[#172333]">
            Invoices, GST & INR Billing
          </h1>
          <p className="text-xs text-[#6E7785] mt-1">
            Create, edit, duplicate, void, or delete INR invoices with itemized HSN/SAC 9983 billing, UPI QR codes, and payment protection.
          </p>
        </div>
        <button
          type="button"
          onClick={() => (showBuilder ? handleRequestCloseBuilder() : handleOpenCreateInvoice())}
          className="px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg"
        >
          {showBuilder ? 'Close Invoice Editor' : '+ Create Invoice'}
        </button>
      </div>

      {showBuilder && (
        <form
          onSubmit={handleSaveInvoiceSubmit}
          className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-5 no-print shadow-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E4DF] pb-3">
            <div>
              <h2 className="text-base font-semibold text-[#172333]">
                {editingInvoice
                  ? `Edit Invoice · ${editingInvoice.invoiceNumber}`
                  : 'Create New INR Invoice'}
              </h2>
              <p className="text-[11px] text-[#6E7785]">
                All line item quantities, discounts, and GST rates recalculate totals and balance due automatically.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 bg-[#F5F5F1] p-1 rounded-lg border border-[#E2E4DF] text-xs">
              {(
                [
                  { id: 'non_gst', label: 'Non-GST (0% Default)' },
                  { id: 'cgst_sgst_18', label: 'CGST 9% + SGST 9% (SAC 9983)' },
                  { id: 'igst_18', label: 'IGST 18% (SAC 9983)' },
                  { id: 'custom', label: 'Custom Tax %' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setGstMode(opt.id);
                    setFormDirty(true);
                  }}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    gstMode === opt.id
                      ? 'bg-[#172333] text-white font-semibold'
                      : 'text-[#6E7785] hover:text-[#172333]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Controlled Editing Notice for Paid / Partially Paid / Sent Invoices */}
          {editingInvoice && editingInvoice.amountPaid > 0 && (
            <div className="p-3.5 bg-[#B87514]/10 border border-[#B87514]/30 rounded-lg flex items-start gap-2.5 text-xs text-[#172333]">
              <AlertTriangle className="w-4 h-4 text-[#B87514] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#B87514]">
                  Controlled Editing Mode — Verified Payments Recorded ({formatINR(editingInvoice.amountPaid)})
                </p>
                <p className="text-[#6E7785] mt-0.5">
                  Existing payment history is protected. Saving changes to line items, discounts, or tax will automatically recalculate the remaining Balance Due ({formatINR(totals.balanceDue)}) and update status accordingly.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Invoice Number *</label>
              <input
                type="text"
                required
                value={invForm.invoiceNumber}
                onChange={(e) => updateInvForm({ invoiceNumber: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Client *</label>
              <select
                required
                value={invForm.clientId}
                onChange={(e) => updateInvForm({ clientId: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              >
                <option value="">Select client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Linked Project</label>
              <select
                value={invForm.projectId}
                onChange={(e) => updateInvForm({ projectId: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              >
                <option value="">General Creative Services</option>
                {clientProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Status</label>
              <select
                value={invForm.status}
                onChange={(e) => updateInvForm({ status: e.target.value as InvoiceStatus })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              >
                {INVOICE_STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Issue Date</label>
              <input
                type="date"
                value={invForm.issueDate}
                onChange={(e) => updateInvForm({ issueDate: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Due Date</label>
              <input
                type="date"
                value={invForm.dueDate}
                onChange={(e) => updateInvForm({ dueDate: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#172333]">
                Itemized Line Items (HSN/SAC 9983)
              </span>
              <div className="flex items-center gap-2">
                {services.length > 0 && (
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const srv = services.find((s) => s.id === e.target.value);
                      if (!srv) return;
                      updateInvForm({
                        lineItems: [
                          ...invForm.lineItems,
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
                    updateInvForm({
                      lineItems: [
                        ...invForm.lineItems,
                        { description: 'Creative Service Item', quantity: 1, unitPrice: 500 },
                      ],
                    })
                  }
                  className="text-xs font-semibold text-[#F18A45] hover:underline"
                >
                  + Add Line Item
                </button>
              </div>
            </div>

            <div className="hidden sm:grid grid-cols-12 gap-2 px-1 text-[11px] font-semibold text-[#6E7785]">
              <div className="col-span-5">Description</div>
              <div className="col-span-2">Quantity</div>
              <div className="col-span-2">Unit Price (₹)</div>
              <div className="col-span-2 text-right">Line Total</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>

            {invForm.lineItems.map((item, idx) => {
              const lineTotal = Math.round((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0));
              return (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    required
                    value={item.description}
                    onChange={(e) => {
                      const next = [...invForm.lineItems];
                      next[idx] = { ...next[idx], description: e.target.value };
                      updateInvForm({ lineItems: next });
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
                      const next = [...invForm.lineItems];
                      next[idx] = { ...next[idx], quantity: Number(e.target.value) };
                      updateInvForm({ lineItems: next });
                    }}
                    className="col-span-4 sm:col-span-2 px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                  />
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={item.unitPrice}
                    onChange={(e) => {
                      const next = [...invForm.lineItems];
                      next[idx] = { ...next[idx], unitPrice: Number(e.target.value) };
                      updateInvForm({ lineItems: next });
                    }}
                    className="col-span-4 sm:col-span-2 px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                  />
                  <div className="col-span-2 sm:col-span-2 text-right font-mono text-xs font-semibold text-[#172333] tabular-nums">
                    {formatINR(lineTotal)}
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex items-center justify-end gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => {
                        const next = [...invForm.lineItems];
                        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                        updateInvForm({ lineItems: next });
                      }}
                      title="Move Up"
                      className="p-1 text-[#6E7785] hover:text-[#172333] disabled:opacity-25"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === invForm.lineItems.length - 1}
                      onClick={() => {
                        const next = [...invForm.lineItems];
                        [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                        updateInvForm({ lineItems: next });
                      }}
                      title="Move Down"
                      className="p-1 text-[#6E7785] hover:text-[#172333] disabled:opacity-25"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={invForm.lineItems.length <= 1}
                      onClick={() =>
                        updateInvForm({
                          lineItems: invForm.lineItems.filter((_, i) => i !== idx),
                        })
                      }
                      title="Remove Line Item"
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
              <label className="block text-xs font-medium mb-1">Payment Instructions</label>
              <textarea
                rows={2}
                value={invForm.paymentInstructions}
                onChange={(e) => updateInvForm({ paymentInstructions: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Invoice Notes / Terms</label>
              <textarea
                rows={2}
                value={invForm.notes}
                onChange={(e) => updateInvForm({ notes: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[#E2E4DF]">
            <div>
              <label className="block text-xs font-medium mb-1">Discount (INR)</label>
              <input
                type="number"
                min={0}
                value={invForm.discount}
                onChange={(e) => updateInvForm({ discount: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                {gstMode === 'custom' ? 'Custom Tax Rate (%)' : 'Active Tax Mode'}
              </label>
              {gstMode === 'custom' ? (
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={invForm.taxRate}
                  onChange={(e) => updateInvForm({ taxRate: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                />
              ) : (
                <div className="px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg text-[#172333]">
                  {gstDetails.label} ({formatINR(totals.taxAmount)})
                </div>
              )}
            </div>
            <div className="bg-[#F5F5F1] rounded-lg p-3 text-right space-y-0.5">
              <div className="flex justify-between text-[11px] text-[#6E7785]">
                <span>Subtotal: {formatINR(totals.subtotal)}</span>
                <span>Tax: {formatINR(totals.taxAmount)}</span>
              </div>
              <p className="text-lg font-mono font-semibold text-[#172333] tabular-nums">
                Total: {formatINR(totals.total)}
              </p>
              <p className="text-[11px] font-mono text-[#B93832]">
                Paid: {formatINR(totals.amountPaid)} · Balance Due: {formatINR(totals.balanceDue)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={savingInvoice}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg disabled:opacity-50"
            >
              {savingInvoice
                ? 'Saving Invoice...'
                : editingInvoice
                ? 'Save Invoice Changes'
                : 'Issue Invoice'}
            </button>
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

      {/* Printable / Inspector Invoice Preview */}
      {printInvoice && (
        <div className="bg-white border border-[#172333] rounded-lg p-8 space-y-6">
          <div className="flex items-start justify-between border-b border-[#E2E4DF] pb-6">
            <div>
              <span className="text-[11px] font-semibold text-[#F18A45]">
                OFFICIAL STUDIO INVOICE · SAC 9983
              </span>
              <h2 className="font-editorial text-2xl font-semibold text-[#172333]">
                Prithvi Editify
              </h2>
              <p className="text-xs text-[#6E7785]">
                Shankar Baluragi · Creative Design & Video Studio
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-lg font-semibold text-[#172333]">
                {printInvoice.invoiceNumber}
              </p>
              <p className="text-xs text-[#6E7785]">
                Issued: {printInvoice.issueDate} · Due: {printInvoice.dueDate}
              </p>
              <p
                className={`text-xs font-semibold mt-1 ${
                  printInvoice.status === 'Paid'
                    ? 'text-[#26734D]'
                    : printInvoice.status === 'Void'
                    ? 'text-[#B93832]'
                    : 'text-[#172333]'
                }`}
              >
                Status: {printInvoice.status}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 text-xs">
            <div>
              <p className="font-semibold text-[#6E7785]">Billed To:</p>
              <p className="text-sm font-semibold text-[#172333] mt-0.5">
                {printInvoice.clientName}
              </p>
              <p className="text-[#6E7785]">{printInvoice.clientEmail}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-[#6E7785]">Project Scope (SAC 9983):</p>
              <p className="text-[#172333] font-medium mt-0.5">{printInvoice.projectTitle}</p>
            </div>
          </div>

          {/* Itemized Line Items Table */}
          {printLineItems.length > 0 ? (
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
                {printLineItems.map((li, i) => (
                  <tr key={li.id || i}>
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
          ) : (
            <div className="p-4 bg-[#F5F5F1] rounded-lg text-xs">
              <p className="font-semibold text-[#172333] mb-1">Line Items Summary:</p>
              <p className="text-[#6E7785]">{printInvoice.itemsSummary}</p>
            </div>
          )}

          <div className="flex justify-end">
            <div className="w-72 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#6E7785]">Subtotal:</span>
                <span className="font-mono tabular-nums">{formatINR(printInvoice.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6E7785]">Discount:</span>
                <span className="font-mono tabular-nums">-{formatINR(printInvoice.discount)}</span>
              </div>
              {printInvoice.taxRate === 18 && !printInvoice.notes?.includes('IGST') ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-[#6E7785]">CGST (9% · SAC 9983):</span>
                    <span className="font-mono tabular-nums">
                      {formatINR(Math.round(printInvoice.taxAmount / 2))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6E7785]">SGST (9% · SAC 9983):</span>
                    <span className="font-mono tabular-nums">
                      {formatINR(printInvoice.taxAmount - Math.round(printInvoice.taxAmount / 2))}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span className="text-[#6E7785]">
                    {printInvoice.notes?.includes('IGST') ? 'IGST' : 'Tax'} ({printInvoice.taxRate}% · SAC 9983):
                  </span>
                  <span className="font-mono tabular-nums">{formatINR(printInvoice.taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-[#E2E4DF] font-semibold text-sm">
                <span>Total (INR):</span>
                <span className="font-mono tabular-nums">{formatINR(printInvoice.total)}</span>
              </div>
              <div className="flex justify-between text-[#26734D]">
                <span>Amount Paid:</span>
                <span className="font-mono tabular-nums">{formatINR(printInvoice.amountPaid)}</span>
              </div>
              <div className="flex justify-between font-semibold text-[#B93832]">
                <span>Balance Due:</span>
                <span className="font-mono tabular-nums">{formatINR(printInvoice.balanceDue)}</span>
              </div>
            </div>
          </div>

          {/* Payment History for this Invoice */}
          {(() => {
            const invPayments = payments.filter((p) => p.invoiceId === printInvoice.id);
            if (invPayments.length === 0) return null;
            return (
              <div className="p-4 bg-[#F5F5F1] rounded-lg space-y-2 text-xs">
                <p className="font-semibold text-[#172333]">
                  Verified Payment History ({invPayments.length})
                </p>
                <div className="divide-y divide-[#E2E4DF]">
                  {invPayments.map((p) => (
                    <div key={p.id} className="py-1.5 flex items-center justify-between">
                      <span>
                        {p.paymentDate} · {p.method} (UTR: {p.transactionReference || 'N/A'})
                      </span>
                      <span className="font-mono font-semibold text-[#26734D]">
                        {formatINR(p.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Scannable UPI QR Code on Printable Invoice */}
          {printInvoice.status !== 'Void' && printInvoice.balanceDue > 0 && (
            <UpiQrCodeCard
              amount={printInvoice.balanceDue}
              referenceNumber={printInvoice.invoiceNumber}
            />
          )}

          <div className="pt-4 border-t border-[#E2E4DF] text-xs text-[#6E7785]">
            <p className="font-semibold text-[#172333]">Payment Instructions & Notes:</p>
            <p className="mt-1">{printInvoice.paymentInstructions}</p>
            {printInvoice.notes && <p className="mt-1">{printInvoice.notes}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-3 no-print">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#172333] rounded-lg"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const target = printInvoice;
                setPrintInvoice(null);
                handleOpenEditInvoice(target);
              }}
              className="px-4 py-2 text-xs font-semibold text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-lg"
            >
              Edit Invoice
            </button>
            <a
              href={buildWhatsAppInvoiceShareLink(
                printInvoice,
                clients.find((c) => c.id === printInvoice.clientId)?.phone
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-xs font-semibold text-[#172333] bg-[#F18A45] hover:bg-[#e07934] rounded-lg"
            >
              Send on WhatsApp →
            </a>
            <button
              type="button"
              onClick={() => setPrintInvoice(null)}
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
          {['All', ...INVOICE_STATUS_OPTIONS].map((st) => (
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
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search invoice #, client, project..."
          className="px-3.5 py-2 text-xs bg-white border border-[#E2E4DF] rounded-lg w-full sm:w-72"
        />
      </div>

      {/* Invoices Table */}
      <div className="bg-white border border-[#E2E4DF] rounded-lg overflow-x-auto no-print">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E2E4DF] text-[11px] font-semibold text-[#6E7785]">
              <th className="py-3 px-4">Invoice #</th>
              <th className="py-3 px-4">Client & Project</th>
              <th className="py-3 px-4">Due Date</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Total</th>
              <th className="py-3 px-4 text-right">Balance Due</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E4DF] text-xs">
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[#6E7785]">
                  No invoices match the current filter.
                </td>
              </tr>
            ) : (
              filteredInvoices.map((inv) => {
                const clientObj = clients.find((c) => c.id === inv.clientId);
                return (
                  <tr key={inv.id} className="hover:bg-[#F5F5F1]/50">
                    <td className="py-3.5 px-4 font-mono font-semibold text-[#172333]">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-[#172333]">{inv.clientName}</p>
                      <p className="text-[11px] text-[#6E7785]">{inv.projectTitle}</p>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[#6E7785]">{inv.dueDate}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`font-semibold ${
                          inv.status === 'Paid'
                            ? 'text-[#26734D]'
                            : inv.status === 'Void' || inv.status === 'Overdue'
                            ? 'text-[#B93832]'
                            : inv.status === 'Partially Paid'
                            ? 'text-[#B87514]'
                            : 'text-[#172333]'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      {formatINR(inv.total)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums">
                      {formatINR(inv.balanceDue)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-2 flex-wrap">
                        {inv.balanceDue > 0 && inv.status !== 'Void' && (
                          <button
                            type="button"
                            onClick={() => {
                              setPayModalInvoice(inv);
                              setPayForm({
                                amount: inv.balanceDue,
                                method: 'UPI',
                                transactionReference: '',
                                paymentDate: today,
                                notes: 'Manual payment verified by Admin',
                              });
                            }}
                            className="px-2 py-1 text-[11px] font-semibold text-white bg-[#26734D] hover:bg-[#1f5f3f] rounded-md"
                          >
                            + Payment
                          </button>
                        )}
                        <a
                          href={buildWhatsAppInvoiceShareLink(inv, clientObj?.phone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 text-[11px] font-semibold text-[#26734D] bg-[#26734D]/10 hover:bg-[#26734D]/20 rounded-md"
                        >
                          WhatsApp
                        </a>
                        <RecordActionBar
                          onView={() => handleOpenPrintInvoice(inv)}
                          viewLabel="View / PDF"
                          onEdit={() => handleOpenEditInvoice(inv)}
                          onDuplicate={() => handleDuplicateInvoice(inv)}
                          onArchiveOrVoid={
                            inv.status !== 'Void' && inv.status !== 'Draft'
                              ? () => handleVoidInvoice(inv)
                              : undefined
                          }
                          archiveLabel="Void"
                          onDelete={() => handleOpenDeleteInvoiceModal(inv)}
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

      {/* Record Payment Modal */}
      {payModalInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#172333]/60 p-4 no-print">
          <form
            onSubmit={handleRecordPayment}
            className="bg-white border border-[#E2E4DF] rounded-lg max-w-md w-full p-6 space-y-4"
          >
            <h3 className="text-base font-semibold text-[#172333]">
              Record Verified Payment ({payModalInvoice.invoiceNumber})
            </h3>
            <p className="text-xs text-[#6E7785]">
              Recorded as <span className="font-semibold text-[#172333]">Admin Recorded</span> after verifying UPI/Bank transfer receipt.
            </p>
            <div>
              <label className="block text-xs font-medium mb-1">Amount Received (INR) *</label>
              <input
                type="number"
                required
                min={1}
                max={payModalInvoice.balanceDue}
                value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Payment Method</label>
              <select
                value={payForm.method}
                onChange={(e) =>
                  setPayForm({ ...payForm, method: e.target.value as PaymentRecord['method'] })
                }
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              >
                <option value="UPI">UPI</option>
                <option value="Bank Transfer (NEFT/IMPS)">Bank Transfer (NEFT/IMPS)</option>
                <option value="Razorpay">Razorpay</option>
                <option value="Cash">Cash</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">UTR / Transaction Reference</label>
              <input
                type="text"
                required
                value={payForm.transactionReference}
                onChange={(e) => setPayForm({ ...payForm, transactionReference: e.target.value })}
                placeholder="UTR / Reference ID"
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPayModalInvoice(null)}
                className="px-4 py-2 text-xs font-medium bg-[#F5F5F1] rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#26734D] rounded-lg"
              >
                Confirm Payment Received
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Unsaved Changes Protection Modal */}
      <UnsavedChangesDialog
        isOpen={showUnsavedModal}
        recordLabel={editingInvoice ? `Invoice ${editingInvoice.invoiceNumber}` : 'this new invoice'}
        onContinueEditing={() => setShowUnsavedModal(false)}
        onDiscardChanges={() => {
          setShowUnsavedModal(false);
          setFormDirty(false);
          setShowBuilder(false);
          setEditingInvoice(null);
        }}
        onSaveAndClose={performSaveInvoice}
      />

      {/* Dependency-Safe Delete / Void Modal */}
      {deleteModalConfig && <DependencySafeDeleteModal {...deleteModalConfig} />}
    </div>
  );
};

// ============================================================================
// 4. ADMIN PAYMENTS HISTORY & CLIENT UTR VERIFICATION QUEUE PAGE
// ============================================================================
export const AdminPaymentsPage: React.FC = () => {
  const { showToast } = useToast();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [proofs, setProofs] = useState<ClientPaymentProofSubmission[]>([]);

  const loadPaymentsData = useCallback(async () => {
    const [payList, invList] = await Promise.all([
      fetchAllPaymentsAdmin().catch(() => []),
      fetchAllInvoicesAdmin().catch(() => []),
    ]);
    setPayments(payList);
    setInvoices(invList);
    setProofs(getClientPaymentProofs());
  }, []);

  useEffect(() => {
    loadPaymentsData();
  }, [loadPaymentsData]);

  const handleApproveProof = async (proof: ClientPaymentProofSubmission) => {
    const targetInvoice = invoices.find(
      (i) => i.id === proof.invoiceId || i.invoiceNumber === proof.invoiceNumber
    );
    if (!targetInvoice) {
      updateClientPaymentProofStatus(proof.id, 'Approved');
      setProofs(getClientPaymentProofs());
      showToast('success', 'Payment Proof Approved');
      return;
    }

    try {
      await recordPaymentAdmin({
        invoice: targetInvoice,
        amount: proof.amount,
        method: proof.method,
        transactionReference: proof.utrNumber,
        paymentDate: new Date().toISOString().split('T')[0],
        notes: `Verified from Client Portal UTR Submission (${proof.notes || 'Client Proof'})`,
      });
      updateClientPaymentProofStatus(proof.id, 'Approved');
      await loadPaymentsData();
      showToast(
        'success',
        'UTR Verified & Payment Recorded',
        `${proof.invoiceNumber} updated and project master deliverables unlocked.`
      );
    } catch (err) {
      showToast('error', 'Failed to approve proof', err instanceof Error ? err.message : '');
    }
  };

  const handleRejectProof = (proofId: string) => {
    updateClientPaymentProofStatus(proofId, 'Rejected');
    setProofs(getClientPaymentProofs());
    showToast('info', 'Payment Proof Marked Rejected');
  };

  const pendingProofs = proofs.filter((p) => p.status === 'Pending Verification');
  const totalReceived = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-editorial text-2xl font-semibold text-[#172333]">
            Recorded Payments & UTR Verification Queue
          </h1>
          <p className="text-xs text-[#6E7785] mt-1">
            Approve client UTR payment proofs in one click and inspect all verified INR settlements.
          </p>
        </div>
        <div className="bg-white border border-[#E2E4DF] rounded-lg px-4 py-2.5 text-right">
          <p className="text-[11px] text-[#6E7785]">Total Revenue Received</p>
          <p className="font-mono text-lg font-semibold text-[#26734D] tabular-nums">
            {formatINR(totalReceived)}
          </p>
        </div>
      </div>

      {/* Pending Client UTR / Screenshot Verification Queue */}
      <div className="bg-white border border-[#E2E4DF] rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 bg-[#F5F5F1] border-b border-[#E2E4DF] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#172333]">
            Pending Client Payment Verifications ({pendingProofs.length})
          </h2>
          <span className="text-[11px] font-mono text-[#6E7785]">
            Submitted from /portal/invoices
          </span>
        </div>
        {pendingProofs.length === 0 ? (
          <div className="p-6 text-xs text-[#6E7785]">
            No client UTR payment proofs waiting for verification right now.
          </div>
        ) : (
          <div className="divide-y divide-[#E2E4DF] text-xs">
            {pendingProofs.map((proof) => (
              <div
                key={proof.id}
                className="p-4 flex flex-wrap items-center justify-between gap-4 bg-[#F18A45]/5"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#172333]">{proof.invoiceNumber}</span>
                    <span className="font-semibold text-[#172333]">{proof.clientName}</span>
                    <span className="px-2 py-0.5 rounded bg-[#F18A45]/20 text-[#B85D1D] font-mono text-[10px] font-semibold">
                      UTR: {proof.utrNumber}
                    </span>
                  </div>
                  <p className="text-[#6E7785]">
                    Method: {proof.method} · Amount:{' '}
                    <strong className="font-mono text-[#172333]">{formatINR(proof.amount)}</strong>
                    {proof.notes ? ` · Note: "${proof.notes}"` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  {proof.receiptScreenshotDataUrl && (
                    <a
                      href={proof.receiptScreenshotDataUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 font-semibold text-[#172333] bg-white border border-[#E2E4DF] rounded-md"
                    >
                      View Screenshot
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleApproveProof(proof)}
                    className="px-3.5 py-1.5 font-semibold text-white bg-[#26734D] hover:bg-[#1e5c3d] rounded-md"
                  >
                    Approve & Record Payment
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRejectProof(proof.id)}
                    className="px-3 py-1.5 font-semibold text-[#B93832] bg-[#B93832]/10 rounded-md"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-[#E2E4DF] rounded-lg overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E2E4DF] text-[11px] font-semibold text-[#6E7785]">
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Invoice #</th>
              <th className="py-3 px-4">Client</th>
              <th className="py-3 px-4">Method</th>
              <th className="py-3 px-4">UTR / Reference</th>
              <th className="py-3 px-4">Verification Mode</th>
              <th className="py-3 px-4 text-right">Amount (INR)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E4DF] text-xs">
            {payments.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[#6E7785]">
                  No payments recorded yet.
                </td>
              </tr>
            ) : (
              payments.map((pay) => (
                <tr key={pay.id}>
                  <td className="py-3.5 px-4 font-mono text-[#6E7785]">{pay.paymentDate}</td>
                  <td className="py-3.5 px-4 font-mono font-semibold">{pay.invoiceNumber}</td>
                  <td className="py-3.5 px-4">{pay.clientName}</td>
                  <td className="py-3.5 px-4">{pay.method}</td>
                  <td className="py-3.5 px-4 font-mono text-[#6E7785]">
                    {pay.transactionReference || '—'}
                  </td>
                  <td className="py-3.5 px-4 font-medium">{pay.verificationMode}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-semibold text-[#26734D] tabular-nums">
                    {formatINR(pay.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================================
// 5. ADMIN DELIVERABLE FILES PAGE & ADMIN MEDIA LIBRARY PAGE
// ============================================================================
export const AdminMediaLibraryPage: React.FC = () => {
  const [filters, setFilters] = useState<MediaSearchFilterState>({
    searchQuery: '',
    mimeType: 'all',
    tag: '',
    projectId: 'all',
    bucket: 'all',
    sortBy: 'newest',
  });

  return (
    <div className="space-y-6">
      {/* Quick Search & Category/MIME-Type Filter Navigation Bar */}
      <div className="bg-white border border-[#E2E4DF] rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-[#6E7785] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.searchQuery}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))
              }
              placeholder="Search media by file title (.ilike('title', ...)) or #tag..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg focus:outline-none focus:border-[#172333]"
            />
          </div>

          <div className="relative min-w-[210px]">
            <Filter className="w-3.5 h-3.5 text-[#6E7785] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={filters.mimeType}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, mimeType: e.target.value }))
              }
              className="w-full pl-8 pr-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg font-mono"
            >
              <option value="all">All Categories & MIME Types</option>
              <optgroup label="Exact MIME Types (.eq('mime_type'))">
                <option value="image/png">image/png</option>
                <option value="image/jpeg">image/jpeg</option>
                <option value="image/webp">image/webp</option>
                <option value="image/svg+xml">image/svg+xml</option>
                <option value="video/mp4">video/mp4</option>
                <option value="video/webm">video/webm</option>
                <option value="application/pdf">application/pdf</option>
              </optgroup>
              <optgroup label="Media Categories">
                <option value="image">Category: Images (image/*)</option>
                <option value="video">Category: Videos (video/*)</option>
                <option value="pdf">Category: PDFs (application/pdf)</option>
                <option value="document">Category: Project Archives / Docs</option>
              </optgroup>
            </select>
          </div>
        </div>

        {(filters.searchQuery || filters.mimeType !== 'all') && (
          <button
            type="button"
            onClick={() =>
              setFilters((prev) => ({ ...prev, searchQuery: '', mimeType: 'all' }))
            }
            className="px-3 py-1.5 text-xs font-semibold text-[#B93832] bg-[#B93832]/10 hover:bg-[#B93832]/15 rounded-md"
          >
            Clear Search & MIME Filter
          </button>
        )}
      </div>

      <MediaLibraryManager
        mode="full"
        defaultBucket="portfolio-media"
        externalFilters={filters}
        onExternalFiltersChange={setFilters}
      />
    </div>
  );
};

export const AdminFilesPage: React.FC = () => {
  const { showToast, confirmAction } = useToast();
  const { profile } = useAuth();
  const [files, setFiles] = useState<DeliverableFile[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [previewItem, setPreviewItem] = useState<PreviewableMediaItem | null>(null);
  const [form, setForm] = useState({
    projectId: '',
    fileName: '',
    externalUrl: '',
    description: '',
    tagsInput: '',
    category: 'Deliverable' as DeliverableFile['category'],
    versionLabel: 'v1.0',
    visibility: 'client' as 'client' | 'internal',
  });

  const loadData = useCallback(async () => {
    const [f, p] = await Promise.all([fetchAllFilesAdmin(), fetchAllProjectsAdmin()]);
    setFiles(f);
    setProjects(p);
    if (p.length > 0 && !form.projectId) {
      setForm((prev) => ({ ...prev, projectId: p[0].id }));
    }
  }, [form.projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const proj = projects.find((p) => p.id === form.projectId);
    if (!proj) {
      showToast('error', 'Project Required', 'Create a project before attaching deliverables.');
      return;
    }
    try {
      setProgress(10);
      const parsedTags = form.tagsInput
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      await uploadFileWithMetadata({
        file: selectedFile,
        externalUrl: form.externalUrl,
        projectId: proj.id,
        clientUserId: proj.clientUserId || '',
        fileName: form.fileName || selectedFile?.name || 'Deliverable Export',
        category: form.category,
        versionLabel: form.versionLabel,
        visibility: form.visibility,
        uploaderName: profile?.displayName || 'Shankar Baluragi',
        description: form.description,
        tags: parsedTags,
        onProgress: setProgress,
      });
      setProgress(null);
      setSelectedFile(null);
      setForm({ ...form, fileName: '', externalUrl: '', description: '', tagsInput: '' });
      showToast('success', 'Deliverable Uploaded to Private Storage');
      await loadData();
    } catch (err) {
      setProgress(null);
      showToast('error', 'Upload Failed', err instanceof Error ? err.message : '');
    }
  };

  const handleSecureDownload = async (f: DeliverableFile) => {
    try {
      const signedOrPublic = await resolveStoragePreviewUrl({
        storageBucket: f.storageBucket || 'private-project-files',
        storagePath: f.storagePath,
        fallbackUrl: f.downloadUrl,
        expiresInSeconds: 3600,
      });
      if (signedOrPublic) {
        window.open(signedOrPublic, '_blank', 'noopener,noreferrer');
      }
    } catch {
      if (f.downloadUrl) {
        window.open(f.downloadUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-editorial text-2xl font-semibold text-[#172333]">
          Deliverables & Private Client File Vault
        </h1>
        <p className="text-xs text-[#6E7785] mt-1">
          Upload project deliverables, design previews, and reference assets to <code className="font-mono">private-project-files</code> with short-lived signed URLs and interactive previews.
        </p>
      </div>

      <form onSubmit={handleUpload} className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-4">
        <h2 className="text-sm font-semibold text-[#172333]">Upload Deliverable or Preview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Project *</label>
            <select
              required
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            >
              <option value="">Select project...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Display Title *</label>
            <input
              type="text"
              required
              value={form.fileName}
              onChange={(e) => setForm({ ...form, fileName: e.target.value })}
              placeholder="Thumbnail_Master_v1.png"
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value as DeliverableFile['category'] })
              }
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            >
              <option value="Deliverable">Final Deliverable</option>
              <option value="Preview">Design / Video Preview</option>
              <option value="Reference">Reference File</option>
              <option value="Invoice Attachment">Invoice Attachment</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Version Label</label>
            <input
              type="text"
              value={form.versionLabel}
              onChange={(e) => setForm({ ...form, versionLabel: e.target.value })}
              className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">
              Select File (Stored in private-project-files bucket)
            </label>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setSelectedFile(file);
                if (file && !form.fileName) {
                  setForm((prev) => ({ ...prev, fileName: file.name }));
                }
              }}
              className="w-full text-xs text-[#6E7785]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Or External Deliverable Link (Google Drive / Frame.io / Storage URL)
            </label>
            <input
              type="url"
              value={form.externalUrl}
              onChange={(e) => setForm({ ...form, externalUrl: e.target.value })}
              placeholder="https://..."
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Deliverable Description / Notes</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Color-graded 1080p master cut..."
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={form.tagsInput}
              onChange={(e) => setForm({ ...form, tagsInput: e.target.value })}
              placeholder="master, v1, reel"
              className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
        </div>

        {progress !== null && (
          <div className="space-y-1">
            <div className="text-xs font-mono text-[#172333]">Uploading to Supabase Storage: {progress}%</div>
            <div className="w-full h-1.5 bg-[#E2E4DF] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#F18A45] transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          className="px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg"
        >
          Save Deliverable Record
        </button>
      </form>

      <div className="bg-white border border-[#E2E4DF] rounded-lg divide-y divide-[#E2E4DF]">
        {files.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#6E7785]">No files uploaded yet.</div>
        ) : (
          files.map((f) => (
            <div key={f.id} className="p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-[#172333]">
                    {f.fileName} ({f.versionLabel})
                  </p>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded">
                    <Lock className="w-2.5 h-2.5 text-[#F18A45]" />
                    {f.storageBucket || 'private-project-files'}
                  </span>
                </div>
                <p className="text-[#6E7785] mt-0.5">
                  {f.category} · {formatFileSize(f.fileSize)} · Uploaded by {f.uploaderName}
                  {f.storagePath ? ` · ${f.storagePath}` : ''}
                </p>
                {f.description && <p className="text-[#6E7785] mt-1">{f.description}</p>}
              </div>
              <div className="flex items-center gap-3">
                {(f.downloadUrl || f.storagePath) && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewItem({
                          id: f.id,
                          title: `${f.fileName} (${f.versionLabel})`,
                          url: f.downloadUrl,
                          mimeType: f.fileType,
                          fileSize: f.fileSize,
                          storageBucket: f.storageBucket || 'private-project-files',
                          storagePath: f.storagePath,
                          description: f.description,
                          tags: f.tags,
                          categoryLabel: `${f.category} · ${f.versionLabel}`,
                          createdAt: f.createdAt,
                          uploaderName: f.uploaderName,
                        })
                      }
                      className="inline-flex items-center gap-1 font-semibold text-[#172333] hover:text-[#F18A45]"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSecureDownload(f)}
                      className="font-semibold text-[#172333] hover:text-[#F18A45]"
                    >
                      Download
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() =>
                    confirmAction({
                      title: 'Delete Deliverable File',
                      message: `Permanently delete "${f.fileName}" from Supabase Storage and project records?`,
                      onConfirm: async () => {
                        await deleteFileAdmin(f);
                        await loadData();
                        showToast('success', 'Deliverable Deleted');
                      },
                    })
                  }
                  className="text-[#B93832] hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <MediaPreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
    </div>
  );
};

// ============================================================================
// 6. ADMIN REPORTS & ANALYTICS PAGE
// ============================================================================
export const AdminReportsPage: React.FC = () => {
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    Promise.all([
      fetchAllInquiriesAdmin(),
      fetchAllProjectsAdmin(),
      fetchAllInvoicesAdmin(),
      fetchAllPaymentsAdmin(),
      fetchActivityLogs(),
    ])
      .then(([inq, proj, inv, pay, act]) => {
        setInquiries(inq);
        setProjects(proj);
        setInvoices(inv);
        setPayments(pay);
        setLogs(act);
      })
      .catch(() => {});
  }, []);

  const totalInvoiced = invoices
    .filter((i) => i.status !== 'Cancelled' && i.status !== 'Draft')
    .reduce((sum, i) => sum + (Number(i.total) || 0), 0);
  const totalRevenueReceived = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const outstandingBalance = invoices
    .filter((i) => ['Sent', 'Partially Paid', 'Overdue'].includes(i.status))
    .reduce((sum, i) => sum + (Number(i.balanceDue) || 0), 0);
  const overdueBalance = invoices
    .filter((i) => i.status === 'Overdue')
    .reduce((sum, i) => sum + (Number(i.balanceDue) || 0), 0);

  const convertedInquiries = inquiries.filter((i) => i.status === 'Converted').length;
  const conversionRate =
    inquiries.length > 0 ? Math.round((convertedInquiries / inquiries.length) * 100) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-editorial text-2xl font-semibold text-[#172333]">
          Reports, Financial Separation & Audit Logs
        </h1>
        <p className="text-xs text-[#6E7785] mt-1">
          Clearly separates Total Invoiced amounts from Actual Revenue Received (recorded payments).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2E4DF] rounded-lg p-5">
          <p className="text-xs text-[#6E7785]">Total Invoiced (Billed)</p>
          <p className="text-2xl font-mono font-semibold text-[#172333] mt-1 tabular-nums">
            {formatINR(totalInvoiced)}
          </p>
          <p className="text-[11px] text-[#6E7785] mt-1">Excludes drafts & cancelled</p>
        </div>

        <div className="bg-white border border-[#E2E4DF] rounded-lg p-5">
          <p className="text-xs text-[#6E7785]">Actual Revenue Received</p>
          <p className="text-2xl font-mono font-semibold text-[#26734D] mt-1 tabular-nums">
            {formatINR(totalRevenueReceived)}
          </p>
          <p className="text-[11px] text-[#6E7785] mt-1">Based strictly on recorded payments</p>
        </div>

        <div className="bg-white border border-[#E2E4DF] rounded-lg p-5">
          <p className="text-xs text-[#6E7785]">Outstanding Balance</p>
          <p className="text-2xl font-mono font-semibold text-[#A96518] mt-1 tabular-nums">
            {formatINR(outstandingBalance)}
          </p>
          <p className="text-[11px] text-[#6E7785] mt-1">Awaiting client settlement</p>
        </div>

        <div className="bg-white border border-[#E2E4DF] rounded-lg p-5">
          <p className="text-xs text-[#6E7785]">Overdue Balance</p>
          <p className="text-2xl font-mono font-semibold text-[#B93832] mt-1 tabular-nums">
            {formatINR(overdueBalance)}
          </p>
          <p className="text-[11px] text-[#6E7785] mt-1">Lead Conversion Rate: {conversionRate}%</p>
        </div>
      </div>

      {/* Audit Activity Trail */}
      <div className="bg-white border border-[#E2E4DF] rounded-lg p-6">
        <h2 className="text-base font-semibold text-[#172333] mb-4">
          Administrative Audit Trail (/activityLogs)
        </h2>
        {logs.length === 0 ? (
          <p className="text-xs text-[#6E7785]">No administrative actions logged yet.</p>
        ) : (
          <div className="divide-y divide-[#E2E4DF] max-h-96 overflow-y-auto text-xs">
            {logs.slice(0, 25).map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between gap-4">
                <div>
                  <span className="font-semibold text-[#172333]">{log.action}</span>
                  <span className="text-[#6E7785]"> · {log.details}</span>
                </div>
                <span className="font-mono text-[11px] text-[#6E7785] shrink-0">
                  {formatDate(log.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 7. ADMIN STUDIO SETTINGS, NOTIFICATIONS & PROFILE PAGES
// ============================================================================
export const AdminSettingsPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [pub, setPub] = useState<PublicSettings>(DEFAULT_PUBLIC_SETTINGS);
  const [priv, setPriv] = useState<PrivateSettings>(DEFAULT_PRIVATE_SETTINGS);

  useEffect(() => {
    fetchPublicSettings().then(setPub).catch(() => {});
    fetchPrivateSettings().then(setPriv).catch(() => {});
  }, []);

  const privateAdminLoginUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${
          window.location.pathname.startsWith('/prithvi-editify') ? '/prithvi-editify' : ''
        }/admin-login`
      : '/admin-login';

  const handleCopyAdminLink = async () => {
    try {
      await navigator.clipboard.writeText(privateAdminLoginUrl);
      showToast('success', 'Private Admin Link Copied', privateAdminLoginUrl);
    } catch {
      showToast('success', 'Private Admin Link', privateAdminLoginUrl);
    }
  };

  const handleSavePublic = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await savePublicSettings(pub);
      showToast('success', 'Public Studio Settings Saved');
    } catch (err) {
      showToast('error', 'Failed to save public settings', err instanceof Error ? err.message : '');
    }
  };

  const handleSavePrivate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await savePrivateSettings(priv);
      showToast('success', 'Private Billing Settings Saved');
    } catch (err) {
      showToast('error', 'Failed to save private settings', err instanceof Error ? err.message : '');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-editorial text-2xl font-semibold text-[#172333]">Studio Settings</h1>
        <p className="text-xs text-[#6E7785] mt-1">
          Public contact settings (/settings/public) are separated from private billing settings (/settings/private).
        </p>
      </div>

      {/* Complete A-to-Z Website Customizer Callout */}
      <div className="bg-white border-2 border-[#F18A45] rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="inline-block px-2.5 py-0.5 rounded bg-[#F18A45]/15 text-[#B85D1D] text-[10px] font-semibold uppercase tracking-wider">
            Full Site Builder & Visual Editor
          </span>
          <h2 className="font-editorial text-lg font-semibold text-[#172333]">
            Complete A-to-Z Website Customizer Studio
          </h2>
          <p className="text-xs text-[#6E7785] max-w-xl">
            Customize your logo, brand colors, announcement bar, header navigation, hero artwork, homepage sections, 4-step workflow, founder story, contact form budget ranges, SEO metadata, and legal policies.
          </p>
        </div>
        <Link
          to="/admin/website-customizer"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-[#172333] bg-[#F18A45] hover:bg-[#e07934] rounded-lg transition-colors shrink-0"
        >
          <span>Open A–Z Website Customizer</span>
        </Link>
      </div>

      {/* Private Studio Owner Security & Unlisted Admin Login Link */}
      <div className="bg-[#172333] text-[#F5F5F1] border border-[#24364A] rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#F18A45]" />
            <h2 className="text-sm font-semibold text-white">
              Private Role Security & Studio Owner Login Link (Hidden from Public)
            </h2>
          </div>
          <span className="px-2.5 py-0.5 rounded bg-[#26734D] text-[11px] font-mono text-white">
            RLS ENFORCED · OWNER VERIFIED
          </span>
        </div>
        <div className="text-xs text-[#9BA3B0] space-y-1.5 leading-relaxed">
          <p>
            <strong className="text-white">Role Security:</strong> All self-registered accounts on the public portal receive the{' '}
            <code className="font-mono text-[#F18A45]">client</code> role enforced by Supabase Row Level Security (RLS).
          </p>
          <p>
            Studio Administrator access is strictly restricted to verified studio owner{' '}
            <code className="font-mono text-white">{user?.email}</code> and is completely hidden from all public pages.
          </p>
        </div>
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <input
            type="text"
            readOnly
            value={privateAdminLoginUrl}
            className="flex-1 px-3 py-2 text-xs font-mono bg-[#24364A] text-white border border-[#354B63] rounded-lg select-all"
          />
          <button
            type="button"
            onClick={handleCopyAdminLink}
            className="px-4 py-2 text-xs font-semibold text-[#172333] bg-[#F18A45] hover:bg-[#e07934] rounded-lg transition-colors shrink-0"
          >
            Copy Private Admin Login Link
          </button>
        </div>
      </div>

      <form onSubmit={handleSavePublic} className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-4">
        <h2 className="text-base font-semibold text-[#172333]">Public Identity & WhatsApp Configuration</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Business Name</label>
            <input
              type="text"
              value={pub.businessName}
              onChange={(e) => setPub({ ...pub, businessName: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Business Owner</label>
            <input
              type="text"
              value={pub.ownerName}
              onChange={(e) => setPub({ ...pub, ownerName: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Public Contact Email</label>
            <input
              type="email"
              value={pub.businessEmail}
              onChange={(e) => setPub({ ...pub, businessEmail: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              WhatsApp Number (International format, e.g. 919876543210)
            </label>
            <input
              type="text"
              value={pub.whatsappNumber}
              onChange={(e) => setPub({ ...pub, whatsappNumber: e.target.value })}
              placeholder="91..."
              className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Default WhatsApp Prefilled Message</label>
          <input
            type="text"
            value={pub.whatsappDefaultMessage}
            onChange={(e) => setPub({ ...pub, whatsappDefaultMessage: e.target.value })}
            className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={pub.portfolioVisible}
            onChange={(e) => setPub({ ...pub, portfolioVisible: e.target.checked })}
          />
          <span>Display Portfolio Section on Public Website</span>
        </label>
        <div>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg"
          >
            Save Public Settings
          </button>
        </div>
      </form>

      <form onSubmit={handleSavePrivate} className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-4">
        <h2 className="text-base font-semibold text-[#172333]">Private Invoicing & Tax Settings (Admin Only)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Invoice Number Prefix</label>
            <input
              type="text"
              value={priv.invoicePrefix}
              onChange={(e) => setPriv({ ...priv, invoicePrefix: e.target.value })}
              className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Default Tax Rate (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={priv.defaultTaxRate}
              onChange={(e) => setPriv({ ...priv, defaultTaxRate: Number(e.target.value) })}
              className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Default Payment Instructions (UPI / Bank Info)</label>
          <textarea
            rows={3}
            value={priv.defaultPaymentInstructions}
            onChange={(e) => setPriv({ ...priv, defaultPaymentInstructions: e.target.value })}
            className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg"
        >
          Save Private Settings
        </button>
      </form>
    </div>
  );
};

export const SharedNotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<
    { id: string; title: string; message: string; type: string; read: boolean }[]
  >([]);

  useEffect(() => {
    if (!user) return;
    fetchUserNotifications(user.uid)
      .then((notifs) => {
        setItems(notifs);
      })
      .catch(() => {});
  }, [user]);

  return (
    <div className="space-y-6">
      <h1 className="font-editorial text-2xl font-semibold text-[#172333]">Notifications</h1>
      <div className="bg-white border border-[#E2E4DF] rounded-lg divide-y divide-[#E2E4DF]">
        {items.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#6E7785]">
            No notifications right now. Project updates, deliverables, and invoice alerts appear here.
          </div>
        ) : (
          items.map((n) => (
            <div key={n.id} className="p-4 flex items-center justify-between gap-4 text-xs">
              <div>
                <p className="font-semibold text-[#172333]">{n.title}</p>
                <p className="text-[#6E7785] mt-0.5">{n.message}</p>
              </div>
              {!n.read && (
                <button
                  type="button"
                  onClick={async () => {
                    await markNotificationRead(n.id);
                    setItems((prev) =>
                      prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
                    );
                  }}
                  className="font-semibold text-[#F18A45]"
                >
                  Mark Read
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const SharedProfilePage: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [companyName, setCompanyName] = useState(profile?.companyName || '');

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setPhone(profile.phone);
      setCompanyName(profile.companyName);
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await updateUserProfileDetails(user.uid, {
        displayName,
        phone,
        companyName,
      });
      await refreshProfile();
      showToast('success', 'Account Profile Updated');
    } catch (err) {
      showToast('error', 'Update Failed', err instanceof Error ? err.message : '');
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="font-editorial text-2xl font-semibold text-[#172333]">
          Profile & Account Security
        </h1>
        <p className="text-xs text-[#6E7785] mt-1">
          Your Supabase User UUID allows the studio to link your projects, deliverables, and invoices securely.
        </p>
      </div>

      <div className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-4 text-xs">
        <div>
          <span className="text-[#6E7785]">Authenticated User UID:</span>
          <p className="font-mono font-semibold text-[#172333] mt-0.5 select-all">{user?.uid}</p>
        </div>
        <div>
          <span className="text-[#6E7785]">Email & Role:</span>
          <p className="font-semibold text-[#172333] mt-0.5">
            {profile?.email} · Role: <span className="font-mono uppercase">{profile?.role}</span>
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4 pt-4 border-t border-[#E2E4DF]">
          <div>
            <label className="block font-medium mb-1">Display Name</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Phone / WhatsApp</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Company / Brand Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-3 py-2 bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg"
          >
            Save Profile
          </button>
        </form>
      </div>
    </div>
  );
};
