'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  PencilLine,
  Pencil,
  LayoutList,
  MessageSquare,
  Volume1,
  Volume2,
  VolumeX,
  Repeat,
  Maximize2,
  Minimize2,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStageStore, useEditModeStore } from '@/lib/store';
import { useI18n } from '@/lib/hooks/use-i18n';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { isManuallyEditableSceneType } from '@/lib/types/stage';

export interface CanvasToolbarProps {
  readonly currentSceneIndex: number;
  readonly scenesCount: number;
  readonly engineState: 'idle' | 'playing' | 'paused';
  readonly isLiveSession?: boolean;
  readonly whiteboardOpen: boolean;
  readonly sidebarCollapsed?: boolean;
  readonly chatCollapsed?: boolean;
  readonly onToggleSidebar?: () => void;
  readonly onToggleChat?: () => void;
  readonly onPrevSlide: () => void;
  readonly onNextSlide: () => void;
  readonly onPlayPause: () => void;
  readonly onWhiteboardClose: () => void;
  readonly showStopDiscussion?: boolean;
  readonly onStopDiscussion?: () => void;
  readonly isPresenting?: boolean;
  readonly onTogglePresentation?: () => void;
  readonly className?: string;
  // Audio/playback controls
  readonly ttsEnabled?: boolean;
  readonly ttsMuted?: boolean;
  readonly ttsVolume?: number;
  readonly onToggleMute?: () => void;
  readonly onVolumeChange?: (volume: number) => void;
  readonly autoPlayLecture?: boolean;
  readonly onToggleAutoPlay?: () => void;
  readonly playbackSpeed?: number;
  readonly onCycleSpeed?: () => void;
  /**
   * Hide all publisher-only actions: edit-mode toggle. Used by the mobile /
   * iPad preview shell so the toolbar shows only what an end student would
   * see — the publisher edits exclusively from the web view.
   */
  readonly readOnly?: boolean;
  /**
   * When true, the edit-mode toggle is omitted (shown in the stage header
   * instead). When presenting fullscreen the header is hidden, so callers
   * should pass false to keep edit on this toolbar.
   */
  readonly hideEditToggle?: boolean;
  /**
   * Publisher ToB flow: editing is the default state — show a Save action
   * instead of enter / confirm / cancel edit chrome.
   */
  readonly persistentEdit?: boolean;
  /**
   * ToB publisher classroom — never show legacy enter/confirm/cancel;
   * Save is only offered while `persistentEdit` is true (edit view).
   */
  readonly publisherWorkflow?: boolean;
}

/* Compact control button */
const ctrlBtn = cn(
  'relative w-7 h-7 rounded-md flex items-center justify-center',
  'transition-all duration-150 outline-none cursor-pointer',
  'hover:bg-gray-500/[0.08] dark:hover:bg-gray-400/[0.08] active:scale-90',
);

/* Subtle separator */
function CtrlDivider() {
  return <div className="w-px h-3 bg-gray-200/80 dark:bg-gray-700/60 mx-0.5 shrink-0" />;
}

/* Volume icon based on level */
function VolumeIcon({
  muted,
  volume,
  disabled,
}: {
  muted: boolean;
  volume: number;
  disabled: boolean;
}) {
  const cls = 'w-3.5 h-3.5';
  if (disabled || muted || volume === 0) return <VolumeX className={cls} />;
  if (volume < 0.5) return <Volume1 className={cls} />;
  return <Volume2 className={cls} />;
}

