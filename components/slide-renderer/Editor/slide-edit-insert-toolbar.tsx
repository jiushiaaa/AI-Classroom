'use client';

import { useCallback } from 'react';
import { ImageIcon, Redo2, Table2, Type, Undo2, Video } from 'lucide-react';
import { useEditModeStore } from '@/lib/store/edit-mode';
import { useCanvasStore } from '@/lib/store/canvas';
import { useSnapshotStore } from '@/lib/store';
import { useCanvasOperations } from '@/lib/hooks/use-canvas-operations';
import { useHistorySnapshot } from '@/lib/hooks/use-history-snapshot';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';
import {
  createSlideImageElement,
  createSlideTableElement,
  createSlideTextElement,
  createSlideVideoElement,
} from '@/lib/utils/slide-element-factories';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface InsertBtnProps {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly onClick: () => void;
}

function InsertBtn({ icon, label, onClick }: InsertBtnProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'group inline-flex flex-col items-center justify-center gap-1 px-3 min-h-[52px] min-w-[52px] rounded-xl',
        'text-[11px] font-medium text-gray-600 dark:text-gray-300',
        'transition-all duration-150 ease-out',
        'hover:bg-white dark:hover:bg-gray-800/90',
        'hover:shadow-sm hover:ring-1 hover:ring-violet-200/70 dark:hover:ring-violet-500/25',
        'active:scale-[0.97]',
        '[&_svg]:size-[18px] text-gray-500 group-hover:text-violet-600 dark:text-gray-400 dark:group-hover:text-violet-400',
      )}
    >
      <span className="flex items-center justify-center">{icon}</span>
      <span className="leading-none tracking-tight">{label}</span>
    </button>
  );
}

interface HistoryBtnProps {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly disabled: boolean;
  readonly onClick: () => void;
}

function HistoryBtn({ icon, label, disabled, onClick }: HistoryBtnProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          title={label}
          aria-label={label}
          aria-disabled={disabled}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
          className={cn(
            'inline-flex items-center justify-center min-h-[52px] min-w-[44px] rounded-xl shrink-0',
            'text-gray-500 dark:text-gray-400 transition-all duration-150 ease-out',
            'hover:bg-white dark:hover:bg-gray-800/90 hover:text-violet-600 dark:hover:text-violet-400',
            'hover:shadow-sm hover:ring-1 hover:ring-violet-200/70 dark:hover:ring-violet-500/25',
            'active:scale-[0.97]',
            '[&_svg]:size-[20px]',
            disabled && 'opacity-35 pointer-events-none hover:bg-transparent hover:shadow-none hover:ring-0',
          )}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Insert + undo/redo toolbar above the slide canvas in edit mode.
 */
export function SlideEditInsertToolbar() {
  const { t } = useI18n();
  const isEditing = useEditModeStore.use.isEditing();
  const viewportSize = useCanvasStore.use.viewportSize();
  const viewportRatio = useCanvasStore.use.viewportRatio();

  const snapshotCursor = useSnapshotStore((s) => s.snapshotCursor);
  const snapshotLength = useSnapshotStore((s) => s.snapshotLength);
  const undo = useSnapshotStore((s) => s.undo);
  const redo = useSnapshotStore((s) => s.redo);
  const canUndo = snapshotCursor > 0;
  const canRedo = snapshotCursor < snapshotLength - 1;

  const { addElement } = useCanvasOperations();
  const { addHistorySnapshot } = useHistorySnapshot();

  const vw = viewportSize || 1000;
  const vh = vw * (viewportRatio || 0.5625);

  const insertText = useCallback(() => {
    addElement(createSlideTextElement(vw, vh));
    addHistorySnapshot();
  }, [addElement, addHistorySnapshot, vw, vh]);

  const insertImage = useCallback(() => {
    addElement(createSlideImageElement(vw, vh));
    addHistorySnapshot();
  }, [addElement, addHistorySnapshot, vw, vh]);

  const insertVideo = useCallback(() => {
    addElement(createSlideVideoElement(vw, vh));
    addHistorySnapshot();
  }, [addElement, addHistorySnapshot, vw, vh]);

  const insertTable = useCallback(() => {
    addElement(createSlideTableElement(vw, vh));
    addHistorySnapshot();
  }, [addElement, addHistorySnapshot, vw, vh]);

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    undo().catch(() => {});
  }, [canUndo, undo]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    redo().catch(() => {});
  }, [canRedo, redo]);

  if (!isEditing) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <div
        data-testid="slide-edit-insert-toolbar"
        className={cn(
          'shrink-0 flex w-full items-center justify-center px-3 py-2 min-h-[4.25rem]',
          'bg-gradient-to-b from-white to-gray-50/90 dark:from-gray-900 dark:to-gray-950/90',
          'border-b border-gray-200/90 dark:border-gray-800',
          'shadow-[0_1px_0_rgba(0,0,0,0.04)]',
        )}
      >
        <div
          className={cn(
            'flex flex-row items-stretch justify-center rounded-2xl px-1.5 py-1',
            'bg-gray-100/80 dark:bg-gray-800/50',
            'ring-1 ring-inset ring-gray-200/80 dark:ring-gray-700/80',
          )}
        >
          <div className="flex items-stretch justify-center gap-0.5 sm:gap-1">
            <HistoryBtn
              icon={<Undo2 strokeWidth={1.75} />}
              label={t('editMode.insertToolbar.undo')}
              disabled={!canUndo}
              onClick={handleUndo}
            />
            <HistoryBtn
              icon={<Redo2 strokeWidth={1.75} />}
              label={t('editMode.insertToolbar.redo')}
              disabled={!canRedo}
              onClick={handleRedo}
            />
            <Separator
              orientation="vertical"
              className="mx-0.5 h-auto min-h-[40px] self-center bg-gray-300/80 dark:bg-gray-600/80"
            />
            <InsertBtn icon={<Type />} label={t('editMode.insertToolbar.text')} onClick={insertText} />
            <InsertBtn
              icon={<ImageIcon />}
              label={t('editMode.insertToolbar.image')}
              onClick={insertImage}
            />
            <InsertBtn
              icon={<Video />}
              label={t('editMode.insertToolbar.video')}
              onClick={insertVideo}
            />
            <InsertBtn
              icon={<Table2 />}
              label={t('editMode.insertToolbar.table')}
              onClick={insertTable}
            />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
