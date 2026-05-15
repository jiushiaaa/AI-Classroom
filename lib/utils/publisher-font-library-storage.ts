import { nanoid } from 'nanoid';
import {
  MAX_PUBLISHER_FONT_TEMPLATES,
  PUBLISHER_FONT_TEMPLATES_STORAGE_KEY,
} from '@/lib/constants/publisher-font';

export interface PublisherFontTemplate {
  id: string;
  /** User-facing name */
  name: string;
  /** Stable CSS font-family token (ASCII) */
  fontFamily: string;
  /** e.g. woff2, woff, ttf, otf */
  format: string;
  /** data:font/...;base64,... */
  dataUrl: string;
  createdAt: number;
}

export interface PublisherFontsSessionV1 {
  v: 1;
  ids: string[];
}

export interface PublisherFontsSessionV1 {
  v: 1;
  ids: string[];
}

function safeParse(raw: string | null): PublisherFontTemplate[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (row): row is PublisherFontTemplate =>
          typeof row === 'object' &&
          row !== null &&
          typeof (row as PublisherFontTemplate).id === 'string' &&
          typeof (row as PublisherFontTemplate).dataUrl === 'string' &&
          typeof (row as PublisherFontTemplate).name === 'string' &&
          typeof (row as PublisherFontTemplate).fontFamily === 'string' &&
          typeof (row as PublisherFontTemplate).format === 'string' &&
          typeof (row as PublisherFontTemplate).createdAt === 'number',
      )
      .slice(0, MAX_PUBLISHER_FONT_TEMPLATES);
  } catch {
    return [];
  }
}

export function loadPublisherFontTemplates(): PublisherFontTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    return safeParse(localStorage.getItem(PUBLISHER_FONT_TEMPLATES_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function savePublisherFontTemplates(items: PublisherFontTemplate[]): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = items.slice(0, MAX_PUBLISHER_FONT_TEMPLATES);
    localStorage.setItem(PUBLISHER_FONT_TEMPLATES_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* quota */
  }
}

function makeFontFamilyToken(): string {
  return `OpenMaicPublisher_${nanoid(10)}`;
}

function extToFormat(ext: string): 'woff2' | 'woff' | 'ttf' | 'otf' | null {
  const e = ext.toLowerCase().replace(/^\./, '');
  if (e === 'woff2' || e === 'woff' || e === 'ttf' || e === 'otf') return e;
  return null;
}

export function addPublisherFontTemplate(
  dataUrl: string,
  originalFileName: string,
): PublisherFontTemplate | null {
  const list = loadPublisherFontTemplates();
  if (list.length >= MAX_PUBLISHER_FONT_TEMPLATES) {
    return null;
  }
  const base = originalFileName.replace(/\.[^.]+$/, '').trim() || 'Custom font';
  const extMatch = originalFileName.match(/\.([^.]+)$/);
  const fmt = extMatch ? extToFormat(extMatch[1]) : null;
  if (!fmt) return null;

  const now = Date.now();
  const item: PublisherFontTemplate = {
    id: `pubfont_${nanoid(10)}`,
    name: base,
    fontFamily: makeFontFamilyToken(),
    format: fmt,
    dataUrl,
    createdAt: now,
  };
  savePublisherFontTemplates([item, ...list]);
  return item;
}

export function deletePublisherFontTemplate(id: string): void {
  const list = loadPublisherFontTemplates().filter((t) => t.id !== id);
  savePublisherFontTemplates(list);
}

export function getPublisherFontTemplateById(id: string): PublisherFontTemplate | undefined {
  return loadPublisherFontTemplates().find((t) => t.id === id);
}

export function publisherFontsForPromptFromIds(
  ids: string[],
): Array<{ family: string; label: string }> {
  const uniq = [...new Set(ids)].filter(Boolean);
  const out: Array<{ family: string; label: string }> = [];
  for (const id of uniq) {
    const t = getPublisherFontTemplateById(id);
    if (t) out.push({ family: t.fontFamily, label: t.name });
  }
  return out;
}
