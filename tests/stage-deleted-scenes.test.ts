import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Scene, Stage } from '@/lib/types/stage';
import { useStageStore } from '@/lib/store/stage';

vi.mock('@/lib/utils/stage-storage', () => ({
  saveStageData: vi.fn(),
  loadStageData: vi.fn(),
}));

const stage: Stage = {
  id: 'stage-1',
  name: 'AI 课堂',
  createdAt: 1,
  updatedAt: 1,
};

function scene(id: string, order: number): Scene {
  return {
    id,
    stageId: stage.id,
    type: 'quiz',
    title: `第 ${order + 1} 页`,
    order,
    content: { type: 'quiz', questions: [] },
    versions: [
      {
        id: `version-${id}`,
        timestamp: 1,
        source: 'manual',
        title: `第 ${order + 1} 页`,
        content: { type: 'quiz', questions: [] },
        signature: `signature-${id}`,
      },
    ],
  };
}

describe('stage deleted scenes', () => {
  beforeEach(() => {
    useStageStore.getState().clearStore();
    useStageStore.getState().setStage(stage);
    useStageStore.getState().setScenes([scene('scene-1', 0), scene('scene-2', 1)]);
    useStageStore.getState().setCurrentSceneId('scene-1');
  });

  it('moves deleted scenes into the recycle bin without losing versions', () => {
    useStageStore.getState().deleteScene('scene-1');

    const state = useStageStore.getState();
    expect(state.scenes.map((item) => item.id)).toEqual(['scene-2']);
    expect(state.deletedScenes.map((item) => item.id)).toEqual(['scene-1']);
    expect(state.deletedScenes[0].versions?.[0]?.id).toBe('version-scene-1');
    expect(state.deletedScenes[0].deletedAt).toEqual(expect.any(Number));
    expect(state.currentSceneId).toBe('scene-2');
  });

  it('restores a deleted scene as an active page', () => {
    useStageStore.getState().deleteScene('scene-1');
    useStageStore.getState().restoreScene('scene-1');

    const state = useStageStore.getState();
    expect(state.deletedScenes).toEqual([]);
    expect(state.scenes.map((item) => item.id)).toEqual(['scene-1', 'scene-2']);
    expect(state.scenes[0].deletedAt).toBeUndefined();
    expect(state.scenes[0].versions?.[0]?.id).toBe('version-scene-1');
    expect(state.currentSceneId).toBe('scene-1');
  });

  it('permanently removes a deleted scene from the recycle bin', () => {
    useStageStore.getState().deleteScene('scene-1');
    useStageStore.getState().purgeDeletedScene('scene-1');

    const state = useStageStore.getState();
    expect(state.deletedScenes).toEqual([]);
    expect(state.scenes.map((item) => item.id)).toEqual(['scene-2']);
  });
});
