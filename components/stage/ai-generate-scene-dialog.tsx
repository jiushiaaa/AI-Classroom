'use client';

/**
 * AIGenerateSceneDialog
 * ----------------------
 * Mock "AI 辅助生成" flow used by AddScenePopover. Two interaction paths:
 *
 *  - **Pick a module type** (讲解PPT / 测试题 / 模拟实验 / 游戏动画 / 在线编程 / 项目挑战 / 思维导图)
 *    → the scene template is fixed by the module; the textarea becomes an
 *    optional refinement (e.g. "再增加一道关于光合作用的简答题"). Mirrors the
 *    selectable items shown in the homepage GenerationConfigPopover so the
 *    publisher's mental model carries over.
 *  - **No module** → freeform topic. The slide preset is picked
 *    deterministically from the prompt's first character (4 PPT presets:
 *    科普 / 历史 / 语文 / 数学) so the same prompt always replays the same
 *    scene during demo runs.
 *
 * No real model traffic — keeps the demo offline-safe and obvious in code
 * review (`isMock = true`). The fake 2 s progress bar is purely decorative.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Wand2,
  BookOpen,
  CircleHelp,
  FlaskConical,
  Gamepad2,
  Code,
  Target,
  Brain,
  Check,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useStageStore } from '@/lib/store';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';
import type { Scene, SlideContent } from '@/lib/types/stage';
import type { Slide, SlideTheme, PPTElement } from '@/lib/types/slides';
import type { PBLProjectConfig } from '@/lib/pbl/types';

interface AIGenerateSceneDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /**
   * When set, the generated scene is inserted at this index in the scenes
   * array (later scenes shift down). Omit to append at the end. Used by the
   * sidebar's "insert between two slides" affordance.
   */
  readonly insertIndex?: number;
}

/* ─────────────────────────── Module catalog ─────────────────────────── */

type ModuleId =
  | 'explanationPpt'
  | 'testQuestions'
  | 'simulation'
  | 'gameAnimation'
  | 'onlineCoding'
  | 'projectChallenge'
  | 'mindMap';

interface ModuleDef {
  id: ModuleId;
  icon: LucideIcon;
  /** Tailwind classes applied when the chip is selected. */
  selectedClass: string;
  /** Tailwind classes for the icon badge when selected. */
  iconBgClass: string;
}

const MODULES: ModuleDef[] = [
  {
    id: 'explanationPpt',
    icon: BookOpen,
    selectedClass: 'border-violet-400 bg-violet-50 dark:bg-violet-900/30 ring-violet-300/60',
    iconBgClass: 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300',
  },
  {
    id: 'testQuestions',
    icon: CircleHelp,
    selectedClass: 'border-amber-400 bg-amber-50 dark:bg-amber-900/30 ring-amber-300/60',
    iconBgClass: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300',
  },
  {
    id: 'simulation',
    icon: FlaskConical,
    selectedClass: 'border-cyan-400 bg-cyan-50 dark:bg-cyan-900/30 ring-cyan-300/60',
    iconBgClass: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-300',
  },
  {
    id: 'gameAnimation',
    icon: Gamepad2,
    selectedClass: 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 ring-emerald-300/60',
    iconBgClass: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300',
  },
  {
    id: 'onlineCoding',
    icon: Code,
    selectedClass: 'border-rose-400 bg-rose-50 dark:bg-rose-900/30 ring-rose-300/60',
    iconBgClass: 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300',
  },
  {
    id: 'projectChallenge',
    icon: Target,
    selectedClass: 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 ring-indigo-300/60',
    iconBgClass: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300',
  },
  {
    id: 'mindMap',
    icon: Brain,
    selectedClass: 'border-sky-400 bg-sky-50 dark:bg-sky-900/30 ring-sky-300/60',
    iconBgClass: 'bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300',
  },
];

/* ──────────────────────────── Theme & helpers ──────────────────────────── */

const BASE_THEME: SlideTheme = {
  backgroundColor: '#ffffff',
  themeColors: ['#7c3aed', '#2563eb', '#64748b', '#f59e0b', '#10b981'],
  fontColor: '#1e293b',
  fontName: 'Microsoft Yahei',
};

