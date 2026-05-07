'use client';

import { Pause, Play } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
import { AgentAvatar } from './agent-avatar';
import { MobileBottomSheet } from './mobile-bottom-sheet';

interface MobileNarrationSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;

  readonly speakingAgent: AgentConfig | null;
  readonly teacherAgent: AgentConfig | null;
  readonly speechText: string | null;

  readonly currentSceneIndex: number;
  readonly scenesCount: number;

  readonly engineState: 'idle' | 'playing' | 'paused';
  readonly onPlayPause?: () => void;

  readonly bottomOffset?: number;
  readonly heightRatio?: number;
}

/**
 * MobileNarrationSheet
 *
 * Full-text transcript surface for the mobile classroom. Replaces the
 * one-line truncated speech in the dock with the complete narration the
 * teacher is reading on the current slide. Tapping the dock or the
 * "讲解" tab opens this sheet.
 *
 * The sheet only mirrors state — it doesn't own playback. All controls
 * forward to the same `onPlayPause` callback the dock uses, keeping a
 * single source of truth for the playback engine.
 */
export function MobileNarrationSheet({
  open,
  onClose,
  speakingAgent,
  teacherAgent,
  speechText,
  currentSceneIndex,
  scenesCount,
  engineState,
  onPlayPause,
  bottomOffset = 0,
  heightRatio = 0.7,
}: MobileNarrationSheetProps) {
  const { t } = useI18n();
  const agent = speakingAgent ?? teacherAgent;
  const isPlaying = engineState === 'playing';
  const hasText = !!speechText && speechText.trim().length > 0;

  return (
    <MobileBottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.narration.title')}
      bottomOffset={bottomOffset}
      heightRatio={heightRatio}
    >
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-900/20 dark:to-fuchsia-900/20 border-b border-purple-100/60 dark:border-purple-800/40">
        <AgentAvatar avatar={agent?.avatar} alt={agent?.name} size={42} highlighted={isPlaying} />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 truncate">
            {agent?.name ?? t('mobile.teacherDock.fallbackName')}
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
            {t('mobile.narration.pageOf', {
              current: currentSceneIndex + 1,
              total: Math.max(scenesCount, 1),
            })}
          </div>
        </div>
        {onPlayPause && (
          <button
            type="button"
            onClick={onPlayPause}
            aria-label={isPlaying ? t('mobile.teacherDock.pause') : t('mobile.teacherDock.play')}
            className={cn(
              'shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-full',
              'bg-gradient-to-br from-purple-500 via-violet-500 to-fuchsia-500 text-white',
              'shadow-md shadow-purple-500/30 hover:shadow-purple-500/50',
              'active:scale-95 transition-all',
            )}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        {hasText ? (
          <p className="text-[14px] leading-7 text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">
            {speechText}
          </p>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <span className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl mb-3">
              🎙️
            </span>
            <span className="text-[13px] text-gray-500 dark:text-gray-400">
              {t('mobile.narration.empty')}
            </span>
          </div>
        )}
      </div>
    </MobileBottomSheet>
  );
}
