'use client';

import { useCallback, useState } from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { useEditModeStore } from '@/lib/store';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Explicit save for the publisher ToB flow — edit mode stays on; changes
 * are flushed to storage (and the edit-session snapshot baseline advances).
 */
export function EditModeSaveButton({
  variant = 'toolbar',
  className,
}: {
  readonly variant?: 'header' | 'toolbar';
  readonly className?: string;
}) {
  const { t } = useI18n();
  const saveEdits = useEditModeStore.use.saveEdits();
  const [pending, setPending] = useState(false);

  const onSave = useCallback(async () => {
    if (pending) return;
    setPending(true);
    try {
      await saveEdits();
      toast.success(t('editMode.savedToast'));
    } catch {
      toast.error(t('editMode.saveFailedToast'));
    } finally {
      setPending(false);
    }
  }, [pending, saveEdits, t]);

  const isHeader = variant === 'header';
  const sizeIcon = isHeader ? 'w-4 h-4' : 'w-3.5 h-3.5';

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={pending}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-all duration-150 active:scale-[0.98] cursor-pointer shrink-0',
              isHeader
                ? 'h-8 px-3 text-sm shadow-sm shadow-purple-500/15 bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60'
                : 'h-6 px-2 rounded-md text-[11px] bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60',
              className,
            )}
            aria-label={t('editMode.save')}
            data-testid="edit-mode-save"
          >
            <Save className={sizeIcon} strokeWidth={2.5} />
            <span>{t('editMode.save')}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[240px]">
          {t('editMode.saveTooltip')}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
