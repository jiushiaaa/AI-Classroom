'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { ArrowLeft, ChevronDown, Loader2, Search } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { createLogger } from '@/lib/logger';
import { ClassroomCard } from '@/components/publisher/classroom-card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  MY_COURSES_MOCK,
  getMyCourseMockVisual,
  isPublisherMockCourse,
} from '@/lib/mock/my-courses-mock';
import { OPENMAIC_DEMO_CLASSROOM_ID } from '@/lib/mock/openmaic-demo-classroom';
import {
  StageListItem,
  listStages,
  deleteStageData,
  renameStage,
  getFirstSlideByStages,
} from '@/lib/utils/stage-storage';
import type { Slide } from '@/lib/types/slides';
import { useMediaGenerationStore } from '@/lib/store/media-generation';
import { toast } from 'sonner';
import { sortMyCourses } from '@/lib/publisher/my-course-classification';
import { getPublisherCourseStatus } from '@/lib/utils/publisher-course-meta';
import type { PublisherCourseStatus } from '@/lib/utils/publisher-course-meta';
import {
  PUBLISHER_SHELF_CATEGORY_IDS,
  type PublisherShelfCategoryId,
  resolveShelfCategory,
} from '@/lib/publisher/publisher-shelf-category';
import {
  readShelfCategoryMap,
  setShelfCategoryInStorage,
  writeShelfCategoryMap,
} from '@/lib/utils/publisher-course-shelf-category-storage';
import { cn } from '@/lib/utils';

const log = createLogger('MySpace');

type MySpacePublishTab = 'all' | 'published' | 'draft';

function resolvePublishStatus(classroom: StageListItem): PublisherCourseStatus {
  if (isPublisherMockCourse(classroom.id)) {
    return getMyCourseMockVisual(classroom.id)?.demoPublishStatus ?? 'draft';
  }
  return getPublisherCourseStatus(classroom.id);
}

function titleMatchesQuery(name: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return name.toLowerCase().includes(q);
}

