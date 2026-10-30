import React, { useState, useEffect, useRef, useMemo } from 'react';
import { normalizePreviewableImageUrl } from '../utils/mediaValidation';
import { createStudioArtworkDataUri } from '../utils/seedData';

export interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /**
   * Optional fallback image URL if the primary `src` fails to load.
   */
  fallbackSrc?: string;
  /**
   * Optional subtitle for generated fallback artwork if both `src` and `fallbackSrc` fail.
   */
  fallbackSubtitle?: string;
  /**
   * When true, uses `loading="eager"` and `fetchPriority="high"` for above-the-fold LCP images,
   * while defaulting to native `loading="lazy"` and `decoding="async"` for all portfolio & gallery imagery.
   */
  eager?: boolean;
  /**
   * Optional smooth opacity fade-in transition once the image finishes decoding.
   */
  fadeTransition?: boolean;
}

/**
 * High-performance `LazyImage` component that utilizes native browser
 * `loading="lazy"` and `decoding="async"` to reduce Largest Contentful Paint (LCP)
 * contention and improve load performance across portfolio, service, and media galleries.
 * Also normalizes external share links (e.g., Google Drive / Dropbox) and provides
 * automatic studio SVG fallback artwork so broken image icons never appear.
 */
export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt = '',
  fallbackSrc,
  fallbackSubtitle = 'Studio Visual Preview',
  eager = false,
  fadeTransition = false,
  loading,
  decoding = 'async',
  referrerPolicy = 'no-referrer',
  className = '',
  onLoad,
  onError,
  ...rest
}) => {
  const generatedFallback = useMemo(
    () =>
      createStudioArtworkDataUri(
        alt ? alt.slice(0, 38) : 'Prithvi Editify',
        fallbackSubtitle,
        '#10B981',
        '#040D1A',
        '#0D1F38'
      ),
    [alt, fallbackSubtitle]
  );

  const effectiveFallback = useMemo(
    () => normalizePreviewableImageUrl(fallbackSrc) || generatedFallback,
    [fallbackSrc, generatedFallback]
  );

  const normalizedPrimary = useMemo(
    () => normalizePreviewableImageUrl(src) || effectiveFallback,
    [src, effectiveFallback]
  );

  const isDataUri = normalizedPrimary.startsWith('data:');
  const [currentSrc, setCurrentSrc] = useState<string>(normalizedPrimary);
  const [isLoaded, setIsLoaded] = useState<boolean>(isDataUri);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setCurrentSrc(normalizedPrimary);
    if (normalizedPrimary.startsWith('data:')) {
      setIsLoaded(true);
    } else if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, [normalizedPrimary]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoaded(true);
    onLoad?.(e);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (currentSrc !== effectiveFallback) {
      setCurrentSrc(effectiveFallback);
      setIsLoaded(true);
    } else if (currentSrc !== generatedFallback) {
      setCurrentSrc(generatedFallback);
      setIsLoaded(true);
    }
    onError?.(e);
  };

  const resolvedLoading = eager ? 'eager' : loading || 'lazy';
  const transitionClasses =
    fadeTransition && !isDataUri
      ? `transition-opacity duration-200 ${isLoaded ? 'opacity-100' : 'opacity-0'}`
      : '';

  return (
    <img
      ref={imgRef}
      src={currentSrc}
      alt={alt}
      loading={resolvedLoading}
      decoding={decoding}
      referrerPolicy={referrerPolicy}
      onLoad={handleLoad}
      onError={handleError}
      className={`${className} ${transitionClasses}`.trim()}
      {...rest}
    />
  );
};

export default LazyImage;
