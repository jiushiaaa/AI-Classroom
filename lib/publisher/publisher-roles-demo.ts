/**
 * Demo-only role generator for the AgentBar "Auto Generate" tab.
 *
 * The demo never calls a real model — instead it picks roles from a curated
 * pool by interpreting the user's prompt with very simple rules:
 *
 *   - identity hint:
 *       contains "助教/教练/assistant"  → assistant
 *       contains "老师/主讲/teacher"    → assistant (we never expose a second
 *                                                   teacher; clamp to assistant)
 *       otherwise                        → student
 *
 *   - count hint:
 *       arabic digit + "个"   → that number (clamped 1..MAX)
 *       chinese number + "个" → mapped via CN_NUM_MAP
 *       otherwise              → 1
 *
 *   - keyword hints (optional, lightly biases template selection):
 *       好奇 / 思考 / 安静 / 活跃 / 严格 / 温柔 / 引导 / 复盘 / 应试 ...
 *
 * Templates are deterministic but seeded by `Date.now() + index` to avoid
 * always producing the same row order across multiple generations.
 */

import {
  PUBLISHER_CUSTOM_ROLES_MAX,
  PUBLISHER_VOICE_GROUPS,
  newPublisherRoleId,
  pickPublisherAvatar,
  type PublisherCustomRoleRow,
  type PublisherIdentityRole,
} from '@/lib/publisher/publisher-custom-roles';

interface RoleTemplate {
  name: string;
  /** Short style tag — surfaced as a chip below the persona text */
  style: string;
  persona: string;
  /** Voice id from PUBLISHER_VOICE_GROUPS — chosen to fit the style */
  voiceId: string;
  /** Bias keywords; matching keywords increase pick weight */
  bias?: string[];
}

const STUDENT_TEMPLATES: RoleTemplate[] = [
  {
    name: '小诺',
    style: '好奇宝宝',
    persona:
      '总是带着一长串「为什么」，喜欢追根究底。遇到不懂的概念会从最基础的角度反复发问，不在意问题是否显得「太简单」，常说：「老师，这个为什么不是另一种情况呢？」',
    voiceId: 'cn-female-cute',
    bias: ['好奇', '提问', '为什么', '基础'],
  },
  {
    name: '小亮',
    style: '思考者',
    persona:
      '听到知识点会先沉默几秒，再用自己的话复述出来，时不时给出意想不到的类比或反例。喜欢在课堂里说：「我能不能换个说法描述一下，看大家是不是这个意思？」',
    voiceId: 'cn-male-young',
    bias: ['思考', '类比', '反思', '复述'],
  },
  {
    name: '小雨',
    style: '笔记员',
    persona:
      '喜欢用结构化的方式记录课堂要点，会在讨论时主动接话：「老师我整理一下，这一节的主线是…」帮其他同学梳理脉络与重点。',
    voiceId: 'cn-female-young',
    bias: ['笔记', '总结', '梳理', '结构'],
  },
  {
    name: '小阳',
    style: '活跃分子',
    persona:
      '对所有讨论都跃跃欲试，经常用生活实例去解释抽象概念，能把课堂气氛带起来；不怕答错，习惯用「我猜是不是…」开启发言。',
    voiceId: 'cn-male-cute',
    bias: ['活跃', '外向', '生活', '气氛'],
  },
  {
    name: '小宁',
    style: '安静观察者',
    persona:
      '不太主动发言，但被点到时往往能给出经过深思熟虑的回答，喜欢从其他人没注意到的角度审视问题，偶尔一句话点醒全场。',
    voiceId: 'cn-female-warm',
    bias: ['安静', '内向', '观察', '深思'],
  },
  {
    name: '小楠',
    style: '挑战者',
    persona:
      '喜欢质疑结论，擅长找出讲解中的反例或边界情况；常用「但是如果…呢？」推动课堂讨论走向更细的层次。',
    voiceId: 'cn-male-warm',
    bias: ['挑战', '质疑', '反例', '边界'],
  },
  {
    name: '小晗',
    style: '联想者',
    persona:
      '善于在不同学科 / 不同章节之间搭桥，能把当前知识点和已学过的内容自然关联起来，让讨论从单点变成网状。',
    voiceId: 'cn-female-young',
    bias: ['联想', '跨学科', '关联'],
  },
  {
    name: '小晨',
    style: '细节控',
    persona:
      '关注每一个数字、单位和措辞，会在课堂中提醒：「这里是不是应该说成…？」帮整场讨论保持精确。',
    voiceId: 'cn-male-young',
    bias: ['细节', '严谨', '数字', '措辞'],
  },
  {
    name: '小棠',
    style: '应试型学生',
    persona:
      '关心「这个考点考不考」「真题怎么考」，习惯用真题或模拟题反推老师讲的内容，常在课堂里追加：「这道题如果在卷子上出现要怎么写？」',
    voiceId: 'cn-female-warm',
    bias: ['考研', '考试', '应试', '高考', '中考'],
  },
];

