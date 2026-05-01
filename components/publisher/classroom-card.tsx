'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, Pencil, Trash2, Sparkles } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCardTimestamp } from '@/lib/utils/format-card-timestamp';
import { ThumbnailSlide } from '@/components/slide-renderer/components/ThumbnailSlide';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Slide } from '@/lib/types/slides';
import type { StageListItem } from '@/lib/utils/stage-storage';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

export interface ClassroomCardShelfEdit<TCategory extends string = string> {
  /** Resolved current shelf category (from override or AI inference). */
  current: TCategory;
  /** Whether `current` came from publisher manual override. */
  isOverridden: boolean;
  /** Display label for the chip / select trigger. */
  currentLabel: string;
  /** Picker options (id + display label). */
  options: Array<{ id: TCategory; label: string }>;
  onChange: (next: TCategory) => void;
}

export function ClassroomCard<TCategory extends string = string>({
  classroom,
  slide,
  mockCover,
  shelfEdit,
  onDelete,
  onRename,
  confirmingDelete,
  onConfirmDelete,
  onCancelDelete,
  onClick,
}: {
  classroom: StageListItem;
  slide?: Slide;
  mockCover?: { gradient: string; emoji: string };
  /** My space: combined name + shelf-category editor (chip + popover). */
  shelfEdit?: ClassroomCardShelfEdit<TCategory>;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onRename: (id: string, newName: string) => void;
  confirmingDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onClick: () => void;
}) {
  const { t } = useI18n();
  const thumbRef = useRef<HTMLDivElement>(null);
  const [thumbWidth, setThumbWidth] = useState(0);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverNameDraft, setPopoverNameDraft] = useState(classroom.name);
  const [popoverCategoryDraft, setPopoverCategoryDraft] = useState<TCategory | undefined>(
    shelfEdit?.current,
  );
  const popoverNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = thumbRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setThumbWidth(Math.round(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (editing) nameInputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (popoverOpen) {
      setPopoverNameDraft(classroom.name);
      setPopoverCategoryDraft(shelfEdit?.current);
      requestAnimationFrame(() => popoverNameRef.current?.focus());
    }
  }, [popoverOpen, classroom.name, shelfEdit?.current]);

  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNameDraft(classroom.name);
    setEditing(true);
  };

  const commitRename = () => {
    if (!editing) return;
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== classroom.name) {
      onRename(classroom.id, trimmed);
    }
    setEditing(false);
  };

  const commitPopover = () => {
    const trimmed = popoverNameDraft.trim();
    if (trimmed && trimmed !== classroom.name) {
      onRename(classroom.id, trimmed);
    }
    if (
      shelfEdit &&
      popoverCategoryDraft &&
      popoverCategoryDraft !== shelfEdit.current
    ) {
      shelfEdit.onChange(popoverCategoryDraft);
    }
    setPopoverOpen(false);
  };

  return (
    <div className="group cursor-pointer" onClick={confirmingDelete ? undefined : onClick}>
      <div
        ref={thumbRef}
        className="relative w-full aspect-[16/9] rounded-2xl bg-slate-100 dark:bg-slate-800/80 overflow-hidden transition-transform duration-200 group-hover:scale-[1.02]"
      >
        {mockCover ? (
          <div
            className={cn(
              'absolute inset-0 bg-gradient-to-br',
              mockCover.gradient,
            )}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-6xl drop-shadow-sm select-none">{mockCover.emoji}</span>
            </div>
          </div>
        ) : slide && thumbWidth > 0 ? (
          <ThumbnailSlide
            slide={slide}
            size={thumbWidth}
            viewportSize={slide.viewportSize ?? 1000}
            viewportRatio={slide.viewportRatio ?? 0.5625}
          />
        ) : !slide ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-12 rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 dark:from-violet-900/30 dark:to-blue-900/30 flex items-center justify-center">
              <span className="text-xl opacity-50">📄</span>
            </div>
          </div>
        ) : null}

        {!confirmingDelete && !editing && (
          <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 group-hover:pointer-events-auto">
            {shelfEdit ? (
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8 rounded-full bg-black/45 text-white shadow-md backdrop-blur-sm hover:bg-black/65 border-0"
                        onClick={(e) => e.stopPropagation()}
                        aria-label={t('home.mySpace.editTooltip')}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {t('home.mySpace.editTooltip')}
                  </TooltipContent>
                </Tooltip>
                <PopoverContent
                  side="bottom"
                  align="end"
                  sideOffset={6}
                  collisionPadding={12}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                      e.preventDefault();
                      commitPopover();
                    }
                  }}
                  className="w-[min(calc(100vw-2rem),320px)] rounded-2xl border border-border/60 p-3 shadow-xl"
                >
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-muted-foreground">
                        {t('home.mySpace.editName')}
                      </label>
                      <input
                        ref={popoverNameRef}
                        type="text"
                        value={popoverNameDraft}
                        onChange={(e) => setPopoverNameDraft(e.target.value)}
                        maxLength={100}
                        placeholder={t('classroom.renamePlaceholder')}
                        className="w-full rounded-lg border border-border/60 bg-background px-3 py-1.5 text-[13px] outline-none transition-colors focus:border-violet-300/80"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-medium text-muted-foreground">
                          {t('home.mySpace.editCategory')}
                        </label>
                        {!shelfEdit.isOverridden ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-violet-600 dark:text-violet-300">
                            <Sparkles className="size-3" />
                            {t('home.mySpace.aiTagged')}
                          </span>
                        ) : null}
                      </div>
                      <div className="-mx-1 max-h-48 overflow-y-auto px-1">
                        <div className="grid grid-cols-2 gap-1.5">
                          {shelfEdit.options.map((opt) => {
                            const active = popoverCategoryDraft === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setPopoverCategoryDraft(opt.id)}
                                className={cn(
                                  'rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors text-left',
                                  active
                                    ? 'border-violet-400/80 bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200'
                                    : 'border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                                )}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        className="rounded-full px-3 py-1 text-[12px] font-medium text-muted-foreground hover:bg-muted/60"
                        onClick={() => setPopoverOpen(false)}
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        type="button"
                        className="rounded-full bg-violet-600 px-4 py-1 text-[12px] font-medium text-white shadow-sm transition-colors hover:bg-violet-700"
                        onClick={commitPopover}
                      >
                        {t('home.mySpace.editSave')}
                      </button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8 rounded-full bg-black/45 text-white shadow-md backdrop-blur-sm hover:bg-black/65 border-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      startRename(e);
                    }}
                    aria-label={t('classroom.rename')}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {t('classroom.rename')}
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8 rounded-full bg-black/45 text-white shadow-md backdrop-blur-sm hover:bg-red-600 border-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(classroom.id, e);
                  }}
                  aria-label={t('classroom.delete')}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {t('classroom.delete')}
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        <AnimatePresence>
          {confirmingDelete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 rounded-2xl bg-black/55 backdrop-blur-[8px] px-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center space-y-1.5 max-w-[260px]">
                <p className="text-[15px] font-semibold text-white leading-snug">
                  {t('classroom.deleteCardTitle')}
                </p>
                <p className="text-[11px] text-white/75 leading-relaxed">
                  {t('classroom.deleteConfirmPublisher')}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  className="px-4 py-2 rounded-full text-[12px] font-medium bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm transition-colors"
                  onClick={onCancelDelete}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-full text-[12px] font-medium bg-red-500 text-white hover:bg-red-600 transition-colors shadow-sm"
                  onClick={onConfirmDelete}
                >
                  {t('classroom.delete')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-2.5 px-1 space-y-0.5">
        {editing ? (
          <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
            <input
              ref={nameInputRef}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setEditing(false);
              }}
              onBlur={commitRename}
              maxLength={100}
              placeholder={t('classroom.renamePlaceholder')}
              className="w-full bg-transparent border-b border-violet-400/60 text-[15px] font-medium text-foreground/90 outline-none placeholder:text-muted-foreground/40"
            />
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <p
                className="font-medium text-[15px] leading-snug text-foreground/90 line-clamp-2 cursor-default"
                onDoubleClick={startRename}
              >
                {classroom.name}
              </p>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              sideOffset={4}
              className="!max-w-[min(90vw,32rem)] break-words whitespace-normal"
            >
              <div className="flex items-center gap-1.5">
                <span className="break-all">{classroom.name}</span>
                <button
                  type="button"
                  className="shrink-0 p-0.5 rounded hover:bg-foreground/10 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    void navigator.clipboard.writeText(classroom.name);
                    toast.success(t('classroom.nameCopied'));
                  }}
                >
                  <Copy className="size-3 opacity-60" />
                </button>
              </div>
            </TooltipContent>
          </Tooltip>
        )}
        {!editing ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] tabular-nums text-muted-foreground/75">
            <span>{formatCardTimestamp(classroom.updatedAt)}</span>
            {shelfEdit ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                  shelfEdit.isOverridden
                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/35 dark:text-violet-200'
                    : 'bg-muted/60 text-muted-foreground/85',
                )}
                title={
                  shelfEdit.isOverridden
                    ? t('home.mySpace.shelfCategoryLabel')
                    : t('home.mySpace.aiTagged')
                }
              >
                {!shelfEdit.isOverridden ? (
                  <Sparkles className="size-3 opacity-70" />
                ) : null}
                {shelfEdit.currentLabel}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
