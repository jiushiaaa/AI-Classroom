/**
 * Inline markup for publisher speech scripts.
 *
 * - Pause: `[[break:0.2]]` or `[[break:0.2s]]`
 * - Homophone: `[[显示|读音]]` — display the left token, TTS speaks the right
 */

export type SpeechScriptSegment =
  | { type: 'text'; value: string }
  | { type: 'break'; seconds: number }
  | { type: 'homophone'; display: string; speak: string };

const MARKUP_TOKEN_RE =
  /\[\[(?:break:([\d.]+)(?:s)?|([^|\]]+)\|([^\]]+))\]\]/gi;

export function parseSpeechScript(raw: string): SpeechScriptSegment[] {
  if (!raw) return [{ type: 'text', value: '' }];

  const segments: SpeechScriptSegment[] = [];
  let lastIndex = 0;

  for (const match of raw.matchAll(MARKUP_TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: 'text', value: raw.slice(lastIndex, index) });
    }
    if (match[1] !== undefined) {
      const seconds = Number.parseFloat(match[1]);
      segments.push({
        type: 'break',
        seconds: Number.isFinite(seconds) && seconds > 0 ? seconds : 0.2,
      });
    } else if (match[2] !== undefined && match[3] !== undefined) {
      segments.push({
        type: 'homophone',
        display: match[2],
        speak: match[3],
      });
    }
    lastIndex = index + match[0].length;
  }

  if (lastIndex < raw.length) {
    segments.push({ type: 'text', value: raw.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', value: '' }];
}

/** Merge consecutive plain-text runs after removing inline tokens. */
export function mergeAdjacentTextSegments(
  segments: SpeechScriptSegment[],
): SpeechScriptSegment[] {
  const merged: SpeechScriptSegment[] = [];
  for (const segment of segments) {
    if (
      segment.type === 'text' &&
      merged.length > 0 &&
      merged[merged.length - 1].type === 'text'
    ) {
      const prev = merged[merged.length - 1] as Extract<
        SpeechScriptSegment,
        { type: 'text' }
      >;
      merged[merged.length - 1] = {
        type: 'text',
        value: prev.value + segment.value,
      };
    } else {
      merged.push(segment);
    }
  }
  return merged.length > 0 ? merged : [{ type: 'text', value: '' }];
}

export function serializeSpeechScript(segments: SpeechScriptSegment[]): string {
  return segments
    .map((segment) => {
      if (segment.type === 'text') return segment.value;
      if (segment.type === 'break') {
        const seconds =
          Number.isFinite(segment.seconds) && segment.seconds > 0
            ? segment.seconds
            : 0.2;
        return `[[break:${seconds}]]`;
      }
      return `[[${segment.display}|${segment.speak}]]`;
    })
    .join('');
}

/** Plain text for subtitles / live speech chrome (no markup). */
export function speechScriptToDisplayPlain(raw: string): string {
  return serializeSpeechScript(
    parseSpeechScript(raw).map((segment) => {
      if (segment.type === 'homophone') {
        return { type: 'text' as const, value: segment.display };
      }
      if (segment.type === 'break') {
        return { type: 'text' as const, value: '' };
      }
      return segment;
    }),
  );
}

/** Plain text for providers without SSML (spoken form + light pauses). */
export function speechScriptToTtsPlain(raw: string): string {
  return parseSpeechScript(raw)
    .map((segment) => {
      if (segment.type === 'text') return segment.value;
      if (segment.type === 'homophone') return segment.speak;
      if (segment.type === 'break') return ' ';
      return '';
    })
    .join('');
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** SSML body (inside `<voice>`) for Azure-like providers. */
export function speechScriptToSsmlBody(raw: string): string {
  const parts: string[] = [];
  for (const segment of parseSpeechScript(raw)) {
    if (segment.type === 'text') {
      if (segment.value) parts.push(escapeXml(segment.value));
      continue;
    }
    if (segment.type === 'homophone') {
      parts.push(
        `<sub alias="${escapeXml(segment.speak)}">${escapeXml(segment.display)}</sub>`,
      );
      continue;
    }
    const ms = Math.max(50, Math.round(segment.seconds * 1000));
    parts.push(`<break time="${ms}ms"/>`);
  }
  return parts.join('');
}

export function hasSpeechScriptMarkup(raw: string): boolean {
  return /\[\[(?:break:[\d.]+(?:s)?|[^|\]]+\|[^\]]+)\]\]/i.test(raw);
}

export interface WordRange {
  start: number;
  end: number;
  word: string;
}

/** Pick the word under a caret offset inside a plain-text segment. */
export function getWordRangeAt(text: string, offset: number): WordRange | null {
  if (!text.length) return null;
  const clamped = Math.max(0, Math.min(offset, text.length));

  let start = clamped;
  while (start > 0 && isWordChar(text[start - 1])) start -= 1;

  let end = clamped;
  while (end < text.length && isWordChar(text[end])) end += 1;

  if (start === end) {
    if (clamped < text.length && isWordChar(text[clamped])) {
      start = clamped;
      end = clamped + 1;
    } else if (clamped > 0 && isWordChar(text[clamped - 1])) {
      start = clamped - 1;
      end = clamped;
    } else {
      return null;
    }
  }

  const word = text.slice(start, end);
  return word.trim() ? { start, end, word } : null;
}

function isWordChar(char: string): boolean {
  return /[\p{L}\p{N}_]/u.test(char);
}

export function replaceTextSegment(
  text: string,
  start: number,
  end: number,
  replacement: string,
): string {
  return text.slice(0, start) + replacement + text.slice(end);
}

export function prepareSpeechTextForTts(
  raw: string,
  providerId: string,
): { plainText: string; ssmlBody?: string; useSsml: boolean } {
  const hasMarkup = hasSpeechScriptMarkup(raw);
  if (!hasMarkup) {
    return { plainText: raw, useSsml: false };
  }

  if (providerId === 'azure-tts') {
    return {
      plainText: speechScriptToTtsPlain(raw),
      ssmlBody: speechScriptToSsmlBody(raw),
      useSsml: true,
    };
  }

  return { plainText: speechScriptToTtsPlain(raw), useSsml: false };
}
