'use client';

import { useCallback, useMemo } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Eraser,
  Highlighter,
  ImageIcon,
  Italic,
  Strikethrough,
  Subscript,
  Superscript,
  Table2,
  Type,
  Underline,
} from 'lucide-react';
import { useEditModeStore } from '@/lib/store/edit-mode';
import { useCanvasStore } from '@/lib/store/canvas';
import { useSceneSelector } from '@/lib/contexts/scene-context';
import { useCanvasOperations } from '@/lib/hooks/use-canvas-operations';
import { useHistorySnapshot } from '@/lib/hooks/use-history-snapshot';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';
import {
  createSlideImageElement,
  createSlideTableElement,
  createSlideTextElement,
} from '@/lib/utils/slide-element-factories';
import emitter, { EmitterEvents } from '@/lib/utils/emitter';
import {
  ElementTypes,
  type PPTElement,
  type PPTTextElement,
} from '@/lib/types/slides';
import type { SlideContent } from '@/lib/types/stage';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  HIGHLIGHT_COLOR_SWATCHES,
  TEXT_COLOR_SWATCHES,
  TEXT_SHADOW_PRESETS,
  parseFontSizePx,
} from './toolbar/toolbar-constants';

interface IconBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  readonly tooltip: string;
  readonly active?: boolean;
  readonly disabled?: boolean;
}

function IconBtn({ tooltip, active, disabled, className, children, ...rest }: IconBtnProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-pressed={active ? true : undefined}
          aria-label={tooltip}
          title={tooltip}
          disabled={disabled}
          onMouseDown={(e) => {
            e.preventDefault();
          }}
          className={cn(
            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
            'text-gray-700 dark:text-gray-300 transition-colors',
            'hover:bg-gray-100 dark:hover:bg-gray-800',
            active &&
              'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40',
            disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent',
            className,
          )}
          {...rest}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

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
        'inline-flex flex-col items-center justify-center gap-0.5 px-2 h-11 min-w-[44px] rounded-md',
        'text-[11px] font-medium text-gray-600 dark:text-gray-300',
        'hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors',
      )}
    >
      <span className="flex items-center justify-center h-5 [&_svg]:size-4">{icon}</span>
      {label}
    </button>
  );
}

interface RibbonGroupProps {
  readonly label: string;
  readonly children: React.ReactNode;
  readonly className?: string;
}

/**
 * One PowerPoint-style ribbon group: a row of controls on top, with a
 * subdued group label centred underneath (e.g. "插入 / 字体 / 段落 / 高级").
 * Vertical separators between groups are rendered by the parent.
 */
function RibbonGroup({ label, children, className }: RibbonGroupProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-between h-full py-1 px-1 min-w-0',
        className,
      )}
    >
      <div className="flex items-center gap-0.5 h-9">{children}</div>
      <div className="text-[10px] leading-none text-gray-400 dark:text-gray-500 select-none mt-0.5">
        {label}
      </div>
    </div>
  );
}

interface ColorSwatchPopoverProps {
  readonly tooltip: string;
  readonly icon: React.ReactNode;
  readonly currentColor?: string;
  readonly swatches: readonly string[];
  readonly onPick: (color: string) => void;
  readonly onClear?: () => void;
  readonly disabled?: boolean;
  readonly underlineColor?: string;
}

