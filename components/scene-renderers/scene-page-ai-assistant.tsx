'use client';

/**
 * ScenePageAIAssistant
 * --------------------
 * Always-visible "AI 助手" launcher pinned to the top-right of the canvas
 * while the publisher is in edit mode. Works for ANY scene type (slide /
 * quiz / interactive / pbl) and is the single canonical AI entry point —
 * the older per-widget "AI 调优" button has been retired so interactive /
 * PBL pages don't double up on assistant chrome.
 *
 * The launcher and the inline cmd-K popup (`InlineAIChat`) both write to
 * the same `scene.aiCommands` log, so the publisher gets a unified history
 * regardless of which entry point they used.
 */

import { useCallback, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useStageStore } from '@/lib/store/stage';
import { cn } from '@/lib/utils';
import { AIModifyPanel } from './ai-modify-panel';
import { useAiOptimizationMutex } from '@/lib/hooks/use-ai-optimization-mutex';
import { toast } from 'sonner';

interface ScenePageAIAssistantProps {
  readonly sceneId: string;
}

export function ScenePageAIAssistant({ sceneId }: ScenePageAIAssistantProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { canStart, isCurrentScenePending } = useAiOptimizationMutex(sceneId);

  // Subscribe to applied-count for the badge — uses scene-level aiCommands
  // first, falls back to content-level for legacy data.
  const appliedCount = useStageStore((s) => {
    const scene = s.scenes.find((sc) => sc.id === sceneId);
    if (!scene) return 0;
    const commands =
      scene.aiCommands ??
      (scene.content.type === 'interactive' || scene.content.type === 'pbl'
        ? scene.content.aiCommands
        : null) ??
      [];
    return commands.filter((c) => c.status === 'applied').length;
  });

  const handleToggle = useCallback(() => {
    if (!canStart && !open) {
      toast.error(t('aiModify.globalBusyToast'));
      return;
    }
    if (isCurrentScenePending && !open) return;
    setOpen((p) => !p);
  }, [canStart, isCurrentScenePending, open, t]);
  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <>
      <motion.button
        type="button"
        onClick={handleToggle}
        initial={{ scale: 0.85, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 320, damping: 22 }}
        disabled={!canStart}
        className={cn(
          'absolute top-4 right-4 z-[60] flex items-center gap-1.5 rounded-full',
          'px-3.5 py-2 text-white shadow-xl ring-1 ring-white/20 transition-shadow duration-200',
          canStart || isCurrentScenePending
            ? 'bg-gradient-to-br from-purple-500 to-violet-600 hover:shadow-purple-500/50 shadow-purple-500/30'
            : 'bg-gradient-to-br from-purple-400/50 to-violet-500/50 cursor-not-allowed opacity-70 shadow-purple-500/10',
        )}
        title={t('aiModify.pageAssistantTooltip')}
        aria-label={t('aiModify.pageAssistantAriaLabel')}
        data-testid="scene-page-ai-assistant"
      >
        <Sparkles className="w-4 h-4" />
        <span className="text-xs font-semibold">{t('aiModify.pageAssistantLabel')}</span>
        {appliedCount > 0 ? (
          <span
            className="ml-0.5 inline-flex items-center justify-center rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-bold leading-none"
            aria-label={t('aiModify.historyBadgeAriaLabel', { count: appliedCount })}
          >
            {appliedCount}
          </span>
        ) : null}
      </motion.button>

      <AnimatePresence>
        {open ? (
          <AIModifyPanel key="ai-page-panel" sceneId={sceneId} onClose={handleClose} />
        ) : null}
      </AnimatePresence>
    </>
  );
}
