/**
 * Edit-Mode Store
 *
 * Cross-cutting flag for the "is the publisher in edit mode" question. Used
 * by:
 *   - SceneRenderer (slide path → switch to PPTist Canvas)
 *   - CanvasToolbar (toggle button + paused-banner UI in P6)
 *   - QuizEditor (contentEditable for question / options)
 *   - StylePanel in ChatArea (only enabled when isEditing && something is
 *     selected on the PPTist canvas)
 *   - stage.tsx (auto-pause the playback engine the moment editing kicks in)
 *
 * NOTE: We deliberately keep this *separate* from `useStageStore.mode`. The
 * `mode` flag drives the run-time engine flow ('autonomous' vs 'playback');
 * we don't want a quick edit/exit cycle to perturb that. Edit mode is a UI
 * overlay on top of whatever mode the engine happens to be in.
 *
 * Not persisted — re-entering the editor should always start in non-edit
 * mode.
 */

import { create } from 'zustand';
import { createSelectors } from '@/lib/utils/create-selectors';

interface EditModeState {
  /** Global "publisher is editing" toggle. */
  isEditing: boolean;
  /**
   * Currently focused element id on the PPTist canvas (slide editing). Only
   * meaningful when `isEditing === true`. Used to enable the Style tab in
   * ChatArea and to highlight the right element.
   */
  selectedElementId: string | null;

  setEditing: (next: boolean) => void;
  setSelectedElementId: (id: string | null) => void;
  /** Convenience: clear edit state (used on scene change / unmount). */
  reset: () => void;
}

const useEditModeStoreBase = create<EditModeState>()((set) => ({
  isEditing: false,
  selectedElementId: null,

  setEditing: (next) =>
    set((state) => {
      // Leaving edit mode invalidates any selection.
      if (!next && state.selectedElementId) {
        return { isEditing: false, selectedElementId: null };
      }
      return { isEditing: next };
    }),

  setSelectedElementId: (id) => set({ selectedElementId: id }),

  reset: () => set({ isEditing: false, selectedElementId: null }),
}));

export const useEditModeStore = createSelectors(useEditModeStoreBase);
