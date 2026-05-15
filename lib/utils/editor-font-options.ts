import type { FontOption } from '@/components/slide-renderer/Editor/toolbar/toolbar-constants';
import { FONT_OPTIONS } from '@/components/slide-renderer/Editor/toolbar/toolbar-constants';
import { loadPublisherFontTemplates } from '@/lib/utils/publisher-font-library-storage';

/** Built-in + publisher-uploaded fonts for slide rich-text toolbars. */
export function getEditorFontOptions(): FontOption[] {
  if (typeof window === 'undefined') return FONT_OPTIONS;
  const seen = new Set(FONT_OPTIONS.map((f) => f.value));
  const custom = loadPublisherFontTemplates()
    .filter((t) => !seen.has(t.fontFamily))
    .map((t) => ({
      label: t.name,
      value: t.fontFamily,
    }));
  return [...FONT_OPTIONS, ...custom];
}
