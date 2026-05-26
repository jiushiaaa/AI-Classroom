'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Check, Clock, Loader2, Minus, Play, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { playBrowserTTSPreview } from '@/lib/audio/browser-tts-preview';
import { getVoxCPMProviderOptions } from '@/lib/audio/voxcpm-voices';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useSettingsStore } from '@/lib/store/settings';
import {
  mergeAdjacentTextSegments,
  normalizeHomophoneSelection,
  parseSpeechScript,
  serializeSpeechScript,
  type SpeechScriptSegment,
} from '@/lib/utils/speech-script-markup';

export interface SpeechScriptEditorHandle {
  insertPause: () => void;
}

interface SpeechScriptEditorProps {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly onBlur?: () => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
}

interface HomophonePopoverState {
  segmentIndex: number;
  start: number;
  end: number;
  word: string;
  speak: string;
  /** Plain text snapshot from the contenteditable at selection time. */
  sourceText: string;
  /** Existing homophone segment being edited (no text splice). */
  homophoneSegmentIndex?: number;
}

const DEFAULT_BREAK_SECONDS = 0.2;
const MIN_BREAK_SECONDS = 0.1;
const MAX_BREAK_SECONDS = 5;
const BREAK_STEP_SECONDS = 0.1;

function clampBreakSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_BREAK_SECONDS;
  return Math.max(MIN_BREAK_SECONDS, Math.min(MAX_BREAK_SECONDS, seconds));
}

function formatBreakSecondsLabel(seconds: number): string {
  const clamped = clampBreakSeconds(seconds);
  const rounded = Math.round(clamped * 10) / 10;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1).replace(/\.0$/, '');
}

function parseBreakSecondsInput(raw: string, fallback: number): number {
  const cleaned = raw.replace(/s$/i, '').trim();
  if (!cleaned) return fallback;
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return fallback;
  return clampBreakSeconds(parsed);
}

function stepBreakSeconds(current: number, delta: number): number {
  const next = Math.round((current + delta) * 10) / 10;
  return clampBreakSeconds(next);
}

function getCaretOffsetInContentEditable(el: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;
  const range = selection.getRangeAt(0);
  if (!el.contains(range.commonAncestorContainer)) return 0;
  const preRange = range.cloneRange();
  preRange.selectNodeContents(el);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString().length;
}

function findLastTextSegmentIndex(segs: SpeechScriptSegment[]): number {
  for (let i = segs.length - 1; i >= 0; i -= 1) {
    if (segs[i].type === 'text') return i;
  }
  return -1;
}

interface TextSelectionPayload {
  start: number;
  end: number;
  text: string;
  sourceText: string;
  rect: DOMRect;
}

