'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Sparkles,
  Wand2,
  FileText,
  Video,
  Gamepad2,
  Atom,
  ListChecks,
  GraduationCap,
  PencilRuler,
  Minus,
  Plus,
  Target,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';

const STORAGE_KEY = 'pubGenerationConfig';

export type GenerationItemId =
  | 'ppt'
  | 'video'
  | 'game'
  | 'simulation'
  | 'quiz'
  | 'pbl'
  | 'whiteboard';

interface GenerationItemDef {
  id: GenerationItemId;
  icon: LucideIcon;
  defaultEnabled: boolean;
  defaultCount: number;
  min: number;
  max: number;
  activeColor: string;
}

const ITEMS: GenerationItemDef[] = [
  {
    id: 'ppt',
    icon: FileText,
    defaultEnabled: true,
    defaultCount: 10,
    min: 1,
    max: 50,
    activeColor: 'text-violet-600 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/30',
  },
  {
    id: 'video',
    icon: Video,
    defaultEnabled: false,
    defaultCount: 3,
    min: 1,
    max: 20,
    activeColor: 'text-rose-600 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/30',
  },
  {
    id: 'game',
    icon: Gamepad2,
    defaultEnabled: false,
    defaultCount: 3,
    min: 1,
    max: 20,
    activeColor: 'text-emerald-600 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30',
  },
  {
    id: 'simulation',
    icon: Atom,
    defaultEnabled: false,
    defaultCount: 2,
    min: 1,
    max: 10,
    activeColor: 'text-cyan-600 dark:text-cyan-300 bg-cyan-100 dark:bg-cyan-900/30',
  },
  {
    id: 'quiz',
    icon: ListChecks,
    defaultEnabled: true,
    defaultCount: 10,
    min: 1,
    max: 50,
    activeColor: 'text-amber-600 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30',
  },
  {
    id: 'pbl',
    icon: GraduationCap,
    defaultEnabled: false,
    defaultCount: 1,
    min: 1,
    max: 5,
    activeColor: 'text-indigo-600 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/30',
  },
  {
    id: 'whiteboard',
    icon: PencilRuler,
    defaultEnabled: false,
    defaultCount: 2,
    min: 1,
    max: 10,
    activeColor: 'text-sky-600 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/30',
  },
];

export interface GenerationConfigState {
  autoMode: boolean;
  /** Target total scene/page count for the whole classroom. */
  totalPages: number;
  enabled: Record<GenerationItemId, boolean>;
  counts: Record<GenerationItemId, number>;
}

const TOTAL_PAGES_DEFAULT = 30;
const TOTAL_PAGES_MIN = 5;
const TOTAL_PAGES_MAX = 100;

function clampTotalPages(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : TOTAL_PAGES_DEFAULT;
  return Math.max(TOTAL_PAGES_MIN, Math.min(TOTAL_PAGES_MAX, Math.round(n)));
}

function getDefaultConfig(): GenerationConfigState {
  const enabled: Record<string, boolean> = {};
  const counts: Record<string, number> = {};
  for (const item of ITEMS) {
    enabled[item.id] = item.defaultEnabled;
    counts[item.id] = item.defaultCount;
  }
  return {
    autoMode: false,
    totalPages: TOTAL_PAGES_DEFAULT,
    enabled: enabled as GenerationConfigState['enabled'],
    counts: counts as GenerationConfigState['counts'],
  };
}

export function readPublisherGenerationConfig(): GenerationConfigState {
  const def = getDefaultConfig();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return def;
    const parsed = JSON.parse(raw) as Partial<GenerationConfigState>;
    return {
      autoMode: typeof parsed.autoMode === 'boolean' ? parsed.autoMode : def.autoMode,
      totalPages: clampTotalPages(parsed.totalPages),
      enabled: parsed.enabled ? { ...def.enabled, ...parsed.enabled } : def.enabled,
      counts: parsed.counts ? { ...def.counts, ...parsed.counts } : def.counts,
    };
  } catch {
    return def;
  }
}

