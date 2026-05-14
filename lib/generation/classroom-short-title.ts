/**
 * Short display title for the classroom completion screen (≤10 graphemes).
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('ClassroomShortTitle');

export function truncateToMaxGraphemes(text: string, max: number): string {
  const t = text.trim();
  if (!t || max <= 0) return '';
  try {
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
      const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      const parts: string[] = [];
      for (const { segment } of seg.segment(t)) {
        parts.push(segment);
        if (parts.length >= max) return parts.join('');
      }
      return t;
    }
  } catch {
    /* fall through */
  }
  return [...t].slice(0, max).join('');
}

function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return cleaned.trim();
}

/** Fallback when AI is unavailable: book-style title in 《》, else head of string. */
export function heuristicShortTitle(rawTitle: string, max = 10): string {
  const raw = rawTitle.trim();
  if (!raw) return '';
  const m = raw.match(/《([^》]{1,20})》/);
  if (m?.[1]) return truncateToMaxGraphemes(m[1].trim(), max);
  const oneLine = raw.split(/\r?\n/)[0]?.trim() ?? raw;
  return truncateToMaxGraphemes(oneLine.replace(/^[\s"'「]+/, ''), max);
}

export function buildShortTitleMessages(input: {
  rawTitle: string;
  sceneTitles?: string[];
  languageDirective?: string;
}): { system: string; user: string } {
  const sceneBlock =
    input.sceneTitles && input.sceneTitles.length > 0
      ? `Scene titles (for context only):\n${input.sceneTitles
          .slice(0, 8)
          .map((t, i) => `${i + 1}. ${t}`)
          .join('\n')}\n`
      : '';
  const lang = (input.languageDirective || '').trim();

  const system = `You output a JSON object only, no markdown.
The user has a long or messy course label (may be a full prompt). Produce a very short human-friendly course name for a "lesson complete" screen.

Rules:
- Field name: "shortTitle"
- At most 10 grapheme clusters (e.g. Chinese characters count one each; emojis count one each).
- No quotes, brackets, newlines, or trailing punctuation in the title.
- Capture the core topic only; ignore instructions like "请生成…".
- Match the teaching language implied by the raw text or language directive.`;

  const user = `Raw label:\n${input.rawTitle.trim()}\n\n${sceneBlock}${lang ? `Language directive:\n${lang}\n` : ''}
Return exactly: {"shortTitle":"..."}`;

  return { system, user };
}

export function parseShortTitleJson(rawText: string): string | null {
  const cleaned = stripCodeFences(rawText);
  try {
    const parsed = JSON.parse(cleaned) as { shortTitle?: unknown };
    const s = typeof parsed.shortTitle === 'string' ? parsed.shortTitle.trim() : '';
    if (!s) return null;
    return truncateToMaxGraphemes(s, 10);
  } catch {
    log.warn('Failed to parse short title JSON:', cleaned.slice(0, 200));
    return null;
  }
}
