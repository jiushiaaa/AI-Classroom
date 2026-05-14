'use client';

import { useCallback, useMemo, useState, type RefObject } from 'react';
import { Minimize2, PanelRightOpen } from 'lucide-react';
import type { ChatAreaRef } from '@/components/chat/chat-area';
import type { Scene, StageMode } from '@/lib/types/stage';
import type { PreviewOrientation } from '@/lib/store/preview-device';
import type { PlaybackView } from '@/lib/playback';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
import { useMobileChatBridge } from '@/lib/hooks/use-mobile-chat-bridge';
import { useI18n } from '@/lib/hooks/use-i18n';

import { TabletTopBar } from './tablet-top-bar';
import { MobileStage } from './mobile-stage';
import { TabletControlBar } from './tablet-control-bar';
import { TabletSidePanel } from './tablet-side-panel';
import { MobileSceneDrawer } from './mobile-scene-drawer';
import { cn } from '@/lib/utils';
import {
  LectureAudioSeekBar,
  computeLectureSeekStripVisibility,
  type LectureAudioProgress,
} from '@/components/playback/lecture-audio-seek-bar';

interface PhoneClassroomViewProps {
  readonly orientation: PreviewOrientation;
  readonly chatAreaRef: RefObject<ChatAreaRef | null>;

  readonly currentScene: Scene | null;
  readonly currentSceneTitle: string;
  readonly currentSceneId: string | null;
  readonly currentSceneIndex: number;
  readonly scenesCount: number;
  readonly scenes: ReadonlyArray<Scene>;
  readonly mode: StageMode;
  readonly engineState: 'idle' | 'playing' | 'paused';
  readonly isLiveSession: boolean;
  readonly isPendingScene: boolean;
  readonly isCourseComplete: boolean;
  readonly isGenerationFailed: boolean;
  readonly chatIsStreaming: boolean;

  readonly onPrevSlide: () => void;
  readonly onNextSlide: () => void;
  readonly onPlayPause: () => void;
  readonly onSelectScene: (sceneId: string) => void;
  readonly onTogglePresentation?: () => void;
  readonly onRetryGeneration?: () => void;

  // ── v1.12: web-parity playback / tool controls ──
  readonly whiteboardOpen?: boolean;
  readonly onToggleWhiteboard?: () => void;
  readonly playbackSpeed?: number;
  readonly onCycleSpeed?: () => void;
  readonly autoPlayLecture?: boolean;
  readonly onToggleAutoPlay?: () => void;

  readonly playbackView: PlaybackView;
  readonly speakingAgentId: string | null;
  readonly thinkingState: { stage: string; agentId?: string } | null;

  readonly agents: ReadonlyArray<AgentConfig>;
  readonly lectureAudioProgress?: LectureAudioProgress | null;
  readonly onLectureAudioSeek?: (ratio: number) => void;
  readonly lectureSeekBlocked?: boolean;
  readonly speechProgress?: number | null;
  readonly isOpenmaicDemoClassroom?: boolean;
}

/**
 * PhoneClassroomView — v1.12 unified-with-iPad layout
 *
 * v1.9 had a phone-only paradigm: PhoneTopBar (44) + Stage + 60px
 * PhoneTeacherDock + 52px PhoneBottomTabs (课件 / 讲解 / 问答 / 成员) +
 * 3 separate sheets that lifted from the bottom. The publisher's v1.12
 * verdict was that this paradigm has aged: the dock + tabs split adds
 * two horizontal cards under the slide and the sheets take the user
 * out of the playback context. iPad's "top bar + stage + control bar +
 * collapsible side panel" reads cleaner, so phone is now built on the
 * exact same skeleton (TabletTopBar / TabletControlBar / TabletSidePanel)
 * with two phone-specific tweaks:
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ TabletTopBar (52)                            │
 *   ├────────────────────────────┬─────────────────┤
 *   │ MobileStage  slideAlign=   │ TabletSidePanel │  ← landscape
 *   │   'left' (PPT 全屏贴左)     │  (inline 280)   │
 *   │                            │                 │
 *   ├────────────────────────────┴─────────────────┤
 *   │ TabletControlBar (compact)                   │
 *   └──────────────────────────────────────────────┘
 *
 * Portrait phones use the same split idea, rotated vertically: slide
 * stage on top, dialogue window below. The panel stays in the classroom
 * flow instead of covering the stage with a right-side sheet.
 *
 * The publisher specifically requested:
 *   1. PPT 全屏放在左侧 (landscape) → MobileStage slideAlign='left'.
 *   2. 手机端和 iPad 端样式对齐    → same components, smaller scale.
 *   3. 加入网页端的全屏 / 倍速 /     → TabletControlBar gains speed +
 *      自动播放 / 白板               autoplay; TopBar More menu gains
 *                                    fullscreen + whiteboard.
 *
 * v1.12.5 — Phone bottom bar drops slide chevrons (stage owns paging).
 * The bottom TabletControlBar (AI teacher strip) is hidden by default
 * and only appears once the user taps the slide to pause playback.
 * Playback remains available via on-slide arrows / gestures where the
 * stage exposes them.
 */
