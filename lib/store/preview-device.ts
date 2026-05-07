/**
 * Preview Device Store
 *
 * Tracks which device + orientation the publisher is currently previewing in
 * the AI classroom editor. Persisted to localStorage so the choice survives
 * a refresh.
 *
 * Device:
 *  - 'web'    — original desktop layout (default)
 *  - 'mobile' — phone preview (16:9 landscape / 9:16 portrait)
 *  - 'tablet' — iPad preview  (4:3  landscape / 3:4  portrait)
 *
 * Orientation (only meaningful for mobile / tablet):
 *  - 'landscape' (default) — wide layout, slide on the left + Q&A on the right
 *  - 'portrait'            — tall layout, slide on top + collapsible Q&A
 *    sheet at the bottom
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PreviewDevice = 'web' | 'mobile' | 'tablet';
export type PreviewOrientation = 'landscape' | 'portrait';

interface PreviewDeviceState {
  previewDevice: PreviewDevice;
  previewOrientation: PreviewOrientation;
  setPreviewDevice: (device: PreviewDevice) => void;
  setPreviewOrientation: (orientation: PreviewOrientation) => void;
  toggleOrientation: () => void;
}

export const usePreviewDeviceStore = create<PreviewDeviceState>()(
  persist(
    (set) => ({
      previewDevice: 'web',
      previewOrientation: 'landscape',
      setPreviewDevice: (device) => set({ previewDevice: device }),
      setPreviewOrientation: (orientation) => set({ previewOrientation: orientation }),
      toggleOrientation: () =>
        set((s) => ({
          previewOrientation: s.previewOrientation === 'landscape' ? 'portrait' : 'landscape',
        })),
    }),
    {
      name: 'classroom-preview-device',
      version: 2,
      // v1 → v2 migration: persisted state only carried `previewDevice`.
      // Preserve it and seed orientation to the new default (landscape).
      migrate: (persistedState, version) => {
        if (version < 2 && persistedState && typeof persistedState === 'object') {
          const prev = persistedState as { previewDevice?: PreviewDevice };
          return {
            previewDevice: prev.previewDevice ?? 'web',
            previewOrientation: 'landscape' as PreviewOrientation,
          };
        }
        return persistedState as PreviewDeviceState;
      },
    },
  ),
);
