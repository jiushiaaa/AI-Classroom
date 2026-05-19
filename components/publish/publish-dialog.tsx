'use client';

/**
 * PublishDialog
 * -------------
 * "发布到书链" handoff dialog.
 *
 * Surfaces the permanent AI classroom URL for copy, then hands off to
 * bookln for QR minting on the B-end platform.
 */

import { useCallback, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ExternalLink, Sparkles, BookOpen, Link2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useStageStore } from '@/lib/store/stage';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';

interface PublishDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

const BOOKLN_LIST_URL = 'https://www.bookln.cn/home.html#/aiIntelligentBooks/list';
const COURSE_BASE = 'https://yt.ai/course/';

function buildPermanentLink(classroomId: string): string {
  return `${COURSE_BASE}${classroomId}`;
}

function buildBooklnHandoffUrl(params: {
  courseLink: string;
  bookId?: string;
  bookTitle: string;
}): string {
  const search = new URLSearchParams({
    target_url: params.courseLink,
    book_title: params.bookTitle,
    from: 'OpenMAIC',
  });
  if (params.bookId) search.set('book_id', params.bookId);
  return `${BOOKLN_LIST_URL}?${search.toString()}`;
}

export function PublishDialog({ open, onOpenChange }: PublishDialogProps) {
  const { t } = useI18n();
  const stage = useStageStore((s) => s.stage);
  const scenes = useStageStore((s) => s.scenes);

  const classroomId = stage?.id ?? 'demo-classroom';
  const classroomTitle = stage?.name ?? t('publish.unknownClassroom');
  const sceneCount = scenes.length;
  const boundBook = stage?.boundBook;

  const courseLink = useMemo(() => buildPermanentLink(classroomId), [classroomId]);
  const booklnUrl = useMemo(
    () =>
      buildBooklnHandoffUrl({
        courseLink,
        bookId: boundBook?.id,
        bookTitle: boundBook?.title ?? classroomTitle,
      }),
    [courseLink, boundBook, classroomTitle],
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      onOpenChange(next);
    },
    [onOpenChange],
  );

  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopyLink = useCallback(async () => {
    if (typeof globalThis.navigator?.clipboard?.writeText !== 'function') {
      toast.error(t('publish.toastClipboardError'));
      return;
    }
    try {
      await globalThis.navigator.clipboard.writeText(courseLink);
      setLinkCopied(true);
      toast.success(t('publish.toastLinkCopied'));
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error(t('publish.toastClipboardError'));
    }
  }, [courseLink, t]);

  const handleOpenBookln = useCallback(() => {
    globalThis.open(booklnUrl, '_blank', 'noopener,noreferrer');
    toast.message(t('publish.toastBooklnOpened'), {
      description: t('publish.toastBooklnDescription'),
    });
  }, [booklnUrl, t]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
        <div className="h-1 bg-gradient-to-r from-purple-500 via-violet-500 to-fuchsia-500" />

        <DialogHeader className="px-6 pt-5 pb-2">
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-300">
            <Sparkles className="w-4 h-4" />
            <span className="text-[11px] uppercase tracking-widest font-bold">
              {t('publish.eyebrow')}
            </span>
          </div>
          <DialogTitle className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">
            {t('publish.title')}
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            {t('publish.description')}
          </DialogDescription>
        </DialogHeader>

        <motion.div
          key="handoff"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="px-6 py-4 space-y-3"
        >
          <div className="rounded-xl bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-900/20 dark:to-fuchsia-900/15 ring-1 ring-purple-200/60 dark:ring-purple-700/30 px-4 py-3 flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white shadow-md shadow-purple-500/30 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-purple-700/80 dark:text-purple-300/80 font-bold">
                {t('publish.classroomCard.eyebrow')}
              </div>
              <div className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate mt-0.5">
                {classroomTitle}
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                {t('publish.classroomCard.sceneCount', { count: sceneCount })}
              </div>
            </div>
          </div>

          {boundBook ? (
            <div className="rounded-xl bg-emerald-50/60 dark:bg-emerald-900/15 ring-1 ring-emerald-200/60 dark:ring-emerald-700/30 px-4 py-3">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 mb-2">
                <Link2 className="w-3.5 h-3.5" />
                <span className="text-[11px] uppercase tracking-wider font-bold">
                  {t('publish.bookCard.eyebrow')}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-10 h-12 rounded-md flex items-center justify-center text-white text-lg shrink-0 bg-gradient-to-br',
                    boundBook.coverGradient ?? 'from-emerald-400 to-teal-500',
                  )}
                >
                  {boundBook.coverEmoji ?? '📘'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {boundBook.title}
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
                    {boundBook.subject && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-100/70 dark:bg-emerald-800/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-medium">
                        {boundBook.subject}
                      </span>
                    )}
                    <span>{t('publish.bookCard.boundOnBookln')}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-amber-50/60 dark:bg-amber-900/15 ring-1 ring-amber-200/60 dark:ring-amber-700/30 px-4 py-2.5 flex items-start gap-2">
              <BookOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300 mt-0.5 shrink-0" />
              <div className="text-[11px] text-amber-800/90 dark:text-amber-200/90 leading-snug">
                {t('publish.bookCard.unboundHint')}
              </div>
            </div>
          )}

          <motion.div
            className="rounded-xl bg-gray-50/80 dark:bg-gray-900/40 ring-1 ring-gray-200/60 dark:ring-gray-700/40 px-4 py-3 space-y-2"
          >
            <div className="text-[11px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400">
              {t('publish.linkCard.eyebrow')}
            </div>
            <div className="flex items-stretch gap-2">
              <div className="flex-1 min-w-0 rounded-lg bg-white dark:bg-gray-950 px-3 py-2 ring-1 ring-gray-200/80 dark:ring-gray-700/50 flex items-center">
                <p className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate select-all w-full">
                  {courseLink}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleCopyLink()}
                className="shrink-0 h-auto px-3 gap-1.5"
              >
                {linkCopied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {t('publish.copyLink')}
              </Button>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
              {t('publish.linkCard.hint')}
            </p>
          </motion.div>
        </motion.div>

        <DialogFooter className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleOpenBookln}
            className="bg-gradient-to-br from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white"
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            {t(boundBook ? 'publish.openBookln' : 'publish.openBooklnUnbound')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
