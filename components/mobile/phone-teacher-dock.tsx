'use client';

import { Pause, Play, ChevronUp } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
import { AgentAvatar } from './agent-avatar';

interface PhoneTeacherDockProps {
  readonly speakingAgent: AgentConfig | null;
  readonly teacherAgent: AgentConfig | null;
  readonly speechText: string | null;
  readonly currentSceneIndex: number;
  readonly scenesCount: number;
  readonly engineState: 'idle' | 'playing' | 'paused';
  readonly isLiveSession: boolean;
  readonly onPlayPause?: () => void;
  /** Tap on the dock body opens the full narration sheet. */
  readonly onExpandTranscript?: () => void;
  readonly className?: string;
}

/**
 * PhoneTeacherDock
 *
 * A media-player-style dock that lives between the slide stage and the
 * bottom tabs. Replaces the previous narrow purple gradient bar with a
 * white surface, larger touch targets (44px play button, 40px avatar),
 * and a tap-to-expand affordance that pops the full narration sheet.
 *
 * Visible content (left → right):
 *   [40px avatar]  [name + status badge]
 *                  [single-line speech preview ▾]    [page chip]  [44px ▶]
 */
export function PhoneTeacherDock({
  speakingAgent,
  teacherAgent,
  speechText,
  currentSceneIndex,
  scenesCount,
  engineState,
  isLiveSession,
  onPlayPause,
  onExpandTranscript,
  className,
}: PhoneTeacherDockProps) {
  const { t } = useI18n();
  const agent = speakingAgent ?? teacherAgent;
  const pageOneBased = currentSceneIndex >= 0 ? currentSceneIndex + 1 : 1;

  const fallbackHint = t('mobile.teacherDock.pageHint', { n: pageOneBased });
  const displayText = speechText && speechText.trim().length > 0 ? speechText : fallbackHint;

  const isPlaying = engineState === 'playing';
  let status: string;
  let statusClass: string;
  if (isPlaying) {
    status = t('mobile.teacherDock.statusSpeaking');
    statusClass =
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  } else if (isLiveSession) {
    status = t('mobile.teacherDock.statusWaiting');
    statusClass =
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  } else {
    status = t('mobile.teacherDock.statusReady');
    statusClass = 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
  }

  return (
    <div
      className={cn(
        'shrink-0 flex items-center gap-3 px-3 py-2 bg-white dark:bg-gray-900',
        'border-t border-gray-100 dark:border-gray-800',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <AgentAvatar
        avatar={agent?.avatar}
        alt={agent?.name}
        size={40}
        highlighted={isPlaying || isLiveSession}
      />

      <button
        type="button"
        onClick={onExpandTranscript}
        className="flex-1 min-w-0 flex flex-col items-start text-left leading-tight"
        aria-label={t('mobile.teacherDock.expand')}
      >
        <span className="flex items-center gap-1.5 max-w-full">
          <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 truncate">
            {agent?.name ?? t('mobile.teacherDock.fallbackName')}
          </span>
          <span
            className={cn(
              'shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold',
              statusClass,
            )}
          >
            {isPlaying && (
              <span className="w-1 h-1 rounded-full bg-emerald-500 dark:bg-emerald-300 animate-pulse" />
            )}
            <span>{status}</span>
          </span>
        </span>
        <span className="flex items-center gap-1 max-w-full text-[11.5px] text-gray-500 dark:text-gray-400">
          <span className="truncate" title={displayText}>
            {displayText}
          </span>
          {onExpandTranscript && (
            <ChevronUp className="shrink-0 w-3 h-3 text-gray-400 dark:text-gray-500" />
          )}
        </span>
      </button>

      {scenesCount > 0 && (
        <span className="shrink-0 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[10.5px] font-semibold tabular-nums text-gray-600 dark:text-gray-300">
          <span>{pageOneBased}</span>
          <span className="text-gray-400 dark:text-gray-500">/</span>
          <span>{scenesCount}</span>
        </span>
      )}

      {onPlayPause && (
        <button
          type="button"
          onClick={onPlayPause}
          aria-label={isPlaying ? t('mobile.teacherDock.pause') : t('mobile.teacherDock.play')}
          title={isPlaying ? t('mobile.teacherDock.pause') : t('mobile.teacherDock.play')}
          className={cn(
            'shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-full',
            'bg-gradient-to-br from-purple-500 via-violet-500 to-fuchsia-500 text-white',
            'shadow-md shadow-purple-500/25 hover:shadow-purple-500/40',
            'active:scale-95 transition-all',
          )}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
      )}
    </div>
  );
}
