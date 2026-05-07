'use client';

import { useCallback, useRef } from 'react';
import { useCanvasStore } from '@/lib/store/canvas';
import { useCanvasOperations } from '@/lib/hooks/use-canvas-operations';
import { useHistorySnapshot } from '@/lib/hooks/use-history-snapshot';
import { ElementOrderCommands } from '@/lib/types/edit';
import {
  type PPTElement,
  type PPTImageElement,
  type ImageElementFilters,
} from '@/lib/types/slides';

/**
 * Shared image-element actions used by both the right-click context menu
 * (EditableElement) and the floating ImageMiniToolbar. Centralising avoids
 * the two surfaces drifting (e.g. one supports replace + snapshot, the other
 * doesn't).
 *
 * Notes:
 * - Image opacity is stored as `filters.opacity` (CSS-style "0%"–"100%"
 *   string) — matches the schema in lib/types/slides.ts and the export
 *   pipeline. We do NOT introduce a top-level `opacity` field for images.
 * - `setOpacityPreview` writes through to scene data without a history
 *   snapshot (used while a slider is dragging); `setOpacity` commits and
 *   adds a snapshot.
 */
export function useImageElementActions(elementInfo: PPTElement) {
  const setClipingImageElementId = useCanvasStore.use.setClipingImageElementId();
  const { updateElement, orderElement, lockElement, copyElement, deleteElement } =
    useCanvasOperations();
  const { addHistorySnapshot } = useHistorySnapshot();

  const replaceImageInputRef = useRef<HTMLInputElement>(null);

  const triggerImageReplace = useCallback(() => {
    replaceImageInputRef.current?.click();
  }, []);

  const handleReplaceImageFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = '';
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        const url = typeof reader.result === 'string' ? reader.result : '';
        if (!url) return;
        updateElement({ id: elementInfo.id, props: { src: url } as Partial<PPTElement> });
        addHistorySnapshot();
      };
      reader.readAsDataURL(f);
    },
    [elementInfo.id, updateElement, addHistorySnapshot],
  );

  const cropImage = useCallback(() => {
    setClipingImageElementId(elementInfo.id);
  }, [setClipingImageElementId, elementInfo.id]);

  const orderTop = useCallback(() => {
    orderElement(elementInfo, ElementOrderCommands.TOP);
  }, [orderElement, elementInfo]);
  const orderUp = useCallback(() => {
    orderElement(elementInfo, ElementOrderCommands.UP);
  }, [orderElement, elementInfo]);
  const orderDown = useCallback(() => {
    orderElement(elementInfo, ElementOrderCommands.DOWN);
  }, [orderElement, elementInfo]);
  const orderBottom = useCallback(() => {
    orderElement(elementInfo, ElementOrderCommands.BOTTOM);
  }, [orderElement, elementInfo]);

  // Image opacity lives in filters.opacity (string "NN%").
  const writeOpacity = useCallback(
    (percentage: number, snapshot: boolean) => {
      const v = Math.max(0, Math.min(100, Math.round(percentage)));
      const current = (elementInfo as PPTImageElement).filters || {};
      const filters: ImageElementFilters = { ...current, opacity: `${v}%` };
      updateElement({
        id: elementInfo.id,
        props: { filters } as Partial<PPTElement>,
      });
      if (snapshot) addHistorySnapshot();
    },
    [elementInfo, updateElement, addHistorySnapshot],
  );

  const setOpacityPreview = useCallback(
    (v: number) => writeOpacity(v, false),
    [writeOpacity],
  );
  const setOpacity = useCallback((v: number) => writeOpacity(v, true), [writeOpacity]);

  const lock = useCallback(() => lockElement(), [lockElement]);

  const duplicate = useCallback(() => {
    copyElement();
    // Paste is handled by useCanvasOperations.pasteElement via ctrl+v;
    // duplicate is best implemented as copy here (mini toolbar exposes only
    // copy, paste lives in the keyboard shortcut + right-click menu).
  }, [copyElement]);

  const deleteEl = useCallback(() => {
    deleteElement(elementInfo.id);
  }, [deleteElement, elementInfo.id]);

  return {
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
    lock,
    duplicate,
    deleteEl,
  };
}
