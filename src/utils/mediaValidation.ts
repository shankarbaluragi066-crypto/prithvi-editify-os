import { MediaBucket, MediaCategory } from '../types/crm';

export interface BucketConfig {
  id: MediaBucket;
  label: string;
  description: string;
  isPublic: boolean;
  maxSizeBytes: {
    image: number;
    video: number;
    pdf: number;
    document: number;
  };
  allowedCategories: MediaCategory[];
}

const MB = 1024 * 1024;

export const STORAGE_BUCKET_CONFIGS: Record<
  'portfolio-media' | 'service-media' | 'private-project-files',
  BucketConfig
> = {
  'portfolio-media': {
    id: 'portfolio-media',
    label: 'Portfolio Media (Public)',
    description: 'Approved public portfolio graphics, thumbnails, video reels, and case study PDFs.',
    isPublic: true,
    maxSizeBytes: {
      image: 25 * MB,
      video: 100 * MB,
      pdf: 30 * MB,
      document: 30 * MB,
    },
    allowedCategories: ['image', 'video', 'pdf'],
  },
  'service-media': {
    id: 'service-media',
    label: 'Service Media (Public)',
    description: 'Approved service cover artwork, rate-card previews, and example reels.',
    isPublic: true,
    maxSizeBytes: {
      image: 20 * MB,
      video: 75 * MB,
      pdf: 25 * MB,
      document: 25 * MB,
    },
    allowedCategories: ['image', 'video', 'pdf'],
  },
  'private-project-files': {
    id: 'private-project-files',
    label: 'Private Project Files (Authenticated RLS)',
    description:
      'Private client deliverables, draft previews, source files, and invoice attachments accessed via short-lived signed URLs.',
    isPublic: false,
    maxSizeBytes: {
      image: 50 * MB,
      video: 150 * MB,
      pdf: 50 * MB,
      document: 100 * MB,
    },
    allowedCategories: ['image', 'video', 'pdf', 'document'],
  },
};

const BLOCKED_EXTENSIONS = new Set([
  'exe',
  'bat',
  'cmd',
  'sh',
  'php',
  'pl',
  'py',
  'rb',
  'jar',
  'msi',
  'com',
  'scr',
  'vbs',
  'js',
  'JSX',
  'ts',
  'tsx',
  'html',
  'htm',
]);

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'm4v', 'ogv']);
const PDF_EXTENSIONS = new Set(['pdf']);
const DOCUMENT_EXTENSIONS = new Set([
  'zip',
  'psd',
  'ai',
  'eps',
  'fig',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'csv',
  'rtf',
  'mp3',
  'wav',
  'aac',
]);

const ALLOWED_MIME_PREFIXES = [
  'image/',
  'video/',
  'audio/',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/postscript',
  'application/vnd.',
  'application/msword',
  'text/plain',
  'text/csv',
  'application/octet-stream',
];

