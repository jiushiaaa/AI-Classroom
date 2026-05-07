'use client';

import { useCallback, useMemo } from 'react';
import type { RefObject } from 'react';
import type { ChatAreaRef } from '@/components/chat/chat-area';
import type { ChatSession, ChatMessageMetadata } from '@/lib/types/chat';
import type { UIMessage } from 'ai';
import { useStageStore } from '@/lib/store/stage';

/**
 * useMobileChatBridge
 *
 * Hook that gives the mobile preview UI a single, narrow surface onto the
 * shared ChatArea + Stage state. ChatArea itself remains mounted in the
 * preview-mode subtree (collapsed + visually hidden) so PlaybackEngine,
 * use-chat-sessions, StreamBuffer, etc. all keep running unchanged. The
 * mobile components only need:
 *   - the persisted chat sessions (read directly from the stage store)
 *   - the most recent QA / discussion session for the current scene
 *   - a small set of imperative actions (sendMessage / endActiveSession)
 *
 * Keeping this in one hook means individual mobile children (input,
 * message list, etc.) don't each need to be wired to chatAreaRef.
 */
export interface MobileChatBridge {
  /** All persisted sessions (excluding lecture). Reactive to the store. */
  readonly sessions: ChatSession[];
  /**
   * The "current" QA / discussion session for the active scene — newest
   * non-lecture session whose `sceneId` matches the current scene, with
   * preference given to whichever is `active`. Used as the data source for
   * the mobile message list.
   */
  readonly activeSession: ChatSession | null;
  /** Convenience flat array of messages from `activeSession`. */
  readonly activeMessages: ReadonlyArray<UIMessage<ChatMessageMetadata>>;
  /** Whether SSE is currently streaming into the active session. */
  readonly isStreaming: boolean;
  /** Send a free-text message — mirrors what the desktop chat input does. */
  sendMessage: (text: string) => Promise<void>;
  /** End the active QA / discussion (publisher uses this from the dock). */
  endActiveSession: () => Promise<void>;
}

interface UseMobileChatBridgeOptions {
  readonly chatAreaRef: RefObject<ChatAreaRef | null>;
  readonly currentSceneId: string | null;
  /**
   * Live "is streaming" flag piped down from Stage.tsx. The store-level chats
   * don't carry this — Stage tracks it via callbacks from ChatArea.
   */
  readonly isStreaming: boolean;
}

export function useMobileChatBridge({
  chatAreaRef,
  currentSceneId,
  isStreaming,
}: UseMobileChatBridgeOptions): MobileChatBridge {
  const chats = useStageStore((s) => s.chats);

  const sessions = useMemo(
    () => chats.filter((s) => s.type !== 'lecture'),
    [chats],
  );

  const activeSession = useMemo<ChatSession | null>(() => {
    if (sessions.length === 0) return null;
    // Active session preferred; fallback to most-recent for the current scene.
    const sceneScoped = sessions.filter((s) =>
      currentSceneId ? s.sceneId === currentSceneId : true,
    );
    const pool = sceneScoped.length > 0 ? sceneScoped : sessions;
    const liveOne = pool.find((s) => s.status === 'active');
    if (liveOne) return liveOne;
    // Newest by updatedAt
    return pool.reduce<ChatSession | null>((acc, s) => {
      if (!acc) return s;
      return s.updatedAt > acc.updatedAt ? s : acc;
    }, null);
  }, [sessions, currentSceneId]);

  const activeMessages = activeSession?.messages ?? [];

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      await chatAreaRef.current?.sendMessage(trimmed);
    },
    [chatAreaRef],
  );

  const endActiveSession = useCallback(async () => {
    await chatAreaRef.current?.endActiveSession();
  }, [chatAreaRef]);

  return {
    sessions,
    activeSession,
    activeMessages,
    isStreaming,
    sendMessage,
    endActiveSession,
  };
}
