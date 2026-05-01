'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  Plus,
  Search,
  Upload,
  X,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';
import { MOCK_BOOKS, type MockBook, type MockBookChapter } from '@/lib/mock/book-library-mock';
import {
  PUBLISHER_BOOK_ACCEPT,
  PUBLISHER_MAX_BOOK_BYTES,
  PUBLISHER_MAX_BOOK_MB,
} from '@/lib/publisher/publisher-book-parse-mock';

type Step = 'library' | 'add' | 'chapter';

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
}

export function BookLibraryDialog({
  open,
  onOpenChange,
  onConfirm,
  initialSelection,
  children,
  side = 'top',
  align = 'start',
}: BookLibraryDialogProps) {
  const [step, setStep] = useState<Step>('library');
  const [search, setSearch] = useState('');
  const [extraBooks, setExtraBooks] = useState<MockBook[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setStep('library');
    setSearch('');
    if (initialSelection) {
      setSelectedBookId(initialSelection.bookId);
      setSelectedChapterIds(new Set(initialSelection.chapterIds));
    } else {
      setSelectedBookId(null);
      setSelectedChapterIds(new Set());
    }
  }, [open, initialSelection]);

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
          step={step}
          selectedBookTitle={selectedBook?.title}
          onClose={() => onOpenChange(false)}
          onBack={() => setStep('library')}
        />

        <div className="relative max-h-[min(70vh,460px)] overflow-y-auto">
          <AnimatePresence mode="wait">
            {step === 'library' && (
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

            {step === 'add' && (
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

            {step === 'chapter' && selectedBook && (
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
          </AnimatePresence>
        </div>

        {step === 'chapter' && selectedBook && (
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
// Header — context-aware (library / add / chapter)
// ──────────────────────────────────────────────────────────────────

function BookLibraryHeader({
  step,
  selectedBookTitle,
  onClose,
  onBack,
}: {
  step: Step;
  selectedBookTitle?: string;
  onClose: () => void;
  onBack: () => void;
}) {
  const { t } = useI18n();

  let titleNode: React.ReactNode;
  if (step === 'chapter' && selectedBookTitle) {
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
  } else if (step === 'add') {
    titleNode = <h2 className="text-[14px] font-semibold">{t('bookLibrary.addTitle')}</h2>;
  } else {
    titleNode = <h2 className="text-[14px] font-semibold">{t('bookLibrary.title')}</h2>;
  }

  return (
    <div className="px-4 py-3 flex items-center justify-between border-b border-border/50 bg-gradient-to-b from-violet-50/40 to-transparent dark:from-violet-950/20">
      <div className="min-w-0 flex items-center gap-2">
        {step !== 'library' && (
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
// Step 2 — add a new book (PDF + name)
// ──────────────────────────────────────────────────────────────────

function AddBookStep({
  onCancel,
  onAdd,
}: {
  onCancel: () => void;
  onAdd: (b: MockBook) => void;
}) {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const NAME_MAX = 100;

  const validateFile = (f: File): string | null => {
    if (f.size > PUBLISHER_MAX_BOOK_BYTES) {
      return t('upload.fileTooLargePublisher', { maxMb: PUBLISHER_MAX_BOOK_MB });
    }
    return null;
  };

  const acceptFile = (f: File | null) => {
    setError(null);
    if (!f) return;
    const err = validateFile(f);
    if (err) {
      setError(err);
      return;
    }
    setFile(f);
    if (!name.trim()) {
      const baseName = f.name.replace(/\.[^.]+$/, '').slice(0, NAME_MAX);
      setName(baseName);
    }
  };

  const canSubmit = !!file && name.trim().length > 0 && name.length <= NAME_MAX;

  const handleSubmit = () => {
    if (!canSubmit || !file) return;
    const trimmedName = name.trim();
    const newBook: MockBook = {
      id: `mock-book-uploaded-${Date.now()}`,
      title: trimmedName,
      subtitle: file.name,
      coverGradient: 'from-violet-300 via-fuchsia-400 to-pink-400',
      coverEmoji: '📘',
      coverTint: '#a78bfa',
      subject: t('bookLibrary.uploadedSubject'),
      chapters: Array.from({ length: 5 }, (_, i) => ({
        id: `ch-${i + 1}`,
        title: t('bookLibrary.placeholderChapter', { index: i + 1 }),
        pages: 6 + i,
      })),
    };
    onAdd(newBook);
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={PUBLISHER_BOOK_ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          acceptFile(f ?? null);
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
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
          const f = e.dataTransfer.files?.[0];
          acceptFile(f ?? null);
        }}
        className={cn(
          'w-full min-h-[150px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2.5 px-4 transition-all',
          dragActive
            ? 'border-violet-500 bg-violet-50/70 dark:bg-violet-950/30'
            : 'border-border/60 bg-muted/15 hover:border-violet-300/80 hover:bg-violet-50/30 dark:hover:bg-violet-950/15',
        )}
      >
        {file ? (
          <>
            <div className="size-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <FileText className="size-6 text-emerald-600 dark:text-emerald-300" />
            </div>
            <div className="text-center">
              <p className="text-[12px] font-semibold text-foreground truncate max-w-[260px] mx-auto">
                {file.name}
              </p>
              <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                {(file.size / (1024 * 1024)).toFixed(1)} MB ·{' '}
                <span className="text-violet-600 dark:text-violet-400">
                  {t('bookLibrary.changeFile')}
                </span>
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="size-12 rounded-2xl bg-gradient-to-br from-rose-100 to-rose-200 dark:from-rose-900/30 dark:to-rose-800/20 flex items-center justify-center shadow-sm relative">
              <FileText className="size-6 text-rose-600 dark:text-rose-300" strokeWidth={2} />
              <span className="absolute -bottom-1 -right-1 px-1 py-0.5 rounded-md bg-rose-600 text-white text-[8px] font-bold tracking-wider shadow-sm">
                PDF
              </span>
            </div>
            <p className="text-[12px] text-foreground/85 text-center">
              {t('bookLibrary.dropTitle')}
              <span className="text-violet-600 dark:text-violet-400 font-medium">
                {' '}
                {t('bookLibrary.dropTitleClick')}
              </span>
            </p>
            <p className="text-[10px] text-muted-foreground/75">
              {t('bookLibrary.dropHint', { maxMb: PUBLISHER_MAX_BOOK_MB })}
            </p>
          </>
        )}
      </button>

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
