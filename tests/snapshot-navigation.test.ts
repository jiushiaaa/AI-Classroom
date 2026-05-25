import { describe, expect, it } from 'vitest';
import {
  getChangedSceneIndices,
  resolveSceneIndexForHistoryStep,
} from '@/lib/utils/snapshot-navigation';
import type { Scene } from '@/lib/types/stage';

function slideScene(id: string, order: number, label: string): Scene {
  return {
    id,
    stageId: 'stage-1',
    type: 'slide',
    title: `Slide ${label}`,
    order,
    content: {
      type: 'slide',
      canvas: {
        id: `canvas-${id}`,
        elements: [{ id: `el-${label}`, type: 'text', left: 0, top: 0, width: 10, height: 10 } as never],
      } as never,
    },
  };
}

describe('snapshot navigation', () => {
  const slideA = slideScene('a', 0, 'A');
  const slideB = slideScene('b', 1, 'B');
  const slideAEdited = slideScene('a', 0, 'A-edited');
  const slideBEdited = slideScene('b', 1, 'B-edited');

  it('detects which scenes changed between snapshots', () => {
    expect(getChangedSceneIndices([slideA, slideB], [slideAEdited, slideB])).toEqual([0]);
    expect(getChangedSceneIndices([slideAEdited, slideBEdited], [slideAEdited, slideB])).toEqual([
      1,
    ]);
  });

  it('stays on the current slide when undoing that slide only', () => {
    const index = resolveSceneIndexForHistoryStep({
      fromSlides: [slideAEdited, slideBEdited],
      toSlides: [slideAEdited, slideB],
      currentSceneId: 'b',
      fallbackIndex: 0,
    });
    expect(index).toBe(1);
  });

  it('jumps to the other slide when undo crosses slide boundaries', () => {
    const index = resolveSceneIndexForHistoryStep({
      fromSlides: [slideAEdited, slideB],
      toSlides: [slideA, slideB],
      currentSceneId: 'b',
      fallbackIndex: 0,
    });
    expect(index).toBe(0);
  });

  it('jumps forward on redo when the redone edit belongs to another slide', () => {
    const index = resolveSceneIndexForHistoryStep({
      fromSlides: [slideAEdited, slideB],
      toSlides: [slideAEdited, slideBEdited],
      currentSceneId: 'a',
      fallbackIndex: 1,
    });
    expect(index).toBe(1);
  });
});
