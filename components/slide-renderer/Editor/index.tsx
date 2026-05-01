'use client';

import Canvas from './Canvas';
import type { StageMode } from '@/lib/types/stage';
import { ScreenCanvas } from './ScreenCanvas';

/**
 * Slide Editor — wraps the PPTist Canvas (full editable) and ScreenCanvas
 * (read-only playback) in a single shell.
 *
 * - `mode='autonomous'` → full Canvas (legacy behaviour)
 * - `mode='playback'` → ScreenCanvas
 * - `forceEditing=true` → always full Canvas, regardless of `mode`. P3 uses
 *   this to let the publisher WYSIWYG-edit a slide while the global
 *   `useStageStore.mode` stays in `'playback'` (so the engine state &
 *   playback position are preserved across edit/exit cycles).
 */
export function SlideEditor({
  mode,
  forceEditing,
}: {
  readonly mode: StageMode;
  readonly forceEditing?: boolean;
}) {
  const showFullCanvas = forceEditing || mode === 'autonomous';
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden">{showFullCanvas ? <Canvas /> : <ScreenCanvas />}</div>
    </div>
  );
}