const ASSISTANT_TEMPLATES: RoleTemplate[] = [
  {
    name: '阿乐',
    style: '温柔助教',
    persona:
      '语气温和耐心，擅长用鼓励性的语言帮助学生回顾要点；学生卡壳时会说「没关系，我们一起再来一遍，先看第一步」。',
    voiceId: 'cn-female-warm',
    bias: ['温柔', '鼓励', '耐心'],
  },
  {
    name: '阿哲',
    style: '严格教练',
    persona:
      '要求严格、节奏紧凑，会在学生回答模糊时立即追问：「请用一句话总结你刚才说的核心。」帮学生把表达打磨得更精炼。',
    voiceId: 'cn-male-warm',
    bias: ['严格', '紧凑', '教练'],
  },
  {
    name: '阿璇',
    style: '提问引导型',
    persona:
      '极少给出直接答案，更倾向用一连串引导性问题让学生自己得出结论：「你觉得这一步成立的前提是什么？」',
    voiceId: 'cn-female-young',
    bias: ['引导', '提问', '苏格拉底'],
  },
  {
    name: '阿明',
    style: '复盘小能手',
    persona:
      '每讨论完一个知识点就立刻做一次小结，把刚才的对话归纳成 2–3 条要点，并提示与前面知识的关联。',
    voiceId: 'cn-male-young',
    bias: ['复盘', '总结', '归纳'],
  },
  {
    name: '阿星',
    style: '应试教练',
    persona:
      '熟悉考试套路，会主动从「这道题在试卷上怎么考」「容易在哪一步丢分」的角度补充讲解，帮学生把知识转化为得分能力。',
    voiceId: 'cn-male-warm',
    bias: ['应试', '考试', '考研', '高考', '套路'],
  },
];

const CN_NUM_MAP: Readonly<Record<string, number>> = {
  一: 1,
  二: 2,
  两: 2,
  俩: 2,
  三: 3,
  四: 4,
  五: 5,
};

export interface ParsedPromptIntent {
  identity: PublisherIdentityRole;
  count: number;
  keywords: string[];
  /** Echo back the trimmed prompt for downstream usage */
  rawPrompt: string;
}

/**
 * Parse a free-form Chinese prompt into a structured intent. Pure / sync, so
 * it's easy to unit-test or call from a preview tooltip.
 */
export function parseAutoRolePrompt(prompt: string): ParsedPromptIntent {
  const text = prompt.trim();
  const lower = text.toLowerCase();

  let identity: PublisherIdentityRole = 'student';
  if (/(助教|教练|assistant)/i.test(lower)) {
    identity = 'assistant';
  } else if (/(老师|主讲|teacher)/i.test(lower)) {
    // We never expose a second teacher in the classroom; clamp to assistant.
    identity = 'assistant';
  }

  let count = 1;
  const arabicMatch = /(\d+)\s*个/.exec(text);
  const cnMatch = /([一二两俩三四五])\s*个/.exec(text);
  if (arabicMatch?.[1]) {
    count = Number.parseInt(arabicMatch[1], 10);
  } else if (cnMatch?.[1]) {
    count = CN_NUM_MAP[cnMatch[1]] ?? 1;
  }
  count = Math.min(PUBLISHER_CUSTOM_ROLES_MAX, Math.max(1, count));

  const keywordRe =
    /好奇|思考|外向|内向|捣蛋|安静|活跃|严格|温柔|细节|考研|高考|中考|高中|小学|初中|大学|挑战|引导|复盘|应试|提问|总结|笔记/g;
  const keywords = Array.from(new Set(text.match(keywordRe) ?? []));

  return { identity, count, keywords, rawPrompt: text };
}

