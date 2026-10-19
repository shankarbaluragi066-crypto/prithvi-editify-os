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

export function getFileExtension(filename: string): string {
  const parts = String(filename || '')
    .trim()
    .split('.');
  if (parts.length < 2) return '';
  return (parts.pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function detectMediaCategory(mimeType?: string, filenameOrUrl?: string): MediaCategory {
  const mime = String(mimeType || '').toLowerCase();
  const ext = getFileExtension(filenameOrUrl || '');

  if (mime.startsWith('image/') || IMAGE_EXTENSIONS.has(ext) || String(filenameOrUrl || '').startsWith('data:image/')) {
    return 'image';
  }
  if (mime.startsWith('video/') || VIDEO_EXTENSIONS.has(ext)) {
    return 'video';
  }
  if (mime === 'application/pdf' || PDF_EXTENSIONS.has(ext)) {
    return 'pdf';
  }
  return 'document';
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
