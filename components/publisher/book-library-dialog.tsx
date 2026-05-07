'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  FileText,
  Library,
  Loader2,
  Paperclip,
  Plus,
  Search,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';
import { MOCK_BOOKS, type MockBook, type MockBookChapter } from '@/lib/mock/book-library-mock';
import {
  PUBLISHER_BOOK_ACCEPT,
  PUBLISHER_MAX_BOOK_BYTES,
  PUBLISHER_MAX_BOOK_MB,
  type PublisherAttachmentEntry,
  type PublisherParsePhase,
} from '@/lib/publisher/publisher-book-parse-mock';

type Step = 'library' | 'add' | 'chapter';
type TabId = 'library' | 'attachments';

/** Hard cap on concurrent attachments (matches PRD §6.1). */
const ATTACHMENTS_MAX = 5;

/** Map parse phase → 0-100 progress. Mirrors `parseProgressFor` in app/page.tsx. */
function attachmentProgress(phase: PublisherParsePhase): number {
  switch (phase) {
    case 'idle':
      return 0;
    case 'uploading':
      return 15;
    case 'toc':
      return 40;
    case 'chunks':
      return 70;
    case 'vectors':
      return 90;
    case 'ready':
      return 100;
  }
}

export interface BookLibrarySelection {
  book: MockBook;
  chapters: MockBookChapter[];
}

interface BookLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (selection: BookLibrarySelection) => void;
  /** Optional initial selection (book id + chapter ids) for re-edit. */
  initialSelection?: { bookId: string; chapterIds: string[] } | null;
  /** Element that anchors the popover (typically the toolbar button). */
  children: React.ReactNode;
  /** Side relative to the trigger. Defaults to "top" so it pops up from a bottom toolbar button. */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Alignment relative to the trigger. */
  align?: 'start' | 'center' | 'end';
  /** Initial active tab when the popover is (re-)opened. */
  initialTab?: TabId;
  /** Currently uploaded attachments — drives the «我的附件» tab. */
  attachments?: PublisherAttachmentEntry[];
  /** Validate + queue files for parsing. Caller enforces the 5-file cap. */
  onAddFiles?: (files: File[]) => void;
  /** Cancel a single attachment's parse and remove it. */
  onRemoveAttachment?: (id: string) => void;
  /** Inject 3 pre-parsed demo attachments (button hidden once any uploaded). */
  onLoadDemoAttachments?: () => void;
}

