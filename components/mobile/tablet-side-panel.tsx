'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Users, ScrollText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { UIMessage } from 'ai';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';
import { useStageStore } from '@/lib/store';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
import type { MobileChatBridge } from '@/lib/hooks/use-mobile-chat-bridge';
import type { ChatSession, ChatMessageMetadata } from '@/lib/types/chat';
import { AgentAvatar } from './agent-avatar';
import { MobileMessageList } from './mobile-message-list';
import { MobileChatInput } from './mobile-chat-input';
import { MobileMembersChips } from './mobile-members-chips';

export type TabletSidePanelTab = 'qa' | 'members' | 'narrationLog';

interface TabletSidePanelProps {
  readonly open: boolean;
  /**
   * Tab state — only meaningful when `unified` is false. The phone
   * `unified` layout collapses everything into one scroll column and
   * ignores these props entirely.
   */
  readonly activeTab?: TabletSidePanelTab;
  readonly onChangeTab?: (tab: TabletSidePanelTab) => void;

  readonly bridge: MobileChatBridge;
  readonly agents: ReadonlyArray<AgentConfig>;
  readonly agentsById: Record<string, AgentConfig | undefined>;
  readonly speakingAgentId: string | null;
  readonly liveText: string | null;
  readonly thinkingHint: string | null;

  readonly currentSceneId: string | null;

  /**
   * `'inline'` (default) → the panel sits inline as a flex column —
   * pushes the main stage column. In landscape it consumes width; in
   * portrait it can consume height so the stage and dialogue split
   * vertically.
   *
   * `'overlay'` → the panel floats over the stage as an absolutely
   * positioned right-anchored sheet with a dim scrim behind it. Kept as
   * a reusable fallback for narrow custom surfaces; the current phone /
   * iPad preview uses inline vertical splitting in portrait.
   */
  readonly mode?: 'inline' | 'overlay';
  readonly inlineAxis?: 'horizontal' | 'vertical';
  /** Used in overlay mode to dismiss the panel by tapping the scrim. */
  readonly onClose?: () => void;
  /** Override the default 340px panel width (used by phone landscape). */
  readonly width?: number;
  /** Override the default inline height when `inlineAxis="vertical"`. */
  readonly height?: number | string;

