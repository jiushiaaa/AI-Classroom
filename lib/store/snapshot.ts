import { create } from 'zustand';
import type { IndexableTypeArray } from 'dexie';
import { db, type Snapshot } from '@/lib/utils/database';
import { resolveSceneIndexForHistoryStep } from '@/lib/utils/snapshot-navigation';
import { useStageStore } from './stage';
import type { Scene } from '@/lib/types/stage';

export interface SnapshotState {
  // State
  snapshotCursor: number; // Snapshot pointer
  snapshotLength: number; // Snapshot count

  // Computed
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Actions
  setSnapshotCursor: (cursor: number) => void;
  setSnapshotLength: (length: number) => void;
  initSnapshotDatabase: () => Promise<void>;
  /** Clear IndexedDB snapshots and seed baseline for a new edit session. */
  resetEditSessionSnapshots: () => Promise<void>;
  addSnapshot: () => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

async function loadOrderedSnapshots(): Promise<Snapshot[]> {
  return db.snapshots.orderBy('id').toArray();
}

function applySnapshotToStage(
  snapshot: Snapshot,
  sceneIndex: number,
): void {
  const stageStore = useStageStore.getState();
  const { slides } = snapshot;
  const safeIndex = sceneIndex > slides.length - 1 ? slides.length - 1 : sceneIndex;

  stageStore.setScenes(slides as unknown as Scene[]);
  if (slides[safeIndex]) {
    stageStore.setCurrentSceneId(slides[safeIndex].id);
  }
}

/**
 * Snapshot store for undo/redo functionality
 * Based on PPTist's snapshot store, migrated to Zustand
 *
 * Uses IndexedDB (via Dexie) to store snapshot history
 */
export const useSnapshotStore = create<SnapshotState>((set, get) => ({
  // Initial state
  snapshotCursor: -1,
  snapshotLength: 0,

  // Computed properties
  canUndo: () => get().snapshotCursor > 0,
  canRedo: () => get().snapshotCursor < get().snapshotLength - 1,

  // Actions
  setSnapshotCursor: (cursor: number) => set({ snapshotCursor: cursor }),
  setSnapshotLength: (length: number) => set({ snapshotLength: length }),

  /**
   * Initialize snapshot database with current state
   */
  initSnapshotDatabase: async () => {
    const stageStore = useStageStore.getState();
    const currentSceneId = stageStore.currentSceneId || '';
    const sceneIndex = Math.max(0, stageStore.getSceneIndex(currentSceneId));

    const newFirstSnapshot = {
      index: sceneIndex,
      slides: JSON.parse(JSON.stringify(stageStore.scenes)),
    };
    await db.snapshots.add(newFirstSnapshot);

    set({
      snapshotCursor: 0,
      snapshotLength: 1,
    });
  },

  resetEditSessionSnapshots: async () => {
    await db.snapshots.clear();
    set({ snapshotCursor: -1, snapshotLength: 0 });
    await get().initSnapshotDatabase();
  },

  /**
   * Add a new snapshot to the history
   * Handles snapshot length limit and cursor position
   */
  addSnapshot: async () => {
    if (get().snapshotLength === 0) {
      await get().initSnapshotDatabase();
    }

    const stageStore = useStageStore.getState();
    const { snapshotCursor } = get();

    // Get all snapshot IDs from IndexedDB
    const allKeys = await db.snapshots.orderBy('id').keys();

    let needDeleteKeys: IndexableTypeArray = [];

    // If cursor is not at the end, delete all snapshots after cursor
    // This happens when user undoes multiple times then performs a new action
    if (snapshotCursor >= 0 && snapshotCursor < allKeys.length - 1) {
      needDeleteKeys = allKeys.slice(snapshotCursor + 1);
    }

    // Add new snapshot
    const snapshot = {
      index: stageStore.getSceneIndex(stageStore.currentSceneId || ''),
      slides: JSON.parse(JSON.stringify(stageStore.scenes)),
    };
    await db.snapshots.add(snapshot);

    // Calculate new snapshot length
    let snapshotLength = allKeys.length - needDeleteKeys.length + 1;

    // Enforce snapshot length limit
    const snapshotLengthLimit = 20;
    if (snapshotLength > snapshotLengthLimit) {
      needDeleteKeys.push(allKeys[0]);
      snapshotLength--;
    }

    // Delete obsolete snapshots
    await db.snapshots.bulkDelete(needDeleteKeys as number[]);

    set({
      snapshotCursor: snapshotLength - 1,
      snapshotLength,
    });
  },

  /**
   * Undo: restore previous snapshot
   */
  undo: async () => {
    const { snapshotCursor } = get();
    if (snapshotCursor <= 0) return;

    const stageStore = useStageStore.getState();
    const snapshots = await loadOrderedSnapshots();
    const fromSnapshot = snapshots[snapshotCursor];
    const newSnapshotCursor = snapshotCursor - 1;
    const targetSnapshot = snapshots[newSnapshotCursor];

    const sceneIndex = resolveSceneIndexForHistoryStep({
      fromSlides: fromSnapshot.slides,
      toSlides: targetSnapshot.slides,
      currentSceneId: stageStore.currentSceneId,
      fallbackIndex: targetSnapshot.index,
    });

    applySnapshotToStage(targetSnapshot, sceneIndex);
    set({ snapshotCursor: newSnapshotCursor });
  },

  /**
   * Redo: restore next snapshot
   */
  redo: async () => {
    const { snapshotCursor, snapshotLength } = get();
    if (snapshotCursor >= snapshotLength - 1) return;

    const stageStore = useStageStore.getState();
    const snapshots = await loadOrderedSnapshots();
    const fromSnapshot = snapshots[snapshotCursor];
    const newSnapshotCursor = snapshotCursor + 1;
    const targetSnapshot = snapshots[newSnapshotCursor];

    const sceneIndex = resolveSceneIndexForHistoryStep({
      fromSlides: fromSnapshot.slides,
      toSlides: targetSnapshot.slides,
      currentSceneId: stageStore.currentSceneId,
      fallbackIndex: targetSnapshot.index,
    });

    applySnapshotToStage(targetSnapshot, sceneIndex);
    set({ snapshotCursor: newSnapshotCursor });
  },
}));
