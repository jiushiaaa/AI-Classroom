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
import { Check, Clock, Loader2, Play } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { playBrowserTTSPreview } from '@/lib/audio/browser-tts-preview';
import { getVoxCPMProviderOptions } from '@/lib/audio/voxcpm-voices';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useSettingsStore } from '@/lib/store/settings';
import {
  mergeAdjacentTextSegments,
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
  /** Existing homophone segment being edited (no text splice). */
  homophoneSegmentIndex?: number;
}

const DEFAULT_BREAK_SECONDS = 0.2;

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
  rect: DOMRect;
}

function EditableTextSpan({
  value,
  disabled,
  onChange,
  onTextSelect,
  onFocus,
}: {
  readonly value: string;
  readonly disabled: boolean;
  readonly onChange: (text: string) => void;
  readonly onTextSelect: (selection: TextSelectionPayload) => void;
  readonly onFocus?: () => void;
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

  return (
    <span
      ref={ref}
      contentEditable={!disabled}
      suppressContentEditableWarning
      className="whitespace-pre-wrap outline-none"
      onFocus={() => {
        focusedRef.current = true;
        onFocus?.();
      }}
      onBlur={(event) => {
        focusedRef.current = false;
        onChange(event.currentTarget.innerText.replace(/\u00a0/g, ' '));
      }}
      onMouseUp={(event) => {
        if (disabled) return;
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
        const range = selection.getRangeAt(0);
        if (!event.currentTarget.contains(range.commonAncestorContainer)) return;
        const selectedText = range.toString();
        if (!selectedText.trim()) return;
        const preRange = range.cloneRange();
        preRange.selectNodeContents(event.currentTarget);
        preRange.setEnd(range.startContainer, range.startOffset);
        const start = preRange.toString().length;
        onTextSelect({
          start,
          end: start + selectedText.length,
          text: selectedText,
          rect: range.getBoundingClientRect(),
        });
      }}
    />
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
  const [segments, setSegments] = useState(() => parseSpeechScript(value));
  const [homophonePopover, setHomophonePopover] = useState<HomophonePopoverState | null>(
    null,
  );
  const [homophonePopoverPos, setHomophonePopoverPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [breakEditIndex, setBreakEditIndex] = useState<number | null>(null);
  const [focusedBreakIndex, setFocusedBreakIndex] = useState<number | null>(null);
  const [breakDraftSeconds, setBreakDraftSeconds] = useState(DEFAULT_BREAK_SECONDS);
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
      setBreakEditIndex(null);
      setHomophonePopover({
        segmentIndex,
        start: selection.start,
        end: selection.end,
        word: selection.text,
        speak: word,
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

    const display = homophonePopover.word;
    if (speak === display.trim()) {
      closeHomophonePopover();
      return;
    }

    const segment = segments[homophonePopover.segmentIndex];
    if (!segment || segment.type !== 'text') return;

    const before = segment.value.slice(0, homophonePopover.start);
    const after = segment.value.slice(homophonePopover.end);
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

  const applyBreakSeconds = useCallback(() => {
    if (breakEditIndex === null) return;
    const next = segments.map((segment, i) =>
      i === breakEditIndex && segment.type === 'break'
        ? {
            ...segment,
            seconds: Math.max(0.1, Math.min(3, breakDraftSeconds)),
          }
        : segment,
    );
    emitChange(next);
    setBreakEditIndex(null);
  }, [breakDraftSeconds, breakEditIndex, emitChange, segments]);

  const removeBreakSegment = useCallback(
    (index: number) => {
      const next = segments.filter((_, i) => i !== index);
      emitChange(next.length > 0 ? next : [{ type: 'text', value: '' }]);
      setBreakEditIndex(null);
      setFocusedBreakIndex(null);
    },
    [emitChange, segments],
  );

  const insertPause = useCallback(() => {
    const anchor = Math.min(
      Math.max(0, lastTextSegmentIndexRef.current),
      Math.max(0, segments.length - 1),
    );
    let insertAt = segments.length;
    if (segments[anchor]?.type === 'text') {
      insertAt = anchor + 1;
    } else {
      const lastText = findLastTextSegmentIndex(segments);
      insertAt = lastText >= 0 ? lastText + 1 : 0;
    }
    const next = [...segments];
    next.splice(insertAt, 0, { type: 'break', seconds: DEFAULT_BREAK_SECONDS });
    emitChange(next);
    setBreakEditIndex(insertAt);
    setBreakDraftSeconds(DEFAULT_BREAK_SECONDS);
    closeHomophonePopover();
    queueMicrotask(() => {
      const el = containerRef.current?.querySelector<HTMLButtonElement>(
        `[data-break-index="${insertAt}"]`,
      );
      el?.focus();
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
                value={segment.value}
                disabled={disabled}
                onChange={(text) => updateTextSegment(index, text)}
                onFocus={() => {
                  lastTextSegmentIndexRef.current = index;
                  setFocusedBreakIndex(null);
                }}
                onTextSelect={(selection) =>
                  openHomophoneForSelection(index, selection)
                }
              />
            );
          }

          if (segment.type === 'break') {
            return (
              <Popover
                key={`break-${index}`}
                open={breakEditIndex === index}
                onOpenChange={(open) => {
                  if (!open) setBreakEditIndex(null);
                  else {
                    setBreakEditIndex(index);
                    setBreakDraftSeconds(segment.seconds);
                    closeHomophonePopover();
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    data-break-index={index}
                    contentEditable={false}
                    tabIndex={0}
                    onClick={(e) => e.preventDefault()}
                    onFocus={() => {
                      setFocusedBreakIndex(index);
                      closeHomophonePopover();
                    }}
                    onBlur={() => {
                      setFocusedBreakIndex((current) =>
                        current === index ? null : current,
                      );
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Delete' || e.key === 'Backspace') {
                        e.preventDefault();
                        removeBreakSegment(index);
                      }
                    }}
                    className={cn(
                      'mx-0.5 inline-flex h-[22px] translate-y-[1px] items-center gap-0.5 rounded-md border border-sky-200/90 bg-sky-50 px-1.5 text-[11px] font-medium text-sky-700 align-middle hover:bg-sky-100 focus:outline-none dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-900/50',
                      focusedBreakIndex === index &&
                        'ring-2 ring-sky-400/80 ring-offset-1 dark:ring-sky-500/70',
                    )}
                    aria-label={`停顿 ${segment.seconds} 秒，按 Delete 键删除`}
                    title="点击调整时长，Delete 键删除"
                  >
                    <Clock className="size-3 shrink-0 opacity-80" />
                    {segment.seconds}s
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="top"
                  align="center"
                  className="w-56 rounded-xl p-3"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                  onKeyDown={(e) => {
                    if (e.key === 'Delete' || e.key === 'Backspace') {
                      e.preventDefault();
                      removeBreakSegment(index);
                    }
                  }}
                >
                  <p className="mb-2 text-xs text-muted-foreground">停顿时长</p>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[breakDraftSeconds]}
                      min={0.1}
                      max={3}
                      step={0.1}
                      onValueChange={(v) => setBreakDraftSeconds(v[0] ?? DEFAULT_BREAK_SECONDS)}
                    />
                    <span className="w-10 text-right text-sm tabular-nums">
                      {breakDraftSeconds.toFixed(1)}s
                    </span>
                  </div>
                  <button
                    type="button"
                    className="mt-2 w-full rounded-md bg-violet-600 px-2 py-1 text-xs text-white"
                    onClick={applyBreakSeconds}
                  >
                    确定
                  </button>
                </PopoverContent>
              </Popover>
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
                setBreakEditIndex(null);
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
