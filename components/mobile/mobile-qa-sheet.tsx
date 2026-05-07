'use client';

import { useI18n } from '@/lib/hooks/use-i18n';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
import type { MobileChatBridge } from '@/lib/hooks/use-mobile-chat-bridge';
import { MobileBottomSheet } from './mobile-bottom-sheet';
import { MobileMessageList } from './mobile-message-list';
import { MobileChatInput } from './mobile-chat-input';
import { MobileMembersChips } from './mobile-members-chips';

interface MobileQASheetProps {
  readonly open: boolean;
  readonly onClose: () => void;

  readonly bridge: MobileChatBridge;
  readonly agents: ReadonlyArray<AgentConfig>;
  readonly agentsById: Record<string, AgentConfig | undefined>;
  readonly speakingAgentId: string | null;
  readonly liveText: string | null;
  readonly thinkingHint: string | null;

  readonly bottomOffset?: number;
  readonly heightRatio?: number;
}

/**
 * MobileQASheet
 *
 * Controlled bottom-sheet wrapper around the chat surface. Replaces the
 * previous inline collapse-style sheet so it slots cleanly into the new
 * 4-tab segmented model (composer / narration / qa / members).
 *
 * Owns no chat state — everything routes through `bridge.sendMessage`,
 * which forwards to the off-screen ChatArea instance kept alive by Stage.
 */
export function MobileQASheet({
  open,
  onClose,
  bridge,
  agents,
  agentsById,
  speakingAgentId,
  liveText,
  thinkingHint,
  bottomOffset = 0,
  heightRatio = 0.7,
}: MobileQASheetProps) {
  const { t } = useI18n();

  return (
    <MobileBottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.qa.discussionTitle')}
      bottomOffset={bottomOffset}
      heightRatio={heightRatio}
    >
      <div className="shrink-0 border-b border-gray-100 dark:border-gray-800">
        <div className="px-3 pt-2 pb-1">
          <span className="text-[10.5px] uppercase tracking-wider font-semibold text-gray-400 dark:text-gray-500">
            {t('mobile.qa.classMembers')}
          </span>
        </div>
        <MobileMembersChips agents={agents} speakingAgentId={speakingAgentId} />
      </div>

      <MobileMessageList
        messages={bridge.activeMessages}
        agentsById={agentsById}
        liveText={liveText}
        liveAgentId={speakingAgentId}
        thinkingHint={thinkingHint}
      />

      <MobileChatInput
        onSend={bridge.sendMessage}
        isStreaming={bridge.isStreaming}
        onStop={bridge.endActiveSession}
      />
    </MobileBottomSheet>
  );
}
