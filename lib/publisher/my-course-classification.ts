import type { CourseCategory } from '@/lib/mock/discover-courses';
import { MY_COURSES_MOCK_PREFIX } from '@/lib/mock/my-courses-mock';

/** 我的课程 — 胶囊筛选值 */
export type MyCoursesCategoryFilter = 'all' | 'uncategorized' | CourseCategory;

export type MyCoursesSortId =
  | 'createdAtDesc'
  | 'createdAtAsc'
  | 'updatedAtDesc'
  | 'scanActivity'
  | 'namePinyin';

export interface MyCourseAiMeta {
  /** RAG 自动打标（演示数据）；空数组表示「未分类」 */
  aiCategories: CourseCategory[];
  /** C 端扫码/打开活跃度 mock，用于排序 */
  scanActivity: number;
}

/**
 * 演示用 AI 标签；真实课堂无记录时视为未分类，活跃度为 0。
 * 正式环境由后端写入后替换此映射。
 */
const MOCK_AI_META: Record<string, MyCourseAiMeta> = {
  [`${MY_COURSES_MOCK_PREFIX}physics`]: {
    aiCategories: ['physics', 'math'],
    scanActivity: 1280,
  },
  [`${MY_COURSES_MOCK_PREFIX}bio`]: {
    aiCategories: ['biology', 'chemistry'],
    scanActivity: 640,
  },
  [`${MY_COURSES_MOCK_PREFIX}history`]: {
    aiCategories: ['history'],
    scanActivity: 2100,
  },
  [`${MY_COURSES_MOCK_PREFIX}coding`]: {
    aiCategories: ['coding', 'math'],
    scanActivity: 920,
  },
  [`${MY_COURSES_MOCK_PREFIX}chinese`]: {
    aiCategories: ['chinese', 'kaoyan'],
    scanActivity: 1540,
  },
  [`${MY_COURSES_MOCK_PREFIX}uncat`]: {
    aiCategories: [],
    scanActivity: 45,
  },
};

export function getMyCourseAiMeta(courseId: string): MyCourseAiMeta {
  return MOCK_AI_META[courseId] ?? { aiCategories: [], scanActivity: 0 };
}

export function courseMatchesMyCategoryFilter(
  courseId: string,
  filter: MyCoursesCategoryFilter,
): boolean {
  const { aiCategories } = getMyCourseAiMeta(courseId);
  if (filter === 'all') return true;
  if (filter === 'uncategorized') return aiCategories.length === 0;
  return aiCategories.includes(filter);
}

export function collectMyCourseCategoryStats(classrooms: readonly { id: string }[]): {
  uncategorized: number;
  byCategory: Partial<Record<CourseCategory, number>>;
} {
  const byCategory: Partial<Record<CourseCategory, number>> = {};
  let uncategorized = 0;
  for (const c of classrooms) {
    const meta = getMyCourseAiMeta(c.id);
    if (meta.aiCategories.length === 0) uncategorized += 1;
    for (const cat of meta.aiCategories) {
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;
    }
  }
  return { uncategorized, byCategory };
}

/** 胶囊动态区：固定展示顺序，仅渲染计数 > 0 的学科 */
export const MY_COURSE_CATEGORY_ORDER: CourseCategory[] = [
  'kaoyan',
  'history',
  'math',
  'biology',
  'chemistry',
  'chinese',
  'english',
  'physics',
  'coding',
];

export interface MyCourseTreeGroup {
  id: string;
  /** i18n key */
  labelKey: string;
  categories: CourseCategory[];
}

/** 侧边栏一级 → 二级学科（适合书目很多时的导航） */
export const MY_COURSE_TREE_GROUPS: MyCourseTreeGroup[] = [
  {
    id: 'science',
    labelKey: 'home.myCourses.tree.science',
    categories: ['math', 'physics', 'chemistry', 'biology'],
  },
  {
    id: 'engineering',
    labelKey: 'home.myCourses.tree.engineering',
    categories: ['coding'],
  },
  {
    id: 'humanities',
    labelKey: 'home.myCourses.tree.humanities',
    categories: ['history', 'chinese', 'english', 'kaoyan'],
  },
];

export function sortMyCourses<T extends { id: string; name: string; createdAt: number; updatedAt: number }>(
  items: T[],
  sortId: MyCoursesSortId,
): T[] {
  const arr = [...items];
  const collator = new Intl.Collator(['zh-Hans', 'en'], { sensitivity: 'base', numeric: true });
  if (sortId === 'namePinyin') {
    arr.sort((a, b) => collator.compare(a.name || '', b.name || ''));
  } else if (sortId === 'createdAtAsc') {
    arr.sort((a, b) => a.createdAt - b.createdAt);
  } else if (sortId === 'createdAtDesc') {
    arr.sort((a, b) => b.createdAt - a.createdAt);
  } else if (sortId === 'updatedAtDesc') {
    arr.sort((a, b) => b.updatedAt - a.updatedAt);
  } else {
    arr.sort(
      (a, b) => getMyCourseAiMeta(b.id).scanActivity - getMyCourseAiMeta(a.id).scanActivity,
    );
  }
  return arr;
}
