import type { CourseCategory } from '@/lib/mock/discover-courses';

/** Simulated pipeline phases (frontend only — no RAG). */
export type PublisherParsePhase =
  | 'idle'
  | 'uploading'
  | 'toc'
  | 'chunks'
  | 'vectors'
  | 'ready';

export const PUBLISHER_MAX_BOOK_MB = 500;
export const PUBLISHER_MAX_BOOK_BYTES = PUBLISHER_MAX_BOOK_MB * 1024 * 1024;

/** Accept attribute for file input */
export const PUBLISHER_BOOK_ACCEPT =
  '.pdf,.doc,.docx,.md,.markdown,.epub,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,application/epub+zip';

export interface PublisherKnowledgeChunkPreview {
  id: string;
  title: string;
  excerpt: string;
  /** Compliance trace — page or location in source */
  sourcePage: string;
}

/**
 * One uploaded attachment row, shared between the Home composer and the
 * unified upload-center popover. The "main book" and supplementary files use
 * the same shape — every attachment is parsed independently.
 */
export interface PublisherAttachmentEntry {
  id: string;
  file: File;
  phase: PublisherParsePhase;
  detectedCategories: CourseCategory[];
  mockChunks: PublisherKnowledgeChunkPreview[];
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function isPdfBookFile(file: File): boolean {
  const n = file.name.toLowerCase();
  return file.type === 'application/pdf' || n.endsWith('.pdf');
}

/** Mock detected disciplines from filename heuristics (demo). */
export function inferMockCategories(fileName: string): CourseCategory[] {
  const s = fileName.toLowerCase();
  const out: CourseCategory[] = [];
  if (/物理|力学|动量|光学/.test(s) || /physics/.test(s)) out.push('physics');
  if (/生物|细胞|光合/.test(s) || /bio/.test(s)) out.push('biology');
  if (/历史|儒学|先秦/.test(s) || /history/.test(s)) out.push('history');
  if (/数学|代数|几何/.test(s) || /math/.test(s)) out.push('math');
  if (/语文|作文|文言/.test(s) || /chinese/.test(s)) out.push('chinese');
  if (/英语|英文/.test(s) || /english/.test(s)) out.push('english');
  if (/化学/.test(s) || /chem/.test(s)) out.push('chemistry');
  if (/编程|python|代码/.test(s) || /code/.test(s)) out.push('coding');
  if (/考研/.test(s) || /kaoyan/.test(s)) out.push('kaoyan');
  if (out.length === 0) out.push('chinese', 'math');
  return [...new Set(out)].slice(0, 4);
}

export function buildMockKnowledgeChunks(fileName: string): PublisherKnowledgeChunkPreview[] {
  const base = fileName.replace(/\.[^.]+$/, '');
  return [
    {
      id: 'k1',
      title: `「${base}」导读与学习目标`,
      excerpt: '概括全书的教学目标与课堂组织方式，供生成第一节课使用。',
      sourcePage: 'p.1–4',
    },
    {
      id: 'k2',
      title: '核心概念与术语表',
      excerpt: '抽取高频术语与定义，用于讲义与随堂测验题干对齐。',
      sourcePage: 'p.12–18',
    },
    {
      id: 'k3',
      title: '图表与案例索引',
      excerpt: '扫描到的图示与例题位置，便于 RAG 检索时回链原书页码。',
      sourcePage: 'p.28, Fig.2-1',
    },
  ];
}

/**
 * Run mock parse steps; call onPhase after each step. Aborts if signal.aborted.
 */
export async function runPublisherParseMock(
  onPhase: (phase: PublisherParsePhase) => void,
  signal: AbortSignal,
): Promise<void> {
  const step = async (phase: PublisherParsePhase, ms: number) => {
    if (signal.aborted) return;
    onPhase(phase);
    await delay(ms);
  };
  await step('uploading', 450);
  if (signal.aborted) return;
  await step('toc', 1200);
  if (signal.aborted) return;
  await step('chunks', 1400);
  if (signal.aborted) return;
  await step('vectors', 1200);
  if (signal.aborted) return;
  onPhase('ready');
}
