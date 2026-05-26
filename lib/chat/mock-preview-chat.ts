/**
 * Preview-mode mock chat — simulates /api/chat SSE for publisher student preview
 * (web / mobile / iPad) when no LLM is configured.
 */

import type { StatelessEvent } from '@/lib/types/chat';
import { useAgentRegistry } from '@/lib/orchestration/registry/store';
import { useSettingsStore } from '@/lib/store/settings';
import i18n from '@/lib/i18n/config';

const MOCK_AGENT_ID = 'default-1';
const CHUNK_SIZE = 4;
const CHUNK_DELAY_MS = 36;
const THINKING_DELAY_MS = 420;

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

function extractLastUserMessage(messages: unknown[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as {
      role?: string;
      parts?: Array<{ type: string; text?: string }>;
      content?: string;
    };
    if (msg.role !== 'user') continue;
    if (Array.isArray(msg.parts)) {
      const textPart = msg.parts.find((p) => p.type === 'text' && p.text);
      if (textPart?.text) return textPart.text.trim();
    }
    if (typeof msg.content === 'string' && msg.content.trim()) {
      return msg.content.trim();
    }
  }
  return '';
}

function getTeacherMeta(): {
  name: string;
  avatar: string;
  color: string;
} {
  const settings = useSettingsStore.getState();
  const teacher = useAgentRegistry.getState().getAgent(MOCK_AGENT_ID);
  const customAvatar = settings.teacherCustomAvatar?.trim();
  return {
    name: settings.teacherCustomDisplayName?.trim() || teacher?.name || 'AI teacher',
    avatar: customAvatar || teacher?.avatar || '/avatars/teacher.png',
    color: teacher?.color ?? '#3b82f6',
  };
}

function buildMockReplyText(userText: string, config: Record<string, unknown>): string {
  const topic =
    typeof config.discussionTopic === 'string' ? config.discussionTopic.trim() : '';
  const prompt =
    typeof config.discussionPrompt === 'string' ? config.discussionPrompt.trim() : '';
  const quoted = userText || topic || prompt;

  if (quoted) {
    return i18n.t('preview.mockChat.replyWithQuestion', {
      question: quoted,
      interpolation: { escapeValue: false },
    });
  }
  return i18n.t('preview.mockChat.replyGeneric');
}

function* chunkText(text: string): Generator<string> {
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    yield text.slice(i, i + CHUNK_SIZE);
  }
}

async function* mockEventSequence(
  body: Record<string, unknown>,
  signal: AbortSignal,
): AsyncGenerator<StatelessEvent> {
  const messages = (body.messages as unknown[]) ?? [];
  const config = (body.config as Record<string, unknown>) ?? {};
  const userText = extractLastUserMessage(messages);
  const replyText = buildMockReplyText(userText, config);
  const teacher = getTeacherMeta();
  const messageId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  yield { type: 'thinking', data: { stage: 'director' } };
  await delay(THINKING_DELAY_MS, signal);

  yield { type: 'thinking', data: { stage: 'agent_loading', agentId: MOCK_AGENT_ID } };
  await delay(280, signal);

  yield {
    type: 'agent_start',
    data: {
      messageId,
      agentId: MOCK_AGENT_ID,
      agentName: teacher.name,
      agentAvatar: teacher.avatar,
      agentColor: teacher.color,
    },
  };

  for (const chunk of chunkText(replyText)) {
    await delay(CHUNK_DELAY_MS, signal);
    yield { type: 'text_delta', data: { content: chunk, messageId } };
  }

  yield { type: 'agent_end', data: { messageId, agentId: MOCK_AGENT_ID } };
  yield {
    type: 'done',
    data: {
      totalActions: 0,
      totalAgents: 1,
      agentHadContent: true,
      directorState: {
        turnCount: 1,
        agentResponses: [],
        whiteboardLedger: [],
      },
    },
  };
}

function encodeSseEvent(event: StatelessEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * Drop-in replacement for fetch('/api/chat') during publisher student preview.
 */
export function createPreviewMockChatFetch(): (
  body: Record<string, unknown>,
  signal: AbortSignal,
) => Promise<Response> {
  return (body, signal) => {
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of mockEventSequence(body, signal)) {
            if (signal.aborted) break;
            controller.enqueue(encodeSseEvent(event));
          }
          controller.close();
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            controller.close();
            return;
          }
          controller.error(error);
        }
      },
    });

    return Promise.resolve(
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );
  };
}
