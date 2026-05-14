import type { SceneOutline } from '@/lib/types/generation';
import type { Scene, SlideContent, Stage } from '@/lib/types/stage';
import type { Slide, SlideTheme, PPTElement } from '@/lib/types/slides';
import type { Action } from '@/lib/types/action';
import type { PBLProjectConfig } from '@/lib/pbl/types';

/** 固定 ID：访问 `/classroom/openmaic-demo-classroom` 加载内置示例，无需模型与生成流程 */
export const OPENMAIC_DEMO_CLASSROOM_ID = 'openmaic-demo-classroom';

export function isOpenmaicDemoClassroomId(id: string): boolean {
  return id === OPENMAIC_DEMO_CLASSROOM_ID;
}

/* ─────────────────────────── Theme ─────────────────────────── */

const DEMO_THEME: SlideTheme = {
  backgroundColor: '#f8fafc',
  themeColors: ['#7c3aed', '#2563eb', '#64748b', '#f59e0b', '#10b981'],
  fontColor: '#1e293b',
  fontName: 'Microsoft Yahei',
};

/** Common slide canvas envelope used by every slide scene. */
function makeSlide(id: string, elements: PPTElement[]): Slide {
  return {
    id,
    viewportSize: 1000,
    viewportRatio: 0.5625,
    theme: DEMO_THEME,
    elements,
  };
}

function wrapSlide(slide: Slide): SlideContent {
  return { type: 'slide', canvas: slide };
}

/* ─────────────────────── Element factories ─────────────────────── */

function textElement(opts: {
  id: string;
  content: string;
  left: number;
  top: number;
  width: number;
  height: number;
  textType?: 'title' | 'content' | 'subtitle' | 'item';
  defaultColor?: string;
}): PPTElement {
  return {
    type: 'text',
    id: opts.id,
    content: opts.content,
    left: opts.left,
    top: opts.top,
    width: opts.width,
    height: opts.height,
    rotate: 0,
    defaultFontName: DEMO_THEME.fontName,
    defaultColor: opts.defaultColor ?? DEMO_THEME.fontColor,
    textType: opts.textType,
  };
}

/* ─────────────────────────── Speech ─────────────────────────── */

function speechActions(sceneKey: string, sentences: string[]): Action[] {
  return sentences.map((text, i) => ({
    id: `demo-speech-${sceneKey}-${i + 1}`,
    type: 'speech',
    text,
  }));
}

/* ─────────────────────── Slide scene builders ─────────────────────── */

/** Scene 0 · 欢迎页（纯文本，演示文字编辑） */
function buildWelcomeScene(stageId: string, now: number): Scene {
  return {
    id: 'demo-scene-welcome',
    stageId,
    type: 'slide',
    title: '欢迎',
    order: 0,
    content: wrapSlide(
      makeSlide('demo-canvas-welcome', [
        textElement({
          id: 'demo-welcome-title',
          content: '<p><strong>云梯 AI 课堂</strong></p>',
          left: 60,
          top: 64,
          width: 880,
          height: 90,
          textType: 'title',
        }),
        textElement({
          id: 'demo-welcome-subtitle',
          content:
            '<p>面向出版商的图书伴学课堂演示</p><p>本页展示 <em>纯文本</em> 编辑能力，可点击工具栏「进入编辑」体验。</p>',
          left: 60,
          top: 170,
          width: 880,
          height: 140,
          textType: 'subtitle',
          defaultColor: '#475569',
        }),
        textElement({
          id: 'demo-welcome-tags',
          content:
            '<p>📝 文字 &nbsp;·&nbsp; 🖼️ 图片 &nbsp;·&nbsp; 📊 图表 &nbsp;·&nbsp; 🎬 视频 &nbsp;·&nbsp; ✏️ 题目 &nbsp;·&nbsp; 🤖 AI 调优</p>',
          left: 60,
          top: 360,
          width: 880,
          height: 60,
          defaultColor: '#7c3aed',
        }),
        textElement({
          id: 'demo-welcome-footer',
          content: '<p style="text-align:right">第 1 / 10 页 · 演示数据</p>',
          left: 60,
          top: 480,
          width: 880,
          height: 32,
          defaultColor: '#94a3b8',
        }),
      ]),
    ),
    actions: speechActions('welcome', [
      '欢迎来到云梯 AI 课堂的演示页面。',
      '在这里你将依次体验文字、图片、图表、视频、形状、公式、测验、互动模拟、项目协作的完整编辑能力。',
      '左侧是课堂大纲，右侧是讲解笔记，你可以随时点击修改本页的讲稿内容。',
    ]),
    createdAt: now,
    updatedAt: now,
  };
}

