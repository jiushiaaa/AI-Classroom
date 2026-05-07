import { create } from 'zustand';
import type { Stage, Scene, StageMode } from '@/lib/types/stage';
import { createSelectors } from '@/lib/utils/create-selectors';
import type { ChatSession } from '@/lib/types/chat';
import type { SceneOutline } from '@/lib/types/generation';
import { createLogger } from '@/lib/logger';
import { ensureSlideHasSpeechAction } from '@/lib/utils/ensure-slide-speech';

const log = createLogger('StageStore');

/** Virtual scene ID used when the user navigates to a page still being generated */
export const PENDING_SCENE_ID = '__pending__';

// ==================== Debounce Helper ====================

/**
 * Debounce function to limit how often a function is called
 * @param func Function to debounce
 * @param delay Delay in milliseconds
 */
function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, delay);
  };
}

type ToolbarState = 'design' | 'ai';

interface StageState {
  // Stage info
  stage: Stage | null;

  // Scenes
  scenes: Scene[];
  currentSceneId: string | null;

  // Chats
  chats: ChatSession[];

  // Mode
  mode: StageMode;

  // UI state
  toolbarState: ToolbarState;

  /**
   * In-memory scene clipboard for the right-click "复制 / 粘贴幻灯片" flow.
   * Holds at most one Scene. Cleared on stage switch. Not persisted — paste
   * is intentionally session-local so it doesn't survive a hard reload.
   */
  sceneClipboard: Scene | null;

  // Transient generation state (not persisted)
  generatingOutlines: SceneOutline[];

  // Persisted outlines for resume-on-refresh
  outlines: SceneOutline[];

  // Transient generation tracking (not persisted)
  generationEpoch: number;
  generationStatus: 'idle' | 'generating' | 'paused' | 'completed' | 'error';
  currentGeneratingOrder: number;
  failedOutlines: SceneOutline[];

  // Actions
  setStage: (stage: Stage) => void;
  setScenes: (scenes: Scene[]) => void;
  addScene: (scene: Scene) => void;
  /**
   * Insert a scene at a specific index in the list. All scenes from `index`
   * onward shift down by one and `order` is renormalised so the array stays a
   * 0..N gap-free sequence. Used by the sidebar's "insert between two slides"
   * affordance and the AI-generate flow when called with a target position.
   */
  insertSceneAt: (scene: Scene, index: number) => void;
  updateScene: (sceneId: string, updates: Partial<Scene>) => void;
  deleteScene: (sceneId: string) => void;
  /**
   * Deep-clone a scene and insert it immediately after the source. The new
   * scene gets a fresh id, a copy-suffixed title, and all subsequent scenes
   * get their `order` field shifted by 1 to preserve gap-free ordering.
   */
  duplicateScene: (sceneId: string) => void;
  /**
   * Reorder a scene one slot up or down by swapping `order` with its
   * neighbour. No-op when the scene is already at the boundary.
   */
  moveScene: (sceneId: string, direction: 'up' | 'down') => void;
  /**
   * Move the scene currently at `fromIndex` to `toIndex` (drop position
   * interpreted as "insert before scene at toIndex"; pass `scenes.length` to
   * append). Renormalises `order` after the move. No-op when the operation
   * would not change the list.
   */
  reorderScenes: (fromIndex: number, toIndex: number) => void;
  /** Set or clear the scene clipboard (used by the right-click menu). */
  setSceneClipboard: (scene: Scene | null) => void;
  setCurrentSceneId: (sceneId: string | null) => void;
  setChats: (chats: ChatSession[]) => void;
  setMode: (mode: StageMode) => void;
  setToolbarState: (state: ToolbarState) => void;
  setGeneratingOutlines: (outlines: SceneOutline[]) => void;
  setOutlines: (outlines: SceneOutline[]) => void;
  setGenerationStatus: (status: 'idle' | 'generating' | 'paused' | 'completed' | 'error') => void;
  setCurrentGeneratingOrder: (order: number) => void;
  bumpGenerationEpoch: () => void;
  addFailedOutline: (outline: SceneOutline) => void;
  clearFailedOutlines: () => void;
  retryFailedOutline: (outlineId: string) => void;

  // Getters
  getCurrentScene: () => Scene | null;
  getSceneById: (sceneId: string) => Scene | null;
  getSceneIndex: (sceneId: string) => number;

  // Storage
  saveToStorage: () => Promise<void>;
  loadFromStorage: (stageId: string) => Promise<void>;
  clearStore: () => void;
}

