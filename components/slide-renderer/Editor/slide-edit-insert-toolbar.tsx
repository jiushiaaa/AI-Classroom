'use client';

import { useCallback, useRef } from 'react';
import {
  ImageIcon,
  LayoutTemplate,
  Maximize2,
  Minimize2,
  Redo2,
  Table2,
  Type,
  Undo2,
  Video,
} from 'lucide-react';
import { useEditModeStore } from '@/lib/store/edit-mode';
import { useCanvasStore } from '@/lib/store/canvas';
import { useSnapshotStore, useStageStore } from '@/lib/store';
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
import { readFileAsReferenceBackgroundDataUrl } from '@/lib/utils/reference-background-image';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import type { SlideBackgroundImageSize } from '@/lib/types/slides';

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
 * Insert tools (text / image / …), optional cover–end slide canvas background,
 * then undo/redo — single floating strip above the slide canvas in edit mode.
 */
export function SlideEditInsertToolbar() {
  const { t } = useI18n();
  const isEditing = useEditModeStore.use.isEditing();
  const viewportSize = useCanvasStore.use.viewportSize();
  const viewportRatio = useCanvasStore.use.viewportRatio();
  const scenes = useStageStore.use.scenes();
  const currentSceneId = useStageStore.use.currentSceneId();

  const snapshotCursor = useSnapshotStore((s) => s.snapshotCursor);
  const snapshotLength = useSnapshotStore((s) => s.snapshotLength);
  const undo = useSnapshotStore((s) => s.undo);
  const redo = useSnapshotStore((s) => s.redo);
  const canUndo = snapshotCursor > 0;
  const canRedo = snapshotCursor < snapshotLength - 1;

  const { addElement, updateBackground } = useCanvasOperations();
  const { addHistorySnapshot } = useHistorySnapshot();
  const bgFileRef = useRef<HTMLInputElement>(null);

  const vw = viewportSize || 1000;
  const vh = vw * (viewportRatio || 0.5625);

  const idx = scenes.findIndex((s) => s.id === currentSceneId);
  const current = scenes.find((s) => s.id === currentSceneId);
  const last = scenes.length > 0 ? scenes.length - 1 : 0;
  const showMasterBg =
    isEditing &&
    !!current &&
    current.type === 'slide' &&
    current.content.type === 'slide' &&
    scenes.length > 0 &&
    (idx === 0 || idx === last);

  const bg = showMasterBg && current?.content.type === 'slide' ? current.content.canvas.background : undefined;
  const imageSize: SlideBackgroundImageSize =
    bg?.type === 'image' && bg.image?.size === 'contain' ? 'contain' : 'cover';
  const bgIsImage = bg?.type === 'image' && !!bg.image?.src;

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

  const pickBackgroundFile = useCallback(() => {
    bgFileRef.current?.click();
  }, []);

  const onBackgroundFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      const res = await readFileAsReferenceBackgroundDataUrl(file);
      if (!res.ok) {
        toast.error(res.error === 'size' ? t('home.referenceBg.tooLarge') : t('home.referenceBg.badType'));
        return;
      }
      updateBackground({
        type: 'image',
        image: { src: res.dataUrl, size: imageSize === 'contain' ? 'contain' : 'cover' },
      });
      addHistorySnapshot();
    },
    [addHistorySnapshot, imageSize, t, updateBackground],
  );

  const setBackgroundFit = useCallback(
    (size: SlideBackgroundImageSize) => {
      if (bg?.type !== 'image' || !bg.image?.src) return;
      updateBackground({ type: 'image', image: { ...bg.image, size } });
      addHistorySnapshot();
    },
    [addHistorySnapshot, bg, updateBackground],
  );

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
        <input
          ref={bgFileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(ev) => void onBackgroundFile(ev)}
        />
        <div
          className={cn(
            'flex flex-row items-stretch justify-center rounded-2xl px-1.5 py-1',
            'bg-gray-100/80 dark:bg-gray-800/50',
            'ring-1 ring-inset ring-gray-200/80 dark:ring-gray-700/80',
          )}
        >
          <div className="flex items-stretch justify-center gap-0.5 sm:gap-1 flex-wrap sm:flex-nowrap">
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

            {showMasterBg ? (
              <>
                <Separator
                  orientation="vertical"
                  className="mx-0.5 h-auto min-h-[40px] self-center bg-gray-300/80 dark:bg-gray-600/80"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <InsertBtn
                        icon={<LayoutTemplate />}
                        label={t('editMode.insertToolbar.slideBg')}
                        onClick={pickBackgroundFile}
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[280px] text-xs">
                    {t('editMode.slideCanvasBg.pageBgTooltip')}
                  </TooltipContent>
                </Tooltip>
                {bgIsImage ? (
                  <>
                    <HistoryBtn
                      icon={<Maximize2 strokeWidth={1.75} />}
                      label={t('editMode.slideCanvasBg.fitCover')}
                      disabled={false}
                      onClick={() => setBackgroundFit('cover')}
                    />
                    <HistoryBtn
                      icon={<Minimize2 strokeWidth={1.75} />}
                      label={t('editMode.slideCanvasBg.fitContain')}
                      disabled={false}
                      onClick={() => setBackgroundFit('contain')}
                    />
                  </>
                ) : null}
              </>
            ) : null}

            <Separator
              orientation="vertical"
              className="mx-0.5 h-auto min-h-[40px] self-center bg-gray-300/80 dark:bg-gray-600/80"
            />
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
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
