'use client';

/**
 * AIModifyPanel
 * -------------
 * Natural-language AI tuning for any scene (slide / quiz / interactive / PBL).
 *
 * Flow: publisher sends an instruction → `pending` (loading overlays on the
 * stage + sidebar thumbnail) → after a short delay the mock “AI” applies
 * changes in one step (`applied`), syncs the first speech line in Notes,
 * lightly marks slide text when applicable, closes this panel, and enters
 * global slide edit mode so the publisher can keep or discard via the normal
 * edit-mode save / revert controls.
 */

import { useCallback, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, X, Send, Loader2, CheckCircle2, GripHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import type { AICommand } from '@/lib/types/ai-command';
import type { Scene, SceneType } from '@/lib/types/stage';
import type { PPTTextElement } from '@/lib/types/slides';
import { useStageStore } from '@/lib/store/stage';
import { useEditModeStore } from '@/lib/store/edit-mode';
import { useI18n } from '@/lib/hooks/use-i18n';
import { Button } from '@/components/ui/button';
import { extractSlidePlainText } from '@/lib/utils/extract-slide-plain-text';
import type { SpeechAction } from '@/lib/types/action';

const SLIDE_AI_MARKER = '<!--openmaic-ai-tuned-->';

interface AIModifyPanelProps {
  readonly sceneId: string;
  readonly onClose: () => void;
  /**
   * `floating` — draggable canvas overlay (default).
   * `embedded` — static body for use inside a `Dialog` (no drag handle).
   */
  readonly layout?: 'floating' | 'embedded';
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

function resolveAiCommands(scene: Scene | undefined): AICommand[] {
  if (!scene) return [];
  if (scene.aiCommands) return scene.aiCommands;
  if (scene.content.type === 'interactive' || scene.content.type === 'pbl') {
    return scene.content.aiCommands ?? [];
  }
  return [];
}

export function AIModifyPanel({
  sceneId,
  onClose,
  layout = 'floating',
}: AIModifyPanelProps) {
  const { t } = useI18n();
  const updateScene = useStageStore.use.updateScene();
  const scene = useStageStore((s) => s.scenes.find((sc) => sc.id === sceneId));
  const [draft, setDraft] = useState('');

  const commands = useMemo(() => resolveAiCommands(scene), [scene]);

  const sortedCommands = useMemo(
    () => [...commands].sort((a, b) => b.timestamp - a.timestamp),
    [commands],
  );

  const isPending = sortedCommands.some((c) => c.status === 'pending');
  const appliedCount = commands.filter((c) => c.status === 'applied').length;

  const sceneType: SceneType = scene?.type ?? 'slide';
  const sceneTitle = scene?.title ?? '';
  const placeholderKey = PLACEHOLDER_BY_TYPE[sceneType];

  const writeCommands = useCallback(
    (next: AICommand[]) => {
      const current = useStageStore.getState().scenes.find((s) => s.id === sceneId);
      if (!current) return;
      const patch: Partial<Scene> = { aiCommands: next };
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

  const finalizeCommand = useCallback(
    (cmdId: string, instruction: string) => {
      const trimmed = instruction.trim();
      const current = useStageStore.getState().scenes.find((s) => s.id === sceneId);
      if (!current) return;

      const summaryKey = MOCK_SUMMARY_KEYS[Math.floor(Math.random() * MOCK_SUMMARY_KEYS.length)];
      const summary = t(summaryKey, { instruction: trimmed.slice(0, 28) });

      const prevCmds = resolveAiCommands(current);
      const nextCmds = prevCmds.map((c) =>
        c.id === cmdId ? { ...c, status: 'applied' as const, summary } : c,
      );

      const updates: Partial<Scene> = {
        aiCommands: nextCmds,
        updatedAt: Date.now(),
      };

      if (current.content.type === 'interactive' || current.content.type === 'pbl') {
        updates.content = { ...current.content, aiCommands: nextCmds };
      }

      if (current.actions?.length) {
        const speechIdx = current.actions.findIndex((a) => a.type === 'speech');
        if (speechIdx >= 0) {
          const excerpt =
            current.type === 'slide' && current.content.type === 'slide'
              ? extractSlidePlainText(current.content)
              : '';
          let generated = t('chat.lectureNotes.aiMockScriptBody', {
            title: current.title,
            excerpt: excerpt || t('chat.lectureNotes.aiMockNoExcerpt'),
          });
          generated += t('chat.lectureNotes.aiMockInstructionAppend', {
            instructions: trimmed,
          });
          updates.actions = current.actions.map((a, i) => {
            if (i !== speechIdx || a.type !== 'speech') return a;
            const sa = a as SpeechAction;
            return {
              ...sa,
              text: generated,
              userEditedAt: undefined,
              audioId: undefined,
              audioUrl: undefined,
            };
          });
        }
      }

      if (current.type === 'slide' && current.content.type === 'slide') {
        const canvas = current.content.canvas;
        const elements = [...(canvas.elements ?? [])];
        const ti = elements.findIndex((e) => e.type === 'text');
        if (ti >= 0) {
          const el = elements[ti];
          if (el.type === 'text') {
            const te = el as PPTTextElement;
            const markHtml = `<p><span style="font-size:11px;color:#6d28d9;font-weight:600;">${t('aiModify.slideAiMark')}</span></p>`;
            const newContent = te.content.includes(SLIDE_AI_MARKER)
              ? te.content
              : `${te.content}${SLIDE_AI_MARKER}${markHtml}`;
            elements[ti] = { ...te, content: newContent };
            updates.content = {
              ...current.content,
              canvas: { ...canvas, elements },
            };
          }
        }
      }

      updateScene(sceneId, updates);
      useStageStore.getState().setCurrentSceneId(sceneId);
      useEditModeStore.getState().setEditing(true);
      onClose();
      toast.success(t('aiModify.toastAutoApplied'));
    },
    [sceneId, t, updateScene, onClose],
  );

  const send = useCallback(
    (instruction: string) => {
      const trimmed = instruction.trim();
      if (!trimmed || isPending) return;

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
        finalizeCommand(id, trimmed);
      }, APPLY_DELAY_MS);
    },
    [finalizeCommand, isPending, readCurrentCommands, writeCommands],
  );

  const handleSubmit = useCallback(() => {
    send(draft);
  }, [draft, send]);

  if (!scene) return null;

  const isEmbedded = layout === 'embedded';

  const shellClass = isEmbedded
    ? 'w-full max-w-full rounded-none bg-white dark:bg-zinc-900 flex flex-col max-h-[min(70vh,560px)] overflow-hidden'
    : 'absolute top-14 right-4 z-40 w-[380px] rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl shadow-purple-500/20 ring-1 ring-purple-200/50 dark:ring-purple-700/30 overflow-hidden flex flex-col max-h-[calc(100%-5rem)]';

  const headerRowClass = isEmbedded
    ? 'flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500/10 via-violet-500/10 to-fuchsia-500/10 border-b border-purple-100/50 dark:border-purple-800/30 select-none'
    : 'flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500/10 via-violet-500/10 to-fuchsia-500/10 border-b border-purple-100/50 dark:border-purple-800/30 cursor-grab active:cursor-grabbing select-none';

  const inner = (
    <>
      <div className={headerRowClass}>
        {isEmbedded ? null : <GripHorizontal className="w-3.5 h-3.5 text-purple-400/70" />}
        <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-purple-700/70 dark:text-purple-300/70 font-medium leading-tight">
            {t('aiModify.headerEyebrow')}
          </div>
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-tight">
            {sceneTitle}
          </div>
        </div>
        {isEmbedded ? null : (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('aiModify.close')}
            title={t('aiModify.close')}
            className="p-1 rounded-md text-zinc-500 hover:bg-purple-100/60 dark:hover:bg-purple-800/30 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {appliedCount > 0 ? (
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
          disabled={isPending}
          className="w-full flex-1 min-h-[96px] resize-none rounded-lg bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none ring-1 ring-zinc-200/70 dark:ring-zinc-700/50 focus:ring-purple-400 dark:focus:ring-purple-500 transition-shadow disabled:opacity-60"
          aria-label={t('aiModify.draftAriaLabel')}
        />
        <div className="flex items-center justify-end">
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={isPending || draft.trim().length === 0}
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
    </>
  );

  if (isEmbedded) {
    return <div className={shellClass}>{inner}</div>;
  }

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0.05}
      initial={{ opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 12 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className={shellClass}
      role="dialog"
      aria-label={t('aiModify.panelAriaLabel')}
    >
      {inner}
    </motion.div>
  );
}
