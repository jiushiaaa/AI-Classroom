import { PUBLISHER_FONTS_SESSION_KEY } from '@/lib/constants/publisher-font';
import type { PublisherFontsSessionV1 } from '@/lib/utils/publisher-font-library-storage';

export function readPublisherFontSessionIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(PUBLISHER_FONTS_SESSION_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as PublisherFontsSessionV1;
    if (data?.v !== 1 || !Array.isArray(data.ids)) return [];
    return data.ids.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

export function writePublisherFontSessionIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const uniq = [...new Set(ids)].filter(Boolean);
    if (uniq.length === 0) {
      sessionStorage.removeItem(PUBLISHER_FONTS_SESSION_KEY);
      return;
    }
    const payload: PublisherFontsSessionV1 = { v: 1, ids: uniq };
    sessionStorage.setItem(PUBLISHER_FONTS_SESSION_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}
