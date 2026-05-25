import type { Scene } from '@/lib/types/stage';

function stableSceneJson(scene: Scene): string {
  return JSON.stringify(scene);
}

/**
 * Indices of scenes whose serialized state differs between `from` and `to`.
 * Used to decide whether undo/redo should stay on the current slide or jump
 * to the slide whose edits are being stepped through.
 */
export function getChangedSceneIndices(from: Scene[], to: Scene[]): number[] {
  const toById = new Map(to.map((scene, index) => [scene.id, { scene, index }]));
  const changed = new Set<number>();

  from.forEach((scene, index) => {
    const target = toById.get(scene.id);
    if (!target) {
      changed.add(index);
      return;
    }
    if (stableSceneJson(scene) !== stableSceneJson(target.scene)) {
      changed.add(target.index);
    }
  });

  to.forEach((scene, index) => {
    if (!from.some((item) => item.id === scene.id)) {
      changed.add(index);
    }
  });

  return [...changed].sort((a, b) => a - b);
}

function clampSceneIndex(index: number, sceneCount: number): number {
  if (sceneCount <= 0) return 0;
  return Math.max(0, Math.min(index, sceneCount - 1));
}

export interface ResolveSceneIndexForHistoryStepOptions {
  /** Snapshot we are leaving (newer state). */
  fromSlides: Scene[];
  /** Snapshot we are entering (target state after undo/redo). */
  toSlides: Scene[];
  currentSceneId: string | null;
  /** Scene index stored on the target snapshot. */
  fallbackIndex: number;
}

/**
 * Pick which slide to show after undo/redo.
 *
 * - If the step only reverts edits on the slide the user is viewing, keep that slide.
 * - If the step reverts edits on another slide (e.g. B exhausted → undo A), jump there.
 */
export function resolveSceneIndexForHistoryStep({
  fromSlides,
  toSlides,
  currentSceneId,
  fallbackIndex,
}: ResolveSceneIndexForHistoryStepOptions): number {
  const currentIndex = currentSceneId
    ? fromSlides.findIndex((scene) => scene.id === currentSceneId)
    : -1;
  const changed = getChangedSceneIndices(fromSlides, toSlides);
  const safeFallback = clampSceneIndex(fallbackIndex, toSlides.length);

  if (currentIndex >= 0 && changed.includes(currentIndex)) {
    return clampSceneIndex(currentIndex, toSlides.length);
  }

  if (changed.length === 1) {
    return clampSceneIndex(changed[0], toSlides.length);
  }

  if (changed.length > 0) {
    if (changed.includes(safeFallback)) return safeFallback;
    return clampSceneIndex(changed[changed.length - 1], toSlides.length);
  }

  return safeFallback;
}
