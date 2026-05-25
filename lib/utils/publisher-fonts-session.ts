import { PUBLISHER_FONTS_SESSION_KEY } from '@/lib/constants/publisher-font';
import type { PublisherFontsSessionV1 } from '@/lib/utils/publisher-font-library-storage';

/** Font template id selected for this generation run (at most one). */
export function readPublisherFontSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PUBLISHER_FONTS_SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PublisherFontsSessionV1;
    if (data?.v !== 1 || !Array.isArray(data.ids)) return null;
    const id = data.ids.find((x): x is string => typeof x === 'string' && Boolean(x));
    return id ?? null;
  } catch {
    return null;
  }
}

export function writePublisherFontSessionId(id: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!id) {
      sessionStorage.removeItem(PUBLISHER_FONTS_SESSION_KEY);
      return;
    }
    const payload: PublisherFontsSessionV1 = { v: 1, ids: [id] };
    sessionStorage.setItem(PUBLISHER_FONTS_SESSION_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

/** @deprecated Use readPublisherFontSessionId. */
export function readPublisherFontSessionIds(): string[] {
  const id = readPublisherFontSessionId();
  return id ? [id] : [];
}

/** @deprecated Use writePublisherFontSessionId. */
export function writePublisherFontSessionIds(ids: string[]): void {
  const first = ids.find(Boolean) ?? null;
  writePublisherFontSessionId(first);
}
