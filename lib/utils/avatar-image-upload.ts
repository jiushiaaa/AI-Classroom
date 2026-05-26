/** Max uploaded image size before rejection (5 MB). */
export const MAX_AVATAR_UPLOAD_BYTES = 5 * 1024 * 1024;

export type AvatarImageUploadError = 'tooLarge' | 'invalidType' | 'readFailed';

/**
 * Read an image file, center-crop scale to 128×128, return a JPEG data-URL.
 */
export function readAvatarImageFile(
  file: File,
): Promise<{ ok: true; dataUrl: string } | { ok: false; error: AvatarImageUploadError }> {
  if (file.size > MAX_AVATAR_UPLOAD_BYTES) {
    return Promise.resolve({ ok: false, error: 'tooLarge' });
  }
  if (!file.type.startsWith('image/')) {
    return Promise.resolve({ ok: false, error: 'invalidType' });
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve({ ok: false, error: 'readFailed' });
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve({ ok: false, error: 'readFailed' });
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ ok: false, error: 'readFailed' });
          return;
        }
        const scale = Math.max(128 / img.width, 128 / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (128 - w) / 2, (128 - h) / 2, w, h);
        resolve({ ok: true, dataUrl: canvas.toDataURL('image/jpeg', 0.85) });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
