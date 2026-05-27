'use client';

import { useCallback, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { useStageStore, useEditModeStore } from '@/lib/store';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { isManuallyEditableSceneType } from '@/lib/types/stage';

/**
 * Enter edit mode, then confirm (keep) or cancel (revert) changes.
 * Used in the stage header and optionally the bottom toolbar.
 */
export function EditModeToggleButton({
  variant = 'header',
  className,
}: {
  readonly variant?: 'header' | 'toolbar';
  readonly className?: string;
}) {
  const { t } = useI18n();
  const isEditing = useEditModeStore.use.isEditing();
  const setEditing = useEditModeStore.use.setEditing();
  const cancelEditingWithRevert = useEditModeStore.use.cancelEditingWithRevert();
  const [pendingCancel, setPendingCancel] = useState(false);

  const currentSceneType = useStageStore((s) => {
    const id = s.currentSceneId;
    return id ? s.scenes.find((sc) => sc.id === id)?.type : undefined;
  });
  // Slides support full inline editing; quizzes support a constrained editor.
  // Interactive widgets and PBL go through the AI-modify flow instead.
  const canEnterEdit = isManuallyEditableSceneType(currentSceneType);

  const onConfirm = useCallback(() => {
    setEditing(false);
  }, [setEditing]);

  const onCancel = useCallback(async () => {
    setPendingCancel(true);
    try {
      await cancelEditingWithRevert();
    } finally {
      setPendingCancel(false);
    }
  }, [cancelEditingWithRevert]);

  if (!canEnterEdit) return null;

  const isHeader = variant === 'header';
  const sizeIcon = isHeader ? 'w-4 h-4' : 'w-3.5 h-3.5';
  const enterBtnClass =
    'h-10 px-4 text-sm shadow-md shadow-purple-500/15 bg-gradient-to-r from-purple-600 to-violet-600 text-white hover:from-purple-700 hover:to-violet-700';
  const headerConfirmClass =
    'h-10 px-4 text-sm shadow-md shadow-purple-500/15 bg-violet-600 text-white ring-2 ring-violet-300/60 hover:bg-violet-700 disabled:opacity-60';
  const headerCancelClass =
    'h-10 px-4 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60';
  const toolbarEnterClass =
    'h-8 px-3 text-[11px] bg-gradient-to-r from-purple-600 to-violet-600 text-white hover:from-purple-700 hover:to-violet-700';
  const toolbarConfirmClass =
    'h-8 px-3 text-[11px] bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60';
  const toolbarCancelClass =
    'h-8 px-3 text-[11px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60';

  if (!isEditing) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-all duration-150 active:scale-[0.98] cursor-pointer shrink-0',
                isHeader ? enterBtnClass : toolbarEnterClass,
                className,
              )}
              aria-label={t('editMode.enter')}
              aria-pressed={false}
              data-testid="edit-mode-toggle"
            >
              <Pencil className={sizeIcon} strokeWidth={2.5} />
              <span>{t('editMode.enter')}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs max-w-[240px]">
            {t('editMode.enterTooltip')}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          'inline-flex items-center gap-2 shrink-0',
          variant === 'toolbar' && 'gap-1.5',
          className,
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onConfirm}
              disabled={pendingCancel}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-all duration-150 active:scale-[0.98] cursor-pointer',
                isHeader ? headerConfirmClass : toolbarConfirmClass,
              )}
              aria-label={t('editMode.confirmChanges')}
              data-testid="edit-mode-confirm"
            >
              <Check className={sizeIcon} strokeWidth={2.5} />
              <span>{t('editMode.confirmChanges')}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs max-w-[260px]">
            {t('editMode.confirmChangesTooltip')}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => void onCancel()}
              disabled={pendingCancel}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-all duration-150 active:scale-[0.98] cursor-pointer',
                isHeader ? headerCancelClass : toolbarCancelClass,
              )}
              aria-label={t('editMode.cancelChanges')}
              data-testid="edit-mode-cancel"
            >
              <X className={sizeIcon} strokeWidth={2.5} />
              <span>{t('editMode.cancelChanges')}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs max-w-[260px]">
            {t('editMode.cancelChangesTooltip')}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
