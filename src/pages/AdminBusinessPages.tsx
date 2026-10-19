import React, { useEffect, useState, useCallback } from 'react';
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
} from 'lucide-react';
import {
  fetchAllServicesAdmin,
  saveServiceItem,
  deleteServiceItem,
  fetchAllPortfolioAdmin,
  savePortfolioItem,
  deletePortfolioItem,
  fetchAllClientsAdmin,
  fetchAllProjectsAdmin,
  fetchAllInvoicesAdmin,
  saveInvoiceWithLineItemsAdmin,
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
import { MediaLibraryManager } from '../components/MediaLibraryManager';
import { MediaPreviewModal, PreviewableMediaItem } from '../components/MediaPreviewModal';
import { MediaSearchFilterState } from '../components/MediaSearchFilterBar';
import {
  ServiceItem,
  PortfolioItem,
  PortfolioCategory,
  ClientRecord,
  ProjectRecord,
  InvoiceRecord,
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

// ============================================================================
// 1. ADMIN SERVICES & PRICING MANAGEMENT PAGE
// ============================================================================
export const AdminServicesPage: React.FC = () => {
  const { showToast, confirmAction } = useToast();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [editing, setEditing] = useState<ServiceItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState<'image' | 'video' | null>(null);
  const [previewMedia, setPreviewMedia] = useState<PreviewableMediaItem | null>(null);

  const [form, setForm] = useState({
    title: '',
    category: 'Graphic Design',
    description: '',
    startingPrice: 500,
    priceDisplay: '₹500/design',
    pricingUnit: 'design',
    isCustomQuote: false,
    deliverablesSummary: 'High-resolution PNG/PDF export, 2 revision rounds.',
    turnaroundTime: '24–48 hours',
    imageUrl: '',
    videoPreviewUrl: '',
    published: true,
    sortOrder: 1,
  });

  const loadServices = useCallback(async () => {
    setServices(await fetchAllServicesAdmin());
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-editorial text-2xl font-semibold text-[#172333]">
            Services & INR Pricing Management
          </h1>
          <p className="text-xs text-[#6E7785] mt-1">
            Add, edit, reorder, or unpublish creative services. Published services appear automatically on the public website.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
              setForm({
                title: '',
                category: 'Graphic Design',
                description: '',
                startingPrice: 500,
                priceDisplay: '₹500/design',
                pricingUnit: 'design',
                isCustomQuote: false,
                deliverablesSummary: 'High-resolution PNG/PDF export, 2 revision rounds.',
                turnaroundTime: '24–48 hours',
                imageUrl: '',
                videoPreviewUrl: '',
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
        <form onSubmit={handleSave} className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-4">
          <h2 className="text-base font-semibold text-[#172333]">
            {editing ? `Edit Service: ${editing.title}` : 'New Studio Service'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Service Title *</label>
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
              <input
                type="text"
                required
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Display Price (e.g. ₹500/design or Custom quote) *
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
              <label className="block text-xs font-medium mb-1">Numeric Starting Price (INR)</label>
              <input
                type="number"
                min={0}
                value={form.startingPrice}
                onChange={(e) => setForm({ ...form, startingPrice: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Turnaround Time</label>
              <input
                type="text"
                value={form.turnaroundTime}
                onChange={(e) => setForm({ ...form, turnaroundTime: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Sort Order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Description *</label>
            <textarea
              rows={2}
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium">Service Cover Image URL (service-media)</label>
                <button
                  type="button"
                  onClick={() => setShowMediaPicker('image')}
                  className="text-[11px] font-semibold text-[#F18A45] hover:underline"
                >
                  + Upload / Pick from Media Library
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
                <label className="text-xs font-medium">Sample Video / Reel Preview URL (Optional)</label>
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
          </div>

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

          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg"
          >
            Save Service
          </button>
        </form>
      )}

      <div className="bg-white border border-[#E2E4DF] rounded-lg overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E2E4DF] text-[11px] font-semibold text-[#6E7785]">
              <th className="py-3 px-4">#</th>
              <th className="py-3 px-4">Service Name</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Display Price</th>
              <th className="py-3 px-4">Visibility</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E4DF] text-xs">
            {services.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[#6E7785]">
                  No services stored in Supabase yet. Click "Seed 10 Starting-Price Services" above.
                </td>
              </tr>
            ) : (
              services.map((srv) => (
                <tr key={srv.id} className="hover:bg-[#F5F5F1]/50">
                  <td className="py-3.5 px-4 font-mono">{srv.sortOrder}</td>
                  <td className="py-3.5 px-4 font-semibold text-[#172333]">{srv.title}</td>
                  <td className="py-3.5 px-4 text-[#6E7785]">{srv.category}</td>
                  <td className="py-3.5 px-4 font-mono font-semibold text-[#172333] tabular-nums">
                    {srv.priceDisplay}
                  </td>
                  <td className="py-3.5 px-4">
                    {srv.published ? 'Published' : 'Unpublished Draft'}
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-3">
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
                          pricingUnit: srv.pricingUnit,
                          isCustomQuote: srv.isCustomQuote,
                          deliverablesSummary: srv.deliverablesSummary,
                          turnaroundTime: srv.turnaroundTime,
                          imageUrl: srv.imageUrl,
                          videoPreviewUrl: srv.videoPreviewUrl || '',
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
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [editing, setEditing] = useState<PortfolioItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState<'cover' | 'video' | null>(null);
  const [previewMedia, setPreviewMedia] = useState<PreviewableMediaItem | null>(null);

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
          <h2 className="text-base font-semibold text-[#172333]">
            {editing ? `Edit Entry: ${editing.title}` : 'Create Portfolio Entry'}
          </h2>
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
// 3. ADMIN INVOICES & PAYMENT RECORDING PAGE
// ============================================================================
export const AdminInvoicesPage: React.FC = () => {
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [payModalInvoice, setPayModalInvoice] = useState<InvoiceRecord | null>(null);
  const [printInvoice, setPrintInvoice] = useState<InvoiceRecord | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const [invForm, setInvForm] = useState({
    invoiceNumber: `PE-INV-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 900))}`,
    clientId: '',
    projectId: '',
    issueDate: today,
    dueDate: today,
    discount: 0,
    taxRate: 0,
    status: 'Sent' as InvoiceStatus,
    paymentInstructions: DEFAULT_PRIVATE_SETTINGS.defaultPaymentInstructions,
    notes: 'Thank you for working with Prithvi Editify.',
    lineItems: [{ description: 'Social Media Post Design', quantity: 2, unitPrice: 500 }],
  });

  const [payForm, setPayForm] = useState({
    amount: 0,
    method: 'UPI' as PaymentRecord['method'],
    transactionReference: '',
    paymentDate: today,
    notes: 'Verified by Admin',
  });

  const loadData = useCallback(async () => {
    const [inv, cli, proj] = await Promise.all([
      fetchAllInvoicesAdmin(),
      fetchAllClientsAdmin(),
      fetchAllProjectsAdmin(),
    ]);
    setInvoices(inv);
    setClients(cli);
    setProjects(proj);
    if (cli.length > 0 && !invForm.clientId) {
      setInvForm((prev) => ({ ...prev, clientId: cli[0].id }));
    }
  }, [invForm.clientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totals = calculateInvoiceTotals({
    items: invForm.lineItems,
    discount: invForm.discount,
    taxRate: invForm.taxRate,
    amountPaid: 0,
  });

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const client = clients.find((c) => c.id === invForm.clientId);
    if (!client) {
      showToast('error', 'Client Required', 'Please create and select a client first.');
      return;
    }
    const proj = projects.find((p) => p.id === invForm.projectId);

    try {
      await saveInvoiceWithLineItemsAdmin(
        {
          invoiceNumber: invForm.invoiceNumber,
          clientId: client.id,
          clientUserId: client.userId || '',
          clientName: client.fullName,
          clientEmail: client.email,
          projectId: proj?.id || '',
          projectTitle: proj?.title || 'General Creative Services',
          issueDate: invForm.issueDate,
          dueDate: invForm.dueDate,
          itemsSummary: invForm.lineItems
            .map((li) => `${li.description} (${li.quantity} × ₹${li.unitPrice})`)
            .join(' · '),
          subtotal: totals.subtotal,
          discount: totals.discount,
          taxRate: invForm.taxRate,
          taxAmount: totals.taxAmount,
          total: totals.total,
          amountPaid: 0,
          balanceDue: totals.balanceDue,
          currency: 'INR',
          status: invForm.status,
          paymentInstructions: invForm.paymentInstructions,
          notes: invForm.notes,
        },
        invForm.lineItems.map((li, idx) => ({
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          amount: Math.round(li.quantity * li.unitPrice),
          sortOrder: idx + 1,
        }))
      );
      showToast('success', 'Invoice Created', `${invForm.invoiceNumber} saved in INR.`);
      setShowBuilder(false);
      await loadData();
    } catch (err) {
      showToast('error', 'Failed to create invoice', err instanceof Error ? err.message : '');
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 no-print">
        <div>
          <h1 className="font-editorial text-2xl font-semibold text-[#172333]">
            Invoices & INR Billing
          </h1>
          <p className="text-xs text-[#6E7785] mt-1">
            Create multi-line-item invoices in INR, export printable PDFs, and record verified payments.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowBuilder(!showBuilder)}
          className="px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg"
        >
          {showBuilder ? 'Close Invoice Builder' : '+ Create Invoice'}
        </button>
      </div>

      {showBuilder && (
        <form
          onSubmit={handleCreateInvoice}
          className="bg-white border border-[#E2E4DF] rounded-lg p-6 space-y-5 no-print"
        >
          <h2 className="text-base font-semibold text-[#172333]">New INR Invoice</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Invoice Number *</label>
              <input
                type="text"
                required
                value={invForm.invoiceNumber}
                onChange={(e) => setInvForm({ ...invForm, invoiceNumber: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Client *</label>
              <select
                required
                value={invForm.clientId}
                onChange={(e) => setInvForm({ ...invForm, clientId: e.target.value })}
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
              <label className="block text-xs font-medium mb-1">Issue Date</label>
              <input
                type="date"
                value={invForm.issueDate}
                onChange={(e) => setInvForm({ ...invForm, issueDate: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Due Date</label>
              <input
                type="date"
                value={invForm.dueDate}
                onChange={(e) => setInvForm({ ...invForm, dueDate: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#172333]">Line Items</span>
              <button
                type="button"
                onClick={() =>
                  setInvForm({
                    ...invForm,
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
            {invForm.lineItems.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  required
                  value={item.description}
                  onChange={(e) => {
                    const next = [...invForm.lineItems];
                    next[idx].description = e.target.value;
                    setInvForm({ ...invForm, lineItems: next });
                  }}
                  placeholder="Description"
                  className="col-span-6 px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                />
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => {
                    const next = [...invForm.lineItems];
                    next[idx].quantity = Number(e.target.value);
                    setInvForm({ ...invForm, lineItems: next });
                  }}
                  className="col-span-2 px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                />
                <input
                  type="number"
                  min={0}
                  value={item.unitPrice}
                  onChange={(e) => {
                    const next = [...invForm.lineItems];
                    next[idx].unitPrice = Number(e.target.value);
                    setInvForm({ ...invForm, lineItems: next });
                  }}
                  className="col-span-3 px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                />
                <button
                  type="button"
                  disabled={invForm.lineItems.length <= 1}
                  onClick={() =>
                    setInvForm({
                      ...invForm,
                      lineItems: invForm.lineItems.filter((_, i) => i !== idx),
                    })
                  }
                  className="col-span-1 text-xs text-[#B93832] disabled:opacity-30"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[#E2E4DF]">
            <div>
              <label className="block text-xs font-medium mb-1">Discount (INR)</label>
              <input
                type="number"
                min={0}
                value={invForm.discount}
                onChange={(e) => setInvForm({ ...invForm, discount: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Tax Rate (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={invForm.taxRate}
                onChange={(e) => setInvForm({ ...invForm, taxRate: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <div className="bg-[#F5F5F1] rounded-lg p-3 text-right">
              <p className="text-xs text-[#6E7785]">Calculated Invoice Total</p>
              <p className="text-xl font-mono font-semibold text-[#172333] tabular-nums">
                {formatINR(totals.total)}
              </p>
            </div>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg"
          >
            Issue Invoice
          </button>
        </form>
      )}

      {/* Printable Invoice Preview */}
      {printInvoice && (
        <div className="bg-white border border-[#172333] rounded-lg p-8 space-y-6">
          <div className="flex items-start justify-between border-b border-[#E2E4DF] pb-6">
            <div>
              <h2 className="font-editorial text-2xl font-semibold text-[#172333]">
                Prithvi Editify
              </h2>
              <p className="text-xs text-[#6E7785]">Shankar Baluragi · Creative Design & Video Studio</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-lg font-semibold text-[#172333]">
                {printInvoice.invoiceNumber}
              </p>
              <p className="text-xs text-[#6E7785]">
                Issued: {printInvoice.issueDate} · Due: {printInvoice.dueDate}
              </p>
              <p className="text-xs font-semibold text-[#172333] mt-1">
                Status: {printInvoice.status}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 text-xs">
            <div>
              <p className="font-semibold text-[#6E7785]">Billed To:</p>
              <p className="text-sm font-semibold text-[#172333] mt-0.5">{printInvoice.clientName}</p>
              <p className="text-[#6E7785]">{printInvoice.clientEmail}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-[#6E7785]">Project Scope:</p>
              <p className="text-[#172333] mt-0.5">{printInvoice.projectTitle}</p>
            </div>
          </div>

          <div className="p-4 bg-[#F5F5F1] rounded-lg text-xs">
            <p className="font-semibold text-[#172333] mb-1">Line Items Summary:</p>
            <p className="text-[#6E7785]">{printInvoice.itemsSummary}</p>
          </div>

          <div className="flex justify-end">
            <div className="w-64 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#6E7785]">Subtotal:</span>
                <span className="font-mono tabular-nums">{formatINR(printInvoice.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6E7785]">Discount:</span>
                <span className="font-mono tabular-nums">-{formatINR(printInvoice.discount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6E7785]">Tax ({printInvoice.taxRate}%):</span>
                <span className="font-mono tabular-nums">{formatINR(printInvoice.taxAmount)}</span>
              </div>
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

          <div className="pt-4 border-t border-[#E2E4DF] text-xs text-[#6E7785]">
            <p className="font-semibold text-[#172333]">Payment Instructions:</p>
            <p className="mt-1">{printInvoice.paymentInstructions}</p>
          </div>

          <div className="flex items-center gap-3 no-print">
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
              onClick={() => setPrintInvoice(null)}
              className="px-4 py-2 text-xs font-semibold text-[#172333] bg-[#F5F5F1] rounded-lg"
            >
              Close Printable View
            </button>
          </div>
        </div>
      )}

      {/* Invoices Table */}
      <div className="bg-white border border-[#E2E4DF] rounded-lg overflow-x-auto no-print">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E2E4DF] text-[11px] font-semibold text-[#6E7785]">
              <th className="py-3 px-4">Invoice #</th>
              <th className="py-3 px-4">Client</th>
              <th className="py-3 px-4">Due Date</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Total</th>
              <th className="py-3 px-4 text-right">Balance Due</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E4DF] text-xs">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[#6E7785]">
                  No invoices created yet.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-[#F5F5F1]/50">
                  <td className="py-3.5 px-4 font-mono font-semibold text-[#172333]">
                    {inv.invoiceNumber}
                  </td>
                  <td className="py-3.5 px-4 text-[#6E7785]">{inv.clientName}</td>
                  <td className="py-3.5 px-4 font-mono text-[#6E7785]">{inv.dueDate}</td>
                  <td className="py-3.5 px-4 font-medium text-[#172333]">{inv.status}</td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                    {formatINR(inv.total)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums">
                    {formatINR(inv.balanceDue)}
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-3">
                    <button
                      type="button"
                      onClick={() => setPrintInvoice(inv)}
                      className="font-semibold text-[#172333] hover:text-[#F18A45]"
                    >
                      Print/PDF
                    </button>
                    {inv.balanceDue > 0 && (
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
                        className="font-semibold text-[#26734D] hover:underline"
                      >
                        Record Payment
                      </button>
                    )}
                  </td>
                </tr>
              ))
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
    </div>
  );
};

// ============================================================================
// 4. ADMIN PAYMENTS HISTORY PAGE
// ============================================================================
export const AdminPaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);

  useEffect(() => {
    fetchAllPaymentsAdmin().then(setPayments).catch(() => {});
  }, []);

  const totalReceived = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-editorial text-2xl font-semibold text-[#172333]">
            Recorded Payments Ledger
          </h1>
          <p className="text-xs text-[#6E7785] mt-1">
            All payments clearly distinguish between Admin Recorded manual transfers and Webhook Verified transactions.
          </p>
        </div>
        <div className="bg-white border border-[#E2E4DF] rounded-lg px-4 py-2.5 text-right">
          <p className="text-[11px] text-[#6E7785]">Total Revenue Received</p>
          <p className="font-mono text-lg font-semibold text-[#26734D] tabular-nums">
            {formatINR(totalReceived)}
          </p>
        </div>
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
  const { showToast } = useToast();
  const [pub, setPub] = useState<PublicSettings>(DEFAULT_PUBLIC_SETTINGS);
  const [priv, setPriv] = useState<PrivateSettings>(DEFAULT_PRIVATE_SETTINGS);

  useEffect(() => {
    fetchPublicSettings().then(setPub).catch(() => {});
    fetchPrivateSettings().then(setPriv).catch(() => {});
  }, []);

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