function EditableTextSpan({
  segmentIndex,
  value,
  disabled,
  onChange,
  onTextSelect,
  onFocus,
  onCaretChange,
  onBackspaceAtStart,
  onDeleteAtEnd,
}: {
  readonly segmentIndex: number;
  readonly value: string;
  readonly disabled: boolean;
  readonly onChange: (text: string) => void;
  readonly onTextSelect: (selection: TextSelectionPayload) => void;
  readonly onFocus?: () => void;
  readonly onCaretChange?: (offset: number) => void;
  readonly onBackspaceAtStart?: () => void;
  readonly onDeleteAtEnd?: () => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const focusedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || focusedRef.current) return;
    if (el.innerText !== value) {
      el.innerText = value;
    }
  }, [value]);

  const reportCaret = useCallback(
    (el: HTMLElement) => {
      onCaretChange?.(getCaretOffsetInContentEditable(el));
    },
    [onCaretChange],
  );

  return (
    <span
      ref={ref}
      data-text-segment-index={segmentIndex}
      contentEditable={!disabled}
      suppressContentEditableWarning
      className="whitespace-pre-wrap outline-none"
      onFocus={(event) => {
        focusedRef.current = true;
        onFocus?.();
        reportCaret(event.currentTarget);
      }}
      onBlur={(event) => {
        focusedRef.current = false;
        const related = event.relatedTarget as HTMLElement | null;
        if (related?.closest?.('[data-homophone-bar]')) return;
        onChange(event.currentTarget.innerText.replace(/\u00a0/g, ' '));
      }}
      onKeyUp={(event) => reportCaret(event.currentTarget)}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key !== 'Backspace' && event.key !== 'Delete') return;
        const selection = window.getSelection();
        if (!selection?.isCollapsed) return;
        const el = event.currentTarget;
        const text = el.innerText.replace(/\u00a0/g, ' ');
        const offset = getCaretOffsetInContentEditable(el);
        if (event.key === 'Backspace' && offset === 0 && onBackspaceAtStart) {
          event.preventDefault();
          onBackspaceAtStart();
        }
        if (event.key === 'Delete' && offset >= text.length && onDeleteAtEnd) {
          event.preventDefault();
          onDeleteAtEnd();
        }
      }}
      onMouseUp={(event) => {
        reportCaret(event.currentTarget);
        if (disabled) return;
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
        const range = selection.getRangeAt(0);
        if (!event.currentTarget.contains(range.commonAncestorContainer)) return;
        const selectedText = range.toString();
        if (!selectedText.trim()) return;
        const sourceText = event.currentTarget.innerText.replace(/\u00a0/g, ' ');
        const preRange = range.cloneRange();
        preRange.selectNodeContents(event.currentTarget);
        preRange.setEnd(range.startContainer, range.startOffset);
        const start = preRange.toString().length;
        const normalized = normalizeHomophoneSelection(sourceText, start, selectedText);
        if (!normalized) return;
        onTextSelect({
          start: normalized.start,
          end: normalized.end,
          text: normalized.word,
          sourceText,
          rect: range.getBoundingClientRect(),
        });
      }}
    />
  );
}

