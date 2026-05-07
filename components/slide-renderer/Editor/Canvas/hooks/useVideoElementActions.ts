'use client';

import { useCallback, useRef } from 'react';
import { useCanvasOperations } from '@/lib/hooks/use-canvas-operations';
import { useHistorySnapshot } from '@/lib/hooks/use-history-snapshot';
import { type PPTElement, type PPTVideoElement } from '@/lib/types/slides';

function guessVideoExt(fileName: string): string | undefined {
  const i = fileName.lastIndexOf('.');
  if (i < 0 || i === fileName.length - 1) return undefined;
  return fileName.slice(i + 1).toLowerCase();
}

/**
 * Replace-video flow for the floating VideoMiniToolbar (mirrors
 * useImageElementActions file → data URL → updateElement + history).
 */
export function useVideoElementActions(elementInfo: PPTElement) {
  const { updateElement, removeElementProps } = useCanvasOperations();
  const { addHistorySnapshot } = useHistorySnapshot();

  const replaceVideoInputRef = useRef<HTMLInputElement>(null);

  const triggerVideoReplace = useCallback(() => {
    replaceVideoInputRef.current?.click();
  }, []);

  const handleReplaceVideoFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = '';
      if (!f || elementInfo.id === '__noop__') return;
      const reader = new FileReader();
      reader.onload = () => {
        const url = typeof reader.result === 'string' ? reader.result : '';
        if (!url) return;
        const ext = guessVideoExt(f.name);
        const props: Partial<PPTVideoElement> = { src: url };
        if (ext) props.ext = ext;
        updateElement({ id: elementInfo.id, props: props as Partial<PPTElement> });
        removeElementProps({ id: elementInfo.id, propName: 'poster' });
        addHistorySnapshot();
      };
      reader.readAsDataURL(f);
    },
    [elementInfo.id, updateElement, removeElementProps, addHistorySnapshot],
  );

  return {
    replaceVideoInputRef,
    triggerVideoReplace,
    handleReplaceVideoFile,
  };
}
