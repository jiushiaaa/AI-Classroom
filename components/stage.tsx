'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AnimatePresence } from 'motion/react';
import { useStageStore } from '@/lib/store';
import { flushStageSave, PENDING_SCENE_ID } from '@/lib/store/stage';
import { isOpenmaicDemoClassroomId } from '@/lib/mock/openmaic-demo-classroom';
import { ensureStudySessionStarted } from '@/lib/utils/study-session';
import { useCanvasStore } from '@/lib/store/canvas';
import { useSettingsStore, PLAYBACK_SPEEDS } from '@/lib/store/settings';
import { usePreviewDeviceStore } from '@/lib/store/preview-device';
import { useEditModeStore } from '@/lib/store/edit-mode';
import { useSnapshotStore } from '@/lib/store/snapshot';
import { KEYS } from '@/configs/hotkey';
import { useI18n } from '@/lib/hooks/use-i18n';
import { SceneSidebar } from './stage/scene-sidebar';
import { Header } from './header';
import { CanvasArea } from '@/components/canvas/canvas-area';
import { Roundtable } from '@/components/roundtable';
import { DevicePreviewShell } from '@/components/mobile/device-preview-shell';
import { PhoneClassroomView } from '@/components/mobile/phone-classroom-view';
import { TabletClassroomView } from '@/components/mobile/tablet-classroom-view';
import { PlaybackEngine, computePlaybackView } from '@/lib/playback';
import type { EngineMode, TriggerEvent, Effect } from '@/lib/playback';
import { ActionEngine } from '@/lib/action/engine';
import { createAudioPlayer } from '@/lib/utils/audio-player';
import { useDiscussionTTS } from '@/lib/hooks/use-discussion-tts';
import { useWidgetIframeStore } from '@/lib/store/widget-iframe';
import type { AudioIndicatorState } from '@/components/roundtable/audio-indicator';
import type { Action, DiscussionAction, SpeechAction } from '@/lib/types/action';
import { cn } from '@/lib/utils';
// Playback state persistence removed — refresh always starts from the beginning
import { ChatArea, type ChatAreaRef } from '@/components/chat/chat-area';
import { CurrentScriptWorkbench } from '@/components/chat/current-script-workbench';
import { agentsToParticipants, useAgentRegistry } from '@/lib/orchestration/registry/store';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';
import { VisuallyHidden } from 'radix-ui';
import { toast } from 'sonner';
import { generateTTSForScene } from '@/lib/hooks/use-scene-generator';
import { useLectureNotesEditor } from '@/lib/hooks/use-lecture-notes-editor';
import { getCurrentLectureNote } from '@/lib/utils/lecture-notes';
import {
  buildClassroomPreviewPath,
  buildClassroomPreviewWindowName,
} from '@/lib/utils/classroom-preview-url';

/**
 * Stage Component
 *
 * The main container for the classroom/course.
 * Combines sidebar (scene navigation) and content area (scene viewer).
 * Supports two modes: autonomous and playback.
 */
