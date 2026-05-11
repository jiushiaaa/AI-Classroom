'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutTemplate, Loader2, Plus, Trash2, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';
import { readFileAsReferenceBackgroundDataUrl } from '@/lib/utils/reference-background-image';
import {
  addReferenceBackgroundTemplate,
  deleteReferenceBackgroundTemplate,
  loadReferenceBackgroundTemplates,
  type ReferenceBackgroundTemplate,
} from '@/lib/utils/reference-background-library-storage';
import { MAX_REFERENCE_BG_TEMPLATES } from '@/lib/constants/reference-background';
import { toast } from 'sonner';

export interface ReferenceBackgroundLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Template id selected for this generation run (at most one). */
  sessionTemplateId: string | null;
  onSessionTemplateChange: (id: string | null, dataUrl: string | null) => void;
  /** Called after templates are added or removed (refresh toolbar badge). */
  onLibraryMutation?: () => void;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
}

export function ReferenceBackgroundLibraryDialog({
  open,
  onOpenChange,
  sessionTemplateId,
  onSessionTemplateChange,
  onLibraryMutation,
  children,
  side = 'top',
  align = 'start',
}: ReferenceBackgroundLibraryDialogProps) {
  const { t } = useI18n();
  const [templates, setTemplates] = useState<ReferenceBackgroundTemplate[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => {
    setTemplates(loadReferenceBackgroundTemplates());
  }, []);

  useEffect(() => {
    if (!open) return;
    reload();
  }, [open, reload]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadBusy(true);
    try {
      const res = await readFileAsReferenceBackgroundDataUrl(file);
      if (!res.ok) {
        toast.error(res.error === 'size' ? t('home.referenceBg.tooLarge') : t('home.referenceBg.badType'));
        return;
      }
      const added = addReferenceBackgroundTemplate(res.dataUrl, file.name.replace(/\.[^.]+$/, ''));
      if (!added) {
        toast.error(t('home.referenceBg.libraryFull', { max: MAX_REFERENCE_BG_TEMPLATES }));
        return;
      }
      reload();
      onLibraryMutation?.();
      onSessionTemplateChange(added.id, added.dataUrl);
      toast.success(t('home.referenceBg.savedToLibrary'));
    } finally {
      setUploadBusy(false);
    }
  };

  const handleToggleUse = (tpl: ReferenceBackgroundTemplate, checked: boolean) => {
    if (checked) {
      onSessionTemplateChange(tpl.id, tpl.dataUrl);
    } else if (sessionTemplateId === tpl.id) {
      onSessionTemplateChange(null, null);
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    deleteReferenceBackgroundTemplate(id);
    if (sessionTemplateId === id) {
      onSessionTemplateChange(null, null);
    }
    reload();
    onLibraryMutation?.();
  };

  const clearSession = () => {
    onSessionTemplateChange(null, null);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={8}
        collisionPadding={12}
        className={cn(
          '!p-0 !gap-0 overflow-hidden bg-white dark:bg-slate-900',
          'w-[min(calc(100vw-2rem),480px)] rounded-2xl border border-border/60',
          'shadow-xl shadow-black/[0.06] dark:shadow-black/30 ring-1 ring-black/[0.03]',
        )}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/50 bg-muted/30 dark:bg-muted/10">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300">
              <LayoutTemplate className="size-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-[13px] font-semibold text-foreground truncate">
                {t('home.referenceBg.libraryTitle')}
              </h2>
              <p className="text-[11px] text-muted-foreground truncate">
                {t('home.referenceBg.librarySub')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="shrink-0 inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/80"
            aria-label={t('common.close', { defaultValue: 'Close' })}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-border/40">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(ev) => void handleUpload(ev)}
          />
          <button
            type="button"
            disabled={uploadBusy}
            onClick={() => fileRef.current?.click()}
            className={cn(
              'w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-[13px] font-medium',
              'border border-dashed border-violet-300/70 dark:border-violet-700/50',
              'bg-violet-50/80 dark:bg-violet-950/25 text-violet-800 dark:text-violet-200',
              'hover:bg-violet-100/90 dark:hover:bg-violet-900/35 transition-colors',
              uploadBusy && 'opacity-60 pointer-events-none',
            )}
          >
            {uploadBusy ? (
              <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
            ) : (
              <Plus className="size-4 shrink-0" aria-hidden />
            )}
            {t('home.referenceBg.uploadAdd')}
          </button>
        </div>

        <div className="max-h-[min(52vh,360px)] overflow-y-auto px-4 py-3">
          {templates.length === 0 ? (
            <p className="text-center text-[13px] text-muted-foreground py-8 px-2">
              {t('home.referenceBg.emptyLibrary')}
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className={cn(
                    'group relative rounded-xl border overflow-hidden bg-muted/20',
                    sessionTemplateId === tpl.id
                      ? 'border-violet-500 ring-2 ring-violet-400/40'
                      : 'border-border/60',
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={tpl.dataUrl}
                    alt=""
                    className="aspect-[16/10] w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent pt-6 pb-1.5 px-2">
                    <p className="text-[10px] text-white/95 truncate font-medium">{tpl.name}</p>
                  </div>
                  <div className="absolute left-1.5 top-1.5 flex items-center gap-1">
                    <label
                      className={cn(
                        'inline-flex items-center justify-center rounded-md bg-white/90 dark:bg-slate-900/90 p-0.5 shadow-sm cursor-pointer',
                      )}
                    >
                      <Checkbox
                        checked={sessionTemplateId === tpl.id}
                        onCheckedChange={(v) => handleToggleUse(tpl, v === true)}
                        aria-label={t('home.referenceBg.useThisRun')}
                        className="border-violet-400 data-[state=checked]:bg-violet-600"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={(ev) => handleDelete(ev, tpl.id)}
                    className="absolute right-1.5 top-1.5 inline-flex size-7 items-center justify-center rounded-md bg-white/90 dark:bg-slate-900/90 text-red-600 shadow-sm opacity-90 hover:opacity-100"
                    aria-label={t('home.referenceBg.deleteTemplate')}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {sessionTemplateId ? (
          <div className="px-4 py-2.5 border-t border-border/50 bg-muted/20">
            <button
              type="button"
              onClick={clearSession}
              className="text-[12px] font-medium text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              {t('home.referenceBg.clearThisRun')}
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
