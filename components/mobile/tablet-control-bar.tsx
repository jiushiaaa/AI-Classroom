'use client';

import {
  Pause,
  Play,
  ChevronLeft,
  ChevronRight,
  Repeat,
  PencilLine,
} from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
import { AgentAvatar } from './agent-avatar';
import { LectureAudioSeekBar, computeLectureSeekStripVisibility, type LectureAudioProgress } from '@/components/playback/lecture-audio-seek-bar';

interface TabletControlBarProps {
  readonly speakingAgent: AgentConfig | null;
  readonly teacherAgent: AgentConfig | null;
  readonly speechText: string | null;

  readonly currentSceneIndex: number;
  readonly scenesCount: number;

  readonly engineState: 'idle' | 'playing' | 'paused';
  readonly isLiveSession: boolean;

  readonly onPrevSlide: () => void;
  readonly onNextSlide: () => void;
  readonly onPlayPause: () => void;

  /** Tap on the transcript area opens the right-side narration log tab. */
  readonly onExpandTranscript?: () => void;

  // ─── New web-parity playback controls ───────────────────────────────
  // These were previously only available in the desktop CanvasToolbar.
  // The publisher asked us to expose them in the mobile / iPad preview
  // so a real demo classroom feels like the desktop player.
  readonly playbackSpeed?: number;
  readonly onCycleSpeed?: () => void;
  readonly autoPlayLecture?: boolean;
  readonly onToggleAutoPlay?: () => void;

  // v1.12.2 — Whiteboard toggle. Originally introduced in v1.12 as a
  // More-menu entry on `TabletTopBar`; v1.12.1 pulled fullscreen out
  // of that menu, leaving whiteboard as the only item; v1.12.2 follows
  // the publisher's directive (「白板 icon 不要藏在那三个点里面，透
  // 出来，可以放在自动播放旁边」) and surfaces whiteboard here as the
  // third button in the secondary cluster, immediately right of
  // auto-play. The More kebab is then dropped entirely.
  readonly whiteboardOpen?: boolean;
  readonly onToggleWhiteboard?: () => void;

  /**
   * Compact = phone-sized. Shrinks avatar / button / page chip and
   * collapses the transcript line so the bar fits in 390px width without
   * horizontal overflow. iPad sizes are used by default.
   */
  readonly compact?: boolean;
  /**
   * When true, omits the slide prev/next chevrons — the stage already
   * exposes page navigation (phone publisher request).
   */
  readonly hideSlidePager?: boolean;
  /**
   * When true, omits the center play/pause control — e.g. phone shows a
   * floating play button over the slide while paused (`hideCenterPlayback`
   * is typically coupled with `engineState === 'paused'` from the parent).
   */
  readonly hideCenterPlayback?: boolean;
  /**
   * v1.12.1 — Immersive (fullscreen) mode. When true the secondary
   * cluster (倍速 + 自动播放) and the trailing page chip are hidden so
   * the bar shows ONLY the teacher narration line + prev/play/next.
   * The publisher's original phrasing was "只显示幻灯片以及老师的讲解"
   * — this strips the bar down to that minimum.
   */
  readonly isImmersive?: boolean;
  readonly className?: string;
  readonly lectureAudioProgress?: LectureAudioProgress | null;
  readonly onLectureAudioSeek?: (ratio: number) => void;
  /** When true, hide lecture seek (live discussion / topic pending). Not tied to sidebar streaming. */
  readonly lectureSeekBlocked?: boolean;
  /** StreamBuffer reveal 0–1 — drives demo transcript bar when `isOpenmaicDemoClassroom`. */
  readonly speechProgress?: number | null;
  readonly isOpenmaicDemoClassroom?: boolean;
}

/**
 * TabletControlBar (also used by phone)
 *
 * Floating media-controller pinned to the bottom of the mobile / iPad
 * stage. v1.12 unified the phone and iPad bottom strips: the phone
 * dock + 4-segment tab bar is gone; both devices now share this bar
 * and an iPad-style top bar + side panel above it.
 *
 * Layout (left → right) — iPad / phone landscape:
 *   [56 avatar]  [name + status]                    [<]  [▷ 56]  [>]   [1x] [↻]   [page]
 *                [single-line transcript ▾]
 *
 * Compact (phone portrait), optional:
 *   hideSlidePager → no [<] [>]
 *   hideCenterPlayback (while paused) → center play moves to a floating
 *   overlay on the stage in PhoneClassroomView.
 */
