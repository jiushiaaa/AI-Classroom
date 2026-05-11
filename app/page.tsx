'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { ArrowUp, ChevronRight, Loader2, Plus, Upload } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { createLogger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { GenerationConfigPopover } from '@/components/generation/generation-config-popover';
import { AgentBar } from '@/components/agent/agent-bar';
import {
  MY_COURSES_MOCK,
  getMyCourseMockVisual,
  isPublisherMockCourse,
} from '@/lib/mock/my-courses-mock';
import { OPENMAIC_DEMO_CLASSROOM_ID } from '@/lib/mock/openmaic-demo-classroom';
import {
  StageListItem,
  listStages,
  deleteStageData,
  renameStage,
  getFirstSlideByStages,
} from '@/lib/utils/stage-storage';
import type { Slide } from '@/lib/types/slides';
import { useMediaGenerationStore } from '@/lib/store/media-generation';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDraftCache } from '@/lib/hooks/use-draft-cache';
import { SpeechButton } from '@/components/audio/speech-button';
import { DISCOVER_COURSES } from '@/lib/mock/discover-courses';
import { sortMyCourses } from '@/lib/publisher/my-course-classification';
import {
  PUBLISHER_MAX_BOOK_BYTES,
  PUBLISHER_MAX_BOOK_MB,
  type PublisherAttachmentEntry,
  type PublisherKnowledgeChunkPreview,
  runPublisherParseMock,
  inferMockCategories,
  buildMockKnowledgeChunks,
} from '@/lib/publisher/publisher-book-parse-mock';
import {
  BookLibraryDialog,
  type BookLibrarySelection,
} from '@/components/publisher/book-library-dialog';
import { ClassroomCard } from '@/components/publisher/classroom-card';
import { ReferenceBackgroundLibraryDialog } from '@/components/publisher/reference-background-library-dialog';
import { REFERENCE_BACKGROUND_SESSION_KEY } from '@/lib/constants/reference-background';
import { loadReferenceBackgroundTemplates } from '@/lib/utils/reference-background-library-storage';

const log = createLogger('Home');

interface FormState {
  requirement: string;
  interactiveMode: boolean;
}

const initialFormState: FormState = {
  requirement: '',
  interactiveMode: false,
};

/**
 * One attachment entry. The first added file is conceptually the "main book"
 * but the pipeline treats every entry as an independent knowledge source so
 * users can also upload N standalone handouts (e.g. 5 考研 lecture PDFs).
 *
 * Re-exports the shared shape from publisher-book-parse-mock so the upload
 * hub popover and this page consume the same type.
 */
type AttachmentEntry = PublisherAttachmentEntry;

const INTERACTIVE_MODE_STORAGE_KEY = 'pubInteractiveMode';

