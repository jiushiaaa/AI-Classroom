'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  ImageIcon,
  LayoutTemplate,
  Maximize2,
  MessageSquareQuote,
  Minimize2,
  Pilcrow,
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
  SLIDE_TABLE_MAX_COLS,
  SLIDE_TABLE_MAX_ROWS,
  type SlideTextVariant,
  createSlideImageElement,
  createSlideTableElement,
  createSlideTextElement,
  createSlideVideoElement,
} from '@/lib/utils/slide-element-factories';
import { readFileAsReferenceBackgroundDataUrl } from '@/lib/utils/reference-background-image';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import type { SlideBackgroundImageSize } from '@/lib/types/slides';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

interface InsertBtnVisualProps {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly active?: boolean;
}

const insertBtnClass = cn(
  'group inline-flex flex-col items-center justify-center gap-1 px-3 min-h-[52px] min-w-[52px] rounded-xl',
  'text-[11px] font-medium text-gray-600 dark:text-gray-300',
  'transition-all duration-150 ease-out',
  'hover:bg-white dark:hover:bg-gray-800/90',
  'hover:shadow-sm hover:ring-1 hover:ring-violet-200/70 dark:hover:ring-violet-500/25',
  'active:scale-[0.97]',
  '[&_svg]:size-[18px] text-gray-500 group-hover:text-violet-600 dark:text-gray-400 dark:group-hover:text-violet-400',
);

function InsertBtnLabel({ icon, label, active }: InsertBtnVisualProps) {
  return (
    <>
      <span className="flex items-center justify-center">{icon}</span>
      <span
        className={cn(
          'leading-none tracking-tight',
          active && 'text-violet-600 dark:text-violet-400',
        )}
      >
        {label}
      </span>
    </>
  );
}

interface InsertBtnProps extends InsertBtnVisualProps {
  readonly onClick: () => void;
  readonly ariaHasPopup?: 'menu' | 'dialog' | 'listbox' | 'true' | 'grid';
  readonly ariaExpanded?: boolean;
}

function InsertBtn({
  icon,
  label,
  active,
  onClick,
  ariaHasPopup,
  ariaExpanded,
}: InsertBtnProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-haspopup={ariaHasPopup}
      aria-expanded={ariaExpanded}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(insertBtnClass, active && 'bg-white dark:bg-gray-800/90 ring-1 ring-violet-200/70')}
    >
      <InsertBtnLabel icon={icon} label={label} active={active} />
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

interface TextVariantOption {
  readonly variant: SlideTextVariant;
  readonly icon: React.ReactNode;
  readonly previewClass: string;
}

const TEXT_VARIANT_OPTIONS: readonly TextVariantOption[] = [
  { variant: 'content', icon: <Pilcrow strokeWidth={1.75} />, previewClass: 'text-[15px] font-normal' },
  { variant: 'heading1', icon: <Heading1 strokeWidth={1.75} />, previewClass: 'text-[20px] font-semibold' },
  { variant: 'heading2', icon: <Heading2 strokeWidth={1.75} />, previewClass: 'text-[18px] font-semibold' },
  { variant: 'heading3', icon: <Heading3 strokeWidth={1.75} />, previewClass: 'text-[16px] font-semibold' },
  { variant: 'heading4', icon: <Heading4 strokeWidth={1.75} />, previewClass: 'text-[15px] font-semibold' },
  { variant: 'heading5', icon: <Heading5 strokeWidth={1.75} />, previewClass: 'text-[14px] font-semibold' },
  { variant: 'caption', icon: <MessageSquareQuote strokeWidth={1.75} />, previewClass: 'text-[13px] italic text-gray-500' },
];

/** Read the natural aspect ratio (height / width) of an image data URL. */
function readImageAspectRatio(dataUrl: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    if (globalThis.window === undefined) {
      resolve(undefined);
      return;
    }
    const img = new globalThis.Image();
    img.onload = () => {
      const ratio = img.naturalHeight > 0 && img.naturalWidth > 0
        ? img.naturalHeight / img.naturalWidth
        : undefined;
      resolve(ratio);
    };
    img.onerror = () => resolve(undefined);
    img.src = dataUrl;
  });
}

function readFileAsDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      resolve(result);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
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
  const imageFileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);

  const [textMenuOpen, setTextMenuOpen] = useState(false);
  const [tableMenuOpen, setTableMenuOpen] = useState(false);
  const [tableHover, setTableHover] = useState<{ rows: number; cols: number } | null>(null);

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

  const insertText = useCallback(
    (variant: SlideTextVariant) => {
      addElement(createSlideTextElement(vw, vh, variant));
      addHistorySnapshot();
      setTextMenuOpen(false);
    },
    [addElement, addHistorySnapshot, vw, vh],
  );

  const pickImageFile = useCallback(() => {
    imageFileRef.current?.click();
  }, []);

  const onImageFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        toast.error(t('editMode.insertToolbar.imageUpload.invalidType'));
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(t('editMode.insertToolbar.imageUpload.tooLarge'));
        return;
      }
      const dataUrl = await readFileAsDataUrl(file);
      if (!dataUrl) {
        toast.error(t('editMode.insertToolbar.imageUpload.readFailed'));
        return;
      }
      const ratio = await readImageAspectRatio(dataUrl);
      addElement(createSlideImageElement(vw, vh, dataUrl, ratio));
      addHistorySnapshot();
    },
    [addElement, addHistorySnapshot, t, vw, vh],
  );

  const pickVideoFile = useCallback(() => {
    videoFileRef.current?.click();
  }, []);

  const onVideoFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      if (!file.type.startsWith('video/')) {
        toast.error(t('editMode.insertToolbar.videoUpload.invalidType'));
        return;
      }
      if (file.size > MAX_VIDEO_BYTES) {
        toast.error(t('editMode.insertToolbar.videoUpload.tooLarge'));
        return;
      }
      const dataUrl = await readFileAsDataUrl(file);
      if (!dataUrl) {
        toast.error(t('editMode.insertToolbar.videoUpload.readFailed'));
        return;
      }
      addElement(createSlideVideoElement(vw, vh, dataUrl));
      addHistorySnapshot();
    },
    [addElement, addHistorySnapshot, t, vw, vh],
  );

  const insertTable = useCallback(
    (rows: number, cols: number) => {
      addElement(createSlideTableElement(vw, vh, rows, cols));
      addHistorySnapshot();
      setTableMenuOpen(false);
      setTableHover(null);
    },
    [addElement, addHistorySnapshot, vw, vh],
  );

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

  const tableGridCells = useMemo(() => {
    const cells: Array<{ r: number; c: number }> = [];
    for (let r = 1; r <= SLIDE_TABLE_MAX_ROWS; r++) {
      for (let c = 1; c <= SLIDE_TABLE_MAX_COLS; c++) {
        cells.push({ r, c });
      }
    }
    return cells;
  }, []);

  const tableSelectionLabel = tableHover
    ? t('editMode.insertToolbar.tableMenu.selection', {
        rows: tableHover.rows,
        cols: tableHover.cols,
      })
    : t('editMode.insertToolbar.tableMenu.empty');

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
        <input
          ref={imageFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(ev) => void onImageFileChange(ev)}
        />
        <input
          ref={videoFileRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(ev) => void onVideoFileChange(ev)}
        />
        <div
          className={cn(
            'flex flex-row items-stretch justify-center rounded-2xl px-1.5 py-1',
            'bg-gray-100/80 dark:bg-gray-800/50',
            'ring-1 ring-inset ring-gray-200/80 dark:ring-gray-700/80',
          )}
        >
          <div className="flex items-stretch justify-center gap-0.5 sm:gap-1 flex-wrap sm:flex-nowrap">
            <Popover open={textMenuOpen} onOpenChange={setTextMenuOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  title={t('editMode.insertToolbar.text')}
                  aria-label={t('editMode.insertToolbar.text')}
                  aria-haspopup="menu"
                  aria-expanded={textMenuOpen}
                  onMouseDown={(e) => e.preventDefault()}
                  className={cn(
                    insertBtnClass,
                    textMenuOpen && 'bg-white dark:bg-gray-800/90 ring-1 ring-violet-200/70',
                  )}
                >
                  <InsertBtnLabel
                    icon={<Type />}
                    label={t('editMode.insertToolbar.text')}
                    active={textMenuOpen}
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={6}
                className="w-44 p-1.5"
                aria-label={t('editMode.insertToolbar.textMenu.ariaLabel')}
              >
                <div role="menu" className="flex flex-col">
                  {TEXT_VARIANT_OPTIONS.map((opt) => (
                    <button
                      key={opt.variant}
                      role="menuitem"
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertText(opt.variant)}
                      className={cn(
                        'group flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left',
                        'text-gray-700 dark:text-gray-200',
                        'hover:bg-violet-50 dark:hover:bg-violet-500/15',
                        'transition-colors duration-100',
                      )}
                    >
                      <span className="inline-flex w-5 justify-center text-gray-500 group-hover:text-violet-600 dark:text-gray-400 dark:group-hover:text-violet-400 [&_svg]:size-4">
                        {opt.icon}
                      </span>
                      <span className={cn('flex-1 leading-tight', opt.previewClass)}>
                        {t(`editMode.insertToolbar.textMenu.${opt.variant}`)}
                      </span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <InsertBtn
              icon={<ImageIcon />}
              label={t('editMode.insertToolbar.image')}
              onClick={pickImageFile}
            />
            <InsertBtn
              icon={<Video />}
              label={t('editMode.insertToolbar.video')}
              onClick={pickVideoFile}
            />

            <Popover
              open={tableMenuOpen}
              onOpenChange={(open) => {
                setTableMenuOpen(open);
                if (!open) setTableHover(null);
              }}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  title={t('editMode.insertToolbar.table')}
                  aria-label={t('editMode.insertToolbar.table')}
                  aria-haspopup="grid"
                  aria-expanded={tableMenuOpen}
                  onMouseDown={(e) => e.preventDefault()}
                  className={cn(
                    insertBtnClass,
                    tableMenuOpen && 'bg-white dark:bg-gray-800/90 ring-1 ring-violet-200/70',
                  )}
                >
                  <InsertBtnLabel
                    icon={<Table2 />}
                    label={t('editMode.insertToolbar.table')}
                    active={tableMenuOpen}
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={6}
                className="w-auto p-2"
                aria-label={t('editMode.insertToolbar.tableMenu.ariaLabel')}
              >
                <div className="flex flex-col gap-1.5">
                  <div
                    role="grid"
                    tabIndex={-1}
                    aria-label={t('editMode.insertToolbar.tableMenu.ariaLabel')}
                    className="grid gap-[3px] focus:outline-none"
                    style={{
                      gridTemplateColumns: `repeat(${SLIDE_TABLE_MAX_COLS}, 18px)`,
                      gridTemplateRows: `repeat(${SLIDE_TABLE_MAX_ROWS}, 18px)`,
                    }}
                    onMouseLeave={() => setTableHover(null)}
                  >
                    {tableGridCells.map(({ r, c }) => {
                      const active =
                        tableHover != null && r <= tableHover.rows && c <= tableHover.cols;
                      return (
                        <button
                          key={`${r}-${c}`}
                          type="button"
                          role="gridcell"
                          aria-rowindex={r}
                          aria-colindex={c}
                          aria-selected={active}
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => setTableHover({ rows: r, cols: c })}
                          onFocus={() => setTableHover({ rows: r, cols: c })}
                          onClick={() => insertTable(r, c)}
                          className={cn(
                            'h-[18px] w-[18px] rounded-[3px] border transition-colors',
                            active
                              ? 'bg-violet-500/80 border-violet-600 dark:bg-violet-400/80 dark:border-violet-300'
                              : 'bg-gray-100 border-gray-300 dark:bg-gray-700/60 dark:border-gray-600 hover:border-violet-400',
                          )}
                        />
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between gap-2 px-0.5 pt-0.5 text-[11px]">
                    <span className="text-gray-500 dark:text-gray-400">
                      {t('editMode.insertToolbar.tableMenu.hint')}
                    </span>
                    <span
                      className={cn(
                        'font-medium tabular-nums',
                        tableHover ? 'text-violet-600 dark:text-violet-400' : 'text-gray-400 dark:text-gray-500',
                      )}
                    >
                      {tableSelectionLabel}
                    </span>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

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