export function getFileExtension(filenameOrUrl: string): string {
  const raw = String(filenameOrUrl || '').trim();
  if (!raw) return '';

  // Handle data URIs directly (e.g. data:image/svg+xml;utf8,... or data:image/png;base64,...)
  if (raw.startsWith('data:')) {
    const mimeMatch = raw.match(/^data:([^;,]+)/i);
    const mime = mimeMatch ? mimeMatch[1].toLowerCase() : '';
    if (mime.includes('svg')) return 'svg';
    if (mime.includes('png')) return 'png';
    if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
    if (mime.includes('webp')) return 'webp';
    if (mime.includes('gif')) return 'gif';
    if (mime.includes('avif')) return 'avif';
    if (mime.includes('mp4')) return 'mp4';
    if (mime.includes('webm')) return 'webm';
    if (mime.includes('quicktime') || mime.includes('mov')) return 'mov';
    if (mime.includes('pdf')) return 'pdf';
    return '';
  }

  // Strip query parameters (?token=...) and hash fragments (#...) before extracting extension
  const withoutQueryOrHash = raw.split(/[?#]/)[0] || '';
  const lastSegment = withoutQueryOrHash.split('/').pop() || withoutQueryOrHash;
  const parts = lastSegment.trim().split('.');
  if (parts.length < 2) return '';
  const ext = (parts.pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return ext.length <= 10 ? ext : '';
}

const RECOVERED_SUPABASE_MEDIA_BASE =
  'https://kjsnawvgctdsikexzjfp.supabase.co/storage/v1/object/public/inquiry-references/media-library';

const KNOWN_BLOB_OR_TITLE_RECOVERY: Array<{
  matchBlobId?: string;
  matchKeywords: string[];
  permanentUrl: string;
}> = [
  {
    matchBlobId: 'd0a81dc8-878c-443d-b986-2aa0e9ab8788',
    matchKeywords: ['make your brand stand out', 'make-your-brand-stand-out'],
    permanentUrl: `${RECOVERED_SUPABASE_MEDIA_BASE}/make-your-brand-stand-out.webp`,
  },
  {
    matchBlobId: '038d9a3d-61b6-46a2-afca-cc63291b6e49',
    matchKeywords: [
      'thiland and bali trip',
      'thiland-and-bali-trip',
      'thailand',
      'green spark holidays',
      'thiland-trip-packeges',
    ],
    permanentUrl:
      'https://kjsnawvgctdsikexzjfp.supabase.co/storage/v1/object/public/portfolio-media/portfolio/2026-10-18/21723ef2_thiland-trip-packeges-poster-mage-jul-28-202gfhd.jpg',
  },
  {
    matchBlobId: 'fd92fc1b-8284-4c69-888c-d542ebad2830',
    matchKeywords: ['ydp connect', 'ydp-connect'],
    permanentUrl: `${RECOVERED_SUPABASE_MEDIA_BASE}/recovered_ydp.svg`,
  },
  {
    matchBlobId: 'fdff1358-21dc-459a-9f8c-227c5a37ac4c',
    matchKeywords: ['whatsapp image 2026 07 12', 'whatsapp-image-2026-07-12', 'dubai'],
    permanentUrl: `${RECOVERED_SUPABASE_MEDIA_BASE}/recovered_dubai.svg`,
  },
  {
    matchBlobId: 'b4a83b1c-84bc-400b-9eb0-fe1270ba81de',
    matchKeywords: ['philippi', '128264802'],
    permanentUrl: `${RECOVERED_SUPABASE_MEDIA_BASE}/recovered_philippi.svg`,
  },
  {
    matchBlobId: 'a3c3fb3e-96ac-428d-84a2-ddcc66dc48fd',
    matchKeywords: ['nuclear', '104352803', 'how to survive a nuclear'],
    permanentUrl: `${RECOVERED_SUPABASE_MEDIA_BASE}/recovered_nuclear.svg`,
  },
  {
    matchKeywords: ['taalsphere', 'brand identity launch'],
    permanentUrl: `${RECOVERED_SUPABASE_MEDIA_BASE}/recovered_taalsphere.svg`,
  },
  {
    matchKeywords: ['culinary', 'cookbook', 'magazine layout'],
    permanentUrl: `${RECOVERED_SUPABASE_MEDIA_BASE}/recovered_culinary.svg`,
  },
  {
    matchKeywords: ['strategy breakdown', 'gaming thumbnail'],
    permanentUrl: `${RECOVERED_SUPABASE_MEDIA_BASE}/recovered_gaming_strategy.svg`,
  },
];

/**
 * Heals expired `blob:` URLs or missing preview URLs using permanent Supabase Storage URLs.
 */
export function healBrokenMediaUrl(
  url?: string | null,
  titleOrPath?: string | null
): string {
  const raw = String(url || '').trim();
  const contextText = `${raw} ${String(titleOrPath || '')}`.toLowerCase();

  if (!raw || raw.startsWith('blob:')) {
    for (const entry of KNOWN_BLOB_OR_TITLE_RECOVERY) {
      if (entry.matchBlobId && raw.toLowerCase().includes(entry.matchBlobId)) {
        return entry.permanentUrl;
      }
      if (entry.matchKeywords.some((kw) => contextText.includes(kw))) {
        return entry.permanentUrl;
      }
    }
    if (raw.startsWith('blob:')) {
      return `${RECOVERED_SUPABASE_MEDIA_BASE}/make-your-brand-stand-out.webp`;
    }
  }

  return raw;
}

/**
 * Normalizes external share URLs (Google Drive, Dropbox, etc.) into direct previewable
 * image URLs and filters out corrupted/truncated base64 strings or expired blob URLs.
 */
export function normalizePreviewableImageUrl(
  url?: string | null,
  titleOrPath?: string | null
): string {
  const raw = healBrokenMediaUrl(url, titleOrPath);
  if (!raw) return '';

  // Detect non-SVG base64 data URIs that were previously truncated at 1000/1500/2000 chars
  if (raw.startsWith('data:image/') && !raw.startsWith('data:image/svg+xml')) {
    if (raw.length === 1000 || raw.length === 1500 || raw.length === 2000 || raw.length < 120) {
      return '';
    }
    return raw;
  }

  if (raw.startsWith('data:')) {
    return raw;
  }

  // Google Drive file share URLs -> direct thumbnail/image stream URL
  if (raw.includes('drive.google.com')) {
    const fileIdMatch =
      raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
      raw.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
      raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}=w1600`;
    }
  }

  // Dropbox share links -> direct raw asset render
  if (raw.includes('dropbox.com') && raw.includes('dl=0')) {
    return raw.replace('dl=0', 'raw=1');
  }

  return raw;
}

/**
 * Normalizes video URLs so YouTube, Vimeo, and Google Drive video links can be embedded
 * cleanly via iframe while direct MP4/WebM/MOV streams use native HTML5 video.
 */
export function normalizeVideoEmbedUrl(
  url?: string | null
): { type: 'native' | 'iframe'; src: string } | null {
  const raw = String(url || '').trim();
  if (!raw) return null;

  // YouTube watch / short / youtu.be links
  if (raw.includes('youtube.com') || raw.includes('youtu.be')) {
    const ytMatch =
      raw.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{6,})/) ||
      raw.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
    if (ytMatch && ytMatch[1]) {
      return {
        type: 'iframe',
        src: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0&modestbranding=1`,
      };
    }
  }

  // Vimeo links
  if (raw.includes('vimeo.com')) {
    const vimeoMatch = raw.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch && vimeoMatch[1]) {
      return {
        type: 'iframe',
        src: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      };
    }
  }

  // Google Drive video preview
  if (raw.includes('drive.google.com')) {
    const driveMatch =
      raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      return {
        type: 'iframe',
        src: `https://drive.google.com/file/d/${driveMatch[1]}/preview`,
      };
    }
  }

  return { type: 'native', src: raw };
}

