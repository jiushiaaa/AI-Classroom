'use client';

import { useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import { SceneProvider } from '@/lib/contexts/scene-context';
import { SceneRenderer } from '@/components/stage/scene-renderer';
import { ClassroomCompletePageConnected } from '@/components/scene-renderers/classroom-complete';
import type { Scene, StageMode } from '@/lib/types/stage';

interface MobileStageProps {
  readonly currentScene: Scene | null;
  readonly currentSceneIndex: number;
  readonly scenesCount: number;
  readonly mode: StageMode;
  readonly engineState: 'idle' | 'playing' | 'paused';
  readonly isLiveSession: boolean;
  readonly isPendingScene: boolean;
  readonly isCourseComplete: boolean;
  readonly isGenerationFailed: boolean;

  readonly onPrevSlide: () => void;
  readonly onNextSlide: () => void;
  readonly onPlayPause: () => void;
  readonly onRetryGeneration?: () => void;

  /** Compact arrows / dots for narrow phone-portrait stages. */
  readonly compact?: boolean;
  /**
   * How the slide is positioned within the stage region. `'center'`
   * (default) keeps it horizontally centered — used for iPad and phone
   * portrait. `'left'` pins it to the left edge — used for phone
   * landscape so the publisher's stipulation "PPT 全屏放在左侧" reads
   * correctly: the slide flush against the left of the device, with any
   * leftover stage width sitting on the right (typically taken by the
   * inline side panel).
   */
  readonly slideAlign?: 'center' | 'left';
  readonly className?: string;
}

/**
 * MobileStage
 *
 * Slide / scene host shared by the phone and iPad classroom previews.
 *
 * Key contract — and the reason this component exists separately from
 * the desktop `CanvasArea`:
 *
 *  1. The slide ALWAYS fits the available stage area on BOTH axes while
 *     preserving the 16:9 aspect ratio. We achieve this with
 *     `aspect-[16/9] max-w-full max-h-full` + flex centering, instead
 *     of pinning the slide to the top of the column with a flex-1 filler
 *     below. That older approach is what produced "small slide + huge
 *     empty area below" on phone portrait and the giant exposed black
 *     band on iPad portrait.
 *
 *  2. The stage backdrop is always a soft, slightly darker gray
 *     gradient (NOT pure white, NOT pure black). This is what makes the
 *     white slide card visually pop forward in the preview as the
 *     dominant element on the screen. Earlier "immersive" mode used
 *     `bg-black`, which exposed below-slide bands on iPad — that
 *     fallback is gone for good.
 *
 *  3. Scene rendering goes through `<SceneRenderer />` so slide / quiz
 *     / interactive / pbl + their nested whiteboard / coding / video
 *     blocks render exactly the same as desktop.
 *
 *  4. Floating prev/next + play/pause are sized for fingers (44px)
 *     instead of the 32px desktop arrows, and they overlay the slide
 *     itself so they remain anchored to the visible 16:9 area when the
 *     stage is taller than the slide.
 */
export function MobileStage({
  currentScene,
  currentSceneIndex,
  scenesCount,
  mode,
  engineState,
  isLiveSession,
  isPendingScene,
  isCourseComplete,
  isGenerationFailed,
  onPrevSlide,
  onNextSlide,
  onPlayPause,
  onRetryGeneration,
  compact = false,
  slideAlign = 'center',
  className,
}: MobileStageProps) {
  const { t } = useI18n();

  const hasPrev = currentSceneIndex > 0;
  const hasNext = currentSceneIndex < scenesCount - 1 || !isPendingScene;

  const showPlayHint =
    mode === 'playback' &&
    engineState === 'paused' &&
    currentScene?.type === 'slide' &&
    !isLiveSession &&
    !isPendingScene;

  const handleSlideClick = useCallback(
    (e: React.MouseEvent) => {
      if (mode !== 'playback' || isLiveSession || currentScene?.type !== 'slide') return;
      const container = e.currentTarget as HTMLElement;
      const videoEls = container.querySelectorAll('[data-video-element]');
      for (const el of videoEls) {
        const rect = el.getBoundingClientRect();
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          return;
        }
      }
      onPlayPause();
    },
    [mode, isLiveSession, onPlayPause, currentScene?.type],
  );

  const arrowSize = compact ? 'w-9 h-9' : 'w-11 h-11';
  const arrowIconSize = compact ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <div
      className={cn(
        // Stage backdrop — pure white (matching the slide content's own
        // background). Earlier versions used a cool-gray gradient + dot
        // pattern to make the slide "lift forward", but in practice that
        // produced the visual the publisher complained about: a small
        // slide-shaped card floating in a decorative gray area. Now the
        // stage is one continuous white surface and the slide content
        // bleeds straight into it — the user perceives the entire stage
        // region as "the slide", not "a slide centered in a card".
        'relative w-full h-full min-h-0 min-w-0 overflow-hidden',
        'flex items-center',
        slideAlign === 'left' ? 'justify-start' : 'justify-center',
        'bg-white dark:bg-gray-900',
        className,
      )}
    >
      {/* The slide itself — sized so it fits the stage container on
          BOTH axes while keeping 16:9. The trick is `aspect-[16/9]`
          combined with `max-h-full max-w-full` + `h-auto w-auto`: the
          element prefers to be as wide as the parent, but gets clamped
          by max-h when the parent is wide+short, so it always picks
          whichever dimension is constrained.

          IMPORTANT: no margins / no rounded corners / no shadow / no
          ring on this box. The slide is the stage; we don't draw a
          card around it. The SceneRenderer's own internal layout
          (heading, image, body) is the visible structure. */}
      {/* The slide is a clickable region (tap toggles play/pause), but
          its children include an entire scene renderer with its own
          interactive elements. We can't use a native <button> because
          buttons can't legally contain other interactive content, and
          we don't want pointer-events disabled on children. So we use
          a div + role="button" + tabIndex; sonarqube prefers a native
          button, but the trade-off is acceptable here. */}
      {/* eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- see comment above */}
      <div
        role="button"
        tabIndex={0}
        aria-label={currentScene?.title}
        className={cn(
          'relative bg-white dark:bg-gray-900 overflow-hidden',
          'aspect-[16/9] w-full max-w-full max-h-full h-auto',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60',
        )}
        onClick={handleSlideClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (mode === 'playback' && !isLiveSession && currentScene?.type === 'slide') {
              onPlayPause();
            }
          }
        }}
      >
        {currentScene && (
          <div className="absolute inset-0">
            <SceneProvider>
              <SceneRenderer scene={currentScene} mode={mode} editing={false} />
            </SceneProvider>
          </div>
        )}

        <AnimatePresence>
          {isPendingScene && !currentScene && isCourseComplete && (
            <motion.div
              key="course-complete"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0"
            >
              <ClassroomCompletePageConnected />
            </motion.div>
          )}
          {isPendingScene && !currentScene && !isCourseComplete && (
            <motion.div
              key="pending"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 z-[105] flex flex-col items-center justify-center bg-white dark:bg-gray-800"
            >
              {isGenerationFailed ? (
                <div className="flex flex-col items-center gap-3 px-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-red-400 dark:text-red-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                      />
                    </svg>
                  </div>
                  <span className="text-sm text-red-500 dark:text-red-400 font-medium">
                    {t('stage.generationFailed')}
                  </span>
                  {onRetryGeneration && (
                    <button
                      type="button"
                      onClick={onRetryGeneration}
                      className="mt-1 px-4 py-1.5 text-xs font-medium rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 active:scale-95"
                    >
                      {t('generation.retryScene')}
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="relative w-12 h-12">
                    <div className="absolute inset-0 rounded-full border-2 border-gray-100 dark:border-gray-700" />
                    <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-500 dark:border-t-purple-400 animate-spin" />
                  </div>
                  <span className="text-sm text-gray-400 dark:text-gray-500 font-medium">
                    {t('stage.generatingNextPage')}
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showPlayHint && (
            <motion.div
              key="play-hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 z-[102] flex items-center justify-center pointer-events-none"
            >
              <motion.button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayPause();
                }}
                aria-label={t('mobile.teacherDock.play')}
                className="pointer-events-auto w-16 h-16 rounded-full bg-white/95 dark:bg-gray-800/95 flex items-center justify-center shadow-[0_4px_30px_rgba(147,51,234,0.18),inset_0_0_0_1px_rgba(233,213,255,0.5)] dark:shadow-[0_4px_30px_rgba(147,51,234,0.32)]"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Play className="w-6 h-6 text-purple-600 dark:text-purple-400 fill-purple-600/90 dark:fill-purple-400/90 ml-0.5" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {currentScene && (
          <div className="absolute bottom-3 right-3 text-gray-200/80 dark:text-gray-700 font-black text-3xl opacity-50 pointer-events-none select-none mix-blend-multiply dark:mix-blend-screen">
            {(currentSceneIndex + 1).toString().padStart(2, '0')}
          </div>
        )}

        {/* Floating prev / next arrows — overlay on the slide so they
            stay anchored to the visible 16:9 area regardless of how
            much padding the stage has around it. */}
        {scenesCount > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (hasPrev) onPrevSlide();
              }}
              disabled={!hasPrev}
              aria-label={t('mobile.pager.prev')}
              title={t('mobile.pager.prev')}
              className={cn(
                'absolute left-2 top-1/2 -translate-y-1/2 z-20 inline-flex items-center justify-center rounded-full',
                arrowSize,
                'bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-md ring-1 ring-black/5 dark:ring-white/10',
                'text-gray-700 dark:text-gray-200 transition-all',
                hasPrev
                  ? 'hover:bg-white dark:hover:bg-gray-900 active:scale-95'
                  : 'opacity-30 cursor-not-allowed',
              )}
            >
              <ChevronLeft className={arrowIconSize} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (hasNext) onNextSlide();
              }}
              disabled={!hasNext}
              aria-label={t('mobile.pager.next')}
              title={t('mobile.pager.next')}
              className={cn(
                'absolute right-2 top-1/2 -translate-y-1/2 z-20 inline-flex items-center justify-center rounded-full',
                arrowSize,
                'bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-md ring-1 ring-black/5 dark:ring-white/10',
                'text-gray-700 dark:text-gray-200 transition-all',
                hasNext
                  ? 'hover:bg-white dark:hover:bg-gray-900 active:scale-95'
                  : 'opacity-30 cursor-not-allowed',
              )}
            >
              <ChevronRight className={arrowIconSize} />
            </button>
          </>
        )}

        {/* Bottom-of-slide page indicator */}
        {scenesCount > 0 && (
          <div className="absolute left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 pointer-events-none bottom-2">
            {scenesCount <= 12 ? (
              // Page dots are positional / decorative — there's no
              // domain id we can key on (each "dot" represents the
              // n-th slot, not an item). Sonarqube flags array-index
              // keys, but here index IS the identity.
              // NOSONAR
              Array.from({ length: scenesCount }, (_, i) => i).map((slot) => (
                <span
                  // eslint-disable-next-line react/no-array-index-key
                  key={slot}
                  className={cn(
                    'h-1 rounded-full transition-all duration-300',
                    slot === currentSceneIndex
                      ? 'w-4 bg-purple-500 dark:bg-purple-400 shadow-sm'
                      : 'w-1 bg-white/70 dark:bg-gray-600/80',
                  )}
                />
              ))
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-black/40 text-white text-[10px] font-semibold tabular-nums backdrop-blur-md">
                {currentSceneIndex + 1} / {scenesCount}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
