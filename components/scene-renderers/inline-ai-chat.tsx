'use client';

/**
 * InlineAIChat
 * ------------
 * A compact, Cursor-style "Cmd+K" inline chat input that appears anchored to
 * a target element on the slide canvas — typically a text selection or an
 * image element the publisher just clicked. Submitting a prompt records an
 * `AICommand` against the scene's unified `aiCommands` log (same store the
 * floating "AI 助手" launcher writes to), so history stays consistent
 * regardless of which entry point was used.
 *
 * Positioning:
 *  - Receives a `viewportRect` (in CSS px, viewport-relative — i.e. straight
 *    out of `getBoundingClientRect`) and renders itself with `position:fixed`
 *    just below that rect, horizontally centered. The component flips to
 *    above the rect when there isn't enough room below.
 *
 * UX choices:
 *  - One textarea, one Send button. No history, no quick chips, no shortcut
 *    hint — that's intentional, the floating "AI 助手" panel is the place for
 *    those. Inline chat is meant to be lightweight & dismissable.
 *  - Auto-focuses on mount but does NOT clear the user's text selection (we
 *    set `pointer-events: auto` only on the popup itself; the underlying
 *    selection range is preserved).
 *  - Closes on Escape, on outside click, or after a successful submit.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, Send, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import type { AICommand } from '@/lib/types/ai-command';
import type { Scene } from '@/lib/types/stage';
import { useStageStore } from '@/lib/store/stage';
import { useI18n } from '@/lib/hooks/use-i18n';

const POPUP_WIDTH = 380;
const POPUP_OFFSET = 8; // gap between target rect and popup
const APPLY_DELAY_MS = 1500;
// Maximum length of the selected-text excerpt we keep in the recorded command.
// Long selections would balloon the history without adding value.
const EXCERPT_MAX = 80;

/**
 * Data attribute the controller uses to detect "is the active element inside
 * the popup?" — exported so the controller can reference it without
 * stringly-typed coupling.
 */
export const INLINE_AI_CHAT_DATA_ATTR = 'data-inline-ai-chat';

/**
 * Element kinds the inline popup knows how to label / prefix prompts for.
 * Slide elements come from PPTist (see `editable-element-{kind}` wrapper
 * classes); `quiz` is added so we can target an individual question card.
 */
export type InlineAIElementKind =
  | 'image'
  | 'chart'
  | 'table'
  | 'video'
  | 'latex'
  | 'code'
  | 'shape'
  | 'line'
  | 'quiz';

export type InlineAIChatContext =
  | { kind: 'text'; excerpt: string }
  | {
      kind: 'element';
      elementKind: InlineAIElementKind;
      /**
       * DOM id used to re-resolve the rect on scroll/resize. For PPTist
       * elements: `editable-element-{slideElementId}`. For quiz questions:
       * `quiz-question-{questionId}`.
       */
      elementId: string;
      /**
       * Optional short excerpt (e.g. quiz question text) used in the
       * context label and prompt prefix. Slide elements typically don't
       * pass one — they fall back to the per-kind generic label.
       */
      excerpt?: string;
    };

interface InlineAIChatProps {
  readonly sceneId: string;
  /** Target rect in viewport coordinates (i.e. `getBoundingClientRect()`). */
  readonly viewportRect: { left: number; top: number; right: number; bottom: number; width: number; height: number };
  readonly context: InlineAIChatContext;
  readonly onClose: () => void;
}

const MOCK_SUMMARY_KEYS = [
  'aiModify.mockSummaries.swapped',
  'aiModify.mockSummaries.tuned',
  'aiModify.mockSummaries.expanded',
  'aiModify.mockSummaries.localised',
] as const;