export function Stage({
  onRetryOutline,
  initialPublisherEditView = true,
}: {
  onRetryOutline?: (outlineId: string) => Promise<void>;
  initialPublisherEditView?: boolean;
}) {
  const { t } = useI18n();
  const {
    mode,
    getCurrentScene,
    scenes,
    currentSceneId,
    setCurrentSceneId,
    updateScene,
    generatingOutlines,
    outlines,
  } = useStageStore();
  const failedOutlines = useStageStore.use.failedOutlines();
  const stage = useStageStore((s) => s.stage);
  const isOpenmaicDemoClassroom = isOpenmaicDemoClassroomId(stage?.id ?? '');

  const currentScene = getCurrentScene();
  const {
    lectureNotes,
    handleEditSpeech,
    handleAiGenerateTeacherScript,
    handleUploadTeacherVoice,
    handleRemoveTeacherVoice,
  } = useLectureNotesEditor();

  // Multi-device preview state (web | mobile | tablet) + orientation —
  // drives the editor chrome around the playback engine. The engine itself
  // is mounted once and shared across all views so the playback position
  // survives toggling.
  const previewDevice = usePreviewDeviceStore((s) => s.previewDevice);
  const previewOrientation = usePreviewDeviceStore((s) => s.previewOrientation);
  const setPreviewDevice = usePreviewDeviceStore((s) => s.setPreviewDevice);
  /** Phone / iPad device-frame preview (distinct from publisher web preview). */
  const isDeviceFramePreview = previewDevice !== 'web';

  // Layout state from settings store (persisted via localStorage)
  const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useSettingsStore((s) => s.setSidebarCollapsed);
  const chatAreaWidth = useSettingsStore((s) => s.chatAreaWidth);
  const setChatAreaWidth = useSettingsStore((s) => s.setChatAreaWidth);
  const chatAreaCollapsed = useSettingsStore((s) => s.chatAreaCollapsed);
  const setChatAreaCollapsed = useSettingsStore((s) => s.setChatAreaCollapsed);
  const setTTSMuted = useSettingsStore((s) => s.setTTSMuted);
  const setTTSVolume = useSettingsStore((s) => s.setTTSVolume);

  // When entering mobile / iPad preview mode, auto-open both the scene
  // sidebar and the chat panel so the 3-pane classroom layout fills the
  // device viewport. Otherwise the slide canvas (locked to a 16:9 aspect
  // ratio and centred) leaves a large empty horizontal gutter on the right
  // of the device frame, which looks like the page is cut off.
  // We also save the publisher's web-mode collapse preferences so they are
  // restored when switching back to the web view — preview-mode toggles
  // never leak into the web experience.
  const webCollapsePrefsRef = useRef<{ sidebar: boolean; chat: boolean } | null>(null);
  const wasDeviceFramePreviewRef = useRef(isDeviceFramePreview);
  // Publisher edit view defaults to on; publisher preview (web) is toggled via header.
  const [publisherEditView, setPublisherEditView] = useState(initialPublisherEditView);

  // Device preview (phone / iPad) is only available in publisher preview — not edit.
  useEffect(() => {
    if (publisherEditView && previewDevice !== 'web') {
      setPreviewDevice('web');
    }
  }, [publisherEditView, previewDevice, setPreviewDevice]);

  useEffect(() => {
    const wasDeviceFrame = wasDeviceFramePreviewRef.current;
    wasDeviceFramePreviewRef.current = isDeviceFramePreview;

    if (isDeviceFramePreview && !wasDeviceFrame) {
      webCollapsePrefsRef.current = {
        sidebar: useSettingsStore.getState().sidebarCollapsed,
        chat: useSettingsStore.getState().chatAreaCollapsed,
      };
      setSidebarCollapsed(false);
      setChatAreaCollapsed(false);
      // Mobile / iPad views are read-only previews, so any in-flight edit
      // session must be exited — otherwise edit chrome (selection rings, drag
      // handles) would leak through into the student-facing preview.
      useEditModeStore.getState().setEditing(false);
      useCanvasStore.getState().setWhiteboardOpen(false);
    } else if (!isDeviceFramePreview && wasDeviceFrame) {
      if (webCollapsePrefsRef.current) {
        setSidebarCollapsed(webCollapsePrefsRef.current.sidebar);
        setChatAreaCollapsed(webCollapsePrefsRef.current.chat);
        webCollapsePrefsRef.current = null;
      }
      // Preserve publisher preview vs edit — switching web ↔ mobile/iPad must
      // not force the user back into edit mode when they were previewing.
    }
  }, [isDeviceFramePreview, setSidebarCollapsed, setChatAreaCollapsed]);

  // Start per-tab study timer on first real scene view in playback (completion page duration).
  useEffect(() => {
    const id = stage?.id;
    if (!id || mode !== 'playback') return;
    if (!currentSceneId || currentSceneId === PENDING_SCENE_ID) return;
    ensureStudySessionStarted(id);
  }, [mode, currentSceneId, stage?.id]);

  // PlaybackEngine state
  const [engineMode, setEngineMode] = useState<EngineMode>('idle');
  const [playbackCompleted, setPlaybackCompleted] = useState(false); // Distinguishes "never played" idle from "finished" idle
  const [lectureSpeech, setLectureSpeech] = useState<string | null>(null); // From PlaybackEngine (lecture)
  const [liveSpeech, setLiveSpeech] = useState<string | null>(null); // From buffer (discussion/QA)
  const [speechProgress, setSpeechProgress] = useState<number | null>(null); // StreamBuffer reveal progress (0–1)
  const [lectureAudioProgress, setLectureAudioProgress] = useState<{
    currentMs: number;
    durationMs: number;
  } | null>(null);
  const [discussionTrigger, setDiscussionTrigger] = useState<TriggerEvent | null>(null);

  // Speaking agent tracking (Issue 2)
  const [speakingAgentId, setSpeakingAgentId] = useState<string | null>(null);

  // Thinking state (Issue 5)
  const [thinkingState, setThinkingState] = useState<{
    stage: string;
    agentId?: string;
  } | null>(null);

  // Cue user state (Issue 7)
  const [isCueUser, setIsCueUser] = useState(false);

  // End flash state (Issue 3)
  const [showEndFlash, setShowEndFlash] = useState(false);
  const [endFlashSessionType, setEndFlashSessionType] = useState<'qa' | 'discussion'>('discussion');

  // Streaming state for stop button (Issue 1)
  const [chatIsStreaming, setChatIsStreaming] = useState(false);
  const [chatSessionType, setChatSessionType] = useState<string | null>(null);

  // Topic pending state: session is soft-paused, bubble stays visible, waiting for user input
  const [isTopicPending, setIsTopicPending] = useState(false);

  // Active bubble ID for playback highlight in chat area (Issue 8)
  const [activeBubbleId, setActiveBubbleId] = useState<string | null>(null);

  // Scene switch confirmation dialog state
  const [pendingSceneId, setPendingSceneId] = useState<string | null>(null);
  const [isPresenting, setIsPresenting] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isPresentationInteractionActive, setIsPresentationInteractionActive] = useState(false);

  // Whiteboard state (from canvas store so AI tools can open it)
  const whiteboardOpen = useCanvasStore.use.whiteboardOpen();
  const setWhiteboardOpen = useCanvasStore.use.setWhiteboardOpen();

  // ─── Publisher (ToB) editor view ──────────────────────────────────────
  // Default landing experience for publishers arriving from "AI 生成课堂".
  // In this lean view:
  //   • The slide canvas auto-enters edit mode (no manual "进入编辑").
  //   • The 笔记 panel (lecture notes — editable content) stays visible.
  //   • The AI 老师 speech bubble (inline play) stays visible for narration preview.
  //   • Only the RUNTIME interactive surfaces (student avatars, mic/text
  //     input dock, ProactiveCard, "your turn" cue) collapse — those are
  //     student-side affordances, not editing tools.
  // Clicking the header "预览" button flips to the full webpage version
  // (full Roundtable with avatars + mic + chat input, etc.) so the
  // publisher can preview the student experience.
  const togglePublisherEditView = useCallback(() => {
    setPublisherEditView((prev) => {
      if (prev) {
        useEditModeStore.getState().setEditing(false);
      }
      return !prev;
    });
  }, []);

  const openPublisherPreview = useCallback(async () => {
    if (!stage?.id) {
      toast.error('课堂尚未加载完成，暂时无法预览');
      return;
    }

    const editStore = useEditModeStore.getState();
    try {
      if (editStore.isEditing) {
        await editStore.saveEdits();
      }
      editStore.setEditing(false);
      useCanvasStore.getState().setWhiteboardOpen(false);
      await flushStageSave();
    } catch {
      toast.error('保存失败，请稍后重试预览');
      return;
    }

    const previewWindow = window.open(
      buildClassroomPreviewPath(stage.id),
      buildClassroomPreviewWindowName(stage.id),
    );
    previewWindow?.focus();
  }, [stage?.id]);

  /** Lecture notes are editable only in publisher edit view (not student preview). */
  const lectureNotesReadOnly = isDeviceFramePreview || !publisherEditView;
  /** Sidebar / canvas: read-only in device preview or student-facing preview. */
  const workspaceReadOnly = isDeviceFramePreview || !publisherEditView;
  /** Publisher student preview (web / phone / iPad) — enables mock Q&A when no model. */
  const usePreviewMockChat = !publisherEditView;

  // Selected agents from settings store (Zustand)
  const selectedAgentIds = useSettingsStore((s) => s.selectedAgentIds);
  const ttsMuted = useSettingsStore((s) => s.ttsMuted);
  const ttsEnabled = useSettingsStore((s) => s.ttsEnabled);
  // v1.12 — subscribe so the mobile / iPad control bar updates when
  // the publisher cycles speed or toggles auto-play in preview mode.
  const previewPlaybackSpeed = useSettingsStore((s) => s.playbackSpeed);
  const previewAutoPlayLecture = useSettingsStore((s) => s.autoPlayLecture);
  const teacherSubtitlesVisible = useSettingsStore((s) => s.teacherSubtitlesVisible);
  const realtimeQAEnabled = useSettingsStore((s) => s.realtimeQAEnabled);
  const teacherCustomDisplayName = useSettingsStore((s) => s.teacherCustomDisplayName);
  const teacherCustomAvatar = useSettingsStore((s) => s.teacherCustomAvatar);
  const presetAgentOverrides = useSettingsStore((s) => s.presetAgentOverrides);

  // Generate participants from selected agents
  const participants = useMemo(() => {
    const displayNameById: Record<string, string> = {};
    const avatarById: Record<string, string> = {};
    const tn = teacherCustomDisplayName.trim();
    if (tn) displayNameById['default-1'] = tn;
    const ta = teacherCustomAvatar.trim();
    if (ta) avatarById['default-1'] = ta;
    for (const [id, row] of Object.entries(presetAgentOverrides ?? {})) {
      const n = row?.name?.trim();
      if (n) displayNameById[id] = n;
      const av = row?.avatar?.trim();
      if (av) avatarById[id] = av;
    }
    return agentsToParticipants(selectedAgentIds, t, { displayNameById, avatarById });
  }, [selectedAgentIds, t, presetAgentOverrides, teacherCustomDisplayName, teacherCustomAvatar]);

  // Resolved AgentConfig array for hooks that need full agent objects
  // Subscribe to the agents record so voiceConfig changes trigger re-resolution
  const agentsRecord = useAgentRegistry((s) => s.agents);
  const selectedAgents = useMemo(
    () => selectedAgentIds.map((id) => agentsRecord[id]).filter((a): a is AgentConfig => a != null),
    [agentsRecord, selectedAgentIds],
  );

  // Discussion TTS: audio indicator state
  const [audioIndicatorState, setAudioIndicatorState] = useState<AudioIndicatorState>('idle');
  const [audioAgentId, setAudioAgentId] = useState<string | null>(null);

  const discussionTTS = useDiscussionTTS({
    enabled: ttsEnabled && !ttsMuted,
    agents: selectedAgents,
    onAudioStateChange: (agentId, state) => {
      setAudioAgentId(agentId);
      setAudioIndicatorState(state);
    },
  });

  // Pick a student agent for discussion trigger (prioritize student > non-teacher > fallback)
  const pickStudentAgent = useCallback((): string => {
    const registry = useAgentRegistry.getState();
    const agents = selectedAgentIds
      .map((id) => registry.getAgent(id))
      .filter((a): a is AgentConfig => a != null);
    const students = agents.filter((a) => a.role === 'student');
    if (students.length > 0) {
      return students[Math.floor(Math.random() * students.length)].id;
    }
    const nonTeachers = agents.filter((a) => a.role !== 'teacher');
    if (nonTeachers.length > 0) {
      return nonTeachers[Math.floor(Math.random() * nonTeachers.length)].id;
    }
    return agents[0]?.id || 'default-1';
  }, [selectedAgentIds]);

  const engineRef = useRef<PlaybackEngine | null>(null);
  const audioPlayerRef = useRef(createAudioPlayer());
  const engineModeRef = useRef(engineMode);
  const topicPendingRef = useRef(isTopicPending);
  const chatAreaRef = useRef<ChatAreaRef>(null);
  const lectureSessionIdRef = useRef<string | null>(null);
  const lectureActionCounterRef = useRef(0);
  const discussionAbortRef = useRef<AbortController | null>(null);
  const presentationIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  // Guard to prevent double flash when manual stop triggers onDiscussionEnd
  const manualStopRef = useRef(false);
  // Monotonic counter incremented on each scene switch — used to discard stale SSE callbacks
  const sceneEpochRef = useRef(0);
  // When true, the next engine init will auto-start playback (for auto-play scene advance)
  const autoStartRef = useRef(false);
  // Discussion buffer-level pause state (distinct from soft-pause which aborts SSE)
  const [isDiscussionPaused, setIsDiscussionPaused] = useState(false);

  /**
   * Resume a soft-paused topic: re-call /chat with existing session messages.
   * The director picks the next agent to continue.
   */
  const doResumeTopic = useCallback(async () => {
    // Clear old bubble immediately — no lingering on interrupted text
    setIsTopicPending(false);
    setLiveSpeech(null);
    setSpeakingAgentId(null);
    setThinkingState({ stage: 'director' });
    setChatIsStreaming(true);
    // Transition engine back to live — onInputActivate paused it when soft-pausing,
    // so we must explicitly resume to keep engine mode in sync with the chat loop.
    engineRef.current?.resume();
    // Fire new chat round — SSE events will drive thinking → agent_start → speech
    await chatAreaRef.current?.resumeActiveSession();
  }, []);

  /** Reset all live/discussion state (shared by doSessionCleanup & onDiscussionEnd) */
  const resetLiveState = useCallback(() => {
    setLiveSpeech(null);
    setSpeakingAgentId(null);
    setSpeechProgress(null);
    setThinkingState(null);
    setIsCueUser(false);
    setIsTopicPending(false);
    setChatIsStreaming(false);
    setChatSessionType(null);
    setIsDiscussionPaused(false);
  }, []);

  /** Full scene reset (scene switch) — resetLiveState + lecture/visual state */
  const resetSceneState = useCallback(() => {
    resetLiveState();
    setPlaybackCompleted(false);
    setLectureSpeech(null);
    setSpeechProgress(null);
    setShowEndFlash(false);
    setActiveBubbleId(null);
    setDiscussionTrigger(null);
  }, [resetLiveState]);

  /** Request failure should exit live discussion UI without hard-closing the session. */
  const handleLiveSessionError = useCallback(() => {
    engineRef.current?.handleDiscussionError();
    resetLiveState();
    setActiveBubbleId(null);
  }, [resetLiveState]);

  /**
   * Unified session cleanup — called by both roundtable stop button and chat area end button.
   * Handles: engine transition, flash, roundtable state clearing.
   */
  const doSessionCleanup = useCallback(() => {
    const activeType = chatSessionType;

    // Engine cleanup — guard to avoid double flash from onDiscussionEnd
    manualStopRef.current = true;
    engineRef.current?.handleEndDiscussion();
    manualStopRef.current = false;

    // Show end flash with correct session type
    if (activeType === 'qa' || activeType === 'discussion') {
      setEndFlashSessionType(activeType);
      setShowEndFlash(true);
      setTimeout(() => setShowEndFlash(false), 1800);
    }

    // Stop any in-flight discussion TTS audio
    discussionTTS.cleanup();

    resetLiveState();
  }, [chatSessionType, resetLiveState, discussionTTS]);

  // Shared stop-discussion handler (used by both Roundtable and Canvas toolbar)
  const handleStopDiscussion = useCallback(async () => {
    await chatAreaRef.current?.endActiveSession();
    doSessionCleanup();
  }, [doSessionCleanup]);

  const clearPresentationIdleTimer = useCallback(() => {
    if (presentationIdleTimerRef.current) {
      clearTimeout(presentationIdleTimerRef.current);
      presentationIdleTimerRef.current = null;
    }
  }, []);

  const resetPresentationIdleTimer = useCallback(() => {
    setControlsVisible(true);
    clearPresentationIdleTimer();
    if (isPresenting && !isPresentationInteractionActive) {
      presentationIdleTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    }
  }, [clearPresentationIdleTimer, isPresenting, isPresentationInteractionActive]);

  const togglePresentation = useCallback(async () => {
    const stageElement = stageRef.current;
    if (!stageElement) return;

    try {
      if (document.fullscreenElement === stageElement) {
        // Unlock Escape key before exiting fullscreen
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigator as any).keyboard?.unlock?.();
        await document.exitFullscreen();
        return;
      }

      setControlsVisible(true);
      await stageElement.requestFullscreen();
      // Lock Escape key so it doesn't auto-exit fullscreen (#255)
      // Escape is handled manually in our keydown handler instead
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (navigator as any).keyboard?.lock?.(['Escape']).catch(() => {});
      setSidebarCollapsed(true);
      setChatAreaCollapsed(true);
    } catch {
      // Firefox may deny fullscreen from certain keyboard events (e.g. F11)
      console.warn('[Presentation] Fullscreen request denied — browser policy');
    }
  }, [setChatAreaCollapsed, setSidebarCollapsed]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = document.fullscreenElement === stageRef.current;
      setIsPresenting(active);

      if (!active) {
        // Ensure keyboard unlock on any fullscreen exit
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigator as any).keyboard?.unlock?.();
        setControlsVisible(true);
        clearPresentationIdleTimer();
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [clearPresentationIdleTimer]);

  // ─── Edit-mode → engine auto-pause ──────────────────────────────────
  // Whenever the publisher flips into edit mode, pause the playback engine so
  // their edits aren't fighting an in-flight scene. Resume is intentionally
  // *not* automatic on exit — they should hit Play themselves so the engine
  // doesn't surprise-restart audio after a long edit session.
  const isEditing = useEditModeStore.use.isEditing();
  const saveEdits = useEditModeStore.use.saveEdits();
  const wasEditingRef = useRef(false);
  // Edit workspace: slide thumbnails + 笔记 stay pinned open (no collapse toggles).
  const pinLayoutPanels = publisherEditView || isEditing;

  // Publisher ToB: Ctrl/Cmd+S flushes slide changes without leaving edit mode.
  useEffect(() => {
    if (!publisherEditView || !isEditing) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 's' || !(e.ctrlKey || e.metaKey)) return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }
      e.preventDefault();
      void saveEdits()
        .then(() => toast.success(t('editMode.savedToast')))
        .catch(() => toast.error(t('editMode.saveFailedToast')));
    };

    globalThis.addEventListener('keydown', onKeyDown);
    return () => globalThis.removeEventListener('keydown', onKeyDown);
  }, [publisherEditView, isEditing, saveEdits, t]);

  // Seed a global undo baseline when the publisher first enters edit mode.
  useEffect(() => {
    const enteredEdit = isEditing && !wasEditingRef.current;
    wasEditingRef.current = isEditing;
    if (!enteredEdit || !publisherEditView) return;

    void useSnapshotStore
      .getState()
      .resetEditSessionSnapshots()
      .then(() => {
        useEditModeStore.setState({
          editSessionBaselineSnapshotCursor: useSnapshotStore.getState().snapshotCursor,
        });
      });
  }, [isEditing, publisherEditView]);

  // Global undo/redo stack (cross-slide navigation handled in snapshot store).
  useEffect(() => {
    if (!publisherEditView || !isEditing) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.closest('[data-global-edit-history-exclude]'))
      ) {
        return;
      }

      const key = e.key.toUpperCase();
      const isRedo = key === KEYS.Y || (key === KEYS.Z && e.shiftKey);
      const isUndo = key === KEYS.Z && !e.shiftKey;
      if (!isUndo && !isRedo) return;

      const { undo, redo, canUndo, canRedo } = useSnapshotStore.getState();
      if (isUndo && !canUndo()) return;
      if (isRedo && !canRedo()) return;

      e.preventDefault();
      void (isUndo ? undo() : redo());
    };

    globalThis.addEventListener('keydown', onKeyDown);
    return () => globalThis.removeEventListener('keydown', onKeyDown);
  }, [publisherEditView, isEditing]);

  useEffect(() => {
    if (isEditing) {
      try {
        engineRef.current?.pause();
        discussionTTS.pause();
      } catch (e) {
        // If pause throws (e.g. engine already disposed), there's nothing to
        // recover — the publisher is editing, the engine is silent. This
        // catch keeps the UI from going down with the engine.
        console.warn('[edit-mode] engine.pause() failed:', e);
      }
    }
  }, [isEditing, discussionTTS]);

  // Scene switches should preserve edit mode for batch editing across slides,
  // but per-scene canvas/text selections must not leak into the next scene.
  const clearCanvasSelection = useCanvasStore.use.clearSelection();
  const setSelectedEditElementId = useEditModeStore.use.setSelectedElementId();
  const setEditing = useEditModeStore.use.setEditing();
  useEffect(() => {
    clearCanvasSelection();
    setSelectedEditElementId(null);

    const editableScene =
      currentScene?.type === 'slide' ||
      currentScene?.type === 'quiz' ||
      currentScene?.type === 'interactive' ||
      currentScene?.type === 'pbl';

    // Publisher edit view auto-enters manual edit mode so editing is the
    // default experience after AI generation — there's no longer a manual
    // "进入编辑" button to click. Slides get full PPTist editing; quizzes get
    // a constrained editor for question text, option text/order, and correct
    // answers. Switching back to preview view exits edit mode so the playback
    // engine can resume cleanly without leftover edit chrome.
    if (publisherEditView && (currentScene?.type === 'slide' || currentScene?.type === 'quiz')) {
      setEditing(true);
    } else if (!editableScene || !publisherEditView) {
      setEditing(false);
    }
  }, [
    currentSceneId,
    currentScene?.type,
    publisherEditView,
    clearCanvasSelection,
    setSelectedEditElementId,
    setEditing,
  ]);

  useEffect(() => {
    if (pinLayoutPanels) {
      setSidebarCollapsed(false);
      setChatAreaCollapsed(false);
    }
  }, [pinLayoutPanels, setSidebarCollapsed, setChatAreaCollapsed]);

  useEffect(() => {
    if (!isPresenting) {
      setControlsVisible(true);
      clearPresentationIdleTimer();
      return;
    }

    const handleActivity = () => {
      resetPresentationIdleTimer();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    if (isPresentationInteractionActive) {
      setControlsVisible(true);
      clearPresentationIdleTimer();
    } else {
      resetPresentationIdleTimer();
    }

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      clearPresentationIdleTimer();
    };
  }, [
    clearPresentationIdleTimer,
    isPresenting,
    isPresentationInteractionActive,
    resetPresentationIdleTimer,
  ]);

  // Initialize playback engine when scene changes
  useEffect(() => {
    // Bump epoch so any stale SSE callbacks from the previous scene are discarded
    sceneEpochRef.current++;

    // End any active QA/discussion session — this synchronously aborts the SSE
    // stream inside use-chat-sessions (abortControllerRef.abort()), preventing
    // stale onLiveSpeech callbacks from leaking into the new scene.
    chatAreaRef.current?.endActiveSession();

    // Also abort the engine-level discussion controller
    if (discussionAbortRef.current) {
      discussionAbortRef.current.abort();
      discussionAbortRef.current = null;
    }

    // Stop any in-flight discussion TTS audio on scene switch
    discussionTTS.cleanup();

    // Reset all roundtable/live state so scenes are fully isolated
    resetSceneState();

    if (!currentScene || !currentScene.actions || currentScene.actions.length === 0) {
      engineRef.current = null;
      setEngineMode('idle');

      return;
    }

    // Stop previous engine
    if (engineRef.current) {
      engineRef.current.stop();
    }

    // Get widget iframe messaging callback for interactive scenes (keyed by sceneId)
    const widgetSendMessage = useWidgetIframeStore.getState().getSendMessage(currentScene.id);

    // Create ActionEngine for playback (with audioPlayer for TTS and widget messaging)
    const actionEngine = new ActionEngine(useStageStore, audioPlayerRef.current, widgetSendMessage);

    // Create new PlaybackEngine
    const engine = new PlaybackEngine([currentScene], actionEngine, audioPlayerRef.current, {
      onModeChange: (mode) => {
        setEngineMode(mode);
      },
      onSceneChange: (_sceneId) => {
        // Scene change handled by engine
      },
      onSpeechStart: (text) => {
        setLectureSpeech(text);
        // Add to lecture session with incrementing index for dedup
        // Chat area pacing is handled by the StreamBuffer (onTextReveal)
        if (lectureSessionIdRef.current) {
          const idx = lectureActionCounterRef.current++;
          const speechId = `speech-${Date.now()}`;
          chatAreaRef.current?.addLectureMessage(
            lectureSessionIdRef.current,
            { id: speechId, type: 'speech', text } as Action,
            idx,
          );
          // Track active bubble for highlight (Issue 8)
          const msgId = chatAreaRef.current?.getLectureMessageId(lectureSessionIdRef.current!);
          if (msgId) setActiveBubbleId(msgId);
        }
      },
      onSpeechEnd: () => {
        // Don't clear lectureSpeech — let it persist until the next
        // onSpeechStart replaces it or the scene transitions.
        // Clearing here causes fallback to idleText (first sentence).
        setActiveBubbleId(null);
      },
      onEffectFire: (effect: Effect) => {
        // Add to lecture session with incrementing index
        if (
          lectureSessionIdRef.current &&
          (effect.kind === 'spotlight' || effect.kind === 'laser')
        ) {
          const idx = lectureActionCounterRef.current++;
          chatAreaRef.current?.addLectureMessage(
            lectureSessionIdRef.current,
            {
              id: `${effect.kind}-${Date.now()}`,
              type: effect.kind,
              elementId: effect.targetId,
            } as Action,
            idx,
          );
        }
      },
      onProactiveShow: (trigger) => {
        if (!trigger.agentId) {
          // Mutate in-place so engine.currentTrigger also gets the agentId
          // (confirmDiscussion reads agentId from the same object reference)
          trigger.agentId = pickStudentAgent();
        }
        setDiscussionTrigger(trigger);
      },
      onProactiveHide: () => {
        setDiscussionTrigger(null);
      },
      onDiscussionConfirmed: (topic, prompt, agentId) => {
        // Start SSE discussion via ChatArea
        handleDiscussionSSE(topic, prompt, agentId);
      },
      onDiscussionEnd: () => {
        // Abort any active SSE
        if (discussionAbortRef.current) {
          discussionAbortRef.current.abort();
          discussionAbortRef.current = null;
        }
        setDiscussionTrigger(null);
        // Stop any in-flight discussion TTS audio
        discussionTTS.cleanup();
        // Clear roundtable state (idempotent — may already be cleared by doSessionCleanup)
        resetLiveState();
        // Only show flash for engine-initiated ends (not manual stop — that's handled by doSessionCleanup)
        if (!manualStopRef.current) {
          setEndFlashSessionType('discussion');
          setShowEndFlash(true);
          setTimeout(() => setShowEndFlash(false), 1800);
        }
        // If all actions are exhausted (discussion was the last action), mark
        // playback as completed so the bubble shows reset instead of play.
        if (engineRef.current?.isExhausted()) {
          setPlaybackCompleted(true);
        }
      },
      onUserInterrupt: (text) => {
        // User interrupted → start a discussion via chat
        chatAreaRef.current?.sendMessage(text);
      },
      isAgentSelected: (agentId) => {
        const ids = useSettingsStore.getState().selectedAgentIds;
        return ids.includes(agentId);
      },
      getPlaybackSpeed: () => useSettingsStore.getState().playbackSpeed || 1,
      onComplete: () => {
        // lectureSpeech intentionally NOT cleared — last sentence stays visible
        // until scene transition (auto-play) or user restarts. Scene change
        // effect handles the reset.
        setPlaybackCompleted(true);

        // End lecture session on playback complete
        if (lectureSessionIdRef.current) {
          chatAreaRef.current?.endSession(lectureSessionIdRef.current);
          lectureSessionIdRef.current = null;
        }
        // Auto-play: advance to next scene after a short pause
        const { autoPlayLecture } = useSettingsStore.getState();
        if (autoPlayLecture) {
          setTimeout(() => {
            const stageState = useStageStore.getState();
            if (!useSettingsStore.getState().autoPlayLecture) return;
            const allScenes = stageState.scenes;
            const curId = stageState.currentSceneId;
            const idx = allScenes.findIndex((s) => s.id === curId);
            if (idx >= 0 && idx < allScenes.length - 1) {
              const currentScene = allScenes[idx];
              if (
                currentScene.type === 'quiz' ||
                currentScene.type === 'interactive' ||
                currentScene.type === 'pbl'
              ) {
                return;
              }
              autoStartRef.current = true;
              stageState.setCurrentSceneId(allScenes[idx + 1].id);
            } else if (idx === allScenes.length - 1 && stageState.generatingOutlines.length > 0) {
              // Last scene exhausted but next is still generating — go to pending page
              const currentScene = allScenes[idx];
              if (
                currentScene.type === 'quiz' ||
                currentScene.type === 'interactive' ||
                currentScene.type === 'pbl'
              ) {
                return;
              }
              autoStartRef.current = true;
              stageState.setCurrentSceneId(PENDING_SCENE_ID);
            }
          }, 1500);
        }
      },
    });

    engineRef.current = engine;

    // Auto-start if triggered by auto-play scene advance
    if (autoStartRef.current) {
      autoStartRef.current = false;
      (async () => {
        if (currentScene && chatAreaRef.current) {
          const sessionId = await chatAreaRef.current.startLecture(currentScene.id);
          lectureSessionIdRef.current = sessionId;
          lectureActionCounterRef.current = 0;
        }
        engine.start();
      })();
    } else {
      // Load saved playback state and restore position (but never auto-play).
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only re-run when scene changes, functions are stable refs
  }, [currentScene]);

  // Cleanup on unmount
  useEffect(() => {
    const audioPlayer = audioPlayerRef.current;
    const chatArea = chatAreaRef.current;
    return () => {
      if (engineRef.current) {
        engineRef.current.stop();
      }
      audioPlayer.destroy();
      if (discussionAbortRef.current) {
        discussionAbortRef.current.abort();
      }
      discussionTTS.cleanup();
      chatArea?.endActiveSession();
      clearPresentationIdleTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only cleanup, clearPresentationIdleTimer is stable
  }, []);

  // Sync mute state from settings store to audioPlayer
  useEffect(() => {
    audioPlayerRef.current.setMuted(ttsMuted);
  }, [ttsMuted]);

  // Sync volume from settings store to audioPlayer
  const ttsVolume = useSettingsStore((s) => s.ttsVolume);
  useEffect(() => {
    if (!ttsMuted) {
      audioPlayerRef.current.setVolume(ttsVolume);
    }
  }, [ttsVolume, ttsMuted]);

  // Sync playback speed to audio player (for live-updating current audio)
  const playbackSpeed = useSettingsStore((s) => s.playbackSpeed);
  useEffect(() => {
    audioPlayerRef.current.setPlaybackRate(playbackSpeed);
  }, [playbackSpeed]);

  useEffect(() => {
    engineModeRef.current = engineMode;
    topicPendingRef.current = isTopicPending;
  }, [engineMode, isTopicPending]);

  const handleLectureAudioSeek = useCallback((ratio: number) => {
    const ap = audioPlayerRef.current;
    if (ap.hasActiveAudio()) {
      ap.seekToRatio(ratio);
      return;
    }
    const sid = lectureSessionIdRef.current;
    if (sid) {
      chatAreaRef.current?.seekLectureSpeechReveal(sid, ratio);
    }
  }, []);

  useEffect(() => {
    const ap = audioPlayerRef.current;
    const onTick = () => {
      // `chatIsStreaming` is also true while lecture notes stream to the
      // sidebar — that must NOT hide HTML-audio seek (it made the bar
      // never appear during normal playback).
      if (engineModeRef.current === 'live' || topicPendingRef.current) {
        setLectureAudioProgress(null);
        return;
      }
      if (!ap.hasActiveAudio()) {
        setLectureAudioProgress(null);
        return;
      }
      const d = ap.getDuration();
      const c = ap.getCurrentTime();
      if (d > 0 && Number.isFinite(d)) {
        setLectureAudioProgress({ currentMs: c, durationMs: d });
      } else {
        setLectureAudioProgress(null);
      }
    };
    ap.setOnMediaProgress(onTick);
    return () => ap.setOnMediaProgress(null);
  }, []);

  /**
   * Handle discussion SSE — POST /api/chat and push events to engine
   */
  const handleDiscussionSSE = useCallback(
    async (topic: string, prompt?: string, agentId?: string) => {
      // Start discussion display in ChatArea (lecture speech is preserved independently)
      chatAreaRef.current?.startDiscussion({
        topic,
        prompt,
        agentId: agentId || 'default-1',
      });
      // Auto-switch to chat tab when discussion starts
      chatAreaRef.current?.switchToTab('chat');
      // Immediately mark streaming for synchronized stop button
      setChatIsStreaming(true);
      setChatSessionType('discussion');
      // Optimistic thinking: show thinking dots immediately (same as onMessageSend)
      setThinkingState({ stage: 'director' });
    },
    [],
  );

  // First speech text for idle display (extracted here for playbackView)
  const firstSpeechText = useMemo(
    () => currentScene?.actions?.find((a): a is SpeechAction => a.type === 'speech')?.text ?? null,
    [currentScene],
  );

  // Whether the speaking agent is a student (for bubble role derivation)
  const speakingStudentFlag = useMemo(() => {
    if (!speakingAgentId) return false;
    const agent = useAgentRegistry.getState().getAgent(speakingAgentId);
    return agent?.role !== 'teacher';
  }, [speakingAgentId]);

  // Centralised derived playback view
  const playbackView = useMemo(
    () =>
      computePlaybackView({
        engineMode,
        lectureSpeech,
        liveSpeech,
        speakingAgentId,
        thinkingState,
        isCueUser,
        isTopicPending,
        chatIsStreaming,
        discussionTrigger,
        playbackCompleted,
        idleText: firstSpeechText,
        speakingStudent: speakingStudentFlag,
        sessionType: chatSessionType,
      }),
    [
      engineMode,
      lectureSpeech,
      liveSpeech,
      speakingAgentId,
      thinkingState,
      isCueUser,
      isTopicPending,
      chatIsStreaming,
      discussionTrigger,
      playbackCompleted,
      firstSpeechText,
      speakingStudentFlag,
      chatSessionType,
    ],
  );

  /** Publisher configures subtitles in edit view; preview/students respect the toggle. */
  const showTeacherSpeechInChrome = teacherSubtitlesVisible;
  const hideLectureNotesInPanel = !publisherEditView && !teacherSubtitlesVisible;
  const collapseChatPanelForSubtitles =
    hideLectureNotesInPanel && !realtimeQAEnabled && !isDeviceFramePreview;

  const studentPlaybackView = useMemo(
    () =>
      showTeacherSpeechInChrome ? playbackView : { ...playbackView, sourceText: '' },
    [showTeacherSpeechInChrome, playbackView],
  );

  const visibleLiveSpeech = showTeacherSpeechInChrome ? liveSpeech : null;
  const visibleLectureSpeech = showTeacherSpeechInChrome ? lectureSpeech : null;
  const visibleIdleText = showTeacherSpeechInChrome ? firstSpeechText : '';

  const isTopicActive = playbackView.isTopicActive;

  /**
   * Gated scene switch — if a topic is active, show AlertDialog before switching.
   * Returns true if the switch was immediate, false if gated (dialog shown).
   */
  const gatedSceneSwitch = useCallback(
    (targetSceneId: string): boolean => {
      if (targetSceneId === currentSceneId) return false;
      if (isTopicActive) {
        setPendingSceneId(targetSceneId);
        return false;
      }
      setCurrentSceneId(targetSceneId);
      return true;
    },
    [currentSceneId, isTopicActive, setCurrentSceneId],
  );

  /** User confirmed scene switch via AlertDialog */
  const confirmSceneSwitch = useCallback(() => {
    if (!pendingSceneId) return;
    chatAreaRef.current?.endActiveSession();
    doSessionCleanup();
    setCurrentSceneId(pendingSceneId);
    setPendingSceneId(null);
  }, [pendingSceneId, setCurrentSceneId, doSessionCleanup]);

  /** User cancelled scene switch via AlertDialog */
  const cancelSceneSwitch = useCallback(() => {
    setPendingSceneId(null);
  }, []);

  /** Regenerate cloud TTS when the publisher edited the script (audio cleared). */
  const regenerateTtsForCurrentSceneIfNeeded = useCallback(async (): Promise<void> => {
    if (!publisherEditView || !currentScene?.actions?.length) return;

    const needsTts = currentScene.actions.some(
      (a) =>
        a.type === 'speech' &&
        !!(a as SpeechAction).text &&
        !(a as SpeechAction).audioId &&
        !(a as SpeechAction).publisherVoiceUploadedAt,
    );
    if (!needsTts) return;

    const { ttsEnabled, ttsProviderId } = useSettingsStore.getState();
    if (!ttsEnabled || ttsProviderId === 'browser-native-tts') return;

    const workingScene = {
      ...currentScene,
      actions: currentScene.actions.map((a) => ({ ...a })),
    };
    const result = await generateTTSForScene(workingScene, stage?.languageDirective);
    updateScene(currentScene.id, {
      actions: workingScene.actions,
      updatedAt: Date.now(),
    });
    if (!result.success && result.failedCount > 0) {
      toast.warning(t('chat.lectureNotes.ttsPartialFailed'));
    }
    // Let the scene-change effect rebuild PlaybackEngine with fresh audio ids.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }, [publisherEditView, currentScene, stage?.languageDirective, updateScene, t]);

  // play/pause toggle
  const handlePlayPause = useCallback(async () => {
    let engine = engineRef.current;
    if (!engine) return;

    const mode = engine.getMode();
    if (mode === 'playing' || mode === 'live') {
      engine.pause();
      // Pause lecture buffer so text stops immediately
      if (lectureSessionIdRef.current) {
        chatAreaRef.current?.pauseBuffer(lectureSessionIdRef.current);
      }
    } else if (mode === 'paused') {
      engine.resume();
      // Resume lecture buffer
      if (lectureSessionIdRef.current) {
        chatAreaRef.current?.resumeBuffer(lectureSessionIdRef.current);
      }
    } else {
      await regenerateTtsForCurrentSceneIfNeeded();
      engine = engineRef.current;
      if (!engine) return;

      const wasCompleted = playbackCompleted;
      setPlaybackCompleted(false);
      // Starting playback - create/reuse lecture session
      if (currentScene && chatAreaRef.current) {
        const sessionId = await chatAreaRef.current.startLecture(currentScene.id);
        lectureSessionIdRef.current = sessionId;
      }
      if (wasCompleted) {
        // Restart from beginning (user clicked restart after completion)
        lectureActionCounterRef.current = 0;
        engine.start();
      } else {
        // Continue from current position (e.g. after discussion end)
        engine.continuePlayback();
      }
    }
  }, [playbackCompleted, currentScene, regenerateTtsForCurrentSceneIfNeeded]);

  // get scene information
  const isPendingScene = currentSceneId === PENDING_SCENE_ID;
  const hasNextPending = generatingOutlines.length > 0;
  // True when every outline has materialized into a scene and nothing is
  // currently generating — signals the classroom has finished and the user
  // can see a completion page. Comparing scenes.length === outlines.length
  // (rather than just `scenes.length > 0`) means a partial generation with
  // some failed outlines does not falsely trigger completion.
  const isCourseComplete =
    outlines.length > 0 && scenes.length === outlines.length && generatingOutlines.length === 0;
  const canAdvanceToPendingSlot = hasNextPending || isCourseComplete;

  // previous scene (gated)
  const handlePreviousScene = useCallback(() => {
    if (isPendingScene) {
      // From pending page → go to last real scene
      if (scenes.length > 0) {
        gatedSceneSwitch(scenes[scenes.length - 1].id);
      }
      return;
    }
    const currentIndex = scenes.findIndex((s) => s.id === currentSceneId);
    if (currentIndex > 0) {
      gatedSceneSwitch(scenes[currentIndex - 1].id);
    }
  }, [currentSceneId, gatedSceneSwitch, isPendingScene, scenes]);

  // next scene (gated)
  const handleNextScene = useCallback(() => {
    if (isPendingScene) return; // Already on pending, nowhere to go
    const currentIndex = scenes.findIndex((s) => s.id === currentSceneId);
    if (currentIndex < scenes.length - 1) {
      gatedSceneSwitch(scenes[currentIndex + 1].id);
    } else if (canAdvanceToPendingSlot) {
      // On last real scene → advance to pending slot (generating or completion page)
      setCurrentSceneId(PENDING_SCENE_ID);
    }
  }, [
    currentSceneId,
    gatedSceneSwitch,
    canAdvanceToPendingSlot,
    isPendingScene,
    scenes,
    setCurrentSceneId,
  ]);

  const currentSceneIndex = isPendingScene
    ? scenes.length
    : scenes.findIndex((s) => s.id === currentSceneId);
  const totalScenesCount = scenes.length + (canAdvanceToPendingSlot ? 1 : 0);
  const currentLectureNote = getCurrentLectureNote(lectureNotes, currentSceneId);

  // get action information
  const totalActions = currentScene?.actions?.length || 0;

  // whiteboard toggle
  const handleWhiteboardToggle = () => {
    setWhiteboardOpen(!whiteboardOpen);
  };

  const isPresentationShortcutTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;

    if (target.isContentEditable || target.closest('[contenteditable="true"]')) {
      return true;
    }

    return (
      target.closest(
        ['input', 'textarea', 'select', '[role="slider"]', 'input[type="range"]'].join(', '),
      ) !== null
    );
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      // Let modifier-key combos (Ctrl+C, Ctrl+S, etc.) pass through to the browser
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (
        isPresentationShortcutTarget(event.target) ||
        isPresentationShortcutTarget(document.activeElement)
      ) {
        return;
      }

      switch (event.key) {
        case 'ArrowLeft':
          if (!isPresenting) return;
          event.preventDefault();
          handlePreviousScene();
          resetPresentationIdleTimer();
          break;
        case 'ArrowRight':
          if (!isPresenting) return;
          event.preventDefault();
          handleNextScene();
          resetPresentationIdleTimer();
          break;
        case ' ':
        case 'Spacebar':
          // During active QA/discussion, Roundtable owns Space for
          // buffer-level pause/resume — don't also fire engine play/pause.
          if (chatSessionType === 'qa' || chatSessionType === 'discussion') break;
          event.preventDefault();
          handlePlayPause();
          break;
        case 'Escape':
          // With keyboard.lock(), Escape no longer auto-exits fullscreen.
          // If panels are open, roundtable handles Escape (close panels).
          // If no panels are open, manually exit fullscreen.
          if (isPresenting && !isPresentationInteractionActive) {
            event.preventDefault();
            togglePresentation();
          }
          break;
        case 'ArrowUp':
          event.preventDefault();
          setTTSVolume(ttsVolume + 0.1);
          break;
        case 'ArrowDown':
          event.preventDefault();
          setTTSVolume(ttsVolume - 0.1);
          break;
        case 'm':
        case 'M':
          event.preventDefault();
          setTTSMuted(!ttsMuted);
          break;
        case 's':
        case 'S':
          if (pinLayoutPanels) break;
          event.preventDefault();
          setSidebarCollapsed(!sidebarCollapsed);
          break;
        case 'c':
        case 'C':
          if (pinLayoutPanels) break;
          event.preventDefault();
          setChatAreaCollapsed(!chatAreaCollapsed);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    chatSessionType,
    chatAreaCollapsed,
    handleNextScene,
    handlePlayPause,
    handlePreviousScene,
    isPresenting,
    isPresentationInteractionActive,
    isPresentationShortcutTarget,
    pinLayoutPanels,
    resetPresentationIdleTimer,
    setChatAreaCollapsed,
    setSidebarCollapsed,
    setTTSMuted,
    setTTSVolume,
    sidebarCollapsed,
    togglePresentation,
    ttsMuted,
    ttsVolume,
  ]);

  // Intercept F11 to use our presentation fullscreen instead of browser fullscreen
  // This way ESC can exit fullscreen (browser F11 fullscreen requires F11 to exit)
  useEffect(() => {
    const onF11 = (event: KeyboardEvent) => {
      if (event.key === 'F11') {
        event.preventDefault();
        togglePresentation();
      }
    };

    window.addEventListener('keydown', onF11);
    return () => window.removeEventListener('keydown', onF11);
  }, [togglePresentation]);

  // Map engine mode to the CanvasArea's expected engine state
  const canvasEngineState: 'idle' | 'playing' | 'paused' = (() => {
    switch (engineMode) {
      case 'playing':
      case 'live':
        return 'playing';
      case 'paused':
        return 'paused';
      default:
        return 'idle';
    }
  })();

  // Build discussion request for Roundtable ProactiveCard from trigger
  const discussionRequest: DiscussionAction | null = discussionTrigger
    ? {
        type: 'discussion',
        id: discussionTrigger.id,
        topic: discussionTrigger.question,
        prompt: discussionTrigger.prompt,
        agentId: discussionTrigger.agentId || 'default-1',
      }
    : null;

  // Calculate scene viewer height (subtract Header's 80px height)
  const sceneViewerHeight = (() => {
    const headerHeight = isPresenting ? 0 : 56; // Header h-14 = 56px
    // Roundtable stays mounted for the merged toolbar; publisher edit reserves
    // space for the compact teacher speech strip (avatar + bubble + inline play).
    const roundtableHeight =
      mode === 'playback' && !isPresenting ? (publisherEditView ? 200 : 192) : 0;
    return `calc(100% - ${headerHeight + roundtableHeight}px)`;
  })();

  // ─── Shared classroom view ─────────────────────────────────────
  // Full editor surface (Sidebar + Header + Canvas + Roundtable + Chat).
  // Used as-is by the web view, and rendered identically inside the scaled
  // device frame for mobile / iPad previews — all three views share the same
  // UI and playback engine, only the surrounding chrome (frame + mask)
  // differs.
  const classroomView = (
    <div
      ref={stageRef}
      className={cn(
        'flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900',
        isPresenting && !controlsVisible && 'cursor-none',
        isEditing && 'ring-1 ring-inset ring-violet-300/60 dark:ring-violet-500/40',
      )}
    >
      {!isPresenting && (
        <Header
          classroomTitle={stage?.name ?? ''}
          publisherEditView={publisherEditView}
          onTogglePublisherEditView={togglePublisherEditView}
          onOpenPublisherPreview={openPublisherPreview}
          hideEditToggle={isDeviceFramePreview}
          deviceTabsVariant="pill"
          showSlideInsertTools={
            publisherEditView && !isDeviceFramePreview && currentScene?.type === 'slide'
          }
        />
      )}

      <div className="flex-1 flex overflow-hidden min-h-0">
        <SceneSidebar
          collapsed={pinLayoutPanels ? false : sidebarCollapsed}
          onCollapseChange={setSidebarCollapsed}
          onSceneSelect={gatedSceneSwitch}
          onRetryOutline={onRetryOutline}
          isCourseComplete={isCourseComplete}
          readOnly={workspaceReadOnly}
        />

        <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative">
        <div
          className="overflow-hidden relative flex-1 min-h-0 isolate"
          style={{
            height: sceneViewerHeight,
          }}
          suppressHydrationWarning
        >
          <CanvasArea
            currentScene={currentScene}
            currentSceneIndex={currentSceneIndex}
            scenesCount={totalScenesCount}
            mode={mode}
            engineState={canvasEngineState}
            isLiveSession={
              chatIsStreaming || isTopicPending || engineMode === 'live' || !!chatSessionType
            }
            whiteboardOpen={whiteboardOpen}
            sidebarCollapsed={pinLayoutPanels ? false : sidebarCollapsed}
            chatCollapsed={pinLayoutPanels ? false : chatAreaCollapsed}
            onToggleSidebar={
              pinLayoutPanels ? undefined : () => setSidebarCollapsed(!sidebarCollapsed)
            }
            onToggleChat={
              pinLayoutPanels ? undefined : () => setChatAreaCollapsed(!chatAreaCollapsed)
            }
            onPrevSlide={handlePreviousScene}
            onNextSlide={handleNextScene}
            onPlayPause={handlePlayPause}
            onWhiteboardClose={handleWhiteboardToggle}
            isPresenting={isPresenting}
            onTogglePresentation={togglePresentation}
            showStopDiscussion={
              engineMode === 'live' ||
              (chatIsStreaming && (chatSessionType === 'qa' || chatSessionType === 'discussion'))
            }
            onStopDiscussion={handleStopDiscussion}
            hideToolbar={mode === 'playback' || (isPresenting && !controlsVisible)}
            isPendingScene={isPendingScene}
            isCourseComplete={isCourseComplete}
            isGenerationFailed={
              isPendingScene && failedOutlines.some((f) => f.id === generatingOutlines[0]?.id)
            }
            onRetryGeneration={
              onRetryOutline && generatingOutlines[0]
                ? () => onRetryOutline(generatingOutlines[0].id)
                : undefined
            }
            readOnly={workspaceReadOnly}
            hideEditToggle={isPresenting || workspaceReadOnly}
            persistentEdit={publisherEditView}
            publisherWorkflow
          />
        </div>

        {/* Bottom surface: publisher edit gets a current-page script workbench;
            preview restores the full student-facing roundtable. */}
        {mode === 'playback' && (
          <div
            className={cn(
              'transition-opacity duration-300',
              !isPresenting && 'shrink-0',
              isPresenting && 'absolute inset-x-0 bottom-0 z-20',
            )}
          >
            {publisherEditView && !isPresenting ? (
              <CurrentScriptWorkbench
                note={currentLectureNote}
                engineMode={engineMode}
                onEditSpeech={handleEditSpeech}
                onAiGenerateScene={handleAiGenerateTeacherScript}
                onUploadTeacherVoice={handleUploadTeacherVoice}
                onRemoveTeacherVoice={handleRemoveTeacherVoice}
                onPlayPause={handlePlayPause}
                lectureAudioProgress={lectureAudioProgress}
                onLectureAudioSeek={handleLectureAudioSeek}
                speechProgress={speechProgress}
                isOpenmaicDemoClassroom={isOpenmaicDemoClassroom}
                lectureSeekBlocked={isTopicPending || engineMode === 'live'}
              />
            ) : (
              <Roundtable
              mode={mode}
              initialParticipants={participants}
              playbackView={studentPlaybackView}
              currentSpeech={visibleLiveSpeech}
              lectureSpeech={visibleLectureSpeech}
              idleText={visibleIdleText}
              playbackCompleted={playbackCompleted}
              discussionRequest={discussionRequest}
              engineMode={engineMode}
              isStreaming={chatIsStreaming}
              audioIndicatorState={audioIndicatorState}
              audioAgentId={audioAgentId}
              sessionType={
                chatSessionType === 'qa'
                  ? 'qa'
                  : chatSessionType === 'discussion'
                    ? 'discussion'
                    : undefined
              }
              speakingAgentId={speakingAgentId}
              speechProgress={speechProgress}
              showEndFlash={showEndFlash}
              endFlashSessionType={endFlashSessionType}
              thinkingState={thinkingState}
              isCueUser={isCueUser}
              isTopicPending={isTopicPending}
              onMessageSend={async (msg) => {
                // Always clear Level-1 pause state — the closure may hold a stale
                // isDiscussionPaused value (e.g. voice input's onTranscription callback
                // captures onMessageSend before React re-renders with the updated state).
                setIsDiscussionPaused(false);
                // Clear the sticky livePausedRef so the next agent-loop buffer
                // starts unpaused. (pauseActiveLiveBuffer sets a ref that new
                // buffers inherit — must be cleared before sendMessage creates one.)
                chatAreaRef.current?.resumeActiveLiveBuffer();
                // Flush any buffered / in-flight TTS audio from the previous
                // agent turn so it doesn't leak into the next round.
                discussionTTS.cleanup();
                // Clear soft-paused state — user is continuing the topic
                if (isTopicPending) {
                  setIsTopicPending(false);
                  setLiveSpeech(null);
                  setSpeakingAgentId(null);
                }
                // User interrupts during playback — handleUserInterrupt triggers
                // onUserInterrupt callback which already calls sendMessage, so skip
                // the direct sendMessage below to avoid sending twice.
                // Include 'paused' because onInputActivate pauses the engine before
                // the user finishes typing — without this the interrupt position
                // would never be saved and resuming after QA skips to the next sentence.
                if (
                  engineRef.current &&
                  (engineMode === 'playing' || engineMode === 'live' || engineMode === 'paused')
                ) {
                  engineRef.current.handleUserInterrupt(msg);
                } else {
                  chatAreaRef.current?.sendMessage(msg);
                }
                // Auto-switch to chat tab when user sends a message
                chatAreaRef.current?.switchToTab('chat');
                setIsCueUser(false);
                // Immediately mark streaming for synchronized stop button
                setChatIsStreaming(true);
                setChatSessionType(chatSessionType || 'qa');
                // Optimistic thinking: show thinking dots immediately so there's
                // no blank gap between userMessage expiry and the SSE thinking event.
                // The real SSE event will overwrite this with the same or updated value.
                setThinkingState({ stage: 'director' });
              }}
              onDiscussionStart={() => {
                // User clicks "Join" on ProactiveCard
                engineRef.current?.confirmDiscussion();
              }}
              onDiscussionSkip={() => {
                // User clicks "Skip" on ProactiveCard
                engineRef.current?.skipDiscussion();
              }}
              onStopDiscussion={handleStopDiscussion}
              onInputActivate={() => {
                // Level-1 pause: freeze buffer tick + TTS audio while SSE keeps buffering.
                // User resumes manually via Space / pause button after closing the input.
                // No isDiscussionPaused guard — always attempt to pause the buffer.
                // The return value ensures UI state stays in sync with buffer state.
                if (chatSessionType === 'qa' || chatSessionType === 'discussion') {
                  const paused = chatAreaRef.current?.pauseActiveLiveBuffer();
                  if (paused) {
                    discussionTTS.pause();
                    setIsDiscussionPaused(true);
                  }
                }
                // Also pause playback engine
                if (engineRef.current && (engineMode === 'playing' || engineMode === 'live')) {
                  engineRef.current.pause();
                }
              }}
              onResumeTopic={doResumeTopic}
              onPlayPause={handlePlayPause}
              isDiscussionPaused={isDiscussionPaused}
              onDiscussionPause={() => {
                const paused = chatAreaRef.current?.pauseActiveLiveBuffer();
                if (paused) {
                  discussionTTS.pause();
                  setIsDiscussionPaused(true);
                }
              }}
              onDiscussionResume={() => {
                chatAreaRef.current?.resumeActiveLiveBuffer();
                discussionTTS.resume();
                setIsDiscussionPaused(false);
              }}
              totalActions={totalActions}
              currentActionIndex={0}
              currentSceneIndex={currentSceneIndex}
              scenesCount={totalScenesCount}
              whiteboardOpen={whiteboardOpen}
              sidebarCollapsed={pinLayoutPanels ? false : sidebarCollapsed}
              chatCollapsed={pinLayoutPanels ? false : chatAreaCollapsed}
              onToggleSidebar={
                pinLayoutPanels ? undefined : () => setSidebarCollapsed(!sidebarCollapsed)
              }
              onToggleChat={
                pinLayoutPanels ? undefined : () => setChatAreaCollapsed(!chatAreaCollapsed)
              }
              onPrevSlide={handlePreviousScene}
              onNextSlide={handleNextScene}
              onWhiteboardClose={handleWhiteboardToggle}
              isPresenting={isPresenting}
              controlsVisible={controlsVisible}
              onTogglePresentation={togglePresentation}
              onPresentationInteractionChange={setIsPresentationInteractionActive}
              fullscreenContainerRef={stageRef}
              readOnly={isDeviceFramePreview}
              isOpenmaicDemoClassroom={isOpenmaicDemoClassroom}
              lectureAudioProgress={lectureAudioProgress}
              onLectureAudioSeek={handleLectureAudioSeek}
              showSubtitles={showTeacherSpeechInChrome}
              lectureOnly={publisherEditView}
              persistentEdit={publisherEditView}
              publisherWorkflow
            />
            )}
          </div>
        )}
      </div>

      {/* Chat Area — kept mounted at all times so PlaybackEngine /
          use-chat-sessions / StreamBuffer keep driving shared state.
          The 笔记 panel stays open in both edit and preview; edit affordances
          (hover pencil / AI / voice upload) are gated by lectureNotesReadOnly. */}
      <ChatArea
        ref={chatAreaRef}
        usePreviewMockChat={usePreviewMockChat}
        width={chatAreaWidth}
        onWidthChange={setChatAreaWidth}
        onCollapseChange={setChatAreaCollapsed}
        activeBubbleId={activeBubbleId}
        onActiveBubble={(id) => setActiveBubbleId(id)}
        currentSceneId={currentSceneId}
        onLectureNoteSceneSelect={gatedSceneSwitch}
        readOnly={publisherEditView ? true : lectureNotesReadOnly}
        hideChatTab={publisherEditView}
        hideLectureNotes={hideLectureNotesInPanel}
        collapsed={
          collapseChatPanelForSubtitles
            ? true
            : pinLayoutPanels
              ? false
              : chatAreaCollapsed
        }
        lectureTabLabel={publisherEditView ? '讲稿预览' : undefined}
        onLiveSpeech={(text, agentId) => {
          // Capture epoch at call time — discard if scene has changed since
          const epoch = sceneEpochRef.current;
          // Use queueMicrotask to let any pending scene-switch reset settle first
          queueMicrotask(() => {
            if (sceneEpochRef.current !== epoch) return; // stale — scene changed
            setLiveSpeech(text);
            if (agentId !== undefined) {
              setSpeakingAgentId(agentId);
            }
            if (text !== null || agentId) {
              setChatIsStreaming(true);
              setChatSessionType(chatAreaRef.current?.getActiveSessionType?.() ?? null);
              setIsTopicPending(false);
            } else if (text === null && agentId === null) {
              setChatIsStreaming(false);
              // Don't clear chatSessionType here — it's needed by the stop
              // button when director cues user (cue_user → done → liveSpeech null).
              // It gets properly cleared in doSessionCleanup and scene change.
            }
          });
        }}
        onSpeechProgress={(ratio) => {
          const epoch = sceneEpochRef.current;
          queueMicrotask(() => {
            if (sceneEpochRef.current !== epoch) return;
            setSpeechProgress(ratio);
          });
        }}
        onThinking={(state) => {
          const epoch = sceneEpochRef.current;
          queueMicrotask(() => {
            if (sceneEpochRef.current !== epoch) return;
            setThinkingState(state);
          });
        }}
        onCueUser={(_fromAgentId, _prompt) => {
          setIsCueUser(true);
        }}
        onLiveSessionError={handleLiveSessionError}
        onStopSession={doSessionCleanup}
        onSegmentSealed={discussionTTS.handleSegmentSealed}
        shouldHoldAfterReveal={discussionTTS.shouldHold}
      />

      </div>
    </div>
  );

  // Scene switch confirmation dialog — extracted to root level so it isn't
  // affected by the device-frame scale transform when in preview mode.
  const sceneSwitchDialog = (
    <AlertDialog
      open={!!pendingSceneId}
      onOpenChange={(open) => {
        if (!open) cancelSceneSwitch();
      }}
    >
      <AlertDialogContent
        container={isPresenting ? stageRef.current : undefined}
        className="max-w-sm rounded-2xl p-0 overflow-hidden border-0 shadow-[0_25px_60px_-12px_rgba(0,0,0,0.15)] dark:shadow-[0_25px_60px_-12px_rgba(0,0,0,0.5)]"
      >
        <VisuallyHidden.Root>
          <AlertDialogTitle>{t('stage.confirmSwitchTitle')}</AlertDialogTitle>
        </VisuallyHidden.Root>
        {/* Top accent bar */}
        <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-red-400" />

        <div className="px-6 pt-5 pb-2 flex flex-col items-center text-center">
          {/* Icon */}
          <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-4 ring-1 ring-amber-200/50 dark:ring-amber-700/30">
            <AlertTriangle className="w-6 h-6 text-amber-500 dark:text-amber-400" />
          </div>
          {/* Title */}
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1.5">
            {t('stage.confirmSwitchTitle')}
          </h3>
          {/* Description */}
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            {t('stage.confirmSwitchMessage')}
          </p>
        </div>

        <AlertDialogFooter className="px-6 pb-5 pt-3 flex-row gap-3">
          <AlertDialogCancel onClick={cancelSceneSwitch} className="flex-1 rounded-xl">
            {t('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmSceneSwitch}
            className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-md shadow-amber-200/50 dark:shadow-amber-900/30"
          >
            {t('common.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // ─── Multi-device preview branch ──────────────────────────────
  // When previewDevice is mobile or tablet we mount a dedicated touch-first
  // surface (PhoneClassroomView / TabletClassroomView) inside a scale-to-fit
  // device shell. The hidden ChatArea instance below stays mounted off-screen
  // so PlaybackEngine / use-chat-sessions / StreamBuffer continue driving
  // shared Zustand state. The publisher edits exclusively from web mode;
  // mobile / iPad are preview-only views — optimised for "this is how a
  // student sees it" rather than parity with the desktop publisher.
  if (isDeviceFramePreview) {
    // TS doesn't narrow `previewDevice` from the derived `isDeviceFramePreview`
    // boolean, so we lock the narrowed device kind here once.
    const mobileDevice: 'mobile' | 'tablet' =
      previewDevice === 'mobile' ? 'mobile' : 'tablet';
    // The teacher / discussion agent registry powers the mobile members
    // chips, dock avatar, and message list sender resolution.
    const mobileAgents = selectedAgents;

    // v1.12 — same playback / tool state the desktop CanvasToolbar
    // uses, so the mobile / iPad control bar can mirror 倍速 / 自动
    // 播放 / 全屏 / 白板 behaviour exactly. We use a fresh getState()
    // inside the click handlers (rather than capturing a stale value)
    // so cycling the speed always advances from the *current* value.
    const cycleSpeed = () => {
      const cur = useSettingsStore.getState().playbackSpeed;
      const idx = PLAYBACK_SPEEDS.indexOf(cur as (typeof PLAYBACK_SPEEDS)[number]);
      const next = PLAYBACK_SPEEDS[(idx + 1) % PLAYBACK_SPEEDS.length];
      useSettingsStore.getState().setPlaybackSpeed(next);
    };
    const toggleAutoPlay = () => {
      const cur = useSettingsStore.getState().autoPlayLecture;
      useSettingsStore.getState().setAutoPlayLecture(!cur);
    };

    // Shared props consumed by both the phone and tablet views. Built
    // once so the two branches don't drift over time.
    const sharedClassroomProps = {
      orientation: previewOrientation,
      chatAreaRef,
      currentScene,
      currentSceneTitle:
        currentScene?.title ||
        (isCourseComplete && isPendingScene ? t('stage.courseComplete') : ''),
      currentSceneId,
      currentSceneIndex,
      scenesCount: totalScenesCount,
      scenes,
      mode,
      engineState: canvasEngineState,
      isLiveSession:
        chatIsStreaming || isTopicPending || engineMode === 'live' || !!chatSessionType,
      isPendingScene,
      isCourseComplete,
      isGenerationFailed:
        isPendingScene && failedOutlines.some((f) => f.id === generatingOutlines[0]?.id),
      chatIsStreaming,
      onPrevSlide: handlePreviousScene,
      onNextSlide: handleNextScene,
      onPlayPause: handlePlayPause,
      onSelectScene: gatedSceneSwitch,
      onTogglePresentation: togglePresentation,
      onRetryGeneration:
        onRetryOutline && generatingOutlines[0]
          ? () => onRetryOutline(generatingOutlines[0].id)
          : undefined,
      // v1.12 — web-parity controls
      whiteboardOpen,
      onToggleWhiteboard: handleWhiteboardToggle,
      playbackSpeed: previewPlaybackSpeed,
      onCycleSpeed: cycleSpeed,
      autoPlayLecture: previewAutoPlayLecture,
      onToggleAutoPlay: toggleAutoPlay,
      playbackView: studentPlaybackView,
      speakingAgentId,
      thinkingState,
      agents: mobileAgents,
      lectureAudioProgress,
      onLectureAudioSeek: handleLectureAudioSeek,
      lectureSeekBlocked: isTopicPending || engineMode === 'live',
      speechProgress,
      isOpenmaicDemoClassroom,
    };

    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
        <Header
          classroomTitle={stage?.name ?? ''}
          publisherEditView={publisherEditView}
          onTogglePublisherEditView={togglePublisherEditView}
          onOpenPublisherPreview={openPublisherPreview}
          hideEditToggle
          deviceTabsVariant="pill"
        />

        {/* Preview area — minimal chrome, scale-to-fit shell takes care
            of sizing the device-shaped surface to the available space. */}
        <div className="relative flex-1 min-h-0 overflow-hidden flex items-center justify-center px-3 py-3 sm:px-4 sm:py-4 bg-gray-100 dark:bg-gray-950">
          <AnimatePresence mode="wait">
            <DevicePreviewShell
              key={`${mobileDevice}-${previewOrientation}`}
              device={mobileDevice}
              orientation={previewOrientation}
            >
              {mobileDevice === 'mobile' ? (
                <PhoneClassroomView {...sharedClassroomProps} />
              ) : (
                <TabletClassroomView {...sharedClassroomProps} />
              )}
            </DevicePreviewShell>
          </AnimatePresence>
        </div>

        {/* Hidden engine shell — ChatArea kept mounted off-screen so the
            PlaybackEngine / use-chat-sessions / StreamBuffer continue to
            drive shared state. Mobile UI talks to it via chatAreaRef. */}
        <div
          className="fixed left-[-99999px] top-0 w-0 h-0 invisible pointer-events-none"
          aria-hidden
        >
          <ChatArea
            ref={chatAreaRef}
            usePreviewMockChat={usePreviewMockChat}
            width={0}
            collapsed
            currentSceneId={currentSceneId}
            onLectureNoteSceneSelect={gatedSceneSwitch}
            readOnly
            onLiveSpeech={(text, agentId) => {
              const epoch = sceneEpochRef.current;
              queueMicrotask(() => {
                if (sceneEpochRef.current !== epoch) return;
                setLiveSpeech(text);
                if (agentId !== undefined) {
                  setSpeakingAgentId(agentId);
                }
                if (text !== null || agentId) {
                  setChatIsStreaming(true);
                  setChatSessionType(chatAreaRef.current?.getActiveSessionType?.() ?? null);
                  setIsTopicPending(false);
                } else if (text === null && agentId === null) {
                  setChatIsStreaming(false);
                }
              });
            }}
            onSpeechProgress={(ratio) => {
              const epoch = sceneEpochRef.current;
              queueMicrotask(() => {
                if (sceneEpochRef.current !== epoch) return;
                setSpeechProgress(ratio);
              });
            }}
            onThinking={(state) => {
              const epoch = sceneEpochRef.current;
              queueMicrotask(() => {
                if (sceneEpochRef.current !== epoch) return;
                setThinkingState(state);
              });
            }}
            onCueUser={() => setIsCueUser(true)}
            onLiveSessionError={handleLiveSessionError}
            onStopSession={doSessionCleanup}
            onSegmentSealed={discussionTTS.handleSegmentSealed}
            shouldHoldAfterReveal={discussionTTS.shouldHold}
          />
        </div>

        {sceneSwitchDialog}
      </div>
    );
  }

  return (
    <>
      {classroomView}
      {sceneSwitchDialog}
    </>
  );
}
