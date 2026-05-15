import { MAX_PUBLISHER_FONT_BYTES } from '@/lib/constants/publisher-font';

export type ReadPublisherFontResult =
  | { ok: true; dataUrl: string; fileName: string }
  | { ok: false; error: 'size' | 'type' };

const ALLOWED_EXT = new Set(['woff2', 'woff', 'ttf', 'otf']);

export async function readFileAsPublisherFontDataUrl(file: File): Promise<ReadPublisherFontResult> {
  const match = file.name.match(/\.([^.]+)$/i);
  const ext = match ? match[1].toLowerCase() : '';
  if (!ALLOWED_EXT.has(ext)) {
    return { ok: false, error: 'type' };
  }
  if (file.size > MAX_PUBLISHER_FONT_BYTES) {
    return { ok: false, error: 'size' };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl.startsWith('data:')) {
        resolve({ ok: false, error: 'type' });
        return;
      }
      resolve({ ok: true, dataUrl, fileName: file.name });
    };
    reader.onerror = () => resolve({ ok: false, error: 'type' });
    reader.readAsDataURL(file);
  });
}
