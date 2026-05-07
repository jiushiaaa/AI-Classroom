'use client';

import { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useEditModeStore, useStageStore, useCanvasStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { StylePanel } from '@/components/chat/style-panel';
import { ElementTypes } from '@/lib/types/slides';

/**
 * Right-side "样式 / Format" drawer for the slide editor.
 *
 * - Lives inside the slide editor (so it has access to the same
 *   `<SceneProvider>` that wraps the canvas — `StylePanel` calls
 *   `useCanvasOperations()` which requires it).
 * - Mounted as an absolutely-positioned overlay over the canvas right
 *   edge, NOT inside the chat area on the far right of the page.
 * - Opened from the table mini toolbar via `setStylePanelOpen(true)`.
 *   Text / image / video do not use this drawer (no style panel shell).
 *
 * The drawer uses simple CSS transitions; we deliberately keep this
 * lightweight rather than pulling in shadcn `Sheet`, because we want to
 * dock it to the slide editor column (not the page-level body) and keep
 * the canvas underneath fully interactive.
 */
export function SlideStyleDrawer() {
  const { t } = useI18n();
  const open = useEditModeStore.use.stylePanelOpen();
  const setOpen = useEditModeStore.use.setStylePanelOpen();
  const isEditing = useEditModeStore.use.isEditing();
  const handleElementId = useCanvasStore.use.handleElementId();
  const currentSceneId = useStageStore.use.currentSceneId();
  const scenes = useStageStore.use.scenes();

  const handledElementType = useMemo(() => {
    if (!handleElementId || !currentSceneId) return null;
    const scene = scenes.find((s) => s.id === currentSceneId);
    if (!scene || scene.content.type !== 'slide') return null;
    const el = scene.content.canvas.elements.find((e) => e.id === handleElementId);
    return el?.type ?? null;
  }, [handleElementId, currentSceneId, scenes]);

  const stylePanelDisabledForSelection =
    handledElementType === ElementTypes.TEXT ||
    handledElementType === ElementTypes.IMAGE ||
    handledElementType === ElementTypes.VIDEO;

  useEffect(() => {
    if (stylePanelDisabledForSelection) {
      setOpen(false);
    }
  }, [stylePanelDisabledForSelection, setOpen]);

  if (!isEditing) return null;
  if (stylePanelDisabledForSelection) return null;

  return (
    <div
      aria-hidden={!open}
      className={cn(
        'absolute right-0 top-0 bottom-0 z-30 w-[min(100%,320px)] max-w-[90vw]',
        'bg-gradient-to-b from-white to-gray-50/95 dark:from-gray-950 dark:to-gray-950',
        'border-l border-gray-200/90 dark:border-gray-800/90',
        'shadow-[-12px_0_32px_-8px_rgba(15,23,42,0.12)] dark:shadow-[-12px_0_32px_-8px_rgba(0,0,0,0.45)]',
        'flex flex-col overflow-hidden min-w-0',
        'transition-transform duration-200 ease-out',
        open ? 'translate-x-0' : 'translate-x-full pointer-events-none',
      )}
    >
      <header className="flex items-center justify-between gap-2 h-11 shrink-0 px-3 border-b border-gray-200/70 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm">
        <h2 className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 tracking-tight">
          {t('chat.tabs.style')}
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t('common.close', { defaultValue: 'Close' })}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          <X className="size-4" />
        </button>
      </header>

      {/* Scroll lives here so long StylePanel content is never clipped */}
      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-gutter:stable]">
        <StylePanel />
      </div>
    </div>
  );
}
