import { nanoid } from 'nanoid';
import {
  MAX_REFERENCE_BG_TEMPLATES,
  REFERENCE_BG_TEMPLATES_STORAGE_KEY,
} from '@/lib/constants/reference-background';

export interface ReferenceBackgroundTemplate {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: number;
}

function safeParse(raw: string | null): ReferenceBackgroundTemplate[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (row): row is ReferenceBackgroundTemplate =>
          typeof row === 'object' &&
          row !== null &&
          typeof (row as ReferenceBackgroundTemplate).id === 'string' &&
          typeof (row as ReferenceBackgroundTemplate).dataUrl === 'string' &&
          typeof (row as ReferenceBackgroundTemplate).name === 'string' &&
          typeof (row as ReferenceBackgroundTemplate).createdAt === 'number',
      )
      .slice(0, MAX_REFERENCE_BG_TEMPLATES);
  } catch {
    return [];
  }
}

export function loadReferenceBackgroundTemplates(): ReferenceBackgroundTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    return safeParse(localStorage.getItem(REFERENCE_BG_TEMPLATES_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveReferenceBackgroundTemplates(items: ReferenceBackgroundTemplate[]): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = items.slice(0, MAX_REFERENCE_BG_TEMPLATES);
    localStorage.setItem(REFERENCE_BG_TEMPLATES_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* quota / private mode */
  }
}

export function addReferenceBackgroundTemplate(
  dataUrl: string,
  name?: string,
): ReferenceBackgroundTemplate | null {
  const list = loadReferenceBackgroundTemplates();
  if (list.length >= MAX_REFERENCE_BG_TEMPLATES) {
    return null;
  }
  const now = Date.now();
  const item: ReferenceBackgroundTemplate = {
    id: `refbg_${nanoid(10)}`,
    name: name?.trim() || `Background · ${new Date(now).toLocaleDateString()}`,
    dataUrl,
    createdAt: now,
  };
  saveReferenceBackgroundTemplates([item, ...list]);
  return item;
}

export function deleteReferenceBackgroundTemplate(id: string): void {
  const list = loadReferenceBackgroundTemplates().filter((t) => t.id !== id);
  saveReferenceBackgroundTemplates(list);
}

export function getReferenceBackgroundTemplateById(
  id: string,
): ReferenceBackgroundTemplate | undefined {
  return loadReferenceBackgroundTemplates().find((t) => t.id === id);
}
