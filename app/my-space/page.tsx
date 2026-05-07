'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { ArrowLeft, Search } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { createLogger } from '@/lib/logger';
import { ClassroomCard } from '@/components/publisher/classroom-card';
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

const log = createLogger('MySpace');

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

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingDeleteId(id);
  };

  const confirmDelete = async (id: string) => {
    setPendingDeleteId(null);
    if (isPublisherMockCourse(id)) {
      setClassrooms((prev) => prev.filter((c) => c.id !== id));
      return;
    }
    try {
      await deleteStageData(id);
      await loadClassrooms();
    } catch (err) {
      log.error('Failed to delete classroom:', err);
      toast.error('Failed to delete classroom');
    }
  };

  const handleRename = async (id: string, newName: string) => {
    const touch = Date.now();
    if (isPublisherMockCourse(id)) {
      setClassrooms((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name: newName, updatedAt: touch } : c)),
      );
      return;
    }
    try {
      await renameStage(id, newName);
      setClassrooms((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name: newName, updatedAt: touch } : c)),
      );
    } catch (err) {
      log.error('Failed to rename classroom:', err);
      toast.error(t('classroom.renameFailed'));
    }
  };

  const sorted = useMemo(
    () => sortMyCourses([...classrooms], 'updatedAtDesc'),
    [classrooms],
  );

  const listFiltered = useMemo(() => {
    if (!titleQuery.trim()) return sorted;
    return sorted.filter((c) => titleMatchesQuery(c.name, titleQuery));
  }, [sorted, titleQuery]);

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
        ) : (
          <>
            <div className="mb-6">
              <div className="relative max-w-md">
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
            </div>

            {listFiltered.length === 0 ? (
              <p className="py-12 text-center text-[13px] text-muted-foreground/70">
                {t('home.mySpace.emptyFiltered')}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {listFiltered.map((classroom, i) => {
                  const mockVis = isPublisherMockCourse(classroom.id)
                    ? getMyCourseMockVisual(classroom.id)
                    : undefined;
                  return (
                    <motion.div
                      key={classroom.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02, duration: 0.25, ease: 'easeOut' }}
                    >
                      <ClassroomCard
                        classroom={classroom}
                        slide={thumbnails[classroom.id]}
                        mockCover={
                          mockVis
                            ? { gradient: mockVis.coverGradient, emoji: mockVis.coverEmoji }
                            : undefined
                        }
                        showUpdatedAt
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
