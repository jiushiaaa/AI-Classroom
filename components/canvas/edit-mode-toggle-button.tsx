'use client';

import { Pencil, Check } from 'lucide-react';
import { useStageStore, useEditModeStore } from '@/lib/store';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Prominent enter/exit edit control (used in the stage header and optionally
 * the bottom toolbar when the header is hidden, e.g. fullscreen presenting).
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
  const currentSceneType = useStageStore((s) => {
    const id = s.currentSceneId;
    return id ? s.scenes.find((sc) => sc.id === id)?.type : undefined;
  });
  const canEnterEdit =
    currentSceneType === 'slide' ||
    currentSceneType === 'quiz' ||
    currentSceneType === 'interactive' ||
    currentSceneType === 'pbl';

  if (!canEnterEdit) return null;

  const isHeader = variant === 'header';
  const sizeIcon = isHeader ? 'w-4 h-4' : 'w-3.5 h-3.5';
  const headerBtnClass = isEditing
    ? 'h-10 px-4 text-sm shadow-md shadow-purple-500/15 bg-violet-600 text-white ring-2 ring-violet-300/60 hover:bg-violet-700'
    : 'h-10 px-4 text-sm shadow-md shadow-purple-500/15 bg-gradient-to-r from-purple-600 to-violet-600 text-white hover:from-purple-700 hover:to-violet-700';
  const toolbarBtnClass = isEditing
    ? 'h-8 px-3 text-[11px] bg-violet-500/15 dark:bg-violet-400/15 text-violet-700 dark:text-violet-300 ring-1 ring-violet-300/50 dark:ring-violet-500/30'
    : 'h-8 px-3 text-[11px] bg-gradient-to-r from-purple-600 to-violet-600 text-white hover:from-purple-700 hover:to-violet-700';

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setEditing(!isEditing)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-all duration-150 active:scale-[0.98] cursor-pointer shrink-0',
              isHeader ? headerBtnClass : toolbarBtnClass,
              className,
            )}
            aria-label={isEditing ? t('editMode.exit') : t('editMode.enter')}
            aria-pressed={isEditing}
            data-testid="edit-mode-toggle"
          >
            {isEditing ? (
              <Check className={sizeIcon} strokeWidth={2.5} />
            ) : (
              <Pencil className={sizeIcon} strokeWidth={2.5} />
            )}
            <span>{isEditing ? t('editMode.exit') : t('editMode.enter')}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs max-w-[240px]">
          {isEditing ? t('editMode.exitTooltip') : t('editMode.enterTooltip')}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
