import { describe, expect, it } from 'vitest';
import {
  getCurrentLectureNote,
  getLectureNoteTeacherVoiceInfo,
  getLectureNoteVoiceStatus,
} from '@/lib/utils/lecture-notes';
import type { LectureNoteEntry } from '@/lib/types/chat';

const notes: LectureNoteEntry[] = [
  {
    sceneId: 'scene-1',
    sceneTitle: '欢迎',
    sceneOrder: 0,
    completedAt: 1,
    items: [
      {
        kind: 'speech',
        actionId: 'speech-1',
        text: '欢迎来到云梯 AI 课堂。',
      },
    ],
  },
  {
    sceneId: 'scene-2',
    sceneTitle: '图文混排',
    sceneOrder: 1,
    completedAt: 2,
    items: [
      {
        kind: 'speech',
        actionId: 'speech-2',
        text: '我们先来看可再生能源的整体格局。',
        publisherVoiceName: 'teacher.wav',
        publisherVoiceUploadedAt: 1710000000000,
      },
    ],
  },
];

describe('lecture notes workbench helpers', () => {
  it('selects the note for the current scene', () => {
    expect(getCurrentLectureNote(notes, 'scene-2')?.sceneTitle).toBe('图文混排');
  });

  it('falls back to the first note when the current scene is missing', () => {
    expect(getCurrentLectureNote(notes, 'missing')?.sceneId).toBe('scene-1');
    expect(getCurrentLectureNote(notes, null)?.sceneId).toBe('scene-1');
  });

  it('marks notes with uploaded teacher voice separately from AI voice', () => {
    expect(getLectureNoteVoiceStatus(notes[0])).toBe('ai');
    expect(getLectureNoteVoiceStatus(notes[1])).toBe('teacher');
  });

  it('exposes uploaded teacher voice details for restore controls', () => {
    expect(getLectureNoteTeacherVoiceInfo(notes[0])).toEqual({
      hasPublisherVoice: false,
      voiceName: '',
    });
    expect(getLectureNoteTeacherVoiceInfo(notes[1])).toEqual({
      hasPublisherVoice: true,
      voiceName: 'teacher.wav',
    });
  });
});
