'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type DeviceKind = 'mobile' | 'tablet';

interface DeviceFrameProps {
  readonly device: DeviceKind;
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * DeviceFrame
 *
 * Renders an iPhone-style (16:9 landscape) or iPad-style (4:3) device shell
 * around its children. The frame keeps a fixed aspect ratio and grows to fill
 * the available space, while the children are expected to lay themselves out
 * with `width: 100%; height: 100%`.
 *
 * Visual chrome:
 *  - Mobile: thin black bezel with a centred horizontal speaker / sensor
 *    notch on the left (long-edge), home indicator on the right edge.
 *  - Tablet: silver-grey bezel with rounded camera dot on the top edge and
 *    a faint home indicator on the bottom.
 */
export function DeviceFrame({ device, children, className }: DeviceFrameProps) {
  if (device === 'mobile') {
    return (
      <motion.div
        key="mobile-frame"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        className={cn(
          'relative aspect-[16/9] w-full max-w-[1024px] max-h-full',
          'rounded-[36px] bg-gray-900 dark:bg-black',
          'shadow-[0_24px_60px_-12px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.06)_inset]',
          'p-3',
          className,
        )}
      >
        {/* Inner bezel ring */}
        <div className="absolute inset-1.5 rounded-[30px] ring-1 ring-white/5 pointer-events-none" />

        {/* Left side: speaker notch (centred on the long left edge in landscape) */}
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
          <div className="w-1 h-16 rounded-full bg-gray-700/80" />
        </div>

        {/* Right side: home indicator pill */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
          <div className="w-1 h-24 rounded-full bg-white/20" />
        </div>

        {/* Screen */}
        <div className="relative w-full h-full overflow-hidden rounded-[26px] bg-white dark:bg-gray-950">
          {children}
        </div>
      </motion.div>
    );
  }

  // tablet
  return (
    <motion.div
      key="tablet-frame"
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      className={cn(
        'relative aspect-[4/3] w-full max-w-[1100px] max-h-full',
        'rounded-[28px] bg-gradient-to-br from-gray-800 to-gray-900 dark:from-gray-900 dark:to-black',
        'shadow-[0_24px_60px_-12px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.05)_inset]',
        'p-4',
        className,
      )}
    >
      {/* Camera dot on top bezel */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="w-1.5 h-1.5 rounded-full bg-gray-600/80 ring-1 ring-gray-500/40" />
      </div>

      {/* Home indicator on bottom */}
      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="w-24 h-1 rounded-full bg-white/15" />
      </div>

      {/* Screen */}
      <div className="relative w-full h-full overflow-hidden rounded-[16px] bg-white dark:bg-gray-950">
        {children}
      </div>
    </motion.div>
  );
}