function makeSlideCanvas(sceneId: string, elements: PPTElement[]): Slide {
  return {
    id: `ai-gen-canvas-${sceneId}`,
    viewportSize: 1000,
    viewportRatio: 0.5625,
    theme: BASE_THEME,
    elements,
  };
}

function titleElement(sceneId: string, title: string): PPTElement {
  return {
    type: 'text',
    id: `ai-gen-title-${sceneId}`,
    content: title,
    left: 48,
    top: 48,
    width: 904,
    height: 80,
    rotate: 0,
    defaultFontName: BASE_THEME.fontName,
    defaultColor: BASE_THEME.fontColor,
    textType: 'title',
  };
}

function bulletsElement(sceneId: string, bullets: string[]): PPTElement {
  return {
    type: 'text',
    id: `ai-gen-body-${sceneId}`,
    content: bullets.map((line) => `<p>${line}</p>`).join(''),
    left: 48,
    top: 152,
    width: 904,
    height: 320,
    rotate: 0,
    defaultFontName: BASE_THEME.fontName,
    defaultColor: '#475569',
    textType: 'content',
  };
}

function makeSlideContent(sceneId: string, title: string, bullets: string[]): SlideContent {
  return {
    type: 'slide',
    canvas: makeSlideCanvas(sceneId, [titleElement(sceneId, title), bulletsElement(sceneId, bullets)]),
  };
}

/* ─────────────── Legacy presets (no-module / freeform path) ─────────────── */

interface PresetTemplate {
  category: 'science' | 'history' | 'chinese' | 'math';
  /** Bullets are templated against the publisher's topic. */
  bullets: (topic: string) => string[];
}

const PRESETS: PresetTemplate[] = [
  {
    category: 'science',
    bullets: (topic) => [
      `· 现象观察：${topic}是怎么发生的？`,
      `· 原理拆解：背后的关键变量与因果链。`,
      `· 案例延伸：生活中你能找到哪些相似现象？`,
    ],
  },
  {
    category: 'history',
    bullets: (topic) => [
      `· 时间线：与"${topic}"相关的关键节点。`,
      `· 人物群像：他们各自的立场与选择。`,
      `· 历史回响：今天我们能从中读出什么？`,
    ],
  },
  {
    category: 'chinese',
    bullets: (topic) => [
      `· 文本细读：作者如何写${topic}？`,
      `· 修辞手法：选取一处亮句逐字品味。`,
      `· 共情迁移：你会用怎样的语言表达类似情感？`,
    ],
  },
  {
    category: 'math',
    bullets: (topic) => [
      `· 概念定义：什么是${topic}？`,
      `· 推导路径：核心公式如何被构造出来？`,
      `· 例题精讲：一道典型题的完整解法。`,
    ],
  },
];

/** Deterministic preset pick so the same prompt always produces the same scene. */
function pickPreset(topic: string): PresetTemplate {
  const seed = topic.trim().codePointAt(0) ?? 0;
  return PRESETS[seed % PRESETS.length];
}

/* ─────────────────── Per-module scene builders (mock) ─────────────────── */

interface SceneBuildContext {
  stageId: string;
  sceneId: string;
  order: number;
  /** Final scene title (already non-empty by this point). */
  title: string;
  /** The publisher's typed-in refinement, may be empty. */
  refinement: string;
}

function buildPPTScene({ stageId, sceneId, order, title, refinement }: SceneBuildContext): Scene {
  const topic = refinement || title;
  const bullets = pickPreset(topic).bullets(topic);
  return {
    id: sceneId,
    stageId,
    type: 'slide',
    title,
    order,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    actions: [],
    content: makeSlideContent(sceneId, title, bullets),
  };
}

