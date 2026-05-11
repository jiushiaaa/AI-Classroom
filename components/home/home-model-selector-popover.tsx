'use client';

import { useMemo, useState } from 'react';
import { Bot, Check } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSettingsStore } from '@/lib/store/settings';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';
import {
  getHomeYuntiLabelForSelection,
  HOME_YUNTI_QUICK_MODELS,
} from '@/lib/home/home-yunti-quick-models';

/**
 * Home hero toolbar: icon-only trigger (tooltip shows current model) + quick list
 * (Yunti-plus / Yunti-pro), mapped via {@link HOME_YUNTI_QUICK_MODELS}.
 */
export function HomeModelSelectorPopover() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const providerId = useSettingsStore((s) => s.providerId);
  const modelId = useSettingsStore((s) => s.modelId);
  const setModel = useSettingsStore((s) => s.setModel);

  const triggerLabel = useMemo(
    () =>
      getHomeYuntiLabelForSelection(providerId, modelId) ?? t('settings.models'),
    [providerId, modelId, t],
  );

  const triggerAriaLabel = useMemo(
    () => `${t('settings.selectModel')}，${triggerLabel}`,
    [t, triggerLabel],
  );

  return (
    <Tooltip>
      <Popover open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={triggerAriaLabel}
              className={cn(
                'relative inline-flex items-center justify-center rounded-full border size-8 shrink-0 transition-all cursor-pointer',
                'bg-white border-border/60 text-muted-foreground/70 hover:bg-muted/40 hover:text-foreground',
              )}
            >
              <Bot className="size-3.5" aria-hidden />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <PopoverContent
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            '!p-1 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden',
            'rounded-xl border border-border/60 shadow-lg bg-popover',
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-muted-foreground">
            {t('settings.selectModel')}
          </p>
          <div
            className="flex flex-col gap-0.5 p-0.5"
            role="radiogroup"
            aria-label={t('settings.selectModel')}
          >
            {HOME_YUNTI_QUICK_MODELS.map((row) => {
              const selected = providerId === row.providerId && modelId === row.modelId;
              return (
                <button
                  key={row.label}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-lg px-2.5 py-2.5 text-left text-sm transition-colors',
                    selected
                      ? 'bg-primary/10 text-foreground'
                      : 'text-foreground hover:bg-muted/60',
                  )}
                  onClick={() => {
                    setModel(row.providerId, row.modelId);
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className="block font-medium leading-tight">{row.label}</span>
                    <span
                      className="block min-w-0 text-[11px] leading-snug text-muted-foreground truncate whitespace-nowrap"
                      title={t(row.taglineKey)}
                    >
                      {t(row.taglineKey)}
                    </span>
                  </span>
                  {selected ? (
                    <Check className="size-4 shrink-0 text-primary mt-0.5" aria-hidden />
                  ) : (
                    <span className="size-4 shrink-0 mt-0.5" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      <TooltipContent side="top" sideOffset={4} className="text-xs max-w-[16rem]">
        {triggerLabel}
      </TooltipContent>
    </Tooltip>
  );
}
