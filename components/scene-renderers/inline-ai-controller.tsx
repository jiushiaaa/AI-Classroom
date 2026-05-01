'use client';

/**
 * InlineAIController
 * ------------------
 * Watches the editing surface for "ask AI inline" triggers and renders a
 * single `InlineAIChat` popup near whatever the publisher is acting on.
 *
 * Two triggers (matching Cursor / Feishu):
 *  1. **Text selection** inside the slide canvas (`.canvas` ancestor of the
 *     selection's anchor).
 *  2. **Image element selection** in PPTist — when `canvasStore.handleElementId`
 *     resolves to a DOM node carrying `editable-element-image`, we anchor
 *     the popup to that element's bounding rect.
 *
 * Implementation notes:
 *  - Listeners use a `latestRef` pattern so the rAF-deferred evaluator
 *    always reads fresh `isEditing` / popup-focus state, regardless of how
 *    React decided to memo the surrounding callbacks. This is the cheap
 *    way to make this kind of long-lived global listener bulletproof
 *    against stale closures from upstream useCallback chains.
 *  - We *don't* clear the text trigger when the active element is inside
 *    the popup itself — clicking the textarea sometimes collapses the
 *    canvas selection, and we don't want that to immediately dismiss us.
 *  - Image triggers come from subscribing to `handleElementId` rather than
 *    listening for clicks on `.editable-element-image`. PPTist already eats
 *    `mousedown` for its drag/resize state machine, so subscribing is far
 *    less brittle.
 *  - Drag suppression: while the mouse button is held we hold off
 *    re-evaluating, so the popup doesn't flicker following a drag-select
 *    in real time. We re-evaluate on `mouseup`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { useCanvasStore } from '@/lib/store/canvas';
import { useStageStore } from '@/lib/store/stage';
import { useEditModeStore } from '@/lib/store/edit-mode';
import {
  InlineAIChat,
  type InlineAIChatContext,
  type InlineAIElementKind,
  INLINE_AI_CHAT_DATA_ATTR,
} from './inline-ai-chat';

/**
 * PPTist element kinds we expose through inline AI. Mirrors the
 * `editable-element-{kind}` wrapper classes used in the renderer. Text is
 * deliberately excluded — its inline entry point is the text-selection
 * trigger, which gives finer-grained context than "the whole text box".
 */
const PPTIST_ELEMENT_KINDS: ReadonlyArray<Exclude<InlineAIElementKind, 'quiz'>> = [
  'image',
  'chart',
  'table',
  'video',
  'latex',
  'code',
  'shape',
  'line',
];

/**
 * Returns the inner kind-element (e.g. `.editable-element-image`) and the
 * detected kind. We deliberately anchor to the *inner* node rather than the
 * outer `editable-element` wrapper, because PPTist places the visible image /
 * chart / etc. on the inner div with `position:absolute; top/left/width/height`,
 * leaving the wrapper itself at 0×0. Using the wrapper's rect would tuck the
 * popup into the slide's top-left corner regardless of where the user clicked.
 */
function detectElementKind(
  outer: HTMLElement,
): { kind: InlineAIElementKind; inner: HTMLElement } | null {
  for (const kind of PPTIST_ELEMENT_KINDS) {
    const inner = outer.querySelector<HTMLElement>(`.editable-element-${kind}`);
    if (inner) return { kind, inner };
  }
  return null;
}

interface InlineAIControllerProps {
  readonly sceneId: string;
}

interface TriggerState {
  readonly key: string;
  readonly rect: { left: number; top: number; right: number; bottom: number; width: number; height: number };
  readonly context: InlineAIChatContext;
}

/** Cap selection excerpts so a stray Ctrl+A doesn't blow up the prompt. */
const EXCERPT_MAX = 80;
const MIN_SELECTION_LENGTH = 1;

