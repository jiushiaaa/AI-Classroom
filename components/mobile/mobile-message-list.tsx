'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';
import type { UIMessage } from 'ai';
import type { ChatMessageMetadata } from '@/lib/types/chat';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
import { AgentAvatar } from './agent-avatar';

interface MobileMessageListProps {
  readonly messages: ReadonlyArray<UIMessage<ChatMessageMetadata>>;
  readonly agentsById: Record<string, AgentConfig | undefined>;
  /**
   * Optional live thinking / typing dots displayed at the bottom while the
   * agent is composing the next reply. Strings come from playbackView.
   */
  readonly thinkingHint?: string | null;
  /**
   * Optional in-flight live speech text. When present, renders as the
   * tail bubble using the speaking agent's identity.
   */
  readonly liveText?: string | null;
  readonly liveAgentId?: string | null;
  readonly className?: string;
}

/**
 * MobileMessageList
 *
 * Compact bubble list for the mobile Q&A panel. Avatars on the left, name
 * + bubble + timestamp on the right. User bubbles flush right, agents flush
 * left. Auto-scrolls to the most recent message whenever the messages list
 * updates so the publisher always sees the tail of the conversation.
 */
export function MobileMessageList({
  messages,
  agentsById,
  thinkingHint,
  liveText,
  liveAgentId,
  className,
}: MobileMessageListProps) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter out empty placeholder rows that may show up while a session is
  // mid-stream (use-chat-sessions appends a shell user message before the
  // agents respond — which we want to keep — but also writes interim
  // placeholder agent rows; messages without parts are skipped).
  const visibleMessages = useMemo(
    () =>
      messages.filter((m) => {
        const parts = m.parts ?? [];
        return parts.some((p) => p.type === 'text' && p.text.trim().length > 0);
      }),
    [messages],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Scroll to end on each new message / live tick.
    el.scrollTop = el.scrollHeight;
  }, [visibleMessages.length, liveText, thinkingHint]);

  if (visibleMessages.length === 0 && !liveText && !thinkingHint) {
    return (
      <div className={cn('flex flex-col items-center justify-center text-center px-4 py-8', className)}>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {t('mobile.qa.emptyHint')}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className={cn('flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2.5', className)}
    >
      {visibleMessages.map((msg) => {
        const isUser = msg.role === 'user';
        const meta = msg.metadata;
        const agent = meta?.agentId ? agentsById[meta.agentId] : undefined;
        const senderName = isUser
          ? (meta?.senderName ?? t('mobile.qa.you'))
          : (agent?.name ?? meta?.senderName ?? '');
        const senderAvatar = isUser ? (meta?.senderAvatar ?? '🙂') : (agent?.avatar ?? '🤖');
        const text = (msg.parts ?? [])
          .filter((p) => p.type === 'text')
          .map((p) => (p as { text: string }).text)
          .join('');
        const ts = meta?.createdAt ? formatTime(meta.createdAt) : '';
        return (
          <div
            key={msg.id}
            className={cn('flex items-start gap-2', isUser && 'flex-row-reverse')}
          >
            <AgentAvatar
              avatar={senderAvatar}
              alt={senderName}
              size={28}
              className={cn(
                isUser && 'bg-purple-500/10 ring-purple-300/40',
              )}
            />
            <div className={cn('flex flex-col min-w-0 max-w-[80%]', isUser && 'items-end')}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10.5px] text-gray-500 dark:text-gray-400 truncate max-w-[8rem]">
                  {senderName}
                </span>
                {ts && (
                  <span className="text-[9.5px] text-gray-300 dark:text-gray-600 tabular-nums">
                    {ts}
                  </span>
                )}
              </div>
              <div
                className={cn(
                  'rounded-2xl px-3 py-1.5 text-[12.5px] leading-relaxed whitespace-pre-wrap break-words',
                  isUser
                    ? 'bg-gradient-to-br from-purple-100 to-fuchsia-100 dark:from-purple-900/40 dark:to-fuchsia-900/40 text-gray-800 dark:text-gray-100 rounded-tr-sm'
                    : 'bg-gray-100 dark:bg-gray-800/70 text-gray-800 dark:text-gray-100 rounded-tl-sm',
                )}
              >
                {text}
              </div>
            </div>
          </div>
        );
      })}

      {liveText && (
        <LiveBubble
          text={liveText}
          agent={liveAgentId ? agentsById[liveAgentId] : undefined}
        />
      )}
      {!liveText && thinkingHint && <ThinkingBubble label={thinkingHint} />}
    </div>
  );
}

function LiveBubble({
  text,
  agent,
}: {
  readonly text: string;
  readonly agent: AgentConfig | undefined;
}) {
  return (
    <div className="flex items-start gap-2">
      <AgentAvatar avatar={agent?.avatar ?? '✨'} alt={agent?.name} size={28} />
      <div className="flex flex-col min-w-0 max-w-[80%]">
        <span className="text-[10.5px] text-gray-500 dark:text-gray-400 mb-0.5 truncate max-w-[8rem]">
          {agent?.name ?? ''}
        </span>
        <div className="rounded-2xl px-3 py-1.5 text-[12.5px] leading-relaxed bg-gray-100 dark:bg-gray-800/70 text-gray-800 dark:text-gray-100 rounded-tl-sm whitespace-pre-wrap break-words">
          {text}
          <span className="inline-block w-1 h-3 align-middle ml-0.5 bg-purple-400 dark:bg-purple-500 animate-pulse rounded-sm" />
        </div>
      </div>
    </div>
  );
}

function ThinkingBubble({ label }: { readonly label: string }) {
  return (
    <div className="flex items-start gap-2 opacity-80">
      <AgentAvatar avatar="💭" size={28} />
      <div className="rounded-2xl px-3 py-2 bg-gray-100 dark:bg-gray-800/70 text-gray-700 dark:text-gray-200 inline-flex items-center gap-1.5">
        <span className="text-[12px] leading-none">{label}</span>
        <span className="inline-flex gap-0.5">
          <Dot delay="0ms" />
          <Dot delay="150ms" />
          <Dot delay="300ms" />
        </span>
      </div>
    </div>
  );
}

function Dot({ delay }: { readonly delay: string }) {
  return (
    <span
      className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce"
      style={{ animationDelay: delay }}
    />
  );
}

function formatTime(ts: number): string {
  try {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '';
  }
}
