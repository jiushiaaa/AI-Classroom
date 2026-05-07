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
import { TabletSidePanel, type TabletSidePanelTab } from './tablet-side-panel';
import { MobileSceneDrawer } from './mobile-scene-drawer';
import { cn } from '@/lib/utils';

interface TabletClassroomViewProps {
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
}

/**
 * TabletClassroomView
 *
 * iPad-only classroom layout. Composes:
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ TabletTopBar (52px)                          │
 *   ├──────────────────────────────┬───────────────┤
 *   │                              │               │
 *   │ MobileStage (light gradient   │ TabletSidePanel│
 *   │   backdrop, slide centered)   │  qa /         │
 *   │                              │  members /    │
 *   │                              │  narration log│
 *   │                              │               │
 *   ├──────────────────────────────┤               │
 *   │ TabletControlBar (~76px)      │               │
 *   └──────────────────────────────┴───────────────┘
 *
 * The side panel is open by default in landscape (where the extra width
 * makes a 340px column negligible) and closed in portrait. A floating
 * "open panel" button surfaces in the top-right corner of the stage when
 * the panel is hidden so the publisher can re-open it without going up
 * to the top bar.
 */
export function TabletClassroomView({
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
  onTogglePresentation,
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
}: TabletClassroomViewProps) {
  const { t } = useI18n();
  const isLandscape = orientation === 'landscape';
  const [sidePanelOpen, setSidePanelOpen] = useState<boolean>(isLandscape);
  const [activeSideTab, setActiveSideTab] = useState<TabletSidePanelTab>('qa');
  const [sceneDrawerOpen, setSceneDrawerOpen] = useState(false);

  // v1.12.1 — Local immersive (fullscreen) toggle. See PhoneClassroomView
  // doc-block for the rationale; iPad uses the exact same primitive so
  // both devices share one mental model and one set of keys.
  const [isImmersive, setIsImmersive] = useState(false);
  const enterImmersive = useCallback(() => {
    setIsImmersive(true);
    setSidePanelOpen(false);
  }, []);
  const exitImmersive = useCallback(() => {
    setIsImmersive(false);
    setSidePanelOpen(isLandscape);
  }, [isLandscape]);

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

  const expandTranscript = useCallback(() => {
    setSidePanelOpen(true);
    setActiveSideTab('narrationLog');
  }, []);

  return (
    <div className="relative w-full h-full flex flex-col bg-white dark:bg-gray-950 overflow-hidden">
      {!isImmersive && (
        <TabletTopBar
          title={currentSceneTitle}
          sidePanelOpen={sidePanelOpen}
          onToggleSidePanel={() => setSidePanelOpen((s) => !s)}
          onOpenSceneGrid={() => setSceneDrawerOpen(true)}
          // Local immersive toggle — see PhoneClassroomView's matching
          // override for the rationale.
          onTogglePresentation={enterImmersive}
        />
      )}

      <div className="flex-1 min-h-0 flex flex-row overflow-hidden">
        {/* Main column — stage + control bar. The stage component
            paints its own gradient backdrop so the slide visually
            "lifts" off the page; the column itself is a no-op flex
            container with no fallback color underneath. */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
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
            />

            {/* Floating open-panel button — only when side panel is
                hidden AND we are not in immersive mode (immersive
                deliberately strips chrome). */}
            {!isImmersive && !sidePanelOpen && (
              <button
                type="button"
                onClick={() => setSidePanelOpen(true)}
                aria-label={t('mobile.tablet.sidePanel.expand')}
                className={cn(
                  'absolute top-3 right-3 z-30 inline-flex items-center justify-center w-12 h-12 rounded-full',
                  'bg-white/85 dark:bg-gray-900/85 backdrop-blur-md text-gray-700 dark:text-gray-200',
                  'shadow-lg ring-1 ring-black/5 dark:ring-white/10 active:scale-95 transition-all',
                )}
              >
                <PanelRightOpen className="w-5 h-5" />
              </button>
            )}

            {/* Floating exit-immersive button — slot mirrors the
                "open panel" button so muscle memory carries over. */}
            {isImmersive && (
              <button
                type="button"
                onClick={exitImmersive}
                aria-label={t('mobile.topBar.exitFullscreen')}
                title={t('mobile.topBar.exitFullscreen')}
                className={cn(
                  'absolute top-3 right-3 z-40 inline-flex items-center justify-center w-12 h-12 rounded-full',
                  'bg-gray-900/70 dark:bg-white/15 text-white backdrop-blur-md',
                  'shadow-lg ring-1 ring-white/15 active:scale-95 transition-all',
                )}
              >
                <Minimize2 className="w-5 h-5" />
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
            isImmersive={isImmersive}
          />
        </div>

        {/* Inline side panel — gated on immersive so the stage column
            reclaims the full device width when fullscreen. */}
        {!isImmersive && (
          <TabletSidePanel
            open={sidePanelOpen}
            activeTab={activeSideTab}
            onChangeTab={setActiveSideTab}
            bridge={bridge}
            agents={agents}
            agentsById={agentsById}
            speakingAgentId={speakingAgentId}
            liveText={isLiveSession ? speechText : null}
            thinkingHint={thinkingHint}
            currentSceneId={currentSceneId}
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
