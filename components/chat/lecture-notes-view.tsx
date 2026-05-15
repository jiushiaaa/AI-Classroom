'use client';

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  BookOpen,
  MessageSquare,
  Flashlight,
  MousePointer2,
  Play,
  Check,
  Pencil,
  Sparkles,
  Mic2,
  Trash2,
  Loader2,
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import type { LectureNoteEntry } from '@/lib/types/chat';
import { AIPolishMenu, type PolishOption } from './ai-polish-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const ACTION_ICON_ONLY: Record<string, { Icon: typeof Flashlight; style: string }> = {
  spotlight: {
    Icon: Flashlight,
    style:
      'bg-yellow-50 dark:bg-yellow-500/15 border-yellow-300/40 dark:border-yellow-500/30 text-yellow-700 dark:text-yellow-300',
  },
  laser: {
    Icon: MousePointer2,
    style:
      'bg-red-50 dark:bg-red-500/15 border-red-300/40 dark:border-red-500/30 text-red-600 dark:text-red-300',
  },
  play_video: {
    Icon: Play,
    style:
      'bg-yellow-50 dark:bg-yellow-500/15 border-yellow-300/40 dark:border-yellow-500/30 text-yellow-700 dark:text-yellow-300',
  },
};

interface LectureNotesViewProps {
  notes: LectureNoteEntry[];
  currentSceneId?: string | null;
  /**
   * Called when the publisher edits a speech sentence and confirms the
   * change (blur or Enter without Shift). When omitted, speech text renders
   * as read-only.
   */
  onEditSpeech?: (sceneId: string, actionId: string, newText: string) => void;
  /**
   * AI optimize: generate or adjust the first speech line for that scene (e.g. from slide text).
   * Optional `userInstructions` guides how notes / teacher wording should change; when omitted,
   * the host derives content from the current page alone.
   * Shown as an icon on each card; when omitted, the control is hidden.
   */
  onAiGenerateScene?: (sceneId: string, userInstructions?: string) => void;
  onUploadTeacherVoice?: (sceneId: string, file: File) => Promise<void> | void;
  onRemoveTeacherVoice?: (sceneId: string) => Promise<void> | void;
  /** Card click jumps global current scene (scroll alone does not call this). */
  onSelectScene?: (sceneId: string) => void;
}

