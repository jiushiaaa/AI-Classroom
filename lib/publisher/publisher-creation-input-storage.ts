import type { CourseCategory } from '@/lib/mock/discover-courses';
import type { PublisherKnowledgeChunkPreview } from '@/lib/publisher/publisher-book-parse-mock';

/** Snapshot of publisher home-page inputs captured right before generation. */
export interface PublisherCreationInputSnapshot {
  version: 1;
  requirement: string;
  interactiveMode: boolean;
  bookSelection?: {
    bookId: string;
    chapterIds: string[];
  };
  attachments?: Array<{
    fileName: string;
    size: number;
    mimeType: string;
    detectedCategories: CourseCategory[];
    mockChunks: PublisherKnowledgeChunkPreview[];
  }>;
  referenceTemplateId?: string | null;
  fontSessionId?: string | null;
  savedAt: number;
}

const STORAGE_KEY = 'publisherCreationInputs';
const PENDING_KEY = 'pendingPublisherCreationInput';

function readMap(): Record<string, PublisherCreationInputSnapshot> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, PublisherCreationInputSnapshot>;
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, PublisherCreationInputSnapshot>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota */
  }
}

export function savePublisherCreationInput(
  stageId: string,
  snapshot: PublisherCreationInputSnapshot,
): void {
  const map = readMap();
  map[stageId] = snapshot;
  writeMap(map);
}

export function loadPublisherCreationInput(
  stageId: string,
): PublisherCreationInputSnapshot | null {
  const snapshot = readMap()[stageId];
  if (!snapshot || snapshot.version !== 1) return null;
  return snapshot;
}

export function hasPublisherCreationInput(stageId: string): boolean {
  return loadPublisherCreationInput(stageId) !== null;
}

/** Stash inputs before navigation to generation-preview (stage id not yet known). */
export function savePendingPublisherCreationInput(
  snapshot: PublisherCreationInputSnapshot,
): void {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }
}

export function consumePendingPublisherCreationInput(
  stageId: string,
): PublisherCreationInputSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as PublisherCreationInputSnapshot;
    if (!snapshot || snapshot.version !== 1) return null;
    savePublisherCreationInput(stageId, snapshot);
    return snapshot;
  } catch {
    return null;
  }
}

export function buildPublisherCreationInputSnapshot(input: {
  requirement: string;
  interactiveMode: boolean;
  bookSelection?: { bookId: string; chapterIds: string[] } | null;
  attachments?: Array<{
    file: File;
    detectedCategories: CourseCategory[];
    mockChunks: PublisherKnowledgeChunkPreview[];
  }>;
  referenceTemplateId?: string | null;
  fontSessionId?: string | null;
}): PublisherCreationInputSnapshot {
  return {
    version: 1,
    requirement: input.requirement,
    interactiveMode: input.interactiveMode,
    bookSelection: input.bookSelection ?? undefined,
    attachments: input.attachments?.map((a) => ({
      fileName: a.file.name,
      size: a.file.size,
      mimeType: a.file.type,
      detectedCategories: a.detectedCategories,
      mockChunks: a.mockChunks,
    })),
    referenceTemplateId: input.referenceTemplateId ?? null,
    fontSessionId: input.fontSessionId ?? null,
    savedAt: Date.now(),
  };
}
