import type { LectureNoteEntry } from '@/lib/types/chat';

export type LectureNoteVoiceStatus = 'ai' | 'teacher' | 'empty';

export function getCurrentLectureNote(
  notes: LectureNoteEntry[],
  currentSceneId?: string | null,
): LectureNoteEntry | null {
  if (notes.length === 0) return null;
  if (!currentSceneId) return notes[0];
  return notes.find((note) => note.sceneId === currentSceneId) ?? notes[0];
}

export function getLectureNoteVoiceStatus(note: LectureNoteEntry): LectureNoteVoiceStatus {
  const firstSpeech = note.items.find((item) => item.kind === 'speech');
  if (!firstSpeech || firstSpeech.kind !== 'speech') return 'empty';
  return firstSpeech.publisherVoiceUploadedAt ? 'teacher' : 'ai';
}
