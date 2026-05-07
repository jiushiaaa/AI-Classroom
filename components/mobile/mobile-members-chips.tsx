'use client';

import { cn } from '@/lib/utils';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
import { AgentAvatar } from './agent-avatar';

interface MobileMembersChipsProps {
  readonly agents: ReadonlyArray<AgentConfig>;
  readonly speakingAgentId?: string | null;
  readonly className?: string;
}

/**
 * MobileMembersChips
 *
 * Horizontal row of pill chips showing every agent in the classroom (the
 * "课堂成员" list from the reference design). The currently speaking agent
 * gets a soft purple ring so the publisher can verify avatar parity with
 * the desktop roundtable.
 */
export function MobileMembersChips({
  agents,
  speakingAgentId,
  className,
}: MobileMembersChipsProps) {
  if (agents.length === 0) return null;

  return (
    <div
      className={cn(
        'flex flex-nowrap items-center gap-1.5 px-3 py-2 overflow-x-auto no-scrollbar',
        className,
      )}
      role="list"
    >
      {agents.map((a) => {
        const isSpeaking = speakingAgentId === a.id;
        const isTeacher = a.role === 'teacher';
        return (
          <span
            key={a.id}
            role="listitem"
            className={cn(
              'inline-flex items-center gap-1 shrink-0 rounded-full pl-1 pr-2.5 py-0.5 text-[11px] font-medium',
              'border transition-all',
              isTeacher
                ? 'border-amber-200/70 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                : 'border-purple-200/60 dark:border-purple-700/40 bg-purple-50/60 dark:bg-purple-900/15 text-purple-700 dark:text-purple-300',
              isSpeaking && 'ring-2 ring-purple-400/60 dark:ring-purple-500/60 shadow-sm',
            )}
            title={`${a.name} · ${a.role}`}
          >
            <AgentAvatar avatar={a.avatar} alt={a.name} size={20} />
            <span className="truncate max-w-[5.5rem]">{a.name}</span>
          </span>
        );
      })}
    </div>
  );
}
