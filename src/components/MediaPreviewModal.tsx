import React, { useEffect, useState, useRef } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  ExternalLink,
  FileText,
  Film,
  Image as ImageIcon,
  FileArchive,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Lock,
  Globe,
  HardDrive,
} from 'lucide-react';
import { MediaBucket, MediaCategory } from '../types/crm';
import { detectMediaCategory, getFileExtension } from '../utils/mediaValidation';
import { formatFileSize, formatDate } from '../utils/formatters';
import { resolveStoragePreviewUrl } from '../services/crmService';

export interface PreviewableMediaItem {
  id: string;
  title: string;
  url: string;
  videoUrl?: string;
  mimeType?: string;
  fileSize?: number;
  storageBucket?: MediaBucket | string;
  storagePath?: string;
  description?: string;
  tags?: string[];
  categoryLabel?: string;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  isPublic?: boolean;
  createdAt?: string;
  uploaderName?: string;
  actionButton?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

interface MediaPreviewModalProps {
  item: PreviewableMediaItem | null;
  items?: PreviewableMediaItem[];
  onClose: () => void;
  onSelectItem?: (item: PreviewableMediaItem) => void;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  item,
  items = [],
  onClose,
  onSelectItem,
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [resolving, setResolving] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!item) return;
    setZoom(1);
    setRotation(0);
    setPlaybackRate(1);
    setCopiedUrl(false);

    let active = true;
    const primaryUrl = item.videoUrl || item.url;

    if (item.storageBucket === 'private-project-files' && item.storagePath) {
      setResolving(true);
      resolveStoragePreviewUrl({
        storageBucket: item.storageBucket,
        storagePath: item.storagePath,
        fallbackUrl: primaryUrl,
        expiresInSeconds: 3600,
      })
        .then((signed) => {
          if (active) setResolvedUrl(signed || primaryUrl);
        })
        .catch(() => {
          if (active) setResolvedUrl(primaryUrl);
        })
        .finally(() => {
          if (active) setResolving(false);
        });
    } else {
      setResolvedUrl(primaryUrl);
      setResolving(false);
    }

