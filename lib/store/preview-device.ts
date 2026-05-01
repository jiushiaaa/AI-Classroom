/**
 * Preview Device Store
 *
 * Tracks which device the publisher is currently previewing in the AI classroom
 * editor. Persisted to localStorage so the choice survives a refresh.
 *
 * 'web'    — original desktop layout (default)
 * 'mobile' — 16:9 landscape phone shell + simplified mobile preview layout
 * 'tablet' — 4:3 iPad shell + condensed tablet preview layout
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PreviewDevice = 'web' | 'mobile' | 'tablet';

interface PreviewDeviceState {
  previewDevice: PreviewDevice;
  setPreviewDevice: (device: PreviewDevice) => void;
}

export const usePreviewDeviceStore = create<PreviewDeviceState>()(
  persist(
    (set) => ({
      previewDevice: 'web',
      setPreviewDevice: (device) => set({ previewDevice: device }),
    }),
    {
      name: 'classroom-preview-device',
      version: 1,
    },
  ),
);
