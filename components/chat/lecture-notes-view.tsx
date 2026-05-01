'use client';

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type FocusEvent as ReactFocusEvent,
} from 'react';
import {
  BookOpen,
  MessageSquare,
  Flashlight,
  MousePointer2,
  Play,
  Check,
  Pencil,
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import type { LectureNoteEntry } from '@/lib/types/chat';
import { AIPolishMenu, type PolishOption } from './ai-polish-menu';

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
}

export function LectureNotesView({
  notes,
  currentSceneId,
  onEditSpeech,
}: LectureNotesViewProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const editable = !!onEditSpeech;

  // Auto-scroll to the current scene note
  useEffect(() => {
    if (!currentSceneId || !containerRef.current) return;
    const el = containerRef.current.querySelector(`[data-scene-id="${currentSceneId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentSceneId]);

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

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 scrollbar-hide"
    >
      {notes.map((note, index) => {
        const isCurrent = note.sceneId === currentSceneId;
        const pageNum = index + 1;
        const pageLabel = t('chat.lectureNotes.pageLabel', { n: pageNum });

        return (
          <div
            key={note.sceneId}
            data-scene-id={note.sceneId}
            className={cn(
              'relative mb-3 last:mb-0 rounded-lg px-3 py-2.5 transition-colors duration-200',
              isCurrent
                ? 'bg-purple-50/80 dark:bg-purple-950/25 ring-1 ring-purple-200/60 dark:ring-purple-700/30'
                : 'bg-gray-50/50 dark:bg-gray-800/30',
            )}
          >
            {/* Page label row */}
            <div className="flex items-center gap-2 mb-1.5">
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
                  'text-[10px] font-semibold tracking-wide',
                  isCurrent
                    ? 'text-purple-600 dark:text-purple-400'
                    : 'text-gray-400 dark:text-gray-500',
                )}
              >
                {pageLabel}
              </span>
              {isCurrent && (
                <span className="text-[9px] font-bold px-1.5 py-px rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300">
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
                        editable={editable}
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
  );
}

/**
 * EditableSpeech — renders a speech sentence with inline action icons and an
 * optional inline edit affordance. Uses contentEditable for a lightweight
 * inline-edit experience: click anywhere in the sentence to start editing,
 * Enter or blur to save, Escape to cancel. After a successful edit the
 * sentence shows a persistent "✓ TTS 已同步" badge confirming the publisher's
 * change has been re-synthesised on the next playback.
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
      setPolishState(null);
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
        editable &&
          '-mx-1 px-1 py-0.5 rounded-md transition-colors hover:bg-gray-100/60 dark:hover:bg-gray-800/40',
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
            'outline-none rounded px-0.5 cursor-text whitespace-pre-wrap',
            isEditing
              ? 'bg-purple-50 dark:bg-purple-900/30 ring-1 ring-purple-300/70 dark:ring-purple-600/50 shadow-sm'
              : 'hover:bg-purple-50/60 dark:hover:bg-purple-900/20',
          )}
        >
          {text}
        </span>
      ) : (
        <span>{text}</span>
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

      {/* Pencil button — click to enter edit mode (also visible on hover before first edit) */}
      {editable && !isEditing && !userEditedAt && (
        <button
          type="button"
          aria-label={editHintLabel}
          title={editHintLabel}
          onMouseDown={(e) => {
            // Prevent the button from stealing focus before we can move it to
            // the editable span on click.
            e.preventDefault();
          }}
          onClick={(e) => {
            e.stopPropagation();
            const el = spanRef.current;
            if (!el) return;
            el.focus();
            // Place caret at the end of the existing text for a natural edit start.
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            const sel = globalThis.getSelection();
            if (sel) {
              sel.removeAllRanges();
              sel.addRange(range);
            }
          }}
          className="ml-1 inline-flex items-center justify-center align-middle p-0.5 rounded opacity-0 group-hover/speech:opacity-70 hover:!opacity-100 hover:bg-purple-100/70 dark:hover:bg-purple-900/30 hover:text-purple-600 dark:hover:text-purple-300 text-gray-400 dark:text-gray-500 transition-all cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-400 focus-visible:opacity-100"
        >
          <Pencil className="w-3 h-3" />
        </button>
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
