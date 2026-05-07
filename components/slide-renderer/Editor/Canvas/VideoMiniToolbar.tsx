'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  ChevronDown,
  Clapperboard,
  Layers,
} from 'lucide-react';
import { useCanvasStore } from '@/lib/store/canvas';
import { useSceneSelector } from '@/lib/contexts/scene-context';
import { useCanvasOperations } from '@/lib/hooks/use-canvas-operations';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';
import { ElementTypes, type PPTElement, type PPTVideoElement } from '@/lib/types/slides';
import { ElementOrderCommands } from '@/lib/types/edit';
import type { SlideContent } from '@/lib/types/stage';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useVideoElementActions } from './hooks/useVideoElementActions';

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

/**
 * Floating mini toolbar for video: replace from disk and layer order.
 */
export function VideoMiniToolbar() {
  const { t } = useI18n();
  const activeElementIdList = useCanvasStore.use.activeElementIdList();
  const canvasScale = useCanvasStore.use.canvasScale();
  const isScaling = useCanvasStore.use.isScaling();

  const { orderElement } = useCanvasOperations();

  const elements = useSceneSelector<SlideContent, PPTElement[]>(
    (content) => content?.canvas?.elements ?? [],
  );

  const target = useMemo<PPTVideoElement | undefined>(() => {
    if (activeElementIdList.length !== 1) return undefined;
    const el = elements.find((e) => e.id === activeElementIdList[0]);
    if (!el || el.type !== ElementTypes.VIDEO) return undefined;
    return el as PPTVideoElement;
  }, [activeElementIdList, elements]);

  const visible = !!target && !target.lock;

  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 });
  const barRef = useRef<HTMLDivElement>(null);

  const recompute = useCallback(() => {
    if (!visible || !target) return;
    const wrapper = document.getElementById(`editable-element-${target.id}`);
    if (!wrapper) return;
    const sized =
      (wrapper.querySelector('.editable-element-video') as HTMLElement | null) ?? wrapper;
    const rect = sized.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const barWidth = barRef.current?.offsetWidth ?? 260;
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
  }, [visible, target]);

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
    if (target) {
      const wrapper = document.getElementById(`editable-element-${target.id}`);
      const sized =
        (wrapper?.querySelector('.editable-element-video') as HTMLElement | null) ?? wrapper;
      if (sized) {
        if (typeof ResizeObserver !== 'undefined') {
          ro = new ResizeObserver(() => recompute());
          ro.observe(sized);
        }
        mo = new MutationObserver(() => recompute());
        mo.observe(sized, { attributes: true, attributeFilter: ['style', 'class'] });
      }
    }

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
  }, [visible, target, canvasScale, isScaling, recompute]);

  const placeholderVideo = useMemo<PPTVideoElement>(
    () => ({
      type: 'video',
      id: '__noop__',
      left: 0,
      top: 0,
      width: 0,
      height: 0,
      rotate: 0,
      src: '',
      autoplay: false,
    }),
    [],
  );

  const { replaceVideoInputRef, triggerVideoReplace, handleReplaceVideoFile } =
    useVideoElementActions(target ?? placeholderVideo);

  if (typeof window === 'undefined') return null;
  if (!visible || !target) return null;

  const node = (
    <div
      ref={barRef}
      data-testid="video-mini-toolbar"
      role="toolbar"
      aria-label={t('editMode.miniToolbar.videoToolbarAriaLabel')}
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
      <input
        ref={replaceVideoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleReplaceVideoFile}
      />

      <MiniIconBtn tooltip={t('editMode.miniToolbar.replaceVideo')} onClick={triggerVideoReplace}>
        <Clapperboard />
      </MiniIconBtn>

      <Separator orientation="vertical" className="h-5 mx-0.5" />

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
          <DropdownMenuItem onClick={() => orderElement(target, ElementOrderCommands.TOP)}>
            <ArrowUpToLine />
            {t('editMode.miniToolbar.layerTop')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => orderElement(target, ElementOrderCommands.UP)}>
            <ArrowUp />
            {t('editMode.miniToolbar.layerUp')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => orderElement(target, ElementOrderCommands.DOWN)}>
            <ArrowDown />
            {t('editMode.miniToolbar.layerDown')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => orderElement(target, ElementOrderCommands.BOTTOM)}>
            <ArrowDownToLine />
            {t('editMode.miniToolbar.layerBottom')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return createPortal(node, document.body);
}
