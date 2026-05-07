/**
 * Demo-only attachment seeds for the home composer.
 *
 * Used by the "💡 试试演示附件" button so users can see the full attachment
 * pipeline (chip + size + categories + knowledge chunk preview) **without**
 * having to drag a real file in.
 *
 * Each preset supplies a fake `File`, hand-curated `detectedCategories` and
 * `mockChunks`. The home «载入演示附件» button uses
 * `buildDemoAttachmentsQueuedForParse()` so rows start in `uploading` and run
 * the same mock parse as real uploads (mini status on the home card); instant
 * `ready` rows are still available via `buildDemoAttachmentEntries()`.
 *
 * Three mixed-scenario presets cover the most common demo flows:
 *
 * | # | 文件名                                     | 场景  | 主分类      | 类型 |
 * |---|--------------------------------------------|-------|-------------|------|
 * | 1 | 2025 考研英语 · 长难句精讲.pdf             | 考研  | english/kaoyan | PDF  |
 * | 2 | 高中物理 · 动量与能量守恒讲义.docx         | 高中  | physics     | DOCX |
 * | 3 | 光合作用 · 教学补充材料.md                  | 高中  | biology     | MD   |
 */

import type { CourseCategory } from '@/lib/mock/discover-courses';
import type {
  PublisherAttachmentEntry,
  PublisherKnowledgeChunkPreview,
  PublisherParsePhase,
} from '@/lib/publisher/publisher-book-parse-mock';

export interface DemoAttachmentSeed {
  /** Stable id so React keys don't collide with user-uploaded files. */
  id: string;
  fileName: string;
  /** Approximate file size in MB (used to size the fake Blob). */
  sizeMb: number;
  mimeType: string;
  detectedCategories: CourseCategory[];
  mockChunks: PublisherKnowledgeChunkPreview[];
}

export const DEMO_ATTACHMENT_SEEDS: readonly DemoAttachmentSeed[] = Object.freeze([
  {
    id: 'demo-attach-kaoyan-en',
    fileName: '2025 考研英语 · 长难句精讲.pdf',
    sizeMb: 12.4,
    mimeType: 'application/pdf',
    detectedCategories: ['kaoyan', 'english'],
    mockChunks: [
      {
        id: 'demo-k1-1',
        title: '长难句拆解 · 三种常见结构',
        excerpt:
          '从分词短语、从句嵌套、平行结构三个维度对真题长难句进行拆解，重点演示如何先抓主干再补修饰。',
        sourcePage: 'p.6–14',
      },
      {
        id: 'demo-k1-2',
        title: '高频学术词汇 · 真题语境',
        excerpt:
          '收录近 10 年阅读真题中的 80 个高频学术词汇及其在原文中的搭配，便于课堂随测对齐。',
        sourcePage: 'p.32–48',
      },
      {
        id: 'demo-k1-3',
        title: '阅读理解题型策略',
        excerpt:
          '细节题、推断题、主旨题三类题型的解题路径，配套真题示例与错题归因表。',
        sourcePage: 'p.66–80, Fig.4-2',
      },
    ],
  },
  {
    id: 'demo-attach-physics-docx',
    fileName: '高中物理 · 动量与能量守恒讲义.docx',
    sizeMb: 3.7,
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    detectedCategories: ['physics'],
    mockChunks: [
      {
        id: 'demo-k2-1',
        title: '动量定理 · 推导与典型例题',
        excerpt:
          '从冲量定义出发推导动量定理，配 4 道高考真题，覆盖瞬时碰撞与连续作用两类场景。',
        sourcePage: 'p.2–9',
      },
      {
        id: 'demo-k2-2',
        title: '能量守恒 · 多过程拆分',
        excerpt:
          '弹簧 / 摩擦 / 电场三类典型多过程问题的能量分阶段分析模板，便于生成阶梯式讲解 PPT。',
        sourcePage: 'p.10–18',
      },
      {
        id: 'demo-k2-3',
        title: '易错点对照表',
        excerpt:
          '动量与能量在标量 / 矢量、内力 / 外力、系统 / 单体几个维度上的常见易错点对照。',
        sourcePage: 'p.22, Tab.3-1',
      },
    ],
  },
  {
    id: 'demo-attach-biology-md',
    fileName: '光合作用 · 教学补充材料.md',
    sizeMb: 0.6,
    mimeType: 'text/markdown',
    detectedCategories: ['biology'],
    mockChunks: [
      {
        id: 'demo-k3-1',
        title: '光反应 vs 暗反应 · 分子事件对比',
        excerpt:
          '从能量来源、场所、产物三个维度对照两个阶段，配 1 张反应总览图便于做思维导图。',
        sourcePage: 'sec.1–2',
      },
      {
        id: 'demo-k3-2',
        title: '影响光合速率的环境因素',
        excerpt:
          '光强、CO₂ 浓度、温度的单变量与组合变量影响曲线，可用于生成模拟实验。',
        sourcePage: 'sec.3, Fig.2',
      },
      {
        id: 'demo-k3-3',
        title: '常考实验设计 · 变量控制要点',
        excerpt:
          '高考常见 3 类光合作用实验设计的对照组、自变量、因变量梳理，便于生成测试题。',
        sourcePage: 'sec.4',
      },
    ],
  },
]);