export function LectureNotesView({
  notes,
  currentSceneId,
  onEditSpeech,
  onAiGenerateScene,
  onUploadTeacherVoice,
  onRemoveTeacherVoice,
  onSelectScene,
}: LectureNotesViewProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const editable = !!onEditSpeech;
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [aiOptimizeTarget, setAiOptimizeTarget] = useState<{
    sceneId: string;
    sceneTitle: string;
  } | null>(null);
  const [aiOptimizeInstructions, setAiOptimizeInstructions] = useState('');
  const [uploadingVoiceSceneId, setUploadingVoiceSceneId] = useState<string | null>(null);

  useEffect(() => {
    if (editingSceneId && !notes.some((n) => n.sceneId === editingSceneId)) {
      setEditingSceneId(null);
    }
  }, [notes, editingSceneId]);

  // Auto-scroll to the current scene note
  useEffect(() => {
    if (!currentSceneId || !containerRef.current) return;
    const el = containerRef.current.querySelector(`[data-scene-id="${currentSceneId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentSceneId]);

  /** After unlocking a card’s script edit, show the field as active: focus first line. */
  useEffect(() => {
    if (!editingSceneId || !containerRef.current) return;
    const card = containerRef.current.querySelector(`[data-scene-id="${editingSceneId}"]`);
    const firstEditable = card?.querySelector('span[contenteditable="true"]');
    if (!(firstEditable instanceof HTMLElement)) return;
    const run = () => {
      firstEditable.focus();
      const sel = globalThis.getSelection();
      if (!sel) return;
      try {
        const range = document.createRange();
        range.selectNodeContents(firstEditable);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      } catch {
        /* ignore selection errors in edge browsers */
      }
    };
    requestAnimationFrame(run);
  }, [editingSceneId]);

  const handleNoteCardClick = (sceneId: string, e: ReactMouseEvent<HTMLDivElement>) => {
    if (!onSelectScene) return;
    const raw = e.target;
    const el =
      raw instanceof Element
        ? raw
        : raw instanceof Node && raw.parentNode instanceof Element
          ? raw.parentNode
          : null;
    if (!el) return;
    if (el.closest('span[contenteditable="true"]')) return;
    if (el.closest('button')) return;
    onSelectScene(sceneId);
  };

  // Empty state
  if (notes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6">
        <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 rounded-2xl flex items-center justify-center mb-3 text-purple-300 dark:text-purple-600 ring-1 ring-purple-100 dark:ring-purple-800/30">
          <BookOpen className="w-6 h-6" />
        </div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {t('chat.lectureNotes.empty')}
        </p>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
          {t('chat.lectureNotes.emptyHint')}
        </p>
      </div>
    );
  }

  const closeAiOptimizeDialog = () => {
    setAiOptimizeTarget(null);
    setAiOptimizeInstructions('');
  };

  const handleAiOptimizeConfirm = () => {
    if (!aiOptimizeTarget) return;
    const trimmed = aiOptimizeInstructions.trim();
    onAiGenerateScene?.(aiOptimizeTarget.sceneId, trimmed.length > 0 ? trimmed : undefined);
    closeAiOptimizeDialog();
  };

  return (
    <>
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 scrollbar-hide"
      >
      {notes.map((note, index) => {
        const isCurrent = note.sceneId === currentSceneId;
        const pageNum = index + 1;
        const pageLabel = t('chat.lectureNotes.pageLabel', { n: pageNum });

        const showHeaderActions = Boolean(onAiGenerateScene || onEditSpeech);
        const firstSpeech = note.items.find((item) => item.kind === 'speech');
        const hasPublisherVoice =
          firstSpeech?.kind === 'speech' && Boolean(firstSpeech.publisherVoiceUploadedAt);
        const speechUnlocked = editable && editingSceneId === note.sceneId;

        return (
          <div
            key={note.sceneId}
            data-scene-id={note.sceneId}
            onClick={(e) => handleNoteCardClick(note.sceneId, e)}
            onKeyDown={
              onSelectScene
                ? (e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    const ae = document.activeElement;
                    if (
                      ae instanceof Element &&
                      e.currentTarget.contains(ae) &&
                      ae.closest('span[contenteditable="true"]')
                    ) {
                      return;
                    }
                    e.preventDefault();
                    onSelectScene(note.sceneId);
                  }
                : undefined
            }
            tabIndex={onSelectScene ? 0 : undefined}
            aria-label={
              onSelectScene
                ? t('chat.lectureNotes.goToSlideCard', {
                    n: pageNum,
                    title: note.sceneTitle,
                  })
                : undefined
            }
            className={cn(
              'group/card relative mb-3 last:mb-0 rounded-lg px-3 py-2.5 transition-colors duration-200',
              isCurrent
                ? 'bg-purple-50/80 dark:bg-purple-950/25 ring-1 ring-purple-200/60 dark:ring-purple-700/30'
                : 'bg-gray-50/50 dark:bg-gray-800/30',
              onSelectScene &&
                'cursor-pointer hover:bg-gray-100/90 dark:hover:bg-gray-800/55 hover:ring-1 hover:ring-gray-200/70 dark:hover:ring-gray-600/40',
            )}
          >
            {/* Page label row */}
            <div className="flex items-center gap-2 mb-1.5 min-w-0">
              {/* Timeline dot */}
              <div
                className={cn(
                  'w-2 h-2 rounded-full shrink-0',
                  isCurrent
                    ? 'bg-purple-500 dark:bg-purple-400 shadow-sm shadow-purple-400/40'
                    : 'bg-gray-300 dark:bg-gray-600',
                )}
              />
              <span
                className={cn(
                  'text-[10px] font-semibold tracking-wide min-w-0',
                  isCurrent
                    ? 'text-purple-600 dark:text-purple-400'
                    : 'text-gray-400 dark:text-gray-500',
                )}
              >
                {pageLabel}
              </span>
              {(showHeaderActions || onUploadTeacherVoice) && (
                <div
                  className={cn(
                    'flex items-center gap-0.5 shrink-0',
                    'opacity-0 pointer-events-none transition-opacity',
                    'group-hover/card:opacity-100 group-hover/card:pointer-events-auto',
                    'max-sm:opacity-100 max-sm:pointer-events-auto',
                  )}
                >
                  {onAiGenerateScene && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAiOptimizeInstructions('');
                        setAiOptimizeTarget({
                          sceneId: note.sceneId,
                          sceneTitle: note.sceneTitle,
                        });
                      }}
                      className="size-6 inline-flex items-center justify-center rounded-md text-muted-foreground/70 hover:bg-purple-100/80 dark:hover:bg-purple-900/35 hover:text-purple-600 dark:hover:text-purple-300 transition-colors"
                      title={t('chat.lectureNotes.aiGenerateIconTitle')}
                      aria-label={t('chat.lectureNotes.aiGenerateIconTitle')}
                    >
                      <Sparkles className="size-3.5" />
                    </button>
                  )}
                  {onEditSpeech && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSceneId((prev) =>
                          prev === note.sceneId ? null : note.sceneId,
                        );
                      }}
                      className={cn(
                        'size-6 inline-flex items-center justify-center rounded-md transition-colors',
                        speechUnlocked
                          ? 'text-purple-600 dark:text-purple-400 bg-purple-100/80 dark:bg-purple-900/40'
                          : 'text-muted-foreground/70 hover:bg-gray-200/80 dark:hover:bg-gray-700/60 hover:text-foreground',
                      )}
                      title={t('chat.lectureNotes.editPageScriptTitle')}
                      aria-label={t('chat.lectureNotes.editPageScriptTitle')}
                      aria-pressed={speechUnlocked}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  )}
                  {onUploadTeacherVoice && (
                    <label
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        'size-6 inline-flex items-center justify-center rounded-md transition-colors cursor-pointer',
                        hasPublisherVoice
                          ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-900/35'
                          : 'text-muted-foreground/70 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/35 hover:text-emerald-600 dark:hover:text-emerald-300',
                        uploadingVoiceSceneId === note.sceneId && 'pointer-events-none opacity-70',
                      )}
                      title={
                        hasPublisherVoice
                          ? `已上传真人老师人声：${firstSpeech?.kind === 'speech' ? firstSpeech.publisherVoiceName : ''}`
                          : '上传真人老师人声'
                      }
                      aria-label="上传真人老师人声"
                    >
                      {uploadingVoiceSceneId === note.sceneId ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Mic2 className="size-3.5" />
                      )}
                      <input
                        type="file"
                        accept="audio/*"
                        className="sr-only"
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          event.currentTarget.value = '';
                          if (!file) return;
                          setUploadingVoiceSceneId(note.sceneId);
                          try {
                            await onUploadTeacherVoice(note.sceneId, file);
                          } finally {
                            setUploadingVoiceSceneId(null);
                          }
                        }}
                      />
                    </label>
                  )}
                  {hasPublisherVoice && onRemoveTeacherVoice && (
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        setUploadingVoiceSceneId(note.sceneId);
                        try {
                          await onRemoveTeacherVoice(note.sceneId);
                        } finally {
                          setUploadingVoiceSceneId(null);
                        }
                      }}
                      className="size-6 inline-flex items-center justify-center rounded-md text-emerald-600/80 dark:text-emerald-400/80 hover:bg-red-100/80 dark:hover:bg-red-900/35 hover:text-red-600 dark:hover:text-red-300 transition-colors"
                      title="取消真人老师人声覆盖"
                      aria-label="取消真人老师人声覆盖"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              )}
              {isCurrent && (
                <span className="text-[9px] font-bold px-1.5 py-px rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 shrink-0">
                  {t('chat.lectureNotes.currentPage')}
                </span>
              )}
            </div>

            {/* Scene title */}
            <h4 className="text-[13px] font-bold text-gray-800 dark:text-gray-100 mb-1.5 leading-snug pl-4">
              {note.sceneTitle}
            </h4>

            {/* Ordered items: spotlight/laser inline at sentence start, discussion as card */}
            <div className="pl-4 space-y-1">
              {(() => {
                // Build render rows: group inline actions (spotlight/laser) with next speech,
                // but render discussion as its own block
                type Row =
                  | {
                      kind: 'speech';
                      inlineActions: string[];
                      text: string;
                      actionId: string;
                      userEditedAt?: number;
                    }
                  | { kind: 'discussion'; label?: string }
                  | { kind: 'trailing'; inlineActions: string[] };
                const rows: Row[] = [];
                let pendingInline: string[] = [];
                for (const item of note.items) {
                  if (item.kind === 'action' && item.type === 'discussion') {
                    if (pendingInline.length > 0) {
                      rows.push({
                        kind: 'trailing',
                        inlineActions: pendingInline,
                      });
                      pendingInline = [];
                    }
                    rows.push({ kind: 'discussion', label: item.label });
                  } else if (item.kind === 'action') {
                    pendingInline.push(item.type);
                  } else {
                    rows.push({
                      kind: 'speech',
                      inlineActions: pendingInline,
                      text: item.text,
                      actionId: item.actionId,
                      userEditedAt: item.userEditedAt,
                    });
                    pendingInline = [];
                  }
                }
                if (pendingInline.length > 0) {
                  rows.push({ kind: 'trailing', inlineActions: pendingInline });
                }
                if (rows.length === 0) {
                  return (
                    <p
                      key="empty"
                      className="text-[11px] text-gray-400 dark:text-gray-500 py-0.5 leading-relaxed"
                    >
                      {t('chat.lectureNotes.noScript')}
                    </p>
                  );
                }
                return rows.map((row, i) => {
                  if (row.kind === 'discussion') {
                    return (
                      <div
                        key={i}
                        className="my-1.5 flex items-start gap-1.5 rounded-md border border-amber-200/60 dark:border-amber-700/30 bg-amber-50/60 dark:bg-amber-900/10 px-2 py-1.5"
                      >
                        <MessageSquare className="w-3 h-3 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                        <span className="text-[11px] leading-snug text-amber-800 dark:text-amber-300">
                          {row.label}
                        </span>
                      </div>
                    );
                  }

                  if (row.kind === 'speech') {
                    return (
                      <EditableSpeech
                        key={`${row.actionId}-${i}`}
                        sceneId={note.sceneId}
                        actionId={row.actionId}
                        text={row.text}
                        userEditedAt={row.userEditedAt}
                        inlineActions={row.inlineActions}
                        editable={speechUnlocked}
                        onEditSpeech={onEditSpeech}
                        editHintLabel={t('chat.lectureNotes.editHint')}
                        ttsSyncedLabel={t('chat.lectureNotes.ttsSyncedBadge')}
                        ttsSyncedTitle={t('chat.lectureNotes.ttsSyncedBadgeTitle')}
                      />
                    );
                  }

                  // trailing — only inline action icons, no speech text
                  return (
                    <p
                      key={i}
                      className="text-[12px] leading-[1.8] text-gray-700 dark:text-gray-300"
                    >
                      {row.inlineActions.map((a, j) => {
                        const cfg = ACTION_ICON_ONLY[a];
                        if (!cfg) return null;
                        const { Icon, style } = cfg;
                        return (
                          <span
                            key={j}
                            className={cn(
                              'inline-flex items-center justify-center w-4 h-4 rounded-full border align-middle mr-0.5',
                              style,
                            )}
                          >
                            <Icon className="w-2.5 h-2.5" />
                          </span>
                        );
                      })}
                    </p>
                  );
                });
              })()}
            </div>
          </div>
        );
      })}
      </div>

      <Dialog
        open={aiOptimizeTarget !== null}
        onOpenChange={(open) => {
          if (!open) closeAiOptimizeDialog();
        }}
      >
        <DialogContent className="max-w-md gap-4 sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>{t('chat.lectureNotes.aiOptimizeDialogTitle')}</DialogTitle>
            <DialogDescription asChild>
              <div className="text-muted-foreground text-sm leading-relaxed">
                <p>{t('chat.lectureNotes.aiOptimizeDialogDescription')}</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label
              htmlFor="lecture-notes-ai-optimize-instructions"
              className="text-xs font-medium text-foreground"
            >
              {t('chat.lectureNotes.aiOptimizeDialogLabel')}
            </label>
            <Textarea
              id="lecture-notes-ai-optimize-instructions"
              value={aiOptimizeInstructions}
              onChange={(e) => setAiOptimizeInstructions(e.target.value)}
              placeholder={t('chat.lectureNotes.aiOptimizeDialogPlaceholder')}
              rows={4}
              className="min-h-[88px] resize-y text-sm"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeAiOptimizeDialog}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={handleAiOptimizeConfirm}>
              {t('chat.lectureNotes.aiOptimizeDialogSubmit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * EditableSpeech — speech line with inline action icons. When `editable` is
 * true (page edit mode unlocked from the card header), the text is
 * contentEditable; otherwise it is read-only.
 */
interface EditableSpeechProps {
  readonly sceneId: string;
  readonly actionId: string;
  readonly text: string;
  readonly userEditedAt?: number;
  readonly inlineActions: string[];
  readonly editable: boolean;
  readonly onEditSpeech?: (sceneId: string, actionId: string, newText: string) => void;
  readonly editHintLabel: string;
  readonly ttsSyncedLabel: string;
  readonly ttsSyncedTitle: string;
}

function EditableSpeech({
  sceneId,
  actionId,
  text,
  userEditedAt,
  inlineActions,
  editable,
  onEditSpeech,
  editHintLabel,
  ttsSyncedLabel,
  ttsSyncedTitle,
}: EditableSpeechProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [polishState, setPolishState] = useState<{
    rect: DOMRect;
    text: string;
  } | null>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const suppressBlurRef = useRef(false);

  useEffect(() => {
    if (!editable) {
      queueMicrotask(() => {
        setIsEditing(false);
        setPolishState(null);
      });
      if (spanRef.current) {
        spanRef.current.textContent = text;
      }
    }
  }, [editable, text]);

  // Reset DOM content when the source text changes (e.g. another component
  // updated the action). Skip while the user is actively editing to avoid
  // clobbering in-progress changes.
  useEffect(() => {
    if (isEditing) return;
    if (spanRef.current && spanRef.current.textContent !== text) {
      spanRef.current.textContent = text;
    }
  }, [text, isEditing]);

  // Track selection while editing — only show the polish menu when the user
  // has highlighted a meaningful (non-empty, not whole-text-or-just-whitespace)
  // range that lives entirely inside our editable span.
  useEffect(() => {
    if (!isEditing) {
      queueMicrotask(() => setPolishState(null));
      return;
    }

    const handleSelection = () => {
      const sel = globalThis.getSelection();
      const span = spanRef.current;
      if (!sel || sel.rangeCount === 0 || !span) {
        setPolishState(null);
        return;
      }
      const range = sel.getRangeAt(0);
      // Selection must be fully inside the editable span.
      if (!span.contains(range.startContainer) || !span.contains(range.endContainer)) {
        setPolishState(null);
        return;
      }
      const selected = sel.toString();
      const trimmed = selected.trim();
      if (!trimmed || trimmed.length < 2) {
        setPolishState(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      // Empty rect ⇒ collapsed selection.
      if (rect.width === 0 && rect.height === 0) {
        setPolishState(null);
        return;
      }
      setPolishState({ rect, text: selected });
    };

    document.addEventListener('selectionchange', handleSelection);
    return () => {
      document.removeEventListener('selectionchange', handleSelection);
    };
  }, [isEditing]);

  const commitEdit = (next: string) => {
    const trimmed = next.trim();
    if (!trimmed || trimmed === text) {
      // No change — restore original text in the DOM in case whitespace was
      // edited.
      if (spanRef.current) spanRef.current.textContent = text;
      return;
    }
    onEditSpeech?.(sceneId, actionId, trimmed);
  };

  const handleBlur = (e: ReactFocusEvent<HTMLSpanElement>) => {
    if (suppressBlurRef.current) {
      suppressBlurRef.current = false;
      // Re-focus the span on next tick so the polish menu can keep operating.
      const el = spanRef.current;
      if (el) {
        setTimeout(() => el.focus(), 0);
      }
      return;
    }
    setIsEditing(false);
    commitEdit(e.currentTarget.textContent ?? '');
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLSpanElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (polishState) {
        setPolishState(null);
        return;
      }
      if (spanRef.current) spanRef.current.textContent = text;
      e.currentTarget.blur();
    }
  };

  const handlePolishApply = (rewritten: string, _option: PolishOption) => {
    const sel = globalThis.getSelection();
    const span = spanRef.current;
    if (!sel || sel.rangeCount === 0 || !span) {
      setPolishState(null);
      return;
    }
    const range = sel.getRangeAt(0);
    if (!span.contains(range.startContainer) || !span.contains(range.endContainer)) {
      setPolishState(null);
      return;
    }
    range.deleteContents();
    range.insertNode(document.createTextNode(rewritten));
    sel.removeAllRanges();
    setPolishState(null);
    // Commit the new full text and exit edit mode.
    setIsEditing(false);
    commitEdit(span.textContent ?? '');
    span.blur();
  };

  return (
    <p
      className={cn(
        'group/speech text-[12px] leading-[1.8] text-gray-700 dark:text-gray-300 relative',
        editable && '-mx-1 px-1 py-0.5 rounded-md transition-colors',
      )}
    >
      {/* Inline action icons */}
      {inlineActions.map((a, j) => {
        const cfg = ACTION_ICON_ONLY[a];
        if (!cfg) return null;
        const { Icon, style } = cfg;
        return (
          <span
            key={j}
            className={cn(
              'inline-flex items-center justify-center w-4 h-4 rounded-full border align-middle mr-0.5',
              style,
            )}
          >
            <Icon className="w-2.5 h-2.5" />
          </span>
        );
      })}

      {editable ? (
        <span
          ref={spanRef}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          role="textbox"
          aria-label={editHintLabel}
          tabIndex={0}
          onFocus={() => setIsEditing(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={cn(
            'outline-none cursor-text whitespace-pre-wrap rounded-md px-1.5 py-0.5 transition-colors duration-150',
            'inline-block max-w-full align-top',
            /* 解锁可编：极淡底 + 细灰紫边，避免换行「每行一个粗框」 */
            'border border-violet-200/35 dark:border-violet-800/25 bg-violet-50/25 dark:bg-violet-950/15',
            isEditing &&
              'border-violet-300/55 dark:border-violet-600/35 bg-white/95 dark:bg-zinc-900/45',
          )}
        >
          {text}
        </span>
      ) : (
        <span className="select-text">{text}</span>
      )}

      {/* TTS synced badge — persistent across reloads once edited */}
      {userEditedAt && !isEditing && (
        <span
          title={ttsSyncedTitle}
          className="ml-1 inline-flex items-center gap-0.5 align-middle px-1.5 py-px rounded-full bg-purple-100/90 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 text-[9px] font-semibold ring-1 ring-purple-200/70 dark:ring-purple-700/40 select-none"
        >
          <Check className="w-2.5 h-2.5 shrink-0" strokeWidth={3} />
          <span>{ttsSyncedLabel}</span>
        </span>
      )}

      <AnimatePresence>
        {polishState && (
          <AIPolishMenu
            key="polish"
            anchorRect={polishState.rect}
            selectedText={polishState.text}
            onApply={handlePolishApply}
            onCancel={() => setPolishState(null)}
          />
        )}
      </AnimatePresence>
    </p>
  );
}
