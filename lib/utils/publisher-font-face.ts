import type { PublisherFontTemplate } from '@/lib/utils/publisher-font-library-storage';

const STYLE_ID = 'openmaic-publisher-font-faces';

function mimeForFormat(fmt: string): string {
  switch (fmt) {
    case 'woff2':
      return 'font/woff2';
    case 'woff':
      return 'font/woff';
    case 'ttf':
      return 'font/ttf';
    case 'otf':
      return 'font/otf';
    default:
      return 'application/octet-stream';
  }
}

/** CSS @font-face rules for injected publisher fonts. */
export function buildPublisherFontFaceCss(fonts: PublisherFontTemplate[]): string {
  return fonts
    .map((f) => {
      const src = f.dataUrl.startsWith('data:')
        ? f.dataUrl
        : `data:${mimeForFormat(f.format)};base64,${f.dataUrl}`;
      return `@font-face{font-family:${JSON.stringify(f.fontFamily)};src:url(${JSON.stringify(src)}) format(${JSON.stringify(f.format)});font-weight:100 900;font-style:normal;font-display:swap;}`;
    })
    .join('\n');
}

/** Mount or update a single style tag with all publisher font faces. */
export function applyPublisherFontFacesStyle(fonts: PublisherFontTemplate[]): void {
  if (typeof document === 'undefined') return;
  const css = buildPublisherFontFaceCss(fonts);
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

export function dispatchPublisherFontsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('openmaic-publisher-fonts-changed'));
}
