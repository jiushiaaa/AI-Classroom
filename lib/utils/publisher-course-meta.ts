/**
 * B-side publisher demo: course publish status stored in localStorage.
 * Replace with backend when the admin console is wired up.
 */
const PUBLISHED_IDS_KEY = 'pubCoursePublishedIds';

function readPublishedIds(): string[] {
  try {
    const raw = localStorage.getItem(PUBLISHED_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writePublishedIds(ids: string[]) {
  try {
    localStorage.setItem(PUBLISHED_IDS_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export type PublisherCourseStatus = 'draft' | 'published';

export function getPublisherCourseStatus(stageId: string): PublisherCourseStatus {
  if (typeof window === 'undefined') return 'draft';
  return readPublishedIds().includes(stageId) ? 'published' : 'draft';
}

/** Call from classroom "发布 / 生成二维码" flow when implemented. */
export function markCoursePublished(stageId: string) {
  const ids = readPublishedIds();
  if (ids.includes(stageId)) return;
  writePublishedIds([...ids, stageId]);
}

export function markCourseDraft(stageId: string) {
  writePublishedIds(readPublishedIds().filter((id) => id !== stageId));
}
