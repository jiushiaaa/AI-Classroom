import type { StageListItem } from '@/lib/utils/stage-storage';

/** Prefix for demo-only rows in「我的课程」— 无真实 IndexedDB 数据 */
export const MY_COURSES_MOCK_PREFIX = 'mock-publisher-';

const now = () => Date.now();

export type MyCourseMockPublishDemo = 'draft' | 'published';

export interface MyCourseMockVisual {
  coverGradient: string;
  coverEmoji: string;
  demoPublishStatus: MyCourseMockPublishDemo;
}

const VISUAL: Record<string, MyCourseMockVisual> = {
  [`${MY_COURSES_MOCK_PREFIX}physics`]: {
    coverGradient:
      'from-sky-200 via-cyan-100 to-blue-200 dark:from-sky-900/50 dark:via-cyan-900/40 dark:to-blue-900/50',
    coverEmoji: '⚙️',
    demoPublishStatus: 'draft',
  },
  [`${MY_COURSES_MOCK_PREFIX}bio`]: {
    coverGradient:
      'from-emerald-200 via-teal-100 to-lime-100 dark:from-emerald-900/45 dark:via-teal-900/35 dark:to-lime-900/40',
    coverEmoji: '🌱',
    demoPublishStatus: 'published',
  },
  [`${MY_COURSES_MOCK_PREFIX}history`]: {
    coverGradient:
      'from-amber-200 via-orange-100 to-rose-100 dark:from-amber-900/40 dark:via-orange-900/35 dark:to-rose-900/40',
    coverEmoji: '📜',
    demoPublishStatus: 'published',
  },
  [`${MY_COURSES_MOCK_PREFIX}coding`]: {
    coverGradient:
      'from-yellow-200 via-amber-100 to-orange-100 dark:from-yellow-900/35 dark:via-amber-900/35 dark:to-orange-900/40',
    coverEmoji: '🐍',
    demoPublishStatus: 'draft',
  },
  [`${MY_COURSES_MOCK_PREFIX}chinese`]: {
    coverGradient:
      'from-fuchsia-200 via-violet-100 to-indigo-100 dark:from-fuchsia-900/40 dark:via-violet-900/40 dark:to-indigo-900/45',
    coverEmoji: '✍️',
    demoPublishStatus: 'published',
  },
  [`${MY_COURSES_MOCK_PREFIX}uncat`]: {
    coverGradient:
      'from-slate-200 via-zinc-100 to-neutral-200 dark:from-slate-800/50 dark:via-zinc-800/40 dark:to-neutral-800/50',
    coverEmoji: '📋',
    demoPublishStatus: 'draft',
  },
};

/** 演示课封面与发布态（与发现页一致的渐变 + emoji，不依赖缩略图） */
export function getMyCourseMockVisual(id: string): MyCourseMockVisual | undefined {
  return VISUAL[id];
}

/** 出版社工作台演示用课程（点击卡片会提示为演示数据） */
export const MY_COURSES_MOCK: StageListItem[] = [
  {
    id: `${MY_COURSES_MOCK_PREFIX}physics`,
    name: '高中物理 · 动量与能量守恒',
    description: '配套《力学基础》第三章',
    sceneCount: 14,
    createdAt: now() - 86400000 * 5,
    updatedAt: now() - 86400000,
    interactiveMode: true,
  },
  {
    id: `${MY_COURSES_MOCK_PREFIX}bio`,
    name: '光合作用与细胞呼吸',
    description: '必修一 · 分子与细胞',
    sceneCount: 9,
    createdAt: now() - 86400000 * 12,
    updatedAt: now() - 86400000 * 2,
    interactiveMode: false,
  },
  {
    id: `${MY_COURSES_MOCK_PREFIX}history`,
    name: '先秦儒学思想脉络',
    description: '选修 · 传统文化',
    sceneCount: 6,
    createdAt: now() - 86400000 * 20,
    updatedAt: now() - 86400000 * 3,
    interactiveMode: false,
  },
  {
    id: `${MY_COURSES_MOCK_PREFIX}coding`,
    name: 'Python 数据结构入门',
    description: '列表、字典与简单算法 — 配套实训',
    sceneCount: 11,
    createdAt: now() - 86400000 * 8,
    updatedAt: now() - 86400000,
    interactiveMode: true,
  },
  {
    id: `${MY_COURSES_MOCK_PREFIX}chinese`,
    name: '议论文论点提炼与升格',
    description: '高考写作 · 论点清晰化训练',
    sceneCount: 8,
    createdAt: now() - 86400000 * 15,
    updatedAt: now() - 86400000 * 4,
    interactiveMode: false,
  },
  {
    id: `${MY_COURSES_MOCK_PREFIX}uncat`,
    name: '未打标示例 · 编辑页可手动改分类',
    description: '演示「未分类」入口；正式环境由 RAG 打标或编辑页修正',
    sceneCount: 3,
    createdAt: now() - 86400000 * 2,
    updatedAt: now() - 3600000,
    interactiveMode: false,
  },
];

export function isPublisherMockCourse(id: string): boolean {
  return id.startsWith(MY_COURSES_MOCK_PREFIX);
}