export function CanvasToolbar({
  currentSceneIndex,
  scenesCount,
  engineState,
  isLiveSession,
  whiteboardOpen,
  sidebarCollapsed,
  chatCollapsed,
  onToggleSidebar,
  onToggleChat,
  onPrevSlide,
  onNextSlide,
  onPlayPause,
  onWhiteboardClose,
  showStopDiscussion,
  onStopDiscussion,
  isPresenting,
  onTogglePresentation,
  className,
  ttsEnabled,
  ttsMuted,
  ttsVolume = 1,
  onToggleMute,
  onVolumeChange,
  autoPlayLecture,
  onToggleAutoPlay,
  playbackSpeed = 1,
  onCycleSpeed,
  readOnly = false,
  hideEditToggle = false,
  persistentEdit = false,
  publisherWorkflow = false,
}: CanvasToolbarProps) {
  const { t } = useI18n();
  const canGoPrev = currentSceneIndex > 0;
  const canGoNext = currentSceneIndex < scenesCount - 1;
  const showPlayPause = !isLiveSession;

  const whiteboardElementCount = useStageStore(
    (s) => s.stage?.whiteboard?.[0]?.elements?.length || 0,
  );

  // P3 / P6: edit-mode toggle. Only enabled for editable scene types —
  // currently just the PPTist slide canvas. Quiz / interactive widgets
  // (模拟实验 · 在线编程 · 思维导图 · 3D · game) / PBL (项目挑战) all rely on
  // the per-scene AI-modify flow instead because their structures are
  // impractical to tweak by hand.
  const isEditing = useEditModeStore.use.isEditing();
  const setEditing = useEditModeStore.use.setEditing();
  const cancelEditingWithRevert = useEditModeStore.use.cancelEditingWithRevert();
  const [pendingEditCancel, setPendingEditCancel] = useState(false);
  const currentSceneType = useStageStore((s) => {
    const id = s.currentSceneId;
    return id ? s.scenes.find((sc) => sc.id === id)?.type : undefined;
  });
  const canEnterEdit = !readOnly && isManuallyEditableSceneType(currentSceneType);
  const showSessionEditControls =
    !publisherWorkflow && canEnterEdit && !hideEditToggle && !isPresenting;

  // Volume slider hover state
  const [volumeHover, setVolumeHover] = useState(false);
  const volumeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const volumeContainerRef = useRef<HTMLDivElement>(null);

  const handleVolumeEnter = useCallback(() => {
    clearTimeout(volumeTimerRef.current);
    setVolumeHover(true);
  }, []);

  const handleVolumeLeave = useCallback(() => {
    volumeTimerRef.current = setTimeout(() => setVolumeHover(false), 300);
  }, []);

  // Cleanup volume hover timer on unmount
  useEffect(() => () => clearTimeout(volumeTimerRef.current), []);

  // Effective volume for display
  const effectiveVolume = ttsMuted ? 0 : ttsVolume;
  const presentationLabel = isPresenting ? t('stage.exitFullscreen') : t('stage.fullscreen');

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* ── Left: sidebar toggle + page indicator ── */}
      <div className="flex items-center gap-1 shrink-0 pl-1">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className={cn(
              ctrlBtn,
              'w-6 h-6',
              sidebarCollapsed
                ? 'text-gray-400 dark:text-gray-500'
                : 'text-gray-600 dark:text-gray-300',
            )}
            aria-label="Toggle sidebar"
          >
            <LayoutList className="w-3.5 h-3.5" />
          </button>
        )}
        <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums select-none font-medium">
          {currentSceneIndex + 1}
          <span className="opacity-35 mx-px">/</span>
          {scenesCount}
        </span>
      </div>

      <CtrlDivider />

      {/* ── Center: unified playback controls ── */}
      <div className="flex-1 flex items-center justify-center min-w-0">
        <div
          className={cn(
            'inline-flex items-center gap-0.5 px-1 h-7',
            isPresenting
              ? '' /* Single visual layer in fullscreen — buttons sit inside outer pill directly */
              : 'bg-gray-100/60 dark:bg-gray-800/60 rounded-lg',
          )}
        >
          {/* Volume with vertical popover slider */}
          {onToggleMute && (
            <div
              ref={volumeContainerRef}
              className="relative flex items-center"
              onMouseEnter={handleVolumeEnter}
              onMouseLeave={handleVolumeLeave}
            >
              <button
                onClick={onToggleMute}
                disabled={!ttsEnabled}
                className={cn(
                  ctrlBtn,
                  'w-6 h-6',
                  !ttsEnabled
                    ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                    : ttsMuted
                      ? 'text-red-500 dark:text-red-400'
                      : 'text-gray-500 dark:text-gray-400',
                )}
                aria-label={ttsMuted ? 'Unmute' : 'Mute'}
              >
                <VolumeIcon muted={!!ttsMuted} volume={ttsVolume} disabled={!ttsEnabled} />
              </button>

              {/* Vertical volume slider (pops up above) */}
              <div
                className={cn(
                  'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex flex-col items-center',
                  'transition-all duration-200 ease-out pointer-events-none opacity-0',
                  volumeHover && ttsEnabled && 'pointer-events-auto opacity-100',
                )}
              >
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-2 py-2.5 flex flex-col items-center gap-1.5">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums font-medium select-none">
                    {Math.round(effectiveVolume * 100)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={effectiveVolume}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      onVolumeChange?.(v);
                      if (v > 0 && ttsMuted) onToggleMute?.();
                    }}
                    className={cn(
                      'appearance-none cursor-pointer',
                      'h-16 w-1 rounded-full',
                      'bg-gray-200 dark:bg-gray-600',
                      '[writing-mode:vertical-lr] [direction:rtl]',
                      '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3',
                      '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500 [&::-webkit-slider-thumb]:dark:bg-violet-400',
                      '[&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer',
                      '[&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3',
                      '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-violet-500 [&::-moz-range-thumb]:border-0',
                    )}
                  />
                </div>
                {/* Arrow pointing down */}
                <div className="w-2 h-2 bg-white dark:bg-gray-800 border-b border-r border-gray-200 dark:border-gray-700 rotate-45 -mt-[5px]" />
              </div>
            </div>
          )}

          {/* Speed */}
          {onCycleSpeed && (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onCycleSpeed}
                    className={cn(
                      'w-8 h-5 rounded flex items-center justify-center',
                      'transition-all duration-150 outline-none cursor-pointer',
                      'text-[11px] font-semibold tabular-nums leading-none',
                      'active:scale-90',
                      playbackSpeed !== 1
                        ? 'text-violet-600 dark:text-violet-400 bg-violet-500/10 dark:bg-violet-400/10'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                    )}
                    aria-label="Playback speed"
                  >
                    {playbackSpeed === 1.5 ? '1.5x' : `${playbackSpeed}x`}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {t('roundtable.speed')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <CtrlDivider />

          {/* Prev scene */}
          {scenesCount > 1 && (
            <button
              onClick={onPrevSlide}
              disabled={!canGoPrev}
              className={cn(
                ctrlBtn,
                'w-6 h-6 text-gray-500 dark:text-gray-400 disabled:opacity-20 disabled:pointer-events-none',
              )}
              aria-label="Previous scene"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Play / Pause / Stop Discussion */}
          {showStopDiscussion && onStopDiscussion ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStopDiscussion();
              }}
              className={cn(
                'flex items-center gap-1.5 h-6 px-2.5 rounded-md',
                'bg-red-500/10 dark:bg-red-400/10 text-red-600 dark:text-red-400',
                'text-[11px] font-semibold whitespace-nowrap',
                'hover:bg-red-500/20 dark:hover:bg-red-400/20 active:scale-95 transition-all cursor-pointer',
              )}
              title={t('roundtable.stopDiscussion')}
            >
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
              </span>
              {t('roundtable.stopDiscussion')}
            </button>
          ) : showPlayPause ? (
            <button
              onClick={onPlayPause}
              className={cn(
                ctrlBtn,
                'w-7 h-6',
                engineState === 'playing'
                  ? 'text-violet-600 dark:text-violet-400'
                  : 'text-gray-500 dark:text-gray-400',
              )}
              aria-label={engineState === 'playing' ? 'Pause' : 'Play'}
            >
              {engineState === 'playing' ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5 ml-px" />
              )}
            </button>
          ) : null}

          {/* Next scene */}
          {scenesCount > 1 && (
            <button
              onClick={onNextSlide}
              disabled={!canGoNext}
              className={cn(
                ctrlBtn,
                'w-6 h-6 text-gray-500 dark:text-gray-400 disabled:opacity-20 disabled:pointer-events-none',
              )}
              aria-label="Next scene"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          {(onToggleAutoPlay || !readOnly) && <CtrlDivider />}

          {/* Auto-play */}
          {onToggleAutoPlay && (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onToggleAutoPlay}
                    className={cn(
                      ctrlBtn,
                      'w-8 h-6',
                      autoPlayLecture
                        ? 'text-violet-600 dark:text-violet-400'
                        : 'text-gray-500 dark:text-gray-400',
                    )}
                    aria-label="Auto-play"
                  >
                    <Repeat className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {autoPlayLecture ? t('roundtable.autoPlayOff') : t('roundtable.autoPlay')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Whiteboard — publisher tool; hidden in mobile / iPad preview */}
          {!readOnly && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onWhiteboardClose();
              }}
              className={cn(
                ctrlBtn,
                'w-6 h-6',
                whiteboardOpen
                  ? 'text-violet-600 dark:text-violet-400'
                  : 'text-gray-500 dark:text-gray-400',
              )}
              title={whiteboardOpen ? t('whiteboard.minimize') : t('whiteboard.open')}
            >
              <PencilLine className="w-3.5 h-3.5" />
              {!whiteboardOpen && whiteboardElementCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-violet-500 dark:bg-violet-400 rounded-full" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Right: edit toggle + fullscreen + chat toggle ── */}
      <div className="flex items-center justify-end gap-px shrink-0 pr-1">
        {showSessionEditControls ? <CtrlDivider /> : null}
        {/* Legacy enter / confirm / cancel — not used in publisher ToB flow. */}
        {showSessionEditControls && (
          <TooltipProvider delayDuration={0}>
            {!isEditing ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className={cn(
                      'inline-flex items-center gap-1 h-6 px-2 rounded-md',
                      'text-[11px] font-semibold whitespace-nowrap',
                      'transition-all duration-150 active:scale-95 cursor-pointer',
                      'bg-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-500/[0.08] dark:hover:bg-gray-400/[0.08]',
                    )}
                    aria-label={t('editMode.enter')}
                    aria-pressed={false}
                  >
                    <Pencil className="w-3 h-3" />
                    <span>{t('editMode.enter')}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {t('editMode.enterTooltip')}
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="inline-flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      disabled={pendingEditCancel}
                      className={cn(
                        'inline-flex items-center gap-1 h-6 px-2 rounded-md',
                        'text-[11px] font-semibold whitespace-nowrap',
                        'transition-all duration-150 active:scale-95 cursor-pointer',
                        'bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60',
                      )}
                      aria-label={t('editMode.confirmChanges')}
                    >
                      <Check className="w-3 h-3" />
                      <span>{t('editMode.confirmChanges')}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs max-w-[240px]">
                    {t('editMode.confirmChangesTooltip')}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingEditCancel(true);
                        void cancelEditingWithRevert().finally(() => setPendingEditCancel(false));
                      }}
                      disabled={pendingEditCancel}
                      className={cn(
                        'inline-flex items-center gap-1 h-6 px-2 rounded-md',
                        'text-[11px] font-semibold whitespace-nowrap',
                        'transition-all duration-150 active:scale-95 cursor-pointer',
                        'border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900',
                        'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60',
                      )}
                      aria-label={t('editMode.cancelChanges')}
                    >
                      <X className="w-3 h-3" />
                      <span>{t('editMode.cancelChanges')}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs max-w-[240px]">
                    {t('editMode.cancelChangesTooltip')}
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </TooltipProvider>
        )}
        {onTogglePresentation && (
          <button
            onClick={onTogglePresentation}
            className={cn(
              ctrlBtn,
              'w-6 h-6',
              isPresenting
                ? 'text-violet-600 dark:text-violet-400'
                : 'text-gray-500 dark:text-gray-400',
            )}
            aria-label={presentationLabel}
            title={presentationLabel}
          >
            {isPresenting ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        )}
        {onToggleChat && (
          <button
            onClick={onToggleChat}
            className={cn(
              ctrlBtn,
              'w-6 h-6',
              chatCollapsed
                ? 'text-gray-400 dark:text-gray-500'
                : 'text-gray-600 dark:text-gray-300',
            )}
            aria-label="Toggle chat"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
