'use client';

/**
 * PublishButton
 * -------------
 * Editor-toolbar entry to the PublishDialog (book-link handoff).
 *
 * Two visual variants:
 *  - `icon` (default): minimalist square icon button matching the Download
 *    icon next to it — keeps the editor chrome calm so the eye lands on the
 *    canvas, with the verb "发布" surfaced via tooltip on hover.
 *  - `pill`: legacy purple-gradient CTA. Kept for fallback / future reuse so
 *    we can roll back the simplification by flipping a single prop.
 *
 * Disabled state mirrors the existing `canExport` heuristic from Header so
 * publish parity is enforced — if the classroom isn't ready to export it
 * shouldn't be ready to publish either.
 */

import { useState } from 'react';
import { Rocket } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';
import { PublishDialog } from './publish-dialog';

export type PublishButtonVariant = 'icon' | 'pill';

interface PublishButtonProps {
  readonly disabled?: boolean;
  readonly disabledReason?: string;
  /**
   * Visual treatment. Defaults to the compact icon button so it sits flush
   * with the Download icon in the editor header.
   */
  readonly variant?: PublishButtonVariant;
}

export function PublishButton({
  disabled = false,
  disabledReason,
  variant = 'icon',
}: PublishButtonProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const tooltip = disabled ? (disabledReason ?? t('publish.disabledReason')) : t('publish.buttonTooltip');

  const baseAttrs = {
    type: 'button' as const,
    onClick: () => {
      if (!disabled) setOpen(true);
    },
    disabled,
    title: tooltip,
    'aria-label': t('publish.buttonLabel'),
    'data-testid': 'publish-button',
  };

  return (
    <>
      {variant === 'pill' ? (
        <button
          {...baseAttrs}
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
      ) : (
        <button
          {...baseAttrs}
          className={cn(
            'shrink-0 p-2 rounded-full transition-all',
            disabled
              ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-50'
              : 'text-gray-400 dark:text-gray-500 hover:bg-white dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 hover:shadow-sm',
          )}
        >
          <Rocket className="w-4 h-4" />
        </button>
      )}
      <PublishDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
