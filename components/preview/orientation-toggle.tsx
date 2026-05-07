'use client';

import { Smartphone, RotateCw } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { usePreviewDeviceStore } from '@/lib/store/preview-device';
import { cn } from '@/lib/utils';

/**
 * OrientationToggle
 *
 * Pill-shaped icon button that flips the mobile / iPad preview between
 * landscape (default) and portrait. Renders nothing in web mode — orientation
 * has no meaning when the editor is showing the desktop layout.
 *
 * Sits to the right of `DevicePreviewTabs` on the editor preview strip (the
 * pill variant above the device frame). The icon glyph is the device silhouette (rotated 90deg in portrait
 * mode) plus a small overlapping `RotateCw` cue so the publisher reads it as
 * "flip orientation" rather than "open phone settings".
 */
export function OrientationToggle() {
  const { t } = useI18n();
  const previewDevice = usePreviewDeviceStore((s) => s.previewDevice);
  const previewOrientation = usePreviewDeviceStore((s) => s.previewOrientation);
  const toggleOrientation = usePreviewDeviceStore((s) => s.toggleOrientation);

  if (previewDevice === 'web') return null;

  const isLandscape = previewOrientation === 'landscape';
  const tooltip = isLandscape
    ? t('preview.orientation.toggleToPortrait')
    : t('preview.orientation.toggleToLandscape');

  return (
    <button
      type="button"
      onClick={toggleOrientation}
      title={tooltip}
      aria-label={tooltip}
      data-testid="orientation-toggle"
      className={cn(
        'group relative flex items-center justify-center w-9 h-9 rounded-full',
        'bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-100/60 dark:border-gray-700/60',
        'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200',
        'hover:bg-white/90 dark:hover:bg-gray-700/80 shadow-sm',
        'transition-all duration-200',
      )}
    >
      <Smartphone
        className={cn(
          'w-4 h-4 transition-transform duration-300',
          isLandscape ? 'rotate-0' : 'rotate-90',
        )}
      />
      <RotateCw className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 text-purple-500 dark:text-purple-400 opacity-80 group-hover:rotate-45 transition-transform duration-200" />
    </button>
  );
}