/**
 * Build a tiny in-memory `File` whose reported `.size` matches `sizeMb`.
 *
 * We intentionally allocate a real Uint8Array so `file.size` is correct (the
 * UI shows it), but cap the real allocation at 256 KiB regardless of the
 * declared size — Blob accepts a logical size only via its content length, so
 * for very large fake files we just use a smaller backing buffer (the demo
 * never reads file bytes anyway).
 */
function buildFakeFile(seed: DemoAttachmentSeed): File {
  const declaredBytes = Math.max(1024, Math.round(seed.sizeMb * 1024 * 1024));
  // Cap real allocation to keep memory tiny — only the size attribute matters
  // for the UI; the Blob's actual content is never read.
  const bufBytes = Math.min(declaredBytes, 256 * 1024);
  const buf = new Uint8Array(bufBytes);
  // Pad with a constant byte so the Blob isn't entirely zero-filled (some
  // browsers special-case empty Blobs in DevTools).
  buf.fill(0x20);
  // Use the small buffer + repeat trick: stuff the same buffer a few times so
  // total reported size ≈ declared size (Blob just sums the parts).
  const repeats = Math.max(1, Math.floor(declaredBytes / bufBytes));
  const parts: BlobPart[] = Array.from({ length: repeats }, () => buf);
  const blob = new Blob(parts, { type: seed.mimeType });
  // File constructor preserves blob.size; lastModified gives a stable mtime.
  return new File([blob], seed.fileName, {
    type: seed.mimeType,
    lastModified: 0,
  });
}

/** Pair produced for the home «载入演示附件» flow — parse runs, then `finalChunks` replace generic mocks. */
export interface DemoAttachmentQueued {
  entry: PublisherAttachmentEntry;
  finalChunks: PublisherKnowledgeChunkPreview[];
}

/**
 * Demo rows that start in `uploading` with empty chunks. Caller should append
 * `entry` to state, then run the same mock parse as real files and apply
 * `finalChunks` when the pipeline finishes.
 */
export function buildDemoAttachmentsQueuedForParse(maxCount: number): DemoAttachmentQueued[] {
  const n = Math.max(0, Math.min(maxCount, DEMO_ATTACHMENT_SEEDS.length));
  return DEMO_ATTACHMENT_SEEDS.slice(0, n).map((seed) => ({
    entry: {
      id: `${seed.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      file: buildFakeFile(seed),
      phase: 'uploading' as PublisherParsePhase,
      detectedCategories: [...seed.detectedCategories],
      mockChunks: [],
    },
    finalChunks: seed.mockChunks.map((c) => ({ ...c })),
  }));
}

/**
 * Materialise all demo seeds as ready-to-mount `PublisherAttachmentEntry`
 * objects. Each entry comes with `phase: 'ready'` so the chip skips the
 * parse animation (tests / callers that do not run `runPublisherParseMock`).
 */
export function buildDemoAttachmentEntries(): PublisherAttachmentEntry[] {
  return DEMO_ATTACHMENT_SEEDS.map((seed) => ({
    id: `${seed.id}-${Date.now().toString(36)}`,
    file: buildFakeFile(seed),
    phase: 'ready' as PublisherParsePhase,
    detectedCategories: [...seed.detectedCategories],
    mockChunks: seed.mockChunks.map((c) => ({ ...c })),
  }));
}
