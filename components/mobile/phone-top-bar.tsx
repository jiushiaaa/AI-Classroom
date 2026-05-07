'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, MoreHorizontal, LayoutGrid, Maximize2 } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';

interface PhoneTopBarProps {
  readonly title: string;
  readonly onOpenSceneGrid: () => void;
  readonly onTogglePresentation?: () => void;
  readonly onBack?: () => void;
  readonly className?: string;
}

/**
 * PhoneTopBar
 *
 * Slim 44px top chrome for the phone classroom view. Left side carries
 * an optional back arrow + the current scene title (truncated to one
 * line). Right side has a single "more" button that pops a tiny menu
 * with secondary entries (scene grid + presentation) — keeping the
 * default state to a single visible affordance per touch-design rules.
 */
export function PhoneTopBar({
  title,
  onOpenSceneGrid,
  onTogglePresentation,
  onBack,
  className,
}: PhoneTopBarProps) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current) return;
      if (e.target instanceof Node && menuRef.current.contains(e.target)) return;
      setMenuOpen(false);
    };
    globalThis.addEventListener('pointerdown', onPointerDown);
    return () => globalThis.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  return (
    <header
      className={cn(
        'shrink-0 flex items-center gap-2 px-2 h-11 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md',
        'border-b border-gray-100/80 dark:border-gray-800/80',
        className,
      )}
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label={t('mobile.topBar.back')}
          className="inline-flex items-center justify-center w-9 h-9 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      ) : (
        <span className="w-2" />
      )}

      <h2
        className="flex-1 min-w-0 text-[14px] font-semibold text-gray-800 dark:text-gray-100 truncate tracking-tight"
        title={title}
      >
        {title || t('common.loading')}
      </h2>

      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((s) => !s)}
          aria-label={t('mobile.topBar.more')}
          aria-pressed={menuOpen}
          className={cn(
            'inline-flex items-center justify-center w-9 h-9 rounded-full transition-all active:scale-95',
            menuOpen
              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
          )}
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-1.5 z-30 min-w-[160px] rounded-xl bg-white dark:bg-gray-900 shadow-xl ring-1 ring-black/5 dark:ring-white/10 py-1 overflow-hidden"
          >
            <MenuItem
              icon={LayoutGrid}
              label={t('mobile.topBar.openSceneGrid')}
              onClick={() => {
                setMenuOpen(false);
                onOpenSceneGrid();
              }}
            />
            {onTogglePresentation && (
              <MenuItem
                icon={Maximize2}
                label={t('mobile.topBar.fullscreen')}
                onClick={() => {
                  setMenuOpen(false);
                  onTogglePresentation();
                }}
              />
            )}
          </div>
        )}
      </div>
    </header>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  readonly icon: typeof LayoutGrid;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-700 transition-colors"
    >
      <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
      <span>{label}</span>
    </button>
  );
}
