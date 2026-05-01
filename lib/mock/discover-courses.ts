/**
 * Mock data for the "Discover" tab on the publisher home page.
 * Demo only — replace with real backend data later.
 */

export type CourseCategory =
  | 'kaoyan'
  | 'history'
  | 'math'
  | 'biology'
  | 'chemistry'
  | 'chinese'
  | 'english'
  | 'physics'
  | 'coding';

export interface DiscoverCourse {
  id: string;
  title: string;
  desc: string;
  category: CourseCategory;
  /** Tailwind gradient classes for the cover placeholder */
  coverGradient: string;
  /** Big emoji shown on the cover */
  coverEmoji: string;
  /** Optional badge text, e.g. "深度交互" */
  badge?: string;
  /** Last update (ms), shown on home discover cards */
  updatedAt: number;
}

export const DISCOVER_COURSES: DiscoverCourse[] = [
  {
    id: 'd-physics-lens',
    title: '凸透镜成像规律',
    desc: '调整物距观察成像变化，亲手探索凸透镜的奥秘。',
    category: 'physics',
    coverGradient: 'from-violet-200 via-violet-100 to-blue-100',
    coverEmoji: '🔭',
    badge: '深度交互',
    updatedAt: Date.UTC(2026, 3, 30, 9, 20),
  },
  {
    id: 'd-bio-photosynthesis',
    title: '光合作用 What is Photosynthesis',
    desc: '通过 3D 可视化与可调输入参数，理解光合作用的全过程。',
    category: 'biology',
    coverGradient: 'from-emerald-200 via-teal-100 to-lime-100',
    coverEmoji: '🌱',
    badge: '深度交互',
    updatedAt: Date.UTC(2026, 3, 30, 8, 55),
  },
  {
    id: 'd-chinese-writing',
    title: '如何写好传统文化类作文',
    desc: '从思路到成文，逐步拆解传统文化作文的写作方法。',
    category: 'chinese',
    coverGradient: 'from-amber-200 via-orange-100 to-rose-100',
    coverEmoji: '📜',
    updatedAt: Date.UTC(2026, 3, 30, 7, 40),
  },
  {
    id: 'd-math-conservation',
    title: '高中物理 - 动量与能量守恒',
    desc: '全景式生成的物理课，含习题、交互动画与讲解。',
    category: 'physics',
    coverGradient: 'from-sky-200 via-cyan-100 to-blue-200',
    coverEmoji: '⚙️',
    updatedAt: Date.UTC(2026, 3, 29, 10, 12),
  },
  {
    id: 'd-english-german',
    title: '德语语法之名词的性、数、格',
    desc: '最基础的德语语法之一，结合大量习题与详尽讲解。',
    category: 'english',
    coverGradient: 'from-indigo-200 via-purple-100 to-pink-100',
    coverEmoji: '🅰️',
    updatedAt: Date.UTC(2026, 3, 28, 6, 30),
  },
  {
    id: 'd-kaoyan-research',
    title: '如何培养科研品味',
    desc: '研究生入门必修：从选题到论文呈现的科研审美养成。',
    category: 'kaoyan',
    coverGradient: 'from-slate-200 via-zinc-100 to-stone-100',
    coverEmoji: '🎓',
    updatedAt: Date.UTC(2026, 3, 27, 11, 5),
  },
  {
    id: 'd-coding-python',
    title: '从零学 Python：30 分钟写出第一个程序',
    desc: '面向零基础读者，配套图书章节同步生成的入门课。',
    category: 'coding',
    coverGradient: 'from-yellow-200 via-amber-100 to-orange-100',
    coverEmoji: '🐍',
    badge: 'PPT + 测验',
    updatedAt: Date.UTC(2026, 3, 30, 9, 5),
  },
  {
    id: 'd-physics-stars',
    title: '《天文学引论》：恒星的诞生与演化',
    desc: '配套教材生成的恒星物理课，含 3D 仿真观测台。',
    category: 'physics',
    coverGradient: 'from-slate-900 via-indigo-900 to-purple-900',
    coverEmoji: '✨',
    badge: '深度交互',
    updatedAt: Date.UTC(2026, 3, 26, 14, 22),
  },
  {
    id: 'd-history-classics',
    title: '讲义《孔孟之道》：先秦儒学思想脉络',
    desc: '从孔子到孟子，思想史串讲，配套出版社讲义生成。',
    category: 'history',
    coverGradient: 'from-amber-300 via-amber-200 to-yellow-100',
    coverEmoji: '📚',
    updatedAt: Date.UTC(2026, 3, 25, 9, 0),
  },
  {
    id: 'd-chemistry-bond',
    title: '化学键与分子结构',
    desc: '通过 3D 分子模型与游戏化测验掌握化学键基本概念。',
    category: 'chemistry',
    coverGradient: 'from-rose-200 via-pink-100 to-fuchsia-100',
    coverEmoji: '⚗️',
    badge: '互动游戏',
    updatedAt: Date.UTC(2026, 3, 24, 16, 48),
  },
  {
    id: 'd-math-calculus',
    title: '《大学数学》：极限与导数初步',
    desc: '配套高校教材的微积分入门，含交互式可视化。',
    category: 'math',
    coverGradient: 'from-blue-200 via-sky-100 to-indigo-100',
    coverEmoji: '∫',
    updatedAt: Date.UTC(2026, 3, 23, 8, 15),
  },
  {
    id: 'd-english-grammar',
    title: '英语阅读 - 长难句拆解 12 讲',
    desc: '从主干到修饰逐层剖析，让长难句不再可怕。',
    category: 'english',
    coverGradient: 'from-cyan-200 via-teal-100 to-emerald-100',
    coverEmoji: '🗽',
    updatedAt: Date.UTC(2026, 3, 22, 12, 33),
  },
];
