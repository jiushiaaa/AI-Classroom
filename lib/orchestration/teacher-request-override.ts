import type { AgentConfig } from '@/lib/orchestration/registry/types';

/**
 * When the user customizes the built-in teacher (default-1) in settings,
 * merge those fields into a request payload for /api/chat so the
 * orchestration graph applies them via agentConfigOverrides.
 */
export function mergeTeacherAgentConfigForChatRequest(
  base: AgentConfig,
  teacherCustomDisplayName: string,
  teacherPersonaSupplement: string,
  teacherCustomAvatar?: string,
): AgentConfig | null {
  const nameTrim = teacherCustomDisplayName.trim();
  const personaTrim = teacherPersonaSupplement.trim();
  const avatarTrim = (teacherCustomAvatar ?? '').trim();
  if (nameTrim === '' && personaTrim === '' && avatarTrim === '') {
    return null;
  }
  const name = nameTrim === '' ? base.name : nameTrim;
  const persona =
    personaTrim === ''
      ? base.persona
      : `${base.persona}\n\n# User-defined instructor persona\n${personaTrim}`;
  const avatar = avatarTrim === '' ? base.avatar : avatarTrim;
  return {
    ...base,
    name,
    persona,
    avatar,
  };
}

/**
 * Merge user overrides for built-in non-teacher presets (e.g. default-2..6)
 * into the chat request payload. Empty / omitted overrides keep the registry field.
 */
export function mergeBuiltinPresetAgentForChatRequest(
  base: AgentConfig,
  nameOverride?: string,
  personaOverride?: string,
  avatarOverride?: string,
): AgentConfig | null {
  const nameTrim = (nameOverride ?? '').trim();
  const personaDefined = personaOverride !== undefined;
  const personaTrim = personaDefined ? personaOverride.trim() : '';
  const avatarTrim = (avatarOverride ?? '').trim();
  const hasName = nameTrim !== '';
  const hasPersona = personaDefined && personaTrim !== '';
  const hasAvatar = avatarTrim !== '';
  if (!hasName && !hasPersona && !hasAvatar) {
    return null;
  }
  return {
    ...base,
    name: hasName ? nameTrim : base.name,
    persona: hasPersona ? personaTrim : base.persona,
    avatar: hasAvatar ? avatarTrim : base.avatar,
  };
}