function triggerClass(locked: boolean, autoMode: boolean, selectedCount: number) {
  if (locked) {
    return 'opacity-45 cursor-not-allowed border-border/50 text-muted-foreground';
  }
  if (autoMode) {
    return 'cursor-pointer bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-200 border-violet-500/80 shadow-[0_0_12px_rgba(124,58,237,0.2)]';
  }
  if (selectedCount > 0) {
    return 'cursor-pointer bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-400/70 shadow-[0_0_12px_rgba(124,58,237,0.25)]';
  }
  return 'cursor-pointer border-violet-300/60 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20';
}

export function GenerationConfigPopover({ locked = false }: { locked?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<GenerationConfigState>(() => getDefaultConfig());

  /* eslint-disable react-hooks/set-state-in-effect -- Hydration from localStorage */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<GenerationConfigState>;
      const def = getDefaultConfig();
      setConfig({
        autoMode: typeof parsed.autoMode === 'boolean' ? parsed.autoMode : def.autoMode,
        totalPages: clampTotalPages(parsed.totalPages),
        enabled: parsed.enabled ? { ...def.enabled, ...parsed.enabled } : def.enabled,
        counts: parsed.counts ? { ...def.counts, ...parsed.counts } : def.counts,
      });
    } catch {
      /* ignore */
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const persist = (next: GenerationConfigState) => {
    setConfig(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const toggle = (id: GenerationItemId, value: boolean) => {
    if (config.autoMode) return;
    persist({ ...config, enabled: { ...config.enabled, [id]: value } });
  };

  const setCount = (id: GenerationItemId, value: number) => {
    if (config.autoMode) return;
    const def = ITEMS.find((i) => i.id === id);
    if (!def) return;
    const clamped = Math.max(def.min, Math.min(def.max, Math.round(value || def.min)));
    persist({ ...config, counts: { ...config.counts, [id]: clamped } });
  };

  const setAutoMode = (nextAuto: boolean) => {
    persist({ ...config, autoMode: nextAuto });
  };

  const setTotalPages = (next: number) => {
    if (config.autoMode) return;
    persist({ ...config, totalPages: clampTotalPages(next) });
  };

  const selectedCount = ITEMS.filter((i) => config.enabled[i.id]).length;

  let tooltipText = t('toolbar.generationConfig.subtitle');
  if (locked) tooltipText = t('toolbar.generationConfig.lockedHint');
  else if (config.autoMode) tooltipText = t('toolbar.generationConfig.autoTooltip');

  return (
    <Popover
      open={open && !locked}
      onOpenChange={(v) => {
        if (locked) return;
        setOpen(v);
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <motion.button
              type="button"
              disabled={locked}
              whileTap={locked ? undefined : { scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              className={cn(
                'relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all select-none whitespace-nowrap border shrink-0 h-8',
                triggerClass(locked, config.autoMode, selectedCount),
              )}
            >
              <Sparkles className="size-3.5 relative z-10" />
              <span className="relative z-10">{t('toolbar.generationConfig.label')}</span>
              {config.autoMode ? (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-[22px] h-4 px-1 rounded-full text-[9px] font-bold tracking-wide bg-emerald-600 text-white">
                  {t('toolbar.generationConfig.autoBadge')}
                </span>
              ) : (
                selectedCount > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold bg-violet-600 text-white">
                    {selectedCount}
                  </span>
                )
              )}
            </motion.button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[260px]">
          {tooltipText}
        </TooltipContent>
      </Tooltip>

      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        collisionPadding={12}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          '!p-0 !gap-0 overflow-hidden bg-white dark:bg-slate-900',
          'w-[min(calc(100vw-2rem),560px)] rounded-2xl border border-border/60',
          'shadow-xl shadow-black/[0.06] dark:shadow-black/30 ring-1 ring-black/[0.03]',
          'max-h-[min(94dvh,820px)] flex flex-col',
        )}
      >
        <div className="relative px-5 pt-5 pb-3 border-b border-border/50 shrink-0 text-left space-y-1.5 pr-14">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            aria-label={t('common.close')}
          >
            <X className="size-4" />
          </button>
          <h2 className="text-base font-semibold pr-2">{t('toolbar.generationConfig.title')}</h2>
          <p className="text-[12px] leading-relaxed break-words text-muted-foreground">
            {config.autoMode
              ? t('toolbar.generationConfig.dialogIntroAuto')
              : t('toolbar.generationConfig.dialogIntroCustom')}
          </p>
        </div>

          {/* Mode switch — same style as pill tabs */}
          <div className="px-4 pt-3 shrink-0">
            <div className="flex rounded-xl bg-muted/45 p-1 gap-1">
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setAutoMode(true)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-[12px] font-medium transition-all',
                      config.autoMode
                        ? 'bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 shadow-sm ring-1 ring-border/40'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Wand2 className="size-3.5 shrink-0 opacity-80" />
                    <span className="text-center leading-tight break-words">
                      {t('toolbar.generationConfig.modeAuto')}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[280px] text-[12px] leading-relaxed">
                  {t('toolbar.generationConfig.modeAutoHint')}
                </TooltipContent>
              </Tooltip>
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setAutoMode(false)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-[12px] font-medium transition-all',
                      config.autoMode === false
                        ? 'bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 shadow-sm ring-1 ring-border/40'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Sparkles className="size-3.5 shrink-0 opacity-80" />
                    <span className="text-center leading-tight break-words">
                      {t('toolbar.generationConfig.modeCustom')}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[280px] text-[12px] leading-relaxed">
                  {t('toolbar.generationConfig.modeCustomHint')}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2.5">
            {config.autoMode ? (
              <div className="rounded-xl border border-violet-200/70 dark:border-violet-800/50 bg-violet-50/60 dark:bg-violet-950/25 px-4 py-5 flex flex-col items-center text-center gap-3">
                <div className="size-14 rounded-2xl bg-violet-600 text-white shadow-md flex items-center justify-center">
                  <Wand2 className="size-7" />
                </div>
                <p className="text-[13px] font-semibold text-foreground">
                  {t('toolbar.generationConfig.autoModeTitle')}
                </p>
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <p className="text-[12px] text-muted-foreground leading-relaxed max-w-sm cursor-help text-left">
                      {t('toolbar.generationConfig.autoModeDescShort')}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[min(calc(100vw-2rem),360px)] text-[12px] leading-relaxed">
                    {t('toolbar.generationConfig.autoModeDesc')}
                  </TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <div className="rounded-xl border border-border/50 bg-white dark:bg-slate-900/40 divide-y divide-border/40 overflow-hidden">
                {/* Total pages row — overall classroom scale target */}
                <div className="flex items-center gap-2.5 px-3 py-1.5 bg-gradient-to-r from-violet-50/60 to-transparent dark:from-violet-950/20">
                  <div className="shrink-0 size-8 rounded-lg flex items-center justify-center bg-violet-600 text-white shadow-sm">
                    <Target className="size-4" />
                  </div>
                  <Tooltip delayDuration={250}>
                    <TooltipTrigger asChild>
                      <div className="flex-1 min-w-0 cursor-help flex items-baseline gap-1.5 min-h-[28px]">
                        <p className="text-[13px] font-semibold text-foreground leading-snug shrink-0">
                          {t('toolbar.generationConfig.totalPagesLabel')}
                        </p>
                        <p className="text-[11px] text-muted-foreground/85 leading-relaxed truncate hidden sm:inline">
                          {t('toolbar.generationConfig.totalPagesDesc')}
                        </p>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      align="start"
                      className="max-w-[min(calc(100vw-2rem),320px)] z-[100] text-left"
                    >
                      <p className="text-[13px] font-semibold text-foreground leading-snug">
                        {t('toolbar.generationConfig.totalPagesLabel')}
                      </p>
                      <p className="text-[12px] text-muted-foreground leading-relaxed mt-1.5">
                        {t('toolbar.generationConfig.totalPagesTooltip')}
                      </p>
                      <p className="text-[11px] text-violet-700 dark:text-violet-300 mt-2 pt-2 border-t border-border/50">
                        {t('toolbar.generationConfig.countRangeHint', {
                          min: TOTAL_PAGES_MIN,
                          max: TOTAL_PAGES_MAX,
                          unit: t('toolbar.generationConfig.totalPagesUnit'),
                        })}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  <div className="flex items-center gap-0.5 rounded-full border border-violet-300/70 dark:border-violet-700/50 px-1 py-0.5 shrink-0 bg-white dark:bg-slate-900">
                    <button
                      type="button"
                      onClick={() => setTotalPages(config.totalPages - 5)}
                      className="size-7 rounded-full flex items-center justify-center text-violet-600 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30 disabled:opacity-25 disabled:cursor-not-allowed"
                      disabled={config.totalPages <= TOTAL_PAGES_MIN}
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="min-w-[3.4rem] text-center text-[12px] font-semibold tabular-nums text-foreground/90 px-0.5">
                      {config.totalPages}
                      <span className="font-normal text-muted-foreground/80 text-[11px]">
                        {t('toolbar.generationConfig.totalPagesUnit')}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setTotalPages(config.totalPages + 5)}
                      className="size-7 rounded-full flex items-center justify-center text-violet-600 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30 disabled:opacity-25 disabled:cursor-not-allowed"
                      disabled={config.totalPages >= TOTAL_PAGES_MAX}
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                </div>

                {ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isOn = config.enabled[item.id];
                  const nameKey = `toolbar.generationConfig.items.${item.id}.name`;
                  const descKey = `toolbar.generationConfig.items.${item.id}.desc`;
                  const unitKey = `toolbar.generationConfig.items.${item.id}.unit`;
                  const name = t(nameKey);
                  const desc = t(descKey);
                  const unit = t(unitKey);
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-1.5 transition-colors',
                        isOn ? 'bg-violet-50/40 dark:bg-violet-950/15' : 'bg-transparent',
                      )}
                    >
                      <Checkbox
                        checked={isOn}
                        onCheckedChange={(v) => toggle(item.id, v === true)}
                        className="shrink-0"
                        aria-label={name}
                      />
                      <div
                        className={cn(
                          'shrink-0 size-8 rounded-lg flex items-center justify-center',
                          isOn ? item.activeColor : 'bg-muted/50 text-muted-foreground',
                        )}
                      >
                        <Icon className="size-4" />
                      </div>
                      <Tooltip delayDuration={250}>
                        <TooltipTrigger asChild>
                          <div className="flex-1 min-w-0 cursor-help rounded-md px-0.5 -mx-0.5 outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/60 flex items-baseline gap-1.5 min-h-[28px]">
                            <p className="text-[13px] font-semibold text-foreground leading-snug shrink-0">
                              {name}
                            </p>
                            <p className="text-[11px] text-muted-foreground leading-relaxed truncate hidden sm:inline">
                              {desc}
                            </p>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          align="start"
                          className="max-w-[min(calc(100vw-2rem),320px)] z-[100] text-left"
                        >
                          <p className="text-[13px] font-semibold text-foreground leading-snug">{name}</p>
                          <p className="text-[12px] text-muted-foreground leading-relaxed mt-1.5">{desc}</p>
                          <p className="text-[11px] text-violet-700 dark:text-violet-300 mt-2 pt-2 border-t border-border/50">
                            {t('toolbar.generationConfig.countRangeHint', {
                              min: item.min,
                              max: item.max,
                              unit,
                            })}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                      <div
                        className={cn(
                          'flex items-center gap-0.5 rounded-full border px-1 py-0.5 shrink-0',
                          isOn ? 'border-border/60 opacity-100' : 'border-border/30 opacity-40',
                        )}
                      >
                        <button
                          type="button"
                          disabled={!isOn}
                          onClick={() => setCount(item.id, config.counts[item.id] - 1)}
                          className="size-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/70 disabled:opacity-25 disabled:cursor-not-allowed"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="min-w-[3rem] text-center text-[12px] font-semibold tabular-nums text-foreground/90 px-0.5">
                          {config.counts[item.id]}
                          <span className="font-normal text-muted-foreground/80 text-[11px]">
                            {unit}
                          </span>
                        </span>
                        <button
                          type="button"
                          disabled={!isOn}
                          onClick={() => setCount(item.id, config.counts[item.id] + 1)}
                          className="size-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/70 disabled:opacity-25 disabled:cursor-not-allowed"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        <div className="flex flex-row items-center justify-between gap-3 border-t border-border/50 px-4 py-3 shrink-0 sm:justify-between">
          <span className="min-w-0 text-left text-[11px] text-muted-foreground">
            {config.autoMode
              ? t('toolbar.generationConfig.autoFooter')
              : t('toolbar.generationConfig.selectedCount', { count: selectedCount })}
          </span>
          <Button type="button" size="sm" className="shrink-0 rounded-full px-5" onClick={() => setOpen(false)}>
            {t('toolbar.generationConfig.apply')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
