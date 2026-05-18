'use client';

import { Monitor, Smartphone, Tablet } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { usePreviewDeviceStore, type PreviewDevice } from '@/lib/store/preview-device';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { OrientationToggle } from './orientation-toggle';

export type DevicePreviewTabsVariant = 'pill' | 'iconRail';

interface DeviceOption {
  readonly id: PreviewDevice;
  readonly icon: typeof Monitor;
  readonly labelKey: string;
}

const OPTIONS: ReadonlyArray<DeviceOption> = [
  { id: 'web', icon: Monitor, labelKey: 'preview.web' },
  { id: 'mobile', icon: Smartphone, labelKey: 'preview.mobile' },
  { id: 'tablet', icon: Tablet, labelKey: 'preview.tablet' },
];

interface DevicePreviewTabsProps {
  /**
   * `pill` — capsule tablist with icon-only tabs; labels on hover tooltip.
   * `iconRail` — three standalone circular icon buttons matching Publish /
   * Download chrome in the classroom Header (labels only in `title` tooltip).
   */
  readonly variant?: DevicePreviewTabsVariant;
  /** When true, append the landscape / portrait toggle inside the pill group. */
  readonly showOrientationToggle?: boolean;
}

/**
 * DevicePreviewTabs
 *
 * Lets the publisher switch the editor preview between web, mobile, and
 * tablet. Two visual treatments share the same Zustand store.
 */
export function DevicePreviewTabs({
  variant = 'pill',
  showOrientationToggle = false,
}: DevicePreviewTabsProps) {
  const { t } = useI18n();
  const previewDevice = usePreviewDeviceStore((s) => s.previewDevice);
  const setPreviewDevice = usePreviewDeviceStore((s) => s.setPreviewDevice);

  if (variant === 'iconRail') {
    return (
      <div
        role="tablist"
        aria-label={t('preview.deviceLabel')}
        className="flex items-center gap-0.5 shrink-0"
      >
        {OPTIONS.map(({ id, icon: Icon, labelKey }) => {
          const active = previewDevice === id;
          const label = t(labelKey);
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={label}
              title={label}
              onClick={() => setPreviewDevice(id)}
              className={cn(
                'shrink-0 p-2 rounded-full transition-all',
                active
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 shadow-sm ring-1 ring-purple-200/60 dark:ring-purple-700/50'
                  : 'text-gray-400 dark:text-gray-500 hover:bg-white dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 hover:shadow-sm',
              )}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      aria-label={t('preview.deviceLabel')}
      className="flex items-center gap-0.5 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md p-1 rounded-full border border-gray-100/60 dark:border-gray-700/60 shadow-sm"
    >
        {OPTIONS.map(({ id, icon: Icon, labelKey }) => {
          const active = previewDevice === id;
          const label = t(labelKey);
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={label}
                  onClick={() => setPreviewDevice(id)}
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full transition-all',
                    active
                      ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-md shadow-purple-200/60 dark:shadow-purple-900/40'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-white/80 dark:hover:bg-gray-700/60',
                  )}
                >
                  <Icon className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6} className="text-xs">
                {label}
              </TooltipContent>
            </Tooltip>
          );
        })}
        {showOrientationToggle && (
          <>
            <span
              className="w-px h-6 mx-0.5 bg-gray-200/80 dark:bg-gray-600/80 shrink-0"
              aria-hidden
            />
            <OrientationToggle embedded />
          </>
        )}
    </div>
  );
}