/** Scene 1 · 图片课件（演示图片编辑） */
function buildImageScene(stageId: string, now: number): Scene {
  return {
    id: 'demo-scene-image',
    stageId,
    type: 'slide',
    title: '图文混排',
    order: 1,
    content: wrapSlide(
      makeSlide('demo-canvas-image', [
        textElement({
          id: 'demo-image-title',
          content: '<p><strong>第 1 章：可再生能源概览</strong></p>',
          left: 48,
          top: 36,
          width: 904,
          height: 64,
          textType: 'title',
        }),
        {
          type: 'image',
          id: 'demo-image-photo',
          src: 'https://picsum.photos/seed/openmaic-energy/720/420',
          left: 48,
          top: 116,
          width: 520,
          height: 320,
          rotate: 0,
          fixedRatio: true,
          radius: 12,
          outline: { color: '#e2e8f0', width: 1, style: 'solid' },
        },
        textElement({
          id: 'demo-image-caption',
          content:
            '<p><strong>太阳能电站</strong></p><p>当前全球新增装机量已连续 5 年保持两位数增长。</p>',
          left: 588,
          top: 116,
          width: 364,
          height: 120,
          textType: 'content',
          defaultColor: '#334155',
        }),
        textElement({
          id: 'demo-image-bullets',
          content:
            '<ul><li>📈 装机量 1.2 TW</li><li>💡 度电成本 $0.04</li><li>🌍 占比 27 %</li></ul>',
          left: 588,
          top: 244,
          width: 364,
          height: 192,
          defaultColor: '#475569',
        }),
        textElement({
          id: 'demo-image-tip',
          content:
            '<p style="font-size:12px;color:#7c3aed">💡 编辑模式下点选图片，可调整裁剪 / 滤镜 / 阴影，或直接拖拽替换</p>',
          left: 48,
          top: 472,
          width: 904,
          height: 36,
          defaultColor: '#7c3aed',
        }),
      ]),
    ),
    actions: [
      ...speechActions('image', [
        '我们先来看可再生能源的整体格局。',
        '左侧这张图展示的是大型集中式光伏电站，是目前装机增量最大的可再生能源。',
        '右侧三个关键指标可以让你对当前的全球能源结构形成直观印象。',
      ]),
      {
        id: 'demo-image-spotlight',
        type: 'spotlight',
        elementId: 'demo-image-photo',
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

/** Scene 2 · 数据可视化（演示图表编辑） */
function buildChartScene(stageId: string, now: number): Scene {
  return {
    id: 'demo-scene-chart',
    stageId,
    type: 'slide',
    title: '数据可视化',
    order: 2,
    content: wrapSlide(
      makeSlide('demo-canvas-chart', [
        textElement({
          id: 'demo-chart-title',
          content: '<p><strong>近五年装机容量趋势 (单位：GW)</strong></p>',
          left: 48,
          top: 36,
          width: 904,
          height: 60,
          textType: 'title',
        }),
        {
          type: 'chart',
          id: 'demo-chart-bar',
          chartType: 'column',
          left: 48,
          top: 116,
          width: 540,
          height: 360,
          rotate: 0,
          data: {
            labels: ['2020', '2021', '2022', '2023', '2024'],
            legends: ['太阳能', '风能', '储能'],
            series: [
              [127, 168, 220, 348, 446],
              [93, 102, 78, 116, 137],
              [12, 19, 33, 56, 84],
            ],
          },
          themeColors: ['#7c3aed', '#2563eb', '#10b981'],
          textColor: '#475569',
        },
        textElement({
          id: 'demo-chart-takeaway',
          content:
            '<p><strong>关键洞察</strong></p>' +
            '<ol><li>太阳能在 2024 年取得历史性突破。</li>' +
            '<li>储能复合增长率最高，达到 62 %。</li>' +
            '<li>风能进入平稳增长阶段。</li></ol>',
          left: 612,
          top: 116,
          width: 340,
          height: 240,
          textType: 'content',
          defaultColor: '#334155',
        }),
        textElement({
          id: 'demo-chart-tip',
          content:
            '<p style="font-size:12px;color:#2563eb">💡 编辑模式下双击图表，可在表格里直接修改数据 / 系列名 / 配色</p>',
          left: 612,
          top: 380,
          width: 340,
          height: 96,
          defaultColor: '#2563eb',
        }),
      ]),
    ),
    actions: speechActions('chart', [
      '从这张柱状图可以清晰看到近五年的装机趋势。',
      '太阳能在 2024 年实现了跳跃式增长，几乎是 2020 年的三倍以上。',
      '出版商可以双击图表，直接修改背后的数据表，让课件随教材数据实时更新。',
    ]),
    createdAt: now,
    updatedAt: now,
  };
}

/** Scene 3 · 形状与流程图（演示形状/连线编辑） */
function buildShapeScene(stageId: string, now: number): Scene {
  // Predefined SVG paths for common shapes
  const RECT_PATH = 'M 0 0 L 1000 0 L 1000 1000 L 0 1000 Z';
  const ROUND_RECT = 'M 100 0 L 900 0 Q 1000 0 1000 100 L 1000 900 Q 1000 1000 900 1000 L 100 1000 Q 0 1000 0 900 L 0 100 Q 0 0 100 0 Z';

  return {
    id: 'demo-scene-shape',
    stageId,
    type: 'slide',
    title: '形状与流程图',
    order: 3,
    content: wrapSlide(
      makeSlide('demo-canvas-shape', [
        textElement({
          id: 'demo-shape-title',
          content: '<p><strong>典型工作流：从原稿到课堂</strong></p>',
          left: 48,
          top: 36,
          width: 904,
          height: 60,
          textType: 'title',
        }),
        // Step 1
        {
          type: 'shape',
          id: 'demo-shape-step1',
          left: 70,
          top: 200,
          width: 180,
          height: 110,
          rotate: 0,
          viewBox: [1000, 1000],
          path: ROUND_RECT,
          fixedRatio: false,
          fill: '#ede9fe',
          outline: { color: '#7c3aed', width: 2, style: 'solid' },
          text: {
            content: '<p>① 上传图书</p>',
            defaultFontName: DEMO_THEME.fontName,
            defaultColor: '#5b21b6',
            align: 'middle',
          },
        },
        {
          type: 'line',
          id: 'demo-shape-line1',
          left: 250,
          top: 252,
          width: 60,
          start: [0, 0],
          end: [60, 0],
          style: 'solid',
          color: '#94a3b8',
          points: ['', 'arrow'],
        },
        // Step 2
        {
          type: 'shape',
          id: 'demo-shape-step2',
          left: 310,
          top: 200,
          width: 180,
          height: 110,
          rotate: 0,
          viewBox: [1000, 1000],
          path: ROUND_RECT,
          fixedRatio: false,
          fill: '#dbeafe',
          outline: { color: '#2563eb', width: 2, style: 'solid' },
          text: {
            content: '<p>② AI 解析</p>',
            defaultFontName: DEMO_THEME.fontName,
            defaultColor: '#1d4ed8',
            align: 'middle',
          },
        },
        {
          type: 'line',
          id: 'demo-shape-line2',
          left: 490,
          top: 252,
          width: 60,
          start: [0, 0],
          end: [60, 0],
          style: 'solid',
          color: '#94a3b8',
          points: ['', 'arrow'],
        },
        // Step 3
        {
          type: 'shape',
          id: 'demo-shape-step3',
          left: 550,
          top: 200,
          width: 180,
          height: 110,
          rotate: 0,
          viewBox: [1000, 1000],
          path: ROUND_RECT,
          fixedRatio: false,
          fill: '#dcfce7',
          outline: { color: '#10b981', width: 2, style: 'solid' },
          text: {
            content: '<p>③ 出版商精修</p>',
            defaultFontName: DEMO_THEME.fontName,
            defaultColor: '#047857',
            align: 'middle',
          },
        },
        {
          type: 'line',
          id: 'demo-shape-line3',
          left: 730,
          top: 252,
          width: 60,
          start: [0, 0],
          end: [60, 0],
          style: 'solid',
          color: '#94a3b8',
          points: ['', 'arrow'],
        },
        // Step 4
        {
          type: 'shape',
          id: 'demo-shape-step4',
          left: 790,
          top: 200,
          width: 160,
          height: 110,
          rotate: 0,
          viewBox: [1000, 1000],
          path: ROUND_RECT,
          fixedRatio: false,
          fill: '#fef3c7',
          outline: { color: '#f59e0b', width: 2, style: 'solid' },
          text: {
            content: '<p>④ 扫码上课</p>',
            defaultFontName: DEMO_THEME.fontName,
            defaultColor: '#92400e',
            align: 'middle',
          },
        },
        // Decorative rectangle background
        {
          type: 'shape',
          id: 'demo-shape-bg',
          left: 60,
          top: 130,
          width: 900,
          height: 60,
          rotate: 0,
          viewBox: [1000, 1000],
          path: RECT_PATH,
          fixedRatio: false,
          fill: '#f1f5f9',
          opacity: 1,
          text: {
            content: '<p>四步完成一节伴学课堂</p>',
            defaultFontName: DEMO_THEME.fontName,
            defaultColor: '#475569',
            align: 'middle',
          },
        },
        textElement({
          id: 'demo-shape-tip',
          content:
            '<p style="font-size:12px;color:#10b981">💡 在编辑模式下，可拖拽形状改大小、改颜色、改文字；按住 Shift 拖动等比缩放</p>',
          left: 48,
          top: 460,
          width: 904,
          height: 40,
          defaultColor: '#10b981',
        }),
      ]),
    ),
    actions: speechActions('shape', [
      '现在我们看一下整套课堂的工作流。',
      '从原始图书上传到 AI 解析，再到出版商精修，最后学生扫码进入课堂，一共四步。',
      '每个箭头和方块都是独立的形状元素，可以在编辑模式下自由调整。',
    ]),
    createdAt: now,
    updatedAt: now,
  };
}

/** Scene 4 · 视频讲解（演示视频编辑 + play_video 动作） */
function buildVideoScene(stageId: string, now: number): Scene {
  return {
    id: 'demo-scene-video',
    stageId,
    type: 'slide',
    title: '视频讲解',
    order: 4,
    content: wrapSlide(
      makeSlide('demo-canvas-video', [
        textElement({
          id: 'demo-video-title',
          content: '<p><strong>实验视频：光伏电池工作原理</strong></p>',
          left: 48,
          top: 36,
          width: 904,
          height: 60,
          textType: 'title',
        }),
        {
          type: 'video',
          id: 'demo-video-clip',
          src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          poster: 'https://picsum.photos/seed/openmaic-video/960/540',
          autoplay: false,
          left: 48,
          top: 116,
          width: 560,
          height: 316,
          rotate: 0,
        },
        textElement({
          id: 'demo-video-notes',
          content:
            '<p><strong>观察要点</strong></p>' +
            '<ul><li>光照如何激发电子</li>' +
            '<li>PN 结的方向性</li>' +
            '<li>外部电路的电流方向</li></ul>' +
            '<p style="margin-top:8px;color:#64748b">观看后可在右侧讲稿处补充提问。</p>',
          left: 632,
          top: 116,
          width: 320,
          height: 280,
          textType: 'content',
          defaultColor: '#334155',
        }),
        textElement({
          id: 'demo-video-tip',
          content:
            '<p style="font-size:12px;color:#f59e0b">💡 编辑模式下可替换视频源 / 修改封面 / 设置自动播放，并通过 play_video 动作让讲稿同步触发</p>',
          left: 48,
          top: 460,
          width: 904,
          height: 40,
          defaultColor: '#f59e0b',
        }),
      ]),
    ),
    actions: [
      {
        id: 'demo-video-speech-1',
        type: 'speech',
        text: '我们用一段实验视频帮助理解光伏电池的工作过程。',
      },
      {
        id: 'demo-video-play',
        type: 'play_video',
        elementId: 'demo-video-clip',
      },
      {
        id: 'demo-video-speech-2',
        type: 'speech',
        text: '注意 PN 结两侧载流子的运动方向，它决定了对外电流的极性。',
      },
      {
        id: 'demo-video-speech-3',
        type: 'speech',
        text: '出版商可以替换视频源、修改封面图，也可以新增字幕讲解。',
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

/** Scene 5 · 公式与代码（演示 LaTeX 与代码编辑） */
function buildLatexCodeScene(stageId: string, now: number): Scene {
  return {
    id: 'demo-scene-latex-code',
    stageId,
    type: 'slide',
    title: '公式与代码',
    order: 5,
    content: wrapSlide(
      makeSlide('demo-canvas-latex-code', [
        textElement({
          id: 'demo-lc-title',
          content: '<p><strong>公式推导 + 代码实现</strong></p>',
          left: 48,
          top: 36,
          width: 904,
          height: 60,
          textType: 'title',
        }),
        textElement({
          id: 'demo-lc-formula-label',
          content: '<p><strong>① 单二极管模型</strong></p>',
          left: 48,
          top: 116,
          width: 440,
          height: 36,
          defaultColor: '#5b21b6',
        }),
        {
          type: 'latex',
          id: 'demo-lc-latex',
          left: 48,
          top: 156,
          width: 440,
          height: 90,
          rotate: 0,
          latex: String.raw`I = I_L - I_0 \left( e^{\frac{qV}{nkT}} - 1 \right)`,
          color: '#1e293b',
          align: 'left',
        },
        textElement({
          id: 'demo-lc-formula-explain',
          content:
            '<p style="color:#64748b;font-size:13px">' +
            '其中 <em>I<sub>L</sub></em> 为光生电流，<em>I<sub>0</sub></em> 为反向饱和电流。' +
            '</p>',
          left: 48,
          top: 256,
          width: 440,
          height: 60,
          defaultColor: '#64748b',
        }),
        textElement({
          id: 'demo-lc-code-label',
          content: '<p><strong>② Python 数值实现</strong></p>',
          left: 512,
          top: 116,
          width: 440,
          height: 36,
          defaultColor: '#1d4ed8',
        }),
        {
          type: 'code',
          id: 'demo-lc-code',
          left: 512,
          top: 156,
          width: 440,
          height: 240,
          rotate: 0,
          language: 'python',
          fileName: 'iv_curve.py',
          showLineNumbers: true,
          fontSize: 13,
          lines: [
            { id: 'L1', content: 'import numpy as np' },
            { id: 'L2', content: '' },
            { id: 'L3', content: 'def iv_curve(v, il=8.5, i0=1e-9, n=1.2):' },
            { id: 'L4', content: '    q, k, T = 1.6e-19, 1.38e-23, 300' },
            { id: 'L5', content: '    return il - i0 * (np.exp(q*v/(n*k*T)) - 1)' },
            { id: 'L6', content: '' },
            { id: 'L7', content: 'V = np.linspace(0, 0.6, 100)' },
            { id: 'L8', content: 'I = iv_curve(V)' },
          ],
        },
        textElement({
          id: 'demo-lc-tip',
          content:
            '<p style="font-size:12px;color:#7c3aed">💡 公式与代码块均支持点选编辑：LaTeX 即写即渲染，代码可直接整行修改</p>',
          left: 48,
          top: 460,
          width: 904,
          height: 40,
          defaultColor: '#7c3aed',
        }),
      ]),
    ),
    actions: speechActions('latex-code', [
      '理解原理之后，我们用一个最简单的二极管模型描述伏安特性。',
      '左侧是 LaTeX 公式，右侧是对应的 Python 数值实现，二者一一对应。',
      '出版商可以在编辑模式下直接修改任何一行代码或公式参数。',
    ]),
    createdAt: now,
    updatedAt: now,
  };
}

/* ──────────────────────────── Quiz scene ──────────────────────────── */

function buildQuizScene(stageId: string, now: number): Scene {
  return {
    id: 'demo-scene-quiz',
    stageId,
    type: 'quiz',
    title: '课堂小测',
    order: 6,
    content: {
      type: 'quiz',
      questions: [
        {
          id: 'demo-q1',
          type: 'single',
          question: '下列哪种不是常见的可再生能源？',
          options: [
            { label: '太阳能', value: 'A' },
            { label: '风能', value: 'B' },
            { label: '天然气', value: 'C' },
            { label: '生物质能', value: 'D' },
          ],
          answer: ['C'],
          analysis: '天然气属于化石燃料，不可再生。',
          points: 2,
          hasAnswer: true,
        },
        {
          id: 'demo-q2',
          type: 'multiple',
          question: '光伏电池的核心物理过程包括以下哪些？（多选）',
          options: [
            { label: '光生伏特效应', value: 'A' },
            { label: 'PN 结的载流子分离', value: 'B' },
            { label: '电磁感应', value: 'C' },
            { label: '能带跃迁吸收光子', value: 'D' },
          ],
          answer: ['A', 'B', 'D'],
          analysis: '电磁感应是发电机的原理，与光伏电池无直接关系。',
          points: 3,
          hasAnswer: true,
        },
        {
          id: 'demo-q3',
          type: 'short_answer',
          question: '请用一句话解释「度电成本」(LCOE) 的含义。',
          commentPrompt: '关键词：全生命周期成本 / 总发电量 / 单位千瓦时折算',
          points: 5,
          hasAnswer: false,
        },
      ],
    },
    actions: speechActions('quiz', [
      '现在通过一组小测检验本章学习成果。',
      '前两题是客观题，第三题是简答题，可以让学生输入文字作答。',
      '出版商可以在编辑模式下增删题目、修改正确答案与解析。',
    ]),
    createdAt: now,
    updatedAt: now,
  };
}

/* ──────────────────────── Interactive scene ──────────────────────── */

const INTERACTIVE_HTML = `<!DOCTYPE html><html lang="zh-CN"><head>
<meta charset="utf-8" />
<style>
  body { margin: 0; padding: 28px 32px; font: 14px/1.6 'Microsoft Yahei', system-ui, sans-serif;
         background: linear-gradient(135deg,#eef2ff 0%, #f5f3ff 50%, #fdf4ff 100%);
         color: #1e293b; min-height: 100vh; }
  h1 { margin: 0 0 6px; font-size: 22px; color: #5b21b6; }
  p.sub { margin: 0 0 24px; color: #64748b; font-size: 13px; }
  .panel { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .card { background: white; border-radius: 14px; padding: 18px;
          box-shadow: 0 4px 20px rgba(124,58,237,.08); }
  .card h2 { font-size: 14px; margin: 0 0 14px; color: #475569;
             text-transform: uppercase; letter-spacing: .08em; }
  label { display: block; font-size: 13px; margin-bottom: 8px; color: #475569; }
  input[type=range] { width: 100%; accent-color: #7c3aed; }
  .val { font-size: 13px; color: #7c3aed; font-weight: 600; }
  .out { display: flex; align-items: center; justify-content: center;
         font-size: 32px; font-weight: 700; color: #5b21b6;
         background: #f5f3ff; border-radius: 12px; height: 100%; min-height: 160px; }
  .legend { font-size: 12px; color: #64748b; margin-top: 12px; line-height: 1.5; }
</style></head><body>
<h1>🔆 光伏功率模拟器</h1>
<p class="sub">拖动滑块，实时观察辐照度与温度对输出功率的影响。</p>
<div class="panel">
  <div class="card">
    <h2>参数</h2>
    <label>辐照度 G (<span id="g_v" class="val">800</span> W/m²)</label>
    <input id="g" type="range" min="100" max="1200" value="800" />
    <label style="margin-top:14px">面板温度 T (<span id="t_v" class="val">25</span> °C)</label>
    <input id="t" type="range" min="-10" max="80" value="25" />
    <label style="margin-top:14px">面板面积 A (<span id="a_v" class="val">2.0</span> m²)</label>
    <input id="a" type="range" min="0.5" max="5" step="0.1" value="2" />
    <p class="legend">P = G · A · η · [1 − β·(T − 25)]，η₀ = 22%，β = 0.4%/°C</p>
  </div>
  <div class="card">
    <h2>输出功率</h2>
    <div class="out"><span id="p">352</span>&nbsp;W</div>
    <p class="legend" id="hint">高辐照 + 低温组合时，单板可达 600 W 以上。</p>
  </div>
</div>
<script>
  const $g = document.getElementById('g'), $t = document.getElementById('t'),
        $a = document.getElementById('a'), $p = document.getElementById('p');
  function recalc() {
    const g = +$g.value, t = +$t.value, a = +$a.value;
    document.getElementById('g_v').textContent = g;
    document.getElementById('t_v').textContent = t;
    document.getElementById('a_v').textContent = a.toFixed(1);
    const eta = 0.22 * (1 - 0.004 * (t - 25));
    const p = Math.max(0, g * a * eta);
    $p.textContent = p.toFixed(0);
  }
  ['input','change'].forEach(e => { $g.addEventListener(e, recalc);
    $t.addEventListener(e, recalc); $a.addEventListener(e, recalc); });
  recalc();
</script></body></html>`;

function buildInteractiveScene(stageId: string, now: number): Scene {
  return {
    id: 'demo-scene-interactive',
    stageId,
    type: 'interactive',
    title: '互动模拟器',
    order: 7,
    content: {
      type: 'interactive',
      url: '',
      html: INTERACTIVE_HTML,
      widgetType: 'simulation',
      widgetConfig: {
        type: 'simulation',
        concept: '光伏功率',
        description: '调节辐照度、温度、面积，观察输出功率',
        variables: [
          { name: 'G', label: '辐照度', min: 100, max: 1200, default: 800, unit: 'W/m²' },
          { name: 'T', label: '温度', min: -10, max: 80, default: 25, unit: '°C' },
          { name: 'A', label: '面积', min: 0.5, max: 5, default: 2, unit: 'm²', step: 0.1 },
        ],
        teacherActions: [],
      },
      teacherActions: [],
    },
    // Scene-level aiCommands is the canonical source for the unified
    // "AI 单页助手" launcher. Using `applied` (history) rather than `pending`
    // so entering edit mode doesn't auto-cover the canvas with the loading
    // overlay (which only triggers on pending commands by design).
    aiCommands: [
      {
        id: 'demo-ai-cmd-1',
        instruction: '把辐照度滑块默认值改成 1000，并增加阴天模式预设',
        status: 'applied',
        summary: '已将辐照度滑块默认值由 800 调整为 1000，并新增"阴天模式"预设按钮。',
        timestamp: now - 30 * 60 * 1000,
      },
    ],
    actions: speechActions('interactive', [
      '这一页是互动模拟器，学生可以自己调节参数观察现象。',
      '出版商可以点击右下角的 AI 助手，用自然语言告诉 AI 要换图、加预设或调整难度，AI 会先预览再决定是否应用。',
      '当前历史里展示了上一次的修改记录，可作为撤回 / 复用的参考。',
    ]),
    createdAt: now,
    updatedAt: now,
  };
}

/* ───────────────────────────── PBL scene ───────────────────────────── */

function buildPBLProjectConfig(): PBLProjectConfig {
  return {
    projectInfo: {
      title: '社区屋顶光伏可行性方案',
      description:
        '以小组合作的形式调研一个真实社区，输出一份可执行的光伏改造提案，涵盖技术、经济、政策三个维度。',
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
        name: '技术分析员',
        actor_role: '工程师',
        role_division: 'development',
        system_prompt: '负责屋顶面积测算、组件选型、发电量估算。',
        default_mode: 'chat',
        delay_time: 0,
        env: {},
        is_user_role: false,
        is_active: true,
        is_system_agent: false,
      },
      {
        name: '财务分析员',
        actor_role: '会计师',
        role_division: 'development',
        system_prompt: '负责投资回收期、IRR、NPV 等财务指标核算。',
        default_mode: 'chat',
        delay_time: 0,
        env: {},
        is_user_role: false,
        is_active: true,
        is_system_agent: false,
      },
      {
        name: '社区代表',
        actor_role: '居民',
        role_division: 'development',
        system_prompt: '提出居民关心的实际问题，模拟答辩场景。',
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
          id: 'demo-issue-1',
          title: '现场调研',
          description: '测量目标社区可用屋顶面积、朝向与遮挡情况。',
          person_in_charge: '技术分析员',
          participants: ['技术分析员', '社区代表'],
          notes: '已联系物业，预约下周三上午进行屋顶勘测。',
          parent_issue: null,
          index: 0,
          is_done: true,
          is_active: false,
          generated_questions: '现场遮挡的主要来源是什么？是否有解决方案？',
          question_agent_name: '指导老师',
          judge_agent_name: '指导老师',
        },
        {
          id: 'demo-issue-2',
          title: '系统选型',
          description: '在多种组件、逆变器方案中比选最优组合。',
          person_in_charge: '技术分析员',
          participants: ['技术分析员'],
          notes: '正在比选 535W 单晶硅 vs 双面 PERC 两种方案。',
          parent_issue: null,
          index: 1,
          is_done: false,
          is_active: true,
          generated_questions: '为什么选择该组件？衰减率如何？',
          question_agent_name: '指导老师',
          judge_agent_name: '指导老师',
        },
        {
          id: 'demo-issue-3',
          title: '财务建模',
          description: '搭建 25 年现金流模型，评估投资回报。',
          person_in_charge: '财务分析员',
          participants: ['财务分析员'],
          notes: '',
          parent_issue: null,
          index: 2,
          is_done: false,
          is_active: false,
          generated_questions: 'IRR 高于多少时方案具备投资价值？',
          question_agent_name: '指导老师',
          judge_agent_name: '指导老师',
        },
        {
          id: 'demo-issue-4',
          title: '答辩准备',
          description: '面向社区居民进行成果汇报与问答演练。',
          person_in_charge: '社区代表',
          participants: ['指导老师', '技术分析员', '财务分析员', '社区代表'],
          notes: '',
          parent_issue: null,
          index: 3,
          is_done: false,
          is_active: false,
          generated_questions: '居民最关心的三个问题是什么？',
          question_agent_name: '指导老师',
          judge_agent_name: '指导老师',
        },
      ],
      current_issue_id: 'demo-issue-2',
    },
    chat: {
      messages: [
        {
          id: 'demo-msg-1',
          agent_name: '指导老师',
          message: '欢迎大家进入项目第二阶段，今天先聚焦在系统选型上。',
          timestamp: Date.now() - 30 * 60 * 1000,
          read_by: ['技术分析员', '财务分析员'],
        },
        {
          id: 'demo-msg-2',
          agent_name: '技术分析员',
          message: '我准备了 535W 单晶硅和双面 PERC 两种方案，待会演示对比表。',
          timestamp: Date.now() - 20 * 60 * 1000,
          read_by: ['指导老师'],
        },
      ],
    },
    selectedRole: '社区代表',
  };
}

function buildPBLScene(stageId: string, now: number): Scene {
  return {
    id: 'demo-scene-pbl',
    stageId,
    type: 'pbl',
    title: '项目协作 (PBL)',
    order: 8,
    content: {
      type: 'pbl',
      projectConfig: buildPBLProjectConfig(),
      aiCommands: [],
    },
    actions: speechActions('pbl', [
      '本节是项目式学习模块，模拟一个完整的小组合作场景。',
      '左侧四个智能体分别扮演不同的角色，议题板按照真实研发节奏推进。',
      '出版商可以新增议题、调整角色提示词，让 AI 模拟不同的协作风格。',
    ]),
    createdAt: now,
    updatedAt: now,
  };
}

/* ─────────────────────────── Closing scene ─────────────────────────── */

function buildClosingScene(stageId: string, now: number): Scene {
  return {
    id: 'demo-scene-next',
    stageId,
    type: 'slide',
    title: '下一步',
    order: 9,
    content: wrapSlide(
      makeSlide('demo-canvas-next', [
        textElement({
          id: 'demo-next-title',
          content: '<p><strong>开始打造属于你的 AI 课堂</strong></p>',
          left: 60,
          top: 80,
          width: 880,
          height: 80,
          textType: 'title',
        }),
        textElement({
          id: 'demo-next-body',
          content:
            '<ol>' +
            '<li>回到首页上传 PDF / EPUB 教材</li>' +
            '<li>等待 AI 自动解析并生成课件大纲</li>' +
            '<li>在编辑器里精修每页幻灯片、题目、互动模块</li>' +
            '<li>生成二维码 / 课堂码，邀请学生扫码上课</li>' +
            '</ol>',
          left: 60,
          top: 200,
          width: 880,
          height: 240,
          textType: 'content',
          defaultColor: '#334155',
        }),
        textElement({
          id: 'demo-next-cta',
          content:
            '<p style="text-align:center;color:#7c3aed">感谢体验，期待与你共建 AI 课堂 ✨</p>' +
            '<p style="text-align:center;font-size:13px;color:#64748b;margin-top:10px">提示：左侧大纲最下方可进入「课程完成」总结页。</p>',
          left: 60,
          top: 448,
          width: 880,
          height: 72,
          defaultColor: '#7c3aed',
        }),
      ]),
    ),
    actions: speechActions('next', [
      '感谢观看本次完整演示。',
      '回到首页上传你自己的图书，系统会按相同的流程生成可编辑的课堂。',
      '让我们一起打造每一本图书都拥有专属数字老师的 AI 课堂。',
    ]),
    createdAt: now,
    updatedAt: now,
  };
}

/* ─────────────────────────── Public builder ─────────────────────────── */

/** 与演示场景一一对应的大纲占位，用于开启「课程完成」页（与真实课堂 outlines.length === scenes.length 一致） */
function demoOutlinesForScenes(scenes: Scene[]): SceneOutline[] {
  return scenes.map((scene) => ({
    id: `demo-outline-${scene.id}`,
    type: scene.type,
    title: scene.title,
    description: '内置演示：与左侧页一一对应的大纲占位项。',
    keyPoints: ['能力演示', '可编辑', '无待生成任务'],
    order: scene.order,
  }));
}

/** 内存注入用：多页幻灯片场景，无待生成大纲，覆盖文字 / 图片 / 图表 / 形状 / 视频 / 公式 / 代码 / 测验 / 互动 / PBL */
export function buildOpenmaicDemoClassroom(): {
  stage: Stage;
  scenes: Scene[];
  outlines: SceneOutline[];
} {
  const now = Date.now();
  const stageId = OPENMAIC_DEMO_CLASSROOM_ID;

  const stage: Stage = {
    id: stageId,
    name: '演示 · AI 课堂',
    /** 课程完成页主标题展示用（≤10 字） */
    completionTitleShort: 'AI课堂演示',
    description: '内置示例：覆盖文字、图片、图表、视频、形状、公式、代码、测验、互动模拟、项目协作的完整能力演示。',
    createdAt: now,
    updatedAt: now,
    style: 'professional',
    languageDirective: 'zh-CN',
    // Intentionally **no** `boundBook`: the bundled demo is for PRD / UX
    // screenshots of the publish dialog's *unbound* branch (琥珀色提示卡).
    // Production classrooms get `boundBook` from the home book picker or
    // upload pipeline when the source book exists on 书链 (bookln.cn).
  };

  const scenes: Scene[] = [
    buildWelcomeScene(stageId, now),
    buildImageScene(stageId, now),
    buildChartScene(stageId, now),
    buildShapeScene(stageId, now),
    buildVideoScene(stageId, now),
    buildLatexCodeScene(stageId, now),
    buildQuizScene(stageId, now),
    buildInteractiveScene(stageId, now),
    buildPBLScene(stageId, now),
    buildClosingScene(stageId, now),
  ];

  const outlines = demoOutlinesForScenes(scenes);

  return { stage, scenes, outlines };
}
