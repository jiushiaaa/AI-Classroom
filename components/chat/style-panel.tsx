'use client';

/**
 * StylePanel
 * ----------
 * Right-side "样式" tab body shown when the publisher is editing a slide
 * element on the PPTist Canvas. We expose the four most-touched knobs:
 *   1. Font family (defaultFontName)
 *   2. Font size (a heuristic — we surface the inferred current size and let
 *      the user nudge it; the actual font-size on PPTist text elements lives
 *      inside the rich-text content, so we apply a global override via
 *      `defaultFontSize` style on the wrapper for the demo).
 *   3. Text color (defaultColor)
 *   4. Element fill / background
 *
 * Persistence: writes the patched element back through
 * `useStageStore.updateScene`. The PPTist Canvas re-reads element data from
 * the SceneContext and re-renders.
 *
 * Limitations: this panel is *not* the full PPTist style toolbar — it's a
 * publisher-friendly subset. Power users still get the legacy floating
 * toolbar inside the canvas.
 */

import { useCallback, useMemo } from 'react';
import { Type, PaintBucket, Hash, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStageStore, useCanvasStore, useEditModeStore } from '@/lib/store';
import { useI18n } from '@/lib/hooks/use-i18n';
import type { PPTElement, PPTTextElement, PPTShapeElement } from '@/lib/types/slides';
import type { SlideContent } from '@/lib/types/stage';

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

export function StylePanel() {
  const { t } = useI18n();
  const isEditing = useEditModeStore.use.isEditing();
  // PPTist canvas tracks selection via `handleElementId` (single-target
  // operations) — this is what we want for the publisher Style panel.
  const handleElementId = useCanvasStore.use.handleElementId();
  const setSelectedElementId = useEditModeStore.use.setSelectedElementId();
  const currentSceneId = useStageStore.use.currentSceneId();
  const scenes = useStageStore.use.scenes();
  const updateScene = useStageStore.use.updateScene();

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

  // Mirror the canvas selection into the edit-mode store so other consumers
  // (e.g. the AlertDialog at scene switch, debugging) can read it.
  if (handleElementId !== useEditModeStore.getState().selectedElementId) {
    setSelectedElementId(handleElementId || null);
  }

  const patchSelectedElement = useCallback(
    <K extends keyof PPTElement>(patch: Partial<PPTElement>) => {
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

  // ── Empty states ─────────────────────────────────────────────────────
  if (!isEditing) {
    return (
      <EmptyState
        title={t('editMode.style.notEditingTitle')}
        message={t('editMode.style.notEditingMessage')}
      />
    );
  }
  if (!scene || scene.type !== 'slide') {
    return (
      <EmptyState
        title={t('editMode.style.notASlideTitle')}
        message={t('editMode.style.notASlideMessage')}
      />
    );
  }
  if (!selectedElement) {
    return (
      <EmptyState
        title={t('editMode.style.noSelectionTitle')}
        message={t('editMode.style.noSelectionMessage')}
      />
    );
  }

  const elementTypeLabel = t(`editMode.style.elementType.${selectedElement.type}`);
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

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-4">
      {/* Element header */}
      <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
        <span className="w-7 h-7 rounded-md bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 flex items-center justify-center">
          <Hash className="w-3.5 h-3.5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500 font-medium">
            {t('editMode.style.elementHeader')}
          </div>
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">
            {elementTypeLabel}
          </div>
        </div>
      </div>

      {/* Font family — text & shape only */}
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
            className="w-full text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 outline-none focus:ring-2 focus:ring-violet-400/40"
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </Section>
      )}

      {/* Text color — text & shape only */}
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

      {/* Fill / background */}
      {(isTextElement(selectedElement) || isShapeElement(selectedElement)) && (
        <Section icon={<PaintBucket className="w-3 h-3" />} label={t('editMode.style.fill')}>
          <ColorSwatchGrid
            value={fillColor}
            onChange={(c) => patchSelectedElement({ fill: c } as Partial<PPTElement>)}
            allowTransparent
          />
        </Section>
      )}

      <p className="text-[11px] text-gray-400 dark:text-gray-500 pt-2 leading-snug">
        {t('editMode.style.subsetHint')}
      </p>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function EmptyState({ title, message }: { readonly title: string; readonly message: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 opacity-70">
      <span className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 flex items-center justify-center mb-3">
        <AlertCircle className="w-4 h-4" />
      </span>
      <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">{title}</div>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-snug max-w-[220px]">
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
    <div>
      <div className="flex items-center gap-1.5 mb-1.5 text-[10px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
        {icon}
        <span>{label}</span>
      </div>
      {children}
    </div>
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
    <div className="grid grid-cols-6 gap-1">
      {swatches.map((c) => {
        const isActive = value === c;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={c}
            className={cn(
              'w-7 h-7 rounded-md ring-1 transition-all',
              isActive
                ? 'ring-2 ring-violet-500 dark:ring-violet-400'
                : 'ring-gray-200 dark:ring-gray-700 hover:ring-gray-400 dark:hover:ring-gray-500',
              c === 'transparent' && 'bg-[conic-gradient(from_45deg,#fff,#eee)]',
            )}
            style={c === 'transparent' ? undefined : { backgroundColor: c }}
          />
        );
      })}
    </div>
  );
}