function buildMindMapScene({ stageId, sceneId, order, title }: SceneBuildContext): Scene {
  return {
    id: sceneId,
    stageId,
    type: 'slide',
    title,
    order,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    actions: [],
    content: {
      type: 'slide',
      canvas: makeSlideCanvas(sceneId, [
        titleElement(sceneId, title),
        {
          type: 'text',
          id: `ai-gen-mm-hint-${sceneId}`,
          content:
            '<p style="color:#64748b;font-size:14px;line-height:1.7">从中心主题出发，梳理主分支与关键词；可继续补充子节点与跨分支联系。</p>',
          left: 48,
          top: 152,
          width: 904,
          height: 72,
          rotate: 0,
          defaultFontName: BASE_THEME.fontName,
          defaultColor: '#64748b',
          textType: 'content',
        },
        {
          type: 'shape',
          id: `ai-gen-mm-frame-${sceneId}`,
          left: 48,
          top: 240,
          width: 904,
          height: 272,
          rotate: 0,
          viewBox: [200, 200],
          path: 'M 0 0 L 200 0 L 200 200 L 0 200 Z',
          fill: '#faf5ff',
          fixedRatio: false,
          outline: { color: '#c4b5fd', style: 'dashed', width: 2 },
        },
      ]),
    },
  };
}

const GAME_HTML = (topic: string) => `<!DOCTYPE html><html lang="zh-CN"><head>
<meta charset="utf-8" />
<style>
  body { margin:0; font:14px/1.6 'Microsoft Yahei', system-ui, sans-serif;
         background: linear-gradient(135deg,#ecfdf5 0%, #f0fdfa 100%); color:#064e3b;
         min-height:100vh; padding:32px; }
  h1 { margin:0 0 4px; font-size:22px; color:#047857; }
  p.sub { margin:0 0 22px; color:#0f766e; font-size:13px; }
  .grid { display:grid; grid-template-columns: repeat(3, 1fr); gap:14px; }
  .card { aspect-ratio: 1.2; background:white; border-radius:14px;
          box-shadow:0 4px 18px rgba(16,185,129,.12);
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          font-size:16px; font-weight:600; color:#047857;
          cursor:pointer; transition:transform .15s, box-shadow .15s; }
  .card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(16,185,129,.18); }
  .card.flipped { background:linear-gradient(135deg,#10b981 0%, #14b8a6 100%); color:white; }
  .stat { margin-top:18px; font-size:13px; color:#0f766e; display:flex; gap:18px; }
</style></head><body>
<h1>🎮 知识闯关：${topic}</h1>
<p class="sub">点击卡片翻面记忆，连续点对 3 张即可解锁下一关。</p>
<div class="grid" id="grid"></div>
<div class="stat"><span>已答对 <b id="ok">0</b> / 6</span><span>用时 <b id="time">0</b>s</span></div>
<script>
const items = ['概念','原理','公式','例题','应用','延伸'];
const grid = document.getElementById('grid');
items.forEach((it,i)=>{
  const d = document.createElement('div');
  d.className = 'card'; d.dataset.i = i; d.textContent = '?';
  d.onclick = () => {
    if (d.classList.contains('flipped')) return;
    d.classList.add('flipped'); d.textContent = it;
    document.getElementById('ok').textContent =
      document.querySelectorAll('.card.flipped').length;
  };
  grid.appendChild(d);
});
let s = 0; setInterval(()=>{document.getElementById('time').textContent = ++s;}, 1000);
</script></body></html>`;

const CODE_HTML = (topic: string) => `<!DOCTYPE html><html lang="zh-CN"><head>
<meta charset="utf-8" />
<style>
  body { margin:0; font:14px/1.5 Consolas, 'Courier New', monospace;
         background:#0f172a; color:#e2e8f0; min-height:100vh; padding:24px; }
  h1 { font-family:'Microsoft Yahei',sans-serif; font-size:18px; color:#a78bfa; margin:0 0 12px; }
  pre { background:#1e293b; border-radius:10px; padding:16px; overflow:auto; font-size:13px; color:#cbd5e1; }
</style></head><body>
<h1>在线编程 · ${topic}</h1>
<pre>// Demo：根据提示修改下列函数\nfunction sum(a, b) {\n  return a + b;\n}\nconsole.log(sum(2, 3));</pre>
</body></html>`;

