import { describe, expect, it } from 'vitest';
import {
  findPendingAiOptimization,
  isAnyAiOptimizationInProgress,
  resolveSceneAiCommands,
} from '@/lib/utils/scene-ai-commands';
import type { Scene } from '@/lib/types/stage';

function scene(id: string, commands?: Scene['aiCommands']): Scene {
  return {
    id,
    stageId: 'stage-1',
    type: 'slide',
    title: `Slide ${id}`,
    order: 0,
    content: { type: 'slide', canvas: { id: `c-${id}`, elements: [] } as never },
    aiCommands: commands,
  };
}

describe('scene-ai-commands', () => {
  it('finds the first pending optimization across scenes', () => {
    const scenes = [
      scene('a'),
      scene('b', [
        { id: 'cmd-1', timestamp: 1, instruction: 'tune', status: 'pending' },
      ]),
      scene('c'),
    ];
    expect(findPendingAiOptimization(scenes)?.sceneId).toBe('b');
    expect(isAnyAiOptimizationInProgress(scenes)).toBe(true);
  });

  it('returns null when no optimization is running', () => {
    const scenes = [scene('a', [{ id: 'cmd-1', timestamp: 1, instruction: 'done', status: 'applied' }])];
    expect(findPendingAiOptimization(scenes)).toBeNull();
  });

  it('reads legacy interactive aiCommands from content', () => {
    const interactive: Scene = {
      id: 'i1',
      stageId: 'stage-1',
      type: 'interactive',
      title: 'Lab',
      order: 1,
      content: {
        type: 'interactive',
        html: '',
        aiCommands: [{ id: 'c1', timestamp: 1, instruction: 'x', status: 'pending' }],
      },
    };
    expect(resolveSceneAiCommands(interactive)).toHaveLength(1);
    expect(findPendingAiOptimization([interactive])?.sceneId).toBe('i1');
  });
});
