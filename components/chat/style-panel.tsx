'use client';

/**
 * StylePanel — slide editor right drawer: text/shape styling; image & video
 * use an AIPPT-style inline layout (size/position, source preview, layers)
 * without opening the geometry modal; other element types still use
 *「更多」+ StyleMoreDialog for size / text extras.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Type,
  PaintBucket,
  AlertCircle,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  MoreHorizontal,
  ImageIcon,
  Copy,
  Scissors,
  ClipboardPaste,
  Crop,
  Layers,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  Ruler,
  Lock,
  Unlock,
  Video,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStageStore, useCanvasStore, useEditModeStore } from '@/lib/store';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useCanvasOperations } from '@/lib/hooks/use-canvas-operations';
import type {
  PPTElement,
  PPTImageElement,
  PPTTextElement,
  PPTShapeElement,
  PPTVideoElement,
  TextAlign,
  ImageElementFilters,
} from '@/lib/types/slides';
import type { SlideContent } from '@/lib/types/stage';
import { ElementOrderCommands } from '@/lib/types/edit';
import { rebuildStyledParagraph, parseFirstParagraphStyle } from '@/lib/utils/html-text-paragraph-style';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';

const FONT_FAMILIES = [
  { value: 'Microsoft Yahei', label: '微软雅黑 Microsoft Yahei' },
  { value: 'SimHei', label: '黑体 SimHei' },
  { value: 'KaiTi', label: '楷体 KaiTi' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Courier New', label: 'Courier New' },
] as const;

const COLOR_PRESETS = [
  '#1e293b',
  '#475569',
  '#0f172a',
  '#7c3aed',
  '#2563eb',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ffffff',
  '#f8fafc',
  'transparent',
];

function isTextElement(el: PPTElement): el is PPTTextElement {
  return el.type === 'text';
}

function isShapeElement(el: PPTElement): el is PPTShapeElement {
  return el.type === 'shape';
}

function isImageElement(el: PPTElement): el is PPTImageElement {
  return el.type === 'image';
}

function isVideoElement(el: PPTElement): el is PPTVideoElement {
  return el.type === 'video';
}

function parseImageOpacityPercent(raw: string | undefined): number {
  if (!raw) return 100;
  const m = String(raw).match(/(\d+(?:\.\d+)?)/);
  if (!m) return 100;
  const n = Number.parseFloat(m[1]);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 100;
}

function guessVideoExt(fileName: string): string | undefined {
  const i = fileName.lastIndexOf('.');
  if (i < 0 || i === fileName.length - 1) return undefined;
  return fileName.slice(i + 1).toLowerCase();
}

function GeoField({
  label,
  value,
  onCommit,
}: {
  readonly label: string;
  readonly value: number;
  readonly onCommit: (n: number) => void;
}) {
  const [s, setS] = useState(() => String(value));
  useEffect(() => {
    setS(String(value));
  }, [value]);
  return (
    <label className="space-y-0.5 block min-w-0">
      {label.trim() === '' ? null : (
        <span className="text-[10px] text-gray-500 dark:text-gray-400">{label}</span>
      )}
      <Input
        className="h-8 text-xs rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
        value={s}
        onChange={(e) => setS(e.target.value)}
        onBlur={() => {
          const v = Number.parseFloat(s);
          if (Number.isFinite(v)) onCommit(v);
          else setS(String(value));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}

export function StylePanel() {
  const { t } = useI18n();
  const isEditing = useEditModeStore.use.isEditing();
  const handleElementId = useCanvasStore.use.handleElementId();
  const setSelectedElementId = useEditModeStore.use.setSelectedElementId();
  const setClipingImageElementId = useCanvasStore.use.setClipingImageElementId();
  const currentSceneId = useStageStore.use.currentSceneId();
  const scenes = useStageStore.use.scenes();
  const updateScene = useStageStore.use.updateScene();
  const { orderElement, copyElement, cutElement, pasteElement, removeElementProps } =
    useCanvasOperations();

  const [moreOpen, setMoreOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  const scene = useMemo(
    () => (currentSceneId ? scenes.find((s) => s.id === currentSceneId) : null),
    [scenes, currentSceneId],
  );

  const slideElements = useMemo(() => {
    if (!scene || scene.content.type !== 'slide') return null;
    return scene.content.canvas.elements;
  }, [scene]);

  const selectedElement = useMemo(() => {
    if (!handleElementId || !slideElements) return null;
    return slideElements.find((el) => el.id === handleElementId) ?? null;
  }, [handleElementId, slideElements]);

  // Sync handleElementId → editMode.selectedElementId. Run as an effect so we
  // don't write store state during render (which would also bypass the rules
  // of hooks). The store call itself is idempotent.
  useEffect(() => {
    if (handleElementId !== useEditModeStore.getState().selectedElementId) {
      setSelectedElementId(handleElementId || null);
    }
  }, [handleElementId, setSelectedElementId]);

  useEffect(() => {
    setMoreOpen(false);
  }, [handleElementId]);

  // Derived values must be computed unconditionally so the hooks below see a
  // stable hook order. They're cheap pure expressions and guarded by null
  // checks where they read from selectedElement.
  const paraStyle =
    selectedElement && isTextElement(selectedElement)
      ? parseFirstParagraphStyle(selectedElement.content)
      : null;

  const patchSelectedElement = useCallback(
    (patch: Partial<PPTElement>) => {
      if (!scene || !slideElements || !selectedElement) return;
      if (scene.content.type !== 'slide') return;
      const nextElements: PPTElement[] = slideElements.map((el) =>
        el.id === selectedElement.id ? ({ ...el, ...patch } as PPTElement) : el,
      );
      const nextContent: SlideContent = {
        ...scene.content,
        canvas: { ...scene.content.canvas, elements: nextElements },
      };
      updateScene(scene.id, { content: nextContent, updatedAt: Date.now() });
    },
    [scene, slideElements, selectedElement, updateScene],
  );

  const applyParagraph = useCallback(
    (partial: {
      textAlign?: TextAlign;
      fontSizePx?: number;
      fontWeight?: 'normal' | 'bold';
      fontStyle?: 'normal' | 'italic';
      textDecoration?: 'none' | 'underline';
    }) => {
      if (!selectedElement || !isTextElement(selectedElement) || !paraStyle) return;
      const next = { ...paraStyle, ...partial };
      patchSelectedElement({
        content: rebuildStyledParagraph(selectedElement.content, {
          textAlign: next.textAlign,
          fontSizePx: next.fontSizePx,
          fontWeight: next.fontWeight,
          fontStyle: next.fontStyle,
          textDecoration: next.textDecoration,
        }),
      } as Partial<PPTTextElement>);
    },
    [paraStyle, patchSelectedElement, selectedElement],
  );

  if (!isEditing) {
    return (
      <div className="min-h-[min(280px,50vh)] flex items-center justify-center p-4">
        <EmptyState
          title={t('editMode.style.notEditingTitle')}
          message={t('editMode.style.notEditingMessage')}
        />
      </div>
    );
  }
  if (!scene || scene.type !== 'slide') {
    return (
      <div className="min-h-[min(280px,50vh)] flex items-center justify-center p-4">
        <EmptyState
          title={t('editMode.style.notASlideTitle')}
          message={t('editMode.style.notASlideMessage')}
        />
      </div>
    );
  }
  if (!selectedElement) {
    return (
      <div className="min-h-[min(280px,50vh)] flex items-center justify-center p-4">
        <EmptyState
          title={t('editMode.style.noSelectionTitle')}
          message={t('editMode.style.noSelectionMessage')}
        />
      </div>
    );
  }

  const fontName = isTextElement(selectedElement)
    ? selectedElement.defaultFontName
    : isShapeElement(selectedElement)
      ? (selectedElement.text?.defaultFontName ?? 'Microsoft Yahei')
      : '';
  const textColor = isTextElement(selectedElement)
    ? selectedElement.defaultColor
    : isShapeElement(selectedElement)
      ? (selectedElement.text?.defaultColor ?? '#1e293b')
      : '#1e293b';
  const fillColor = isTextElement(selectedElement)
    ? (selectedElement.fill ?? 'transparent')
    : isShapeElement(selectedElement)
      ? selectedElement.fill
      : 'transparent';

  const alignBtn = (align: TextAlign, Icon: typeof AlignLeft) => (
    <button
      key={align}
      type="button"
      onClick={() => applyParagraph({ textAlign: align })}
      className={cn(
        'p-2 rounded-lg border transition-colors shrink-0',
        'bg-white dark:bg-gray-900/80',
        paraStyle?.textAlign === align
          ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 shadow-sm'
          : 'border-gray-200/90 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800/80',
      )}
      title={align}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );

  return (
    <div className="p-3 pb-8 space-y-3">
      {selectedElement.type !== 'line' &&
      selectedElement.type !== 'image' &&
      selectedElement.type !== 'video' &&
      selectedElement.type !== 'text' ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 text-[11px] gap-1 rounded-lg border-gray-200 dark:border-gray-700"
            onClick={() => setMoreOpen(true)}
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
            {t('editMode.style.more')}
          </Button>
        </div>
      ) : null}

      {isImageElement(selectedElement) && (
        <>
          <Section icon={<Ruler className="w-3 h-3" />} label={t('editMode.style.sizeAndPosition')}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                {t('editMode.style.lockAspect')}
              </span>
              <button
                type="button"
                title={t('editMode.style.lockAspect')}
                aria-label={t('editMode.style.lockAspect')}
                aria-pressed={selectedElement.fixedRatio ? true : undefined}
                onClick={() =>
                  patchSelectedElement({
                    fixedRatio: !selectedElement.fixedRatio,
                  } as Partial<PPTImageElement>)
                }
                className={cn(
                  'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
                  selectedElement.fixedRatio
                    ? 'border-violet-400 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-300'
                    : 'border-gray-200/90 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800/80',
                )}
              >
                {selectedElement.fixedRatio ? (
                  <Lock className="w-3.5 h-3.5" />
                ) : (
                  <Unlock className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <GeoField
                label={t('editMode.style.posLeft')}
                value={selectedElement.left}
                onCommit={(n) => patchSelectedElement({ left: n } as Partial<PPTImageElement>)}
              />
              <GeoField
                label={t('editMode.style.posTop')}
                value={selectedElement.top}
                onCommit={(n) => patchSelectedElement({ top: n } as Partial<PPTImageElement>)}
              />
              <GeoField
                label={t('editMode.style.posWidth')}
                value={selectedElement.width}
                onCommit={(n) => {
                  if (n > 4) patchSelectedElement({ width: n } as Partial<PPTImageElement>);
                }}
              />
              <GeoField
                label={t('editMode.style.posHeight')}
                value={selectedElement.height}
                onCommit={(n) => {
                  if (n > 4) patchSelectedElement({ height: n } as Partial<PPTImageElement>);
                }}
              />
              <div className="col-span-2">
                <GeoField
                  label={t('editMode.style.posRotate')}
                  value={selectedElement.rotate}
                  onCommit={(n) => {
                    if (Number.isFinite(n)) patchSelectedElement({ rotate: n } as Partial<PPTImageElement>);
                  }}
                />
              </div>
            </div>
          </Section>

          <Section icon={<ImageIcon className="w-3 h-3" />} label={t('editMode.style.imageOpacityPercent')}>
            <div className="flex items-center gap-3">
              <Slider
                min={0}
                max={100}
                step={1}
                value={[parseImageOpacityPercent(selectedElement.filters?.opacity)]}
                onValueChange={(v) => {
                  const pct = v[0] ?? 100;
                  const current = selectedElement.filters || {};
                  const filters: ImageElementFilters = { ...current, opacity: `${pct}%` };
                  patchSelectedElement({ filters } as Partial<PPTImageElement>);
                }}
                className="flex-1"
              />
              <span className="text-xs tabular-nums w-10 text-right text-gray-600 dark:text-gray-300">
                {parseImageOpacityPercent(selectedElement.filters?.opacity)}%
              </span>
            </div>
          </Section>

          <Section icon={<ImageIcon className="w-3 h-3" />} label={t('editMode.style.imageSource')}>
            <div className="rounded-lg border border-gray-200/80 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/50 overflow-hidden flex items-center justify-center min-h-[88px] max-h-36">
              {selectedElement.src ? (
                // eslint-disable-next-line @next/next/no-img-element -- user-provided slide asset URL / data URL
                <img
                  src={selectedElement.src}
                  alt=""
                  className="max-h-36 w-full object-contain"
                  draggable={false}
                />
              ) : (
                <span className="text-[10px] text-gray-400 px-2 py-6">—</span>
              )}
            </div>
            <Input
              className="h-9 text-xs rounded-lg border-gray-200 dark:border-gray-700 mt-2"
              value={selectedElement.src}
              onChange={(e) =>
                patchSelectedElement({ src: e.target.value } as Partial<PPTImageElement>)
              }
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const url = typeof reader.result === 'string' ? reader.result : '';
                  if (url) patchSelectedElement({ src: url } as Partial<PPTImageElement>);
                };
                reader.readAsDataURL(f);
                e.target.value = '';
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2 h-9 text-xs w-full rounded-lg"
              onClick={() => fileInputRef.current?.click()}
            >
              {t('editMode.style.replaceImageFile')}
            </Button>
          </Section>

          <Section icon={<Layers className="w-3 h-3" />} label={t('editMode.style.layers')}>
            <div className="grid grid-cols-2 gap-1.5">
              <MiniToolButton
                icon={ChevronsUp}
                label={t('editMode.style.layerTop')}
                onClick={() => orderElement(selectedElement, ElementOrderCommands.TOP)}
              />
              <MiniToolButton
                icon={ArrowUp}
                label={t('editMode.style.layerUp')}
                onClick={() => orderElement(selectedElement, ElementOrderCommands.UP)}
              />
              <MiniToolButton
                icon={ArrowDown}
                label={t('editMode.style.layerDown')}
                onClick={() => orderElement(selectedElement, ElementOrderCommands.DOWN)}
              />
              <MiniToolButton
                icon={ChevronsDown}
                label={t('editMode.style.layerBottom')}
                onClick={() => orderElement(selectedElement, ElementOrderCommands.BOTTOM)}
              />
            </div>
          </Section>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full h-9 text-xs gap-1.5 rounded-lg border-violet-200/80 text-violet-700 hover:bg-violet-50 dark:border-violet-800/60 dark:text-violet-300 dark:hover:bg-violet-950/40"
            onClick={() => setClipingImageElementId(selectedElement.id)}
          >
            <Crop className="w-3.5 h-3.5" />
            {t('editMode.style.enterCrop')}
          </Button>
        </>
      )}

      {isVideoElement(selectedElement) && (
        <>
          <Section icon={<Ruler className="w-3 h-3" />} label={t('editMode.style.sizeAndPosition')}>
            <div className="grid grid-cols-2 gap-2">
              <GeoField
                label={t('editMode.style.posLeft')}
                value={selectedElement.left}
                onCommit={(n) => patchSelectedElement({ left: n } as Partial<PPTVideoElement>)}
              />
              <GeoField
                label={t('editMode.style.posTop')}
                value={selectedElement.top}
                onCommit={(n) => patchSelectedElement({ top: n } as Partial<PPTVideoElement>)}
              />
              <GeoField
                label={t('editMode.style.posWidth')}
                value={selectedElement.width}
                onCommit={(n) => {
                  if (n > 4) patchSelectedElement({ width: n } as Partial<PPTVideoElement>);
                }}
              />
              <GeoField
                label={t('editMode.style.posHeight')}
                value={selectedElement.height}
                onCommit={(n) => {
                  if (n > 4) patchSelectedElement({ height: n } as Partial<PPTVideoElement>);
                }}
              />
              <div className="col-span-2">
                <GeoField
                  label={t('editMode.style.posRotate')}
                  value={selectedElement.rotate}
                  onCommit={(n) => {
                    if (Number.isFinite(n)) patchSelectedElement({ rotate: n } as Partial<PPTVideoElement>);
                  }}
                />
              </div>
            </div>
          </Section>

          <Section icon={<Video className="w-3 h-3" />} label={t('editMode.style.videoSource')}>
            <div className="rounded-lg border border-gray-200/80 dark:border-gray-700 bg-gray-900/90 overflow-hidden flex items-center justify-center min-h-[88px] max-h-36">
              {selectedElement.poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedElement.poster}
                  alt=""
                  className="max-h-36 w-full object-contain"
                  draggable={false}
                />
              ) : selectedElement.src ? (
                <video
                  className="max-h-36 w-full object-contain"
                  src={selectedElement.src}
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <span className="text-[10px] text-gray-400 px-2 py-6">—</span>
              )}
            </div>
            <Input
              className="h-9 text-xs rounded-lg border-gray-200 dark:border-gray-700 mt-2"
              value={selectedElement.src}
              onChange={(e) =>
                patchSelectedElement({ src: e.target.value } as Partial<PPTVideoElement>)
              }
            />
            <input
              ref={videoFileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const url = typeof reader.result === 'string' ? reader.result : '';
                  if (!url) return;
                  const ext = guessVideoExt(f.name);
                  const props: Partial<PPTVideoElement> = { src: url };
                  if (ext) props.ext = ext;
                  patchSelectedElement(props as Partial<PPTVideoElement>);
                  removeElementProps({ id: selectedElement.id, propName: 'poster' });
                };
                reader.readAsDataURL(f);
                e.target.value = '';
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2 h-9 text-xs w-full rounded-lg"
              onClick={() => videoFileInputRef.current?.click()}
            >
              {t('editMode.style.replaceVideoFile')}
            </Button>
          </Section>

          <Section icon={<Layers className="w-3 h-3" />} label={t('editMode.style.layers')}>
            <div className="grid grid-cols-2 gap-1.5">
              <MiniToolButton
                icon={ChevronsUp}
                label={t('editMode.style.layerTop')}
                onClick={() => orderElement(selectedElement, ElementOrderCommands.TOP)}
              />
              <MiniToolButton
                icon={ArrowUp}
                label={t('editMode.style.layerUp')}
                onClick={() => orderElement(selectedElement, ElementOrderCommands.UP)}
              />
              <MiniToolButton
                icon={ArrowDown}
                label={t('editMode.style.layerDown')}
                onClick={() => orderElement(selectedElement, ElementOrderCommands.DOWN)}
              />
              <MiniToolButton
                icon={ChevronsDown}
                label={t('editMode.style.layerBottom')}
                onClick={() => orderElement(selectedElement, ElementOrderCommands.BOTTOM)}
              />
            </div>
          </Section>
        </>
      )}

      {isTextElement(selectedElement) && paraStyle && (
        <>
          <Section icon={<Type className="w-3 h-3" />} label={t('editMode.style.format')}>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 shrink-0">
                {t('editMode.style.fontSize')}
              </span>
              <Input
                type="number"
                min={8}
                max={120}
                className="h-8 w-16 text-xs rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                value={paraStyle.fontSizePx}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!Number.isFinite(v)) return;
                  applyParagraph({ fontSizePx: Math.min(120, Math.max(8, v)) });
                }}
              />
            </div>
            <div className="flex gap-1.5 mb-2">
              <button
                type="button"
                onClick={() =>
                  applyParagraph({ fontWeight: paraStyle.fontWeight === 'bold' ? 'normal' : 'bold' })
                }
                className={cn(
                  'p-2 rounded-lg border transition-colors bg-white dark:bg-gray-900/80',
                  paraStyle.fontWeight === 'bold'
                    ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/50 shadow-sm'
                    : 'border-gray-200/90 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/80',
                )}
                title="Bold"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  applyParagraph({ fontStyle: paraStyle.fontStyle === 'italic' ? 'normal' : 'italic' })
                }
                className={cn(
                  'p-2 rounded-lg border transition-colors bg-white dark:bg-gray-900/80',
                  paraStyle.fontStyle === 'italic'
                    ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/50 shadow-sm'
                    : 'border-gray-200/90 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/80',
                )}
                title="Italic"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  applyParagraph({
                    textDecoration: paraStyle.textDecoration === 'underline' ? 'none' : 'underline',
                  })
                }
                className={cn(
                  'p-2 rounded-lg border transition-colors bg-white dark:bg-gray-900/80',
                  paraStyle.textDecoration === 'underline'
                    ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/50 shadow-sm'
                    : 'border-gray-200/90 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/80',
                )}
                title="Underline"
              >
                <Underline className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {alignBtn('left', AlignLeft)}
              {alignBtn('center', AlignCenter)}
              {alignBtn('right', AlignRight)}
              {alignBtn('justify', AlignJustify)}
            </div>
          </Section>

          <Section icon={<Ruler className="w-3 h-3" />} label={t('editMode.style.sizeAndPosition')}>
            <div className="grid grid-cols-2 gap-2">
              <GeoField
                label={t('editMode.style.posLeft')}
                value={selectedElement.left}
                onCommit={(n) => patchSelectedElement({ left: n } as Partial<PPTTextElement>)}
              />
              <GeoField
                label={t('editMode.style.posTop')}
                value={selectedElement.top}
                onCommit={(n) => patchSelectedElement({ top: n } as Partial<PPTTextElement>)}
              />
              <GeoField
                label={t('editMode.style.posWidth')}
                value={selectedElement.width}
                onCommit={(n) => {
                  if (n > 4) patchSelectedElement({ width: n } as Partial<PPTTextElement>);
                }}
              />
              <GeoField
                label={t('editMode.style.posHeight')}
                value={selectedElement.height}
                onCommit={(n) => {
                  if (n > 4) patchSelectedElement({ height: n } as Partial<PPTTextElement>);
                }}
              />
              <div className="col-span-2">
                <GeoField
                  label={t('editMode.style.posRotate')}
                  value={selectedElement.rotate}
                  onCommit={(n) => {
                    if (Number.isFinite(n)) patchSelectedElement({ rotate: n } as Partial<PPTTextElement>);
                  }}
                />
              </div>
            </div>
          </Section>

          <Section icon={<Type className="w-3 h-3" />} label={t('editMode.style.textOpacityPercent')}>
            <div className="flex items-center gap-3">
              <Slider
                min={0}
                max={100}
                step={1}
                value={[Math.round((selectedElement.opacity ?? 1) * 100)]}
                onValueChange={(v) => {
                  const pct = v[0] ?? 100;
                  patchSelectedElement({
                    opacity: Math.max(0, Math.min(1, pct / 100)),
                  } as Partial<PPTTextElement>);
                }}
                className="flex-1"
              />
              <span className="text-xs tabular-nums w-10 text-right text-gray-600 dark:text-gray-300">
                {Math.round((selectedElement.opacity ?? 1) * 100)}%
              </span>
            </div>
          </Section>

          <Section icon={<Type className="w-3 h-3" />} label={t('editMode.style.lineHeight')}>
            <GeoField
              label=""
              value={selectedElement.lineHeight ?? 1.5}
              onCommit={(n) => {
                if (Number.isFinite(n) && n > 0.5 && n < 4) {
                  patchSelectedElement({ lineHeight: n } as Partial<PPTTextElement>);
                }
              }}
            />
          </Section>

          <Section icon={<Layers className="w-3 h-3" />} label={t('editMode.style.layers')}>
            <div className="grid grid-cols-2 gap-1.5">
              <MiniToolButton icon={ChevronsUp} label={t('editMode.style.layerTop')} onClick={() => orderElement(selectedElement, ElementOrderCommands.TOP)} />
              <MiniToolButton icon={ArrowUp} label={t('editMode.style.layerUp')} onClick={() => orderElement(selectedElement, ElementOrderCommands.UP)} />
              <MiniToolButton icon={ArrowDown} label={t('editMode.style.layerDown')} onClick={() => orderElement(selectedElement, ElementOrderCommands.DOWN)} />
              <MiniToolButton icon={ChevronsDown} label={t('editMode.style.layerBottom')} onClick={() => orderElement(selectedElement, ElementOrderCommands.BOTTOM)} />
            </div>
          </Section>
          <Section icon={<Copy className="w-3 h-3" />} label={t('editMode.style.clipboard')}>
            <div className="flex gap-1.5">
              <Button type="button" variant="secondary" size="sm" className="h-8 flex-1 text-[10px] gap-0.5 px-1 rounded-lg" onClick={copyElement}>
                <Copy className="w-3 h-3" />
                {t('editMode.style.copy')}
              </Button>
              <Button type="button" variant="secondary" size="sm" className="h-8 flex-1 text-[10px] gap-0.5 px-1 rounded-lg" onClick={cutElement}>
                <Scissors className="w-3 h-3" />
                {t('editMode.style.cut')}
              </Button>
              <Button type="button" variant="secondary" size="sm" className="h-8 flex-1 text-[10px] gap-0.5 px-1 rounded-lg" onClick={pasteElement}>
                <ClipboardPaste className="w-3 h-3" />
                {t('editMode.style.paste')}
              </Button>
            </div>
          </Section>
        </>
      )}

      {(isTextElement(selectedElement) || isShapeElement(selectedElement)) && (
        <Section icon={<Type className="w-3 h-3" />} label={t('editMode.style.font')}>
          <select
            value={fontName}
            onChange={(e) => {
              if (isTextElement(selectedElement)) {
                patchSelectedElement({ defaultFontName: e.target.value } as Partial<PPTTextElement>);
              } else if (isShapeElement(selectedElement)) {
                patchSelectedElement({
                  text: { ...selectedElement.text, defaultFontName: e.target.value },
                } as unknown as Partial<PPTShapeElement>);
              }
            }}
            className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-2 outline-none focus:ring-2 focus:ring-violet-400/40"
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </Section>
      )}

      {(isTextElement(selectedElement) || isShapeElement(selectedElement)) && (
        <Section icon={<Type className="w-3 h-3" />} label={t('editMode.style.textColor')}>
          <ColorSwatchGrid
            value={textColor}
            onChange={(c) => {
              if (isTextElement(selectedElement)) {
                patchSelectedElement({ defaultColor: c } as Partial<PPTTextElement>);
              } else if (isShapeElement(selectedElement)) {
                patchSelectedElement({
                  text: { ...selectedElement.text, defaultColor: c },
                } as unknown as Partial<PPTShapeElement>);
              }
            }}
          />
        </Section>
      )}

      {(isTextElement(selectedElement) || isShapeElement(selectedElement)) && (
        <Section icon={<PaintBucket className="w-3 h-3" />} label={t('editMode.style.fill')}>
          <ColorSwatchGrid
            value={fillColor}
            onChange={(c) => patchSelectedElement({ fill: c } as Partial<PPTElement>)}
            allowTransparent
          />
        </Section>
      )}

      {!isImageElement(selectedElement) &&
      !isVideoElement(selectedElement) &&
      !isTextElement(selectedElement) ? (
        <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 px-2.5 py-2 mt-1">
          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
            {t('editMode.style.subsetHint')}
          </p>
        </div>
      ) : null}

      {!isImageElement(selectedElement) &&
      !isVideoElement(selectedElement) &&
      !isTextElement(selectedElement) ? (
        <StyleMoreDialog
          key={selectedElement.id}
          open={moreOpen}
          onOpenChange={setMoreOpen}
          element={selectedElement}
          patch={patchSelectedElement}
        />
      ) : null}
    </div>
  );
}

function MiniToolButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof ArrowUp;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200/90 dark:border-gray-700 bg-white/90 dark:bg-gray-900/70 py-2 px-1 text-[10px] font-medium text-gray-600 dark:text-gray-300 shadow-sm hover:bg-violet-50/80 dark:hover:bg-violet-950/30 hover:border-violet-200 dark:hover:border-violet-800/60 transition-colors"
    >
      <Icon className="w-3.5 h-3.5 shrink-0 text-gray-500 dark:text-gray-400" />
      <span className="truncate leading-tight">{label}</span>
    </button>
  );
}

type BoxedElement = Exclude<PPTElement, { type: 'line' }>;

function isBoxedElement(el: PPTElement): el is BoxedElement {
  return el.type !== 'line';
}

function StyleMoreDialog({
  open,
  onOpenChange,
  element,
  patch,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  element: PPTElement;
  patch: (p: Partial<PPTElement>) => void;
}) {
  const { t } = useI18n();
  const boxed = isBoxedElement(element) ? element : null;
  const [left, setLeft] = useState(String(element.left));
  const [top, setTop] = useState(String(element.top));
  const [width, setWidth] = useState(String(element.width));
  const [height, setHeight] = useState(String(boxed?.height ?? 0));
  const [rotate, setRotate] = useState(String(boxed?.rotate ?? 0));
  const [opacity, setOpacity] = useState(
    String(isTextElement(element) && element.opacity !== undefined ? element.opacity : 1),
  );
  const [lineHeight, setLineHeight] = useState(
    String(isTextElement(element) && element.lineHeight !== undefined ? element.lineHeight : 1.5),
  );

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing form-field local state to the freshly opened element is the documented pattern for one-way edit dialogs
    setLeft(String(element.left));
    setTop(String(element.top));
    setWidth(String(element.width));
    const b = isBoxedElement(element) ? element : null;
    setHeight(String(b?.height ?? 0));
    setRotate(String(b?.rotate ?? 0));
    setOpacity(String(isTextElement(element) && element.opacity !== undefined ? element.opacity : 1));
    setLineHeight(
      String(isTextElement(element) && element.lineHeight !== undefined ? element.lineHeight : 1.5),
    );
  }, [open, element]);

  const apply = () => {
    if (!isBoxedElement(element)) {
      onOpenChange(false);
      return;
    }
    const L = parseFloat(left);
    const T = parseFloat(top);
    const W = parseFloat(width);
    const H = parseFloat(height);
    const R = parseFloat(rotate);
    const O = parseFloat(opacity);
    const LH = parseFloat(lineHeight);
    const base: Partial<BoxedElement> = {};
    if (Number.isFinite(L)) base.left = L;
    if (Number.isFinite(T)) base.top = T;
    if (Number.isFinite(W) && W > 4) base.width = W;
    if (Number.isFinite(H) && H > 4) base.height = H;
    if (Number.isFinite(R)) base.rotate = R;
    if (isTextElement(element)) {
      const extra = { ...base } as Partial<PPTTextElement>;
      if (Number.isFinite(O) && O >= 0 && O <= 1) extra.opacity = O;
      if (Number.isFinite(LH) && LH > 0.5 && LH < 4) extra.lineHeight = LH;
      patch(extra as Partial<PPTElement>);
    } else {
      patch(base as Partial<PPTElement>);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('editMode.style.moreDialogTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-0.5">
              <span className="text-gray-500">{t('editMode.style.posLeft')}</span>
              <Input className="h-8" value={left} onChange={(e) => setLeft(e.target.value)} />
            </label>
            <label className="space-y-0.5">
              <span className="text-gray-500">{t('editMode.style.posTop')}</span>
              <Input className="h-8" value={top} onChange={(e) => setTop(e.target.value)} />
            </label>
            <label className="space-y-0.5">
              <span className="text-gray-500">{t('editMode.style.posWidth')}</span>
              <Input className="h-8" value={width} onChange={(e) => setWidth(e.target.value)} />
            </label>
            <label className="space-y-0.5">
              <span className="text-gray-500">{t('editMode.style.posHeight')}</span>
              <Input className="h-8" value={height} onChange={(e) => setHeight(e.target.value)} />
            </label>
            <label className="space-y-0.5 col-span-2">
              <span className="text-gray-500">{t('editMode.style.posRotate')}</span>
              <Input className="h-8" value={rotate} onChange={(e) => setRotate(e.target.value)} />
            </label>
          </div>
          {isTextElement(element) && (
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
              <label className="space-y-0.5">
                <span className="text-gray-500">{t('editMode.style.opacity')}</span>
                <Input className="h-8" value={opacity} onChange={(e) => setOpacity(e.target.value)} />
              </label>
              <label className="space-y-0.5">
                <span className="text-gray-500">{t('editMode.style.lineHeight')}</span>
                <Input className="h-8" value={lineHeight} onChange={(e) => setLineHeight(e.target.value)} />
              </label>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" size="sm" onClick={apply}>
            {t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({ title, message }: { readonly title: string; readonly message: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-4 max-w-[260px] mx-auto">
      <span className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-gray-800/80 text-gray-400 dark:text-gray-500 flex items-center justify-center mb-3 ring-1 ring-gray-200/80 dark:ring-gray-700/80">
        <AlertCircle className="w-5 h-5" />
      </span>
      <div className="text-[13px] font-semibold text-gray-700 dark:text-gray-200">{title}</div>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
        {message}
      </p>
    </div>
  );
}

function Section({
  icon,
  label,
  children,
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200/85 dark:border-gray-800 bg-white/90 dark:bg-gray-900/55 p-2.5 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-50 dark:bg-gray-800/90 text-violet-600 dark:text-violet-400 ring-1 ring-gray-200/70 dark:ring-gray-700/80 [&_svg]:size-3.5">
          {icon}
        </span>
        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 tracking-tight truncate">
          {label}
        </span>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function ColorSwatchGrid({
  value,
  onChange,
  allowTransparent,
}: {
  readonly value: string;
  readonly onChange: (color: string) => void;
  readonly allowTransparent?: boolean;
}) {
  const swatches = allowTransparent
    ? COLOR_PRESETS
    : COLOR_PRESETS.filter((c) => c !== 'transparent');
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {swatches.map((c) => {
        const isActive = value === c;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={c}
            className={cn(
              'w-7 h-7 rounded-lg ring-1 transition-all shadow-sm',
              isActive
                ? 'ring-2 ring-violet-500 dark:ring-violet-400 scale-[1.02]'
                : 'ring-gray-200/90 dark:ring-gray-700 hover:ring-violet-300/80 dark:hover:ring-gray-500',
              c === 'transparent' && 'bg-[conic-gradient(from_45deg,#fff,#eee)]',
            )}
            style={c === 'transparent' ? undefined : { backgroundColor: c }}
          />
        );
      })}
    </div>
  );
}
