'use client';

import { Monitor, Smartphone, Tablet } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { usePreviewDeviceStore, type PreviewDevice } from '@/lib/store/preview-device';
import { cn } from '@/lib/utils';

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

/**
 * DevicePreviewTabs
 *
 * Sits in the centre of the classroom Header. Lets the publisher switch the
 * editor preview between web, mobile (16:9 landscape), and tablet (4:3) frames.
 */
export function DevicePreviewTabs() {
  const { t } = useI18n();
  const previewDevice = usePreviewDeviceStore((s) => s.previewDevice);
  const setPreviewDevice = usePreviewDeviceStore((s) => s.setPreviewDevice);

  return (
    <div
      role="tablist"
      aria-label={t('preview.deviceLabel')}
      className="flex items-center gap-1 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md p-1 rounded-full border border-gray-100/60 dark:border-gray-700/60 shadow-sm"
    >
      {OPTIONS.map(({ id, icon: Icon, labelKey }) => {
        const active = previewDevice === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setPreviewDevice(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
              active
                ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-md shadow-purple-200/60 dark:shadow-purple-900/40'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-white/80 dark:hover:bg-gray-700/60',
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{t(labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
