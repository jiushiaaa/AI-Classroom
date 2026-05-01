'use client';

/**
 * AIModifyPanel
 * -------------
 * Draggable floating panel for issuing natural-language modification
 * instructions to ANY scene (slide / quiz / interactive / PBL).
 *
 * The actual scene content is *not* edited — the demo records the publisher's
 * instructions on the scene's `aiCommands` list (scene-level, shared across
 * all entry points) and after a 2 s "thinking" delay enters a `previewing`
 * state. The publisher then explicitly
 *   - applies the change (status → 'applied', kept in history), or
 *   - discards it (command removed from history)
 *
 * This explicit confirm gate matches the PRD's "对比确认" flow and lets us
 * surface a prominent purple "preview" banner inside the panel.
 *
 * Layout (intentionally minimal — the publisher just types what they want):
 *  ┌───────────────────────────────┐
 *  │ ✨ {sceneTitle}              ✕ │  ← header + drag handle
 *  ├───────────────────────────────┤
 *  │ 🔮 preview banner (apply/undo)│  (only when ≥1 previewing command)
 *  │ ✓  optimization summary       │  (only when ≥1 applied command)
 *  ├───────────────────────────────┤
 *  │ Textarea                       │
 *  │                       [Send →] │
 *  └───────────────────────────────┘
 */

import { useCallback, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Sparkles,
  X,
  Send,
  Loader2,
  CheckCircle2,
  GripHorizontal,
  Wand2,
  Undo2,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AICommand } from '@/lib/types/ai-command';
import type { Scene, SceneType } from '@/lib/types/stage';
import { useStageStore } from '@/lib/store/stage';
import { useI18n } from '@/lib/hooks/use-i18n';
import { Button } from '@/components/ui/button';

interface AIModifyPanelProps {
  readonly sceneId: string;
  readonly onClose: () => void;
}

/** Placeholder per scene type — gives the publisher concrete examples. */
const PLACEHOLDER_BY_TYPE: Record<SceneType, string> = {
  slide: 'aiModify.placeholderSlide',
  quiz: 'aiModify.placeholderQuiz',
  interactive: 'aiModify.placeholderInteractive',
  pbl: 'aiModify.placeholderPBL',
};

const MOCK_SUMMARY_KEYS = [
  'aiModify.mockSummaries.swapped',
  'aiModify.mockSummaries.tuned',
  'aiModify.mockSummaries.expanded',
  'aiModify.mockSummaries.localised',
] as const;

const APPLY_DELAY_MS = 2000;

/**
 * Resolve the canonical aiCommands array for a scene, with back-compat for
 * scenes whose history was previously stored on `content.aiCommands`
 * (interactive / PBL only). Scene-level wins when present.
 */
function resolveAiCommands(scene: Scene | undefined): AICommand[] {
  if (!scene) return [];
  if (scene.aiCommands) return scene.aiCommands;
  if (scene.content.type === 'interactive' || scene.content.type === 'pbl') {
    return scene.content.aiCommands ?? [];
  }
  return [];
}