function ColorSwatchPopover({
  tooltip,
  icon,
  currentColor,
  swatches,
  onPick,
  onClear,
  disabled,
  underlineColor,
}: ColorSwatchPopoverProps) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={tooltip}
              title={tooltip}
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              className={cn(
                'group relative inline-flex h-8 items-center gap-0.5 rounded-md px-1.5',
                'text-gray-700 dark:text-gray-300 transition-colors',
                'hover:bg-gray-100 dark:hover:bg-gray-800',
                disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent',
              )}
            >
              <span className="relative flex flex-col items-center [&_svg]:size-4">
                {icon}
                <span
                  aria-hidden
                  className="mt-0.5 h-[3px] w-4 rounded-sm"
                  style={{ backgroundColor: underlineColor || currentColor || 'transparent' }}
                />
              </span>
              <ChevronDown className="size-3 text-gray-400" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{tooltip}</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-auto p-2"
        onMouseDown={(e) => e.preventDefault()}
      >
        <div className="grid grid-cols-8 gap-1">
          {swatches.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              aria-label={c}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick(c)}
              className={cn(
                'h-5 w-5 rounded-sm ring-1 ring-black/10 hover:ring-2 hover:ring-violet-400 transition',
                currentColor?.toLowerCase() === c.toLowerCase() && 'ring-2 ring-violet-500',
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        {onClear && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClear}
            className="mt-2 w-full rounded-sm px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            清除
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * WPS / AIPPT-style ribbon shown above the slide canvas while in edit mode.
 * Drives all rich text formatting via the RICH_TEXT_COMMAND emitter so the
 * ProseMirror editor remains the single source of truth for marks/selections.
 */
export function SlideEditInsertToolbar() {
  const { t } = useI18n();
  const isEditing = useEditModeStore.use.isEditing();
  const viewportSize = useCanvasStore.use.viewportSize();
  const viewportRatio = useCanvasStore.use.viewportRatio();
  const handleElementId = useCanvasStore.use.handleElementId();
  const richTextAttrs = useCanvasStore.use.richTextAttrs();

  const elements = useSceneSelector<SlideContent, PPTElement[]>(
    (content) => content?.canvas?.elements ?? [],
  );
  const activeText = useMemo<PPTTextElement | undefined>(() => {
    const el = elements.find((e) => e.id === handleElementId);
    return el && el.type === ElementTypes.TEXT ? (el as PPTTextElement) : undefined;
  }, [elements, handleElementId]);

  const { addElement, updateElement } = useCanvasOperations();
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

  const insertTable = useCallback(() => {
    addElement(createSlideTableElement(vw, vh));
    addHistorySnapshot();
  }, [addElement, addHistorySnapshot, vw, vh]);

  const formatEnabled = !!activeText && !activeText.lock;

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

  const currentFontSize = parseFontSizePx(richTextAttrs.fontsize);
  const currentFont = richTextAttrs.fontname;
  const currentColor = richTextAttrs.color || '#111827';
  const currentBack = richTextAttrs.backcolor;

  const setShadowPreset = useCallback(
    (preset: { h: number; v: number; blur: number; color: string } | null) => {
      if (!activeText) return;
      updateElement({
        id: activeText.id,
        // Setting shadow=undefined on a key would be a noop, so use null cast:
        props: { shadow: preset ?? undefined } as Partial<PPTTextElement>,
      });
      addHistorySnapshot();
    },
    [activeText, updateElement, addHistorySnapshot],
  );

  if (!isEditing) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <div
        data-testid="slide-edit-insert-toolbar"
        className={cn(
          'shrink-0 flex items-stretch gap-0 px-2 h-16',
          'bg-white dark:bg-gray-900',
          'border-b border-gray-200 dark:border-gray-800',
          'shadow-[0_1px_0_rgba(0,0,0,0.04)]',
          'overflow-x-auto whitespace-nowrap',
        )}
      >
        {/* Group: Insert */}
        <RibbonGroup label={t('editMode.insertToolbar.groupInsert')}>
          <InsertBtn
            icon={<Type />}
            label={t('editMode.insertToolbar.text')}
            onClick={insertText}
          />
          <InsertBtn
            icon={<ImageIcon />}
            label={t('editMode.insertToolbar.image')}
            onClick={insertImage}
          />
          <InsertBtn
            icon={<Table2 />}
            label={t('editMode.insertToolbar.table')}
            onClick={insertTable}
          />
        </RibbonGroup>

        <Separator orientation="vertical" className="h-10 self-center" />

        {/* Group: Font (family / size / B I U S / color / highlight) */}
        <RibbonGroup label={t('editMode.insertToolbar.groupFont')}>
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!formatEnabled}
                    onMouseDown={(e) => e.preventDefault()}
                    className="h-8 min-w-[120px] justify-between gap-1 px-2 text-xs font-normal"
                  >
                    <span
                      className="truncate"
                      style={{ fontFamily: currentFont || undefined }}
                    >
                      {currentFont ||
                        activeText?.defaultFontName ||
                        t('editMode.insertToolbar.font')}
                    </span>
                    <ChevronDown className="size-3 text-gray-400" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t('editMode.insertToolbar.font')}</TooltipContent>
            </Tooltip>
            <PopoverContent
              align="start"
              sideOffset={6}
              className="w-56 p-1"
              onMouseDown={(e) => e.preventDefault()}
            >
              <ul className="max-h-64 overflow-y-auto">
                {FONT_OPTIONS.map((f) => (
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

          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!formatEnabled}
                    onMouseDown={(e) => e.preventDefault()}
                    className="h-8 w-[60px] justify-between gap-1 px-2 text-xs font-normal"
                  >
                    {currentFontSize ?? '—'}
                    <ChevronDown className="size-3 text-gray-400" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t('editMode.insertToolbar.fontSize')}</TooltipContent>
            </Tooltip>
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

          <IconBtn
            tooltip={t('editMode.insertToolbar.bold')}
            disabled={!formatEnabled}
            active={!!richTextAttrs.bold}
            onClick={() => emitCmd('bold')}
          >
            <Bold />
          </IconBtn>
          <IconBtn
            tooltip={t('editMode.insertToolbar.italic')}
            disabled={!formatEnabled}
            active={!!richTextAttrs.em}
            onClick={() => emitCmd('em')}
          >
            <Italic />
          </IconBtn>
          <IconBtn
            tooltip={t('editMode.insertToolbar.underline')}
            disabled={!formatEnabled}
            active={!!richTextAttrs.underline}
            onClick={() => emitCmd('underline')}
          >
            <Underline />
          </IconBtn>
          <IconBtn
            tooltip={t('editMode.insertToolbar.strikethrough')}
            disabled={!formatEnabled}
            active={!!richTextAttrs.strikethrough}
            onClick={() => emitCmd('strikethrough')}
          >
            <Strikethrough />
          </IconBtn>

          <ColorSwatchPopover
            tooltip={t('editMode.insertToolbar.textColor')}
            icon={<Type />}
            currentColor={currentColor}
            swatches={TEXT_COLOR_SWATCHES}
            onPick={(c) => emitCmd('color', c)}
            disabled={!formatEnabled}
            underlineColor={currentColor}
          />
          <ColorSwatchPopover
            tooltip={t('editMode.insertToolbar.highlight')}
            icon={<Highlighter />}
            currentColor={currentBack || undefined}
            swatches={HIGHLIGHT_COLOR_SWATCHES}
            onPick={(c) => emitCmd('backcolor', c)}
            onClear={() => emitCmd('backcolor', 'transparent')}
            disabled={!formatEnabled}
            underlineColor={currentBack || undefined}
          />
        </RibbonGroup>

        <Separator orientation="vertical" className="h-10 self-center" />

        {/* Group: Paragraph alignment */}
        <RibbonGroup label={t('editMode.insertToolbar.groupParagraph')}>
          <IconBtn
            tooltip={t('editMode.insertToolbar.alignLeft')}
            disabled={!formatEnabled}
            active={richTextAttrs.align === 'left'}
            onClick={() => emitCmd('align', 'left')}
          >
            <AlignLeft />
          </IconBtn>
          <IconBtn
            tooltip={t('editMode.insertToolbar.alignCenter')}
            disabled={!formatEnabled}
            active={richTextAttrs.align === 'center'}
            onClick={() => emitCmd('align', 'center')}
          >
            <AlignCenter />
          </IconBtn>
          <IconBtn
            tooltip={t('editMode.insertToolbar.alignRight')}
            disabled={!formatEnabled}
            active={richTextAttrs.align === 'right'}
            onClick={() => emitCmd('align', 'right')}
          >
            <AlignRight />
          </IconBtn>
          <IconBtn
            tooltip={t('editMode.insertToolbar.alignJustify')}
            disabled={!formatEnabled}
            active={(richTextAttrs.align as string) === 'justify'}
            onClick={() => emitCmd('align', 'justify')}
          >
            <AlignJustify />
          </IconBtn>
        </RibbonGroup>

        <Separator orientation="vertical" className="h-10 self-center" />

        {/* Group: Advanced */}
        <RibbonGroup label={t('editMode.insertToolbar.groupAdvanced')}>
          <IconBtn
            tooltip={t('editMode.insertToolbar.superscript')}
            disabled={!formatEnabled}
            active={!!richTextAttrs.superscript}
            onClick={() => emitCmd('superscript')}
          >
            <Superscript />
          </IconBtn>
          <IconBtn
            tooltip={t('editMode.insertToolbar.subscript')}
            disabled={!formatEnabled}
            active={!!richTextAttrs.subscript}
            onClick={() => emitCmd('subscript')}
          >
            <Subscript />
          </IconBtn>
          <IconBtn
            tooltip={t('editMode.insertToolbar.clearFormat')}
            disabled={!formatEnabled}
            onClick={() => emitCmd('clear')}
          >
            <Eraser />
          </IconBtn>

          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={t('editMode.insertToolbar.textShadow')}
                    title={t('editMode.insertToolbar.textShadow')}
                    disabled={!formatEnabled}
                    onMouseDown={(e) => e.preventDefault()}
                    className={cn(
                      'inline-flex h-8 items-center gap-0.5 rounded-md px-1.5',
                      'text-gray-700 dark:text-gray-300 transition-colors',
                      'hover:bg-gray-100 dark:hover:bg-gray-800',
                      activeText?.shadow &&
                        'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
                      !formatEnabled && 'opacity-40 cursor-not-allowed hover:bg-transparent',
                    )}
                  >
                    <span className="text-[13px] font-semibold leading-none">
                      A
                      <span
                        className="ml-px"
                        style={{
                          textShadow: '1px 1px 2px rgba(0,0,0,0.45)',
                        }}
                      >
                        a
                      </span>
                    </span>
                    <ChevronDown className="size-3 text-gray-400" />
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t('editMode.insertToolbar.textShadow')}
              </TooltipContent>
            </Tooltip>
            <PopoverContent
              align="start"
              sideOffset={6}
              className="w-44 p-1"
              onMouseDown={(e) => e.preventDefault()}
            >
              <ul>
                {TEXT_SHADOW_PRESETS.map((p) => (
                  <li key={p.label}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setShadowPreset(p.value)}
                      className={cn(
                        'w-full text-left px-2 py-1.5 text-sm rounded-sm',
                        'hover:bg-gray-100 dark:hover:bg-gray-800',
                      )}
                    >
                      <span
                        style={{
                          textShadow: p.value
                            ? `${p.value.h}px ${p.value.v}px ${p.value.blur}px ${p.value.color}`
                            : undefined,
                        }}
                      >
                        {p.label}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        </RibbonGroup>
      </div>
    </TooltipProvider>
  );
}
