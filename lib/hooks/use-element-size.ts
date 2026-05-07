'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * useElementSize
 *
 * Tiny ResizeObserver hook that returns a ref + the observed element's
 * `{ width, height }` in CSS pixels. Used by the device preview shell to
 * compute the scale factor that keeps a fixed-size phone / iPad UI fully
 * visible inside whatever room the editor pane currently has.
 *
 * Returns `null` until the first measurement so consumers can render a
 * placeholder (or just pass scale=1) on the first paint.
 */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((prev) =>
        prev?.width === width && prev?.height === height ? prev : { width, height },
      );
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  return [ref, size] as const;
}