    return () => {
      active = false;
    };
  }, [item]);

  useEffect(() => {
    if (!item) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && items.length > 1 && onSelectItem) {
        const idx = items.findIndex((i) => i.id === item.id);
        if (idx > 0) onSelectItem(items[idx - 1]);
      } else if (e.key === 'ArrowRight' && items.length > 1 && onSelectItem) {
        const idx = items.findIndex((i) => i.id === item.id);
        if (idx >= 0 && idx < items.length - 1) onSelectItem(items[idx + 1]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, items, onClose, onSelectItem]);

  if (!item) return null;

  const activeUrl = resolvedUrl || item.videoUrl || item.url;
  const mediaCategory: MediaCategory = item.videoUrl
    ? 'video'
    : detectMediaCategory(item.mimeType, activeUrl || item.title);
  const extension = getFileExtension(item.title || activeUrl).toUpperCase() || mediaCategory.toUpperCase();

  const currentIndex = items.findIndex((i) => i.id === item.id);
  const hasPrev = items.length > 1 && currentIndex > 0;
  const hasNext = items.length > 1 && currentIndex >= 0 && currentIndex < items.length - 1;

  const handleCopyLink = async () => {
    if (!activeUrl) return;
    try {
      await navigator.clipboard.writeText(activeUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      // Ignore clipboard error
    }
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${item.title}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#172333]/85 p-3 sm:p-6 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-white border border-[#E2E4DF] rounded-lg max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar */}
        <div className="px-5 py-3.5 bg-[#172333] text-[#F5F5F1] flex flex-wrap items-center justify-between gap-3 border-b border-[#24364A]">
          <div className="flex items-center gap-2.5 min-w-0">
            {mediaCategory === 'image' && <ImageIcon className="w-4 h-4 text-[#F18A45] shrink-0" />}
            {mediaCategory === 'video' && <Film className="w-4 h-4 text-[#F18A45] shrink-0" />}
            {mediaCategory === 'pdf' && <FileText className="w-4 h-4 text-[#F18A45] shrink-0" />}
            {mediaCategory === 'document' && <FileArchive className="w-4 h-4 text-[#F18A45] shrink-0" />}
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white truncate">{item.title}</h2>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#9BA3B0]">
                <span className="font-mono uppercase text-[#F18A45]">{extension}</span>
                {item.fileSize ? (
                  <>
                    <span>·</span>
                    <span className="font-mono">{formatFileSize(item.fileSize)}</span>
                  </>
                ) : null}
                {item.width && item.height ? (
                  <>
                    <span>·</span>
                    <span className="font-mono">
                      {item.width}×{item.height}px
                    </span>
                  </>
                ) : null}
                {item.storageBucket ? (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      {item.storageBucket === 'private-project-files' ? (
                        <Lock className="w-3 h-3 text-[#F18A45]" />
                      ) : (
                        <Globe className="w-3 h-3 text-[#26734D]" />
                      )}
                      <span className="font-mono">{item.storageBucket}</span>
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {/* Interactive Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            {mediaCategory === 'image' && (
              <>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                  className="p-1.5 text-xs text-[#D0D5DD] hover:text-white hover:bg-[#24364A] rounded-md"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="px-2 py-1 text-[11px] font-mono text-[#D0D5DD] hover:text-white hover:bg-[#24364A] rounded-md"
                  title="Reset Zoom"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                  className="p-1.5 text-xs text-[#D0D5DD] hover:text-white hover:bg-[#24364A] rounded-md"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1.5 text-xs text-[#D0D5DD] hover:text-white hover:bg-[#24364A] rounded-md"
                  title="Rotate 90°"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </>
            )}

            {mediaCategory === 'video' && (
              <div className="flex items-center gap-1 bg-[#24364A] px-2 py-1 rounded-md text-[11px]">
                <span className="text-[#9BA3B0]">Speed:</span>
                {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => handleSpeedChange(rate)}
                    className={`px-1.5 py-0.5 font-mono rounded ${
                      playbackRate === rate
                        ? 'bg-[#F18A45] text-[#172333] font-semibold'
                        : 'text-[#D0D5DD] hover:text-white'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            )}

            {activeUrl && !activeUrl.startsWith('data:') && (
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#D0D5DD] hover:text-white bg-[#24364A] rounded-md"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-[#F18A45]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl ? 'Copied' : 'Copy URL'}</span>
              </button>
            )}

            {activeUrl && (
              <a
                href={activeUrl}
                target="_blank"
                rel="noopener noreferrer"
                download={item.title}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#172333] bg-[#F18A45] hover:bg-[#e07934] rounded-md"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-[#9BA3B0] hover:text-white hover:bg-[#24364A] rounded-md ml-1"
              aria-label="Close preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Viewport Stage */}
        <div className="relative flex-1 bg-[#0F1722] min-h-[340px] max-h-[66vh] flex items-center justify-center overflow-auto p-4">
          {resolving ? (
            <div className="text-xs text-[#9BA3B0] font-mono">
              Generating authenticated Supabase Storage preview URL...
            </div>
          ) : mediaCategory === 'image' ? (
            <div className="overflow-auto max-w-full max-h-full flex items-center justify-center">
              <img
                src={activeUrl}
                alt={item.title}
                referrerPolicy="no-referrer"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 160ms ease-out',
                }}
                className="max-h-[60vh] max-w-full object-contain rounded select-none"
              />
            </div>
          ) : mediaCategory === 'video' ? (
            <video
              ref={videoRef}
              src={activeUrl}
              poster={item.videoUrl && item.url ? item.url : undefined}
              controls
              playsInline
              preload="metadata"
              className="max-h-[60vh] max-w-full rounded bg-black shadow-lg"
            >
              Your browser does not support HTML5 video playback.
            </video>
          ) : mediaCategory === 'pdf' ? (
            <div className="w-full h-[58vh] flex flex-col bg-white rounded overflow-hidden">
              <iframe
                src={activeUrl}
                title={item.title}
                className="w-full flex-1 border-0"
              />
            </div>
          ) : (
            <div className="bg-[#172333] border border-[#24364A] rounded-lg p-8 max-w-md w-full text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-lg bg-[#24364A] flex items-center justify-center text-[#F18A45]">
                <FileArchive className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <span className="font-mono text-xs text-[#F18A45] uppercase">
                  {extension} Project Document
                </span>
                <h3 className="text-base font-semibold text-white break-words">{item.title}</h3>
                {item.fileSize ? (
                  <p className="text-xs text-[#9BA3B0] font-mono">{formatFileSize(item.fileSize)}</p>
                ) : null}
              </div>
              <p className="text-xs text-[#D0D5DD] leading-relaxed">
                This project file format ({extension}) is stored in Supabase Storage and can be downloaded directly for inspection in its native application.
              </p>
              {activeUrl && (
                <div className="pt-2 flex justify-center gap-3">
                  <a
                    href={activeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={item.title}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#172333] bg-[#F18A45] hover:bg-[#e07934] rounded-lg"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download {extension} File</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Previous / Next Gallery Controls */}
          {hasPrev && onSelectItem && (
            <button
              type="button"
              onClick={() => onSelectItem(items[currentIndex - 1])}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-[#172333]/90 text-white hover:bg-[#F18A45] hover:text-[#172333] border border-white/10 transition-colors"
              aria-label="Previous media"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {hasNext && onSelectItem && (
            <button
              type="button"
              onClick={() => onSelectItem(items[currentIndex + 1])}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-[#172333]/90 text-white hover:bg-[#F18A45] hover:text-[#172333] border border-white/10 transition-colors"
              aria-label="Next media"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Bottom Metadata & Context Bar */}
        <div className="px-6 py-4 bg-white border-t border-[#E2E4DF] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#6E7785]">
              {item.categoryLabel && (
                <span className="font-semibold text-[#172333]">{item.categoryLabel}</span>
              )}
              {item.createdAt && (
                <>
                  <span>·</span>
                  <span>Uploaded {formatDate(item.createdAt)}</span>
                </>
              )}
              {item.uploaderName && (
                <>
                  <span>·</span>
                  <span>By {item.uploaderName}</span>
                </>
              )}
              {item.storagePath && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#6E7785] truncate max-w-xs">
                    <HardDrive className="w-3 h-3 shrink-0" />
                    {item.storagePath}
                  </span>
                </>
              )}
            </div>

            {item.description && (
              <p className="text-xs text-[#6E7785] leading-relaxed max-w-3xl">{item.description}</p>
            )}

            {item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 text-[11px] font-mono bg-[#F5F5F1] border border-[#E2E4DF] text-[#172333] rounded"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {activeUrl && !activeUrl.startsWith('data:') && (
              <a
                href={activeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-lg transition-colors whitespace-nowrap"
              >
                <span>Open Original</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            {item.actionButton && (
              <button
                type="button"
                onClick={item.actionButton.onClick}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg transition-colors whitespace-nowrap"
              >
                {item.actionButton.label}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
