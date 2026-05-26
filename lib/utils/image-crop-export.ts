import type { Area } from 'react-easy-crop';
import { MAX_REFERENCE_BACKGROUND_BYTES } from '@/lib/constants/reference-background';

/** Max width for exported slide background crops (16:9 → 1920×1080). */
export const REFERENCE_BG_CROP_EXPORT_MAX_WIDTH = 1920;

/** Slide background crop is fixed to 16:9. */
export const REFERENCE_BG_CROP_ASPECT = 16 / 9;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

function approxDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.ceil((base64.length * 3) / 4);
}

function drawCroppedImage(
  image: HTMLImageElement,
  crop: Area,
  targetWidth: number,
  targetHeight: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    targetWidth,
    targetHeight,
  );
  return canvas;
}

/**
 * Export a cropped region as a JPEG data URL, scaled to fit max width and byte budget.
 */
export async function exportCroppedImageDataUrl(
  imageSrc: string,
  croppedAreaPixels: Area,
  options?: {
    maxWidth?: number;
    maxBytes?: number;
  },
): Promise<string> {
  const maxWidth = options?.maxWidth ?? REFERENCE_BG_CROP_EXPORT_MAX_WIDTH;
  const maxBytes = options?.maxBytes ?? MAX_REFERENCE_BACKGROUND_BYTES;
  const image = await loadImage(imageSrc);

  const scale = Math.min(1, maxWidth / Math.max(1, croppedAreaPixels.width));
  const targetWidth = Math.max(1, Math.round(croppedAreaPixels.width * scale));
  const targetHeight = Math.max(1, Math.round(croppedAreaPixels.height * scale));

  const canvas = drawCroppedImage(image, croppedAreaPixels, targetWidth, targetHeight);

  let quality = 0.92;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (approxDataUrlBytes(dataUrl) > maxBytes && quality > 0.5) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }

  if (approxDataUrlBytes(dataUrl) > maxBytes) {
    const shrink = Math.sqrt(maxBytes / approxDataUrlBytes(dataUrl)) * 0.95;
    const w2 = Math.max(1, Math.round(targetWidth * shrink));
    const h2 = Math.max(1, Math.round(targetHeight * shrink));
    const canvas2 = drawCroppedImage(image, croppedAreaPixels, w2, h2);
    quality = 0.85;
    dataUrl = canvas2.toDataURL('image/jpeg', quality);
    while (approxDataUrlBytes(dataUrl) > maxBytes && quality > 0.45) {
      quality -= 0.08;
      dataUrl = canvas2.toDataURL('image/jpeg', quality);
    }
  }

  if (approxDataUrlBytes(dataUrl) > maxBytes) {
    throw new Error('CROPPED_TOO_LARGE');
  }

  return dataUrl;
}
