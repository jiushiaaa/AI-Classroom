export function isClassroomPreviewMode(mode: string | null): boolean {
  return mode === 'preview';
}

export function buildClassroomPreviewPath(classroomId: string, refreshToken = Date.now()): string {
  const params = new URLSearchParams({
    mode: 'preview',
    refresh: String(refreshToken),
  });

  return `/classroom/${encodeURIComponent(classroomId)}?${params.toString()}`;
}

export function buildClassroomPreviewWindowName(classroomId: string): string {
  const safeId = classroomId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `openmaic-preview-${safeId}`;
}
