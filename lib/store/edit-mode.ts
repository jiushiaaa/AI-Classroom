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
   * meaningful when `isEditing === true`. Used to drive the right-side
   * style drawer (see `stylePanelOpen`) and to highlight the right element.
   */
  selectedElementId: string | null;
  /**
   * Right-side "样式 / Format" drawer state. The drawer slides out from the
   * right edge of the slide canvas (NOT inside ChatArea) and renders the
   * existing StylePanel for the currently selected element. It's only
   * meaningful when `isEditing === true` and a slide element is selected;
   * users open it by clicking "更多" inside any element mini toolbar.
   */
  stylePanelOpen: boolean;

  setEditing: (next: boolean) => void;
  setSelectedElementId: (id: string | null) => void;
  setStylePanelOpen: (next: boolean) => void;
  /** Convenience: clear edit state (used on preview switches / unmount). */
  reset: () => void;
}

const useEditModeStoreBase = create<EditModeState>()((set) => ({
  isEditing: false,
  selectedElementId: null,
  stylePanelOpen: false,

  setEditing: (next) =>
    set((state) => {
      // Leaving edit mode invalidates any selection and closes the drawer.
      if (!next && (state.selectedElementId || state.stylePanelOpen)) {
        return { isEditing: false, selectedElementId: null, stylePanelOpen: false };
      }
      return { isEditing: next };
    }),

  setSelectedElementId: (id) => set({ selectedElementId: id }),
  setStylePanelOpen: (next) => set({ stylePanelOpen: next }),

  reset: () => set({ isEditing: false, selectedElementId: null, stylePanelOpen: false }),
}));

export const useEditModeStore = createSelectors(useEditModeStoreBase);