function pickWeightedDistinct(
  templates: RoleTemplate[],
  keywords: string[],
  count: number,
  seed: number,
): RoleTemplate[] {
  const remaining = [...templates];
  const result: RoleTemplate[] = [];
  let cursor = seed;
  for (let i = 0; i < count && remaining.length > 0; i++) {
    const weights = remaining.map((tpl) => {
      const matches = tpl.bias?.filter((b) => keywords.includes(b)).length ?? 0;
      return 1 + matches * 3;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    cursor = (cursor * 1103515245 + 12345) >>> 0;
    let pivot = (cursor % 100000) / 100000 * total;
    let idx = 0;
    for (; idx < weights.length; idx++) {
      pivot -= weights[idx]!;
      if (pivot <= 0) break;
    }
    if (idx >= remaining.length) idx = remaining.length - 1;
    result.push(remaining.splice(idx, 1)[0]!);
  }
  return result;
}

function templateToRow(tpl: RoleTemplate, identity: PublisherIdentityRole): PublisherCustomRoleRow {
  const id = newPublisherRoleId();
  const fallbackVoice =
    PUBLISHER_VOICE_GROUPS[0]?.voices[0]?.id ??
    PUBLISHER_VOICE_GROUPS[1]?.voices[0]?.id ??
    'cn-female-warm';
  return {
    id,
    displayName: tpl.name,
    identity,
    prompt: tpl.persona,
    voiceId: tpl.voiceId || fallbackVoice,
    avatar: pickPublisherAvatar(identity, id),
    enabled: true,
  };
}

export interface GenerateRolesOptions {
  /** Already-existing rows; total + new must stay ≤ MAX. */
  existing: number;
  /** Override the AbortController-style cancellation. */
  signal?: AbortSignal;
  /** Override randomness — used by tests. */
  seedOverride?: number;
  /** Override think delay (ms). Default 800–1500ms. */
  delayOverride?: number;
}

export interface GenerateRolesResult {
  intent: ParsedPromptIntent;
  rows: PublisherCustomRoleRow[];
  /** True when the intent's requested count was clamped down to fit capacity. */
  clamped: boolean;
}

/**
 * Local mock generator. Returns 1..N freshly built `PublisherCustomRoleRow`s
 * with avatars assigned. Never throws unless the prompt is empty.
 */
export async function generateAutoRolesDemo(
  prompt: string,
  opts: GenerateRolesOptions,
): Promise<GenerateRolesResult> {
  const intent = parseAutoRolePrompt(prompt);
  if (!intent.rawPrompt) {
    throw new Error('EMPTY_PROMPT');
  }
  const remaining = Math.max(0, PUBLISHER_CUSTOM_ROLES_MAX - opts.existing);
  if (remaining === 0) {
    throw new Error('CAPACITY_FULL');
  }
  const requestedCount = Math.min(intent.count, remaining);

  const delay = opts.delayOverride ?? 800 + Math.floor(Math.random() * 700);
  await sleepWithSignal(delay, opts.signal);

  const pool = intent.identity === 'assistant' ? ASSISTANT_TEMPLATES : STUDENT_TEMPLATES;
  const seed = opts.seedOverride ?? Date.now();
  const templates = pickWeightedDistinct(pool, intent.keywords, requestedCount, seed);
  const rows = templates.map((tpl) => templateToRow(tpl, intent.identity));

  return {
    intent,
    rows,
    clamped: requestedCount < intent.count,
  };
}

function sleepWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const id = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Suggested example prompts shown as quick chips below the input. */
export const AUTO_ROLES_EXAMPLE_PROMPTS: readonly string[] = Object.freeze([
  '生成一个爱提问的学生',
  '生成 2 个性格内向的学生',
  '生成一个温柔的助教',
  '生成 3 个考研学生',
  '生成一个挑战型学生',
]);
