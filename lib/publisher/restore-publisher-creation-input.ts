import { MOCK_BOOKS, type MockBookChapter } from '@/lib/mock/book-library-mock';
import type { BookLibrarySelection } from '@/components/publisher/book-library-dialog';
import { loadReferenceBackgroundTemplates } from '@/lib/utils/reference-background-library-storage';
import type { PublisherCreationInputSnapshot } from '@/lib/publisher/publisher-creation-input-storage';

export interface PublisherFormRestoreResult {
  requirement: string;
  interactiveMode: boolean;
  bookSelection: BookLibrarySelection | null;
  referenceSession: { id: string; dataUrl: string } | null;
  fontSessionId: string | null;
  /** True when snapshot had attachments that cannot be restored as File objects. */
  attachmentsSkipped: boolean;
}

function resolveBookSelection(
  bookId: string,
  chapterIds: string[],
): BookLibrarySelection | null {
  const book = MOCK_BOOKS.find((b) => b.id === bookId);
  if (!book) return null;
  const chapterSet = new Set(chapterIds);
  const chapters: MockBookChapter[] = book.chapters.filter((c) => chapterSet.has(c.id));
  if (chapters.length === 0) return null;
  return { book, chapters };
}

export function derivePublisherFormFromSnapshot(
  snapshot: PublisherCreationInputSnapshot,
): PublisherFormRestoreResult {
  let bookSelection: BookLibrarySelection | null = null;
  if (snapshot.bookSelection) {
    bookSelection = resolveBookSelection(
      snapshot.bookSelection.bookId,
      snapshot.bookSelection.chapterIds,
    );
  }

  let referenceSession: { id: string; dataUrl: string } | null = null;
  if (snapshot.referenceTemplateId) {
    const template = loadReferenceBackgroundTemplates().find(
      (t) => t.id === snapshot.referenceTemplateId,
    );
    if (template) {
      referenceSession = { id: template.id, dataUrl: template.dataUrl };
    }
  }

  return {
    requirement: snapshot.requirement,
    interactiveMode: snapshot.interactiveMode,
    bookSelection,
    referenceSession,
    fontSessionId: snapshot.fontSessionId ?? null,
    attachmentsSkipped: (snapshot.attachments?.length ?? 0) > 0,
  };
}
