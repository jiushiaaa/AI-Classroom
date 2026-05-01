/**
 * Default classroom display name: PDF file base name (no extension), else requirement excerpt.
 */
export function defaultCourseNameFromPdfAndRequirement(
  pdfFileName: string | undefined,
  requirement: string,
): string {
  if (pdfFileName) {
    const base = pdfFileName.replace(/\.pdf$/i, '').trim();
    if (base) return base;
  }
  const trimmed = requirement.trim();
  if (!trimmed) return 'Untitled';
  if (trimmed.length <= 500) return trimmed;
  return `${trimmed.substring(0, 500).trim()}...`;
}
