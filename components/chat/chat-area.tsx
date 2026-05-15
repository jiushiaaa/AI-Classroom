'use client';

import {
  useImperativeHandle,
  forwardRef,
  useRef,
  useCallback,
  useState,
  useMemo,
  useEffect,
} from 'react';
import { toast } from 'sonner';
import type { SessionType, LectureNoteEntry } from '@/lib/types/chat';
import type { DiscussionRequest } from '@/components/roundtable';
import type { Action, SpeechAction, DiscussionAction } from '@/lib/types/action';
import { extractSlidePlainText } from '@/lib/utils/extract-slide-plain-text';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useStageStore } from '@/lib/store';
import { useSettingsStore } from '@/lib/store/settings';
import { PanelRightClose, BookOpen, MessageSquare, Volume2, Sparkles } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useChatSessions } from './use-chat-sessions';
import { SessionList } from './session-list';
import { LectureNotesView } from './lecture-notes-view';
import { db } from '@/lib/utils/database';

interface ChatAreaProps {
  className?: string;
  width?: number;
  onWidthChange?: (width: number) => void;
  collapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
  activeBubbleId?: string | null;
  onActiveBubble?: (messageId: string | null) => void;
  onLiveSpeech?: (text: string | null, agentId?: string | null) => void;
  onSpeechProgress?: (ratio: number | null) => void;
  onThinking?: (state: { stage: string; agentId?: string } | null) => void;
  onCueUser?: (fromAgentId?: string, prompt?: string) => void;
  onLiveSessionError?: () => void;
  onStopSession?: () => void;
  onSegmentSealed?: (
    messageId: string,
    partId: string,
    fullText: string,
    agentId: string | null,
  ) => void;
  /** When provided and returns true, StreamBuffer holds on the current text item after reveal. */
  shouldHoldAfterReveal?: () => { holding: boolean; segmentDone: number } | boolean;
  currentSceneId?: string | null;
  /** Explicit navigation from lecture note cards (same gating as sidebar). */
  onLectureNoteSceneSelect?: (sceneId: string) => void;
  /**
   * When true, suppress publisher-only affordances inside the side panel —
   * specifically the inline lecture-notes edit pencil. Used by the mobile /
   * iPad preview shell so the panel renders identically to what an end
   * student would see.
   */
  readOnly?: boolean;
}

export interface ChatAreaRef {
  createSession: (type: SessionType, title: string) => Promise<string>;
  endSession: (sessionId: string) => Promise<void>;
  endActiveSession: () => Promise<void>;
  softPauseActiveSession: () => Promise<void>;
  resumeActiveSession: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  startDiscussion: (request: DiscussionRequest) => Promise<void>;
  startLecture: (sceneId: string) => Promise<string>;
  addLectureMessage: (sessionId: string, action: Action, actionIndex: number) => void;
  getIsStreaming: () => boolean;
  getActiveSessionType: () => string | null;
  getLectureMessageId: (sessionId: string) => string | null;
  pauseBuffer: (sessionId: string) => void;
  resumeBuffer: (sessionId: string) => void;
  /** Scrub the typewriter position within the current lecture speech (0–1). */
  seekLectureSpeechReveal: (sessionId: string, ratio: number) => void;
  pauseActiveLiveBuffer: () => boolean;
  resumeActiveLiveBuffer: () => void;
  switchToTab: (tab: 'lecture' | 'chat') => void;
}

const DEFAULT_WIDTH = 340;
const MIN_WIDTH = 240;
const MAX_WIDTH = 560;

