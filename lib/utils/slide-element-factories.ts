import { nanoid } from 'nanoid';
import type {
  PPTImageElement,
  PPTTableElement,
  PPTTextElement,
  PPTVideoElement,
} from '@/lib/types/slides';

const PLACEHOLDER_IMAGE_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" viewBox="0 0 400 240">
    <rect width="400" height="240" fill="#e2e8f0"/>
    <text x="200" y="125" text-anchor="middle" font-family="system-ui,sans-serif" font-size="16" fill="#64748b">Image</text>
  </svg>`,
);

export function createSlideTextElement(
  viewportWidth: number,
  viewportHeight: number,
): PPTTextElement {
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
    height: 120,
    rotate: 0,
    content: '<p style="text-align:left;font-size:18px;line-height:1.6">双击编辑文本</p>',
    defaultFontName: 'Microsoft Yahei',
    defaultColor: '#1e293b',
    textType: 'content',
    lineHeight: 1.5,
  };
}

export function createSlideImageElement(
  viewportWidth: number,
  viewportHeight: number,
): PPTImageElement {
  const id = `img-${nanoid(8)}`;
  const w = Math.min(360, viewportWidth * 0.42);
  const h = w * 0.56;
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
    src: `data:image/svg+xml,${PLACEHOLDER_IMAGE_SVG}`,
    imageType: 'itemFigure',
  };
}

export function createSlideVideoElement(
  viewportWidth: number,
  viewportHeight: number,
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
    src: '',
    autoplay: false,
  };
}

export function createSlideTableElement(
  viewportWidth: number,
  viewportHeight: number,
): PPTTableElement {
  const id = `tbl-${nanoid(8)}`;
  const rows = 3;
  const cols = 3;
  const w = Math.min(640, viewportWidth - 120);
  const h = Math.min(220, viewportHeight * 0.35);
  const left = Math.max(40, (viewportWidth - w) / 2);
  const top = Math.max(48, viewportHeight * 0.2);
  let cell = 0;
  const data = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
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
    colWidths: Array(cols).fill(1 / cols),
    cellMinHeight: 36,
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
