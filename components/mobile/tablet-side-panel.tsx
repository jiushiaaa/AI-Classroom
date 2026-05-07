'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Users, ScrollText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';
import { useStageStore } from '@/lib/store';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
import type { MobileChatBridge } from '@/lib/hooks/use-mobile-chat-bridge';
import type { ChatSession } from '@/lib/types/chat';
import { AgentAvatar } from './agent-avatar';
import { MobileMessageList } from './mobile-message-list';
import { MobileChatInput } from './mobile-chat-input';

export type TabletSidePanelTab = 'qa' | 'members' | 'narrationLog';

interface TabletSidePanelProps {
  readonly open: boolean;
  readonly activeTab: TabletSidePanelTab;
  readonly onChangeTab: (tab: TabletSidePanelTab) => void;

  readonly bridge: MobileChatBridge;
  readonly agents: ReadonlyArray<AgentConfig>;
  readonly agentsById: Record<string, AgentConfig | undefined>;
  readonly speakingAgentId: string | null;
  readonly liveText: string | null;
  readonly thinkingHint: string | null;

  readonly currentSceneId: string | null;

  /**
   * `'inline'` (default) → the panel sits inline as a flex column —
   * pushes the main stage column. Used by iPad and phone landscape
   * where there is enough horizontal room for a 320–340px column.
   *
   * `'overlay'` → the panel floats over the stage as an absolutely
   * positioned right-anchored sheet with a dim scrim behind it. Used
   * by phone portrait where the device is too narrow to allow inline
   * splitting; opening the panel pulls it over the slide instead of
   * shrinking the slide.
   */
  readonly mode?: 'inline' | 'overlay';
  /** Used in overlay mode to dismiss the panel by tapping the scrim. */
  readonly onClose?: () => void;
  /** Override the default 340px panel width (used by phone landscape). */
  readonly width?: number;

  readonly className?: string;
}

const TAB_DEFS: ReadonlyArray<{
  id: TabletSidePanelTab;
  icon: LucideIcon;
  labelKey: string;
}> = [
  { id: 'qa', icon: MessageSquare, labelKey: 'mobile.tablet.sidePanel.qa' },
  { id: 'members', icon: Users, labelKey: 'mobile.tablet.sidePanel.members' },
  { id: 'narrationLog', icon: ScrollText, labelKey: 'mobile.tablet.sidePanel.narrationLog' },
];

const PANEL_WIDTH_OPEN = 340;

function roleLabel(role: string, t: (key: string) => string): string {
  switch (role) {
    case 'teacher':
      return t('mobile.members.roleTeacher');
    case 'assistant':
      return t('mobile.members.roleAssistant');
    case 'student':
      return t('mobile.members.roleStudent');
    default:
      return role;
  }
}

/**
 * TabletSidePanel
 *
 * Right-anchored auxiliary column on iPad. When open it occupies a fixed
 * 340px and hosts three swappable surfaces (QA / members / narration
 * log) inside a segmented header. When closed it animates to width zero
 * and the main stage column claims the entire view.
 *
 * The panel pulls QA messages and lecture transcripts from the same
 * `chats` store the desktop Roundtable / ChatArea use, so anything
 * recorded by the playback engine immediately shows up here without any
 * extra wiring.
 */
