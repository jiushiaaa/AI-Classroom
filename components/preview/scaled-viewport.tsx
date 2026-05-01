'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface ScaledViewportProps {
  /** Virtual width in CSS pixels (the children render as if the viewport is this wide) */
  readonly width: number;
  /** Virtual height in CSS pixels */
  readonly height: number;
  readonly children: ReactNode;
}

/**
 * ScaledViewport
 *
 * Renders its children at fixed virtual pixel dimensions, then applies a CSS
 * `transform: scale()` so the entire virtual viewport fits inside the parent
 * container while preserving aspect ratio. This is the "container query
 * substitute" used by the multi-device preview: the child tree (Sidebar +
 * Canvas + Roundtable + Chat) thinks it is laid out at e.g. 1366x768, while
 * we display it inside a phone shell only ~800x450 on screen.
 *
 * Pointer events still work transparently because CSS transforms are
 * automatically accounted for when the browser hit-tests events.
 */
export function ScaledViewport({ width, height, children }: ScaledViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const recalc = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (cw === 0 || ch === 0) return;
      const next = Math.min(cw / width, ch / height);
      // Avoid scale=0 if the parent hasn't measured yet
      setScale(next > 0 ? next : 1);
    };

    recalc();

    const observer = new ResizeObserver(recalc);
    observer.observe(el);
    return () => observer.disconnect();
  }, [width, height]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden flex items-center justify-center"
    >
      <div
        style={{
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          flexShrink: 0,
          display: 'flex',
        }}
      >
        {children}
      </div>
    </div>
  );
}
