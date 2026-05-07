'use client';

import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
import { AgentAvatar } from './agent-avatar';
import { MobileBottomSheet } from './mobile-bottom-sheet';

interface MobileMembersSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly agents: ReadonlyArray<AgentConfig>;
  readonly speakingAgentId: string | null;
  readonly bottomOffset?: number;
  readonly heightRatio?: number;
}

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
 * MobileMembersSheet
 *
 * Scrolling roster of every agent in the classroom. Highlights the active
 * speaker at the top, then lists everyone else with their role badge and
 * a one-line persona excerpt. Used when the publisher taps the "成员"
 * tab on the phone — replaces the cramped chip row that used to be
 * stuffed inside the QA panel.
 */
export function MobileMembersSheet({
  open,
  onClose,
  agents,
  speakingAgentId,
  bottomOffset = 0,
  heightRatio = 0.7,
}: MobileMembersSheetProps) {
  const { t } = useI18n();
  const speaker = speakingAgentId ? agents.find((a) => a.id === speakingAgentId) : null;

  return (
    <MobileBottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.members.title')}
      bottomOffset={bottomOffset}
      heightRatio={heightRatio}
    >
      <div className="shrink-0 px-4 pt-3 pb-2 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-br from-purple-50/60 to-fuchsia-50/40 dark:from-purple-900/15 dark:to-fuchsia-900/10">
        <div className="text-[10.5px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
          {t('mobile.members.currentSpeaker')}
        </div>
        {speaker ? (
          <div className="flex items-center gap-3">
            <AgentAvatar avatar={speaker.avatar} alt={speaker.name} size={40} highlighted />
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-semibold text-gray-800 dark:text-gray-100 truncate">
                {speaker.name}
              </div>
              <div className="text-[11.5px] text-purple-600 dark:text-purple-300 truncate">
                {roleLabel(speaker.role, t)}
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10.5px] font-semibold">
              <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
              <span>{t('mobile.teacherDock.statusSpeaking')}</span>
            </span>
          </div>
        ) : (
          <div className="text-[12.5px] text-gray-400 dark:text-gray-500 py-1.5">
            {t('mobile.members.nobodySpeaking')}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-4 pt-3 pb-1 flex items-center justify-between text-[10.5px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
          <span>{t('mobile.members.title')}</span>
          <span className="normal-case tracking-normal text-gray-400 dark:text-gray-500">
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
                      {roleLabel(a.role, t)}
                    </span>
                  </div>
                  <div className="text-[11.5px] text-gray-500 dark:text-gray-400 truncate">
                    {a.persona?.slice(0, 60) || ''}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </MobileBottomSheet>
  );
}
