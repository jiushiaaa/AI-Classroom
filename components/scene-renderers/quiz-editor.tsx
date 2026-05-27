'use client';

/**
 * QuizEditor
 * ----------
 * Inline editor for quiz scenes used while the publisher is in edit mode.
 * Renders each question with:
 *   - read-only question type badge
 *   - contentEditable question text
 *   - per-option contentEditable label
 *   - drag handles for option ordering
 *   - a radio per option that toggles the correct answer
 *   - delete-option / add-option buttons
 *
 * Edits are persisted back through `useStageStore.updateScene` so reloading
 * or exiting edit mode shows the new content. We avoid touching grading
 * state here — that lives in the playback-only QuizView.
 *
 * Mock-only: no AI / scoring side-effects.
 */

import { useCallback, useMemo, useState, type DragEvent } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStageStore } from '@/lib/store';
import { useI18n } from '@/lib/hooks/use-i18n';
import { QUIZ_OPTION_LETTERS, reorderQuizOptions } from '@/lib/quiz/editor';
import type { QuizQuestion, QuizOption, QuizContent } from '@/lib/types/stage';

interface QuizEditorProps {
  readonly sceneId: string;
  readonly questions: QuizQuestion[];
}

export function QuizEditor({ sceneId, questions }: QuizEditorProps) {
  const { t } = useI18n();
  const updateScene = useStageStore.use.updateScene();
  const scenes = useStageStore.use.scenes();
  const [draggingOption, setDraggingOption] = useState<{
    questionId: string;
    index: number;
  } | null>(null);

  const scene = useMemo(() => scenes.find((s) => s.id === sceneId), [scenes, sceneId]);

  /** Persist a mutated questions array back into the store. */
  const persistQuestions = useCallback(
    (next: QuizQuestion[]) => {
      if (!scene || scene.content.type !== 'quiz') return;
      const nextContent: QuizContent = { ...scene.content, questions: next };
      updateScene(sceneId, { content: nextContent, updatedAt: Date.now() });
    },
    [scene, sceneId, updateScene],
  );

  const updateQuestion = useCallback(
    (qid: string, patch: Partial<QuizQuestion>) => {
      const next = questions.map((q) => (q.id === qid ? { ...q, ...patch } : q));
      persistQuestions(next);
    },
    [questions, persistQuestions],
  );

  const updateOption = useCallback(
    (qid: string, idx: number, label: string) => {
      const target = questions.find((q) => q.id === qid);
      if (!target?.options) return;
      const nextOptions = target.options.map((o, i) => (i === idx ? { ...o, label } : o));
      updateQuestion(qid, { options: nextOptions });
    },
    [questions, updateQuestion],
  );

  const toggleCorrect = useCallback(
    (qid: string, optionValue: string) => {
      const target = questions.find((q) => q.id === qid);
      if (!target) return;
      if (target.type === 'multiple') {
        const set = new Set(target.answer ?? []);
        if (set.has(optionValue)) set.delete(optionValue);
        else set.add(optionValue);
        updateQuestion(qid, { answer: Array.from(set) });
      } else {
        updateQuestion(qid, { answer: [optionValue] });
      }
    },
    [questions, updateQuestion],
  );

  const addOption = useCallback(
    (qid: string) => {
      const target = questions.find((q) => q.id === qid);
      if (!target) return;
      const existing = target.options ?? [];
      if (existing.length >= QUIZ_OPTION_LETTERS.length) return;
      const nextLetter = QUIZ_OPTION_LETTERS[existing.length];
      const nextOption: QuizOption = {
        label: t('editMode.quiz.newOptionLabel'),
        value: nextLetter,
      };
      updateQuestion(qid, { options: [...existing, nextOption] });
    },
    [questions, updateQuestion, t],
  );

  const moveOption = useCallback(
    (qid: string, fromIndex: number, toIndex: number) => {
      const target = questions.find((q) => q.id === qid);
      if (!target?.options) return;
      const { options: nextOptions, answer: nextAnswer } = reorderQuizOptions(
        target.options,
        target.answer,
        fromIndex,
        toIndex,
      );
      updateQuestion(qid, { options: nextOptions, answer: nextAnswer });
    },
    [questions, updateQuestion],
  );

  const handleOptionDragStart = useCallback(
    (event: DragEvent<HTMLButtonElement>, questionId: string, index: number) => {
      setDraggingOption({ questionId, index });
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', `${questionId}:${index}`);
    },
    [],
  );

  const handleOptionDrop = useCallback(
    (event: DragEvent<HTMLDivElement>, questionId: string, index: number) => {
      event.preventDefault();
      const source = draggingOption;
      setDraggingOption(null);
      if (!source || source.questionId !== questionId) return;
      moveOption(questionId, source.index, index);
    },
    [draggingOption, moveOption],
  );

  const removeOption = useCallback(
    (qid: string, idx: number) => {
      const target = questions.find((q) => q.id === qid);
      if (!target?.options) return;
      // Don't let the publisher orphan the question — keep at least 2.
      if (target.options.length <= 2) return;
      const removedValue = target.options[idx]?.value;
      const nextOptions = target.options.filter((_, i) => i !== idx);
      const nextAnswer = (target.answer ?? []).filter((v) => v !== removedValue);
      updateQuestion(qid, { options: nextOptions, answer: nextAnswer });
    },
    [questions, updateQuestion],
  );

  return (
    <div className="w-full h-full overflow-y-auto p-6 lg:p-10 bg-gradient-to-br from-orange-50/50 to-amber-50/40 dark:from-orange-950/20 dark:to-amber-950/10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-xs uppercase tracking-wider font-semibold text-orange-500 dark:text-orange-400 inline-flex items-center gap-1.5 px-2 py-1 rounded bg-orange-100/60 dark:bg-orange-900/30">
          {t('editMode.quiz.editorBadge')}
        </div>

        {questions.map((q, qIndex) => (
          <div
            key={q.id}
            className="rounded-2xl bg-white dark:bg-gray-900 ring-1 ring-orange-200/60 dark:ring-orange-700/30 shadow-sm p-5"
          >
            <div className="flex items-start gap-3 mb-3">
              <span className="shrink-0 w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold">
                {qIndex + 1}
              </span>
              <span
                role="textbox"
                tabIndex={0}
                aria-label={t('editMode.quiz.questionAriaLabel')}
                contentEditable
                suppressContentEditableWarning
                spellCheck={false}
                onBlur={(e) => {
                  const text = e.currentTarget.textContent?.trim() ?? '';
                  if (text !== q.question) updateQuestion(q.id, { question: text });
                }}
                className="flex-1 text-sm leading-relaxed font-semibold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-orange-400/50 focus:bg-orange-50/50 dark:focus:bg-orange-900/20 rounded px-1 -mx-1 cursor-text"
              >
                {q.question}
              </span>
              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-500 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700">
                {t(`editMode.quiz.questionType.${q.type}`)}
              </span>
            </div>

            {q.options && q.options.length > 0 && (
              <div className="space-y-2 mt-4">
                {q.options.map((opt, idx) => {
                  const isCorrect = (q.answer ?? []).includes(opt.value);
                  return (
                    <div
                      key={`${q.id}-${idx}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(e) => handleOptionDrop(e, q.id, idx)}
                      className={cn(
                        'group flex items-center gap-2 rounded-lg p-2 ring-1 transition-colors',
                        draggingOption?.questionId === q.id &&
                          draggingOption.index === idx &&
                          'opacity-50',
                        isCorrect
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 ring-emerald-200 dark:ring-emerald-700/40'
                          : 'bg-gray-50/60 dark:bg-gray-800/40 ring-gray-200/60 dark:ring-gray-700/40',
                      )}
                    >
                      <button
                        type="button"
                        draggable
                        onDragStart={(e) => handleOptionDragStart(e, q.id, idx)}
                        onDragEnd={() => setDraggingOption(null)}
                        title={t('editMode.quiz.dragOption')}
                        aria-label={t('editMode.quiz.dragOption')}
                        className="shrink-0 cursor-grab rounded p-0.5 text-gray-300 transition-colors active:cursor-grabbing hover:bg-gray-100 hover:text-gray-500 dark:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-400"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleCorrect(q.id, opt.value)}
                        className={cn(
                          'shrink-0 w-5 h-5 rounded-full ring-1 flex items-center justify-center transition-all',
                          isCorrect
                            ? 'bg-emerald-500 ring-emerald-500 text-white shadow-sm shadow-emerald-300/50'
                            : 'bg-white dark:bg-gray-900 ring-gray-300 dark:ring-gray-600 hover:ring-emerald-400 dark:hover:ring-emerald-500',
                        )}
                        aria-label={t('editMode.quiz.toggleCorrect')}
                        aria-pressed={isCorrect}
                      >
                        {isCorrect && <span className="w-2 h-2 rounded-full bg-white" />}
                      </button>
                      <span className="shrink-0 text-[11px] font-bold text-gray-400 dark:text-gray-500 w-4">
                        {opt.value}
                      </span>
                      <span
                        role="textbox"
                        tabIndex={0}
                        aria-label={t('editMode.quiz.optionAriaLabel')}
                        contentEditable
                        suppressContentEditableWarning
                        spellCheck={false}
                        onBlur={(e) => {
                          const text = e.currentTarget.textContent?.trim() ?? '';
                          if (text !== opt.label) updateOption(q.id, idx, text);
                        }}
                        className="flex-1 text-sm text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-orange-400/50 focus:bg-orange-50/50 dark:focus:bg-orange-900/20 rounded px-1 cursor-text"
                      >
                        {opt.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeOption(q.id, idx)}
                        disabled={q.options!.length <= 2}
                        title={t('editMode.quiz.removeOption')}
                        aria-label={t('editMode.quiz.removeOption')}
                        className="shrink-0 w-6 h-6 rounded text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => addOption(q.id)}
                  disabled={(q.options?.length ?? 0) >= QUIZ_OPTION_LETTERS.length}
                  className="w-full flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-medium border border-dashed border-orange-200 dark:border-orange-700/50 text-orange-600 dark:text-orange-300 hover:border-orange-400 dark:hover:border-orange-500 hover:bg-orange-50/60 dark:hover:bg-orange-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t('editMode.quiz.addOption')}
                </button>
              </div>
            )}
          </div>
        ))}

        <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center pt-2">
          {t('editMode.quiz.editHint')}
        </p>
      </div>
    </div>
  );
}
