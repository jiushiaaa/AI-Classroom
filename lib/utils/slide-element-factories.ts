import { nanoid } from 'nanoid';
import type {
  PPTImageElement,
  PPTTableElement,
  PPTTextElement,
  PPTVideoElement,
  TextType,
} from '@/lib/types/slides';

const PLACEHOLDER_IMAGE_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" viewBox="0 0 400 240">
    <rect width="400" height="240" fill="#e2e8f0"/>
    <text x="200" y="125" text-anchor="middle" font-family="system-ui,sans-serif" font-size="16" fill="#64748b">Image</text>
  </svg>`,
);

export type SlideTextVariant =
  | 'content'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'heading5'
  | 'caption';

interface TextVariantSpec {
  readonly textType: TextType;
  readonly fontSize: number;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly height: number;
  readonly defaultColor: string;
  readonly placeholder: string;
}

const TEXT_VARIANT_SPECS: Record<SlideTextVariant, TextVariantSpec> = {
  content: {
    textType: 'content',
    fontSize: 18,
    bold: false,
    italic: false,
    height: 120,
    defaultColor: '#1e293b',
    placeholder: '双击编辑文本',
  },
  heading1: {
    textType: 'title',
    fontSize: 40,
    bold: true,
    italic: false,
    height: 80,
    defaultColor: '#0f172a',
    placeholder: '标题 1',
  },
  heading2: {
    textType: 'subtitle',
    fontSize: 32,
    bold: true,
    italic: false,
    height: 72,
    defaultColor: '#0f172a',
    placeholder: '标题 2',
  },
  heading3: {
    textType: 'itemTitle',
    fontSize: 24,
    bold: true,
    italic: false,
    height: 60,
    defaultColor: '#1e293b',
    placeholder: '标题 3',
  },
  heading4: {
    textType: 'item',
    fontSize: 20,
    bold: true,
    italic: false,
    height: 52,
    defaultColor: '#1e293b',
    placeholder: '标题 4',
  },
  heading5: {
    textType: 'header',
    fontSize: 16,
    bold: true,
    italic: false,
    height: 44,
    defaultColor: '#334155',
    placeholder: '标题 5',
  },
  caption: {
    textType: 'notes',
    fontSize: 12,
    bold: false,
    italic: true,
    height: 36,
    defaultColor: '#64748b',
    placeholder: '标注说明',
  },
};

function buildVariantHtml(spec: TextVariantSpec): string {
  const styles: string[] = [
    'text-align:left',
    `font-size:${spec.fontSize}px`,
    'line-height:1.6',
    `color:${spec.defaultColor}`,
  ];
  let html = spec.placeholder;
  if (spec.bold) html = `<strong>${html}</strong>`;
  if (spec.italic) html = `<em>${html}</em>`;
  return `<p style="${styles.join(';')}">${html}</p>`;
}

export function createSlideTextElement(
  viewportWidth: number,
  viewportHeight: number,
  variant: SlideTextVariant = 'content',
): PPTTextElement {
  const spec = TEXT_VARIANT_SPECS[variant];
  const id = `txt-${nanoid(8)}`;
  const w = Math.min(720, Math.max(320, viewportWidth - 160));
  const left = Math.max(40, (viewportWidth - w) / 2);
  const top = Math.max(48, viewportHeight * 0.22);
  return {
    type: 'text',
    id,
    left,
    top,
    width: w,
    height: spec.height,
    rotate: 0,
    content: buildVariantHtml(spec),
    defaultFontName: 'Microsoft Yahei',
    defaultColor: spec.defaultColor,
    textType: spec.textType,
    lineHeight: 1.5,
  };
}

export function createSlideImageElement(
  viewportWidth: number,
  viewportHeight: number,
  src?: string,
  naturalRatio?: number,
): PPTImageElement {
  const id = `img-${nanoid(8)}`;
  const ratio =
    typeof naturalRatio === 'number' && Number.isFinite(naturalRatio) && naturalRatio > 0
      ? naturalRatio
      : 0.56;
  const w = Math.min(360, viewportWidth * 0.42);
  const h = w * ratio;
  const left = Math.max(40, (viewportWidth - w) / 2);
  const top = Math.max(48, viewportHeight * 0.2);
  return {
    type: 'image',
    id,
    left,
    top,
    width: w,
    height: h,
    rotate: 0,
    fixedRatio: true,
    src: src && src.length > 0 ? src : `data:image/svg+xml,${PLACEHOLDER_IMAGE_SVG}`,
    imageType: 'itemFigure',
  };
}

export function createSlideVideoElement(
  viewportWidth: number,
  viewportHeight: number,
  src: string = '',
): PPTVideoElement {
  const id = `vid-${nanoid(8)}`;
  const w = Math.min(480, viewportWidth * 0.5);
  const h = (w * 9) / 16;
  const left = Math.max(40, (viewportWidth - w) / 2);
  const top = Math.max(48, viewportHeight * 0.2);
  return {
    type: 'video',
    id,
    left,
    top,
    width: w,
    height: h,
    rotate: 0,
    src,
    autoplay: false,
  };
}

export const SLIDE_TABLE_MAX_ROWS = 8;
export const SLIDE_TABLE_MAX_COLS = 8;

export function createSlideTableElement(
  viewportWidth: number,
  viewportHeight: number,
  rows: number = 3,
  cols: number = 3,
): PPTTableElement {
  const id = `tbl-${nanoid(8)}`;
  const safeRows = Math.max(1, Math.min(SLIDE_TABLE_MAX_ROWS, Math.floor(rows)));
  const safeCols = Math.max(1, Math.min(SLIDE_TABLE_MAX_COLS, Math.floor(cols)));
  const w = Math.min(640, viewportWidth - 120);
  const baseRowH = 36;
  const naturalH = baseRowH * safeRows + 16;
  const h = Math.max(
    baseRowH + 16,
    Math.min(Math.min(420, viewportHeight * 0.55), naturalH),
  );
  const left = Math.max(40, (viewportWidth - w) / 2);
  const top = Math.max(48, viewportHeight * 0.2);
  let cell = 0;
  const data = Array.from({ length: safeRows }, (_, r) =>
    Array.from({ length: safeCols }, (_, c) => ({
      id: `${id}-c${cell++}`,
      colspan: 1,
      rowspan: 1,
      text: r === 0 ? `列 ${c + 1}` : `R${r + 1}C${c + 1}`,
      style:
        r === 0
          ? {
              bold: true,
              align: 'center' as const,
              fontsize: '14px',
              fontname: 'Microsoft Yahei',
              color: '#1e293b',
              backcolor: '#f1f5f9',
            }
          : {
              fontsize: '13px',
              fontname: 'Microsoft Yahei',
              color: '#334155',
            },
    })),
  );
  return {
    type: 'table',
    id,
    left,
    top,
    width: w,
    height: h,
    rotate: 0,
    colWidths: new Array(safeCols).fill(1 / safeCols),
    cellMinHeight: baseRowH,
    data,
    outline: { width: 1, style: 'solid', color: '#cbd5e1' },
    theme: {
      color: '#7c3aed',
      rowHeader: true,
      rowFooter: false,
      colHeader: false,
      colFooter: false,
    },
  };
}
