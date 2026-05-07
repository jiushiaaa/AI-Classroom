/**
 * Shared constants for the slide editor toolbars (top ribbon + mini toolbars).
 * Centralised so the ribbon and the floating mini toolbars stay visually and
 * functionally consistent.
 */

export interface FontOption {
  label: string;
  value: string;
}

export const FONT_OPTIONS: FontOption[] = [
  { label: '微软雅黑', value: 'Microsoft YaHei' },
  { label: '宋体', value: 'SimSun' },
  { label: '黑体', value: 'SimHei' },
  { label: '思源黑体', value: 'Noto Sans SC' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Helvetica', value: 'Helvetica' },
];

export const FONT_SIZE_OPTIONS: number[] = [12, 14, 16, 18, 20, 24, 28, 32, 36, 44, 56];

export const TEXT_COLOR_SWATCHES: string[] = [
  '#111827',
  '#374151',
  '#6B7280',
  '#9CA3AF',
  '#FFFFFF',
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#EAB308',
  '#22C55E',
  '#06B6D4',
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
];

export const HIGHLIGHT_COLOR_SWATCHES: string[] = [
  '#FEF3C7',
  '#FEE2E2',
  '#FCE7F3',
  '#E0E7FF',
  '#DBEAFE',
  '#CFFAFE',
  '#DCFCE7',
  '#F3E8FF',
  '#FFE4E6',
  '#FFEDD5',
];

export const TEXT_SHADOW_PRESETS: ReadonlyArray<{
  label: string;
  value: { h: number; v: number; blur: number; color: string } | null;
}> = [
  { label: '无', value: null },
  { label: '柔和', value: { h: 1, v: 1, blur: 4, color: 'rgba(15, 23, 42, 0.30)' } },
  { label: '中等', value: { h: 2, v: 2, blur: 6, color: 'rgba(15, 23, 42, 0.45)' } },
  { label: '强烈', value: { h: 3, v: 3, blur: 8, color: 'rgba(15, 23, 42, 0.65)' } },
];

/** Strip a "px" suffix and return a numeric font-size or undefined. */
export function parseFontSizePx(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : undefined;
}
