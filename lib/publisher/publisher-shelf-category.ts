/**
 * B-side publisher「图书货架」分类（出版社可在「我的空间」手动调整；演示存 localStorage）。
 */

export const PUBLISHER_SHELF_CATEGORY_IDS = [
  'primary_school',
  'middle_school',
  'high_school',
  'wellness_lifestyle',
  'children',
  'english_exam',
  'computer',
  'postgraduate',
  'college_textbook',
  'study_abroad',
  'english_plus',
  'minor_languages',
  'vocational_qual',
  'architecture',
  'medicine',
  'finance_accounting',
  'civil_service',
  'arts',
  'other',
] as const;

export type PublisherShelfCategoryId = (typeof PUBLISHER_SHELF_CATEGORY_IDS)[number];

export const DEFAULT_PUBLISHER_SHELF_CATEGORY: PublisherShelfCategoryId = 'other';

export function isPublisherShelfCategoryId(v: unknown): v is PublisherShelfCategoryId {
  return typeof v === 'string' && (PUBLISHER_SHELF_CATEGORY_IDS as readonly string[]).includes(v);
}

/** 演示课默认分类（与 mock id 对应） */
export const MOCK_COURSE_SHELF_CATEGORY: Record<string, PublisherShelfCategoryId> = {
  'mock-publisher-physics': 'high_school',
  'mock-publisher-bio': 'high_school',
  'mock-publisher-history': 'college_textbook',
  'mock-publisher-coding': 'computer',
  'mock-publisher-chinese': 'high_school',
  'mock-publisher-uncat': 'other',
};

/**
 * Front-end stand-in for the AI auto-classifier.
 * Deterministic keyword rules over course/book name; first match wins.
 * One book maps to exactly one category — no overlap.
 */
const AI_NAME_RULES: Array<[RegExp, PublisherShelfCategoryId]> = [
  [/(高校|大学教材|研究生院|讲义|课件|学院教材|高等教育)/, 'college_textbook'],
  [/(雅思|托福|GRE|GMAT|四六级|大学英语|英语等级|英语考试|考博英语|考研英语)/i, 'english_exam'],
  [/(留学|海外|出国)/, 'study_abroad'],
  [/(法语|德语|日语|西班牙语|韩语|俄语|葡萄牙语|意大利语|阿拉伯语|小语种)/, 'minor_languages'],
  [/(英语口语|英语阅读|英语写作|英语提升|商务英语|英语听力)/, 'english_plus'],
  [/(Python|JavaScript|Java\b|计算机|编程|算法|数据结构|机器学习|深度学习|前端|后端|数据库|代码|程序设计|软件|系统|网络|信息安全)/i, 'computer'],
  [/(执业|资格证|二级建造|一级建造|教师资格|心理咨询师|健康管理师)/, 'vocational_qual'],
  [/(医学|医药|药学|临床|护理|中医|药理|内科|外科|检验|影像)/, 'medicine'],
  [/(建筑|土木|结构|施工|景观|城市规划|建造)/, 'architecture'],
  [/(财务|会计|金融|审计|证券|基金|经济|理财|银行|税法|CPA|CFA|ACCA)/i, 'finance_accounting'],
  [/(公务员|国考|省考|事业单位|申论|行测)/, 'civil_service'],
  [/(美术|绘画|音乐|舞蹈|声乐|钢琴|书法|摄影|设计|油画|水彩|动漫|插画|艺术)/, 'arts'],
  [/(养生|健身|食谱|菜谱|心理|睡眠|减肥|瑜伽|健康|生活|护肤|两性|亲子|育儿)/, 'wellness_lifestyle'],
  [/(少儿|绘本|童话|启蒙|儿童|低龄|宝宝|幼儿)/, 'children'],
  [/(考研|研究生|MBA|硕士|博士)/, 'postgraduate'],
  [/(高中|高考|高一|高二|高三)/, 'high_school'],
  [/(初中|中考|初一|初二|初三)/, 'middle_school'],
  [/(小学|拼音|低年级|一年级|二年级|三年级|四年级|五年级|六年级)/, 'primary_school'],
];

/** AI 自动判断（演示用，按课程名称命中关键字；命中不到则归为「其他」）。 */
export function inferShelfCategoryByName(name: string): PublisherShelfCategoryId {
  const trimmed = name?.trim();
  if (!trimmed) return DEFAULT_PUBLISHER_SHELF_CATEGORY;
  for (const [re, id] of AI_NAME_RULES) {
    if (re.test(trimmed)) return id;
  }
  return DEFAULT_PUBLISHER_SHELF_CATEGORY;
}

/**
 * 优先级：出版商手动覆盖 > 演示课内置默认 > AI 名称推断 > 「其他」。
 */
export function resolveShelfCategory(
  courseId: string,
  overrides: Readonly<Record<string, PublisherShelfCategoryId>>,
  courseName?: string,
): PublisherShelfCategoryId {
  const fromStore = overrides[courseId];
  if (fromStore && isPublisherShelfCategoryId(fromStore)) return fromStore;
  if (MOCK_COURSE_SHELF_CATEGORY[courseId]) return MOCK_COURSE_SHELF_CATEGORY[courseId];
  if (courseName) return inferShelfCategoryByName(courseName);
  return DEFAULT_PUBLISHER_SHELF_CATEGORY;
}