export function detectMediaCategory(
  mimeType?: string,
  filenameOrUrl?: string,
  storageBucket?: string
): MediaCategory {
  const mime = String(mimeType || '').toLowerCase().trim();
  const rawUrl = String(filenameOrUrl || '').trim();
  const ext = getFileExtension(rawUrl);

  if (
    mime.startsWith('image/') ||
    IMAGE_EXTENSIONS.has(ext) ||
    rawUrl.startsWith('data:image/')
  ) {
    return 'image';
  }
  if (
    mime.startsWith('video/') ||
    VIDEO_EXTENSIONS.has(ext) ||
    rawUrl.startsWith('data:video/')
  ) {
    return 'video';
  }
  if (
    mime === 'application/pdf' ||
    PDF_EXTENSIONS.has(ext) ||
    rawUrl.startsWith('data:application/pdf')
  ) {
    return 'pdf';
  }
  if (DOCUMENT_EXTENSIONS.has(ext)) {
    return 'document';
  }

  // Check if URL is from a known image host, local asset path, or public visual bucket without explicit extension
  const lowerUrl = rawUrl.toLowerCase();
  const isKnownImageHost =
    lowerUrl.includes('images.unsplash.com') ||
    lowerUrl.includes('unsplash.com/photo') ||
    lowerUrl.includes('lh3.googleusercontent.com') ||
    lowerUrl.includes('drive.google.com/thumbnail') ||
    lowerUrl.includes('picsum.photos') ||
    lowerUrl.includes('imgur.com') ||
    lowerUrl.includes('cloudinary.com') ||
    lowerUrl.includes('pexels.com') ||
    lowerUrl.includes('pixabay.com') ||
    lowerUrl.startsWith('/assets/') ||
    lowerUrl.startsWith('blob:') ||
    lowerUrl.includes('/service-media/') ||
    lowerUrl.includes('/portfolio-media/') ||
    lowerUrl.includes('/public-assets/');

  if (
    isKnownImageHost ||
    storageBucket === 'portfolio-media' ||
    storageBucket === 'service-media' ||
    storageBucket === 'public-assets'
  ) {
    return 'image';
  }

  // If it's an HTTP(S) URL with no recognized document extension and no explicit non-image mimeType, treat as image for preview
  if (
    (lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://')) &&
    (!mime || mime === 'application/octet-stream')
  ) {
    return 'image';
  }

  return 'document';
}

/**
 * Converts an uploaded File into a persistent Data URL (compressing raster images via Canvas
 * so they remain lightweight in localStorage / shared CRM sync when Supabase Storage RLS is not yet active).
 */
export async function fileToPersistentDataUrl(file: File): Promise<string> {
  if (typeof window === 'undefined') return '';
  const category = detectMediaCategory(file.type, file.name);

  if (category === 'image' && !file.type.includes('svg') && !file.type.includes('gif')) {
    return new Promise((resolve) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      const cleanup = () => URL.revokeObjectURL(objectUrl);

      img.onload = () => {
        try {
          const maxDim = 1440;
          let width = img.naturalWidth || 1200;
          let height = img.naturalHeight || 800;
          if (width > maxDim || height > maxDim) {
            if (width >= height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/webp', 0.85);
            cleanup();
            resolve(dataUrl.startsWith('data:image/') ? dataUrl : canvas.toDataURL('image/jpeg', 0.85));
            return;
          }
        } catch {
          // Fall back to FileReader below
        }
        cleanup();
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      };

      img.onerror = () => {
        cleanup();
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      };

      img.src = objectUrl;
    });
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

export function buildSafeStoragePath(originalName: string, folderPrefix = 'uploads'): string {
  const ext = getFileExtension(originalName) || 'bin';
  const rawBase = originalName.replace(/\.[^/.]+$/, '');
  const cleanStem =
    rawBase
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'asset';

  const dateSegment = new Date().toISOString().slice(0, 10);
  const uniqueToken =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);

  const cleanFolder = folderPrefix.replace(/^\/+|\/+$/g, '') || 'uploads';
  return `${cleanFolder}/${dateSegment}/${uniqueToken}_${cleanStem}.${ext}`;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  mediaCategory: MediaCategory;
  extension: string;
}

export function validateMediaFile(
  file: File,
  bucket: 'portfolio-media' | 'service-media' | 'private-project-files' = 'portfolio-media'
): FileValidationResult {
  const ext = getFileExtension(file.name);
  const mediaCategory = detectMediaCategory(file.type, file.name);

  if (!file || file.size <= 0) {
    return {
      valid: false,
      error: 'File is empty (0 bytes). Please choose a valid file.',
      mediaCategory,
      extension: ext,
    };
  }

  if (!ext || BLOCKED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `File extension ".${ext || 'unknown'}" is blocked for security reasons.`,
      mediaCategory,
      extension: ext,
    };
  }

  const isKnownExtension =
    IMAGE_EXTENSIONS.has(ext) ||
    VIDEO_EXTENSIONS.has(ext) ||
    PDF_EXTENSIONS.has(ext) ||
    DOCUMENT_EXTENSIONS.has(ext);

  if (!isKnownExtension) {
    return {
      valid: false,
      error: `Unsupported file format ".${ext}". Allowed: Images (JPG, PNG, WEBP, SVG), Videos (MP4, WEBM, MOV), PDFs, and Creative Documents (ZIP, PSD, AI, DOCX, XLSX).`,
      mediaCategory,
      extension: ext,
    };
  }

  const mime = (file.type || '').toLowerCase();
  if (mime && !ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) {
    return {
      valid: false,
      error: `Unsupported MIME type "${file.type}".`,
      mediaCategory,
      extension: ext,
    };
  }

  const bucketConfig = STORAGE_BUCKET_CONFIGS[bucket] || STORAGE_BUCKET_CONFIGS['portfolio-media'];
  if (!bucketConfig.allowedCategories.includes(mediaCategory)) {
    return {
      valid: false,
      error: `"${bucketConfig.label}" only accepts ${bucketConfig.allowedCategories.join(', ')} files. Use "Private Project Files" for raw documents or archives.`,
      mediaCategory,
      extension: ext,
    };
  }

  const maxBytes = bucketConfig.maxSizeBytes[mediaCategory];
  if (file.size > maxBytes) {
    const maxMb = Math.round(maxBytes / MB);
    return {
      valid: false,
      error: `File exceeds the ${maxMb} MB limit for ${mediaCategory} files in ${bucketConfig.label}.`,
      mediaCategory,
      extension: ext,
    };
  }

  return {
    valid: true,
    mediaCategory,
    extension: ext,
  };
}

export async function extractMediaDimensions(file: File): Promise<{
  width?: number;
  height?: number;
  durationSeconds?: number;
}> {
  const category = detectMediaCategory(file.type, file.name);
  if (typeof window === 'undefined') return {};

  if (category === 'image') {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      const cleanup = () => URL.revokeObjectURL(url);
      img.onload = () => {
        const width = img.naturalWidth || undefined;
        const height = img.naturalHeight || undefined;
        cleanup();
        resolve({ width, height });
      };
      img.onerror = () => {
        cleanup();
        resolve({});
      };
      img.src = url;
    });
  }

  if (category === 'video') {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      const cleanup = () => URL.revokeObjectURL(url);
      video.onloadedmetadata = () => {
        const width = video.videoWidth || undefined;
        const height = video.videoHeight || undefined;
        const durationSeconds =
          Number.isFinite(video.duration) && video.duration > 0
            ? Math.round(video.duration * 10) / 10
            : undefined;
        cleanup();
        resolve({ width, height, durationSeconds });
      };
      video.onerror = () => {
        cleanup();
        resolve({});
      };
      video.src = url;
    });
  }

  return {};
}
