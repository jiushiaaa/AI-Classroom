import type { TextAlign } from '@/lib/types/slides';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Plain text from HTML (lossy). */
export function stripHtmlToPlain(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Rebuilds content as a single styled paragraph, preserving visible text.
 * Suitable for publisher knobs that apply document-level defaults.
 */
export function rebuildStyledParagraph(
  html: string,
  opts: {
    textAlign?: TextAlign;
    fontSizePx?: number;
    fontWeight?: 'normal' | 'bold';
    fontStyle?: 'normal' | 'italic';
    textDecoration?: 'none' | 'underline';
  },
): string {
  const plain = stripHtmlToPlain(html) || ' ';
  const align = opts.textAlign ?? 'left';
  const size = opts.fontSizePx ?? 18;
  const weight = opts.fontWeight ?? 'normal';
  const style = opts.fontStyle ?? 'normal';
  const deco = opts.textDecoration ?? 'none';
  return `<p style="text-align:${align};font-size:${size}px;font-weight:${weight};font-style:${style};text-decoration:${deco};line-height:1.6">${escapeHtml(plain)}</p>`;
}

export function parseFirstParagraphStyle(html: string): {
  textAlign: TextAlign;
  fontSizePx: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline';
} {
  const m = html.match(/<p[^>]*style="([^"]*)"/i);
  const style = m?.[1] ?? '';
  const ta = style.match(/text-align:\s*([^;]+)/i)?.[1]?.trim() as TextAlign | undefined;
  const fs = style.match(/font-size:\s*([\d.]+)px/i)?.[1];
  const fw = style.match(/font-weight:\s*(\d+|bold|normal)/i)?.[1];
  const fst = style.match(/font-style:\s*(italic|normal)/i)?.[1];
  const td = style.match(/text-decoration:\s*(underline|none)/i)?.[1];
  return {
    textAlign:
      ta === 'center' || ta === 'right' || ta === 'justify' || ta === 'left' ? ta : 'left',
    fontSizePx: fs ? Math.round(parseFloat(fs)) : 18,
    fontWeight: fw === 'bold' || fw === '700' ? 'bold' : 'normal',
    fontStyle: fst === 'italic' ? 'italic' : 'normal',
    textDecoration: td === 'underline' ? 'underline' : 'none',
  };
}
