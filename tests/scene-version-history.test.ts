import { describe, expect, it } from 'vitest';
import type { SceneVersion } from '@/lib/types/stage';
import type { SlideContent } from '@/lib/types/stage';
import {
  buildSceneVersion,
  createSceneVersionSignature,
  mergeSceneVersion,
} from '@/lib/utils/scene-version-history';

const baseContent: SlideContent = {
  type: 'slide',
  canvas: {
    id: 'slide-1',
    viewportSize: 1000,
    viewportRatio: 16 / 9,
    theme: {
      backgroundColor: '#ffffff',
      themeColors: [],
      fontColor: '#111111',
      fontName: '',
    },
    elements: [],
    background: { type: 'solid', color: '#fff' },
  },
};

const baseSnapshot = {
  title: '第一页',
  content: baseContent,
  actions: [],
};

describe('scene version history', () => {
  it('skips adding a version when the latest version has identical content', () => {
    const existing = buildSceneVersion({
      id: 'version-1',
      timestamp: 1,
      source: 'manual',
      ...baseSnapshot,
    });

    const duplicate = buildSceneVersion({
      id: 'version-2',
      timestamp: 2,
      source: 'manual',
      ...baseSnapshot,
    });

    const next = mergeSceneVersion([existing], duplicate);

    expect(next).toEqual([existing]);
  });

  it('keeps the newest versions when the history exceeds the limit', () => {
    const versions: SceneVersion[] = Array.from({ length: 3 }, (_, index) =>
      buildSceneVersion({
        id: `version-${index + 1}`,
        timestamp: index + 1,
        source: 'manual',
        title: `第 ${index + 1} 页`,
        content: baseSnapshot.content,
        actions: baseSnapshot.actions,
      }),
    );

    const next = mergeSceneVersion(
      versions,
      buildSceneVersion({
        id: 'version-4',
        timestamp: 4,
        source: 'ai',
        title: '第 4 页',
        content: baseSnapshot.content,
        actions: baseSnapshot.actions,
      }),
      3,
    );

    expect(next.map((version) => version.id)).toEqual(['version-2', 'version-3', 'version-4']);
  });

  it('creates a stable signature for equivalent snapshots', () => {
    expect(createSceneVersionSignature(baseSnapshot)).toBe(
      createSceneVersionSignature(JSON.parse(JSON.stringify(baseSnapshot))),
    );
  });

  it('keeps the restored source timestamp for restore versions', () => {
    const version = buildSceneVersion({
      id: 'version-restore',
      timestamp: 2,
      source: 'restore',
      restoredFromTimestamp: 1,
      ...baseSnapshot,
    });

    expect(version.restoredFromTimestamp).toBe(1);
  });
});
