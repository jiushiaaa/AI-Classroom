import type { Scene } from '@/lib/types/stage';
import type { SpeechAction } from '@/lib/types/action';

/**
 * Slide scenes need at least one `speech` action so the Notes panel can show
 * a per-page script row (including blank pages). Mutates only when missing.
 */
export function ensureSlideHasSpeechAction(scene: Scene): Scene {
  if (scene.type !== 'slide') return scene;
  const actions = scene.actions ?? [];
  if (actions.some((a) => a.type === 'speech')) return scene;
  const id = `speech-${scene.id}-${Date.now()}`;
  const speech: SpeechAction = { type: 'speech', id, text: '' };
  return { ...scene, actions: [...actions, speech] };
}