function buildOnlineCodingScene({ stageId, sceneId, order, title, refinement }: SceneBuildContext): Scene {
  const topic = refinement || title;
  return {
    id: sceneId,
    stageId,
    type: 'interactive',
    title,
    order,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    actions: [],
    content: {
      type: 'interactive',
      url: '',
      html: CODE_HTML(topic),
      widgetType: 'game',
      widgetConfig: {
        type: 'game',
        gameType: 'puzzle',
        description: `围绕"${topic}"的编程练习`,
        scoring: { correctPoints: 10 },
      },
      teacherActions: [],
      aiCommands: [],
    },
  };
}

function buildGameScene({ stageId, sceneId, order, title, refinement }: SceneBuildContext): Scene {
  const topic = refinement || title;
  return {
    id: sceneId,
    stageId,
    type: 'interactive',
    title,
    order,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    actions: [],
    content: {
      type: 'interactive',
      url: '',
      html: GAME_HTML(topic),
      widgetType: 'game',
      widgetConfig: {
        type: 'game',
        gameType: 'card',
        description: `面向"${topic}"的知识闯关小游戏`,
        scoring: { correctPoints: 10 },
      },
      teacherActions: [],
      aiCommands: [],
    },
  };
}

const SIM_HTML = (topic: string) => `<!DOCTYPE html><html lang="zh-CN"><head>
<meta charset="utf-8" />
<style>
  body { margin:0; padding:28px 32px; font:14px/1.6 'Microsoft Yahei', system-ui, sans-serif;
         background: linear-gradient(135deg,#eef2ff 0%, #f5f3ff 50%, #fdf4ff 100%);
         color:#1e293b; min-height:100vh; }
  h1 { margin:0 0 6px; font-size:22px; color:#5b21b6; }
  p.sub { margin:0 0 20px; color:#64748b; font-size:13px; }
  .panel { display:grid; grid-template-columns: 1fr 1fr; gap:24px; }
  .card { background:white; border-radius:14px; padding:18px;
          box-shadow:0 4px 20px rgba(124,58,237,.08); }
  .card h2 { font-size:14px; margin:0 0 14px; color:#475569;
             text-transform:uppercase; letter-spacing:.08em; }
  label { display:block; font-size:13px; margin-bottom:8px; color:#475569; }
  input[type=range] { width:100%; accent-color:#7c3aed; }
  .val { font-size:13px; color:#7c3aed; font-weight:600; }
  .out { display:flex; align-items:center; justify-content:center;
         font-size:32px; font-weight:700; color:#5b21b6;
         background:#f5f3ff; border-radius:12px; min-height:160px; }
</style></head><body>
<h1>🧪 仿真：${topic}</h1>
<p class="sub">拖动滑块即时观察输出变化，可作为课堂演示。</p>
<div class="panel">
  <div class="card"><h2>参数</h2>
    <label>输入 X (<span id="x_v" class="val">50</span>)</label>
    <input id="x" type="range" min="0" max="100" value="50" />
    <label style="margin-top:14px">系数 K (<span id="k_v" class="val">1.0</span>)</label>
    <input id="k" type="range" min="0" max="2" step="0.1" value="1" />
  </div>
  <div class="card"><h2>输出 Y</h2>
    <div class="out"><span id="y">50</span></div>
  </div>
</div>
<script>
const $x=document.getElementById('x'), $k=document.getElementById('k'), $y=document.getElementById('y');
function r(){const x=+$x.value,k=+$k.value;
  document.getElementById('x_v').textContent=x;
  document.getElementById('k_v').textContent=k.toFixed(1);
  $y.textContent=(x*k).toFixed(0);}
['input','change'].forEach(e=>{$x.addEventListener(e,r);$k.addEventListener(e,r);});r();
</script></body></html>`;

function buildSimulationScene(ctx: SceneBuildContext): Scene {
  const { stageId, sceneId, order, title, refinement } = ctx;
  const topic = refinement || title;
  return {
    id: sceneId,
    stageId,
    type: 'interactive',
    title,
    order,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    actions: [],
    content: {
      type: 'interactive',
      url: '',
      html: SIM_HTML(topic),
      widgetType: 'simulation',
      widgetConfig: {
        type: 'simulation',
        concept: topic,
        description: `围绕"${topic}"的可调参数仿真`,
        variables: [
          { name: 'X', label: '输入', min: 0, max: 100, default: 50 },
          { name: 'K', label: '系数', min: 0, max: 2, default: 1, step: 0.1 },
        ],
        teacherActions: [],
      },
      teacherActions: [],
      aiCommands: [],
    },
  };
}