export const ChatArea = forwardRef<ChatAreaRef, ChatAreaProps>(
  (
    {
      className,
      width = DEFAULT_WIDTH,
      onWidthChange,
      collapsed = false,
      onCollapseChange,
      activeBubbleId,
      onActiveBubble,
      onLiveSpeech,
      onSpeechProgress,
      onThinking,
      onCueUser,
      onLiveSessionError,
      onStopSession,
      onSegmentSealed,
      shouldHoldAfterReveal,
      currentSceneId,
      onLectureNoteSceneSelect,
      readOnly = false,
    },
    ref,
  ) => {
    const { t } = useI18n();
    const scenes = useStageStore((s) => s.scenes);
    const updateScene = useStageStore((s) => s.updateScene);
    const realtimeQAEnabled = useSettingsStore((s) => s.realtimeQAEnabled);
    const {
      sessions,
      activeSessionType,
      expandedSessionIds,
      isStreaming,
      createSession,
      endSession,
      endActiveSession,
      softPauseActiveSession,
      resumeActiveSession,
      sendMessage,
      startDiscussion,
      startLecture,
      addLectureMessage,
      toggleSessionExpand,
      getLectureMessageId,
      pauseBuffer,
      resumeBuffer,
      seekLectureSpeechReveal,
      pauseActiveLiveBuffer,
      resumeActiveLiveBuffer,
    } = useChatSessions({
      onLiveSpeech,
      onSpeechProgress,
      onThinking,
      onCueUser,
      onActiveBubble,
      onLiveSessionError,
      onStopSession,
      onSegmentSealed,
      shouldHoldAfterReveal,
    });

    const [activeTab, setActiveTab] = useState<'lecture' | 'chat'>('lecture');

    // Force-back to the lecture tab whenever the publisher disables real-time
    // Q&A — the chat tab is hidden in that mode and would otherwise leave the
    // panel showing an empty selection.
    useEffect(() => {
      if (!realtimeQAEnabled && activeTab === 'chat') {
        setActiveTab('lecture');
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to QA toggle
    }, [realtimeQAEnabled]);
    // The "样式" tab used to live here; it now opens as a right-side drawer
    // in the slide editor (see SlideStyleDrawer + useEditModeStore.stylePanelOpen).
    // Reading isEditing here purely so we can suppress edit-mode-only chrome
    // is no longer needed in this file.
    const isDraggingRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Derive lecture notes directly from scenes — updates reactively as scenes stream in
    // Preserves action order so spotlight/laser badges appear inline between speech texts
    const lectureNotes: LectureNoteEntry[] = useMemo(
      () =>
        [...scenes]
          .sort((a, b) => a.order - b.order)
          .map((scene) => ({
            sceneId: scene.id,
            sceneTitle: scene.title,
            sceneOrder: scene.order,
            items: (scene.actions ?? [])
              .filter(
                (a) =>
                  a.type === 'speech' ||
                  a.type === 'spotlight' ||
                  a.type === 'laser' ||
                  a.type === 'play_video' ||
                  a.type === 'discussion',
              )
              .map((a) => {
                if (a.type === 'speech') {
                  const sa = a as SpeechAction;
                  return {
                    kind: 'speech' as const,
                    actionId: sa.id,
                    text: sa.text,
                    userEditedAt: sa.userEditedAt,
                    publisherVoiceName: sa.publisherVoiceName,
                    publisherVoiceUploadedAt: sa.publisherVoiceUploadedAt,
                  };
                }
                return {
                  kind: 'action' as const,
                  type: a.type,
                  label: a.type === 'discussion' ? (a as DiscussionAction).topic : undefined,
                };
              }),
            completedAt: scene.updatedAt || scene.createdAt || 0,
          })),
      [scenes],
    );

    /**
     * Edit a speech action's text from the Notes tab. Updates the underlying
     * Scene.actions array, marks it as user-edited, and clears any cached
     * server-side TTS audio so the playback engine re-synthesises on the
     * next playback. Shows a toast confirming TTS sync.
     */
    const handleEditSpeech = useCallback(
      (sceneId: string, actionId: string, newText: string) => {
        const trimmed = newText.trim();
        if (!trimmed) return;

        const scene = scenes.find((s) => s.id === sceneId);
        if (!scene || !scene.actions) return;

        const original = scene.actions.find(
          (a) => a.id === actionId && a.type === 'speech',
        ) as SpeechAction | undefined;
        if (!original || original.text === trimmed) return;

        const nextActions: Action[] = scene.actions.map((a) => {
          if (a.id !== actionId || a.type !== 'speech') return a;
          // Clear cached audioId/audioUrl — text change invalidates them so
          // the engine will re-synthesise TTS for this sentence.
          const updated: SpeechAction = {
            ...(a as SpeechAction),
            text: trimmed,
            userEditedAt: Date.now(),
            audioId: undefined,
            audioUrl: undefined,
            publisherVoiceName: undefined,
            publisherVoiceUploadedAt: undefined,
            publisherVoiceMimeType: undefined,
            publisherPreviousAudioId: undefined,
            publisherPreviousAudioUrl: undefined,
          };
          return updated;
        });

        updateScene(sceneId, { actions: nextActions, updatedAt: Date.now() });

        toast.success(t('chat.lectureNotes.ttsSyncedToast'), {
          description: t('chat.lectureNotes.ttsSyncedDescription'),
          icon: <Volume2 className="w-4 h-4 text-purple-500" />,
          duration: 2400,
        });
      },
      [scenes, updateScene, t],
    );

    /** Mock one-click draft for the AI teacher script from slide text (offline demo). */
    const handleAiGenerateTeacherScript = useCallback(
      (sceneId: string, userInstructions?: string) => {
        const scene = scenes.find((s) => s.id === sceneId);
        if (!scene || !scene.actions?.length) {
          toast.error(t('chat.lectureNotes.aiGenerateNoSpeech'));
          return;
        }
        const speechIdx = scene.actions.findIndex((a) => a.type === 'speech');
        if (speechIdx === -1) {
          toast.error(t('chat.lectureNotes.aiGenerateNoSpeech'));
          return;
        }
        const excerpt =
          scene.type === 'slide' && scene.content.type === 'slide'
            ? extractSlidePlainText(scene.content)
            : '';
        let generated = t('chat.lectureNotes.aiMockScriptBody', {
          title: scene.title,
          excerpt: excerpt || t('chat.lectureNotes.aiMockNoExcerpt'),
        });
        const hint = userInstructions?.trim();
        if (hint) {
          generated += t('chat.lectureNotes.aiMockInstructionAppend', {
            instructions: hint,
          });
        }
        const nextActions: Action[] = scene.actions.map((a, i) => {
          if (i !== speechIdx || a.type !== 'speech') return a;
          const updated: SpeechAction = {
            ...(a as SpeechAction),
            text: generated,
            userEditedAt: undefined,
            audioId: undefined,
            audioUrl: undefined,
            publisherVoiceName: undefined,
            publisherVoiceUploadedAt: undefined,
            publisherVoiceMimeType: undefined,
            publisherPreviousAudioId: undefined,
            publisherPreviousAudioUrl: undefined,
          };
          return updated;
        });
        updateScene(sceneId, { actions: nextActions, updatedAt: Date.now() });
        toast.success(t('chat.lectureNotes.aiGenerateToast'), {
          icon: <Sparkles className="w-4 h-4 text-purple-500" />,
        });
      },
      [scenes, updateScene, t],
    );

    const handleUploadTeacherVoice = useCallback(
      async (sceneId: string, file: File) => {
        if (!file.type.startsWith('audio/')) {
          toast.error('请选择音频文件');
          return;
        }

        try {
          const scene = scenes.find((s) => s.id === sceneId);
          if (!scene?.actions?.length) return;

          const speechAction = scene.actions.find((a) => a.type === 'speech') as
            | SpeechAction
            | undefined;
          if (!speechAction) {
            toast.error('当前页没有可覆盖的老师讲解音频');
            return;
          }

          const now = Date.now();
          const format = file.type.split('/')[1]?.split(';')[0] || 'mp3';
          const audioId = `teacher_voice_${sceneId}_${now}`;

          if (speechAction.audioId?.startsWith('teacher_voice_')) {
            await db.audioFiles.delete(speechAction.audioId);
          }

          await db.audioFiles.put({
            id: audioId,
            blob: file,
            format,
            text: speechAction.text,
            voice: 'publisher-teacher',
            createdAt: now,
          });

          const nextActions: Action[] = scene.actions.map((a) => {
            if (a.id !== speechAction.id || a.type !== 'speech') return a;
            return {
              ...(a as SpeechAction),
              audioId,
              audioUrl: undefined,
              publisherPreviousAudioId:
                speechAction.publisherPreviousAudioId ??
                (speechAction.audioId?.startsWith('teacher_voice_')
                  ? undefined
                  : speechAction.audioId),
              publisherPreviousAudioUrl:
                speechAction.publisherPreviousAudioUrl ??
                (speechAction.audioId?.startsWith('teacher_voice_')
                  ? undefined
                  : speechAction.audioUrl),
              publisherVoiceName: file.name,
              publisherVoiceUploadedAt: now,
              publisherVoiceMimeType: file.type,
            };
          });

          updateScene(sceneId, { actions: nextActions, updatedAt: now });
          toast.success('已使用真人老师人声覆盖当前页');
        } catch {
          toast.error('真人老师人声上传失败，请重试');
        }
      },
      [scenes, updateScene],
    );

    const handleRemoveTeacherVoice = useCallback(
      async (sceneId: string) => {
        const scene = scenes.find((s) => s.id === sceneId);
        if (!scene?.actions?.length) return;

        const speechAction = scene.actions.find(
          (a) => a.type === 'speech' && (a as SpeechAction).publisherVoiceUploadedAt,
        ) as SpeechAction | undefined;
        if (!speechAction) return;

        if (speechAction.audioId?.startsWith('teacher_voice_')) {
          await db.audioFiles.delete(speechAction.audioId);
        }

        const nextActions: Action[] = scene.actions.map((a) => {
          if (a.id !== speechAction.id || a.type !== 'speech') return a;
          return {
            ...(a as SpeechAction),
            audioId: speechAction.publisherPreviousAudioId,
            audioUrl: speechAction.publisherPreviousAudioUrl,
            publisherVoiceName: undefined,
            publisherVoiceUploadedAt: undefined,
            publisherVoiceMimeType: undefined,
            publisherPreviousAudioId: undefined,
            publisherPreviousAudioUrl: undefined,
          };
        });

        updateScene(sceneId, { actions: nextActions, updatedAt: Date.now() });
        toast.success('已恢复当前页 AI 老师声音');
      },
      [scenes, updateScene],
    );

    // Filter out lecture sessions for the Chat tab
    const chatSessions = useMemo(() => sessions.filter((s) => s.type !== 'lecture'), [sessions]);

    // Whether there's an active discussion/QA session (for amber dot on Chat tab)
    const hasActiveChatSession = useMemo(
      () => chatSessions.some((s) => s.status === 'active'),
      [chatSessions],
    );

    // Wrap endSession for QA/Discussion: also notify parent for engine cleanup
    const handleEndSession = useCallback(
      async (sessionId: string) => {
        await endSession(sessionId);
        onStopSession?.();
      },
      [endSession, onStopSession],
    );

    const switchToTab = useCallback(
      (tab: 'lecture' | 'chat') => {
        // Imperative callers (e.g. mobile bridge) may try to surface the chat
        // tab when a new QA bubble arrives. If the publisher disabled QA,
        // ignore the switch and stay on lecture notes.
        if (tab === 'chat' && !realtimeQAEnabled) return;
        setActiveTab(tab);
      },
      [realtimeQAEnabled],
    );

    useImperativeHandle(ref, () => ({
      createSession,
      endSession,
      endActiveSession,
      softPauseActiveSession,
      resumeActiveSession,
      sendMessage,
      startDiscussion,
      startLecture,
      addLectureMessage,
      getIsStreaming: () => isStreaming,
      getActiveSessionType: () => activeSessionType,
      getLectureMessageId,
      pauseBuffer,
      resumeBuffer,
      seekLectureSpeechReveal,
      pauseActiveLiveBuffer,
      resumeActiveLiveBuffer,
      switchToTab,
    }));

    // Drag-to-resize
    const handleDragStart = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingRef.current = true;
        setIsDragging(true);
        const startX = e.clientX;
        const startWidth = width;

        const handleMouseMove = (me: MouseEvent) => {
          const delta = startX - me.clientX;
          const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
          onWidthChange?.(newWidth);
        };

        const handleMouseUp = () => {
          isDraggingRef.current = false;
          setIsDragging(false);
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        };

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      },
      [width, onWidthChange],
    );

    const displayWidth = collapsed ? 0 : width;

    return (
      <div
        style={{
          width: displayWidth,
          transition: isDragging ? 'none' : 'width 0.3s ease',
        }}
        className={cn(
          'bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-l border-gray-100 dark:border-gray-800 shadow-[-2px_0_24px_rgba(0,0,0,0.02)] flex flex-col shrink-0 z-20 relative overflow-visible',
          className,
        )}
      >
        {/* Drag handle */}
        {!collapsed && (
          <div
            onMouseDown={handleDragStart}
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-50 group hover:bg-purple-400/30 dark:hover:bg-purple-600/30 active:bg-purple-500/40 dark:active:bg-purple-500/40 transition-colors"
          >
            <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-0.5 h-8 rounded-full bg-gray-300 dark:bg-gray-600 group-hover:bg-purple-400 dark:group-hover:bg-purple-500 transition-colors" />
          </div>
        )}

        <div className={cn('flex flex-col w-full h-full overflow-hidden', collapsed && 'hidden')}>
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'lecture' | 'chat')}
            className="flex flex-col h-full gap-0"
          >
            {/* Tab header row.
                When real-time Q&A is disabled, the chat / discussion tab
                is suppressed entirely so the panel reads as a focused
                lecture-notes surface. */}
            <div className="h-10 flex items-center gap-1 shrink-0 mt-3 mb-1 px-3">
              <TabsList variant="line" className="h-full flex-1 w-0">
                <TabsTrigger value="lecture" className="text-xs gap-1 flex-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  {t('chat.tabs.lecture')}
                </TabsTrigger>
                {realtimeQAEnabled && (
                  <TabsTrigger value="chat" className="text-xs gap-1 flex-1 relative">
                    <MessageSquare className="w-3.5 h-3.5" />
                    {t('chat.tabs.chat')}
                    {/* Amber pulse dot when there's an active chat session and user is on Notes tab */}
                    {hasActiveChatSession && activeTab === 'lecture' && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                      </span>
                    )}
                  </TabsTrigger>
                )}
              </TabsList>

              {onCollapseChange && (
                <button
                  onClick={() => onCollapseChange(true)}
                  className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center bg-gray-100/80 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 ring-1 ring-black/[0.04] dark:ring-white/[0.06] hover:bg-gray-200/90 dark:hover:bg-gray-700/90 hover:text-gray-700 dark:hover:text-gray-200 active:scale-90 transition-all duration-200"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Notes Tab */}
            <TabsContent value="lecture" className="flex-1 overflow-hidden flex flex-col">
              <LectureNotesView
                notes={lectureNotes}
                currentSceneId={currentSceneId}
                onEditSpeech={readOnly ? undefined : handleEditSpeech}
                onAiGenerateScene={readOnly ? undefined : handleAiGenerateTeacherScript}
                onUploadTeacherVoice={readOnly ? undefined : handleUploadTeacherVoice}
                onRemoveTeacherVoice={readOnly ? undefined : handleRemoveTeacherVoice}
                onSelectScene={onLectureNoteSceneSelect}
              />
            </TabsContent>

            {/* Chat Tab — gated by real-time Q&A toggle */}
            {realtimeQAEnabled && (
            <TabsContent value="chat" className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-2 scrollbar-hide">
                {chatSessions.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-50">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3 text-gray-300 dark:text-gray-600">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {t('chat.noConversations')}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                      {t('chat.startConversation')}
                    </p>
                  </div>
                ) : (
                  <>
                    <SessionList
                      sessions={chatSessions}
                      expandedSessionIds={expandedSessionIds}
                      isStreaming={isStreaming}
                      activeBubbleId={activeBubbleId}
                      onToggleExpand={toggleSessionExpand}
                      onEndSession={handleEndSession}
                    />
                    <div ref={bottomRef} />
                  </>
                )}
              </div>
            </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    );
  },
);

ChatArea.displayName = 'ChatArea';