export function TabletSidePanel({
  open,
  activeTab,
  onChangeTab,
  bridge,
  agents,
  agentsById,
  speakingAgentId,
  liveText,
  thinkingHint,
  currentSceneId,
  mode = 'inline',
  onClose,
  width,
  className,
}: TabletSidePanelProps) {
  const { t } = useI18n();

  const panelWidth = width ?? PANEL_WIDTH_OPEN;

  // ── Tab header (shared across both modes) ──
  const tabHeader = (
    <div className="shrink-0 flex items-center gap-1 px-2 pt-2 pb-1 border-b border-gray-100 dark:border-gray-800">
      {TAB_DEFS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChangeTab(tab.id)}
            aria-pressed={isActive}
            className={cn(
              'flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-[12.5px] font-semibold transition-colors active:scale-[0.97]',
              isActive
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-200'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
            )}
          >
            <Icon className="w-4 h-4" />
            <span>{t(tab.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );

  // ── Active panel content (shared across both modes) ──
  const activeContent = (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {activeTab === 'qa' && (
        <QATabPanel
          bridge={bridge}
          agentsById={agentsById}
          speakingAgentId={speakingAgentId}
          liveText={liveText}
          thinkingHint={thinkingHint}
        />
      )}
      {activeTab === 'members' && (
        <MembersTabPanel
          agents={agents}
          speakingAgentId={speakingAgentId}
          roleLabel={(r) => roleLabel(r, t)}
          t={t}
        />
      )}
      {activeTab === 'narrationLog' && (
        <NarrationLogTabPanel
          currentSceneId={currentSceneId}
          agentsById={agentsById}
          liveText={liveText}
          speakingAgentId={speakingAgentId}
        />
      )}
    </div>
  );

  // Overlay mode: fixed right-anchored sheet with scrim. Used by phone
  // portrait where there's no room to inline a 320px column without
  // killing the slide.
  if (mode === 'overlay') {
    return (
      <AnimatePresence initial={false}>
        {open && (
          <>
            <motion.div
              key="side-panel-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={onClose}
              className="absolute inset-0 z-40 bg-black/30 dark:bg-black/50"
              aria-hidden
            />
            <motion.aside
              key="side-panel-overlay"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              style={{ width: panelWidth }}
              className={cn(
                'absolute top-0 right-0 bottom-0 z-50 flex flex-col bg-white dark:bg-gray-950 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 overflow-hidden',
                className,
              )}
              aria-label="Auxiliary panel"
            >
              {tabHeader}
              {activeContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    );
  }

  // Inline mode (default): flex column that animates width.
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          key="tablet-side-panel"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: panelWidth, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          style={{ width: panelWidth }}
          className={cn(
            'shrink-0 h-full flex flex-col bg-white dark:bg-gray-950 border-l border-gray-100 dark:border-gray-800 overflow-hidden',
            className,
          )}
          aria-label="Auxiliary panel"
        >
          {tabHeader}
          {activeContent}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function QATabPanel({
  bridge,
  agentsById,
  speakingAgentId,
  liveText,
  thinkingHint,
}: {
  readonly bridge: MobileChatBridge;
  readonly agentsById: Record<string, AgentConfig | undefined>;
  readonly speakingAgentId: string | null;
  readonly liveText: string | null;
  readonly thinkingHint: string | null;
}) {
  return (
    <>
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
    </>
  );
}

function MembersTabPanel({
  agents,
  speakingAgentId,
  roleLabel: roleLabelFn,
  t,
}: {
  readonly agents: ReadonlyArray<AgentConfig>;
  readonly speakingAgentId: string | null;
  readonly roleLabel: (role: string) => string;
  readonly t: (key: string, params?: Record<string, unknown>) => string;
}) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="px-4 pt-3 pb-1.5 flex items-center justify-between">
        <span className="text-[10.5px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">
          {t('mobile.members.title')}
        </span>
        <span className="text-[10.5px] text-gray-400 dark:text-gray-500">
          {t('mobile.members.memberCount', { count: agents.length })}
        </span>
      </div>
      <ul className="px-2 pb-3 flex flex-col gap-1">
        {agents.map((a) => {
          const isSpeaker = a.id === speakingAgentId;
          const isTeacher = a.role === 'teacher';
          return (
            <li
              key={a.id}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl transition-colors',
                isSpeaker
                  ? 'bg-purple-50 dark:bg-purple-900/20'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-900/50',
              )}
            >
              <AgentAvatar avatar={a.avatar} alt={a.name} size={36} highlighted={isSpeaker} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 truncate">
                    {a.name}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold',
                      isTeacher
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
                    )}
                  >
                    {roleLabelFn(a.role)}
                  </span>
                  {isSpeaker && (
                    <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[9.5px] font-semibold">
                      <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{t('mobile.teacherDock.statusSpeaking')}</span>
                    </span>
                  )}
                </div>
                <div className="text-[11.5px] text-gray-500 dark:text-gray-400 truncate">
                  {a.persona?.slice(0, 80) || ''}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NarrationLogTabPanel({
  currentSceneId,
  agentsById,
  liveText,
  speakingAgentId,
}: {
  readonly currentSceneId: string | null;
  readonly agentsById: Record<string, AgentConfig | undefined>;
  readonly liveText: string | null;
  readonly speakingAgentId: string | null;
}) {
  const { t } = useI18n();
  const chats = useStageStore((s) => s.chats);

  const lectureSessions = useMemo<ChatSession[]>(
    () => chats.filter((c) => c.type === 'lecture'),
    [chats],
  );

  // Flatten lecture sessions into a chronologically-ordered list of
  // { sessionId, sceneId, text, agentId } segments. Agent attribution
  // comes from message metadata; we deliberately ignore role-only
  // attribution so user-visible names line up with the avatar list.
  const segments = useMemo(() => {
    type Seg = {
      key: string;
      sceneId: string | undefined;
      sceneActive: boolean;
      text: string;
      agentId: string | undefined;
      ts: number | undefined;
    };
    const out: Seg[] = [];
    for (const session of lectureSessions) {
      for (const m of session.messages) {
        const text = (m.parts ?? [])
          .filter((p) => p.type === 'text')
          .map((p) => (p as { text: string }).text)
          .join('')
          .trim();
        if (!text) continue;
        out.push({
          key: m.id,
          sceneId: session.sceneId,
          sceneActive: session.sceneId === currentSceneId,
          text,
          agentId: m.metadata?.agentId,
          ts: m.metadata?.createdAt,
        });
      }
    }
    return out;
  }, [lectureSessions, currentSceneId]);

  if (segments.length === 0 && !liveText) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-6">
        <span className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl mb-3">
          📓
        </span>
        <span className="text-[12.5px] text-gray-500 dark:text-gray-400">
          {t('mobile.tablet.narrationLog.empty')}
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2.5">
      {segments.map((seg) => {
        const agent = seg.agentId ? agentsById[seg.agentId] : undefined;
        return (
          <div
            key={seg.key}
            className={cn(
              'flex items-start gap-2.5 px-3 py-2 rounded-xl',
              seg.sceneActive
                ? 'bg-purple-50 dark:bg-purple-900/15'
                : 'bg-gray-50/70 dark:bg-gray-900/40',
            )}
          >
            <AgentAvatar
              avatar={agent?.avatar ?? '🧑‍🏫'}
              alt={agent?.name}
              size={28}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[11.5px] font-semibold text-gray-700 dark:text-gray-200 truncate">
                  {agent?.name ?? t('mobile.teacherDock.fallbackName')}
                </span>
                {seg.sceneActive && (
                  <span className="text-[9.5px] font-semibold text-purple-600 dark:text-purple-300">
                    ●
                  </span>
                )}
              </div>
              <p className="text-[12.5px] leading-relaxed text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">
                {seg.text}
              </p>
            </div>
          </div>
        );
      })}

      {liveText && (
        <div className="flex items-start gap-2.5 px-3 py-2 rounded-xl bg-purple-50 dark:bg-purple-900/15 ring-1 ring-purple-200/60 dark:ring-purple-800/50">
          <AgentAvatar
            avatar={
              speakingAgentId
                ? (agentsById[speakingAgentId]?.avatar ?? '✨')
                : '✨'
            }
            alt={speakingAgentId ? agentsById[speakingAgentId]?.name : undefined}
            size={28}
            highlighted
          />
          <div className="flex-1 min-w-0">
            <div className="text-[11.5px] font-semibold text-purple-700 dark:text-purple-200 mb-0.5 truncate">
              {speakingAgentId
                ? (agentsById[speakingAgentId]?.name ??
                  t('mobile.teacherDock.fallbackName'))
                : t('mobile.teacherDock.fallbackName')}
            </div>
            <p className="text-[12.5px] leading-relaxed text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">
              {liveText}
              <span className="inline-block w-1 h-3 align-middle ml-0.5 bg-purple-400 dark:bg-purple-500 animate-pulse rounded-sm" />
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
