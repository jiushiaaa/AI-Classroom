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
import type { SessionType } from '@/lib/types/chat';
import type { Action } from '@/lib/types/action';
import type { DiscussionRequest } from '@/components/roundtable';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useSettingsStore } from '@/lib/store/settings';
import { BookOpen, MessageSquare } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useChatSessions } from './use-chat-sessions';
import { SessionList } from './session-list';
import { LectureNotesView } from './lecture-notes-view';
import { useLectureNotesEditor } from '@/lib/hooks/use-lecture-notes-editor';

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
  /**
   * When true, hide the "对话" tab and its content so the panel is
   * lecture-notes only. Used by the publisher edit view — QA chat is a
   * runtime student affordance, not part of the editing surface.
   */
  hideChatTab?: boolean;
  /**
   * When true, hide lecture notes (publisher turned off subtitles for student preview).
   */
  hideLectureNotes?: boolean;
  /**
   * When true, hide the tab header row. Lecture / chat content still
   * switches via switchToTab; used by Stage so the side panel reads as a
   * single surface without redundant single-tab chrome.
   */
  hideTabBar?: boolean;
  lectureTabLabel?: string;
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
      onCollapseChange: _onCollapseChange,
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
      hideChatTab = false,
      hideLectureNotes = false,
      hideTabBar = false,
      lectureTabLabel,
    },
    ref,
  ) => {
    const { t } = useI18n();
    const realtimeQAEnabled = useSettingsStore((s) => s.realtimeQAEnabled);
    const showChatTab = realtimeQAEnabled && !hideChatTab;
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

    // Force-back to the lecture tab whenever the chat tab is hidden — the
    // panel would otherwise show an empty selection.
    useEffect(() => {
      if (hideLectureNotes && activeTab === 'lecture' && showChatTab) {
        setActiveTab('chat');
      }
    }, [hideLectureNotes, activeTab, showChatTab]);

    useEffect(() => {
      if (!showChatTab && activeTab === 'chat' && !hideLectureNotes) {
        setActiveTab('lecture');
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to tab visibility
    }, [showChatTab]);
    // The "样式" tab used to live here; it now opens as a right-side drawer
    // in the slide editor (see SlideStyleDrawer + useEditModeStore.stylePanelOpen).
    // Reading isEditing here purely so we can suppress edit-mode-only chrome
    // is no longer needed in this file.
    const isDraggingRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    const {
      lectureNotes,
      handleEditSpeech,
      handleAiGenerateTeacherScript,
      handleUploadTeacherVoice,
      handleRemoveTeacherVoice,
    } = useLectureNotesEditor();

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
        if (tab === 'chat' && !showChatTab) return;
        setActiveTab(tab);
      },
      [showChatTab],
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
            {!hideTabBar && (showChatTab || !hideLectureNotes) && (
            <div className="h-10 flex items-center gap-1 shrink-0 mt-3 mb-1 px-3">
              <TabsList variant="line" className="h-full flex-1 w-0">
                {!hideLectureNotes && (
                <TabsTrigger value="lecture" className="text-xs gap-1 flex-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  {lectureTabLabel ?? t('chat.tabs.lecture')}
                </TabsTrigger>
                )}
                {showChatTab && (
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
            </div>
            )}

            {/* Notes Tab */}
            {!hideLectureNotes && (
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
            )}

            {/* Chat Tab — gated by real-time Q&A toggle */}
            {showChatTab && (
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
