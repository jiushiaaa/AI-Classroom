'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CaseSensitive, LayoutTemplate, Loader2, Plus, Trash2, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { readFileAsPublisherFontDataUrl } from '@/lib/utils/publisher-font-file';
import {
  addPublisherFontTemplate,
  deletePublisherFontTemplate,
  loadPublisherFontTemplates,
  type PublisherFontTemplate,
} from '@/lib/utils/publisher-font-library-storage';
import {
  applyPublisherFontFacesStyle,
  dispatchPublisherFontsChanged,
} from '@/lib/utils/publisher-font-face';
import { toast } from 'sonner';

export interface PublisherResourceLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Background template id selected for this generation run (at most one). */
  sessionTemplateId: string | null;
  onSessionTemplateChange: (id: string | null, dataUrl: string | null) => void;
  /** Font template id selected for this generation run (at most one). */
  fontSessionId: string | null;
  onFontSessionChange: (id: string | null) => void;
  /** Called after templates are added or removed (refresh toolbar badge). */
  onLibraryMutation?: () => void;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
}

export function PublisherResourceLibraryDialog({
  open,
  onOpenChange,
  sessionTemplateId,
  onSessionTemplateChange,
  fontSessionId,
  onFontSessionChange,
  onLibraryMutation,
  children,
  side = 'top',
  align = 'start',
}: PublisherResourceLibraryDialogProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState('background');
  const [templates, setTemplates] = useState<ReferenceBackgroundTemplate[]>([]);
  const [fonts, setFonts] = useState<PublisherFontTemplate[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [fontUploadBusy, setFontUploadBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const fontFileRef = useRef<HTMLInputElement>(null);

  const reloadBackgrounds = useCallback(() => {
    setTemplates(loadReferenceBackgroundTemplates());
  }, []);

  const reloadFonts = useCallback(() => {
    setFonts(loadPublisherFontTemplates());
    applyPublisherFontFacesStyle(loadPublisherFontTemplates());
  }, []);

  const reloadAll = useCallback(() => {
    reloadBackgrounds();
    reloadFonts();
  }, [reloadBackgrounds, reloadFonts]);

  useEffect(() => {
    if (!open) return;
    reloadAll();
  }, [open, reloadAll]);

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      reloadBackgrounds();
      onLibraryMutation?.();
      onSessionTemplateChange(added.id, added.dataUrl);
      toast.success(t('home.referenceBg.savedToLibrary'));
    } finally {
      setUploadBusy(false);
    }
  };

  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    e.target.value = '';
    if (!files?.length) return;
    setFontUploadBusy(true);
    let addedCount = 0;
    try {
      for (const file of Array.from(files)) {
        const res = await readFileAsPublisherFontDataUrl(file);
        if (!res.ok) {
          toast.error(
            res.error === 'size' ? t('home.publisherFont.tooLarge') : t('home.publisherFont.badType'),
          );
          continue;
        }
        const added = addPublisherFontTemplate(res.dataUrl, res.fileName);
        if (!added) continue;
        addedCount += 1;
      }
      if (addedCount > 0) {
        reloadFonts();
        onLibraryMutation?.();
        dispatchPublisherFontsChanged();
        toast.success(
          addedCount > 1
            ? t('home.publisherFont.savedManyToLibrary', { count: addedCount })
            : t('home.publisherFont.savedToLibrary'),
        );
      }
    } finally {
      setFontUploadBusy(false);
    }
  };

  const handleToggleUseBg = (tpl: ReferenceBackgroundTemplate, checked: boolean) => {
    if (checked) {
      onSessionTemplateChange(tpl.id, tpl.dataUrl);
    } else if (sessionTemplateId === tpl.id) {
      onSessionTemplateChange(null, null);
    }
  };

  const handleToggleFontSession = (id: string, checked: boolean) => {
    if (checked) {
      onFontSessionChange(id);
    } else if (fontSessionId === id) {
      onFontSessionChange(null);
    }
  };

  const handleDeleteBg = (ev: React.MouseEvent, id: string) => {
    ev.preventDefault();
    ev.stopPropagation();
    deleteReferenceBackgroundTemplate(id);
    if (sessionTemplateId === id) {
      onSessionTemplateChange(null, null);
    }
    reloadBackgrounds();
    onLibraryMutation?.();
  };

  const handleDeleteFont = (ev: React.MouseEvent, id: string) => {
    ev.preventDefault();
    ev.stopPropagation();
    deletePublisherFontTemplate(id);
    if (fontSessionId === id) onFontSessionChange(null);
    reloadFonts();
    onLibraryMutation?.();
    dispatchPublisherFontsChanged();
  };

  const clearBgSession = () => {
    onSessionTemplateChange(null, null);
  };

  const clearFontSession = () => {
    onFontSessionChange(null);
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
                {t('home.resourceLib.title')}
              </h2>
              <p className="text-[11px] text-muted-foreground truncate">
                {t('home.resourceLib.subtitle')}
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

        <div className="px-4 pt-3 pb-2">
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="w-full grid grid-cols-2 h-9 p-0.5">
              <TabsTrigger value="background" className="text-[12px] gap-1.5">
                <LayoutTemplate className="size-3.5 shrink-0 opacity-70" aria-hidden />
                {t('home.resourceLib.tabBackground')}
              </TabsTrigger>
              <TabsTrigger value="fonts" className="text-[12px] gap-1.5">
                <CaseSensitive className="size-3.5 shrink-0 opacity-70" aria-hidden />
                {t('home.resourceLib.tabFonts')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="background" className="mt-0 pt-3 space-y-0">
              <div className="px-0 pb-3 border-b border-border/40">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(ev) => void handleBgUpload(ev)}
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

              <div className="max-h-[min(52vh,360px)] overflow-y-auto py-3">
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
                              onCheckedChange={(v) => handleToggleUseBg(tpl, v === true)}
                              aria-label={t('home.referenceBg.useThisRun')}
                              className="border-violet-400 data-[state=checked]:bg-violet-600"
                            />
                          </label>
                        </div>
                        <button
                          type="button"
                          onClick={(ev) => handleDeleteBg(ev, tpl.id)}
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
                <div className="px-0 py-2.5 border-t border-border/50 bg-muted/20 -mx-4 px-4">
                  <button
                    type="button"
                    onClick={clearBgSession}
                    className="text-[12px] font-medium text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  >
                    {t('home.referenceBg.clearThisRun')}
                  </button>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="fonts" className="mt-0 pt-3 space-y-0">
              <div className="px-0 pb-3 border-b border-border/40">
                <input
                  ref={fontFileRef}
                  type="file"
                  multiple
                  accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
                  className="hidden"
                  onChange={(ev) => void handleFontUpload(ev)}
                />
                <button
                  type="button"
                  disabled={fontUploadBusy}
                  onClick={() => fontFileRef.current?.click()}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-[13px] font-medium',
                    'border border-dashed border-violet-300/70 dark:border-violet-700/50',
                    'bg-violet-50/80 dark:bg-violet-950/25 text-violet-800 dark:text-violet-200',
                    'hover:bg-violet-100/90 dark:hover:bg-violet-900/35 transition-colors',
                    fontUploadBusy && 'opacity-60 pointer-events-none',
                  )}
                >
                  {fontUploadBusy ? (
                    <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
                  ) : (
                    <Plus className="size-4 shrink-0" aria-hidden />
                  )}
                  {t('home.publisherFont.uploadAdd')}
                </button>
              </div>

              <div className="max-h-[min(52vh,360px)] overflow-y-auto py-3 space-y-2">
                {fonts.length === 0 ? (
                  <p className="text-center text-[13px] text-muted-foreground py-8 px-2">
                    {t('home.publisherFont.emptyLibrary')}
                  </p>
                ) : (
                  fonts.map((f) => (
                    <div
                      key={f.id}
                      className={cn(
                        'flex items-stretch gap-3 rounded-xl border p-3',
                        fontSessionId === f.id
                          ? 'border-violet-500 ring-2 ring-violet-400/40 bg-violet-50/40 dark:bg-violet-950/20'
                          : 'border-border/60 bg-muted/15',
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-foreground truncate">{f.name}</p>
                        <p
                          className="text-[18px] mt-1.5 text-foreground/90 leading-tight truncate"
                          style={{ fontFamily: f.fontFamily }}
                        >
                          {t('home.publisherFont.previewSample')}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate mt-1">
                          {f.fontFamily}
                        </p>
                      </div>
                      <div className="flex flex-col items-end justify-between shrink-0 gap-2">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] text-muted-foreground">
                          <Checkbox
                            checked={fontSessionId === f.id}
                            onCheckedChange={(v) => handleToggleFontSession(f.id, v === true)}
                            aria-label={t('home.publisherFont.useThisRun')}
                            className="border-violet-400 data-[state=checked]:bg-violet-600"
                          />
                          <span className="whitespace-nowrap">{t('home.publisherFont.useThisRun')}</span>
                        </label>
                        <button
                          type="button"
                          onClick={(ev) => handleDeleteFont(ev, f.id)}
                          className="inline-flex size-8 items-center justify-center rounded-md border border-border/60 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          aria-label={t('home.publisherFont.deleteTemplate')}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {fontSessionId ? (
                <div className="px-0 py-2.5 border-t border-border/50 bg-muted/20 -mx-4 px-4">
                  <button
                    type="button"
                    onClick={clearFontSession}
                    className="text-[12px] font-medium text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  >
                    {t('home.publisherFont.clearThisRun')}
                  </button>
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </div>
      </PopoverContent>
    </Popover>
  );
}
