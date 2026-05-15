'use client';

import { useEffect } from 'react';
import { PUBLISHER_FONT_TEMPLATES_STORAGE_KEY } from '@/lib/constants/publisher-font';
import { loadPublisherFontTemplates } from '@/lib/utils/publisher-font-library-storage';
import { applyPublisherFontFacesStyle } from '@/lib/utils/publisher-font-face';

/**
 * Injects @font-face rules for all publisher-uploaded fonts on mount and when
 * the library changes (storage event / custom event from upload UI).
 */
export function PublisherFontsRootEffect() {
  useEffect(() => {
    const apply = () => {
      applyPublisherFontFacesStyle(loadPublisherFontTemplates());
    };
    apply();
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === PUBLISHER_FONT_TEMPLATES_STORAGE_KEY) apply();
    };
    const onCustom = () => apply();
    window.addEventListener('storage', onStorage);
    window.addEventListener('openmaic-publisher-fonts-changed', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('openmaic-publisher-fonts-changed', onCustom);
    };
  }, []);

  return null;
}