function resolveStatus(
  isPlaying: boolean,
  isLiveSession: boolean,
  t: (key: string) => string,
): { label: string; className: string } {
  if (isPlaying) {
    return {
      label: t('mobile.teacherDock.statusSpeaking'),
      className:
        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    };
  }
  if (isLiveSession) {
    return {
      label: t('mobile.teacherDock.statusWaiting'),
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    };
  }
  return {
    label: t('mobile.teacherDock.statusReady'),
    className: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  };
}

interface SizeTokens {
  avatarSize: number;
  arrowBtn: string;
  arrowIcon: string;
  playBtn: string;
  playIcon: string;
  secondaryBtn: string;
  secondaryIcon: string;
  pageChipText: string;
  nameText: string;
  transcriptText: string;
  padding: string;
}

function resolveSizes(compact: boolean): SizeTokens {
  if (compact) {
    return {
      avatarSize: 40,
      arrowBtn: 'inline-flex items-center justify-center w-9 h-9 rounded-full transition-all',
      arrowIcon: 'w-4 h-4',
      playBtn: 'inline-flex items-center justify-center w-12 h-12 rounded-full',
      playIcon: 'w-5 h-5',
      secondaryBtn:
        'inline-flex items-center justify-center w-8 h-8 rounded-full transition-all text-[10px]',
      secondaryIcon: 'w-3.5 h-3.5',
      pageChipText: 'text-[10.5px]',
      nameText: 'text-[13px]',
      transcriptText: 'text-[11.5px]',
      padding: 'gap-2 px-3 py-2',
    };
  }
  return {
    avatarSize: 48,
    arrowBtn: 'inline-flex items-center justify-center w-11 h-11 rounded-full transition-all',
    arrowIcon: 'w-5 h-5',
    playBtn: 'inline-flex items-center justify-center w-14 h-14 rounded-full',
    playIcon: 'w-6 h-6',
    secondaryBtn:
      'inline-flex items-center justify-center w-9 h-9 rounded-full transition-all',
    secondaryIcon: 'w-4 h-4',
    pageChipText: 'text-[11.5px]',
    nameText: 'text-[14.5px]',
    transcriptText: 'text-[12.5px]',
    padding: 'gap-4 px-5 py-3',
  };
}

function PrimaryPlaybackCluster({
  compact,
  showPagerButtons,
  showCenterPlayback,
  showPrimaryCluster,
  hasPrev,
  hasNext,
  isPlaying,
  arrowBtn,
  arrowIcon,
  playBtn,
  playIcon,
  onPrevSlide,
  onNextSlide,
  onPlayPause,
  t,
}: {
  readonly compact: boolean;
  readonly showPagerButtons: boolean;
  readonly showCenterPlayback: boolean;
  readonly showPrimaryCluster: boolean;
  readonly hasPrev: boolean;
  readonly hasNext: boolean;
  readonly isPlaying: boolean;
  readonly arrowBtn: string;
  readonly arrowIcon: string;
  readonly playBtn: string;
  readonly playIcon: string;
  readonly onPrevSlide: () => void;
  readonly onNextSlide: () => void;
  readonly onPlayPause: () => void;
  readonly t: (key: string) => string;
}) {
  if (!showPrimaryCluster) return null;

  return (
    <div className={cn('shrink-0 flex items-center', compact ? 'gap-1' : 'gap-1.5')}>
      {showPagerButtons && (
        <button
          type="button"
          onClick={onPrevSlide}
          disabled={!hasPrev}
          aria-label={t('mobile.pager.prev')}
          title={t('mobile.pager.prev')}
          className={cn(
            arrowBtn,
            'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800',
            hasPrev
              ? 'hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95'
              : 'opacity-40 cursor-not-allowed',
          )}
        >
          <ChevronLeft className={arrowIcon} />
        </button>
      )}

      {showCenterPlayback && (
        <button
          type="button"
          onClick={onPlayPause}
          aria-label={isPlaying ? t('mobile.teacherDock.pause') : t('mobile.teacherDock.play')}
          title={isPlaying ? t('mobile.teacherDock.pause') : t('mobile.teacherDock.play')}
          className={cn(
            playBtn,
            'bg-gradient-to-br from-purple-500 via-violet-500 to-fuchsia-500 text-white',
            'shadow-md shadow-purple-500/30 hover:shadow-purple-500/50 active:scale-95 transition-all',
          )}
        >
          {isPlaying ? <Pause className={playIcon} /> : <Play className={cn(playIcon, 'ml-0.5')} />}
        </button>
      )}

      {showPagerButtons && (
        <button
          type="button"
          onClick={onNextSlide}
          disabled={!hasNext}
          aria-label={t('mobile.pager.next')}
          title={t('mobile.pager.next')}
          className={cn(
            arrowBtn,
            'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800',
            hasNext
              ? 'hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95'
              : 'opacity-40 cursor-not-allowed',
          )}
        >
          <ChevronRight className={arrowIcon} />
        </button>
      )}
    </div>
  );
}