export function AIModifyPanel({ sceneId, onClose }: AIModifyPanelProps) {
  const { t } = useI18n();
  const updateScene = useStageStore.use.updateScene();
  const scene = useStageStore((s) => s.scenes.find((sc) => sc.id === sceneId));
  const [draft, setDraft] = useState('');

  const commands = useMemo(() => resolveAiCommands(scene), [scene]);

  const sortedCommands = useMemo(
    () => [...commands].sort((a, b) => b.timestamp - a.timestamp),
    [commands],
  );

  const previewing = sortedCommands.find((c) => c.status === 'previewing');
  const isPending = sortedCommands.some((c) => c.status === 'pending');
  const isSending = isPending || !!previewing;
  const appliedCount = commands.filter((c) => c.status === 'applied').length;

  const sceneType: SceneType = scene?.type ?? 'slide';
  const sceneTitle = scene?.title ?? '';
  const placeholderKey = PLACEHOLDER_BY_TYPE[sceneType];

  /**
   * Persist commands back to the scene. Always writes to scene-level. Also
   * mirrors into `content.aiCommands` for interactive / PBL scenes so the
   * legacy `AILoadingOverlay` (which still reads from content) keeps working
   * during the migration window.
   */
  const writeCommands = useCallback(
    (next: AICommand[]) => {
      const current = useStageStore.getState().scenes.find((s) => s.id === sceneId);
      if (!current) return;
      const patch: Partial<Scene> = { aiCommands: next };
      // Mirror to legacy `content.aiCommands` for interactive / PBL scenes
      // so the existing AILoadingOverlay (which still reads from content)
      // keeps working alongside the unified scene-level history.
      if (current.content.type === 'interactive' || current.content.type === 'pbl') {
        patch.content = { ...current.content, aiCommands: next };
      }
      updateScene(sceneId, patch);
    },
    [sceneId, updateScene],
  );

  const readCurrentCommands = useCallback((): AICommand[] => {
    const current = useStageStore.getState().scenes.find((s) => s.id === sceneId);
    return resolveAiCommands(current);
  }, [sceneId]);

  const send = useCallback(
    (instruction: string) => {
      const trimmed = instruction.trim();
      if (!trimmed || isSending) return;

      const id = `aicmd-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const pending: AICommand = {
        id,
        timestamp: Date.now(),
        instruction: trimmed,
        status: 'pending',
      };

      writeCommands([...readCurrentCommands(), pending]);
      setDraft('');

      setTimeout(() => {
        const summaryKey = MOCK_SUMMARY_KEYS[Math.floor(Math.random() * MOCK_SUMMARY_KEYS.length)];
        const next = readCurrentCommands().map((cmd) =>
          cmd.id === id
            ? {
                ...cmd,
                status: 'previewing' as const,
                summary: t(summaryKey, { instruction: trimmed.slice(0, 28) }),
              }
            : cmd,
        );
        writeCommands(next);
        toast.message(t('aiModify.toastPreviewReady'), {
          description: t('aiModify.toastPreviewDescription'),
        });
      }, APPLY_DELAY_MS);
    },
    [isSending, readCurrentCommands, t, writeCommands],
  );

  const handleSubmit = useCallback(() => {
    send(draft);
  }, [draft, send]);

  const handleApplyPreview = useCallback(() => {
    if (!previewing) return;
    const next = readCurrentCommands().map((cmd) =>
      cmd.id === previewing.id ? { ...cmd, status: 'applied' as const } : cmd,
    );
    writeCommands(next);
    toast.success(t('aiModify.toastApplied'));
  }, [previewing, readCurrentCommands, t, writeCommands]);

  const handleUndoPreview = useCallback(() => {
    if (!previewing) return;
    const next = readCurrentCommands().filter((cmd) => cmd.id !== previewing.id);
    writeCommands(next);
    toast(t('aiModify.toastUndone'));
  }, [previewing, readCurrentCommands, t, writeCommands]);

  if (!scene) return null;

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0.05}
      initial={{ opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 12 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className="absolute top-14 right-4 z-40 w-[380px] rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl shadow-purple-500/20 ring-1 ring-purple-200/50 dark:ring-purple-700/30 overflow-hidden flex flex-col max-h-[calc(100%-5rem)]"
      role="dialog"
      aria-label={t('aiModify.panelAriaLabel')}
    >
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500/10 via-violet-500/10 to-fuchsia-500/10 border-b border-purple-100/50 dark:border-purple-800/30 cursor-grab active:cursor-grabbing select-none">
        <GripHorizontal className="w-3.5 h-3.5 text-purple-400/70" />
        <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-purple-700/70 dark:text-purple-300/70 font-medium leading-tight">
            {t('aiModify.headerEyebrow')}
          </div>
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-tight">
            {sceneTitle}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('aiModify.close')}
          title={t('aiModify.close')}
          className="p-1 rounded-md text-zinc-500 hover:bg-purple-100/60 dark:hover:bg-purple-800/30 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {previewing ? (
        <div
          className="mx-3 mt-3 rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/30 dark:to-violet-900/20 px-3 py-2.5 ring-1 ring-purple-200/70 dark:ring-purple-700/40"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-2">
            <Wand2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-300 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-purple-700/80 dark:text-purple-300/80 font-bold mb-0.5">
                {t('aiModify.previewBannerTitle')}
              </div>
              <div className="text-xs text-zinc-800 dark:text-zinc-200 break-words leading-snug">
                {previewing.instruction}
              </div>
              {previewing.summary ? (
                <div className="mt-1 text-[11px] text-purple-700 dark:text-purple-300 break-words leading-snug">
                  {previewing.summary}
                </div>
              ) : null}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-end gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleUndoPreview}
              className="h-7 px-2.5 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-700/40"
            >
              <Undo2 className="w-3 h-3 mr-1" />
              {t('aiModify.undo')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApplyPreview}
              className="h-7 px-2.5 bg-gradient-to-br from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white"
            >
              <Check className="w-3 h-3 mr-1" />
              {t('aiModify.apply')}
            </Button>
          </div>
        </div>
      ) : null}

      {appliedCount > 0 && !previewing ? (
        <div className="mx-3 mt-3 flex items-start gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-200/60 dark:ring-emerald-700/30">
          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{t('aiModify.optimizedBanner', { count: appliedCount })}</span>
        </div>
      ) : null}

      <div className="p-3 flex-1 min-h-0 flex flex-col gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          rows={4}
          placeholder={t(placeholderKey)}
          disabled={isSending}
          className="w-full flex-1 min-h-[96px] resize-none rounded-lg bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none ring-1 ring-zinc-200/70 dark:ring-zinc-700/50 focus:ring-purple-400 dark:focus:ring-purple-500 transition-shadow disabled:opacity-60"
          aria-label={t('aiModify.draftAriaLabel')}
        />
        <div className="flex items-center justify-end">
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={isSending || draft.trim().length === 0}
            className="bg-gradient-to-br from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white"
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                {t('aiModify.sending')}
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 mr-1.5" />
                {t('aiModify.send')}
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
