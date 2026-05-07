'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Sparkles,
  BookOpen,
  CircleHelp,
  FlaskConical,
  Gamepad2,
  Code,
  Target,
  Brain,
  Minus,
  Plus,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';

const STORAGE_KEY = 'pubGenerationConfig';

export type GenerationItemId =
  | 'explanationPpt'
  | 'testQuestions'
  | 'simulation'
  | 'gameAnimation'
  | 'onlineCoding'
  | 'projectChallenge'
  | 'mindMap';

/**
 * v1 localStorage (`enabled` / `counts`) and older v2 `items` keys used these
 * ids — map each current row to the legacy key for migration.
 */
const LEGACY_STORAGE_KEY: Record<GenerationItemId, string> = {
  explanationPpt: 'ppt',
  testQuestions: 'quiz',
  simulation: 'simulation',
  gameAnimation: 'game',
  onlineCoding: 'video',
  projectChallenge: 'pbl',
  mindMap: 'whiteboard',
};

interface GenerationItemDef {
  id: GenerationItemId;
  icon: LucideIcon;
  defaultValue: number;
  min: number;
  max: number;
  /** Stepper increment when bumping a single value. */
  step: number;
  activeColor: string;
}

const ITEMS: GenerationItemDef[] = [
  {
    id: 'explanationPpt',
    icon: BookOpen,
    defaultValue: 6,
    min: 1,
    max: 50,
    step: 1,
    activeColor: 'text-violet-600 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/30',
  },
  {
    id: 'testQuestions',
    icon: CircleHelp,
    defaultValue: 10,
    min: 1,
    max: 50,
    step: 1,
    activeColor: 'text-amber-600 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30',
  },
  {
    id: 'simulation',
    icon: FlaskConical,
    defaultValue: 2,
    min: 1,
    max: 10,
    step: 1,
    activeColor: 'text-cyan-600 dark:text-cyan-300 bg-cyan-100 dark:bg-cyan-900/30',
  },
  {
    id: 'gameAnimation',
    icon: Gamepad2,
    defaultValue: 3,
    min: 1,
    max: 20,
    step: 1,
    activeColor: 'text-emerald-600 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30',
  },
  {
    id: 'onlineCoding',
    icon: Code,
    defaultValue: 2,
    min: 1,
    max: 20,
    step: 1,
    activeColor: 'text-rose-600 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/30',
  },
  {
    id: 'projectChallenge',
    icon: Target,
    defaultValue: 1,
    min: 1,
    max: 5,
    step: 1,
    activeColor: 'text-indigo-600 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/30',
  },
  {
    id: 'mindMap',
    icon: Brain,
    defaultValue: 2,
    min: 1,
    max: 10,
    step: 1,
    activeColor: 'text-sky-600 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/30',
  },
];

export type SlotMode = 'auto' | 'custom';

export interface GenerationSlot {
  /** 'auto' = let AI decide; 'custom' = use `value`. */
  mode: SlotMode;
  /** Numeric quantity. Only meaningful when `mode === 'custom'`, but kept
   * around so toggling auto → custom preserves the user's last chosen value. */
  value: number;
}

export interface GenerationConfigState {
  totalPages: GenerationSlot;
  items: Record<GenerationItemId, GenerationSlot>;
}

const TOTAL_PAGES_DEFAULT = 30;
const TOTAL_PAGES_MIN = 5;
const TOTAL_PAGES_MAX = 100;
const TOTAL_PAGES_STEP = 5;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function getDefaultConfig(): GenerationConfigState {
  const items = {} as Record<GenerationItemId, GenerationSlot>;
  for (const item of ITEMS) {
    items[item.id] = { mode: 'auto', value: item.defaultValue };
  }
  return {
    totalPages: { mode: 'auto', value: TOTAL_PAGES_DEFAULT },
    items,
  };
}

