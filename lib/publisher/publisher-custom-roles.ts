/**
 * B-side demo: custom classroom roles (name + identity + persona + voice + avatar), persisted locally.
 * Roles are added one-by-one via Save; list rows support enable checkbox and inline voice.
 */

export type PublisherIdentityRole = 'teacher' | 'assistant' | 'student';

export interface PublisherCustomRoleRow {
  id: string;
  displayName: string;
  identity: PublisherIdentityRole;
  prompt: string;
  voiceId: string;
  /** Public path, e.g. /avatars/curious.svg — assigned on Save */
  avatar: string;
  /** Use this role in the session when custom mode is on */
  enabled: boolean;
}

export const PUBLISHER_CUSTOM_ROLES_KEY = 'pubPublisherCustomRoles';

const MAX_ROLES = 5;

const TEACHER_AVATARS = ['/avatars/teacher.svg'] as const;
const ASSISTANT_AVATARS = ['/avatars/assistant.svg'] as const;
const STUDENT_AVATARS = [
  '/avatars/student1.svg',
  '/avatars/student2.svg',
  '/avatars/student3.svg',
  '/avatars/curious.svg',
  '/avatars/thinker.svg',
  '/avatars/notes.svg',
  '/avatars/reader.svg',
  '/avatars/learner.svg',
  '/avatars/explorer.svg',
  '/avatars/creative.svg',
  '/avatars/clown.svg',
  '/avatars/builder.svg',
  '/avatars/coder.svg',
  '/avatars/scholar.svg',
  '/avatars/dreamer.svg',
] as const;

export function newPublisherRoleId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Deterministic avatar from identity + stable id (regenerated on Save). */
export function pickPublisherAvatar(identity: PublisherIdentityRole, seed: string): string {
  const pool =
    identity === 'teacher'
      ? TEACHER_AVATARS
      : identity === 'assistant'
        ? ASSISTANT_AVATARS
        : STUDENT_AVATARS;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return pool[h % pool.length]!;
}

export const PUBLISHER_VOICE_GROUPS: Array<{
  groupLabelKey: string;
  voices: Array<{ id: string; nameKey: string }>;
}> = [
  {
    groupLabelKey: 'agentBar.publisherVoiceGroupTeacher',
    voices: [
      { id: 'cn-male-warm', nameKey: 'agentBar.publisherVoiceCnMaleWarm' },
      { id: 'cn-female-warm', nameKey: 'agentBar.publisherVoiceCnFemaleWarm' },
      { id: 'cn-male-young', nameKey: 'agentBar.publisherVoiceCnMaleYoung' },
      { id: 'cn-female-young', nameKey: 'agentBar.publisherVoiceCnFemaleYoung' },
    ],
  },
  {
    groupLabelKey: 'agentBar.publisherVoiceGroupAssistant',
    voices: [
      { id: 'cn-female-cute', nameKey: 'agentBar.publisherVoiceCnFemaleCute' },
      { id: 'cn-male-cute', nameKey: 'agentBar.publisherVoiceCnMaleCute' },
    ],
  },
  {
    groupLabelKey: 'agentBar.publisherVoiceGroupEn',
    voices: [
      { id: 'en-male-warm', nameKey: 'agentBar.publisherVoiceEnMale' },
      { id: 'en-female-warm', nameKey: 'agentBar.publisherVoiceEnFemale' },
    ],
  },
];

export function publisherVoiceDisplayName(
  voiceId: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  for (const g of PUBLISHER_VOICE_GROUPS) {
    const v = g.voices.find((x) => x.id === voiceId);
    if (v) return t(v.nameKey);
  }
  return voiceId;
}

function firstVoiceId(): string {
  return PUBLISHER_VOICE_GROUPS[0]?.voices[0]?.id ?? '';
}

export function createNewPublisherRoleDraft(): PublisherCustomRoleRow {
  return {
    id: newPublisherRoleId(),
    displayName: '',
    identity: 'student',
    prompt: '',
    voiceId: firstVoiceId(),
    avatar: '',
    enabled: true,
  };
}

function normalizeRow(raw: unknown): PublisherCustomRoleRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : newPublisherRoleId();
  const identity =
    r.identity === 'teacher' || r.identity === 'assistant' || r.identity === 'student'
      ? r.identity
      : 'student';
  const displayName = typeof r.displayName === 'string' ? r.displayName : '';
  const prompt = typeof r.prompt === 'string' ? r.prompt : '';
  const voiceId = typeof r.voiceId === 'string' ? r.voiceId : firstVoiceId();
  let avatar =
    typeof r.avatar === 'string' &&
    (r.avatar.startsWith('/avatars/') || r.avatar.startsWith('data:image/'))
      ? r.avatar
      : '';
  if (!avatar) {
    avatar = pickPublisherAvatar(identity, id);
  }
  const enabled = typeof r.enabled === 'boolean' ? r.enabled : true;
  return { id, displayName, identity, prompt, voiceId, avatar, enabled };
}

/** Empty list by default — roles appear only after user saves. */
export function defaultPublisherCustomRoles(): PublisherCustomRoleRow[] {
  return [];
}

export function loadPublisherCustomRoles(): PublisherCustomRoleRow[] {
  if (typeof globalThis.window === 'undefined') return [];
  try {
    const raw = globalThis.localStorage.getItem(PUBLISHER_CUSTOM_ROLES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return [];
    const rows: PublisherCustomRoleRow[] = [];
    for (const item of parsed.slice(0, MAX_ROLES)) {
      const row = normalizeRow(item);
      if (row) rows.push(row);
    }
    return rows;
  } catch {
    return [];
  }
}

export function savePublisherCustomRoles(rows: PublisherCustomRoleRow[]) {
  try {
    globalThis.localStorage.setItem(PUBLISHER_CUSTOM_ROLES_KEY, JSON.stringify(rows.slice(0, MAX_ROLES)));
  } catch {
    /* ignore */
  }
}

export { MAX_ROLES as PUBLISHER_CUSTOM_ROLES_MAX };
