'use client';

import { useEffect } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MobileBottomSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly children: ReactNode;
  /**
   * Sheet height as a fraction of the parent container (0–1). Defaults to
   * `0.62` which leaves the slide stage visible above and the bottom tabs
   * + dock untouched below. The sheet positions ABOVE the bottom tabs by
   * default — see `bottomOffset` to push it up further.
   */
  readonly heightRatio?: number;
  /**
   * px gap between the sheet bottom and the parent's bottom edge. Set to
   * the height of the dock + bottom tabs so the sheet doesn't cover them.
   */
  readonly bottomOffset?: number;
  readonly className?: string;
}

/**
 * MobileBottomSheet
 *
 * Half-height sheet that slides up from above the bottom tabs / dock to
 * surface secondary content (narration, members, QA). Includes a backdrop
 * that dismisses on tap and a fixed header with a title + close button.
 * Designed for the phone classroom view's segmented tab system: switching
 * tabs swaps which sheet is open, returning to `composer` closes the sheet
 * altogether so the slide is fully visible again.
 *
 * Implementation note: we use a plain conditional render (not
 * AnimatePresence) so swapping between two sheets — e.g. tapping QA then
 * Members — guarantees the previous sheet's DOM is removed in the same
 * commit the new one mounts. The mount-in animation is preserved via
 * `motion.div`'s initial/animate, but the exit is instant, which is the
 * right trade-off for a tab-driven sheet system.
 */
export function MobileBottomSheet({
  open,
  onClose,
  title,
  children,
  heightRatio = 0.62,
  bottomOffset = 0,
  className,
}: MobileBottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    globalThis.addEventListener('keydown', onKey);
    return () => globalThis.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-30">
      <motion.button
        type="button"
        onClick={onClose}
        aria-label="Close sheet"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] cursor-default"
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
        style={{
          height: `${Math.round(heightRatio * 100)}%`,
          bottom: bottomOffset,
        }}
        className={cn(
          'absolute left-0 right-0 flex flex-col',
          'bg-white dark:bg-gray-950',
          'rounded-t-2xl shadow-[0_-12px_40px_-8px_rgba(0,0,0,0.25)]',
          'ring-1 ring-black/5 dark:ring-white/10',
          className,
        )}
      >
        <div className="shrink-0 flex flex-col items-stretch">
          <div className="mx-auto mt-2 mb-1 w-10 h-1 rounded-full bg-gray-300/80 dark:bg-gray-700/80" />
          <div className="flex items-center justify-between gap-2 px-4 pb-2">
            <h3 className="text-[14px] font-semibold text-gray-800 dark:text-gray-100 truncate">
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden border-t border-gray-100 dark:border-gray-800">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
