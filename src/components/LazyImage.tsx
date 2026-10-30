import React, { useState, useEffect, useRef } from 'react';

export interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /**
   * Optional fallback image URL if the primary `src` fails to load.
   */
  fallbackSrc?: string;
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
 */
export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt = '',
  fallbackSrc,
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
  const isDataUri = typeof src === 'string' && src.startsWith('data:');
  const [currentSrc, setCurrentSrc] = useState<string | undefined>(src);
  const [isLoaded, setIsLoaded] = useState<boolean>(isDataUri);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setCurrentSrc(src);
    if (typeof src === 'string' && src.startsWith('data:')) {
      setIsLoaded(true);
    } else if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, [src]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoaded(true);
    onLoad?.(e);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
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
