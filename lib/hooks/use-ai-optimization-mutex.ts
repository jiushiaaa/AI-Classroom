import { useMemo } from 'react';
import { useStageStore } from '@/lib/store/stage';
import {
  findPendingAiOptimization,
  sceneHasPendingAiCommand,
} from '@/lib/utils/scene-ai-commands';

/**
 * Global AI optimization mutex for the current classroom edit session.
 * PRD: only one AI optimization may run at a time; other entry points stay disabled.
 */
export function useAiOptimizationMutex(sceneId?: string | null) {
  const scenes = useStageStore((s) => s.scenes);

  return useMemo(() => {
    const pending = findPendingAiOptimization(scenes);
    const isLocked = pending !== null;
    const isCurrentScenePending =
      sceneId != null && scenes.some((s) => s.id === sceneId && sceneHasPendingAiCommand(s));

    return {
      isLocked,
      pendingSceneId: pending?.sceneId ?? null,
      pendingSceneTitle: pending?.sceneTitle ?? null,
      isCurrentScenePending,
      /** True when this scene may start a new AI optimization. */
      canStart: !isLocked,
    };
  }, [scenes, sceneId]);
}
