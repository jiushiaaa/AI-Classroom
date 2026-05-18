import type { Action } from '@/lib/types/action';
import type { SceneContent, SceneVersion, SceneVersionSource } from '@/lib/types/stage';

export const SCENE_VERSION_LIMIT = 50;

interface SceneVersionSnapshot {
  title: string;
  content: SceneContent;
  actions?: Action[];
}

interface BuildSceneVersionInput extends SceneVersionSnapshot {
  id: string;
  timestamp: number;
  source: SceneVersionSource;
  instruction?: string;
  summary?: string;
  authorName?: string;
  restoredFromTimestamp?: number;
}

export function createSceneVersionSignature(snapshot: SceneVersionSnapshot): string {
  return JSON.stringify({
    title: snapshot.title,
    content: snapshot.content,
    actions: snapshot.actions ?? [],
  });
}

export function buildSceneVersion(input: BuildSceneVersionInput): SceneVersion {
  const snapshot = {
    title: input.title,
    content: structuredClone(input.content),
    actions: input.actions ? structuredClone(input.actions) : undefined,
  };

  return {
    id: input.id,
    timestamp: input.timestamp,
    source: input.source,
    title: snapshot.title,
    content: snapshot.content,
    actions: snapshot.actions,
    instruction: input.instruction,
    summary: input.summary,
    authorName: input.authorName,
    restoredFromTimestamp: input.restoredFromTimestamp,
    signature: createSceneVersionSignature(snapshot),
  };
}

export function mergeSceneVersion(
  versions: SceneVersion[] | undefined,
  nextVersion: SceneVersion,
  limit = SCENE_VERSION_LIMIT,
): SceneVersion[] {
  const current = versions ?? [];
  const latest = current[current.length - 1];
  if (latest?.signature === nextVersion.signature) {
    return current;
  }

  return [...current, nextVersion].slice(-limit);
}