function parseItemSlot(
  itemsRaw: Record<string, Record<string, unknown>>,
  item: GenerationItemDef,
): GenerationSlot {
  const legacyKey = LEGACY_STORAGE_KEY[item.id];
  const rawSlot = itemsRaw[item.id] ?? itemsRaw[legacyKey];
  if (!rawSlot || typeof rawSlot !== 'object') {
    return { mode: 'auto', value: item.defaultValue };
  }
  return {
    mode: rawSlot.mode === 'custom' ? 'custom' : 'auto',
    value: clampInt(rawSlot.value, item.min, item.max, item.defaultValue),
  };
}

/**
 * Accept either the new `{ totalPages: { mode, value }, items: {...} }` shape
 * or the legacy `{ autoMode, totalPages: number, enabled, counts }` shape and
 * normalize to the new state.
 */
function normalizeConfig(parsed: unknown): GenerationConfigState {
  const def = getDefaultConfig();
  if (!parsed || typeof parsed !== 'object') return def;
  const raw = parsed as Record<string, unknown>;

  // Legacy detection: any of these keys indicates v1.
  const isLegacy = 'autoMode' in raw || 'enabled' in raw || 'counts' in raw;
  if (isLegacy) {
    const totalNumeric = clampInt(
      raw.totalPages,
      TOTAL_PAGES_MIN,
      TOTAL_PAGES_MAX,
      TOTAL_PAGES_DEFAULT,
    );
    const totalMode: SlotMode = raw.autoMode === true ? 'auto' : 'custom';
    const enabledMap = (raw.enabled ?? {}) as Record<string, boolean>;
    const countsMap = (raw.counts ?? {}) as Record<string, number>;
    const items = {} as Record<GenerationItemId, GenerationSlot>;
    for (const item of ITEMS) {
      const lk = LEGACY_STORAGE_KEY[item.id];
      const wasEnabled = enabledMap[lk] === true;
      const value = clampInt(countsMap[lk], item.min, item.max, item.defaultValue);
      items[item.id] = { mode: wasEnabled ? 'custom' : 'auto', value };
    }
    return { totalPages: { mode: totalMode, value: totalNumeric }, items };
  }

  // New format
  const totalRaw = (raw.totalPages ?? {}) as Record<string, unknown>;
  const totalMode: SlotMode = totalRaw.mode === 'custom' ? 'custom' : 'auto';
  const totalValue = clampInt(
    totalRaw.value,
    TOTAL_PAGES_MIN,
    TOTAL_PAGES_MAX,
    TOTAL_PAGES_DEFAULT,
  );
  const itemsRaw = (raw.items ?? {}) as Record<string, Record<string, unknown>>;
  const items = {} as Record<GenerationItemId, GenerationSlot>;
  for (const item of ITEMS) {
    items[item.id] = parseItemSlot(itemsRaw, item);
  }
  return { totalPages: { mode: totalMode, value: totalValue }, items };
}

export function readPublisherGenerationConfig(): GenerationConfigState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultConfig();
    return normalizeConfig(JSON.parse(raw));
  } catch {
    return getDefaultConfig();
  }
}

interface SummaryInfo {
  used: number;
  autoCount: number;
  customCount: number;
  remaining: number;
  status: 'allAuto' | 'totalAuto' | 'balanced' | 'underBudget' | 'overBudget' | 'mismatch';
  valid: boolean;
}

function computeSummary(config: GenerationConfigState): SummaryInfo {
  let used = 0;
  let autoCount = 0;
  let customCount = 0;
  for (const item of ITEMS) {
    const slot = config.items[item.id];
    if (slot.mode === 'custom') {
      used += slot.value;
      customCount += 1;
    } else {
      autoCount += 1;
    }
  }
  const totalAuto = config.totalPages.mode === 'auto';
  const total = config.totalPages.value;
  const remaining = total - used;

  if (totalAuto && customCount === 0) {
    return { used, autoCount, customCount, remaining, status: 'allAuto', valid: true };
  }
  if (totalAuto) {
    return { used, autoCount, customCount, remaining, status: 'totalAuto', valid: true };
  }
  if (used > total) {
    return { used, autoCount, customCount, remaining, status: 'overBudget', valid: false };
  }
  if (autoCount === 0) {
    if (used === total) {
      return { used, autoCount, customCount, remaining, status: 'balanced', valid: true };
    }
    return { used, autoCount, customCount, remaining, status: 'mismatch', valid: false };
  }
  return { used, autoCount, customCount, remaining, status: 'underBudget', valid: true };
}

