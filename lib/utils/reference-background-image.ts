import {
  MAX_REFERENCE_BACKGROUND_BYTES,
  REFERENCE_BACKGROUND_MIME_ACCEPT,
} from '@/lib/constants/reference-background';

const ALLOWED_PREFIXES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

export function isAllowedReferenceBackgroundMime(type: string): boolean {
  return ALLOWED_PREFIXES.some((p) => type.startsWith(p));
}

export function readFileAsReferenceBackgroundDataUrl(
  file: File,
): Promise<{ ok: true; dataUrl: string } | { ok: false; error: 'type' | 'size' }> {
  if (!isAllowedReferenceBackgroundMime(file.type)) {
    return Promise.resolve({ ok: false, error: 'type' });
  }
  if (file.size > MAX_REFERENCE_BACKGROUND_BYTES) {
    return Promise.resolve({ ok: false, error: 'size' });
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl.startsWith('data:image/')) {
        resolve({ ok: false, error: 'type' });
        return;
      }
      const approxBytes = Math.ceil((dataUrl.length * 3) / 4);
      if (approxBytes > MAX_REFERENCE_BACKGROUND_BYTES) {
        resolve({ ok: false, error: 'size' });
        return;
      }
      resolve({ ok: true, dataUrl });
    };
    reader.onerror = () => resolve({ ok: false, error: 'type' });
    reader.readAsDataURL(file);
  });
}