function BreakPauseToken({
  index,
  seconds,
  disabled,
  isEditing,
  onFocus,
  onBlurFocus,
  onCommit,
  onRemove,
}: {
  readonly index: number;
  readonly seconds: number;
  readonly disabled: boolean;
  readonly isEditing: boolean;
  readonly onFocus: () => void;
  readonly onBlurFocus: () => void;
  readonly onCommit: (seconds: number) => void;
  readonly onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(() => formatBreakSecondsLabel(seconds));

  useEffect(() => {
    if (!isEditing) {
      setDraft(formatBreakSecondsLabel(seconds));
    }
  }, [isEditing, seconds]);

  useEffect(() => {
    if (!isEditing || disabled) return;
    const input = inputRef.current;
    input?.focus();
    input?.select();
  }, [disabled, isEditing]);

  const commitDraft = useCallback(() => {
    const next = parseBreakSecondsInput(draft, seconds);
    onCommit(next);
    setDraft(formatBreakSecondsLabel(next));
  }, [draft, onCommit, seconds]);

  const currentSeconds = parseBreakSecondsInput(draft, seconds);
  const atMinSeconds = currentSeconds <= MIN_BREAK_SECONDS;
  const atMaxSeconds = currentSeconds >= MAX_BREAK_SECONDS;

  const stepSeconds = useCallback(
    (delta: number) => {
      const next = stepBreakSeconds(currentSeconds, delta);
      onCommit(next);
      setDraft(formatBreakSecondsLabel(next));
    },
    [currentSeconds, onCommit],
  );

  return (
    <span
      data-break-index={index}
      contentEditable={false}
      tabIndex={disabled ? -1 : 0}
      onFocus={onFocus}
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        if (next && event.currentTarget.contains(next)) return;
        if (isEditing) commitDraft();
        onBlurFocus();
      }}
      onKeyDown={(e) => {
        if (!isEditing && (e.key === 'Delete' || e.key === 'Backspace')) {
          e.preventDefault();
          onRemove();
        }
      }}
      className={cn(
        'mx-0.5 inline-flex h-[22px] translate-y-[1px] items-center gap-0.5 rounded-md border px-1 align-middle text-[11px] font-medium focus:outline-none',
        isEditing
          ? 'border-[#8B9DC3] bg-white shadow-[0_0_0_1px_rgba(139,157,195,0.28)] text-gray-700 dark:border-slate-500 dark:bg-gray-900 dark:text-gray-200'
          : 'border-sky-200/90 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-900/50',
      )}
      aria-label={`停顿 ${formatBreakSecondsLabel(seconds)} 秒，点击调整时长，Delete 键删除`}
      title="点击调整停顿时长（0.1–5 秒），可用加减按钮或输入，Delete 键删除"
    >
      <Clock className="size-3 shrink-0 text-gray-500 opacity-90 dark:text-gray-400" />
      {isEditing ? (
        <>
          <button
            type="button"
            disabled={disabled || atMinSeconds}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              stepSeconds(-BREAK_STEP_SECONDS);
            }}
            className="flex size-[18px] shrink-0 items-center justify-center rounded text-gray-500 hover:bg-sky-100/80 disabled:cursor-not-allowed disabled:opacity-35 dark:text-gray-400 dark:hover:bg-sky-900/50"
            aria-label="减少停顿时长"
          >
            <Minus className="size-3" strokeWidth={2.25} />
          </button>
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            disabled={disabled}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitDraft();
                inputRef.current?.blur();
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                stepSeconds(BREAK_STEP_SECONDS);
                return;
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                stepSeconds(-BREAK_STEP_SECONDS);
                return;
              }
              if (e.key !== 'Backspace' && e.key !== 'Delete') return;
              const input = e.currentTarget;
              const start = input.selectionStart ?? 0;
              const end = input.selectionEnd ?? 0;
              if (end > start) {
                if (start === 0 && end === input.value.length) {
                  e.preventDefault();
                  e.stopPropagation();
                  onRemove();
                }
                return;
              }
              if (e.key === 'Backspace' && start > 0) return;
              if (e.key === 'Delete' && start < input.value.length) return;
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }}
            className="h-[16px] w-[28px] rounded-[3px] border-0 bg-[#E6EDFF] px-0.5 text-center text-[11px] font-medium text-gray-800 outline-none tabular-nums dark:bg-sky-950/60 dark:text-sky-100"
            aria-label="停顿时长（秒）"
          />
          <span className="text-[11px] text-gray-500 dark:text-gray-400">s</span>
          <button
            type="button"
            disabled={disabled || atMaxSeconds}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              stepSeconds(BREAK_STEP_SECONDS);
            }}
            className="flex size-[18px] shrink-0 items-center justify-center rounded text-gray-500 hover:bg-sky-100/80 disabled:cursor-not-allowed disabled:opacity-35 dark:text-gray-400 dark:hover:bg-sky-900/50"
            aria-label="增加停顿时长"
          >
            <Plus className="size-3" strokeWidth={2.25} />
          </button>
        </>
      ) : (
        <span className="tabular-nums">{formatBreakSecondsLabel(seconds)}s</span>
      )}
    </span>
  );
}

export const SpeechScriptEditor = forwardRef<
  SpeechScriptEditorHandle,
  SpeechScriptEditorProps
