import type { PublisherShelfCategoryId } from '@/lib/publisher/publisher-shelf-category';
import { isPublisherShelfCategoryId } from '@/lib/publisher/publisher-shelf-category';

const STORAGE_KEY = 'pubCourseShelfCategories';

function parseMap(raw: string | null): Record<string, PublisherShelfCategoryId> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, PublisherShelfCategoryId> = {};
    for (const [id, v] of Object.entries(parsed)) {
      if (isPublisherShelfCategoryId(v)) out[id] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function readShelfCategoryMap(): Record<string, PublisherShelfCategoryId> {
  if (typeof window === 'undefined') return {};
  try {
    return parseMap(localStorage.getItem(STORAGE_KEY));
  } catch {
    return {};
  }
}

export function writeShelfCategoryMap(map: Record<string, PublisherShelfCategoryId>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function setShelfCategoryInStorage(
  courseId: string,
  category: PublisherShelfCategoryId,
  current: Record<string, PublisherShelfCategoryId>,
): Record<string, PublisherShelfCategoryId> {
  const next = { ...current, [courseId]: category };
  writeShelfCategoryMap(next);
  return next;
}