export function PhoneClassroomView({
  orientation,
  chatAreaRef,
  currentScene,
  currentSceneTitle,
  currentSceneId,
  currentSceneIndex,
  scenesCount,
  scenes,
  mode,
  engineState,
  isLiveSession,
  isPendingScene,
  isCourseComplete,
  isGenerationFailed,
  chatIsStreaming,
  onPrevSlide,
  onNextSlide,
  onPlayPause,
  onSelectScene,
  onRetryGeneration,
  whiteboardOpen,
  onToggleWhiteboard,
  playbackSpeed,
  onCycleSpeed,
  autoPlayLecture,
  onToggleAutoPlay,
  playbackView,
  speakingAgentId,
  thinkingState,
  agents,
  lectureAudioProgress,
  onLectureAudioSeek,
  lectureSeekBlocked,
  speechProgress,
  isOpenmaicDemoClassroom,
}: PhoneClassroomViewProps) {
  const { t } = useI18n();
  const isLandscape = orientation === 'landscape';

  // Landscape phones can sit a 280px inline column next to the stage.
  // Portrait phones keep the dialogue window open as the lower half of
  // the view, so there is no folded overlay state. The parent
  // `DevicePreviewShell` carries `key={device-orientation}` so this
  // component remounts whenever orientation flips, and the useState
  // initializer below resets to the split layout automatically.
  //
  // v1.12.3 — phone collapses 问答 / 成员 / 讲解记录 into one unified
  // surface (see TabletSidePanel `unified` prop), so the tab state that
  // used to live here is no longer needed.
  const [sidePanelOpen, setSidePanelOpen] = useState<boolean>(true);
  const [sceneDrawerOpen, setSceneDrawerOpen] = useState(false);

  // v1.12.1 — Local immersive (fullscreen-within-the-device-frame).
  // immersive mode hides the top bar, side panel, and the entire bottom
  // TabletControlBar (not merely its secondary cluster — publishers
  // asked for no AI-teacher strip while fullscreen).
  // We avoid the browser fullscreen API because DevicePreviewShell uses
  // `transform: scale()` and native fullscreen on a scaled child does
  // not produce the intended UX.
  const [isImmersive, setIsImmersive] = useState(false);
  const enterImmersive = useCallback(() => {
    setIsImmersive(true);
    // Always close the side panel on entry; reopening the panel mid-
    // immersive would reintroduce chrome we are explicitly trying to
    // hide.
    setSidePanelOpen(false);
  }, []);
  const exitImmersive = useCallback(() => {
    setIsImmersive(false);
    // Restore split mode after leaving immersive.
    setSidePanelOpen(true);
  }, []);

  const bridge = useMobileChatBridge({
    chatAreaRef,
    currentSceneId,
    isStreaming: chatIsStreaming,
  });

  const agentsById = useMemo<Record<string, AgentConfig | undefined>>(
    () => Object.fromEntries(agents.map((a) => [a.id, a])),
    [agents],
  );

  const speakingAgent = useMemo(
    () => (speakingAgentId ? (agentsById[speakingAgentId] ?? null) : null),
    [agentsById, speakingAgentId],
  );

  const teacherAgent = useMemo(
    () => agents.find((a) => a.role === 'teacher') ?? agents[0] ?? null,
    [agents],
  );

  const speechText = playbackView.sourceText || null;
  const thinkingHint = thinkingState ? humanReadableThinking(thinkingState.stage) : null;

  const { showHtmlAudioSeek, showDemoTranscriptProgress } = computeLectureSeekStripVisibility({
    lectureAudioProgress,
    onLectureAudioSeek,
    lectureSeekBlocked,
    isOpenmaicDemoClassroom,
    engineState,
    speechProgress,
  });
  const showSeekStrip = showHtmlAudioSeek || showDemoTranscriptProgress;

  // v1.12.3 — with the unified phone panel there's no separate
  // "讲解记录" tab to switch to, so opening the panel is enough; the
  // lecture transcript is already woven into the merged stream.
  const expandTranscript = useCallback(() => {
    setSidePanelOpen(true);
  }, []);

  return (
    <div
      data-orientation={orientation}
      className="relative w-full h-full flex flex-col bg-white dark:bg-gray-950 overflow-hidden"
    >
      {/* TopBar — entirely hidden in immersive mode so the stage
          claims the full vertical space. The stage doc-block guarantees
          aspect-fit centring works regardless of available height.
          Whiteboard props no longer flow through here — v1.12.2 moved
          the whiteboard toggle to the ControlBar's secondary cluster. */}
      {!isImmersive && (
        <TabletTopBar
          title={currentSceneTitle}
          sidePanelOpen={!isLandscape || sidePanelOpen}
          onToggleSidePanel={() => {
            if (isLandscape) setSidePanelOpen((s) => !s);
          }}
          onOpenSceneGrid={() => setSceneDrawerOpen(true)}
          // Override stage.tsx's desktop browser-fullscreen handler
          // with our local immersive toggle. The desktop handler tries
          // to requestFullscreen on the page-level stage element, which
          // has no useful effect inside DevicePreviewShell's scaled
          // device frame — local state is the right primitive here.
          onTogglePresentation={enterImmersive}
        />
      )}

      <div
        className={cn(
          'flex-1 min-h-0 flex overflow-hidden',
          isLandscape ? 'flex-row' : 'flex-col',
        )}
      >
        {/* Main column: stage + (compact) control bar.
            We keep the column transparent so the stage's white surface
            paints the entire region — see MobileStage's v1.11 doc-block
            for why "stage = slide" reads better than a framed card. */}
        <div
          className={cn(
            'flex min-w-0 flex-col overflow-hidden',
            isLandscape ? 'flex-1' : 'h-1/2 w-full shrink-0',
          )}
        >
          <div className="relative flex-1 min-h-0 overflow-hidden">
            <MobileStage
              currentScene={currentScene}
              currentSceneIndex={currentSceneIndex}
              scenesCount={scenesCount}
              mode={mode}
              engineState={engineState}
              isLiveSession={isLiveSession}
              isPendingScene={isPendingScene}
              isCourseComplete={isCourseComplete}
              isGenerationFailed={isGenerationFailed}
              onPrevSlide={onPrevSlide}
              onNextSlide={onNextSlide}
              onPlayPause={onPlayPause}
              onRetryGeneration={onRetryGeneration}
              compact={!isLandscape}
              // Landscape phones pin the slide to the LEFT so it reads
              // as "PPT 全屏占据左侧" with the side panel snug against
              // it on the right (or empty stage when the panel is
              // collapsed).
              slideAlign={isLandscape ? 'left' : 'center'}
              showPlayHint={false}
            />

            {/* Floating "open panel" affordance — surfaces only when
                the panel is collapsed so the publisher can re-open it
                without going up to the top bar. Hidden in immersive
                mode (the chrome we are deliberately stripping). */}
            {!isImmersive && isLandscape && !sidePanelOpen && (
              <button
                type="button"
                onClick={() => setSidePanelOpen(true)}
                aria-label={t('mobile.tablet.sidePanel.expand')}
                className={cn(
                  'absolute top-2 right-2 z-30 inline-flex items-center justify-center w-10 h-10 rounded-full',
                  'bg-white/85 dark:bg-gray-900/85 backdrop-blur-md text-gray-700 dark:text-gray-200',
                  'shadow-lg ring-1 ring-black/5 dark:ring-white/10 active:scale-95 transition-all',
                )}
              >
                <PanelRightOpen className="w-4.5 h-4.5" />
              </button>
            )}

            {/* Floating "exit immersive" affordance — only visible
                while immersive. Sits in the same top-right slot the
                "open panel" button used so the muscle-memory location
                is consistent. */}
            {isImmersive && (
              <button
                type="button"
                onClick={exitImmersive}
                aria-label={t('mobile.topBar.exitFullscreen')}
                title={t('mobile.topBar.exitFullscreen')}
                className={cn(
                  'absolute top-2 right-2 z-40 inline-flex items-center justify-center w-10 h-10 rounded-full',
                  'bg-gray-900/70 dark:bg-white/15 text-white backdrop-blur-md',
                  'shadow-lg ring-1 ring-white/15 active:scale-95 transition-all',
                )}
              >
                <Minimize2 className="w-4.5 h-4.5" />
              </button>
            )}

            <MobileSceneDrawer
              open={sceneDrawerOpen}
              onClose={() => setSceneDrawerOpen(false)}
              scenes={scenes}
              currentSceneId={currentSceneId}
              onSelect={onSelectScene}
            />

          </div>

          {engineState === 'playing' && showSeekStrip && onLectureAudioSeek && (
            <div className="shrink-0 px-2.5 py-1.5 w-full border-t border-gray-200/70 dark:border-gray-800/70 bg-white/90 dark:bg-gray-950/90 backdrop-blur-xl">
              <LectureAudioSeekBar
                progress={
                  showHtmlAudioSeek
                    ? lectureAudioProgress!
                    : {
                        currentMs: (speechProgress ?? 0) * 60000,
                        durationMs: 60000,
                      }
                }
                onSeek={onLectureAudioSeek}
                smoothFollow={showDemoTranscriptProgress}
                aria-label={
                  showHtmlAudioSeek
                    ? t('roundtable.lectureSeekBar')
                    : t('roundtable.demoRevealProgress')
                }
              />
            </div>
          )}

          {engineState === 'paused' && (
            <TabletControlBar
              speakingAgent={speakingAgent}
              teacherAgent={teacherAgent}
              speechText={speechText}
              currentSceneIndex={currentSceneIndex}
              scenesCount={scenesCount}
              engineState={engineState}
              isLiveSession={isLiveSession}
              onPrevSlide={onPrevSlide}
              onNextSlide={onNextSlide}
              onPlayPause={onPlayPause}
              onExpandTranscript={expandTranscript}
              playbackSpeed={playbackSpeed}
              onCycleSpeed={onCycleSpeed}
              autoPlayLecture={autoPlayLecture}
              onToggleAutoPlay={onToggleAutoPlay}
              whiteboardOpen={whiteboardOpen}
              onToggleWhiteboard={onToggleWhiteboard}
              compact
              hideSlidePager
              isImmersive={isImmersive}
              lectureAudioProgress={lectureAudioProgress}
              onLectureAudioSeek={onLectureAudioSeek}
              lectureSeekBlocked={lectureSeekBlocked}
              speechProgress={speechProgress}
              isOpenmaicDemoClassroom={isOpenmaicDemoClassroom}
            />
          )}
        </div>

        {/* Split dialogue panel. Landscape sits inline on the right;
            portrait sits inline below the stage at half height. */}
        {!isImmersive && (
          <TabletSidePanel
            open={isLandscape ? sidePanelOpen : true}
            bridge={bridge}
            agents={agents}
            agentsById={agentsById}
            speakingAgentId={speakingAgentId}
            liveText={isLiveSession ? speechText : null}
            thinkingHint={thinkingHint}
            currentSceneId={currentSceneId}
            mode="inline"
            inlineAxis={isLandscape ? 'horizontal' : 'vertical'}
            width={280}
            height="50%"
            unified
          />
        )}
      </div>
    </div>
  );
}

function humanReadableThinking(stage: string): string {
  switch (stage) {
    case 'director':
      return '正在思考';
    case 'agent':
      return '正在回答';
    default:
      return '正在思考';
  }
}
