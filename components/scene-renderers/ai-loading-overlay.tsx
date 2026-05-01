'use client';

/**
 * AILoadingOverlay
 * ----------------
 * Translucent purple overlay rendered on top of an interactive / PBL canvas
 * while an AI modify command is in `pending` status. Communicates "the AI is
 * rewriting this widget — please wait" without flashing the whole page.
 *
 * Pure presentation; the host renderer decides when to mount.
 */

import { motion } from 'motion/react';
import { Wand2 } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';

interface AILoadingOverlayProps {
  readonly instruction?: string;
}

export function AILoadingOverlay({ instruction }: AILoadingOverlayProps) {
  const { t } = useI18n();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 backdrop-blur-[2px] bg-purple-100/35 dark:bg-purple-900/35 pointer-events-auto"
      role="status"
      aria-live="polite"
      data-testid="ai-loading-overlay"
    >
      <div className="relative flex items-center justify-center">
        <span className="absolute inline-flex h-14 w-14 rounded-full bg-purple-400/30 animate-ping" />
        <span className="relative inline-flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg shadow-purple-500/40 ring-2 ring-white/30">
          <Wand2 className="w-5 h-5 text-white animate-pulse" />
        </span>
      </div>
      <div className="px-4 py-2 rounded-full bg-white/90 dark:bg-zinc-900/85 ring-1 ring-purple-200/70 dark:ring-purple-700/40 text-[12px] font-semibold text-purple-700 dark:text-purple-300 shadow-md max-w-[80%] text-center">
        {t('aiModify.overlayTitle')}
      </div>
      {instruction ? (
        <div className="px-4 max-w-[70%] text-center text-[11px] text-purple-700/80 dark:text-purple-200/80 leading-snug truncate">
          {instruction}
        </div>
      ) : null}
    </motion.div>
  );
}