function buildQuizScene({ stageId, sceneId, order, title, refinement }: SceneBuildContext): Scene {
  const topic = refinement || title;
  return {
    id: sceneId,
    stageId,
    type: 'quiz',
    title,
    order,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    actions: [],
    content: {
      type: 'quiz',
      questions: [
        {
          id: `${sceneId}-q1`,
          type: 'single',
          question: `下列关于"${topic}"的说法，哪一项是正确的？`,
          options: [
            { label: '与本主题无关的选项 A', value: 'A' },
            { label: `准确描述"${topic}"核心特征的选项`, value: 'B' },
            { label: '常见误区 C', value: 'C' },
            { label: '部分相关但不完整的选项 D', value: 'D' },
          ],
          answer: ['B'],
          analysis: `B 选项抓住了"${topic}"的核心特征。`,
          points: 2,
          hasAnswer: true,
        },
        {
          id: `${sceneId}-q2`,
          type: 'multiple',
          question: `以下哪些与"${topic}"密切相关？（多选）`,
          options: [
            { label: '相关项一', value: 'A' },
            { label: '相关项二', value: 'B' },
            { label: '干扰项', value: 'C' },
            { label: '相关项三', value: 'D' },
          ],
          answer: ['A', 'B', 'D'],
          analysis: 'C 是干扰项，其余三项均为相关概念。',
          points: 3,
          hasAnswer: true,
        },
        {
          id: `${sceneId}-q3`,
          type: 'short_answer',
          question: `请用一句话解释"${topic}"在本课中的意义。`,
          commentPrompt: '关键词：定义、原理、应用',
          points: 5,
          hasAnswer: false,
        },
      ],
    },
  };
}

function buildPBLProjectConfig(topic: string): PBLProjectConfig {
  return {
    projectInfo: {
      title: `关于"${topic}"的项目式学习`,
      description: `围绕"${topic}"开展一次小组合作探究，输出一份可交付的成果（报告 / 演示 / 原型）。`,
    },
    agents: [
      {
        name: '指导老师',
        actor_role: '项目导师',
        role_division: 'management',
        system_prompt: '负责整体进度把控，引导学生提出关键问题。',
        default_mode: 'chat',
        delay_time: 0,
        env: {},
        is_user_role: false,
        is_active: true,
        is_system_agent: true,
      },
      {
        name: '资料分析员',
        actor_role: '研究员',
        role_division: 'development',
        system_prompt: '负责检索资料、整理证据、做交叉验证。',
        default_mode: 'chat',
        delay_time: 0,
        env: {},
        is_user_role: false,
        is_active: true,
        is_system_agent: false,
      },
      {
        name: '汇报人',
        actor_role: '小组代表',
        role_division: 'development',
        system_prompt: '整合成果并面向班级展示。',
        default_mode: 'chat',
        delay_time: 0,
        env: {},
        is_user_role: true,
        is_active: true,
        is_system_agent: false,
      },
    ],
    issueboard: {
      agent_ids: [],
      issues: [
        {
          id: 'issue-1',
          title: '问题界定',
          description: `明确围绕"${topic}"想要解决的具体问题。`,
          person_in_charge: '资料分析员',
          participants: ['资料分析员', '汇报人'],
          notes: '',
          parent_issue: null,
          index: 0,
          is_done: false,
          is_active: true,
          generated_questions: '为什么这个问题值得探究？',
          question_agent_name: '指导老师',
          judge_agent_name: '指导老师',
        },
        {
          id: 'issue-2',
          title: '资料收集',
          description: '检索文献、案例与数据，建立证据库。',
          person_in_charge: '资料分析员',
          participants: ['资料分析员'],
          notes: '',
          parent_issue: null,
          index: 1,
          is_done: false,
          is_active: false,
          generated_questions: '哪些来源最值得参考？',
          question_agent_name: '指导老师',
          judge_agent_name: '指导老师',
        },
        {
          id: 'issue-3',
          title: '成果汇报',
          description: '整理结论并面向同学进行答辩。',
          person_in_charge: '汇报人',
          participants: ['指导老师', '资料分析员', '汇报人'],
          notes: '',
          parent_issue: null,
          index: 2,
          is_done: false,
          is_active: false,
          generated_questions: '同学最可能提哪三个问题？',
          question_agent_name: '指导老师',
          judge_agent_name: '指导老师',
        },
      ],
      current_issue_id: 'issue-1',
    },
    chat: { messages: [] },
    selectedRole: '汇报人',
  };
}

