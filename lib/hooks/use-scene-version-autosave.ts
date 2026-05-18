import { useEffect, useMemo, useRef, useState } from 'react';
import { useStageStore } from '@/lib/store/stage';
import { useUserProfileStore } from '@/lib/store/user-profile';
import {
  buildSceneVersion,
  createSceneVersionSignature,
  mergeSceneVersion,
} from '@/lib/utils/scene-version-history';

const AUTOSAVE_DELAY_MS = 1800;

export type SceneVersionSaveStatus = 'idle' | 'saving' | 'saved';

export function useSceneVersionAutosave(
  sceneId: string | null,
  enabled: boolean,
): SceneVersionSaveStatus {
  const [status, setStatus] = useState<SceneVersionSaveStatus>('idle');
  const initializedSignatureRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scene = useStageStore((s) => s.scenes.find((item) => item.id === sceneId));
  const updateScene = useStageStore.use.updateScene();
  const nickname = useUserProfileStore((s) => s.nickname);

  const currentSignature = useMemo(() => {
    if (!scene) return null;
    return createSceneVersionSignature({
      title: scene.title,
      content: scene.content,
      actions: scene.actions,
    });
  }, [scene]);

  useEffect(() => {
    initializedSignatureRef.current = null;
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setStatus('idle'), 0);
  }, [sceneId]);

  useEffect(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (!enabled || !scene || !currentSignature) return;

    if (!initializedSignatureRef.current) {
      initializedSignatureRef.current = currentSignature;
      return;
    }

    if (initializedSignatureRef.current === currentSignature) return;

    const latest = scene.versions?.[scene.versions.length - 1];
    if (latest?.signature === currentSignature) {
      initializedSignatureRef.current = currentSignature;
      return;
    }

    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setStatus('saving'), 0);
    saveTimerRef.current = setTimeout(() => {
      const current = useStageStore.getState().scenes.find((item) => item.id === scene.id);
      if (!current) return;

      const nextVersion = buildSceneVersion({
        id: `scene-version-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: Date.now(),
        source: 'manual',
        title: current.title,
        content: current.content,
        actions: current.actions,
        authorName: nickname.trim() || '少华',
      });

      const nextVersions = mergeSceneVersion(current.versions, nextVersion);
      initializedSignatureRef.current = nextVersion.signature;
      updateScene(current.id, {
        versions: nextVersions,
        updatedAt: Date.now(),
      });
      setStatus('saved');

      if (savedStatusTimerRef.current) clearTimeout(savedStatusTimerRef.current);
      savedStatusTimerRef.current = setTimeout(() => setStatus('idle'), 2200);
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [currentSignature, enabled, nickname, scene, updateScene]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      if (savedStatusTimerRef.current) clearTimeout(savedStatusTimerRef.current);
    },
    [],
  );

  return status;
}
