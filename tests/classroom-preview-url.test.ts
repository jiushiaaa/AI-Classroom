import { describe, expect, it } from 'vitest';
import {
  buildClassroomPreviewPath,
  buildClassroomPreviewWindowName,
  isClassroomPreviewMode,
} from '@/lib/utils/classroom-preview-url';

describe('classroom preview url', () => {
  it('builds a preview route that starts the classroom in preview mode', () => {
    expect(buildClassroomPreviewPath('stage 1', 123)).toBe(
      '/classroom/stage%201?mode=preview&refresh=123',
    );
  });

  it('uses a stable named window per classroom so preview clicks refresh the same tab', () => {
    expect(buildClassroomPreviewWindowName('stage 1')).toBe('openmaic-preview-stage_1');
    expect(buildClassroomPreviewWindowName('stage/1')).toBe('openmaic-preview-stage_1');
  });

  it('recognizes only the preview query mode as external preview', () => {
    expect(isClassroomPreviewMode('preview')).toBe(true);
    expect(isClassroomPreviewMode('edit-preview')).toBe(false);
    expect(isClassroomPreviewMode(null)).toBe(false);
  });
});
