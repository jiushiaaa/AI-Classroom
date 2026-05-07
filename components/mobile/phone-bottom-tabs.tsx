'use client';

import type { LucideIcon } from 'lucide-react';
import { Presentation, MessageSquare, Users, Mic } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';

export type PhoneTab = 'composer' | 'narration' | 'qa' | 'members';

interface PhoneBottomTabsProps {
  readonly activeTab: PhoneTab;
  readonly onChange: (tab: PhoneTab) => void;
  /** Optional unread / live indicator dots. */
  readonly badges?: Partial<Record<PhoneTab, boolean>>;
  readonly className?: string;
}

const TAB_DEFS: ReadonlyArray<{ id: PhoneTab; icon: LucideIcon; labelKey: string }> = [
  { id: 'composer', icon: Presentation, labelKey: 'mobile.tabs.composer' },
  { id: 'narration', icon: Mic, labelKey: 'mobile.tabs.narration' },
  { id: 'qa', icon: MessageSquare, labelKey: 'mobile.tabs.qa' },
  { id: 'members', icon: Users, labelKey: 'mobile.tabs.members' },
];

/**
 * PhoneBottomTabs
 *
 * Four-segment bottom tab bar that drives the active sheet. `composer` is
 * the default state (slide is fully visible, no sheet open). The other
 * three tabs lift their corresponding half-height sheet over the slide
 * stage. Uses iconography + text labels for clarity at 52px height.
 */
export function PhoneBottomTabs({
  activeTab,
  onChange,
  badges,
  className,
}: PhoneBottomTabsProps) {
  const { t } = useI18n();

  return (
    <nav
      className={cn(
        'shrink-0 flex items-stretch h-[52px] px-1 bg-white dark:bg-gray-950',
        'border-t border-gray-200 dark:border-gray-800',
        'pb-[env(safe-area-inset-bottom,0px)]',
        className,
      )}
      aria-label="Bottom navigation"
    >
      {TAB_DEFS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const showBadge = !!badges?.[tab.id] && !isActive;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            aria-pressed={isActive}
            aria-label={t(tab.labelKey)}
            className={cn(
              'flex-1 inline-flex flex-col items-center justify-center gap-0.5 relative',
              'transition-colors active:scale-95',
              isActive
                ? 'text-purple-600 dark:text-purple-300'
                : 'text-gray-500 dark:text-gray-400',
            )}
          >
            <span className="relative">
              <Icon
                className={cn('w-[18px] h-[18px]', isActive && 'drop-shadow-sm')}
                strokeWidth={isActive ? 2.4 : 2}
              />
              {showBadge && (
                <span className="absolute -top-0.5 -right-1 w-1.5 h-1.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-gray-950" />
              )}
            </span>
            <span className={cn('text-[10.5px] font-medium', isActive && 'font-semibold')}>
              {t(tab.labelKey)}
            </span>
            {isActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-0.5 rounded-full bg-purple-500 dark:bg-purple-400" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
