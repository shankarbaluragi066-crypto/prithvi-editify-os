import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Upload,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  Edit3,
  Eye,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Film,
  FileText,
  FileArchive,
  Lock,
  Globe,
  LayoutGrid,
  List,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  Tag,
} from 'lucide-react';
import {
  MediaAsset,
  MediaBucket,
  MediaCategory,
  ServiceItem,
  PortfolioItem,
  ProjectRecord,
} from '../types/crm';
import {
  fetchMediaAssetsAdmin,
  uploadMediaAssetAdmin,
  updateMediaAssetAdmin,
  deleteMediaAssetAdmin,
  resolveStoragePreviewUrl,
  fetchAllServicesAdmin,
  fetchAllPortfolioAdmin,
  fetchAllProjectsAdmin,
} from '../services/crmService';
import {
  STORAGE_BUCKET_CONFIGS,
  validateMediaFile,
  detectMediaCategory,
  getFileExtension,
} from '../utils/mediaValidation';
import { formatFileSize, formatDate } from '../utils/formatters';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { MediaPreviewModal, PreviewableMediaItem } from './MediaPreviewModal';
import {
  MediaSearchFilterBar,
  MediaSearchFilterState,
} from './MediaSearchFilterBar';

interface UploadQueueItem {
  queueId: string;
  file: File;
  targetBucket: 'portfolio-media' | 'service-media' | 'private-project-files';
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  errorMessage?: string;
  uploadedAsset?: MediaAsset;
}

interface MediaLibraryManagerProps {
  mode?: 'full' | 'picker';
  defaultBucket?: 'portfolio-media' | 'service-media' | 'private-project-files';
  allowedCategories?: MediaCategory[];
  onSelectAsset?: (asset: MediaAsset) => void;
  onClosePicker?: () => void;
  externalFilters?: MediaSearchFilterState;
  onExternalFiltersChange?: (next: MediaSearchFilterState) => void;
}

const DEFAULT_STUDIO_TAGS = [
  'thumbnail',
  'youtube',
  'reel',
  '4k',
  'branding',
  'master',
  'preview',
];