export function BookLibraryDialog({
  open,
  onOpenChange,
  onConfirm,
  initialSelection,
  children,
  side = 'top',
  align = 'start',
  initialTab = 'library',
  attachments = [],
  onAddFiles,
  onRemoveAttachment,
  onLoadDemoAttachments,
}: BookLibraryDialogProps) {
  const [tab, setTab] = useState<TabId>(initialTab);
  const [step, setStep] = useState<Step>('library');
  const [search, setSearch] = useState('');
  const [extraBooks, setExtraBooks] = useState<MockBook[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setStep('library');
    setSearch('');
    if (initialSelection) {
      setSelectedBookId(initialSelection.bookId);
      setSelectedChapterIds(new Set(initialSelection.chapterIds));
    } else {
      setSelectedBookId(null);
      setSelectedChapterIds(new Set());
    }
  }, [open, initialSelection, initialTab]);

  const attachmentsTabEnabled = !!onAddFiles;

  const allBooks = useMemo(() => [...extraBooks, ...MOCK_BOOKS], [extraBooks]);

  const filteredBooks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allBooks;
    return allBooks.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        (b.subtitle?.toLowerCase().includes(q) ?? false) ||
        b.subject.toLowerCase().includes(q),
    );
  }, [allBooks, search]);

  const selectedBook = useMemo(
    () => allBooks.find((b) => b.id === selectedBookId) ?? null,
    [allBooks, selectedBookId],
  );

  const handleBookClick = (book: MockBook) => {
    setSelectedBookId(book.id);
    if (selectedBookId !== book.id) setSelectedChapterIds(new Set());
    setStep('chapter');
  };

  const toggleChapter = (id: string) => {
    setSelectedChapterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllChapters = () => {
    if (!selectedBook) return;
    setSelectedChapterIds((prev) => {
      const all = selectedBook.chapters.map((c) => c.id);
      const allSelected = all.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(all);
    });
  };

  const handleConfirmChapters = () => {
    if (!selectedBook) return;
    const chapters = selectedBook.chapters.filter((c) => selectedChapterIds.has(c.id));
    if (chapters.length === 0) return;
    onConfirm({ book: selectedBook, chapters });
    onOpenChange(false);
  };

  const handleAddBook = (newBook: MockBook) => {
    setExtraBooks((prev) => [newBook, ...prev]);
    setSelectedBookId(newBook.id);
    setSelectedChapterIds(new Set());
    setStep('chapter');
  };

  /** Switch tabs — always reset library tab back to its root step to avoid
   *  stranding the user mid-add or mid-chapter flow. */
  const handleSwitchTab = (next: TabId) => {
    if (next === tab) return;
    setStep('library');
    setTab(next);
  };

  const showTabs = attachmentsTabEnabled && (tab === 'attachments' || step === 'library');

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={8}
        collisionPadding={12}
        className={cn(
          '!p-0 !gap-0 overflow-hidden bg-white dark:bg-slate-900',
          'w-[min(calc(100vw-2rem),520px)] rounded-2xl border border-border/60',
          'shadow-xl shadow-black/[0.06] dark:shadow-black/30 ring-1 ring-black/[0.03]',
        )}
      >
        <BookLibraryHeader
          tab={tab}
          step={step}
          selectedBookTitle={selectedBook?.title}
          onClose={() => onOpenChange(false)}
          onBack={() => setStep('library')}
        />

        {showTabs && (
          <UploadHubTabStrip
            tab={tab}
            attachmentCount={attachments.length}
            onSwitch={handleSwitchTab}
          />
        )}

        <div className="relative max-h-[min(70vh,460px)] overflow-y-auto">
          <AnimatePresence mode="wait">
            {tab === 'library' && step === 'library' && (
              <motion.div
                key="library"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                className="px-4 pb-4 pt-2"
              >
                <LibraryStep
                  books={filteredBooks}
                  totalBooks={allBooks.length}
                  search={search}
                  setSearch={setSearch}
                  onAddNew={() => setStep('add')}
                  onPickBook={handleBookClick}
                />
              </motion.div>
            )}

            {tab === 'library' && step === 'add' && (
              <motion.div
                key="add"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.18 }}
                className="px-4 pb-4 pt-2"
              >
                <AddBookStep onCancel={() => setStep('library')} onAdd={handleAddBook} />
              </motion.div>
            )}

            {tab === 'library' && step === 'chapter' && selectedBook && (
              <motion.div
                key="chapter"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.18 }}
                className="px-4 pb-3 pt-2"
              >
                <ChapterStep
                  book={selectedBook}
                  selected={selectedChapterIds}
                  onToggle={toggleChapter}
                  onSelectAll={handleSelectAllChapters}
                />
              </motion.div>
            )}

            {tab === 'attachments' && attachmentsTabEnabled && (
              <motion.div
                key="attachments"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.18 }}
                className="px-4 pb-4 pt-2"
              >
                <AttachmentsStep
                  attachments={attachments}
                  onAddFiles={(files) => onAddFiles?.(files)}
                  onRemove={(id) => onRemoveAttachment?.(id)}
                  onLoadDemo={onLoadDemoAttachments}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {tab === 'library' && step === 'chapter' && selectedBook && (
          <ChapterFooter
            count={selectedChapterIds.size}
            onCancel={() => onOpenChange(false)}
            onConfirm={handleConfirmChapters}
            disabled={selectedChapterIds.size === 0}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

// ──────────────────────────────────────────────────────────────────
// Header — context-aware (library / add / chapter / attachments)
// ──────────────────────────────────────────────────────────────────

function BookLibraryHeader({
  tab,
  step,
  selectedBookTitle,
  onClose,
  onBack,
}: {
  tab: TabId;
  step: Step;
  selectedBookTitle?: string;
  onClose: () => void;
  onBack: () => void;
}) {
  const { t } = useI18n();

  let titleNode: React.ReactNode;
  // Library tab — context-aware sub-headings
  if (tab === 'library' && step === 'chapter' && selectedBookTitle) {
    titleNode = (
      <>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
          <span>{t('bookLibrary.crumbBook')}</span>
          <ChevronRight className="size-3 opacity-60" />
          <span className="truncate max-w-[220px] text-foreground/80 font-medium">
            {selectedBookTitle}
          </span>
        </div>
        <h2 className="text-[14px] font-semibold mt-0.5">{t('bookLibrary.chapterTitle')}</h2>
      </>
    );
  } else if (tab === 'library' && step === 'add') {
    titleNode = <h2 className="text-[14px] font-semibold">{t('bookLibrary.addTitle')}</h2>;
  } else {
    // root of either tab — a single neutral title for the unified hub
    titleNode = <h2 className="text-[14px] font-semibold">{t('bookLibrary.hubTitle')}</h2>;
  }

  // Back arrow only inside library sub-flows
  const showBack = tab === 'library' && step !== 'library';

  return (
    <div className="px-4 py-3 flex items-center justify-between border-b border-border/50 bg-gradient-to-b from-violet-50/40 to-transparent dark:from-violet-950/20">
      <div className="min-w-0 flex items-center gap-2">
        {showBack && (
          <button
            type="button"
            onClick={onBack}
            className="size-7 rounded-full inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors -ml-1"
            aria-label={t('common.back')}
          >
            <ArrowLeft className="size-3.5" />
          </button>
        )}
        <div className="min-w-0">{titleNode}</div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="size-7 rounded-full inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        aria-label={t('common.close')}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Tab strip — switches between «图书库» and «我的附件»
// ──────────────────────────────────────────────────────────────────

function UploadHubTabStrip({
  tab,
  attachmentCount,
  onSwitch,
}: Readonly<{
  tab: TabId;
  attachmentCount: number;
  onSwitch: (next: TabId) => void;
}>) {
  const { t } = useI18n();
  const tabs: { id: TabId; label: string; icon: typeof Library; badge?: number }[] = [
    { id: 'library', label: t('bookLibrary.tabLibrary'), icon: Library },
    {
      id: 'attachments',
      label: t('bookLibrary.tabAttachments'),
      icon: Paperclip,
      badge: attachmentCount,
    },
  ];

  return (
    <div className="px-4 pt-2 pb-1.5 flex items-center gap-1 border-b border-border/40 bg-white/60 dark:bg-slate-900/40">
      {tabs.map((tb) => {
        const active = tab === tb.id;
        const Icon = tb.icon;
        return (
          <button
            key={tb.id}
            type="button"
            onClick={() => onSwitch(tb.id)}
            className={cn(
              'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium transition-all cursor-pointer',
              active
                ? 'bg-violet-100 dark:bg-violet-900/35 text-violet-700 dark:text-violet-300'
                : 'text-muted-foreground/80 hover:text-foreground hover:bg-muted/40',
            )}
          >
            <Icon className="size-3.5" />
            <span>{tb.label}</span>
            {tb.badge !== undefined && tb.badge > 0 && (
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold tabular-nums',
                  active
                    ? 'bg-violet-600 text-white'
                    : 'bg-muted-foreground/15 text-muted-foreground/85',
                )}
              >
                {tb.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Step 1 — book library grid
// ──────────────────────────────────────────────────────────────────

function LibraryStep({
  books,
  totalBooks,
  search,
  setSearch,
  onAddNew,
  onPickBook,
}: {
  books: MockBook[];
  totalBooks: number;
  search: string;
  setSearch: (v: string) => void;
  onAddNew: () => void;
  onPickBook: (b: MockBook) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('bookLibrary.searchPlaceholder')}
            className="w-full pl-8 pr-3 h-8 rounded-full text-[12px] border border-border/60 bg-muted/30 placeholder:text-muted-foreground/50 focus:outline-none focus:bg-background focus:border-violet-300/70 transition-colors"
          />
        </div>
        <span className="text-[11px] text-muted-foreground/70 tabular-nums ml-auto">
          {t('bookLibrary.totalCount', { count: totalBooks })}
        </span>
      </div>

      {books.length === 0 ? (
        <div className="py-10 text-center text-[13px] text-muted-foreground/60">
          {t('bookLibrary.searchEmpty')}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={onAddNew}
            className={cn(
              'group relative aspect-[3/4] rounded-xl border-2 border-dashed border-border/60 bg-muted/15',
              'flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer',
              'hover:border-violet-400/70 hover:bg-violet-50/40 dark:hover:bg-violet-950/20',
            )}
          >
            <div className="size-8 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Plus className="size-4 text-violet-600 dark:text-violet-300" />
            </div>
            <span className="text-[11px] font-medium text-muted-foreground/85 group-hover:text-violet-700 dark:group-hover:text-violet-300">
              {t('bookLibrary.addNew')}
            </span>
          </button>

          {books.map((book) => (
            <button
              key={book.id}
              type="button"
              onClick={() => onPickBook(book)}
              className="group cursor-pointer text-left"
            >
              <div
                className={cn(
                  'relative aspect-[3/4] rounded-xl overflow-hidden bg-gradient-to-br shadow-sm transition-all',
                  'group-hover:shadow-md group-hover:-translate-y-0.5',
                  book.coverGradient,
                )}
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2 text-center">
                  <span className="text-2xl drop-shadow-sm select-none">{book.coverEmoji}</span>
                  <span className="text-[10px] font-bold text-white/95 leading-tight line-clamp-2 drop-shadow-md">
                    {book.title}
                  </span>
                  {book.subtitle ? (
                    <span className="text-[9px] text-white/85 leading-tight line-clamp-1">
                      {book.subtitle}
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="mt-1.5 text-[11px] font-medium text-foreground/85 truncate">
                {book.title}
              </p>
              <p className="text-[10px] text-muted-foreground/70">
                {t('bookLibrary.chapterCount', { count: book.chapters.length })}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Step 2 — add a new book (multi-file: 1 main + N supplementary)
// ──────────────────────────────────────────────────────────────────

/** Same hard cap as ad-hoc attachments — keeps the demo story consistent. */
const ADD_BOOK_MAX_FILES = ATTACHMENTS_MAX;
const NAME_MAX = 100;

/** Estimate page count from byte size (mock). ~8 pages per MB, min 3. */
function estimatePagesFromSize(bytes: number): number {
  return Math.max(3, Math.round((bytes / (1024 * 1024)) * 8));
}

/**
 * Compose the chapter list for a multi-file book:
 *
 *   - File #1 (the "main" book) → split into 5 placeholder chapters,
 *     keeping parity with the legacy single-file behaviour;
 *   - Files #2..N (supplementary) → 1 chapter per file, named after the
 *     file (extension stripped) and tagged as 「附件」 in i18n.
 */
function buildChaptersFromFiles(
  files: File[],
  t: (key: string, vars?: Record<string, unknown>) => string,
): MockBookChapter[] {
  if (files.length === 0) return [];
  const chapters: MockBookChapter[] = [];
  for (let i = 0; i < 5; i++) {
    chapters.push({
      id: `ch-main-${i + 1}`,
      title: t('bookLibrary.placeholderChapter', { index: i + 1 }),
      pages: 6 + i,
    });
  }
  for (let i = 1; i < files.length; i++) {
    const f = files[i];
    const baseName = f.name.replace(/\.[^.]+$/, '').slice(0, 60);
    chapters.push({
      id: `ch-attach-${i}`,
      title: t('bookLibrary.attachmentChapterTitle', { name: baseName }),
      pages: estimatePagesFromSize(f.size),
    });
  }
  return chapters;
}

function AddBookStep({
  onCancel,
  onAdd,
}: Readonly<{
  onCancel: () => void;
  onAdd: (b: MockBook) => void;
}>) {
  const { t } = useI18n();
  const [files, setFiles] = useState<File[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const remaining = Math.max(0, ADD_BOOK_MAX_FILES - files.length);
  const atCapacity = remaining === 0;

  /**
   * Append `incoming` to `files`, validating each individually and refusing
   * any beyond the 5-file cap. Auto-fills the book name with the first
   * accepted filename if the user hasn't typed one yet.
   */
  const acceptFiles = (incoming: File[]) => {
    setError(null);
    if (incoming.length === 0) return;
    const accepted: File[] = [];
    let firstError: string | null = null;
    let truncated = false;
    for (const f of incoming) {
      if (files.length + accepted.length >= ADD_BOOK_MAX_FILES) {
        truncated = true;
        break;
      }
      if (f.size > PUBLISHER_MAX_BOOK_BYTES) {
        firstError ??= t('upload.fileTooLargePublisher', { maxMb: PUBLISHER_MAX_BOOK_MB });
        continue;
      }
      accepted.push(f);
    }
    if (firstError) setError(firstError);
    else if (truncated) {
      setError(t('bookLibrary.addCapacityHit', { max: ADD_BOOK_MAX_FILES }));
    }
    if (accepted.length === 0) return;
    setFiles((prev) => {
      const next = [...prev, ...accepted];
      // Auto-fill name from the first file (only if user hasn't typed)
      if (!name.trim() && next.length > 0) {
        const baseName = next[0].name.replace(/\.[^.]+$/, '').slice(0, NAME_MAX);
        setName(baseName);
      }
      return next;
    });
  };

  const removeFile = (index: number) => {
    setError(null);
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const openPicker = () => {
    if (atCapacity) return;
    inputRef.current?.click();
  };

  const canSubmit = files.length > 0 && name.trim().length > 0 && name.length <= NAME_MAX;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const trimmedName = name.trim();
    const subtitle =
      files.length === 1
        ? files[0].name
        : t('bookLibrary.addSubtitleMulti', {
            main: files[0].name,
            extra: files.length - 1,
          });
    const newBook: MockBook = {
      id: `mock-book-uploaded-${Date.now()}`,
      title: trimmedName,
      subtitle,
      coverGradient: 'from-violet-300 via-fuchsia-400 to-pink-400',
      coverEmoji: '📘',
      coverTint: '#a78bfa',
      subject: t('bookLibrary.uploadedSubject'),
      chapters: buildChaptersFromFiles(files, t),
    };
    onAdd(newBook);
  };

  // Pre-compute dropzone state class to avoid nested ternary in JSX.
  let dropzoneClass: string;
  if (atCapacity) {
    dropzoneClass = 'border-border/50 bg-muted/15 cursor-not-allowed';
  } else if (dragActive) {
    dropzoneClass =
      'border-violet-500 bg-violet-50/70 dark:bg-violet-950/30 cursor-pointer';
  } else {
    dropzoneClass =
      'border-border/60 bg-muted/15 hover:border-violet-300/80 hover:bg-violet-50/30 dark:hover:bg-violet-950/15 cursor-pointer';
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={PUBLISHER_BOOK_ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const fl = e.target.files;
          e.target.value = '';
          if (fl && fl.length > 0) acceptFiles(Array.from(fl));
        }}
      />

      {/* Dropzone — large in empty state, compact "+ add more" once a file is in */}
      {files.length === 0 ? (
        <button
          type="button"
          onClick={openPicker}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setDragActive(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            const fl = e.dataTransfer.files;
            if (fl && fl.length > 0) acceptFiles(Array.from(fl));
          }}
          className={cn(
            'w-full min-h-[150px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2.5 px-4 transition-all',
            dropzoneClass,
          )}
        >
          <div className="size-12 rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-200 dark:from-violet-900/40 dark:to-fuchsia-800/30 flex items-center justify-center shadow-sm relative">
            <FileText className="size-6 text-violet-600 dark:text-violet-300" strokeWidth={2} />
          </div>
          <p className="text-[12px] text-foreground/85 text-center">
            {t('bookLibrary.addDropTitle')}
            <span className="text-violet-600 dark:text-violet-400 font-medium">
              {' '}
              {t('bookLibrary.dropTitleClick')}
            </span>
          </p>
          <p className="text-[10px] text-muted-foreground/75 text-center">
            {t('bookLibrary.addDropHint', {
              maxMb: PUBLISHER_MAX_BOOK_MB,
              max: ADD_BOOK_MAX_FILES,
            })}
          </p>
        </button>
      ) : (
        // Multi-file list view: main + supplementary attachments
        <div
          onDragEnter={(e) => {
            if (atCapacity) return;
            e.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(e) => {
            if (atCapacity) return;
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setDragActive(false);
          }}
          onDrop={(e) => {
            if (atCapacity) return;
            e.preventDefault();
            setDragActive(false);
            const fl = e.dataTransfer.files;
            if (fl && fl.length > 0) acceptFiles(Array.from(fl));
          }}
          className={cn(
            'rounded-xl border transition-colors',
            dragActive
              ? 'border-violet-500 bg-violet-50/40 dark:bg-violet-950/20'
              : 'border-border/55 bg-background/60',
          )}
        >
          <div className="px-3 py-2 flex items-center justify-between border-b border-border/40">
            <span className="text-[11px] font-medium text-foreground/80">
              {t('bookLibrary.addListTitle', {
                count: files.length,
                max: ADD_BOOK_MAX_FILES,
              })}
            </span>
            <button
              type="button"
              onClick={openPicker}
              disabled={atCapacity}
              className={cn(
                'inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-medium transition-colors',
                atCapacity
                  ? 'text-muted-foreground/50 cursor-not-allowed'
                  : 'text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30 cursor-pointer',
              )}
            >
              <Plus className="size-3" />
              {atCapacity
                ? t('bookLibrary.addMaxReached', { max: ADD_BOOK_MAX_FILES })
                : t('bookLibrary.addMoreFiles')}
            </button>
          </div>
          <ul className="divide-y divide-border/30">
            {files.map((f, i) => {
              const isMain = i === 0;
              const sizeMb = (f.size / (1024 * 1024)).toFixed(1);
              return (
                <li key={`${f.name}-${i}`}>
                  <div className="flex items-center gap-2 px-3 py-2">
                    <div
                      className={cn(
                        'size-7 rounded-lg flex items-center justify-center shrink-0',
                        isMain
                          ? 'bg-violet-100 dark:bg-violet-900/30'
                          : 'bg-muted/50 dark:bg-muted/40',
                      )}
                    >
                      <FileText
                        className={cn(
                          'size-3.5',
                          isMain
                            ? 'text-violet-600 dark:text-violet-300'
                            : 'text-muted-foreground/80',
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[12px] font-medium text-foreground/95 truncate">
                          {f.name}
                        </span>
                        <span className="text-[10px] tabular-nums text-muted-foreground/70 shrink-0">
                          {sizeMb} MB
                        </span>
                      </div>
                      <span
                        className={cn(
                          'inline-flex items-center mt-0.5 px-1.5 h-4 rounded text-[9.5px] font-medium',
                          isMain
                            ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/35 dark:text-violet-300'
                            : 'bg-muted/60 text-muted-foreground/85 dark:bg-muted/40',
                        )}
                      >
                        {isMain
                          ? t('bookLibrary.addRolePrimary')
                          : t('bookLibrary.addRoleAttachment', { index: i })}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      aria-label={t('home.publisher.clearFile')}
                      className="size-7 inline-flex items-center justify-center rounded-full text-muted-foreground/65 hover:bg-foreground/8 hover:text-foreground transition-colors shrink-0 cursor-pointer"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="px-3 py-1.5 text-[10px] text-muted-foreground/70 border-t border-border/30">
            {t('bookLibrary.addRoleHint')}
          </p>
        </div>
      )}

      {error && <p className="text-[11px] text-rose-600 dark:text-rose-400 px-1">{error}</p>}

      <div className="flex items-start gap-2.5">
        <label
          htmlFor="book-name-input"
          className="text-[11px] font-medium text-foreground/75 mt-2 shrink-0"
        >
          {t('bookLibrary.bookName')}
        </label>
        <div className="flex-1 relative">
          <input
            id="book-name-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
            placeholder={t('bookLibrary.bookNamePlaceholder')}
            maxLength={NAME_MAX}
            className="w-full h-8 px-3 pr-12 rounded-lg border border-border/60 bg-muted/15 text-[12px] placeholder:text-muted-foreground/50 focus:outline-none focus:bg-background focus:border-violet-400/70 focus:ring-2 focus:ring-violet-400/20 transition-all"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground/60">
            {name.length}/{NAME_MAX}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="h-8 px-3.5 rounded-lg text-[12px] font-medium border border-border/60 bg-background hover:bg-muted/40 transition-colors"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={cn(
            'h-8 px-4 rounded-lg text-[12px] font-medium transition-all',
            canSubmit
              ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white hover:opacity-90 shadow-sm cursor-pointer'
              : 'bg-muted text-muted-foreground/45 cursor-not-allowed',
          )}
        >
          {t('common.confirm')}
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Step 3 — chapter selection
// ──────────────────────────────────────────────────────────────────

function ChapterStep({
  book,
  selected,
  onToggle,
  onSelectAll,
}: {
  book: MockBook;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
}) {
  const { t } = useI18n();
  const allSelected = book.chapters.every((c) => selected.has(c.id));

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground/80">{t('bookLibrary.chapterHint')}</p>
        <button
          type="button"
          onClick={onSelectAll}
          className="text-[11px] font-medium text-violet-600 dark:text-violet-400 hover:underline"
        >
          {allSelected ? t('bookLibrary.deselectAll') : t('bookLibrary.selectAll')}
        </button>
      </div>

      <ul className="rounded-xl border border-border/50 divide-y divide-border/30 overflow-hidden">
        {book.chapters.map((ch) => {
          const isChecked = selected.has(ch.id);
          return (
            <li key={ch.id}>
              <button
                type="button"
                onClick={() => onToggle(ch.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                  isChecked ? 'bg-violet-50/60 dark:bg-violet-950/25' : 'hover:bg-muted/30',
                )}
              >
                <Checkbox checked={isChecked} className="shrink-0 pointer-events-none" />
                <span className="flex-1 min-w-0 text-[12px] text-foreground/90 truncate">
                  {ch.title}
                </span>
                {ch.pages ? (
                  <span className="text-[10px] tabular-nums text-muted-foreground/70 shrink-0">
                    {t('bookLibrary.chapterPages', { count: ch.pages })}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ChapterFooter({
  count,
  onCancel,
  onConfirm,
  disabled,
}: {
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
  disabled: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="px-4 py-2.5 flex items-center justify-between border-t border-border/50 bg-gradient-to-b from-transparent to-violet-50/30 dark:to-violet-950/15">
      <span className="text-[11px] text-muted-foreground/85">
        {t('bookLibrary.selectedCount', { count })}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-8 px-3.5 rounded-lg text-[12px] font-medium border border-border/60 bg-background hover:bg-muted/40 transition-colors"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={disabled}
          className={cn(
            'h-8 px-4 rounded-lg text-[12px] font-medium transition-all inline-flex items-center gap-1.5',
            disabled
              ? 'bg-muted text-muted-foreground/45 cursor-not-allowed'
              : 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white hover:opacity-90 shadow-sm cursor-pointer',
          )}
        >
          <Upload className="size-3.5 -ml-0.5 opacity-90" />
          {t('bookLibrary.confirmAndGenerate')}
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Attachments tab — drop zone + chip list + try-demo CTA
// ──────────────────────────────────────────────────────────────────

function AttachmentsStep({
  attachments,
  onAddFiles,
  onRemove,
  onLoadDemo,
}: Readonly<{
  attachments: PublisherAttachmentEntry[];
  onAddFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  onLoadDemo?: () => void;
}>) {
  const { t } = useI18n();
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const remaining = Math.max(0, ATTACHMENTS_MAX - attachments.length);
  const atCapacity = remaining === 0;

  const handlePick = () => {
    if (atCapacity) return;
    inputRef.current?.click();
  };

  // Pre-compute the dropzone state classes — avoids a nested ternary in JSX.
  let dropzoneStateClass: string;
  if (atCapacity) {
    dropzoneStateClass = 'border-border/50 bg-muted/15 cursor-not-allowed';
  } else if (dragActive) {
    dropzoneStateClass =
      'border-violet-500 bg-violet-50/70 dark:bg-violet-950/30 cursor-pointer';
  } else {
    dropzoneStateClass =
      'border-border/60 bg-muted/10 hover:border-violet-300/80 hover:bg-violet-50/30 dark:hover:bg-violet-950/15 cursor-pointer';
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={PUBLISHER_BOOK_ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const fl = e.target.files;
          e.target.value = '';
          if (fl && fl.length > 0) onAddFiles(Array.from(fl));
        }}
      />

      <button
        type="button"
        onClick={handlePick}
        onDragEnter={(e) => {
          if (atCapacity) return;
          e.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(e) => {
          if (atCapacity) return;
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragActive(false);
        }}
        onDrop={(e) => {
          if (atCapacity) return;
          e.preventDefault();
          setDragActive(false);
          const fl = e.dataTransfer.files;
          if (fl && fl.length > 0) onAddFiles(Array.from(fl));
        }}
        disabled={atCapacity}
        className={cn(
          'w-full min-h-[112px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 px-4 py-3 transition-all',
          dropzoneStateClass,
        )}
      >
        <div className="size-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
          <Upload className="size-4 text-violet-600 dark:text-violet-300" />
        </div>
        <p className="text-[12px] text-foreground/85 text-center">
          {atCapacity
            ? t('bookLibrary.attachmentsAtCapacity', { max: ATTACHMENTS_MAX })
            : t('bookLibrary.attachmentsDropTitle')}
        </p>
        {!atCapacity && (
          <p className="text-[10px] text-muted-foreground/75 text-center">
            {t('bookLibrary.attachmentsDropHint', {
              maxMb: PUBLISHER_MAX_BOOK_MB,
              remaining,
            })}
          </p>
        )}
      </button>

      {/* Demo CTA — only shown when nothing uploaded yet */}
      {attachments.length === 0 && onLoadDemo && (
        <button
          type="button"
          onClick={onLoadDemo}
          className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-lg border border-violet-200/70 dark:border-violet-800/50 bg-violet-50/70 dark:bg-violet-950/25 text-[12px] text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/35 transition-colors cursor-pointer"
        >
          <Sparkles className="size-3.5" />
          {t('bookLibrary.attachmentsTryDemo')}
        </button>
      )}

      {/* Uploaded chip list */}
      {attachments.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-medium text-foreground/75">
              {t('bookLibrary.attachmentsListTitle', {
                count: attachments.length,
                max: ATTACHMENTS_MAX,
              })}
            </span>
          </div>
          <ul className="rounded-xl border border-border/50 divide-y divide-border/30 overflow-hidden bg-background/60">
            {attachments.map((a) => {
              const sizeMb = (a.file.size / (1024 * 1024)).toFixed(1);
              const isReady = a.phase === 'ready';
              const isParsing = a.phase !== 'idle' && a.phase !== 'ready';
              let StatusIcon: typeof Check;
              let statusIconClass: string;
              if (isReady) {
                StatusIcon = Check;
                statusIconClass = 'size-3.5 text-emerald-600 shrink-0';
              } else if (isParsing) {
                StatusIcon = Loader2;
                statusIconClass = 'size-3.5 text-violet-600 animate-spin shrink-0';
              } else {
                StatusIcon = Paperclip;
                statusIconClass = 'size-3.5 text-violet-600 shrink-0';
              }
              const progress = attachmentProgress(a.phase);
              return (
                <li key={a.id}>
                  <div className="flex items-center gap-2 px-3 py-2">
                    <div
                      className={cn(
                        'size-7 rounded-lg flex items-center justify-center shrink-0',
                        isReady
                          ? 'bg-emerald-100/70 dark:bg-emerald-900/30'
                          : 'bg-violet-100/70 dark:bg-violet-900/30',
                      )}
                    >
                      <StatusIcon className={statusIconClass} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[12px] font-medium text-foreground/95 truncate">
                          {a.file.name}
                        </span>
                        <span className="text-[10px] tabular-nums text-muted-foreground/70 shrink-0">
                          {sizeMb} MB
                        </span>
                      </div>
                      {isParsing ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Progress value={progress} className="h-1 flex-1" />
                          <span className="text-[10px] tabular-nums text-violet-700 dark:text-violet-300 shrink-0">
                            {progress}%
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                          {isReady && a.detectedCategories.length > 0 && (
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-300">
                              {t('bookLibrary.attachmentReadyHint', {
                                count: a.mockChunks.length,
                              })}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onRemove(a.id)}
                          aria-label={t('home.publisher.clearFile')}
                          className="size-7 inline-flex items-center justify-center rounded-full text-muted-foreground/65 hover:bg-foreground/8 hover:text-foreground transition-colors shrink-0 cursor-pointer"
                        >
                          <X className="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-[11px]">
                        {t('home.publisher.clearFile')}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
