'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import type { PreviewDevice, PreviewOrientation } from '@/lib/store/preview-device';
import { useElementSize } from '@/lib/hooks/use-element-size';
import { cn } from '@/lib/utils';

interface DevicePreviewShellProps {
  readonly device: Exclude<PreviewDevice, 'web'>;
  readonly orientation: PreviewOrientation;
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * DevicePreviewShell
 *
 * Renders content at the real CSS pixel dimensions of the target device
 * and uses `transform: scale()` to fit it into the parent preview pane.
 *
 * Importantly the shell DOES NOT wrap the device UI in a thick white card:
 * the user complaint was "a small slide floating inside a huge white
 * device frame", so the shell now adds nothing more than a 1px hairline
 * outline + a soft drop-shadow so the publisher can still see where the
 * "screen edge" is. The actual mobile / iPad UI is responsible for its
 * own background.
 *
 *  - All Tailwind breakpoints / 1px borders / 44pt touch targets are
 *    evaluated against real device dimensions.
 *  - The device-shaped surface is as large as the preview pane allows,
 *    so the slide stage genuinely dominates the screen.
 *  - Switching device or orientation re-scales without remounting the
 *    inner classroom.
 */

const DEVICE_SIZES: Record<
  Exclude<PreviewDevice, 'web'>,
  Record<PreviewOrientation, { width: number; height: number }>
> = {
  mobile: {
    portrait: { width: 390, height: 844 },
    landscape: { width: 844, height: 390 },
  },
  tablet: {
    portrait: { width: 820, height: 1180 },
    landscape: { width: 1180, height: 820 },
  },
};

export function DevicePreviewShell({
  device,
  orientation,
  children,
  className,
}: DevicePreviewShellProps) {
  const [containerRef, containerSize] = useElementSize<HTMLDivElement>();

  const intrinsic = DEVICE_SIZES[device][orientation];
  const scale = containerSize
    ? Math.min(containerSize.width / intrinsic.width, containerSize.height / intrinsic.height, 1.4)
    : 1;

  return (
    <div ref={containerRef} className={cn('relative w-full h-full overflow-hidden', className)}>
      <motion.div
        key={`${device}-${orientation}`}
        initial={{ opacity: 0, scale: scale * 0.97 }}
        animate={{ opacity: 1, scale }}
        exit={{ opacity: 0, scale: scale * 0.97 }}
        transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
        style={{
          width: intrinsic.width,
          height: intrinsic.height,
          transformOrigin: 'center center',
          // GPU rendering hints — non-integer transform scales (e.g.
          // 1.18 in landscape phone, 0.71 in portrait phone) tend to
          // resample text and rounded edges in a slightly blurry way.
          // Promoting the layer + explicit font-smoothing reduces the
          // sub-pixel rendering artefacts the publisher noticed in
          // landscape mode.
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          textRendering: 'optimizeLegibility',
        }}
        className={cn(
          'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden',
          'rounded-[14px] ring-1 ring-black/8 dark:ring-white/10',
          'shadow-[0_18px_45px_-22px_rgba(15,23,42,0.32)] dark:shadow-[0_18px_45px_-22px_rgba(0,0,0,0.6)]',
        )}
      >
        {children}
      </motion.div>
    </div>
  );
}