export const MediaLibraryManager: React.FC<MediaLibraryManagerProps> = ({
  mode = 'full',
  defaultBucket = 'portfolio-media',
  allowedCategories,
  onSelectAsset,
  onClosePicker,
  externalFilters,
  onExternalFiltersChange,
}) => {
  const { showToast, confirmAction } = useToast();
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Upload Zone State
  const [selectedBucket, setSelectedBucket] = useState<
    'portfolio-media' | 'service-media' | 'private-project-files'
  >(defaultBucket);
  const [defaultTagsInput, setDefaultTagsInput] = useState<string>('');
  const [defaultDescription, setDefaultDescription] = useState<string>('');
  const [linkedProjectId, setLinkedProjectId] = useState<string>('');
  const [linkedServiceId, setLinkedServiceId] = useState<string>('');
  const [linkedPortfolioId, setLinkedPortfolioId] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);

  // Filter, Search, Sort & Pagination State
  const [internalFilters, setInternalFilters] = useState<MediaSearchFilterState>({
    searchQuery: '',
    mimeType: 'all',
    tag: '',
    projectId: 'all',
    bucket: mode === 'picker' ? defaultBucket : 'all',
    sortBy: 'newest',
  });

  const activeFilters = externalFilters || internalFilters;
  const setActiveFilters = useCallback(
    (next: MediaSearchFilterState) => {
      if (onExternalFiltersChange) {
        onExternalFiltersChange(next);
      } else {
        setInternalFilters(next);
      }
    },
    [onExternalFiltersChange]
  );

  const [knownTags, setKnownTags] = useState<string[]>(DEFAULT_STUDIO_TAGS);
  const [isFiltering, setIsFiltering] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = mode === 'picker' ? 9 : 12;

  // Preview & Edit Metadata Modals
  const [previewItem, setPreviewItem] = useState<PreviewableMediaItem | null>(null);
  const [editingAsset, setEditingAsset] = useState<MediaAsset | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    tagsText: '',
    isPublic: true,
    serviceId: '',
    portfolioId: '',
    projectId: '',
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load reference entities (Services, Portfolio, Projects)
  const loadReferenceEntities = useCallback(async () => {
    try {
      const [srvList, portList, projList] = await Promise.all([
        fetchAllServicesAdmin(),
        fetchAllPortfolioAdmin(),
        fetchAllProjectsAdmin(),
      ]);
      setServices(srvList);
      setPortfolioItems(portList);
      setProjects(projList);
    } catch {
      // Non-blocking reference fetch
    }
  }, []);

  // Load media assets using Supabase server-side filters
  const loadLibrary = useCallback(
    async (filterOverride?: MediaSearchFilterState) => {
      const f = filterOverride || activeFilters;
      setIsFiltering(true);
      try {
        const mediaList = await fetchMediaAssetsAdmin({
          mimeType: f.mimeType,
          searchQuery: f.searchQuery,
          tag: f.tag,
          projectId: f.projectId,
          bucket: f.bucket,
          sortBy: f.sortBy,
        });
        setAssets(mediaList);
        // Accumulate discovered project/media tags so quick-tag chips stay populated
        setKnownTags((prev) => {
          const merged = new Set<string>(prev);
          for (const item of mediaList) {
            for (const t of item.tags || []) {
              if (t && t.trim()) merged.add(t.trim().toLowerCase());
            }
          }
          return Array.from(merged);
        });
      } catch (err) {
        showToast(
          'error',
          'Failed to load Media Library',
          err instanceof Error ? err.message : ''
        );
      } finally {
        setLoading(false);
        setIsFiltering(false);
      }
    },
    [activeFilters, showToast]
  );

  useEffect(() => {
    loadReferenceEntities();
  }, [loadReferenceEntities]);

  // Debounced Supabase filter execution when searchQuery or filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      loadLibrary(activeFilters);
    }, 200);
    return () => clearTimeout(timer);
  }, [activeFilters, loadLibrary]);

  const runSingleUpload = useCallback(
    async (queueItem: UploadQueueItem) => {
      setUploadQueue((prev) =>
        prev.map((q) =>
          q.queueId === queueItem.queueId
            ? { ...q, status: 'uploading', progress: 10, errorMessage: undefined }
            : q
        )
      );

      const parsedTags = defaultTagsInput
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      const targetProject = projects.find((p) => p.id === linkedProjectId);

      try {
        const uploaded = await uploadMediaAssetAdmin({
          file: queueItem.file,
          targetBucket: queueItem.targetBucket,
          description: defaultDescription,
          tags: parsedTags,
          isPublic: queueItem.targetBucket !== 'private-project-files',
          serviceId: linkedServiceId || undefined,
          portfolioId: linkedPortfolioId || undefined,
          projectId: linkedProjectId || undefined,
          clientId: targetProject?.clientId || undefined,
          clientUserId: targetProject?.clientUserId || undefined,
          uploaderName: profile?.displayName || 'Shankar Baluragi',
          onProgress: (pct) => {
            setUploadQueue((prev) =>
              prev.map((q) =>
                q.queueId === queueItem.queueId ? { ...q, progress: pct } : q
              )
            );
          },
        });

        setUploadQueue((prev) =>
          prev.map((q) =>
            q.queueId === queueItem.queueId
              ? { ...q, status: 'success', progress: 100, uploadedAsset: uploaded }
              : q
          )
        );
        setAssets((prev) => [uploaded, ...prev]);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setUploadQueue((prev) =>
          prev.map((q) =>
            q.queueId === queueItem.queueId
              ? { ...q, status: 'error', progress: 0, errorMessage: message }
              : q
          )
        );
      }
    },
    [
      defaultTagsInput,
      defaultDescription,
      linkedProjectId,
      linkedServiceId,
      linkedPortfolioId,
      projects,
      profile?.displayName,
    ]
  );

  const enqueueFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const incoming = Array.from(fileList);
      if (incoming.length === 0) return;

      const newItems: UploadQueueItem[] = [];

      for (const file of incoming) {
        // Duplicate check against existing assets in same bucket or active queue
        const isDuplicateInAssets = assets.some(
          (a) =>
            a.originalFilename.toLowerCase() === file.name.toLowerCase() &&
            a.fileSize === file.size &&
            a.storageBucket === selectedBucket
        );
        const isDuplicateInQueue = uploadQueue.some(
          (q) =>
            q.file.name.toLowerCase() === file.name.toLowerCase() &&
            q.file.size === file.size &&
            q.targetBucket === selectedBucket &&
            (q.status === 'uploading' || q.status === 'pending')
        );

        if (isDuplicateInQueue) {
          showToast(
            'warning',
            'Duplicate Upload Skipped',
            `"${file.name}" is already being uploaded to ${selectedBucket}.`
          );
          continue;
        }

        const validation = validateMediaFile(file, selectedBucket);
        const queueId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        if (!validation.valid) {
          newItems.push({
            queueId,
            file,
            targetBucket: selectedBucket,
            status: 'error',
            progress: 0,
            errorMessage: validation.error,
          });
          continue;
        }

        if (isDuplicateInAssets) {
          showToast(
            'warning',
            'Duplicate File Notice',
            `"${file.name}" already exists in ${selectedBucket}; uploading with a unique timestamped path.`
          );
        }

        newItems.push({
          queueId,
          file,
          targetBucket: selectedBucket,
          status: 'pending',
          progress: 0,
        });
      }

      if (newItems.length === 0) return;
      setUploadQueue((prev) => [...newItems, ...prev]);

      // Upload valid pending items concurrently
      const pendingToRun = newItems.filter((item) => item.status === 'pending');
      await Promise.all(pendingToRun.map((item) => runSingleUpload(item)));
    },
    [assets, uploadQueue, selectedBucket, showToast, runSingleUpload]
  );

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await enqueueFiles(e.dataTransfer.files);
    }
  };

  const handleRetryFailed = async (item: UploadQueueItem) => {
    const check = validateMediaFile(item.file, item.targetBucket);
    if (!check.valid) {
      showToast('error', 'Cannot Retry Invalid File', check.error || '');
      return;
    }
    await runSingleUpload(item);
  };

  const handleRetryAllFailed = async () => {
    const failed = uploadQueue.filter((q) => q.status === 'error');
    for (const item of failed) {
      const check = validateMediaFile(item.file, item.targetBucket);
      if (check.valid) {
        await runSingleUpload(item);
      }
    }
  };

  // Filtered & Sorted Assets (combines Supabase server-side filtered results with any picker constraints)
  const filteredAssets = useMemo(() => {
    return assets
      .filter((asset) => {
        if (allowedCategories && allowedCategories.length > 0) {
          if (!allowedCategories.includes(asset.mediaCategory)) return false;
        }
        if (activeFilters.mimeType !== 'all') {
          if (activeFilters.mimeType.includes('/')) {
            if (asset.mimeType.toLowerCase() !== activeFilters.mimeType.toLowerCase()) {
              return false;
            }
          } else if (asset.mediaCategory !== activeFilters.mimeType) {
            return false;
          }
        }
        if (activeFilters.bucket !== 'all' && asset.storageBucket !== activeFilters.bucket) {
          return false;
        }
        if (
          activeFilters.projectId &&
          activeFilters.projectId !== 'all' &&
          asset.projectId !== activeFilters.projectId
        ) {
          return false;
        }
        if (activeFilters.tag.trim()) {
          const targetTag = activeFilters.tag.trim().replace(/^#/, '').toLowerCase();
          if (!asset.tags.some((t) => t.toLowerCase() === targetTag)) return false;
        }
        if (activeFilters.searchQuery.trim()) {
          const q = activeFilters.searchQuery.trim().replace(/^#/, '').toLowerCase();
          const matchTitle = asset.title.toLowerCase().includes(q);
          const matchFile = asset.originalFilename.toLowerCase().includes(q);
          const matchDesc = asset.description.toLowerCase().includes(q);
          const matchTags = asset.tags.some((t) => t.toLowerCase().includes(q));
          const matchPath = asset.storagePath.toLowerCase().includes(q);
          return matchTitle || matchFile || matchDesc || matchTags || matchPath;
        }
        return true;
      })
      .sort((a, b) => {
        if (activeFilters.sortBy === 'newest') {
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        }
        if (activeFilters.sortBy === 'oldest') {
          return (a.createdAt || '').localeCompare(b.createdAt || '');
        }
        if (activeFilters.sortBy === 'name_asc') {
          return a.title.localeCompare(b.title);
        }
        if (activeFilters.sortBy === 'size_desc') {
          return (b.fileSize || 0) - (a.fileSize || 0);
        }
        if (activeFilters.sortBy === 'size_asc') {
          return (a.fileSize || 0) - (b.fileSize || 0);
        }
        return 0;
      });
  }, [assets, allowedCategories, activeFilters]);

  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / pageSize));
  const paginatedAssets = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * pageSize;
    return filteredAssets.slice(start, start + pageSize);
  }, [filteredAssets, currentPage, totalPages, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilters]);

  const handleResetFilters = useCallback(() => {
    setActiveFilters({
      searchQuery: '',
      mimeType: 'all',
      tag: '',
      projectId: 'all',
      bucket: mode === 'picker' ? defaultBucket : 'all',
      sortBy: 'newest',
    });
  }, [setActiveFilters, mode, defaultBucket]);

  const toPreviewableItem = (asset: MediaAsset): PreviewableMediaItem => ({
    id: asset.id,
    title: asset.title,
    url: asset.publicUrl,
    mimeType: asset.mimeType,
    fileSize: asset.fileSize,
    storageBucket: asset.storageBucket,
    storagePath: asset.storagePath,
    description: asset.description,
    tags: asset.tags,
    categoryLabel: `${asset.mediaCategory.toUpperCase()} · ${asset.storageBucket}`,
    width: asset.width,
    height: asset.height,
    durationSeconds: asset.durationSeconds,
    isPublic: asset.isPublic,
    createdAt: asset.createdAt,
    uploaderName: asset.uploaderName,
    actionButton:
      mode === 'picker' && onSelectAsset
        ? {
            label: 'Use Selected Media',
            onClick: () => {
              onSelectAsset(asset);
              setPreviewItem(null);
            },
          }
        : undefined,
  });

  const previewGalleryItems = useMemo(
    () => filteredAssets.map(toPreviewableItem),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredAssets, mode]
  );

  const handleCopyUrl = async (asset: MediaAsset) => {
    try {
      const url = await resolveStoragePreviewUrl({
        storageBucket: asset.storageBucket,
        storagePath: asset.storagePath,
        fallbackUrl: asset.publicUrl,
        expiresInSeconds: 3600,
      });
      await navigator.clipboard.writeText(url);
      setCopiedId(asset.id);
      showToast(
        'success',
        asset.storageBucket === 'private-project-files'
          ? 'Copied 1-Hour Signed URL'
          : 'Copied Public Storage URL'
      );
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      showToast('error', 'Failed to copy URL');
    }
  };

  const openEditModal = (asset: MediaAsset) => {
    setEditingAsset(asset);
    setEditForm({
      title: asset.title,
      description: asset.description,
      tagsText: asset.tags.join(', '),
      isPublic: asset.isPublic,
      serviceId: asset.serviceId || '',
      portfolioId: asset.portfolioId || '',
      projectId: asset.projectId || '',
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;
    try {
      const tags = editForm.tagsText
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      const linkedProj = projects.find((p) => p.id === editForm.projectId);

      await updateMediaAssetAdmin(editingAsset.id, {
        title: editForm.title,
        description: editForm.description,
        tags,
        isPublic:
          editingAsset.storageBucket === 'private-project-files' ? false : editForm.isPublic,
        serviceId: editForm.serviceId || undefined,
        portfolioId: editForm.portfolioId || undefined,
        projectId: editForm.projectId || undefined,
        clientId: linkedProj?.clientId || editingAsset.clientId,
        clientUserId: linkedProj?.clientUserId || editingAsset.clientUserId,
      });

      showToast('success', 'Media Metadata Updated');
      setEditingAsset(null);
      await loadLibrary();
    } catch (err) {
      showToast('error', 'Update Failed', err instanceof Error ? err.message : '');
    }
  };

  const handleDeleteAsset = (asset: MediaAsset) => {
    confirmAction({
      title: 'Delete Media Asset Permanently',
      message: `Remove "${asset.title}" (${asset.originalFilename}) from Supabase Storage bucket "${asset.storageBucket}" and delete its metadata record?`,
      confirmLabel: 'Delete Asset',
      onConfirm: async () => {
        try {
          await deleteMediaAssetAdmin(asset);
          setAssets((prev) => prev.filter((a) => a.id !== asset.id));
          showToast('success', 'Media Asset Deleted');
        } catch (err) {
          showToast('error', 'Failed to delete asset', err instanceof Error ? err.message : '');
        }
      },
    });
  };

  const totalStorageUsed = useMemo(
    () => assets.reduce((sum, a) => sum + (Number(a.fileSize) || 0), 0),
    [assets]
  );

  const activeBucketConfig = STORAGE_BUCKET_CONFIGS[selectedBucket];

  return (
    <div className="space-y-6">
      {/* Header */}
      {mode === 'full' ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-editorial text-2xl font-semibold text-[#172333]">
              Studio Media Library & Supabase Storage
            </h1>
            <p className="text-xs text-[#6E7785] mt-1">
              Upload, organize, tag, and preview images, videos, PDFs, and private client deliverables across isolated Supabase Storage buckets.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white border border-[#E2E4DF] rounded-lg px-3.5 py-2 text-right">
              <span className="block text-[10px] text-[#6E7785] uppercase tracking-wider">
                Total Tracked Storage
              </span>
              <span className="font-mono text-xs font-semibold text-[#172333]">
                {assets.length} files · {formatFileSize(totalStorageUsed)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => loadLibrary(activeFilters)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#172333] bg-white border border-[#E2E4DF] hover:bg-[#F5F5F1] rounded-lg"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFiltering ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between border-b border-[#E2E4DF] pb-3">
          <div>
            <h2 className="font-editorial text-lg font-semibold text-[#172333]">
              Select or Upload Studio Media
            </h2>
            <p className="text-xs text-[#6E7785]">
              Upload a new file to <code className="font-mono">{selectedBucket}</code> or pick an existing asset below.
            </p>
          </div>
          {onClosePicker && (
            <button
              type="button"
              onClick={onClosePicker}
              className="p-1.5 text-[#6E7785] hover:text-[#172333] rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* Multi-File Upload & Bucket Configuration Card */}
      <div className="bg-white border border-[#E2E4DF] rounded-lg p-5 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Bucket Selector & Optional Metadata */}
          <div className="lg:col-span-5 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#172333] mb-1">
                1. Target Supabase Storage Bucket
              </label>
              <select
                value={selectedBucket}
                onChange={(e) =>
                  setSelectedBucket(
                    e.target.value as 'portfolio-media' | 'service-media' | 'private-project-files'
                  )
                }
                className="w-full px-3 py-2 text-xs font-medium bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              >
                <option value="portfolio-media">portfolio-media (Public Portfolio Assets)</option>
                <option value="service-media">service-media (Public Service Examples)</option>
                <option value="private-project-files">
                  private-project-files (Private Client Deliverables)
                </option>
              </select>
              <p className="text-[11px] text-[#6E7785] mt-1 leading-relaxed">
                {activeBucketConfig.description}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#172333] mb-1">
                  Batch Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={defaultTagsInput}
                  onChange={(e) => setDefaultTagsInput(e.target.value)}
                  placeholder="thumbnail, youtube, 4k"
                  className="w-full px-3 py-1.5 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                />
              </div>

              {selectedBucket === 'private-project-files' && (
                <div>
                  <label className="block text-xs font-medium text-[#172333] mb-1">
                    Assign to Client Project
                  </label>
                  <select
                    value={linkedProjectId}
                    onChange={(e) => setLinkedProjectId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                  >
                    <option value="">Unassigned / General Private</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.clientName})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedBucket === 'service-media' && (
                <div>
                  <label className="block text-xs font-medium text-[#172333] mb-1">
                    Link to Service (Optional)
                  </label>
                  <select
                    value={linkedServiceId}
                    onChange={(e) => setLinkedServiceId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                  >
                    <option value="">Any Service</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedBucket === 'portfolio-media' && (
                <div>
                  <label className="block text-xs font-medium text-[#172333] mb-1">
                    Link to Portfolio Item (Optional)
                  </label>
                  <select
                    value={linkedPortfolioId}
                    onChange={(e) => setLinkedPortfolioId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                  >
                    <option value="">Any Portfolio Entry</option>
                    {portfolioItems.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {mode === 'full' && (
              <div>
                <label className="block text-xs font-medium text-[#172333] mb-1">
                  Default Description / Notes (Optional)
                </label>
                <input
                  type="text"
                  value={defaultDescription}
                  onChange={(e) => setDefaultDescription(e.target.value)}
                  placeholder="Optional caption or deliverable notes applied to uploaded files..."
                  className="w-full px-3 py-1.5 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                />
              </div>
            )}
          </div>

          {/* Drag-and-Drop Multi-File Upload Zone */}
          <div className="lg:col-span-7">
            <label className="block text-xs font-semibold text-[#172333] mb-1">
              2. Drag & Drop Files or Browse Computer
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDragging
                  ? 'border-[#F18A45] bg-[#F18A45]/10'
                  : 'border-[#E2E4DF] bg-[#F5F5F1]/60 hover:border-[#172333]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => {
                  if (e.target.files) {
                    enqueueFiles(e.target.files);
                    e.target.value = '';
                  }
                }}
                className="hidden"
                accept="image/*,video/*,application/pdf,.zip,.psd,.ai,.fig,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
              />
              <Upload className="w-7 h-7 mx-auto text-[#172333] mb-2" />
              <p className="text-xs font-semibold text-[#172333]">
                Drop one or multiple files here, or <span className="text-[#F18A45] underline">browse files</span>
              </p>
              <p className="text-[11px] text-[#6E7785] mt-1">
                Supports Images (JPG, PNG, WEBP, SVG), Videos (MP4, WEBM, MOV), PDFs, and Project Documents.
              </p>
              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-3 text-[11px] font-mono text-[#6E7785]">
                <span>
                  Target: <strong className="text-[#172333]">{selectedBucket}</strong>
                </span>
                <span>·</span>
                <span>
                  Access:{' '}
                  <strong className="text-[#172333]">
                    {activeBucketConfig.isPublic ? 'Public Read / Admin Write' : 'Private Signed URL'}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Active & Recent Upload Queue */}
        {uploadQueue.length > 0 && (
          <div className="pt-3 border-t border-[#E2E4DF] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#172333]">
                Upload Queue ({uploadQueue.filter((q) => q.status === 'success').length}/
                {uploadQueue.length} completed)
              </span>
              <div className="flex items-center gap-3">
                {uploadQueue.some((q) => q.status === 'error') && (
                  <button
                    type="button"
                    onClick={handleRetryAllFailed}
                    className="text-xs font-semibold text-[#F18A45] hover:underline"
                  >
                    Retry All Failed
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setUploadQueue((prev) => prev.filter((q) => q.status === 'uploading'))
                  }
                  className="text-xs text-[#6E7785] hover:text-[#172333]"
                >
                  Clear Finished
                </button>
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto divide-y divide-[#E2E4DF] bg-[#F5F5F1] rounded-lg border border-[#E2E4DF]">
              {uploadQueue.map((item) => (
                <div
                  key={item.queueId}
                  className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {item.status === 'success' && (
                        <CheckCircle2 className="w-4 h-4 text-[#26734D] shrink-0" />
                      )}
                      {item.status === 'error' && (
                        <AlertCircle className="w-4 h-4 text-[#B93832] shrink-0" />
                      )}
                      {(item.status === 'uploading' || item.status === 'pending') && (
                        <RefreshCw className="w-4 h-4 text-[#F18A45] animate-spin shrink-0" />
                      )}
                      <span className="font-semibold text-[#172333] truncate">
                        {item.file.name}
                      </span>
                      <span className="font-mono text-[11px] text-[#6E7785] shrink-0">
                        ({formatFileSize(item.file.size)})
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 bg-white border border-[#E2E4DF] rounded">
                        {item.targetBucket}
                      </span>
                    </div>
                    {item.errorMessage && (
                      <p className="text-[11px] text-[#B93832] mt-1">{item.errorMessage}</p>
                    )}
                    {item.status === 'uploading' && (
                      <div className="w-full h-1.5 bg-[#E2E4DF] rounded-full overflow-hidden mt-1.5">
                        <div
                          className="h-full bg-[#F18A45] transition-all duration-200"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.status === 'error' && (
                      <button
                        type="button"
                        onClick={() => handleRetryFailed(item)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded"
                      >
                        Retry
                      </button>
                    )}
                    {item.status === 'success' &&
                      item.uploadedAsset &&
                      mode === 'picker' &&
                      onSelectAsset && (
                        <button
                          type="button"
                          onClick={() => onSelectAsset(item.uploadedAsset!)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-[#172333] bg-[#F18A45] rounded"
                        >
                          Use This File
                        </button>
                      )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Search & Filter Component (MIME Type, File Title, and Associated Project Tags via Supabase Filters) */}
      <MediaSearchFilterBar
        filters={activeFilters}
        onChangeFilters={setActiveFilters}
        onResetFilters={handleResetFilters}
        availableTags={knownTags}
        projects={projects}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        totalMatching={filteredAssets.length}
        isFiltering={isFiltering}
      />

      {/* Media Assets Display */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="h-64 bg-white border border-[#E2E4DF] rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="bg-white border border-[#E2E4DF] rounded-lg p-12 text-center space-y-2">
          <HardDrive className="w-7 h-7 mx-auto text-[#6E7785]" />
          <p className="text-sm font-semibold text-[#172333]">No media assets match your filter</p>
          <p className="text-xs text-[#6E7785]">
            Drag and drop files into the upload zone above to store them in Supabase Storage.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {paginatedAssets.map((asset) => {
            const ext =
              asset.fileExtension?.toUpperCase() ||
              getFileExtension(asset.originalFilename).toUpperCase() ||
              asset.mediaCategory.toUpperCase();
            return (
              <div
                key={asset.id}
                className="bg-white border border-[#E2E4DF] rounded-lg overflow-hidden flex flex-col justify-between hover:border-[#172333] transition-colors"
              >
                <div>
                  {/* Thumbnail Preview Box */}
                  <div
                    onClick={() => setPreviewItem(toPreviewableItem(asset))}
                    className="cursor-pointer relative aspect-[16/10] bg-[#172333] overflow-hidden border-b border-[#E2E4DF] flex items-center justify-center group"
                  >
                    {asset.mediaCategory === 'image' && asset.publicUrl ? (
                      <img
                        src={asset.publicUrl}
                        alt={asset.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : asset.mediaCategory === 'video' && asset.publicUrl ? (
                      <div className="relative w-full h-full flex items-center justify-center bg-[#0F1722]">
                        <video
                          src={asset.publicUrl}
                          preload="metadata"
                          muted
                          playsInline
                          className="w-full h-full object-cover opacity-85"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <div className="w-10 h-10 rounded-full bg-[#F18A45] text-[#172333] flex items-center justify-center shadow-md">
                            <Film className="w-5 h-5" />
                          </div>
                        </div>
                      </div>
                    ) : asset.mediaCategory === 'pdf' ? (
                      <div className="text-center space-y-1.5 p-4">
                        <FileText className="w-9 h-9 mx-auto text-[#F18A45]" />
                        <span className="block font-mono text-xs text-white font-semibold">
                          PDF DOCUMENT
                        </span>
                      </div>
                    ) : (
                      <div className="text-center space-y-1.5 p-4">
                        <FileArchive className="w-9 h-9 mx-auto text-[#F18A45]" />
                        <span className="block font-mono text-xs text-white font-semibold">
                          {ext} FILE
                        </span>
                      </div>
                    )}

                    {/* Top-Left Bucket Badge */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-0.5 rounded bg-[#172333]/90 text-[10px] font-mono text-white border border-white/10">
                      {asset.storageBucket === 'private-project-files' ? (
                        <Lock className="w-3 h-3 text-[#F18A45]" />
                      ) : (
                        <Globe className="w-3 h-3 text-[#26734D]" />
                      )}
                      <span>{asset.storageBucket}</span>
                    </div>

                    {/* Top-Right Extension Badge */}
                    <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-[#172333]/90 text-[10px] font-mono font-semibold text-[#F18A45] border border-white/10">
                      {ext}
                    </span>
                  </div>

                  {/* Metadata Body */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        className="text-sm font-semibold text-[#172333] truncate"
                        title={asset.title}
                      >
                        {asset.title}
                      </h3>
                      <span className="font-mono text-[11px] text-[#6E7785] shrink-0">
                        {formatFileSize(asset.fileSize)}
                      </span>
                    </div>

                    <p
                      className="text-[11px] font-mono text-[#6E7785] truncate"
                      title={asset.storagePath}
                    >
                      {asset.storagePath || asset.originalFilename}
                    </p>

                    {asset.description && (
                      <p className="text-xs text-[#6E7785] line-clamp-2">{asset.description}</p>
                    )}

                    {asset.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {asset.tags.slice(0, 4).map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() =>
                              setActiveFilters({
                                ...activeFilters,
                                tag: activeFilters.tag === tag ? '' : tag,
                              })
                            }
                            className={`px-1.5 py-0.5 text-[10px] font-mono rounded border transition-colors ${
                              activeFilters.tag === tag
                                ? 'bg-[#F18A45] text-[#172333] border-[#F18A45] font-semibold'
                                : 'bg-[#F5F5F1] text-[#172333] border-[#E2E4DF] hover:border-[#172333]'
                            }`}
                            title={`Filter by #${tag}`}
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="px-4 py-2.5 bg-[#F5F5F1]/60 border-t border-[#E2E4DF] flex items-center justify-between gap-2 text-xs">
                  <span className="text-[11px] text-[#6E7785]">{formatDate(asset.createdAt)}</span>
                  <div className="flex items-center gap-2">
                    {mode === 'picker' && onSelectAsset ? (
                      <button
                        type="button"
                        onClick={() => onSelectAsset(asset)}
                        className="px-3 py-1 text-xs font-semibold text-[#172333] bg-[#F18A45] hover:bg-[#e07934] rounded-md"
                      >
                        Select
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setPreviewItem(toPreviewableItem(asset))}
                      className="p-1 text-[#172333] hover:text-[#F18A45]"
                      title="Interactive Preview"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyUrl(asset)}
                      className="p-1 text-[#172333] hover:text-[#F18A45]"
                      title="Copy URL / Signed Link"
                    >
                      {copiedId === asset.id ? (
                        <Check className="w-4 h-4 text-[#26734D]" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(asset)}
                      className="p-1 text-[#172333] hover:text-[#F18A45]"
                      title="Edit Title, Tags & Description"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAsset(asset)}
                      className="p-1 text-[#B93832] hover:opacity-80"
                      title="Delete Asset"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white border border-[#E2E4DF] rounded-lg overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2E4DF] text-[11px] font-semibold text-[#6E7785]">
                <th className="py-3 px-4">Asset Title & File</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Storage Bucket & Path</th>
                <th className="py-3 px-4">Uploaded</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E4DF] text-xs">
              {paginatedAssets.map((asset) => (
                <tr key={asset.id} className="hover:bg-[#F5F5F1]/50">
                  <td className="py-3 px-4">
                    <p className="font-semibold text-[#172333]">{asset.title}</p>
                    <p className="text-[11px] text-[#6E7785] font-mono">
                      {asset.originalFilename}
                    </p>
                  </td>
                  <td className="py-3 px-4 font-mono uppercase text-[#172333]">
                    {asset.fileExtension || asset.mediaCategory}
                  </td>
                  <td className="py-3 px-4 font-mono text-[#6E7785]">
                    {formatFileSize(asset.fileSize)}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-[#6E7785]">
                    <span className="font-semibold text-[#172333]">{asset.storageBucket}</span>
                    <span className="block truncate max-w-xs">{asset.storagePath}</span>
                  </td>
                  <td className="py-3 px-4 text-[#6E7785]">{formatDate(asset.createdAt)}</td>
                  <td className="py-3 px-4 text-right space-x-2.5 whitespace-nowrap">
                    {mode === 'picker' && onSelectAsset && (
                      <button
                        type="button"
                        onClick={() => onSelectAsset(asset)}
                        className="px-2.5 py-1 font-semibold text-[#172333] bg-[#F18A45] rounded"
                      >
                        Select
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPreviewItem(toPreviewableItem(asset))}
                      className="font-semibold text-[#172333] hover:text-[#F18A45]"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(asset)}
                      className="font-semibold text-[#172333] hover:text-[#F18A45]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAsset(asset)}
                      className="text-[#B93832] hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white border border-[#E2E4DF] rounded-lg px-4 py-3 text-xs">
          <span className="text-[#6E7785]">
            Showing page <strong className="text-[#172333]">{currentPage}</strong> of{' '}
            <strong className="text-[#172333]">{totalPages}</strong> ({filteredAssets.length} total assets)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 font-medium bg-[#F5F5F1] rounded-md disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 font-medium bg-[#F5F5F1] rounded-md disabled:opacity-40"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Interactive Media Preview Lightbox */}
      <MediaPreviewModal
        item={previewItem}
        items={previewGalleryItems}
        onClose={() => setPreviewItem(null)}
        onSelectItem={(next) => setPreviewItem(next)}
      />

      {/* Edit Metadata Modal */}
      {editingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#172333]/65 p-4">
          <form
            onSubmit={handleSaveEdit}
            className="bg-white border border-[#E2E4DF] rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-[#E2E4DF] pb-3">
              <h3 className="text-base font-semibold text-[#172333]">
                Edit Media Asset Metadata
              </h3>
              <button
                type="button"
                onClick={() => setEditingAsset(null)}
                className="text-[#6E7785] hover:text-[#172333]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Display Title *</label>
              <input
                type="text"
                required
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Description / Caption</label>
              <textarea
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                Tags (comma-separated, e.g. youtube, thumbnail, branding)
              </label>
              <input
                type="text"
                value={editForm.tagsText}
                onChange={(e) => setEditForm({ ...editForm, tagsText: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Linked Service</label>
                <select
                  value={editForm.serviceId}
                  onChange={(e) => setEditForm({ ...editForm, serviceId: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                >
                  <option value="">None</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Linked Project</label>
                <select
                  value={editForm.projectId}
                  onChange={(e) => setEditForm({ ...editForm, projectId: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
                >
                  <option value="">None</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {editingAsset.storageBucket !== 'private-project-files' && (
              <label className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={editForm.isPublic}
                  onChange={(e) => setEditForm({ ...editForm, isPublic: e.target.checked })}
                />
                <span>Approved for public website read access</span>
              </label>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E4DF]">
              <button
                type="button"
                onClick={() => setEditingAsset(null)}
                className="px-4 py-2 text-xs font-medium bg-[#F5F5F1] rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg"
              >
                Save Metadata
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