export function InlineAIChat({ sceneId, viewportRect, context, onClose }: InlineAIChatProps) {
  const { t } = useI18n();
  const updateScene = useStageStore.use.updateScene();
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  // Compute popup position. We center the popup horizontally on the target,
  // clamped to the viewport, and prefer placement *below* the target. If
  // there isn't room below, flip above. `position: fixed` so this is
  // independent of any scroll containers in the canvas chain.
  const [position, setPosition] = useState<{ left: number; top: number; placement: 'below' | 'above' }>(() => ({
    left: viewportRect.left,
    top: viewportRect.bottom + POPUP_OFFSET,
    placement: 'below',
  }));

  useLayoutEffect(() => {
    const node = containerRef.current;
    const rectHeight = node?.offsetHeight ?? 140;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const idealLeft = viewportRect.left + viewportRect.width / 2 - POPUP_WIDTH / 2;
    const left = Math.max(8, Math.min(vw - POPUP_WIDTH - 8, idealLeft));

    const wantsBelow = viewportRect.bottom + POPUP_OFFSET + rectHeight + 8 <= vh;
    const placement: 'below' | 'above' = wantsBelow ? 'below' : 'above';
    const top = placement === 'below' ? viewportRect.bottom + POPUP_OFFSET : viewportRect.top - rectHeight - POPUP_OFFSET;

    setPosition({ left, top: Math.max(8, top), placement });
  }, [viewportRect]);

  useEffect(() => {
    const id = window.setTimeout(() => textareaRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, []);

  // Close on Escape (highest-priority keybind for a transient popup).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  // Close on click outside the popup. We use `mousedown` (not `click`) so
  // dragging out of the textarea to deselect text doesn't dismiss us.
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const node = containerRef.current;
      if (!node) return;
      if (node.contains(e.target as Node)) return;
      onClose();
    };
    // Defer one tick — the mousedown that *opened* the popup may still be in
    // flight when this listener attaches.
    const id = window.setTimeout(() => {
      window.addEventListener('mousedown', onMouseDown, true);
    }, 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('mousedown', onMouseDown, true);
    };
  }, [onClose]);

  const buildContextPrefix = useCallback((): string => {
    if (context.kind === 'text') {
      const trimmed = context.excerpt.trim().slice(0, EXCERPT_MAX);
      return t('aiModify.inline.contextPrefixText', { excerpt: trimmed });
    }
    // Element prefix: prefer the excerpt-aware variant if we have one
    // (currently only quiz questions ship an excerpt), else fall back to a
    // per-kind generic prefix.
    if (context.excerpt && context.excerpt.trim().length > 0) {
      return t('aiModify.inline.contextPrefixElementWithExcerpt', {
        kind: t(`aiModify.inline.kindLabel.${context.elementKind}`),
        excerpt: context.excerpt.trim().slice(0, EXCERPT_MAX),
      });
    }
    return t('aiModify.inline.contextPrefixElement', {
      kind: t(`aiModify.inline.kindLabel.${context.elementKind}`),
    });
  }, [context, t]);

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
    if (!current) return [];
    if (current.aiCommands) return current.aiCommands;
    if (current.content.type === 'interactive' || current.content.type === 'pbl') {
      return current.content.aiCommands ?? [];
    }
    return [];
  }, [sceneId]);

  const handleSubmit = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed || sending) return;

    const id = `aicmd-inline-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const instruction = `${buildContextPrefix()} ${trimmed}`.trim();
    const pending: AICommand = {
      id,
      timestamp: Date.now(),
      instruction,
      status: 'pending',
    };

    writeCommands([...readCurrentCommands(), pending]);
    setSending(true);

    // After the mock think delay, mark the command as "applied" directly
    // (the inline flow is intentionally one-shot — no preview banner — so
    // the publisher can keep typing/selecting). The floating "AI 助手"
    // panel is the place to review history & undo.
    window.setTimeout(() => {
      const summaryKey = MOCK_SUMMARY_KEYS[Math.floor(Math.random() * MOCK_SUMMARY_KEYS.length)];
      const next = readCurrentCommands().map((cmd) =>
        cmd.id === id
          ? {
              ...cmd,
              status: 'applied' as const,
              summary: t(summaryKey, { instruction: trimmed.slice(0, 28) }),
            }
          : cmd,
      );
      writeCommands(next);
      toast.success(t('aiModify.inline.toastApplied'));
      setSending(false);
      onClose();
    }, APPLY_DELAY_MS);
  }, [buildContextPrefix, draft, onClose, readCurrentCommands, sending, t, writeCommands]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  // Per-kind placeholder. We ship one for every supported kind so we don't
  // need a fallback dance; the i18n keys are checked at build time.
  const placeholder =
    context.kind === 'text'
      ? t('aiModify.inline.placeholderText')
      : t(`aiModify.inline.placeholderByKind.${context.elementKind}`);

  const contextLabel = (() => {
    if (context.kind === 'text') {
      return t('aiModify.inline.contextLabelText', { excerpt: context.excerpt.slice(0, EXCERPT_MAX) });
    }
    const kindName = t(`aiModify.inline.kindLabel.${context.elementKind}`);
    if (context.excerpt && context.excerpt.trim().length > 0) {
      return t('aiModify.inline.contextLabelElementWithExcerpt', {
        kind: kindName,
        excerpt: context.excerpt.slice(0, EXCERPT_MAX),
      });
    }
    return t('aiModify.inline.contextLabelElement', { kind: kindName });
  })();

  return (
    <motion.div
      ref={containerRef}
      role="dialog"
      aria-label={t('aiModify.inline.dialogAriaLabel')}
      {...{ [INLINE_AI_CHAT_DATA_ATTR]: '' }}
      initial={{ opacity: 0, scale: 0.96, y: position.placement === 'below' ? -4 : 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      style={{
        position: 'fixed',
        left: position.left,
        top: position.top,
        width: POPUP_WIDTH,
        zIndex: 70,
      }}
      className="rounded-xl bg-white dark:bg-zinc-900 shadow-2xl shadow-purple-500/25 ring-1 ring-purple-200/60 dark:ring-purple-700/40 overflow-hidden"
    >
      {/* Slim header — context badge on the left, close on the right */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-purple-100/60 dark:border-purple-800/30 bg-gradient-to-r from-purple-500/8 via-violet-500/8 to-fuchsia-500/8">
        <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
        <div
          className="flex-1 min-w-0 text-[11px] font-medium text-purple-700/90 dark:text-purple-300/90 truncate"
          title={contextLabel}
        >
          {contextLabel}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('aiModify.close')}
          title={t('aiModify.close')}
          className="p-0.5 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-purple-100/60 dark:hover:bg-purple-800/30 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Input row */}
      <div className="p-2.5 flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          disabled={sending}
          placeholder={placeholder}
          aria-label={t('aiModify.inline.inputAriaLabel')}
          className="flex-1 resize-none rounded-lg bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none ring-1 ring-zinc-200/70 dark:ring-zinc-700/50 focus:ring-purple-400 dark:focus:ring-purple-500 transition-shadow disabled:opacity-60"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={sending || draft.trim().length === 0}
          aria-label={t('aiModify.send')}
          title={t('aiModify.send')}
          className="shrink-0 h-9 w-9 flex items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-md shadow-purple-500/30 hover:from-purple-600 hover:to-violet-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </motion.div>
  );
}