function makeAttachmentId(file: File): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${file.name}`;
}

function HomePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialFormState);

  // Draft cache for requirement text
  const { cachedValue: cachedRequirement, updateCache: updateRequirementCache } =
    useDraftCache<string>({ key: 'requirementDraft' });

  // Hydrate client-only state after mount (avoids SSR mismatch)
  /* eslint-disable react-hooks/set-state-in-effect -- Hydration from localStorage must happen in effect */
  useEffect(() => {
    try {
      const savedInteractive = localStorage.getItem(INTERACTIVE_MODE_STORAGE_KEY);
      if (savedInteractive === 'true') {
        setForm((prev) => ({ ...prev, interactiveMode: true }));
      }
    } catch {
      /* localStorage unavailable */
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Restore requirement draft from cache (derived state pattern — no effect needed)
  const [prevCachedRequirement, setPrevCachedRequirement] = useState(cachedRequirement);
  if (cachedRequirement !== prevCachedRequirement) {
    setPrevCachedRequirement(cachedRequirement);
    if (cachedRequirement) {
      setForm((prev) => ({ ...prev, requirement: cachedRequirement }));
    }
  }

  const [error, setError] = useState<string | null>(null);
  const [classrooms, setClassrooms] = useState<StageListItem[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, Slide>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const requirementTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [referenceBgLibOpen, setReferenceBgLibOpen] = useState(false);
  const [referenceLibCount, setReferenceLibCount] = useState(0);
  /** Picked template for this run (persisted templates live in localStorage). */
  const [referenceSession, setReferenceSession] = useState<{ id: string; dataUrl: string } | null>(
    null,
  );

  const refreshReferenceLibCount = useCallback(() => {
    setReferenceLibCount(loadReferenceBackgroundTemplates().length);
  }, []);

  useEffect(() => {
    refreshReferenceLibCount();
  }, [refreshReferenceLibCount]);

  /** Multi-file upload state — supports book + multiple supplementary attachments. */
  const [attachments, setAttachments] = useState<AttachmentEntry[]>([]);
  /** Per-attachment AbortControllers so removing a file cancels its mock parse. */
  const parseControllersRef = useRef<Map<string, AbortController>>(new Map());
  const [dropActive, setDropActive] = useState(false);

  const [bookLibraryOpen, setBookLibraryOpen] = useState(false);
  const [bookLibraryInitialTab, setBookLibraryInitialTab] = useState<
    'library' | 'attachments'
  >('library');
  const [bookSelection, setBookSelection] = useState<BookLibrarySelection | null>(null);

  /** Programmatic opener for the unified upload hub — chooses initial tab. */
  const openUploadHub = (tab: 'library' | 'attachments') => {
    setBookLibraryInitialTab(tab);
    setBookLibraryOpen(true);
  };

  const loadClassrooms = async () => {
    try {
      const list = await listStages();
      const realIds = new Set(list.map((c) => c.id));
      const mocks = MY_COURSES_MOCK.filter((m) => !realIds.has(m.id));
      const merged = [...mocks, ...list];
      setClassrooms(merged);
      // Load first slide thumbnails (mock ids have no slides — placeholder only)
      if (list.length > 0) {
        const slides = await getFirstSlideByStages(list.map((c) => c.id));
        setThumbnails(slides);
      }
    } catch (err) {
      log.error('Failed to load classrooms:', err);
    }
  };

  useEffect(() => {
    // Clear stale media store to prevent cross-course thumbnail contamination.
    // The store may hold tasks from a previously visited classroom whose elementIds
    // (gen_img_1, etc.) collide with other courses' placeholders.
    useMediaGenerationStore.getState().revokeObjectUrls();
    useMediaGenerationStore.setState({ tasks: {} });

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Store hydration on mount
    loadClassrooms();
  }, []);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingDeleteId(id);
  };

  const confirmDelete = async (id: string) => {
    setPendingDeleteId(null);
    if (isPublisherMockCourse(id)) {
      setClassrooms((prev) => prev.filter((c) => c.id !== id));
      return;
    }
    try {
      await deleteStageData(id);
      await loadClassrooms();
    } catch (err) {
      log.error('Failed to delete classroom:', err);
      toast.error('Failed to delete classroom');
    }
  };

  const handleRename = async (id: string, newName: string) => {
    const touch = Date.now();
    if (isPublisherMockCourse(id)) {
      setClassrooms((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name: newName, updatedAt: touch } : c)),
      );
      return;
    }
    try {
      await renameStage(id, newName);
      setClassrooms((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name: newName, updatedAt: touch } : c)),
      );
    } catch (err) {
      log.error('Failed to rename classroom:', err);
      toast.error(t('classroom.renameFailed'));
    }
  };

  /** Home preview: latest 5 courses by recent update, no filters. */
  const previewMySpaceCourses = useMemo(() => {
    return sortMyCourses([...classrooms], 'updatedAtDesc').slice(0, 5);
  }, [classrooms]);

  /** Inspiration row: all mock courses, recently updated first. */
  const inspirationDiscoverCourses = useMemo(() => {
    return [...DISCOVER_COURSES].sort((a, b) => b.updatedAt - a.updatedAt);
  }, []);

  const updateForm = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    try {
      if (field === 'interactiveMode')
        localStorage.setItem(INTERACTIVE_MODE_STORAGE_KEY, String(value));
      if (field === 'requirement') updateRequirementCache(value as string);
    } catch {
      /* ignore */
    }
  };

  // Cancel all in-flight mock parses on unmount
  useEffect(() => {
    const controllers = parseControllersRef.current;
    return () => {
      controllers.forEach((ac) => ac.abort());
      controllers.clear();
    };
  }, []);

  const validateBookFile = (file: File): string | null => {
    if (file.size > PUBLISHER_MAX_BOOK_BYTES) {
      return t('upload.fileTooLargePublisher', { maxMb: PUBLISHER_MAX_BOOK_MB });
    }
    return null;
  };

  /**
   * Kicks off mock parse pipeline for a single attachment; updates per-id phase.
   * When `finalChunks` is set (demo seeds), those replace the generic filename-based chunks.
   */
  const startParseForAttachment = (
    id: string,
    file: File,
    finalChunks?: PublisherKnowledgeChunkPreview[],
  ) => {
    parseControllersRef.current.get(id)?.abort();
    const ac = new AbortController();
    parseControllersRef.current.set(id, ac);

    void (async () => {
      try {
        await runPublisherParseMock((phase) => {
          if (ac.signal.aborted) return;
          setAttachments((prev) =>
            prev.map((a) => (a.id === id ? { ...a, phase } : a)),
          );
        }, ac.signal);
        if (ac.signal.aborted) return;
        const chunks = finalChunks ?? buildMockKnowledgeChunks(file.name);
        setAttachments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, mockChunks: chunks } : a)),
        );
      } catch {
        /* aborted */
      }
    })();
  };

  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;
    setError(null);
    const newEntries: AttachmentEntry[] = [];
    let firstError: string | null = null;
    for (const file of incoming) {
      const err = validateBookFile(file);
      if (err) {
        firstError ??= err;
        continue;
      }
      newEntries.push({
        id: makeAttachmentId(file),
        file,
        phase: 'uploading',
        detectedCategories: inferMockCategories(file.name),
        mockChunks: [],
      });
    }
    if (firstError) setError(firstError);
    if (newEntries.length === 0) return;
    setAttachments((prev) => [...prev, ...newEntries]);
    for (const entry of newEntries) {
      startParseForAttachment(entry.id, entry.file);
    }
  };

  const removeAttachment = (id: string) => {
    parseControllersRef.current.get(id)?.abort();
    parseControllersRef.current.delete(id);
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  /**
   * Pure-frontend demo: any input (text / book selection / file) routes directly
   * to the bundled demo classroom. No backend / generation pipeline involved.
   */
  const handleGenerate = async () => {
    const hasText = form.requirement.trim().length > 0;
    const hasFiles = attachments.length > 0;
    const hasBookSelection = !!bookSelection && bookSelection.chapters.length > 0;

    if (!hasText && !hasFiles && !hasBookSelection) {
      setError(t('upload.requirementOrBook'));
      return;
    }

    setError(null);
    try {
      if (referenceSession?.dataUrl) {
        sessionStorage.setItem(
          REFERENCE_BACKGROUND_SESSION_KEY,
          JSON.stringify({ v: 1, dataUrl: referenceSession.dataUrl, templateId: referenceSession.id }),
        );
      } else {
        sessionStorage.removeItem(REFERENCE_BACKGROUND_SESSION_KEY);
      }
    } catch {
      /* sessionStorage unavailable */
    }
    router.push(`/classroom/${OPENMAIC_DEMO_CLASSROOM_ID}?mode=edit-preview`);
  };

  const canGenerate = useMemo(() => {
    const req = form.requirement.trim();
    const hasFiles = attachments.length > 0;
    const hasBookSelection = !!bookSelection && bookSelection.chapters.length > 0;
    return req.length > 0 || hasFiles || hasBookSelection;
  }, [attachments.length, form.requirement, bookSelection]);

  /** Single badge for the unified upload-hub button: chapters + attachments. */
  const hubBadgeCount = useMemo(() => {
    const ch = bookSelection?.chapters.length ?? 0;
    return ch + attachments.length;
  }, [bookSelection, attachments.length]);

  const anyAttachmentParsing = attachments.some(
    (a) => a.phase !== 'idle' && a.phase !== 'ready',
  );

  const parsingAttachmentCount = useMemo(
    () => attachments.filter((a) => a.phase !== 'idle' && a.phase !== 'ready').length,
    [attachments],
  );

  /** Lock generation config while at least one attachment is still parsing. */
  const generationConfigLocked = anyAttachmentParsing;

  const handleRequirementKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (canGenerate) void handleGenerate();
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex flex-col items-center p-4 pt-16 md:p-8 md:pt-16 overflow-x-hidden overflow-y-visible">
      {/* ═══ Background Decor ═══ */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: '4s' }}
        />
        <div
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: '6s' }}
        />
      </div>

      {/* ═══ Hero section: title + input (left-aligned with input card) ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={cn(
          'relative z-20 w-full max-w-[900px] flex flex-col items-stretch mt-[6vh] overflow-visible',
        )}
      >
        {/* ── Brand: text-only headline ── */}
        <motion.h1
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.1,
            type: 'spring',
            stiffness: 200,
            damping: 20,
          }}
          className="w-full max-w-[calc(100%-5.5rem)] sm:max-w-[calc(100%-6.5rem)] translate-y-12 text-left text-2xl md:text-3xl lg:text-[32px] font-semibold tracking-tight leading-snug mb-4 md:mb-0 text-zinc-900 dark:text-zinc-50"
        >
          {t('home.brand')}
        </motion.h1>

        {/* Mascot strip — text sits just above; feet land on input card after negative margin */}
        <div
          className="pointer-events-none relative z-[18] h-[136px] w-full sm:h-[132px] md:h-[168px] select-none"
          aria-hidden
        >
          <img
            src="/1.png"
            alt=""
            className="absolute right-1 bottom-0 h-full w-auto max-w-[min(42vw,128px)] sm:right-3 sm:max-w-[140px] md:max-w-[152px] -translate-y-20 sm:-translate-y-20 md:-translate-y-20 object-contain object-bottom drop-shadow-[0_12px_28px_rgba(0,0,0,0.16)] dark:drop-shadow-[0_12px_28px_rgba(0,0,0,0.5)]"
          />
        </div>

        {/* ── Publisher: upload + parse (task-first) ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35 }}
          className="relative z-10 -mt-[4.6rem] w-full overflow-visible sm:-mt-[5.1rem] md:-mt-[5.6rem]"
        >
          <div
            onDragEnter={(e) => {
              e.preventDefault();
              setDropActive(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDropActive(true);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget === e.target) setDropActive(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDropActive(false);
              const fileList = e.dataTransfer.files;
              if (!fileList || fileList.length === 0) return;
              addFiles(Array.from(fileList));
            }}
            className={cn(
              'relative w-full rounded-2xl border bg-white/85 dark:bg-slate-900/80 backdrop-blur-xl shadow-xl shadow-black/[0.03] dark:shadow-black/20 transition-all',
              dropActive
                ? 'border-violet-400/70 ring-2 ring-violet-400/30'
                : 'border-border/60 hover:border-border/80',
            )}
          >
            <div className="px-4 pb-2 pt-3 space-y-2">
              {/* Primary textarea — chat-style multi-line input */}
              <textarea
                ref={requirementTextareaRef}
                placeholder={t('upload.requirementPlaceholder')}
                className={cn(
                  'w-full resize-none bg-transparent border-0 px-1 py-1.5 text-[14px] leading-relaxed',
                  'placeholder:text-muted-foreground/45 placeholder:whitespace-pre-line',
                  'focus:outline-none focus:ring-0 min-h-[112px] max-h-[260px]',
                )}
                value={form.requirement}
                onChange={(e) => updateForm('requirement', e.target.value)}
                onKeyDown={handleRequirementKeyDown}
                rows={4}
              />
            </div>

            {/* Mini status row: visible while mock parse runs; opens upload hub on «我的附件». */}
            {anyAttachmentParsing && (
              <button
                type="button"
                onClick={() => openUploadHub('attachments')}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-left border-t border-violet-200/55 dark:border-violet-800/45',
                  'bg-violet-50/95 dark:bg-violet-950/40',
                  'hover:bg-violet-100 dark:hover:bg-violet-900/45 transition-colors cursor-pointer',
                )}
              >
                <Loader2
                  className="size-4 shrink-0 animate-spin text-violet-600 dark:text-violet-300"
                  aria-hidden
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-semibold text-violet-900 dark:text-violet-100">
                    {t('home.publisher.parsingMiniTitle')}
                  </span>
                  <span className="block text-[11px] text-violet-800/85 dark:text-violet-200/85 mt-0.5">
                    {t('home.publisher.parsingMiniHint', { count: parsingAttachmentCount })}
                  </span>
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-violet-500 dark:text-violet-400"
                  aria-hidden
                />
              </button>
            )}

            {/* ── Bottom toolbar ── */}
            <div className="px-3 pb-3 pt-1 flex items-center gap-1.5 border-t border-border/30">
              {/* Unified upload hub — single entry for both books and attachments.
                  Badge sums chapters + attachments so the user sees their total
                  ingested-content count at a glance. */}
              <Tooltip>
                <BookLibraryDialog
                  open={bookLibraryOpen}
                  onOpenChange={setBookLibraryOpen}
                  initialTab={bookLibraryInitialTab}
                  onConfirm={(sel) => {
                    setBookSelection(sel);
                    setError(null);
                  }}
                  initialSelection={
                    bookSelection
                      ? {
                          bookId: bookSelection.book.id,
                          chapterIds: bookSelection.chapters.map((c) => c.id),
                        }
                      : null
                  }
                  attachments={attachments}
                  onAddFiles={addFiles}
                  onRemoveAttachment={removeAttachment}
                  side="top"
                  align="start"
                >
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={t('bookLibrary.hubTrigger')}
                      onClick={() => setBookLibraryInitialTab('library')}
                      className={cn(
                        'relative inline-flex items-center justify-center rounded-full border size-8 shrink-0 transition-all cursor-pointer',
                        bookSelection || attachments.length > 0
                          ? 'border-violet-400/70 bg-violet-100 dark:bg-violet-900/35 text-violet-700 dark:text-violet-300'
                          : 'bg-white border-border/60 text-muted-foreground/70 hover:bg-muted/40 hover:text-foreground',
                      )}
                    >
                      <Upload className="size-3.5" />
                      {hubBadgeCount > 0 && (
                        <span
                          className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold bg-violet-600 text-white border border-white dark:border-slate-900 shadow-sm tabular-nums"
                          aria-hidden
                        >
                          {hubBadgeCount}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                </BookLibraryDialog>
                <TooltipContent side="top" sideOffset={4} className="max-w-[300px] text-xs">
                  <div className="font-medium">{t('bookLibrary.hubTrigger')}</div>
                  <div className="opacity-80 mt-0.5">
                    {hubBadgeCount === 0
                      ? t('bookLibrary.hubTriggerHint', { maxMb: PUBLISHER_MAX_BOOK_MB })
                      : t('bookLibrary.hubTriggerHintWithCount', {
                          chapters: bookSelection?.chapters.length ?? 0,
                          files: attachments.length,
                        })}
                  </div>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <ReferenceBackgroundLibraryDialog
                  open={referenceBgLibOpen}
                  onOpenChange={(o) => {
                    setReferenceBgLibOpen(o);
                    if (!o) refreshReferenceLibCount();
                  }}
                  sessionTemplateId={referenceSession?.id ?? null}
                  onSessionTemplateChange={(id, dataUrl) => {
                    if (id && dataUrl) setReferenceSession({ id, dataUrl });
                    else setReferenceSession(null);
                  }}
                  onLibraryMutation={refreshReferenceLibCount}
                  side="top"
                  align="start"
                >
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={t('home.referenceBg.hubTrigger')}
                      className={cn(
                        'relative inline-flex items-center justify-center rounded-full border size-8 shrink-0 transition-all cursor-pointer',
                        referenceSession
                          ? 'border-violet-400/70 bg-violet-100 dark:bg-violet-900/35 text-violet-700 dark:text-violet-300'
                          : 'bg-white border-border/60 text-muted-foreground/70 hover:bg-muted/40 hover:text-foreground',
                      )}
                    >
                      <Plus className="size-3.5" />
                      {referenceLibCount > 0 && (
                        <span
                          className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold bg-violet-600 text-white border border-white dark:border-slate-900 shadow-sm tabular-nums"
                          aria-hidden
                        >
                          {referenceLibCount > 99 ? '99+' : referenceLibCount}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                </ReferenceBackgroundLibraryDialog>
                <TooltipContent side="top" sideOffset={4} className="max-w-[280px] text-xs">
                  <div className="font-medium">{t('home.referenceBg.hubTrigger')}</div>
                  <div className="opacity-80 mt-0.5">{t('home.referenceBg.hubHint')}</div>
                </TooltipContent>
              </Tooltip>

              <AgentBar />

              <GenerationConfigPopover locked={generationConfigLocked} />

              <div className="flex-1" />

              <SpeechButton
                size="md"
                onTranscription={(text) => {
                  setForm((prev) => {
                    const next = prev.requirement + (prev.requirement ? ' ' : '') + text;
                    updateRequirementCache(next);
                    return { ...prev, requirement: next };
                  });
                }}
              />

              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={!canGenerate}
                className={cn(
                  'shrink-0 h-8 rounded-full flex items-center justify-center gap-1.5 transition-all px-3.5',
                  canGenerate
                    ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white hover:opacity-90 shadow-sm cursor-pointer'
                    : 'bg-muted text-muted-foreground/40 cursor-not-allowed',
                )}
              >
                <span className="text-xs font-medium">{t('toolbar.enterClassroom')}</span>
                <ArrowUp className="size-3.5" />
              </button>
            </div>

            {/* Soft drag overlay (only when actively dragging) */}
            <AnimatePresence>
              {dropActive && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 z-30 rounded-2xl bg-violet-500/8 dark:bg-violet-500/12 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2 pointer-events-none"
                >
                  <div className="size-12 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                    <Upload className="size-6 text-violet-600 dark:text-violet-300" />
                  </div>
                  <p className="text-[13px] font-semibold text-violet-700 dark:text-violet-300">
                    {t('home.publisher.dropTitle')}
                  </p>
                  <p className="text-[11px] text-violet-700/80 dark:text-violet-300/80">
                    {t('home.publisher.dropSub', { maxMb: PUBLISHER_MAX_BOOK_MB })}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ── Error ── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 w-full p-3 bg-destructive/10 border border-destructive/20 rounded-lg"
            >
              <p className="text-sm text-destructive">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>

      {/* ═══ Browse area: My space (5) + Inspiration discovery ═══ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="relative z-10 mt-12 w-full max-w-6xl flex flex-col gap-12 md:gap-14"
      >
        <section aria-labelledby="home-my-space-heading">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2
              id="home-my-space-heading"
              className="text-[17px] font-semibold tracking-tight text-foreground md:text-lg"
            >
              {t('home.tabs.myCourses')}
            </h2>
            <Link
              href="/my-space"
              className="inline-flex shrink-0 items-center gap-0.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('home.mySpace.viewMore')}
              <ChevronRight className="size-3.5 opacity-70" aria-hidden />
            </Link>
          </div>
          {previewMySpaceCourses.length === 0 ? (
            <div className="py-12 text-center text-[13px] text-muted-foreground/60">
              {t('home.myCoursesEmpty')}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 md:gap-5">
              {previewMySpaceCourses.map((classroom, i) => {
                const mockVis = isPublisherMockCourse(classroom.id)
                  ? getMyCourseMockVisual(classroom.id)
                  : undefined;
                return (
                  <motion.div
                    key={classroom.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: i * 0.04,
                      duration: 0.28,
                      ease: 'easeOut',
                    }}
                  >
                    <ClassroomCard
                      classroom={classroom}
                      slide={thumbnails[classroom.id]}
                      mockCover={
                        mockVis
                          ? {
                              gradient: mockVis.coverGradient,
                              emoji: mockVis.coverEmoji,
                            }
                          : undefined
                      }
                      onDelete={handleDelete}
                      onRename={handleRename}
                      confirmingDelete={pendingDeleteId === classroom.id}
                      onConfirmDelete={() => confirmDelete(classroom.id)}
                      onCancelDelete={() => setPendingDeleteId(null)}
                      onClick={() => {
                        if (isPublisherMockCourse(classroom.id)) {
                          router.push(
                            `/classroom/${OPENMAIC_DEMO_CLASSROOM_ID}?mode=edit-preview`,
                          );
                          return;
                        }
                        router.push(`/classroom/${classroom.id}?mode=edit-preview`);
                      }}
                    />
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        <section aria-labelledby="home-inspiration-heading">
          <h2
            id="home-inspiration-heading"
            className="mb-4 text-[17px] font-semibold tracking-tight text-foreground md:text-lg"
          >
            {t('home.tabs.discover')}
          </h2>
          <div className="grid grid-cols-2 gap-x-5 gap-y-7 md:grid-cols-3 lg:grid-cols-4">
            {inspirationDiscoverCourses.map((course, i) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: i * 0.025,
                  duration: 0.28,
                  ease: 'easeOut',
                }}
              >
                <DiscoverCard course={course} />
              </motion.div>
            ))}
          </div>
        </section>
      </motion.div>

      {/* Footer — flows with content, at the very end */}
      <div className="mt-auto pt-12 pb-4 text-center text-xs text-muted-foreground/40">
        云梯 AI 课堂 · 出版商工作台
      </div>
    </div>
  );
}

// ─── Discover Card — mock featured course ───────────────────────
function DiscoverCard({ course }: { course: import('@/lib/mock/discover-courses').DiscoverCourse }) {
  return (
    <div className="group cursor-pointer">
      <div
        className={cn(
          'relative w-full aspect-[16/9] rounded-2xl overflow-hidden transition-transform duration-200 group-hover:scale-[1.02]',
          'bg-gradient-to-br',
          course.coverGradient,
        )}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-6xl drop-shadow-sm select-none">{course.coverEmoji}</span>
        </div>
      </div>
      <div className="mt-2.5 px-1">
        <p className="font-medium text-[15px] leading-snug text-foreground/90 line-clamp-2">
          {course.title}
        </p>
      </div>
    </div>
  );
}

export default function Page() {
  return <HomePage />;
}
