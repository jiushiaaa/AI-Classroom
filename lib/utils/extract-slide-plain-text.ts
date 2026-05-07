import type { SlideContent } from '@/lib/types/stage';

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Collect visible text from slide canvas elements for AI / notes heuristics. */
export function extractSlidePlainText(content: SlideContent | undefined, maxLen = 800): string {
  if (!content || content.type !== 'slide') return '';
  const els = content.canvas?.elements ?? [];
  const parts: string[] = [];
  for (const el of els) {
    if (el.type === 'text' && 'content' in el && typeof el.content === 'string') {
      const t = stripHtml(el.content);
      if (t) parts.push(t);
    }
  }
  const joined = parts.join(' ').replace(/\s+/g, ' ').trim();
  if (joined.length <= maxLen) return joined;
  return `${joined.slice(0, maxLen)}…`;
}