  /**
   * When true, the panel renders a single unified column instead of the
   * three-tab segmented header. Used by the phone (mobile) layout where
   * publishers asked us to collapse "问答 / 成员 / 讲解记录" into one
   * scrollable surface — member chips on top, lecture transcript + Q&A
   * messages merged chronologically in the middle, chat input on the
   * bottom. iPad keeps the tab variant since it has the room for it.
   */
  readonly unified?: boolean;

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
  activeTab = 'qa',
  onChangeTab,
  bridge,
  agents,
  agentsById,
  speakingAgentId,
  liveText,
  thinkingHint,
  currentSceneId,
  mode = 'inline',
  inlineAxis = 'horizontal',
  onClose,
  width,
  height,
  unified = false,
  className,
}: TabletSidePanelProps) {
  const { t } = useI18n();

  const panelWidth = width ?? PANEL_WIDTH_OPEN;
  const panelHeight = height ?? PANEL_WIDTH_OPEN;

  // ── Tab header (only rendered in tab mode — unified layout collapses
  //    the three sections into one scroll column with no top tabs). ──
  const tabHeader = !unified && (
    <div className="shrink-0 flex items-center gap-1 px-2 pt-2 pb-1 border-b border-gray-100 dark:border-gray-800">
      {TAB_DEFS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChangeTab?.(tab.id)}
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

  // ── Active panel content ──
  // Phone (`unified`) gets the merged single-column layout; iPad keeps
  // the existing tab-switched panes.
  const activeContent = unified ? (
    <UnifiedPanelContent
      bridge={bridge}
      agents={agents}
      agentsById={agentsById}
      speakingAgentId={speakingAgentId}
      liveText={liveText}
      thinkingHint={thinkingHint}
      currentSceneId={currentSceneId}
    />
  ) : (
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

  // Overlay mode: fixed right-anchored sheet with scrim. Kept for
  // custom narrow surfaces; mobile classroom portrait now uses inline
  // vertical splitting instead.
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

  // Inline mode (default): flex column that animates width in landscape
  // and height in portrait.
  if (inlineAxis === 'vertical') {
    return (
      <AnimatePresence initial={false}>
        {open && (
          <motion.aside
            key="tablet-side-panel-vertical"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: panelHeight, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            style={{ height: panelHeight }}
            className={cn(
              'shrink-0 w-full flex flex-col bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800 overflow-hidden',
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

/**
 * UnifiedPanelContent — phone-only single-column collapse.
 *
 * Publishers asked for the three-tab side panel (问答 / 成员 / 讲解记录)
 * to fold into one continuous surface on phone. This component does the
 * actual collapse by stacking, top-to-bottom:
 *
 *   1. A compact horizontal `MobileMembersChips` strip — replaces the
 *      "成员" tab. Avatars + names scroll horizontally; the speaking
 *      agent gets a purple ring so the publisher can spot the live
 *      voice without leaving the panel.
 *   2. A unified message stream — replaces the "问答" + "讲解记录"
 *      tabs. Lecture-source segments and Q&A messages are interleaved
 *      chronologically (by `createdAt`). Lecture rows render as left-
 *      aligned narration cards with a small "讲解" badge so readers can
 *      tell which voice is which; Q&A rows reuse the standard chat
 *      bubble styling. The currently-streaming `liveText` lands as the
 *      tail bubble exactly like the original tabbed panes.
 *   3. The `MobileChatInput` footer — unchanged.
 *
 * iPad continues to use the original `QATabPanel` / `MembersTabPanel` /
 * `NarrationLogTabPanel` components via the tab header above; this
 * component is only mounted when `unified={true}`.
 */
function UnifiedPanelContent({
  bridge,
  agents,
  agentsById,
  speakingAgentId,
  liveText,
  thinkingHint,
  currentSceneId,
}: {
  readonly bridge: MobileChatBridge;
  readonly agents: ReadonlyArray<AgentConfig>;
  readonly agentsById: Record<string, AgentConfig | undefined>;
  readonly speakingAgentId: string | null;
  readonly liveText: string | null;
  readonly thinkingHint: string | null;
  readonly currentSceneId: string | null;
}) {
  const chats = useStageStore((s) => s.chats);

  const lectureSessions = useMemo<ChatSession[]>(
    () => chats.filter((c) => c.type === 'lecture'),
    [chats],
  );

  // Merge all lecture transcript segments with the active QA session's
  // messages into a single chronologically-sorted stream. We deliberately
  // keep the active QA session as the source of QA truth (rather than
  // every QA session in history) so the panel mirrors the original
  // QATabPanel scope and avoids surprising the publisher with messages
  // from unrelated past scenes.
  const items = useMemo<ReadonlyArray<UnifiedItem>>(() => {
    const out: UnifiedItem[] = [];

    for (const session of lectureSessions) {
      for (const m of session.messages) {
        const text = (m.parts ?? [])
          .filter((p) => p.type === 'text')
          .map((p) => (p as { text: string }).text)
          .join('')
          .trim();
        if (!text) continue;
        out.push({
          kind: 'lecture',
          key: `lec:${m.id}`,
          text,
          agentId: m.metadata?.agentId,
          ts: m.metadata?.createdAt ?? 0,
          sceneActive: session.sceneId === currentSceneId,
        });
      }
    }

    for (const m of bridge.activeMessages) {
      const text = (m.parts ?? [])
        .filter((p) => p.type === 'text')
        .map((p) => (p as { text: string }).text)
        .join('')
        .trim();
      if (!text) continue;
      out.push({
        kind: 'qa',
        key: `qa:${m.id}`,
        msg: m,
        ts: m.metadata?.createdAt ?? 0,
      });
    }

    out.sort((a, b) => (a.ts || 0) - (b.ts || 0));
    return out;
  }, [lectureSessions, bridge.activeMessages, currentSceneId]);

  return (
    <>
      {/* Members — compact chip strip replaces the standalone tab. */}
      <div className="shrink-0 border-b border-gray-100 dark:border-gray-800">
        <MobileMembersChips
          agents={agents}
          speakingAgentId={speakingAgentId}
        />
      </div>

      {/* Conversation stream — lecture + Q&A merged chronologically. */}
      <UnifiedMessageStream
        items={items}
        agentsById={agentsById}
        liveText={liveText}
        liveAgentId={speakingAgentId}
        thinkingHint={thinkingHint}
      />

      {/* Chat input footer — same affordance the original QATabPanel
          surfaced; publishers can keep typing while the lecture runs. */}
      <MobileChatInput
        onSend={bridge.sendMessage}
        isStreaming={bridge.isStreaming}
        onStop={bridge.endActiveSession}
      />
    </>
  );
}

type UnifiedItem =
  | {
      kind: 'lecture';
      key: string;
      text: string;
      agentId?: string;
      ts: number;
      sceneActive: boolean;
    }
  | {
      kind: 'qa';
      key: string;
      msg: UIMessage<ChatMessageMetadata>;
      ts: number;
    };

function UnifiedMessageStream({
  items,
  agentsById,
  liveText,
  liveAgentId,
  thinkingHint,
}: {
  readonly items: ReadonlyArray<UnifiedItem>;
  readonly agentsById: Record<string, AgentConfig | undefined>;
  readonly liveText: string | null;
  readonly liveAgentId: string | null;
  readonly thinkingHint: string | null;
}) {
  const { t } = useI18n();

  if (items.length === 0 && !liveText && !thinkingHint) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-6">
        <span className="w-11 h-11 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xl mb-2.5">
          💬
        </span>
        <span className="text-[12px] text-gray-500 dark:text-gray-400">
          {t('mobile.qa.emptyHint')}
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2.5 space-y-2.5">
      {items.map((item) =>
        item.kind === 'lecture' ? (
          <LectureRow
            key={item.key}
            text={item.text}
            agent={item.agentId ? agentsById[item.agentId] : undefined}
            sceneActive={item.sceneActive}
            tagLabel={t('mobile.tabs.narration')}
            ts={item.ts}
          />
        ) : (
          <QARow
            key={item.key}
            msg={item.msg}
            agentsById={agentsById}
            youLabel={t('mobile.qa.you')}
          />
        ),
      )}

      {liveText && (
        <LectureRow
          key="__live__"
          text={liveText}
          agent={liveAgentId ? agentsById[liveAgentId] : undefined}
          sceneActive
          live
          tagLabel={t('mobile.tabs.narration')}
          ts={0}
        />
      )}
      {!liveText && thinkingHint && (
        <div className="flex items-start gap-2 opacity-80">
          <AgentAvatar avatar="💭" size={28} />
          <div className="rounded-2xl px-3 py-1.5 bg-gray-100 dark:bg-gray-800/70 text-gray-700 dark:text-gray-200 text-[12px]">
            {thinkingHint}…
          </div>
        </div>
      )}
    </div>
  );
}

function LectureRow({
  text,
  agent,
  sceneActive,
  live = false,
  tagLabel,
  ts,
}: {
  readonly text: string;
  readonly agent: AgentConfig | undefined;
  readonly sceneActive: boolean;
  readonly live?: boolean;
  readonly tagLabel: string;
  readonly ts: number;
}) {
  let containerTone: string;
  if (live) {
    containerTone =
      'bg-purple-50 dark:bg-purple-900/15 ring-1 ring-purple-200/60 dark:ring-purple-800/50';
  } else if (sceneActive) {
    containerTone = 'bg-purple-50/70 dark:bg-purple-900/10';
  } else {
    containerTone = 'bg-gray-50/80 dark:bg-gray-900/40';
  }

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 px-3 py-2 rounded-xl',
        containerTone,
      )}
    >
      <AgentAvatar
        avatar={agent?.avatar ?? '🧑‍🏫'}
        alt={agent?.name}
        size={28}
        highlighted={live}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 truncate max-w-[7rem]">
            {agent?.name ?? ''}
          </span>
          <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[9.5px] font-semibold">
            {tagLabel}
          </span>
          {sceneActive && !live && (
            <span className="text-[9.5px] font-semibold text-purple-600 dark:text-purple-300">
              ●
            </span>
          )}
          {ts > 0 && !live && (
            <span className="ml-auto text-[9.5px] text-gray-300 dark:text-gray-600 tabular-nums">
              {formatTime(ts)}
            </span>
          )}
        </div>
        <p className="text-[12.5px] leading-relaxed text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">
          {text}
          {live && (
            <span className="inline-block w-1 h-3 align-middle ml-0.5 bg-purple-400 dark:bg-purple-500 animate-pulse rounded-sm" />
          )}
        </p>
      </div>
    </div>
  );
}

function QARow({
  msg,
  agentsById,
  youLabel,
}: {
  readonly msg: UIMessage<ChatMessageMetadata>;
  readonly agentsById: Record<string, AgentConfig | undefined>;
  readonly youLabel: string;
}) {
  const isUser = msg.role === 'user';
  const meta = msg.metadata;
  const agent = meta?.agentId ? agentsById[meta.agentId] : undefined;
  const senderName = isUser
    ? (meta?.senderName ?? youLabel)
    : (agent?.name ?? meta?.senderName ?? '');
  const senderAvatar = isUser
    ? (meta?.senderAvatar ?? '🙂')
    : (agent?.avatar ?? '🤖');
  const text = (msg.parts ?? [])
    .filter((p) => p.type === 'text')
    .map((p) => (p as { text: string }).text)
    .join('');
  const ts = meta?.createdAt ? formatTime(meta.createdAt) : '';

  return (
    <div className={cn('flex items-start gap-2', isUser && 'flex-row-reverse')}>
      <AgentAvatar
        avatar={senderAvatar}
        alt={senderName}
        size={28}
        className={cn(isUser && 'bg-purple-500/10 ring-purple-300/40')}
      />
      <div
        className={cn(
          'flex flex-col min-w-0 max-w-[80%]',
          isUser && 'items-end',
        )}
      >
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
}

function formatTime(ts: number): string {
  try {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '';
  }
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
