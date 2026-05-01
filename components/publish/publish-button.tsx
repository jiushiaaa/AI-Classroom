'use client';

/**
 * PublishButton
 * -------------
 * Purple-gradient pill-style "发布" CTA in the editor's top-right region.
 * Opens the PublishDialog (classroom + bound book summary, then hand off to bookln).
 *
 * Disabled state mirrors the existing `canExport` heuristic from Header so
 * that publish parity is enforced — if the classroom isn't ready to export it
 * shouldn't be ready to publish either.
 */

import { useState } from 'react';
import { Rocket } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';
import { PublishDialog } from './publish-dialog';

interface PublishButtonProps {
  readonly disabled?: boolean;
  readonly disabledReason?: string;
}

export function PublishButton({ disabled = false, disabledReason }: PublishButtonProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!disabled) setOpen(true);
        }}
        disabled={disabled}
        title={disabled ? (disabledReason ?? t('publish.disabledReason')) : t('publish.buttonTooltip')}
        aria-label={t('publish.buttonLabel')}
        data-testid="publish-button"
        className={cn(
          'shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-sm font-semibold',
          'transition-all duration-150',
          disabled
            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            : [
                'bg-gradient-to-br from-purple-500 via-violet-500 to-fuchsia-500 text-white',
                'shadow-md shadow-purple-500/25 ring-1 ring-white/30',
                'hover:shadow-lg hover:shadow-purple-500/40 hover:from-purple-600 hover:via-violet-600 hover:to-fuchsia-600',
                'active:scale-[0.97]',
              ].join(' '),
        )}
      >
        <Rocket className="w-4 h-4" />
        <span>{t('publish.buttonLabel')}</span>
      </button>
      <PublishDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
