'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Highlighter,
  Italic,
  Strikethrough,
  Type,
  Underline,
} from 'lucide-react';
import { useCanvasStore } from '@/lib/store/canvas';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';
import emitter, { EmitterEvents } from '@/lib/utils/emitter';
import { Button } from '@/components/ui/button';
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
import {
  FONT_SIZE_OPTIONS,
  HIGHLIGHT_COLOR_SWATCHES,
  TEXT_COLOR_SWATCHES,
  parseFontSizePx,
} from '../toolbar/toolbar-constants';
import { getEditorFontOptions } from '@/lib/utils/editor-font-options';

const TOOLBAR_HEIGHT = 40;
const VIEWPORT_PADDING = 8;
const SHOW_DELAY_MS = 30;

interface Position {
  top: number;
  left: number;
  visible: boolean;
}

const HIDDEN: Position = { top: 0, left: 0, visible: false };

interface MiniIconBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  readonly tooltip: string;
  readonly active?: boolean;
  readonly children: React.ReactNode;
}

function MiniIconBtn({ tooltip, active, className, children, ...rest }: MiniIconBtnProps) {
  return (
    <button
      type="button"
      title={tooltip}
      aria-label={tooltip}
      aria-pressed={active ? true : undefined}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
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
 * Floating mini toolbar that appears above a non-empty text selection inside
 * the active ProseMirror editor. All commands route through the
 * RICH_TEXT_COMMAND emitter targeting the active element, so the editor
 * applies marks to the existing selection (no autoSelectAll fallback).
 *
 * Positioning uses fixed/portal so canvas scale and overflow don't clip it.
 */
export function TextSelectionMiniToolbar() {
  const { t } = useI18n();
  const handleElementId = useCanvasStore.use.handleElementId();
  const editingElementId = useCanvasStore.use.editingElementId();
  const richTextAttrs = useCanvasStore.use.richTextAttrs();
  const clipingImageElementId = useCanvasStore.use.clipingImageElementId();
  const [pos, setPos] = useState<Position>(HIDDEN);
  const barRef = useRef<HTMLDivElement>(null);
  const popoverOpenRef = useRef(false);
  const recomputeTimer = useRef<number | null>(null);
  const [fontOptionsTick, setFontOptionsTick] = useState(0);

  useEffect(() => {
    const fn = () => setFontOptionsTick((x) => x + 1);
    window.addEventListener('openmaic-publisher-fonts-changed', fn);
    return () => window.removeEventListener('openmaic-publisher-fonts-changed', fn);
  }, []);

  const fontOptions = useMemo(() => getEditorFontOptions(), [fontOptionsTick]);

  const hide = useCallback(() => setPos(HIDDEN), []);

  const recompute = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!handleElementId) return hide();
    if (clipingImageElementId) return hide();

    // If a popover/dropdown is open we must not recompute on document
    // selectionchange — the selection inside ProseMirror may temporarily
    // collapse while the user clicks a menu item.
    if (popoverOpenRef.current) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return hide();

    const range = sel.getRangeAt(0);
    const editorEl = document.querySelector(
      `#editable-element-${handleElementId} .prosemirror-editor`,
    );
    if (!editorEl) return hide();
    if (!editorEl.contains(range.commonAncestorContainer)) return hide();

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return hide();

    const barWidth = barRef.current?.offsetWidth ?? 480;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = rect.top - TOOLBAR_HEIGHT - 8;
    if (top < VIEWPORT_PADDING) {
      top = rect.bottom + 8;
    }
    if (top + TOOLBAR_HEIGHT > vh - VIEWPORT_PADDING) {
      top = Math.max(VIEWPORT_PADDING, vh - TOOLBAR_HEIGHT - VIEWPORT_PADDING);
    }

    let left = rect.left + rect.width / 2 - barWidth / 2;
    left = Math.max(VIEWPORT_PADDING, Math.min(left, vw - barWidth - VIEWPORT_PADDING));

    setPos({ top, left, visible: true });

    // Keep richTextAttrs in sync for the toolbar's active state.
    emitter.emit(EmitterEvents.SYNC_RICH_TEXT_ATTRS_TO_STORE);
  }, [handleElementId, clipingImageElementId, hide]);

  const scheduleRecompute = useCallback(() => {
    if (recomputeTimer.current) {
      window.clearTimeout(recomputeTimer.current);
    }
    recomputeTimer.current = window.setTimeout(() => {
      recomputeTimer.current = null;
      recompute();
    }, SHOW_DELAY_MS);
  }, [recompute]);

  // Keep the bar in viewport on scroll, mouseup, selectionchange, resize.
  useEffect(() => {
    if (!handleElementId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing visibility with external active element id is intentional
      hide();
      return;
    }

    const onSelectionChange = () => scheduleRecompute();
    const onMouseUp = () => scheduleRecompute();
    const onScroll = () => hide();
    const onResize = () => hide();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };

    document.addEventListener('selectionchange', onSelectionChange);
    document.addEventListener('mouseup', onMouseUp);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      document.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('keydown', onKeyDown);
      if (recomputeTimer.current) {
        window.clearTimeout(recomputeTimer.current);
        recomputeTimer.current = null;
      }
    };
  }, [handleElementId, scheduleRecompute, hide]);

  // Hide whenever the active element changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing internal visibility with external selection state
    hide();
  }, [handleElementId, editingElementId, hide]);

  const emitCmd = useCallback(
    (command: string, value?: string) => {
      if (!handleElementId) return;
      emitter.emit(EmitterEvents.RICH_TEXT_COMMAND, {
        target: handleElementId,
        action: { command, value },
      });
    },
    [handleElementId],
  );

  const onPopoverOpenChange = useCallback(
    (open: boolean) => {
      popoverOpenRef.current = open;
      if (!open) {
        // Restore selection visibility right after a popover closes
        scheduleRecompute();
      }
    },
    [scheduleRecompute],
  );

  if (typeof window === 'undefined') return null;
  if (!pos.visible) return null;

  const currentFontSize = parseFontSizePx(richTextAttrs.fontsize);
  const currentFont = richTextAttrs.fontname;
  const currentColor = richTextAttrs.color || '#111827';
  const currentBack = richTextAttrs.backcolor;

  const node = (
    <div
      ref={barRef}
      data-testid="text-selection-mini-toolbar"
      role="toolbar"
      aria-label={t('editMode.miniToolbar.toolbarAriaLabel')}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 50,
      }}
      onMouseDown={(e) => e.preventDefault()}
      className={cn(
        'flex items-center gap-1 px-1.5 py-1 rounded-xl',
        'bg-white dark:bg-gray-900',
        'shadow-lg ring-1 ring-black/5 dark:ring-white/10',
        'select-none',
      )}
    >
      <Popover onOpenChange={onPopoverOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="h-7 min-w-[100px] justify-between gap-1 px-2 text-xs font-normal"
          >
            <span
              className="truncate"
              style={{ fontFamily: currentFont || undefined }}
            >
              {currentFont || t('editMode.insertToolbar.font')}
            </span>
            <ChevronDown className="size-3 text-gray-400" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-56 p-1"
          onMouseDown={(e) => e.preventDefault()}
        >
          <ul className="max-h-64 overflow-y-auto">
            {fontOptions.map((f) => (
              <li key={f.value}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => emitCmd('fontname', f.value)}
                  className={cn(
                    'w-full text-left px-2 py-1.5 text-sm rounded-sm',
                    'hover:bg-gray-100 dark:hover:bg-gray-800',
                    currentFont === f.value && 'bg-gray-100 dark:bg-gray-800 font-medium',
                  )}
                  style={{ fontFamily: f.value }}
                >
                  {f.label}
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>

      <Popover onOpenChange={onPopoverOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="h-7 w-[52px] justify-between gap-1 px-1.5 text-xs font-normal"
          >
            {currentFontSize ?? '—'}
            <ChevronDown className="size-3 text-gray-400" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-24 p-1"
          onMouseDown={(e) => e.preventDefault()}
        >
          <ul className="max-h-64 overflow-y-auto">
            {FONT_SIZE_OPTIONS.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => emitCmd('fontsize', `${s}px`)}
                  className={cn(
                    'w-full text-left px-2 py-1 text-sm rounded-sm',
                    'hover:bg-gray-100 dark:hover:bg-gray-800',
                    currentFontSize === s && 'bg-gray-100 dark:bg-gray-800 font-medium',
                  )}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>

      <Separator orientation="vertical" className="h-5 mx-0.5" />

      {/* Font color */}
      <Popover onOpenChange={onPopoverOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={t('editMode.insertToolbar.textColor')}
            aria-label={t('editMode.insertToolbar.textColor')}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="inline-flex h-7 items-center gap-0.5 rounded-md px-1 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <span className="relative flex flex-col items-center [&_svg]:size-3.5">
              <Type />
              <span
                aria-hidden
                className="mt-0.5 h-[3px] w-3.5 rounded-sm"
                style={{ backgroundColor: currentColor }}
              />
            </span>
            <ChevronDown className="size-3 text-gray-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-auto p-2"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="grid grid-cols-8 gap-1">
            {TEXT_COLOR_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                aria-label={c}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => emitCmd('color', c)}
                className={cn(
                  'h-5 w-5 rounded-sm ring-1 ring-black/10 hover:ring-2 hover:ring-violet-400 transition',
                  currentColor.toLowerCase() === c.toLowerCase() && 'ring-2 ring-violet-500',
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <MiniIconBtn
        tooltip={t('editMode.insertToolbar.bold')}
        active={!!richTextAttrs.bold}
        onClick={() => emitCmd('bold')}
      >
        <Bold />
      </MiniIconBtn>
      <MiniIconBtn
        tooltip={t('editMode.insertToolbar.italic')}
        active={!!richTextAttrs.em}
        onClick={() => emitCmd('em')}
      >
        <Italic />
      </MiniIconBtn>
      <MiniIconBtn
        tooltip={t('editMode.insertToolbar.underline')}
        active={!!richTextAttrs.underline}
        onClick={() => emitCmd('underline')}
      >
        <Underline />
      </MiniIconBtn>
      <MiniIconBtn
        tooltip={t('editMode.insertToolbar.strikethrough')}
        active={!!richTextAttrs.strikethrough}
        onClick={() => emitCmd('strikethrough')}
      >
        <Strikethrough />
      </MiniIconBtn>

      <Separator orientation="vertical" className="h-5 mx-0.5" />

      {/* Alignment dropdown */}
      <DropdownMenu onOpenChange={onPopoverOpenChange}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title={t('editMode.insertToolbar.alignLeft')}
            aria-label={t('editMode.insertToolbar.alignLeft')}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="inline-flex h-7 items-center gap-0.5 rounded-md px-1 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors [&_svg]:size-3.5"
          >
            {richTextAttrs.align === 'center' && <AlignCenter />}
            {richTextAttrs.align === 'right' && <AlignRight />}
            {(richTextAttrs.align as string) === 'justify' && <AlignJustify />}
            {(!richTextAttrs.align || richTextAttrs.align === 'left') && <AlignLeft />}
            <ChevronDown className="size-3 text-gray-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={6}
          className="min-w-[120px]"
          onMouseDown={(e) => e.preventDefault()}
        >
          <DropdownMenuItem onClick={() => emitCmd('align', 'left')}>
            <AlignLeft />
            {t('editMode.insertToolbar.alignLeft')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => emitCmd('align', 'center')}>
            <AlignCenter />
            {t('editMode.insertToolbar.alignCenter')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => emitCmd('align', 'right')}>
            <AlignRight />
            {t('editMode.insertToolbar.alignRight')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => emitCmd('align', 'justify')}>
            <AlignJustify />
            {t('editMode.insertToolbar.alignJustify')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Highlight */}
      <Popover onOpenChange={onPopoverOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={t('editMode.insertToolbar.highlight')}
            aria-label={t('editMode.insertToolbar.highlight')}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="inline-flex h-7 items-center gap-0.5 rounded-md px-1 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <span className="relative flex flex-col items-center [&_svg]:size-3.5">
              <Highlighter />
              <span
                aria-hidden
                className="mt-0.5 h-[3px] w-3.5 rounded-sm"
                style={{ backgroundColor: currentBack || 'transparent' }}
              />
            </span>
            <ChevronDown className="size-3 text-gray-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-auto p-2"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="grid grid-cols-8 gap-1">
            {HIGHLIGHT_COLOR_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                aria-label={c}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => emitCmd('backcolor', c)}
                className={cn(
                  'h-5 w-5 rounded-sm ring-1 ring-black/10 hover:ring-2 hover:ring-violet-400 transition',
                  currentBack?.toLowerCase() === c.toLowerCase() && 'ring-2 ring-violet-500',
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => emitCmd('backcolor', 'transparent')}
            className="mt-2 w-full rounded-sm px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            清除
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );

  return createPortal(node, document.body);
}