export default function MySpacePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [classrooms, setClassrooms] = useState<StageListItem[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, Slide>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [publishTab, setPublishTab] = useState<MySpacePublishTab>('all');
  const [publishFilterReady, setPublishFilterReady] = useState(false);
  const [shelfMap, setShelfMap] = useState<Record<string, PublisherShelfCategoryId>>({});
  const [categoryFilter, setCategoryFilter] = useState<'all' | PublisherShelfCategoryId>('all');
  const [titleQuery, setTitleQuery] = useState('');

  const loadClassrooms = useCallback(async () => {
    try {
      const list = await listStages();
      const realIds = new Set(list.map((c) => c.id));
      const mocks = MY_COURSES_MOCK.filter((m) => !realIds.has(m.id));
      const merged = [...mocks, ...list];
      setClassrooms(merged);
      if (list.length > 0) {
        const slides = await getFirstSlideByStages(list.map((c) => c.id));
        setThumbnails(slides);
      }
    } catch (err) {
      log.error('Failed to load classrooms:', err);
    }
  }, []);

  useEffect(() => {
    useMediaGenerationStore.getState().revokeObjectUrls();
    useMediaGenerationStore.setState({ tasks: {} });
    void loadClassrooms();
  }, [loadClassrooms]);

  useEffect(() => {
    setPublishFilterReady(true);
    setShelfMap(readShelfCategoryMap());
  }, []);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingDeleteId(id);
  };

  const confirmDelete = async (id: string) => {
    setPendingDeleteId(null);
    if (isPublisherMockCourse(id)) {
      setClassrooms((prev) => prev.filter((c) => c.id !== id));
      setShelfMap((prev) => {
        const next = { ...prev };
        delete next[id];
        writeShelfCategoryMap(next);
        return next;
      });
      return;
    }
    try {
      await deleteStageData(id);
      setShelfMap((prev) => {
        const next = { ...prev };
        delete next[id];
        writeShelfCategoryMap(next);
        return next;
      });
      await loadClassrooms();
      setShelfMap(readShelfCategoryMap());
    } catch (err) {
      log.error('Failed to delete classroom:', err);
      toast.error('Failed to delete classroom');
    }
  };

  const handleRename = async (id: string, newName: string) => {
    if (isPublisherMockCourse(id)) {
      setClassrooms((prev) => prev.map((c) => (c.id === id ? { ...c, name: newName } : c)));
      return;
    }
    try {
      await renameStage(id, newName);
      setClassrooms((prev) => prev.map((c) => (c.id === id ? { ...c, name: newName } : c)));
    } catch (err) {
      log.error('Failed to rename classroom:', err);
      toast.error(t('classroom.renameFailed'));
    }
  };

  const handleShelfCategoryChange = (courseId: string, category: PublisherShelfCategoryId) => {
    setShelfMap((prev) => setShelfCategoryInStorage(courseId, category, prev));
  };

  const sorted = useMemo(
    () => sortMyCourses([...classrooms], 'createdAtDesc'),
    [classrooms],
  );

  const publishFiltered = useMemo(() => {
    if (!publishFilterReady) return [];
    if (publishTab === 'all') return sorted;
    const want: PublisherCourseStatus = publishTab === 'published' ? 'published' : 'draft';
    return sorted.filter((c) => resolvePublishStatus(c) === want);
  }, [sorted, publishTab, publishFilterReady]);

  const listFiltered = useMemo(() => {
    let list = publishFiltered;
    if (categoryFilter !== 'all') {
      list = list.filter(
        (c) => resolveShelfCategory(c.id, shelfMap, c.name) === categoryFilter,
      );
    }
    if (titleQuery.trim()) {
      list = list.filter((c) => titleMatchesQuery(c.name, titleQuery));
    }
    return list;
  }, [publishFiltered, categoryFilter, titleQuery, shelfMap]);

  const tabCounts = useMemo(() => {
    if (!publishFilterReady) {
      return { all: 0, published: 0, draft: 0 };
    }
    let published = 0;
    let draft = 0;
    for (const c of sorted) {
      const s = resolvePublishStatus(c);
      if (s === 'published') published += 1;
      else draft += 1;
    }
    return { all: sorted.length, published, draft };
  }, [sorted, publishFilterReady]);

  const categoryCounts = useMemo(() => {
    const counts: Record<PublisherShelfCategoryId, number> = {} as Record<
      PublisherShelfCategoryId,
      number
    >;
    for (const id of PUBLISHER_SHELF_CATEGORY_IDS) {
      counts[id] = 0;
    }
    for (const c of publishFiltered) {
      const cat = resolveShelfCategory(c.id, shelfMap, c.name);
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return counts;
  }, [publishFiltered, shelfMap]);

  const categoryOptions = useMemo(
    () =>
      PUBLISHER_SHELF_CATEGORY_IDS.map((id) => ({
        id,
        label: t(`home.mySpace.shelfCategories.${id}`),
      })),
    [t],
  );

  const showPublishEmpty =
    publishFilterReady && publishFiltered.length === 0 && publishTab !== 'all';

  return (
    <div className="min-h-[100dvh] w-full bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
        <div className="mb-8 flex flex-wrap items-center gap-4">
          <Link
            href="/"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            aria-label={t('home.mySpace.backHome')}
          >
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
            {t('home.tabs.myCourses')}
          </h1>
        </div>

        {sorted.length === 0 ? (
          <p className="py-16 text-center text-[13px] text-muted-foreground/70">
            {t('home.myCoursesEmpty')}
          </p>
        ) : !publishFilterReady ? (
          <div className="flex justify-center py-20 text-muted-foreground">
            <Loader2 className="size-8 animate-spin opacity-60" aria-hidden />
          </div>
        ) : (
          <>
            <Tabs
              value={publishTab}
              onValueChange={(v) => setPublishTab(v as MySpacePublishTab)}
              className="mb-4 w-full"
            >
              <TabsList
                variant="line"
                className="h-auto w-full max-w-2xl justify-start gap-1 p-0 flex-wrap"
              >
                <TabsTrigger value="all" className="rounded-lg px-4 py-2 text-[13px]">
                  {t('home.mySpace.tabAll')}
                  <span className="ml-1.5 tabular-nums text-muted-foreground/80">
                    ({tabCounts.all})
                  </span>
                </TabsTrigger>
                <TabsTrigger value="published" className="rounded-lg px-4 py-2 text-[13px]">
                  {t('home.mySpace.tabPublished')}
                  <span className="ml-1.5 tabular-nums text-muted-foreground/80">
                    ({tabCounts.published})
                  </span>
                </TabsTrigger>
                <TabsTrigger value="draft" className="rounded-lg px-4 py-2 text-[13px]">
                  {t('home.mySpace.tabUnpublished')}
                  <span className="ml-1.5 tabular-nums text-muted-foreground/80">
                    ({tabCounts.draft})
                  </span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="mb-7 flex flex-wrap items-center gap-3">
              <div className="relative min-w-0 flex-1 sm:max-w-md">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/55" />
                <input
                  type="search"
                  value={titleQuery}
                  onChange={(e) => setTitleQuery(e.target.value)}
                  placeholder={t('home.mySpace.searchTitlePlaceholder')}
                  className="h-9 w-full rounded-full border border-border/60 bg-background pl-9 pr-3 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/45 focus:border-violet-300/80"
                  aria-label={t('home.mySpace.searchTitlePlaceholder')}
                />
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-medium transition-colors',
                      categoryFilter !== 'all'
                        ? 'border-violet-400/70 bg-violet-100 text-violet-700 dark:bg-violet-900/35 dark:text-violet-200'
                        : 'border-border/60 bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                    )}
                  >
                    <span className="opacity-80">{t('home.mySpace.shelfCategoryLabel')}：</span>
                    <span>
                      {categoryFilter === 'all'
                        ? t('home.mySpace.categoryFilterAll')
                        : t(`home.mySpace.shelfCategories.${categoryFilter}`)}
                    </span>
                    <span className="tabular-nums text-muted-foreground/80">
                      (
                      {categoryFilter === 'all'
                        ? publishFiltered.length
                        : categoryCounts[categoryFilter] ?? 0}
                      )
                    </span>
                    <ChevronDown className="size-3.5 opacity-70" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  side="bottom"
                  sideOffset={6}
                  collisionPadding={12}
                  className="w-[min(calc(100vw-2rem),420px)] rounded-2xl border border-border/60 p-3 shadow-xl"
                >
                  <p className="mb-2 px-1 text-[11px] font-medium text-muted-foreground">
                    {t('home.mySpace.shelfCategoryLabel')}
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCategoryFilter('all')}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-left text-[12px] font-medium transition-colors',
                        categoryFilter === 'all'
                          ? 'border-violet-400/80 bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200'
                          : 'border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                      )}
                    >
                      {t('home.mySpace.categoryFilterAll')}
                      <span className="ml-1 tabular-nums opacity-80">
                        ({publishFiltered.length})
                      </span>
                    </button>
                    {PUBLISHER_SHELF_CATEGORY_IDS.map((id) => {
                      const count = categoryCounts[id] ?? 0;
                      const active = categoryFilter === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setCategoryFilter(id)}
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-left text-[12px] font-medium transition-colors',
                            active
                              ? 'border-violet-400/80 bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200'
                              : 'border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                            count === 0 && !active ? 'opacity-50' : '',
                          )}
                        >
                          {t(`home.mySpace.shelfCategories.${id}`)}
                          <span className="ml-1 tabular-nums opacity-80">({count})</span>
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>

              {categoryFilter !== 'all' ? (
                <button
                  type="button"
                  onClick={() => setCategoryFilter('all')}
                  className="text-[12px] text-muted-foreground/70 underline-offset-2 hover:text-foreground hover:underline"
                >
                  {t('home.mySpace.clearFilter')}
                </button>
              ) : null}
            </div>

            {showPublishEmpty ? (
              <p className="py-12 text-center text-[13px] text-muted-foreground/70">
                {publishTab === 'published'
                  ? t('home.mySpace.emptyPublished')
                  : t('home.mySpace.emptyUnpublished')}
              </p>
            ) : listFiltered.length === 0 ? (
              <p className="py-12 text-center text-[13px] text-muted-foreground/70">
                {t('home.mySpace.emptyFiltered')}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {listFiltered.map((classroom, i) => {
                  const mockVis = isPublisherMockCourse(classroom.id)
                    ? getMyCourseMockVisual(classroom.id)
                    : undefined;
                  const shelfCat = resolveShelfCategory(
                    classroom.id,
                    shelfMap,
                    classroom.name,
                  );
                  const isOverridden = !!shelfMap[classroom.id];
                  return (
                    <motion.div
                      key={classroom.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02, duration: 0.25, ease: 'easeOut' }}
                    >
                      <ClassroomCard<PublisherShelfCategoryId>
                        classroom={classroom}
                        slide={thumbnails[classroom.id]}
                        mockCover={
                          mockVis
                            ? { gradient: mockVis.coverGradient, emoji: mockVis.coverEmoji }
                            : undefined
                        }
                        shelfEdit={{
                          current: shelfCat,
                          isOverridden,
                          currentLabel: t(`home.mySpace.shelfCategories.${shelfCat}`),
                          options: categoryOptions,
                          onChange: (next) => handleShelfCategoryChange(classroom.id, next),
                        }}
                        onDelete={handleDelete}
                        onRename={handleRename}
                        confirmingDelete={pendingDeleteId === classroom.id}
                        onConfirmDelete={() => confirmDelete(classroom.id)}
                        onCancelDelete={() => setPendingDeleteId(null)}
                        onClick={() => {
                          if (isPublisherMockCourse(classroom.id)) {
                            router.push(
                              `/classroom/${OPENMAIC_DEMO_CLASSROOM_ID}?mode=edit-preview`,
                            );
                            return;
                          }
                          router.push(`/classroom/${classroom.id}?mode=edit-preview`);
                        }}
                      />
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