interface SteppedRowProps {
  Icon: LucideIcon;
  iconActiveClass: string;
  name: string;
  desc: string;
  unit: string;
  slot: GenerationSlot;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  onChange: (next: GenerationSlot) => void;
  emphasis?: boolean;
  /** Hide the leading icon block — used by the "total pages" row to keep the
   *  header visually clean (the row is already differentiated by `emphasis`). */
  hideIcon?: boolean;
}

function StepperRow({
  Icon,
  iconActiveClass,
  name,
  desc,
  unit,
  slot,
  min,
  max,
  step,
  defaultValue,
  onChange,
  emphasis = false,
  hideIcon = false,
}: Readonly<SteppedRowProps>) {
  const { t } = useI18n();
  const isAuto = slot.mode === 'auto';

  const setAuto = () => onChange({ mode: 'auto', value: slot.value });
  const setCustom = (n: number) => {
    const v = clampInt(n, min, max, defaultValue);
    onChange({ mode: 'custom', value: v });
  };

  const handleMinus = () => {
    if (isAuto) return;
    const next = slot.value - step;
    if (next < min) {
      // Already at the minimum custom value: revert to auto.
      setAuto();
    } else {
      setCustom(next);
    }
  };

  const handlePlus = () => {
    if (isAuto) {
      setCustom(Math.max(min, defaultValue));
      return;
    }
    if (slot.value >= max) return;
    setCustom(slot.value + step);
  };

  const toggleMode = () => {
    if (isAuto) {
      setCustom(Math.max(min, defaultValue));
    } else {
      setAuto();
    }
  };

  const valueButtonClass = cn(
    'min-w-[3.4rem] text-center text-[12px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md transition-colors cursor-pointer',
    isAuto
      ? 'text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/30 hover:bg-violet-100 dark:hover:bg-violet-900/50'
      : 'text-foreground/90 hover:bg-muted/70',
  );

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 px-3 py-1.5 transition-colors',
        emphasis && 'bg-gradient-to-r from-violet-50/60 to-transparent dark:from-violet-950/20',
        !emphasis && !isAuto && 'bg-violet-50/30 dark:bg-violet-950/10',
      )}
    >
      {!hideIcon && (
        <div
          className={cn(
            'shrink-0 size-8 rounded-lg flex items-center justify-center',
            isAuto ? 'bg-muted/50 text-muted-foreground' : iconActiveClass,
          )}
        >
          <Icon className="size-4" />
        </div>
      )}

      <div className="flex-1 min-w-0 flex items-baseline gap-1.5 min-h-[28px]">
        <p className="text-[13px] font-semibold text-foreground leading-snug shrink-0">
          {name}
        </p>
        <p className="text-[11px] text-muted-foreground leading-relaxed truncate">
          {desc}
        </p>
      </div>

      <div
        className={cn(
          'flex items-center gap-0.5 rounded-full border px-1 py-0.5 shrink-0 bg-background',
          emphasis
            ? 'border-violet-300/70 dark:border-violet-700/50'
            : 'border-border/60',
        )}
      >
        <button
          type="button"
          onClick={handleMinus}
          disabled={isAuto}
          className="size-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/70 disabled:opacity-25 disabled:cursor-not-allowed"
          aria-label="−"
        >
          <Minus className="size-3.5" />
        </button>

        <Tooltip delayDuration={400}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={toggleMode}
              className={valueButtonClass}
            >
              {isAuto ? (
                t('toolbar.generationConfig.autoLabel')
              ) : (
                <>
                  {slot.value}
                  <span className="font-normal text-muted-foreground/80 text-[11px]">
                    {unit}
                  </span>
                </>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[11px]">
            {isAuto
              ? t('toolbar.generationConfig.tipSetCustom')
              : t('toolbar.generationConfig.tipSetAuto')}
          </TooltipContent>
        </Tooltip>

        <button
          type="button"
          onClick={handlePlus}
          disabled={!isAuto && slot.value >= max}
          className={cn(
            'size-7 rounded-full flex items-center justify-center transition-colors',
            'disabled:opacity-25 disabled:cursor-not-allowed',
            isAuto
              ? 'text-violet-600 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30'
              : 'text-muted-foreground hover:bg-muted/70',
          )}
          aria-label="+"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function triggerClass(locked: boolean, totalAuto: boolean, customCount: number) {
  if (locked) {
    return 'opacity-45 cursor-not-allowed border-border/50 text-muted-foreground';
  }
  if (totalAuto && customCount === 0) {
    return 'cursor-pointer bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-200 border-violet-500/80 shadow-[0_0_12px_rgba(124,58,237,0.2)]';
  }
  return 'cursor-pointer bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-400/70 shadow-[0_0_12px_rgba(124,58,237,0.25)]';
}

interface StatusLineProps {
  summary: SummaryInfo;
  totalUnit: string;
  totalValue: number;
}

function StatusLine({ summary, totalUnit, totalValue }: Readonly<StatusLineProps>) {
  const { t } = useI18n();
  const baseClass = 'min-w-0 text-left text-[11px] leading-relaxed';
  switch (summary.status) {
    case 'allAuto':
      return (
        <span className={cn(baseClass, 'text-muted-foreground')}>
          {t('toolbar.generationConfig.statusAllAuto')}
        </span>
      );
    case 'totalAuto':
      return (
        <span className={cn(baseClass, 'text-muted-foreground')}>
          {t('toolbar.generationConfig.statusTotalAuto', { custom: summary.customCount })}
        </span>
      );
    case 'balanced':
      return (
        <span className={cn(baseClass, 'text-emerald-600 dark:text-emerald-400 font-medium')}>
          {t('toolbar.generationConfig.statusBalanced', {
            total: totalValue,
            unit: totalUnit,
          })}
        </span>
      );
    case 'underBudget':
      return (
        <span className={cn(baseClass, 'text-muted-foreground')}>
          {t('toolbar.generationConfig.statusUnderBudget', {
            used: summary.used,
            total: totalValue,
            remaining: summary.remaining,
            unit: totalUnit,
          })}
        </span>
      );
    case 'overBudget':
      return (
        <span className={cn(baseClass, 'text-rose-600 dark:text-rose-400 font-medium')}>
          {t('toolbar.generationConfig.statusOverBudget', {
            over: -summary.remaining,
            unit: totalUnit,
          })}
        </span>
      );
    case 'mismatch':
      return (
        <span className={cn(baseClass, 'text-rose-600 dark:text-rose-400 font-medium')}>
          {t('toolbar.generationConfig.statusMismatch', {
            used: summary.used,
            total: totalValue,
            unit: totalUnit,
          })}
        </span>
      );
    default:
      return null;
  }
}

export function GenerationConfigPopover({ locked = false }: Readonly<{ locked?: boolean }>) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<GenerationConfigState>(() => getDefaultConfig());

  /* eslint-disable react-hooks/set-state-in-effect -- Hydration from localStorage */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      setConfig(normalizeConfig(JSON.parse(raw)));
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

  const setTotalSlot = (slot: GenerationSlot) =>
    persist({ ...config, totalPages: { ...slot, value: clampInt(slot.value, TOTAL_PAGES_MIN, TOTAL_PAGES_MAX, TOTAL_PAGES_DEFAULT) } });

  const setItemSlot = (id: GenerationItemId, slot: GenerationSlot) =>
    persist({ ...config, items: { ...config.items, [id]: slot } });

  const summary = useMemo(() => computeSummary(config), [config]);
  const totalUnit = t('toolbar.generationConfig.totalPagesUnit');
  const totalAuto = config.totalPages.mode === 'auto';

  let tooltipText = t('toolbar.generationConfig.subtitle');
  if (locked) tooltipText = t('toolbar.generationConfig.lockedHint');
  else if (totalAuto && summary.customCount === 0) {
    tooltipText = t('toolbar.generationConfig.autoTooltip');
  }

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
                triggerClass(locked, totalAuto, summary.customCount),
              )}
            >
              <Sparkles className="size-3.5 relative z-10" />
              <span className="relative z-10">{t('toolbar.generationConfig.label')}</span>
              {totalAuto ? (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-[22px] h-4 px-1 rounded-full text-[9px] font-bold tracking-wide bg-emerald-600 text-white">
                  {t('toolbar.generationConfig.autoBadge')}
                </span>
              ) : (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-[22px] h-4 px-1 rounded-full text-[10px] font-semibold bg-violet-600 text-white">
                  {config.totalPages.value}
                </span>
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
        {/* ── Header ── */}
        <div className="relative px-5 pt-5 pb-3 border-b border-border/50 shrink-0 text-left space-y-1.5 pr-14">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            aria-label={t('common.close')}
          >
            <X className="size-4" />
          </button>
          <h2 className="text-base font-semibold pr-2">
            {t('toolbar.generationConfig.title')}
          </h2>
          <p className="text-[12px] leading-relaxed break-words text-muted-foreground">
            {t('toolbar.generationConfig.dialogIntro')}
          </p>
        </div>

        {/* ── Body: total pages + 7 item rows ── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
          <div className="rounded-xl border border-border/50 bg-white dark:bg-slate-900/40 divide-y divide-border/40 overflow-hidden">
            {/* Total pages — emphasised first row, no leading icon to keep
                the header visually clean. */}
            <StepperRow
              Icon={Target}
              iconActiveClass="bg-violet-600 text-white"
              name={t('toolbar.generationConfig.totalPagesLabel')}
              desc={t('toolbar.generationConfig.totalPagesDesc')}
              unit={t('toolbar.generationConfig.totalPagesUnit')}
              slot={config.totalPages}
              min={TOTAL_PAGES_MIN}
              max={TOTAL_PAGES_MAX}
              step={TOTAL_PAGES_STEP}
              defaultValue={TOTAL_PAGES_DEFAULT}
              onChange={setTotalSlot}
              emphasis
              hideIcon
            />

            {ITEMS.map((item) => {
              const Icon = item.icon;
              const nameKey = `toolbar.generationConfig.items.${item.id}.name`;
              const descKey = `toolbar.generationConfig.items.${item.id}.desc`;
              const unitKey = `toolbar.generationConfig.items.${item.id}.unit`;
              const name = t(nameKey);
              const desc = t(descKey);
              const unit = t(unitKey);
              return (
                <StepperRow
                  key={item.id}
                  Icon={Icon}
                  iconActiveClass={item.activeColor}
                  name={name}
                  desc={desc}
                  unit={unit}
                  slot={config.items[item.id]}
                  min={item.min}
                  max={item.max}
                  step={item.step}
                  defaultValue={item.defaultValue}
                  onChange={(slot) => setItemSlot(item.id, slot)}
                />
              );
            })}
          </div>
        </div>

        {/* ── Footer: status + apply ── */}
        <div className="flex flex-row items-center justify-between gap-3 border-t border-border/50 px-4 py-3 shrink-0 bg-muted/15">
          <StatusLine
            summary={summary}
            totalUnit={totalUnit}
            totalValue={config.totalPages.value}
          />
          <Button
            type="button"
            size="sm"
            disabled={!summary.valid}
            className="shrink-0 rounded-full px-5"
            onClick={() => setOpen(false)}
          >
            {t('toolbar.generationConfig.apply')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