function rectFromClientRect(rect: { left: number; top: number; right: number; bottom: number; width: number; height: number }): TriggerState['rect'] {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Robust selection rect: getBoundingClientRect can return {0,0,0,0} for
 * selections that span empty/inline boundaries in ProseMirror. Fall back to
 * getClientRects and use the union of valid rects.
 */
function getRobustSelectionRect(range: Range): DOMRect | null {
  const direct = range.getBoundingClientRect();
  if (direct.width > 0 || direct.height > 0) return direct;
  const rects = range.getClientRects();
  if (rects.length === 0) return null;
  // Return the first valid rect — for a multi-line selection that's the
  // top-left line, which is a reasonable anchor for the popup.
  for (const r of rects) {
    if (r.width > 0 || r.height > 0) return r;
  }
  return null;
}

function getCanvasRootForNode(node: Node | null): HTMLElement | null {
  if (!node) return null;
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  if (!el) return null;
  return el.closest<HTMLElement>('.canvas');
}

export function InlineAIController({ sceneId }: InlineAIControllerProps) {
  const isEditing = useEditModeStore.use.isEditing();
  const handleElementId = useCanvasStore.use.handleElementId();
  const activeElementIdList = useCanvasStore.use.activeElementIdList();
  const currentSceneId = useStageStore.use.currentSceneId();

  const [trigger, setTrigger] = useState<TriggerState | null>(null);
  const triggerRef = useRef<TriggerState | null>(null);
  triggerRef.current = trigger;

  // Latest-isEditing snapshot for listeners that may outlive a render cycle.
  const isEditingRef = useRef(isEditing);
  isEditingRef.current = isEditing;

  const mouseDownRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const close = useCallback(() => setTrigger(null), []);

  // ---- Reset on edit-mode exit / scene switch ----------------------------
  useEffect(() => {
    if (!isEditing || currentSceneId !== sceneId) {
      setTrigger(null);
    }
  }, [isEditing, currentSceneId, sceneId]);

  // ---- Core: re-evaluate the current text selection ----------------------

  // Stable function reference that always reads the *latest* state. Defined
  // with `useRef` so we can call it from raw DOM listeners without thinking
  // about useCallback memoization.
  const evaluateSelectionRef = useRef<() => void>(() => {});

  evaluateSelectionRef.current = () => {
    if (!isEditingRef.current) return;
    if (mouseDownRef.current) return;

    // Don't disturb the trigger while the user is interacting with the
    // popup itself — clicking the textarea can collapse the canvas
    // selection, and we'd otherwise dismiss our own popup.
    const active = document.activeElement;
    if (active?.closest(`[${INLINE_AI_CHAT_DATA_ATTR}]`)) {
      return;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      // Clear *only* the text trigger; an image trigger is independent.
      if (triggerRef.current?.context.kind === 'text') setTrigger(null);
      return;
    }

    const text = sel.toString().trim();
    if (text.length < MIN_SELECTION_LENGTH) {
      if (triggerRef.current?.context.kind === 'text') setTrigger(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const root = getCanvasRootForNode(range.commonAncestorContainer);
    if (!root) {
      // Selection isn't in the slide canvas (e.g., lecture notes / sidebar).
      if (triggerRef.current?.context.kind === 'text') setTrigger(null);
      return;
    }

    const rect = getRobustSelectionRect(range);
    if (!rect) return;

    const excerpt = text.length > EXCERPT_MAX ? `${text.slice(0, EXCERPT_MAX)}…` : text;

    setTrigger({
      key: `text-${rect.left.toFixed(0)}-${rect.top.toFixed(0)}-${text.length}`,
      rect: rectFromClientRect(rect),
      context: { kind: 'text', excerpt },
    });
  };

  const scheduleEvaluate = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      evaluateSelectionRef.current();
    });
  }, []);

  // ---- Mouse-button tracking + selectionchange + mouseup fallback --------

  useEffect(() => {
    if (!isEditing) return;

    const onMouseDown = () => {
      mouseDownRef.current = true;
    };
    const onMouseUp = () => {
      mouseDownRef.current = false;
      // Defer one tick so the browser commits any pending selection.
      window.setTimeout(scheduleEvaluate, 0);
    };
    const onSelectionChange = () => scheduleEvaluate();

    window.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('mouseup', onMouseUp, true);
    document.addEventListener('selectionchange', onSelectionChange);

    return () => {
      window.removeEventListener('mousedown', onMouseDown, true);
      window.removeEventListener('mouseup', onMouseUp, true);
      document.removeEventListener('selectionchange', onSelectionChange);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isEditing, scheduleEvaluate]);

  // ---- PPTist element selection detection --------------------------------

  // When a single non-text PPTist element is "handled", anchor the popup
  // to its DOM rect. We exclude text elements because their primary inline
  // entry point is the text-selection trigger above (selecting characters
  // gives finer-grained context than the whole text box). Multi-select
  // intentionally falls through to the page-level launcher.
  useEffect(() => {
    if (!isEditing) return;

    if (!handleElementId || activeElementIdList.length !== 1) {
      if (triggerRef.current?.context.kind === 'element') setTrigger(null);
      return;
    }

    // Defer one tick so the DOM has rendered the latest selection state.
    const id = window.setTimeout(() => {
      const outer = document.getElementById(`editable-element-${handleElementId}`);
      if (!outer) return;

      const detected = detectElementKind(outer);
      // Skip text elements (handled by the selection trigger) and unknown
      // kinds (e.g. group selections, container divs).
      if (!detected) {
        if (triggerRef.current?.context.kind === 'element') setTrigger(null);
        return;
      }

      // Anchor to the *inner* kind-element — the outer wrapper is 0×0.
      const rect = detected.inner.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      setTrigger({
        key: `element-${detected.kind}-${handleElementId}`,
        rect: rectFromClientRect(rect),
        // Store the *outer* DOM id so the reposition effect can find the
        // wrapper via getElementById and walk back to the inner kind div.
        context: { kind: 'element', elementKind: detected.kind, elementId: outer.id },
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, [isEditing, handleElementId, activeElementIdList]);

  // ---- Quiz question click detection -------------------------------------

  // Quiz scenes don't go through PPTist so we listen for direct clicks on
  // question cards. The renderer stamps each card with `data-quiz-question-id`
  // and `data-quiz-question-text` so we can both anchor and quote the
  // question in the AI prompt.
  useEffect(() => {
    if (!isEditing) return;
    const onClick = (e: MouseEvent) => {
      // Don't fire when clicking inside the popup itself.
      const tgt = e.target as Element | null;
      if (!tgt) return;
      if (tgt.closest(`[${INLINE_AI_CHAT_DATA_ATTR}]`)) return;
      const card = tgt.closest<HTMLElement>('[data-quiz-question-id]');
      if (!card) {
        if (triggerRef.current?.context.kind === 'element' &&
            triggerRef.current.context.elementKind === 'quiz') {
          setTrigger(null);
        }
        return;
      }
      const questionId = card.dataset.quizQuestionId ?? '';
      const questionText = card.dataset.quizQuestionText ?? '';
      const rect = card.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      setTrigger({
        key: `element-quiz-${questionId}`,
        rect: rectFromClientRect(rect),
        context: {
          kind: 'element',
          elementKind: 'quiz',
          elementId: `quiz-question-${questionId}`,
          excerpt: questionText.slice(0, EXCERPT_MAX),
        },
      });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [isEditing]);

  // ---- Reposition on scroll / resize -------------------------------------

  useEffect(() => {
    if (!trigger) return;

    let raf: number | null = null;
    const tick = () => {
      raf = null;
      if (trigger.context.kind === 'text') {
        evaluateSelectionRef.current();
      } else {
        // Hoist the narrowed elementId so the inner setTrigger callback
        // doesn't lose the discriminated-union narrowing on `trigger`.
        const targetElementId = trigger.context.elementId;
        const targetKind = trigger.context.elementKind;
        const outer = document.getElementById(targetElementId);
        if (!outer) return;

        // For PPTist elements, the visible rect lives on the inner
        // `.editable-element-{kind}` node (the outer wrapper is 0×0).
        // Quiz cards put their rect on the outer node directly.
        let measureNode: HTMLElement = outer;
        if (targetKind !== 'quiz') {
          const inner = outer.querySelector<HTMLElement>(
            `.editable-element-${targetKind}`,
          );
          if (inner) measureNode = inner;
        }
        const rect = measureNode.getBoundingClientRect();
        setTrigger((prev) => {
          if (prev?.context.kind !== 'element') return prev;
          if (prev.context.elementId !== targetElementId) return prev;
          return { ...prev, rect: rectFromClientRect(rect) };
        });
      }
    };
    const reposition = () => {
      if (raf !== null) return;
      raf = window.requestAnimationFrame(tick);
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      if (raf !== null) window.cancelAnimationFrame(raf);
    };
  }, [trigger]);

  if (!isEditing || !trigger) return null;

  return (
    <AnimatePresence>
      <InlineAIChat
        key={trigger.key}
        sceneId={sceneId}
        viewportRect={trigger.rect}
        context={trigger.context}
        onClose={close}
      />
    </AnimatePresence>
  );
}