export function TabletControlBar({
  speakingAgent,
  teacherAgent,
  speechText,
  currentSceneIndex,
  scenesCount,
  engineState,
  isLiveSession,
  onPrevSlide,
  onNextSlide,
  onPlayPause,
  onExpandTranscript,
  playbackSpeed = 1,
  onCycleSpeed,
  autoPlayLecture = false,
  onToggleAutoPlay,
  whiteboardOpen = false,
  onToggleWhiteboard,
  compact = false,
  hideSlidePager = false,
  hideCenterPlayback = false,
  isImmersive = false,
  className,
  lectureAudioProgress,
  onLectureAudioSeek,
  lectureSeekBlocked = false,
  speechProgress,
  isOpenmaicDemoClassroom = false,
}: TabletControlBarProps) {
  const { t } = useI18n();
  const agent = speakingAgent ?? teacherAgent;
  const pageOneBased = currentSceneIndex >= 0 ? currentSceneIndex + 1 : 1;
  const fallbackHint = t('mobile.teacherDock.pageHint', { n: pageOneBased });
  const displayText = speechText && speechText.trim().length > 0 ? speechText : fallbackHint;
  const isPlaying = engineState === 'playing';

  const hasPrev = currentSceneIndex > 0;
  const hasNext = currentSceneIndex < scenesCount - 1;

  const status = resolveStatus(isPlaying, isLiveSession, t);
  const {
    avatarSize,
    arrowBtn,
    arrowIcon,
    playBtn,
    playIcon,
    secondaryBtn,
    secondaryIcon,
    pageChipText,
    nameText,
    transcriptText,
    padding,
  } = resolveSizes(compact);

  // Pre-compute visibility booleans up front. Apart from being clearer
  // for the JSX, this also keeps the render function below the
  // SonarQube cognitive-complexity ceiling — chained `&&` checks count
  // toward complexity, so collapsing them to plain bools moves the
  // expressions out of the render expression tree.
  const showTranscriptLine = !compact;
  const showSecondaryCluster =
    !isImmersive &&
    (Boolean(onCycleSpeed) ||
      Boolean(onToggleAutoPlay) ||
      Boolean(onToggleWhiteboard));
  const showPageChip = !isImmersive && scenesCount > 0;

  const showPagerButtons = !hideSlidePager;
  const showCenterPlayback = !hideCenterPlayback;
  const showPrimaryCluster = showPagerButtons || showCenterPlayback;

  const { showHtmlAudioSeek, showDemoTranscriptProgress } = computeLectureSeekStripVisibility({
    lectureAudioProgress,
    onLectureAudioSeek,
    lectureSeekBlocked,
    isOpenmaicDemoClassroom,
    engineState,
    speechProgress,
  });
  const showSeekStrip = showHtmlAudioSeek || showDemoTranscriptProgress;

  return (
    <div
      className={cn(
        'shrink-0 w-full bg-white/90 dark:bg-gray-950/90 backdrop-blur-xl',
        'border-t border-gray-200 dark:border-gray-800',
        'flex flex-col',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {showSeekStrip && (
        <div className="px-2.5 pt-1.5 pb-1 w-full border-b border-gray-200/70 dark:border-gray-800/70 shrink-0">
          <LectureAudioSeekBar
            progress={
              showHtmlAudioSeek
                ? lectureAudioProgress!
                : {
                    currentMs: (speechProgress ?? 0) * 60000,
                    durationMs: 60000,
                  }
            }
            onSeek={onLectureAudioSeek!}
            smoothFollow={showDemoTranscriptProgress}
            aria-label={
              showHtmlAudioSeek
                ? t('roundtable.lectureSeekBar')
                : t('roundtable.demoRevealProgress')
            }
          />
        </div>
      )}
      <div className={cn('flex items-center w-full', padding)}>
      <AgentAvatar
        avatar={agent?.avatar}
        alt={agent?.name}
        size={avatarSize}
        highlighted={isPlaying || isLiveSession}
      />

      <button
        type="button"
        onClick={onExpandTranscript}
        className="flex-1 min-w-0 flex flex-col items-start text-left leading-tight"
        aria-label={t('mobile.teacherDock.expand')}
      >
        <span className="flex items-center gap-2 max-w-full">
          <span
            className={cn(
              'font-semibold text-gray-800 dark:text-gray-100 truncate',
              nameText,
            )}
          >
            {agent?.name ?? t('mobile.teacherDock.fallbackName')}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold shrink-0',
              status.className,
            )}
          >
            {isPlaying && (
              <span className="w-1 h-1 rounded-full bg-emerald-500 dark:bg-emerald-300 animate-pulse" />
            )}
            <span>{status.label}</span>
          </span>
        </span>
        {/* Transcript line — hidden in compact (phone) mode to leave
            room for the inline secondary controls without overflow. */}
        {showTranscriptLine && (
          <span
            className={cn(
              'block w-full max-w-full mt-0.5 text-gray-500 dark:text-gray-400 truncate',
              transcriptText,
            )}
          >
            {displayText}
          </span>
        )}
      </button>

      {/* ── Primary playback cluster ── */}
      <PrimaryPlaybackCluster
        compact={compact}
        showPagerButtons={showPagerButtons}
        showCenterPlayback={showCenterPlayback}
        showPrimaryCluster={showPrimaryCluster}
        hasPrev={hasPrev}
        hasNext={hasNext}
        isPlaying={isPlaying}
        arrowBtn={arrowBtn}
        arrowIcon={arrowIcon}
        playBtn={playBtn}
        playIcon={playIcon}
        onPrevSlide={onPrevSlide}
        onNextSlide={onNextSlide}
        onPlayPause={onPlayPause}
        t={t}
      />

      {/* ── Secondary cluster: speed + auto-play ──
          Hidden in immersive mode so the bar collapses to "只显示
          幻灯片以及老师的讲解" — narration + 3 nav buttons. */}
      {showSecondaryCluster && (
        <div
          className={cn(
            'shrink-0 flex items-center gap-1 ml-1.5 pl-2',
            'border-l border-gray-200/70 dark:border-gray-800/70',
          )}
        >
          {onCycleSpeed && (
            <button
              type="button"
              onClick={onCycleSpeed}
              aria-label={t('roundtable.speed')}
              title={t('roundtable.speed')}
              className={cn(
                secondaryBtn,
                'font-semibold tabular-nums',
                playbackSpeed === 1
                  ? 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  : 'text-violet-600 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/30',
              )}
            >
              {playbackSpeed === 1.5 ? '1.5x' : `${playbackSpeed}x`}
            </button>
          )}
          {onToggleAutoPlay && (
            <button
              type="button"
              onClick={onToggleAutoPlay}
              aria-label={autoPlayLecture ? t('roundtable.autoPlayOff') : t('roundtable.autoPlay')}
              title={autoPlayLecture ? t('roundtable.autoPlayOff') : t('roundtable.autoPlay')}
              aria-pressed={autoPlayLecture}
              className={cn(
                secondaryBtn,
                autoPlayLecture
                  ? 'text-violet-600 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/30'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
              )}
            >
              <Repeat className={secondaryIcon} />
            </button>
          )}
          {/* Whiteboard toggle (v1.12.2) — sits immediately right of
              the auto-play button per the publisher's directive
              「白板 icon 不要藏在那三个点里面，透出来，可以放在自动
              播放旁边」. Active state mirrors auto-play's violet
              softener so the secondary cluster reads as one coherent
              row of three peer toggles (speed / autoplay / whiteboard). */}
          {onToggleWhiteboard && (
            <button
              type="button"
              onClick={onToggleWhiteboard}
              aria-label={
                whiteboardOpen
                  ? t('mobile.topBar.whiteboardClose')
                  : t('mobile.topBar.whiteboard')
              }
              title={
                whiteboardOpen
                  ? t('mobile.topBar.whiteboardClose')
                  : t('mobile.topBar.whiteboard')
              }
              aria-pressed={whiteboardOpen}
              className={cn(
                secondaryBtn,
                whiteboardOpen
                  ? 'text-violet-600 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/30'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
              )}
            >
              <PencilLine className={secondaryIcon} />
            </button>
          )}
        </div>
      )}

      {/* Page indicator chip — hidden in immersive mode for the same
          reason as the secondary cluster. */}
      {showPageChip && (
        <span
          className={cn(
            'shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 font-semibold tabular-nums text-gray-600 dark:text-gray-300 ml-1.5',
            pageChipText,
          )}
        >
          <span>{pageOneBased}</span>
          <span className="text-gray-400 dark:text-gray-500">/</span>
          <span>{scenesCount}</span>
        </span>
      )}
      </div>
    </div>
  );
}