>(function SpeechScriptEditor(
  { value, onChange, onBlur, disabled = false, placeholder, className },
  ref,
) {
  const { locale } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const homophoneBarRef = useRef<HTMLDivElement>(null);
  const lastTextSegmentIndexRef = useRef(0);
  const lastCaretOffsetRef = useRef(0);
  const [segments, setSegments] = useState(() => parseSpeechScript(value));
  const [homophonePopover, setHomophonePopover] = useState<HomophonePopoverState | null>(
    null,
  );
  const [homophonePopoverPos, setHomophonePopoverPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [focusedBreakIndex, setFocusedBreakIndex] = useState<number | null>(null);
  const [previewingHomophone, setPreviewingHomophone] = useState(false);

  const ttsProviderId = useSettingsStore((s) => s.ttsProviderId);
  const ttsVoice = useSettingsStore((s) => s.ttsVoice);
  const ttsSpeed = useSettingsStore((s) => s.ttsSpeed);
  const ttsProvidersConfig = useSettingsStore((s) => s.ttsProvidersConfig);

  useEffect(() => {
    const parsed = parseSpeechScript(value);
    setSegments(parsed);
    const lastText = findLastTextSegmentIndex(parsed);
    if (lastText >= 0) lastTextSegmentIndexRef.current = lastText;
  }, [value]);

  const emitChange = useCallback(
    (nextSegments: SpeechScriptSegment[]) => {
      setSegments(nextSegments);
      onChange(serializeSpeechScript(nextSegments));
    },
    [onChange],
  );

  const closeHomophonePopover = useCallback(() => {
    setHomophonePopover(null);
    setHomophonePopoverPos(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  useEffect(() => {
    if (!homophonePopover) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (homophoneBarRef.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.('[data-homophone-token]')) return;
      closeHomophonePopover();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [homophonePopover, closeHomophonePopover]);

  const updateTextSegment = useCallback(
    (index: number, text: string) => {
      const next = segments.map((segment, i) =>
        i === index && segment.type === 'text' ? { ...segment, value: text } : segment,
      );
      emitChange(next);
    },
    [emitChange, segments],
  );

  const openHomophoneForSelection = useCallback(
    (segmentIndex: number, selection: TextSelectionPayload) => {
      const word = selection.text.trim();
      if (!word) return;
      setFocusedBreakIndex(null);
      setHomophonePopover({
        segmentIndex,
        start: selection.start,
        end: selection.end,
        word: selection.text,
        speak: word,
        sourceText: selection.sourceText,
      });
      const container = containerRef.current;
      if (container) {
        const cRect = container.getBoundingClientRect();
        setHomophonePopoverPos({
          top: selection.rect.top - cRect.top - 6,
          left: selection.rect.left - cRect.left,
        });
      } else {
        setHomophonePopoverPos({ top: 0, left: 0 });
      }
    },
    [],
  );

  const removeHomophoneSegment = useCallback(
    (index: number) => {
      const segment = segments[index];
      if (segment.type !== 'homophone') return;
      const next = [...segments];
      next.splice(index, 1, { type: 'text', value: segment.display });
      emitChange(mergeAdjacentTextSegments(next));
      closeHomophonePopover();
    },
    [closeHomophonePopover, emitChange, segments],
  );

  const applyHomophone = useCallback(() => {
    if (!homophonePopover) return;
    const speak = homophonePopover.speak.trim();

    if (homophonePopover.homophoneSegmentIndex !== undefined) {
      const existing = segments[homophonePopover.homophoneSegmentIndex];
      if (existing.type !== 'homophone') return;
      const display = existing.display;
      // 清空读音或与原文相同 → 取消同音标记，恢复默认朗读
      if (!speak || speak === display.trim()) {
        removeHomophoneSegment(homophonePopover.homophoneSegmentIndex);
        return;
      }
      const next = segments.map((segment, i) =>
        i === homophonePopover.homophoneSegmentIndex && segment.type === 'homophone'
          ? { ...segment, speak }
          : segment,
      );
      emitChange(next);
      closeHomophonePopover();
      return;
    }

    if (!speak) {
      closeHomophonePopover();
      return;
    }

    const segment = segments[homophonePopover.segmentIndex];
    if (!segment || segment.type !== 'text') return;

    const sourceText = homophonePopover.sourceText || segment.value;
    const range = normalizeHomophoneSelection(
      sourceText,
      homophonePopover.start,
      homophonePopover.word,
    );
    if (!range) {
      closeHomophonePopover();
      return;
    }

    const display = range.word;
    if (speak === display.trim()) {
      closeHomophonePopover();
      return;
    }

    const before = sourceText.slice(0, range.start);
    const after = sourceText.slice(range.end);
    const rebuilt: SpeechScriptSegment[] = [];

    for (let i = 0; i < segments.length; i += 1) {
      if (i !== homophonePopover.segmentIndex) {
        rebuilt.push(segments[i]);
        continue;
      }
      if (before) rebuilt.push({ type: 'text', value: before });
      rebuilt.push({ type: 'homophone', display, speak });
      if (after) rebuilt.push({ type: 'text', value: after });
    }

    emitChange(rebuilt);
    closeHomophonePopover();
  }, [
    closeHomophonePopover,
    emitChange,
    homophonePopover,
    removeHomophoneSegment,
    segments,
  ]);

  const previewHomophone = useCallback(async () => {
    if (!homophonePopover) return;
    const speak = homophonePopover.speak.trim() || homophonePopover.word;
    if (!speak) return;

    setPreviewingHomophone(true);
    try {
      if (ttsProviderId === 'browser-native-tts') {
        const { promise } = playBrowserTTSPreview({ text: speak, voice: ttsVoice });
        await promise;
        return;
      }

      const providerConfig = ttsProvidersConfig[ttsProviderId];
      const providerOptions =
        ttsProviderId === 'voxcpm-tts'
          ? {
              ...(providerConfig?.providerOptions || {}),
              ...(await getVoxCPMProviderOptions(ttsVoice, {
                agentName: 'Teacher',
                role: 'teacher',
                locale,
              })),
            }
          : undefined;

      const res = await fetch('/api/generate/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: speak,
          audioId: 'homophone-preview',
          ttsProviderId,
          ttsModelId: providerConfig?.modelId,
          ttsVoice,
          ttsSpeed,
          ttsApiKey: providerConfig?.apiKey,
          ttsBaseUrl:
            providerConfig?.serverBaseUrl ||
            providerConfig?.baseUrl ||
            providerConfig?.customDefaultBaseUrl,
          ttsProviderOptions: providerOptions,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.base64) return;
      const audio = new Audio(`data:audio/${data.format || 'mp3'};base64,${data.base64}`);
      await audio.play();
    } catch {
      /* ignore */
    } finally {
      setPreviewingHomophone(false);
    }
  }, [
    homophonePopover,
    locale,
    ttsProviderId,
    ttsProvidersConfig,
    ttsSpeed,
    ttsVoice,
  ]);

  const updateBreakSegment = useCallback(
    (index: number, seconds: number) => {
      const next = segments.map((segment, i) =>
        i === index && segment.type === 'break'
          ? { ...segment, seconds: clampBreakSeconds(seconds) }
          : segment,
      );
      emitChange(next);
    },
    [emitChange, segments],
  );

  const removeBreakSegment = useCallback(
    (index: number) => {
      const next = mergeAdjacentTextSegments(segments.filter((_, i) => i !== index));
      emitChange(next);
      setFocusedBreakIndex(null);
    },
    [emitChange, segments],
  );

  const removeAdjacentBreak = useCallback(
    (textIndex: number, side: 'before' | 'after') => {
      const breakIndex = side === 'before' ? textIndex - 1 : textIndex + 1;
      if (breakIndex < 0 || breakIndex >= segments.length) return;
      if (segments[breakIndex]?.type !== 'break') return;
      removeBreakSegment(breakIndex);
    },
    [removeBreakSegment, segments],
  );

  const insertPause = useCallback(() => {
    let textIndex = lastTextSegmentIndexRef.current;
    let caretOffset = lastCaretOffsetRef.current;

    const container = containerRef.current;
    const active = document.activeElement;
    if (
      container &&
      active instanceof HTMLElement &&
      active.dataset.textSegmentIndex !== undefined
    ) {
      const parsedIndex = Number.parseInt(active.dataset.textSegmentIndex, 10);
      if (!Number.isNaN(parsedIndex)) {
        textIndex = parsedIndex;
        caretOffset = getCaretOffsetInContentEditable(active);
        lastTextSegmentIndexRef.current = textIndex;
        lastCaretOffsetRef.current = caretOffset;
      }
    }

    const insertBreakIntoText = (
      sourceSegments: SpeechScriptSegment[],
      atTextIndex: number,
      offset: number,
    ): { segments: SpeechScriptSegment[]; breakIndex: number } => {
      const segment = sourceSegments[atTextIndex];
      if (!segment || segment.type !== 'text') {
        const lastText = findLastTextSegmentIndex(sourceSegments);
        if (lastText < 0) {
          return {
            segments: [{ type: 'break', seconds: DEFAULT_BREAK_SECONDS }],
            breakIndex: 0,
          };
        }
        const lastSegment = sourceSegments[lastText];
        if (lastSegment.type !== 'text') {
          return {
            segments: [{ type: 'break', seconds: DEFAULT_BREAK_SECONDS }],
            breakIndex: 0,
          };
        }
        return insertBreakIntoText(sourceSegments, lastText, lastSegment.value.length);
      }

      const clampedOffset = Math.max(0, Math.min(offset, segment.value.length));
      const before = segment.value.slice(0, clampedOffset);
      const after = segment.value.slice(clampedOffset);
      const rebuilt: SpeechScriptSegment[] = [];
      let breakIndex = -1;

      for (let i = 0; i < sourceSegments.length; i += 1) {
        if (i !== atTextIndex) {
          rebuilt.push(sourceSegments[i]);
          continue;
        }
        if (before) rebuilt.push({ type: 'text', value: before });
        breakIndex = rebuilt.length;
        rebuilt.push({ type: 'break', seconds: DEFAULT_BREAK_SECONDS });
        if (after) rebuilt.push({ type: 'text', value: after });
      }

      return { segments: rebuilt, breakIndex };
    };

    const { segments: next, breakIndex } = insertBreakIntoText(
      segments,
      textIndex,
      caretOffset,
    );
    emitChange(next);
    setFocusedBreakIndex(breakIndex);
    closeHomophonePopover();
    queueMicrotask(() => {
      const input = containerRef.current?.querySelector<HTMLInputElement>(
        `[data-break-index="${breakIndex}"] input`,
      );
      input?.focus();
      input?.select();
    });
  }, [closeHomophonePopover, emitChange, segments]);

  useImperativeHandle(ref, () => ({ insertPause }), [insertPause]);

  const isEmpty = useMemo(
    () =>
      segments.length === 1 &&
      segments[0].type === 'text' &&
      segments[0].value.trim() === '',
    [segments],
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        'script-editor-root group/script relative min-h-[100px] flex-1 rounded-md px-1 pt-0',
        disabled && 'pointer-events-none opacity-60',
        className,
      )}
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node)) {
          onBlur?.();
        }
      }}
    >
      {homophonePopover && (
        <div
          ref={homophoneBarRef}
          data-homophone-bar
          className="absolute z-30 flex -translate-y-full items-center gap-2 rounded-lg border border-gray-200/90 bg-white px-2 py-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:border-gray-600 dark:bg-gray-900"
          style={
            homophonePopoverPos
              ? { top: homophonePopoverPos.top, left: homophonePopoverPos.left }
              : { top: 0, left: 8 }
          }
        >
          <input
            type="text"
            value={homophonePopover.speak}
            onChange={(e) =>
              setHomophonePopover({
                ...homophonePopover,
                speak: e.target.value,
              })
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyHomophone();
              }
              if (e.key === 'Escape') {
                closeHomophonePopover();
              }
            }}
            className="h-8 w-[7.5rem] shrink-0 rounded-md border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none focus:border-gray-300 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100"
            aria-label="同音读法"
            autoFocus
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              void previewHomophone();
            }}
            disabled={previewingHomophone}
            className="flex size-7 shrink-0 items-center justify-center text-gray-700 hover:text-gray-900 disabled:opacity-40 dark:text-gray-300"
            aria-label="试听读音"
          >
            {previewingHomophone ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4 fill-none" strokeWidth={1.75} />
            )}
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              applyHomophone();
            }}
            className="flex size-7 shrink-0 items-center justify-center text-gray-700 hover:text-gray-900 dark:text-gray-300"
            aria-label="确认同音替换"
          >
            <Check className="size-4" strokeWidth={2} />
          </button>
        </div>
      )}

      {isEmpty && !homophonePopover && (
        <p className="pointer-events-none absolute left-1 top-0 text-[18px] leading-[2.15] text-gray-400 dark:text-gray-500">
          {placeholder}
        </p>
      )}

      <div
        className="min-h-[100px] font-mono text-[18px] leading-[2.15] tracking-normal text-gray-950 outline-none dark:text-gray-100"
        role="textbox"
        aria-multiline="true"
      >
        {segments.map((segment, index) => {
          if (segment.type === 'text') {
            return (
              <EditableTextSpan
                key={`text-${index}-${segment.value.length}`}
                segmentIndex={index}
                value={segment.value}
                disabled={disabled}
                onChange={(text) => updateTextSegment(index, text)}
                onFocus={() => {
                  lastTextSegmentIndexRef.current = index;
                  setFocusedBreakIndex(null);
                }}
                onCaretChange={(offset) => {
                  lastTextSegmentIndexRef.current = index;
                  lastCaretOffsetRef.current = offset;
                }}
                onBackspaceAtStart={() => removeAdjacentBreak(index, 'before')}
                onDeleteAtEnd={() => removeAdjacentBreak(index, 'after')}
                onTextSelect={(selection) =>
                  openHomophoneForSelection(index, selection)
                }
              />
            );
          }

          if (segment.type === 'break') {
            return (
              <BreakPauseToken
                key={`break-${index}-${segment.seconds}`}
                index={index}
                seconds={segment.seconds}
                disabled={disabled}
                isEditing={focusedBreakIndex === index}
                onFocus={() => {
                  setFocusedBreakIndex(index);
                  closeHomophonePopover();
                }}
                onBlurFocus={() => {
                  setFocusedBreakIndex((current) => (current === index ? null : current));
                }}
                onCommit={(nextSeconds) => updateBreakSegment(index, nextSeconds)}
                onRemove={() => removeBreakSegment(index)}
              />
            );
          }

          return (
            <span
              key={`homophone-${index}`}
              data-homophone-token
              role="button"
              tabIndex={0}
              contentEditable={false}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setFocusedBreakIndex(null);
                window.getSelection()?.removeAllRanges();
                const el = e.currentTarget as HTMLElement;
                const container = containerRef.current;
                if (container) {
                  const cRect = container.getBoundingClientRect();
                  const rect = el.getBoundingClientRect();
                  setHomophonePopoverPos({
                    top: rect.top - cRect.top - 6,
                    left: rect.left - cRect.left,
                  });
                } else {
                  setHomophonePopoverPos({ top: 0, left: 8 });
                }
                setHomophonePopover({
                  segmentIndex: index,
                  homophoneSegmentIndex: index,
                  start: 0,
                  end: segment.display.length,
                  word: segment.display,
                  speak: segment.speak,
                  sourceText: segment.display,
                });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Delete' || e.key === 'Backspace') {
                  e.preventDefault();
                  removeHomophoneSegment(index);
                }
              }}
              className="cursor-pointer italic text-inherit"
              title={`读作：${segment.speak}（Delete 恢复默认读音）`}
            >
              {segment.display}
            </span>
          );
        })}
      </div>

    </div>
  );
});
