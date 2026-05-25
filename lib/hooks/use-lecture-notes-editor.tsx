'use client';

import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useStageStore } from '@/lib/store';
import { extractSlidePlainText } from '@/lib/utils/extract-slide-plain-text';
import { findPendingAiOptimization } from '@/lib/utils/scene-ai-commands';
import { db } from '@/lib/utils/database';
import type { Action, DiscussionAction, SpeechAction } from '@/lib/types/action';
import type { LectureNoteEntry } from '@/lib/types/chat';

export function useLectureNotesEditor() {
  const { t } = useI18n();
  const scenes = useStageStore((s) => s.scenes);
  const updateScene = useStageStore((s) => s.updateScene);

  const lectureNotes: LectureNoteEntry[] = useMemo(
    () =>
      [...scenes]
        .sort((a, b) => a.order - b.order)
        .map((scene) => ({
          sceneId: scene.id,
          sceneTitle: scene.title,
          sceneOrder: scene.order,
          items: (scene.actions ?? [])
            .filter(
              (a) =>
                a.type === 'speech' ||
                a.type === 'spotlight' ||
                a.type === 'laser' ||
                a.type === 'play_video' ||
                a.type === 'discussion',
            )
            .map((a) => {
              if (a.type === 'speech') {
                const sa = a as SpeechAction;
                return {
                  kind: 'speech' as const,
                  actionId: sa.id,
                  text: sa.text,
                  publisherVoiceName: sa.publisherVoiceName,
                  publisherVoiceUploadedAt: sa.publisherVoiceUploadedAt,
                };
              }
              return {
                kind: 'action' as const,
                type: a.type,
                label: a.type === 'discussion' ? (a as DiscussionAction).topic : undefined,
              };
            }),
          completedAt: scene.updatedAt || scene.createdAt || 0,
        })),
    [scenes],
  );

  const handleEditSpeech = useCallback(
    (sceneId: string, actionId: string, newText: string) => {
      const trimmed = newText.trim();
      if (!trimmed) return;

      const scene = scenes.find((s) => s.id === sceneId);
      if (!scene || !scene.actions) return;

      const original = scene.actions.find(
        (a) => a.id === actionId && a.type === 'speech',
      ) as SpeechAction | undefined;
      if (!original || original.text === trimmed) return;

      const nextActions: Action[] = scene.actions.map((a) => {
        if (a.id !== actionId || a.type !== 'speech') return a;
        return {
          ...(a as SpeechAction),
          text: trimmed,
          audioId: undefined,
          audioUrl: undefined,
          publisherVoiceName: undefined,
          publisherVoiceUploadedAt: undefined,
          publisherVoiceMimeType: undefined,
          publisherPreviousAudioId: undefined,
          publisherPreviousAudioUrl: undefined,
        };
      });

      updateScene(sceneId, { actions: nextActions, updatedAt: Date.now() });
    },
    [scenes, updateScene],
  );

  const handleAiGenerateTeacherScript = useCallback(
    (sceneId: string, userInstructions?: string) => {
      if (findPendingAiOptimization(scenes)) {
        toast.error(t('aiModify.globalBusyToast'));
        return;
      }

      const scene = scenes.find((s) => s.id === sceneId);
      if (!scene || !scene.actions?.length) {
        toast.error(t('chat.lectureNotes.aiGenerateNoSpeech'));
        return;
      }
      const speechIdx = scene.actions.findIndex((a) => a.type === 'speech');
      if (speechIdx === -1) {
        toast.error(t('chat.lectureNotes.aiGenerateNoSpeech'));
        return;
      }
      const excerpt =
        scene.type === 'slide' && scene.content.type === 'slide'
          ? extractSlidePlainText(scene.content)
          : '';
      let generated = t('chat.lectureNotes.aiMockScriptBody', {
        title: scene.title,
        excerpt: excerpt || t('chat.lectureNotes.aiMockNoExcerpt'),
      });
      const hint = userInstructions?.trim();
      if (hint) {
        generated += t('chat.lectureNotes.aiMockInstructionAppend', {
          instructions: hint,
        });
      }
      const nextActions: Action[] = scene.actions.map((a, i) => {
        if (i !== speechIdx || a.type !== 'speech') return a;
        return {
          ...(a as SpeechAction),
          text: generated,
          audioId: undefined,
          audioUrl: undefined,
          publisherVoiceName: undefined,
          publisherVoiceUploadedAt: undefined,
          publisherVoiceMimeType: undefined,
          publisherPreviousAudioId: undefined,
          publisherPreviousAudioUrl: undefined,
        };
      });
      updateScene(sceneId, { actions: nextActions, updatedAt: Date.now() });
      toast.success(t('chat.lectureNotes.aiGenerateToast'), {
        icon: <Sparkles className="w-4 h-4 text-purple-500" />,
      });
    },
    [scenes, updateScene, t],
  );

  const handleUploadTeacherVoice = useCallback(
    async (sceneId: string, file: File) => {
      if (!file.type.startsWith('audio/')) {
        toast.error('请选择音频文件');
        return;
      }

      try {
        const scene = scenes.find((s) => s.id === sceneId);
        if (!scene?.actions?.length) return;

        const speechAction = scene.actions.find((a) => a.type === 'speech') as
          | SpeechAction
          | undefined;
        if (!speechAction) {
          toast.error('当前页没有可覆盖的老师讲解音频');
          return;
        }

        const now = Date.now();
        const format = file.type.split('/')[1]?.split(';')[0] || 'mp3';
        const audioId = `teacher_voice_${sceneId}_${now}`;

        if (speechAction.audioId?.startsWith('teacher_voice_')) {
          await db.audioFiles.delete(speechAction.audioId);
        }

        await db.audioFiles.put({
          id: audioId,
          blob: file,
          format,
          text: speechAction.text,
          voice: 'publisher-teacher',
          createdAt: now,
        });

        const nextActions: Action[] = scene.actions.map((a) => {
          if (a.id !== speechAction.id || a.type !== 'speech') return a;
          return {
            ...(a as SpeechAction),
            audioId,
            audioUrl: undefined,
            publisherPreviousAudioId:
              speechAction.publisherPreviousAudioId ??
              (speechAction.audioId?.startsWith('teacher_voice_') ? undefined : speechAction.audioId),
            publisherPreviousAudioUrl:
              speechAction.publisherPreviousAudioUrl ??
              (speechAction.audioId?.startsWith('teacher_voice_') ? undefined : speechAction.audioUrl),
            publisherVoiceName: file.name,
            publisherVoiceUploadedAt: now,
            publisherVoiceMimeType: file.type,
          };
        });

        updateScene(sceneId, { actions: nextActions, updatedAt: now });
        toast.success('已使用真人老师人声覆盖当前页');
      } catch {
        toast.error('真人老师人声上传失败，请重试');
      }
    },
    [scenes, updateScene],
  );

  const handleRemoveTeacherVoice = useCallback(
    async (sceneId: string) => {
      const scene = scenes.find((s) => s.id === sceneId);
      if (!scene?.actions?.length) return;

      const speechAction = scene.actions.find(
        (a) => a.type === 'speech' && (a as SpeechAction).publisherVoiceUploadedAt,
      ) as SpeechAction | undefined;
      if (!speechAction) return;

      if (speechAction.audioId?.startsWith('teacher_voice_')) {
        await db.audioFiles.delete(speechAction.audioId);
      }

      const nextActions: Action[] = scene.actions.map((a) => {
        if (a.id !== speechAction.id || a.type !== 'speech') return a;
        return {
          ...(a as SpeechAction),
          audioId: speechAction.publisherPreviousAudioId,
          audioUrl: speechAction.publisherPreviousAudioUrl,
          publisherVoiceName: undefined,
          publisherVoiceUploadedAt: undefined,
          publisherVoiceMimeType: undefined,
          publisherPreviousAudioId: undefined,
          publisherPreviousAudioUrl: undefined,
        };
      });

      updateScene(sceneId, { actions: nextActions, updatedAt: Date.now() });
      toast.success('已恢复当前页 AI 老师声音');
    },
    [scenes, updateScene],
  );

  return {
    lectureNotes,
    handleEditSpeech,
    handleAiGenerateTeacherScript,
    handleUploadTeacherVoice,
    handleRemoveTeacherVoice,
  };
}
