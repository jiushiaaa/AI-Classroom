'use client';

import {
  ChevronLeft,
  LayoutGrid,
  Maximize2,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';

interface TabletTopBarProps {
  readonly title: string;
  readonly sidePanelOpen: boolean;
  readonly onToggleSidePanel: () => void;
  readonly onOpenSceneGrid: () => void;
  readonly onTogglePresentation?: () => void;
  readonly onBack?: () => void;
  readonly className?: string;
}

/**
 * TabletTopBar
 *
 * 52px top chrome for the iPad / phone preview classroom view.
 *
 * Layout (left → right):
 *   [back?]  [title]   [sceneGrid]  [sidePanelToggle]  [fullscreen]
 *
 * v1.12.2 — The "More" kebab + popover menu was removed entirely. Its
 * historical inhabitants have all been promoted elsewhere:
 *   - fullscreen → first-class round button at the right edge (v1.12.1)
 *   - whiteboard → secondary cluster on `TabletControlBar`, next to
 *                  auto-play (v1.12.2)
 * With nothing left to host, the kebab itself was redundant.
 */
export function TabletTopBar({
  title,
  sidePanelOpen,
  onToggleSidePanel,
  onOpenSceneGrid,
  onTogglePresentation,
  onBack,
  className,
}: TabletTopBarProps) {
  const { t } = useI18n();

  return (
    <header
      className={cn(
        'shrink-0 flex items-center gap-2 px-3 h-13 min-h-[52px] bg-white/95 dark:bg-gray-950/95 backdrop-blur-md',
        'border-b border-gray-100 dark:border-gray-800',
        className,
      )}
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label={t('mobile.topBar.back')}
          className="inline-flex items-center justify-center w-10 h-10 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      ) : (
        <span className="w-2" />
      )}

      <h2
        className="flex-1 min-w-0 text-[15.5px] font-semibold text-gray-800 dark:text-gray-100 truncate tracking-tight"
        title={title}
      >
        {title || t('common.loading')}
      </h2>

      <button
        type="button"
        onClick={onOpenSceneGrid}
        aria-label={t('mobile.topBar.openSceneGrid')}
        title={t('mobile.topBar.openSceneGrid')}
        className="inline-flex items-center justify-center w-10 h-10 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all"
      >
        <LayoutGrid className="w-4.5 h-4.5" />
      </button>

      <button
        type="button"
        onClick={onToggleSidePanel}
        aria-pressed={sidePanelOpen}
        aria-label={
          sidePanelOpen
            ? t('mobile.tablet.sidePanel.collapse')
            : t('mobile.tablet.sidePanel.expand')
        }
        title={
          sidePanelOpen
            ? t('mobile.tablet.sidePanel.collapse')
            : t('mobile.tablet.sidePanel.expand')
        }
        className={cn(
          'inline-flex items-center justify-center w-10 h-10 rounded-full transition-all active:scale-95',
          sidePanelOpen
            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
        )}
      >
        {sidePanelOpen ? (
          <PanelRightClose className="w-5 h-5" />
        ) : (
          <PanelRightOpen className="w-5 h-5" />
        )}
      </button>

      {/* v1.12.1 — direct fullscreen / immersive toggle.
          Previously fullscreen lived in the More kebab menu, which
          the publisher said was too easy to miss. v1.12.1 surfaced
          it here as a first-class round button. v1.12.2 removed the
          kebab entirely after whiteboard also moved out of the menu
          (now lives on the ControlBar's secondary cluster). */}
      {onTogglePresentation && (
        <button
          type="button"
          onClick={onTogglePresentation}
          aria-label={t('mobile.topBar.fullscreen')}
          title={t('mobile.topBar.fullscreen')}
          className="inline-flex items-center justify-center w-10 h-10 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all"
        >
          <Maximize2 className="w-4.5 h-4.5" />
        </button>
      )}
    </header>
  );
}
