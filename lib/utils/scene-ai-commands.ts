import type { AICommand } from '@/lib/types/ai-command';
import type { Scene } from '@/lib/types/stage';

/** Read the canonical AI command log for a scene (scene-level first, legacy fallback). */
export function resolveSceneAiCommands(scene: Scene | undefined): AICommand[] {
  if (!scene) return [];
  if (scene.aiCommands) return scene.aiCommands;
  if (scene.content.type === 'interactive' || scene.content.type === 'pbl') {
    return scene.content.aiCommands ?? [];
  }
  return [];
}

export function sceneHasPendingAiCommand(scene: Scene): boolean {
  return resolveSceneAiCommands(scene).some((command) => command.status === 'pending');
}

export interface PendingAiOptimization {
  sceneId: string;
  sceneTitle: string;
  command: AICommand;
}

/** First pending AI optimization in the stage, if any. */
export function findPendingAiOptimization(scenes: Scene[]): PendingAiOptimization | null {
  for (const scene of scenes) {
    const pending = resolveSceneAiCommands(scene).find((command) => command.status === 'pending');
    if (pending) {
      return { sceneId: scene.id, sceneTitle: scene.title, command: pending };
    }
  }
  return null;
}

export function isAnyAiOptimizationInProgress(scenes: Scene[]): boolean {
  return findPendingAiOptimization(scenes) !== null;
}
