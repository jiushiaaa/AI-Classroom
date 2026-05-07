'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  ChevronDown,
  Crop,
  ImagePlus,
  Layers,
} from 'lucide-react';
import { useCanvasStore } from '@/lib/store/canvas';
import { useSceneSelector } from '@/lib/contexts/scene-context';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';
import { ElementTypes, type PPTElement, type PPTImageElement } from '@/lib/types/slides';
import type { SlideContent } from '@/lib/types/stage';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useImageElementActions } from './hooks/useImageElementActions';

const TOOLBAR_HEIGHT = 40;
const VIEWPORT_PADDING = 8;
const SPACE_NEEDED_ABOVE = TOOLBAR_HEIGHT + 12;

interface MiniIconBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  readonly tooltip: string;
  readonly active?: boolean;
}

function MiniIconBtn({ tooltip, active, className, children, ...rest }: MiniIconBtnProps) {
  return (
    <button
      type="button"
      title={tooltip}
      aria-label={tooltip}
      aria-pressed={active ? true : undefined}
      onMouseDown={(e) => e.stopPropagation()}
      className={cn(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
        'text-gray-700 dark:text-gray-300 transition-colors',
        'hover:bg-gray-100 dark:hover:bg-gray-800',
        '[&_svg]:size-3.5',
        active &&
          'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 hover:bg-violet-100',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

function parseOpacityFilter(v: string | undefined): number {
  if (!v) return 100;
  const m = String(v).match(/(\d+(?:\.\d+)?)/);
  if (!m) return 100;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 100;
}

/**
 * Floating mini toolbar for the currently selected image element.
 * Visible only when exactly one image is selected, the image is not being
 * cropped, and not locked. Shares replace/crop/layer/opacity actions
 * with the right-click context menu via useImageElementActions.
 */
export function ImageMiniToolbar() {
  const { t } = useI18n();
  const activeElementIdList = useCanvasStore.use.activeElementIdList();
  const clipingImageElementId = useCanvasStore.use.clipingImageElementId();
  const canvasScale = useCanvasStore.use.canvasScale();
  const isScaling = useCanvasStore.use.isScaling();

  const elements = useSceneSelector<SlideContent, PPTElement[]>(
    (content) => content?.canvas?.elements ?? [],
  );

  const targetImage = useMemo<PPTImageElement | undefined>(() => {
    if (activeElementIdList.length !== 1) return undefined;
    const el = elements.find((e) => e.id === activeElementIdList[0]);
    if (!el || el.type !== ElementTypes.IMAGE) return undefined;
    return el as PPTImageElement;
  }, [activeElementIdList, elements]);

  const visible = !!targetImage && clipingImageElementId !== targetImage.id && !targetImage.lock;

  // Position state
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 });
  const barRef = useRef<HTMLDivElement>(null);

  const recompute = useCallback(() => {
    if (!visible || !targetImage) return;
    const wrapper = document.getElementById(`editable-element-${targetImage.id}`);
    if (!wrapper) return;
    // The outer #editable-element-* wrapper has no intrinsic size; the
    // sized box is .editable-element-image inside ImageElement. That node is
    // NOT a direct child (EditableElement inserts a hidden file input and
    // wraps the element in ContextMenu), so we must use a descendant query —
    // `:scope > .editable-element-image` would always miss and fall back to
    // a 0×0 wrapper rect, hiding the toolbar.
    const sized =
      (wrapper.querySelector('.editable-element-image') as HTMLElement | null) ?? wrapper;
    const rect = sized.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const barWidth = barRef.current?.offsetWidth ?? 320;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top: number;
    if (rect.top - SPACE_NEEDED_ABOVE >= VIEWPORT_PADDING) {
      top = rect.top - SPACE_NEEDED_ABOVE;
    } else {
      top = rect.bottom + 8;
    }
    if (top + TOOLBAR_HEIGHT > vh - VIEWPORT_PADDING) {
      top = Math.max(VIEWPORT_PADDING, vh - TOOLBAR_HEIGHT - VIEWPORT_PADDING);
    }

    let left = rect.left + rect.width / 2 - barWidth / 2;
    left = Math.max(VIEWPORT_PADDING, Math.min(left, vw - barWidth - VIEWPORT_PADDING));

    setCoords({ top, left });
  }, [visible, targetImage]);

  // Recompute on relevant changes / events
  useEffect(() => {
    if (!visible) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- positioning the floating bar requires measuring the DOM after the active element changes
    recompute();

    const onScroll = () => recompute();
    const onResize = () => recompute();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);

    let ro: ResizeObserver | null = null;
    let mo: MutationObserver | null = null;
    if (targetImage) {
      const wrapper = document.getElementById(`editable-element-${targetImage.id}`);
      const sized =
        (wrapper?.querySelector('.editable-element-image') as HTMLElement | null) ?? wrapper;
      if (sized) {
        if (typeof ResizeObserver !== 'undefined') {
          ro = new ResizeObserver(() => recompute());
          ro.observe(sized);
        }
        mo = new MutationObserver(() => recompute());
        mo.observe(sized, { attributes: true, attributeFilter: ['style', 'class'] });
      }
    }

    // animation-frame loop while scaling, since style changes happen during
    // mousemove without firing scroll/resize.
    let raf = 0;
    const tick = () => {
      recompute();
      raf = requestAnimationFrame(tick);
    };
    if (isScaling) raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
      mo?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [visible, targetImage, canvasScale, isScaling, recompute]);

  // Hooks must be called unconditionally — call useImageElementActions even
  // when no image is selected (use a stable placeholder so refs stay valid).
  const placeholderImage = useMemo<PPTImageElement>(
    () => ({
      type: 'image',
      id: '__noop__',
      left: 0,
      top: 0,
      width: 0,
      height: 0,
      rotate: 0,
      fixedRatio: false,
      src: '',
    }),
    [],
  );
  const {
    replaceImageInputRef,
    triggerImageReplace,
    handleReplaceImageFile,
    cropImage,
    orderTop,
    orderUp,
    orderDown,
    orderBottom,
    setOpacity,
    setOpacityPreview,
  } = useImageElementActions(targetImage ?? placeholderImage);

  if (typeof window === 'undefined') return null;
  if (!visible || !targetImage) return null;

  const opacityNow = parseOpacityFilter(targetImage.filters?.opacity);

  const node = (
    <div
      ref={barRef}
      data-testid="image-mini-toolbar"
      role="toolbar"
      aria-label={t('editMode.miniToolbar.imageToolbarAriaLabel')}
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        zIndex: 50,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      className={cn(
        'flex items-center gap-1 px-1.5 py-1 rounded-xl',
        'bg-white dark:bg-gray-900',
        'shadow-lg ring-1 ring-black/5 dark:ring-white/10',
        'select-none',
      )}
    >
      {/* Hidden file input for replacing the image. Keep it inside the bar so
          its lifetime tracks visibility. */}
      <input
        ref={replaceImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleReplaceImageFile}
      />

      <MiniIconBtn tooltip={t('editMode.miniToolbar.crop')} onClick={cropImage}>
        <Crop />
      </MiniIconBtn>
      <MiniIconBtn
        tooltip={t('editMode.miniToolbar.replace')}
        onClick={triggerImageReplace}
      >
        <ImagePlus />
      </MiniIconBtn>

      <Separator orientation="vertical" className="h-5 mx-0.5" />

      {/* Layer dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title={t('editMode.miniToolbar.layers')}
            aria-label={t('editMode.miniToolbar.layers')}
            onMouseDown={(e) => e.stopPropagation()}
            className="inline-flex h-7 items-center gap-0.5 rounded-md px-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors [&_svg]:size-3.5"
          >
            <Layers />
            <ChevronDown className="size-3 text-gray-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={6}
          className="min-w-[160px]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <DropdownMenuItem onClick={orderTop}>
            <ArrowUpToLine />
            {t('editMode.miniToolbar.layerTop')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={orderUp}>
            <ArrowUp />
            {t('editMode.miniToolbar.layerUp')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={orderDown}>
            <ArrowDown />
            {t('editMode.miniToolbar.layerDown')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={orderBottom}>
            <ArrowDownToLine />
            {t('editMode.miniToolbar.layerBottom')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Opacity */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={t('editMode.miniToolbar.opacity')}
            aria-label={t('editMode.miniToolbar.opacity')}
            onMouseDown={(e) => e.stopPropagation()}
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <span className="font-medium">{opacityNow}%</span>
            <ChevronDown className="size-3 text-gray-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-56 p-3"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 shrink-0">
              {t('editMode.miniToolbar.opacity')}
            </span>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[opacityNow]}
              onValueChange={(v) => setOpacityPreview(v[0] ?? 100)}
              onValueCommit={(v) => setOpacity(v[0] ?? 100)}
            />
            <span className="text-xs tabular-nums w-9 text-right">{opacityNow}%</span>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );

  return createPortal(node, document.body);
}
