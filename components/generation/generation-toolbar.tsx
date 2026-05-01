'use client';

import { Globe2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface GenerationToolbarProps {
  webSearch: boolean;
  onWebSearchChange: (v: boolean) => void;
}

/** Publisher home: web search toggle only (book upload lives in the main drop zone). */
export function GenerationToolbar({ webSearch, onWebSearchChange }: GenerationToolbarProps) {
  const { t } = useI18n();

  const globeBtnBase =
    'inline-flex items-center justify-center rounded-full border size-8 shrink-0 transition-all cursor-pointer';
  const globeOff = `${globeBtnBase} bg-white border-border/60 text-muted-foreground/70 hover:bg-muted/40 hover:text-foreground`;
  const globeOn = `${globeBtnBase} border-violet-400/70 bg-violet-100 dark:bg-violet-900/35 text-violet-700 dark:text-violet-300`;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-pressed={webSearch}
            aria-label={t('toolbar.webSearchAria')}
            onClick={() => onWebSearchChange(!webSearch)}
            className={webSearch ? globeOn : globeOff}
          >
            <Globe2 className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4} className="px-2.5 py-1 text-[11px] font-medium">
          {t('toolbar.webSearchTooltipTitle')}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
