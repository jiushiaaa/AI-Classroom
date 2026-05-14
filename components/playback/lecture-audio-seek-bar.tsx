'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/** Demo / transcript bar: each frame move this fraction of the remaining gap (smaller = slower). */
const DEMO_SMOOTH_ALPHA = 0.014;

export interface LectureAudioProgress {
  readonly currentMs: number;
  readonly durationMs: number;
}

/**
 * Same rules as desktop `Roundtable` for HTML-audio seek vs demo transcript bar.
 */
export function computeLectureSeekStripVisibility(args: {
  readonly lectureAudioProgress?: LectureAudioProgress | null;
  readonly onLectureAudioSeek?: (ratio: number) => void;
  readonly lectureSeekBlocked?: boolean;
  readonly isOpenmaicDemoClassroom?: boolean;
  readonly engineState: 'idle' | 'playing' | 'paused';
  readonly speechProgress?: number | null;
}): { readonly showHtmlAudioSeek: boolean; readonly showDemoTranscriptProgress: boolean } {
  const blocked = Boolean(args.lectureSeekBlocked);
  const hasHandler = Boolean(args.onLectureAudioSeek);
  const ap = args.lectureAudioProgress;
  const showHtmlAudioSeek =
    hasHandler && !blocked && Boolean(ap && ap.durationMs > 0);
  const engineOk = args.engineState === 'playing' || args.engineState === 'paused';
  const showDemoTranscriptProgress =
    Boolean(args.isOpenmaicDemoClassroom) &&
    !blocked &&
    engineOk &&
    args.speechProgress != null &&
    hasHandler &&
    !showHtmlAudioSeek;
  return { showHtmlAudioSeek, showDemoTranscriptProgress };
}

function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface LectureAudioSeekBarProps {
  readonly progress: LectureAudioProgress;
  readonly onSeek: (ratio: number) => void;
  readonly disabled?: boolean;
  /**
   * When true, the thumb eases toward live progress (e.g. demo transcript ticks).
   * When false, the thumb tracks `progress` directly (HTML5 narration).
   */
  readonly smoothFollow?: boolean;
  readonly className?: string;
  readonly 'aria-label'?: string;
}

export function LectureAudioSeekBar({
  progress,
  onSeek,
  disabled = false,
  smoothFollow = false,
  className,
  'aria-label': ariaLabel,
}: LectureAudioSeekBarProps) {
  const { currentMs, durationMs } = progress;
  const safeDur = durationMs > 0 ? durationMs : 1;
  const liveRatio = Math.min(1, Math.max(0, currentMs / safeDur));
  const [dragging, setDragging] = useState(false);
  const [dragRatio, setDragRatio] = useState(liveRatio);
  const [smoothedRatio, setSmoothedRatio] = useState(liveRatio);
  const liveRatioRef = useRef(liveRatio);
  liveRatioRef.current = liveRatio;
  const lastScrubRatioRef = useRef(liveRatio);

  useEffect(() => {
    if (!smoothFollow) {
      setSmoothedRatio(liveRatioRef.current);
      return;
    }
    let raf = 0;
    const tick = () => {
      setSmoothedRatio((prev) => {
        const target = liveRatioRef.current;
        const next = prev + (target - prev) * DEMO_SMOOTH_ALPHA;
        return Math.abs(target - next) < 0.0008 ? target : next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [smoothFollow]);

  const easedRatio = smoothFollow ? smoothedRatio : liveRatio;
  const displayRatio = dragging ? dragRatio : easedRatio;
  let displayCurrentMs: number;
  if (dragging) {
    displayCurrentMs = Math.round(dragRatio * safeDur);
  } else if (smoothFollow) {
    displayCurrentMs = Math.round(smoothedRatio * safeDur);
  } else {
    displayCurrentMs = currentMs;
  }

  const handlePointerDown = useCallback(() => {
    const start = smoothFollow ? smoothedRatio : liveRatio;
    lastScrubRatioRef.current = start;
    setDragging(true);
    setDragRatio(start);
  }, [liveRatio, smoothFollow, smoothedRatio]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
    if (smoothFollow) {
      setSmoothedRatio(lastScrubRatioRef.current);
    }
  }, [smoothFollow]);

  const applySeekFromEvent = useCallback(
    (value: string) => {
      if (disabled || durationMs <= 0) return;
      const v = Number.parseFloat(value);
      if (!Number.isFinite(v)) return;
      lastScrubRatioRef.current = v;
      setDragRatio(v);
      onSeek(v);
    },
    [disabled, durationMs, onSeek],
  );

  const scrubEnabled = !disabled && durationMs > 0;

  return (
    <div className={cn('flex items-center gap-2 w-full min-w-0', className)}>
      <span className="text-[10px] tabular-nums text-gray-400 dark:text-gray-500 shrink-0 w-9 text-right font-medium select-none">
        {formatClock(displayCurrentMs)}
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.001}
        disabled={!scrubEnabled}
        value={Number.isFinite(displayRatio) ? displayRatio : 0}
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(displayRatio * 100)}
        onPointerDown={scrubEnabled ? handlePointerDown : undefined}
        onPointerUp={scrubEnabled ? handlePointerUp : undefined}
        onPointerCancel={scrubEnabled ? handlePointerUp : undefined}
        onInput={(e) => {
          if (!scrubEnabled) return;
          applySeekFromEvent((e.target as HTMLInputElement).value);
        }}
        onChange={(e) => {
          if (!scrubEnabled) return;
          applySeekFromEvent(e.target.value);
        }}
        className={cn(
          'flex-1 min-w-0 h-1.5 rounded-full appearance-none',
          'bg-gray-200/90 dark:bg-gray-700/90',
          scrubEnabled ? 'cursor-pointer' : 'cursor-default',
          '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-3',
          '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500',
          '[&::-webkit-slider-thumb]:dark:bg-violet-400 [&::-webkit-slider-thumb]:shadow-sm',
          '[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white dark:[&::-webkit-slider-thumb]:border-gray-900',
          '[&::-webkit-slider-thumb]:-mt-[3px] [&::-webkit-slider-thumb]:cursor-grab active:[&::-webkit-slider-thumb]:cursor-grabbing',
          '[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-violet-500',
          '[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white dark:[&::-moz-range-thumb]:border-gray-900',
          'disabled:opacity-40 disabled:cursor-not-allowed',
        )}
      />
      <span className="text-[10px] tabular-nums text-gray-400 dark:text-gray-500 shrink-0 w-9 font-medium select-none">
        {formatClock(durationMs)}
      </span>
    </div>
  );
}