function buildPBLScene({ stageId, sceneId, order, title, refinement }: SceneBuildContext): Scene {
  const topic = refinement || title;
  return {
    id: sceneId,
    stageId,
    type: 'pbl',
    title,
    order,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    actions: [],
    content: {
      type: 'pbl',
      projectConfig: buildPBLProjectConfig(topic),
      aiCommands: [],
    },
  };
}

const MODULE_BUILDERS: Record<ModuleId, (ctx: SceneBuildContext) => Scene> = {
  explanationPpt: buildPPTScene,
  testQuestions: buildQuizScene,
  simulation: buildSimulationScene,
  gameAnimation: buildGameScene,
  onlineCoding: buildOnlineCodingScene,
  projectChallenge: buildPBLScene,
  mindMap: buildMindMapScene,
};

/* ─────────────────────────── Component ─────────────────────────── */

export function AIGenerateSceneDialog({
  open,
  onOpenChange,
  insertIndex,
}: AIGenerateSceneDialogProps) {
  const { t } = useI18n();
  const stage = useStageStore.use.stage();
  const scenes = useStageStore.use.scenes();
  const addScene = useStageStore.use.addScene();
  const insertSceneAt = useStageStore.use.insertSceneAt();
  const setCurrentSceneId = useStageStore.use.setCurrentSceneId();

  const [moduleId, setModuleId] = useState<ModuleId | null>(null);
  const [topic, setTopic] = useState('');
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset state every time the dialog reopens — avoids leaking previous run
  // state into the next invocation.
  useEffect(() => {
    if (!open) {
      setModuleId(null);
      setTopic('');
      setProgress(0);
      setPhase('idle');
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    }
  }, [open]);

  const trimmed = topic.trim();
  // With a module selected, the topic is optional — the module name itself
  // already conveys "what to insert". Without a module we need a topic so the
  // legacy preset has something to template against.
  const canGenerate = !!stage && !!(moduleId || trimmed) && phase !== 'running';

  const startMockGeneration = () => {
    if (!canGenerate || !stage) return;
    setPhase('running');
    setProgress(0);

    const start = Date.now();
    const total = 2000;
    tickRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const next = Math.min(100, Math.round((elapsed / total) * 100));
      setProgress(next);
      if (elapsed >= total) {
        if (tickRef.current) {
          clearInterval(tickRef.current);
          tickRef.current = null;
        }
        finalizeGeneration();
      }
    }, 60);
  };

  const finalizeGeneration = () => {
    if (!stage) return;
    const order = insertIndex ?? scenes.length;
    const sceneId = `ai-gen-${Date.now()}`;
    const refinement = trimmed;

    let title: string;
    if (moduleId) {
      const moduleName = t(`toolbar.generationConfig.items.${moduleId}.name`);
      title = refinement || moduleName;
    } else {
      title = refinement || t('sceneActions.newPageTitle');
    }

    const builder = MODULE_BUILDERS[moduleId ?? 'explanationPpt'];
    const built = builder({
      stageId: stage.id,
      sceneId,
      order,
      title,
      refinement,
    });

    if (insertIndex === undefined) {
      addScene(built);
    } else {
      insertSceneAt(built, insertIndex);
    }
    setCurrentSceneId(built.id);
    setPhase('done');
    toast.success(t('sceneActions.aiGenerateSuccess'), {
      description: title,
      icon: <Sparkles className="w-4 h-4" />,
    });
    // small delay so user sees the 100% bar before the dialog closes
    setTimeout(() => onOpenChange(false), 400);
  };

  const isRunning = phase === 'running';
  const selectedModule = moduleId ? MODULES.find((m) => m.id === moduleId) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={!isRunning}
        className={cn(
          'w-[min(calc(100vw-2rem),560px)] max-w-[min(calc(100vw-2rem),560px)] !p-0 !gap-0 overflow-hidden',
          'rounded-2xl border border-border/60 bg-white dark:bg-slate-900',
          'shadow-xl shadow-black/[0.06] dark:shadow-black/30 ring-1 ring-black/[0.03]',
          'max-h-[min(94dvh,820px)] flex flex-col',
        )}
      >
        <DialogHeader className="relative px-5 pt-5 pb-3 border-b border-border/50 shrink-0 text-left space-y-1.5 pr-14">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-purple-500/30 shrink-0">
              <Wand2 className="w-4 h-4" />
            </span>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-semibold pr-2">
                {t('sceneActions.aiGenerateDialogTitle')}
              </DialogTitle>
              <DialogDescription className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                {t('sceneActions.aiGenerateDialogDescription')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4">
          {/* Module type picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {t('sceneActions.aiModuleSectionTitle')}
              </span>
              {moduleId && !isRunning && (
                <button
                  type="button"
                  onClick={() => setModuleId(null)}
                  className="text-[11px] text-gray-500 hover:text-purple-600 dark:hover:text-purple-300 transition-colors"
                >
                  {t('sceneActions.aiClearModule')}
                </button>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {MODULES.map((m) => {
                const Icon = m.icon;
                const isSelected = moduleId === m.id;
                const name = t(`toolbar.generationConfig.items.${m.id}.name`);
                const desc = t(`toolbar.generationConfig.items.${m.id}.desc`);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModuleId(isSelected ? null : m.id)}
                    disabled={isRunning}
                    title={`${name} — ${desc}`}
                    className={cn(
                      'relative flex flex-col items-center gap-1.5 rounded-lg border p-2 text-center transition-all duration-150',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      isSelected
                        ? `${m.selectedClass} ring-2 shadow-sm`
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/40',
                    )}
                  >
                    {isSelected && (
                      <span className="absolute top-1 right-1 size-4 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-sm">
                        <Check className="size-2.5" strokeWidth={3} />
                      </span>
                    )}
                    <span
                      className={cn(
                        'size-8 rounded-md flex items-center justify-center transition-colors',
                        isSelected ? m.iconBgClass : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="text-[11px] font-semibold leading-tight text-gray-700 dark:text-gray-200 line-clamp-1">
                      {name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Topic / refinement textarea */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block">
              {selectedModule
                ? t('sceneActions.aiRefineLabel', {
                    module: t(`toolbar.generationConfig.items.${selectedModule.id}.name`),
                  })
                : t('sceneActions.topicLabel')}
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={
                selectedModule
                  ? t('sceneActions.aiRefinePlaceholder', {
                      module: t(`toolbar.generationConfig.items.${selectedModule.id}.name`),
                    })
                  : t('sceneActions.topicPlaceholder')
              }
              disabled={isRunning}
              rows={3}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-300 transition-all resize-none disabled:opacity-60"
            />
            {!selectedModule && !trimmed && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                {t('sceneActions.aiPickModuleHint')}
              </p>
            )}
          </div>

          <AnimatePresence>
            {isRunning && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <span className="relative flex w-2 h-2">
                      <span className="animate-ping absolute inset-0 rounded-full bg-purple-400/60" />
                      <span className="relative inline-flex rounded-full w-2 h-2 bg-purple-500" />
                    </span>
                    {t('sceneActions.aiGeneratingHint')}
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
                    style={{ width: `${progress}%` }}
                    transition={{ ease: 'linear', duration: 0.05 }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="flex-row items-center justify-end gap-3 border-t border-border/50 px-4 py-3 shrink-0 bg-muted/15">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRunning}
            className="rounded-full"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={startMockGeneration}
            disabled={!canGenerate}
            className="rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white border-0 px-5"
          >
            <Sparkles className="w-4 h-4 mr-1" />
            {isRunning ? t('sceneActions.aiGeneratingHint') : t('sceneActions.aiGenerateAction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
