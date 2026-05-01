/**
 * Mock book library — demo data used by the publisher home book picker.
 * Each book has a gradient/emoji cover, a title, and a list of chapters
 * that the publisher can pick to scope AI classroom generation.
 */

export interface MockBookChapter {
  id: string;
  title: string;
  /** Approximate page count for the chapter, used as a hint chip. */
  pages?: number;
}

export interface MockBook {
  id: string;
  title: string;
  /** Optional subtitle / publisher description. */
  subtitle?: string;
  /** Tailwind gradient classes for the placeholder cover. */
  coverGradient: string;
  /** Emoji rendered at center of the cover when no real image is present. */
  coverEmoji: string;
  /** Optional hex tint used as the cover top band (book title strip). */
  coverTint?: string;
  /** Coarse subject tag, displayed as a chip. */
  subject: string;
  chapters: MockBookChapter[];
}

export const MOCK_BOOKS: MockBook[] = [
  {
    id: 'mock-book-poetry-explore',
    title: '古诗带你去探秘',
    subtitle: '儿童古诗启蒙',
    coverGradient: 'from-indigo-500 via-violet-600 to-fuchsia-600',
    coverEmoji: '🌌',
    coverTint: '#312e81',
    subject: '语文',
    chapters: [
      { id: 'ch1', title: '床前明月光：从静夜思走进李白', pages: 6 },
      { id: 'ch2', title: '春晓里的清晨：感受孟浩然的春日', pages: 5 },
      { id: 'ch3', title: '游子吟与母爱：唐诗里的温度', pages: 7 },
      { id: 'ch4', title: '登鹳雀楼：诗中的望与登', pages: 6 },
      { id: 'ch5', title: '咏鹅与少年王勃：童年的诗心', pages: 5 },
    ],
  },
  {
    id: 'mock-book-cartoon-math',
    title: '漫画数学思维 1',
    subtitle: '漫画数学启蒙书 · 课本里的故事',
    coverGradient: 'from-emerald-300 via-lime-400 to-amber-300',
    coverEmoji: '🏠',
    coverTint: '#bef264',
    subject: '数学',
    chapters: [
      { id: 'ch1', title: '麦鱼风波', pages: 8 },
      { id: 'ch2', title: '蛇换开店', pages: 7 },
      { id: 'ch3', title: '巧吃包子', pages: 6 },
      { id: 'ch4', title: '智斗杯财王', pages: 9 },
      { id: 'ch5', title: '完美方案', pages: 8 },
      { id: 'ch6', title: '小饼，大智慧', pages: 7 },
      { id: 'ch7', title: '卖土豆', pages: 6 },
      { id: 'ch8', title: '消失的十元', pages: 8 },
    ],
  },
  {
    id: 'mock-book-cartoon-math-2',
    title: '漫画数学思维 2',
    subtitle: '漫画数学启蒙书 · 课本里的故事',
    coverGradient: 'from-amber-200 via-yellow-300 to-orange-300',
    coverEmoji: '📚',
    coverTint: '#facc15',
    subject: '数学',
    chapters: [
      { id: 'ch1', title: '分糖果的秘密', pages: 7 },
      { id: 'ch2', title: '面积大比拼', pages: 8 },
      { id: 'ch3', title: '小数点的奇遇', pages: 6 },
      { id: 'ch4', title: '钟表里的角度', pages: 7 },
      { id: 'ch5', title: '一笔画完的图', pages: 9 },
    ],
  },
  {
    id: 'mock-book-crossroads-youth',
    title: '岔路口的青春（精简版）',
    subtitle: '青春人物志 · 节选',
    coverGradient: 'from-slate-100 via-zinc-200 to-stone-200',
    coverEmoji: '👩‍🎓',
    coverTint: '#e5e7eb',
    subject: '语文',
    chapters: [
      { id: 'ch1', title: '林晓的志愿表', pages: 9 },
      { id: 'ch2', title: '父亲的旧自行车', pages: 8 },
      { id: 'ch3', title: '老师没说出口的话', pages: 7 },
      { id: 'ch4', title: '深夜的便利店', pages: 6 },
    ],
  },
  {
    id: 'mock-book-on',
    title: '43 On',
    subtitle: '英语阅读 · 绘本',
    coverGradient: 'from-orange-300 via-amber-400 to-yellow-300',
    coverEmoji: '🐒',
    coverTint: '#fdba74',
    subject: '英语',
    chapters: [
      { id: 'ch1', title: 'On the Box', pages: 4 },
      { id: 'ch2', title: 'On the Ball', pages: 5 },
      { id: 'ch3', title: 'On the Tree', pages: 4 },
      { id: 'ch4', title: 'On the Stage', pages: 6 },
    ],
  },
  {
    id: 'mock-book-doraemon-long',
    title: '哆啦A梦超长篇 2',
    subtitle: 'P544-545（图 + 文字）',
    coverGradient: 'from-sky-200 via-blue-300 to-indigo-300',
    coverEmoji: '🤖',
    coverTint: '#93c5fd',
    subject: '语文',
    chapters: [
      { id: 'ch1', title: '海底鬼岩城', pages: 12 },
      { id: 'ch2', title: '机器人王国', pages: 10 },
      { id: 'ch3', title: '云之王国', pages: 11 },
    ],
  },
];

export function getMockBook(id: string): MockBook | undefined {
  return MOCK_BOOKS.find((b) => b.id === id);
}