const useStageStoreBase = create<StageState>()((set, get) => ({
  // Initial state
  stage: null,
  scenes: [],
  currentSceneId: null,
  chats: [],
  mode: 'playback',
  toolbarState: 'ai',
  sceneClipboard: null,
  generatingOutlines: [],
  outlines: [],
  generationEpoch: 0,
  generationStatus: 'idle' as const,
  currentGeneratingOrder: -1,
  failedOutlines: [],

  // Actions
  setStage: (stage) => {
    set((s) => ({
      stage,
      scenes: [],
      currentSceneId: null,
      chats: [],
      // Drop the clipboard when switching stages — pasting a scene cloned
      // from a different stage would fail the stageId mismatch check anyway.
      sceneClipboard: null,
      generationEpoch: s.generationEpoch + 1,
    }));
    debouncedSave();
  },

  setScenes: (scenes) => {
    set({ scenes });
    // Auto-select first scene if no current scene
    if (!get().currentSceneId && scenes.length > 0) {
      set({ currentSceneId: scenes[0].id });
    }
    debouncedSave();
  },

  addScene: (scene) => {
    const currentStage = get().stage;
    // Ignore scenes from different stages (prevents race condition during generation)
    if (!currentStage || scene.stageId !== currentStage.id) {
      log.warn(
        `Ignoring scene "${scene.title}" - stageId mismatch (scene: ${scene.stageId}, current: ${currentStage?.id})`,
      );
      return;
    }
    const patched = ensureSlideHasSpeechAction(scene);
    const scenes = [...get().scenes, patched];
    // Remove the matching outline from generatingOutlines (match by order)
    const generatingOutlines = get().generatingOutlines.filter((o) => o.order !== scene.order);
    // Auto-switch from pending page to the newly generated scene
    const shouldSwitch = get().currentSceneId === PENDING_SCENE_ID;
    set({
      scenes,
      generatingOutlines,
      ...(shouldSwitch ? { currentSceneId: scene.id } : {}),
    });
    debouncedSave();
  },

  updateScene: (sceneId, updates) => {
    const scenes = get().scenes.map((scene) =>
      scene.id === sceneId ? { ...scene, ...updates } : scene,
    );
    set({ scenes });
    debouncedSave();
  },

  deleteScene: (sceneId) => {
    const scenes = get().scenes.filter((scene) => scene.id !== sceneId);
    const currentSceneId = get().currentSceneId;

    // If deleted scene was current, select next or previous
    if (currentSceneId === sceneId) {
      const index = get().getSceneIndex(sceneId);
      const newIndex = index < scenes.length ? index : scenes.length - 1;
      set({
        scenes,
        currentSceneId: scenes[newIndex]?.id || null,
      });
    } else {
      set({ scenes });
    }
    debouncedSave();
  },

  duplicateScene: (sceneId) => {
    const allScenes = get().scenes;
    const sourceIndex = allScenes.findIndex((s) => s.id === sceneId);
    if (sourceIndex < 0) return;
    const source = allScenes[sourceIndex];

    // structuredClone preserves nested objects (canvas elements, actions,
    // multiAgent, etc.) without manually walking the tree.
    const cloned = structuredClone(source);
    const now = Date.now();

    // Insert duplicate right after the source, then re-normalise `order`
    // for the whole list so it stays a 0..N sequence.
    const inserted: Scene = ensureSlideHasSpeechAction({
      ...cloned,
      id: `${source.id}-copy-${now}`,
      title: cloned.title,
      createdAt: now,
      updatedAt: now,
    });

    const next = [...allScenes];
    next.splice(sourceIndex + 1, 0, inserted);
    const normalised = next.map((s, i) => ({ ...s, order: i }));

    set({ scenes: normalised, currentSceneId: inserted.id });
    debouncedSave();
  },

  moveScene: (sceneId, direction) => {
    const all = get().scenes;
    const idx = all.findIndex((s) => s.id === sceneId);
    if (idx < 0) return;

    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= all.length) return;

    const next = [...all];
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    const normalised = next.map((s, i) => ({ ...s, order: i }));

    set({ scenes: normalised });
    debouncedSave();
  },

  reorderScenes: (fromIndex, toIndex) => {
    const all = get().scenes;
    if (fromIndex < 0 || fromIndex >= all.length) return;
    // Clamp `toIndex` into [0, all.length] — values past the end mean "append".
    const clampedTo = Math.max(0, Math.min(toIndex, all.length));
    // Account for the shift after removing the dragged item: inserting at an
    // index greater than the source needs −1 so the visual landing slot
    // matches what the publisher saw while dragging.
    const adjustedTo = clampedTo > fromIndex ? clampedTo - 1 : clampedTo;
    if (adjustedTo === fromIndex) return;

    const next = [...all];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(adjustedTo, 0, moved);
    const normalised = next.map((s, i) => ({ ...s, order: i }));

    set({ scenes: normalised });
    debouncedSave();
  },

  setSceneClipboard: (scene) => {
    // Not persisted — see field doc.
    set({ sceneClipboard: scene });
  },

  insertSceneAt: (scene, index) => {
    const currentStage = get().stage;
    if (!currentStage || scene.stageId !== currentStage.id) {
      log.warn(
        `Ignoring scene "${scene.title}" - stageId mismatch (scene: ${scene.stageId}, current: ${currentStage?.id})`,
      );
      return;
    }
    const patched = ensureSlideHasSpeechAction(scene);
    const all = get().scenes;
    const clamped = Math.max(0, Math.min(index, all.length));
    const next = [...all];
    next.splice(clamped, 0, patched);
    const normalised = next.map((s, i) => ({ ...s, order: i }));
    // Pull this insertion off any pending generating outline matched by order
    const generatingOutlines = get().generatingOutlines.filter((o) => o.order !== scene.order);

    set({ scenes: normalised, generatingOutlines });
    debouncedSave();
  },

  setCurrentSceneId: (sceneId) => {
    set({ currentSceneId: sceneId });
    debouncedSave();
  },

  setChats: (chats) => {
    set({ chats });
    debouncedSave();
  },

  setMode: (mode) => set({ mode }),

  setToolbarState: (toolbarState) => set({ toolbarState }),

  setGeneratingOutlines: (generatingOutlines) => set({ generatingOutlines }),

  setOutlines: (outlines) => {
    set({ outlines });
    // Persist outlines to IndexedDB
    const stageId = get().stage?.id;
    if (stageId) {
      import('@/lib/utils/database').then(({ db }) => {
        db.stageOutlines.put({
          stageId,
          outlines,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });
    }
  },

  setGenerationStatus: (generationStatus) => set({ generationStatus }),

  setCurrentGeneratingOrder: (currentGeneratingOrder) => set({ currentGeneratingOrder }),

  bumpGenerationEpoch: () => set((s) => ({ generationEpoch: s.generationEpoch + 1 })),

  addFailedOutline: (outline) => {
    const existed = get().failedOutlines.some((o) => o.id === outline.id);
    if (existed) return;
    set({ failedOutlines: [...get().failedOutlines, outline] });
  },

  clearFailedOutlines: () => set({ failedOutlines: [] }),

  retryFailedOutline: (outlineId) => {
    set({
      failedOutlines: get().failedOutlines.filter((o) => o.id !== outlineId),
    });
  },

  // Getters
  getCurrentScene: () => {
    const { scenes, currentSceneId } = get();
    if (!currentSceneId) return null;
    return scenes.find((s) => s.id === currentSceneId) || null;
  },

  getSceneById: (sceneId) => {
    return get().scenes.find((s) => s.id === sceneId) || null;
  },

  getSceneIndex: (sceneId) => {
    return get().scenes.findIndex((s) => s.id === sceneId);
  },

  // Storage methods
  saveToStorage: async () => {
    const { stage, scenes, currentSceneId, chats } = get();
    if (!stage?.id) {
      log.warn('Cannot save: stage.id is required');
      return;
    }

    try {
      const { saveStageData } = await import('@/lib/utils/stage-storage');
      await saveStageData(stage.id, {
        stage,
        scenes,
        currentSceneId,
        chats,
      });
    } catch (error) {
      log.error('Failed to save to storage:', error);
    }
  },

  loadFromStorage: async (stageId: string) => {
    try {
      // Skip IndexedDB load if the store already has this stage with scenes
      // (e.g. navigated from generation-preview with fresh in-memory data)
      const currentState = get();
      if (currentState.stage?.id === stageId && currentState.scenes.length > 0) {
        log.info('Stage already loaded in memory, skipping IndexedDB load:', stageId);
        return;
      }

      const { loadStageData } = await import('@/lib/utils/stage-storage');
      const data = await loadStageData(stageId);

      // Load outlines for resume-on-refresh
      const { db } = await import('@/lib/utils/database');
      const outlinesRecord = await db.stageOutlines.get(stageId);
      const outlines = outlinesRecord?.outlines || [];

      if (data) {
        set({
          stage: data.stage,
          scenes: data.scenes,
          currentSceneId: data.currentSceneId,
          chats: data.chats,
          outlines,
          // Compute generatingOutlines from persisted outlines minus completed scenes
          generatingOutlines: outlines.filter((o) => !data.scenes.some((s) => s.order === o.order)),
        });
        log.info('Loaded from storage:', stageId);
      } else {
        log.warn('No data found for stage:', stageId);
      }
    } catch (error) {
      log.error('Failed to load from storage:', error);
      throw error;
    }
  },

  clearStore: () => {
    set((s) => ({
      stage: null,
      scenes: [],
      currentSceneId: null,
      chats: [],
      outlines: [],
      generationEpoch: s.generationEpoch + 1,
      generationStatus: 'idle' as const,
      currentGeneratingOrder: -1,
      failedOutlines: [],
      generatingOutlines: [],
    }));
    log.info('Store cleared');
  },
}));

export const useStageStore = createSelectors(useStageStoreBase);

// ==================== Debounced Save ====================

/**
 * Debounced version of saveToStorage to prevent excessive writes
 * Waits 500ms after the last change before saving
 */
const debouncedSave = debounce(() => {
  useStageStore.getState().saveToStorage();
}, 500);
