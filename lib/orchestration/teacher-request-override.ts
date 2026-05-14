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
): AgentConfig | null {
  const nameTrim = teacherCustomDisplayName.trim();
  const personaTrim = teacherPersonaSupplement.trim();
  if (nameTrim === '' && personaTrim === '') {
    return null;
  }
  const name = nameTrim === '' ? base.name : nameTrim;
  const persona =
    personaTrim === ''
      ? base.persona
      : `${base.persona}\n\n# User-defined instructor persona\n${personaTrim}`;
  return {
    ...base,
    name,
    persona,
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
): AgentConfig | null {
  const nameTrim = (nameOverride ?? '').trim();
  const personaDefined = personaOverride !== undefined;
  const personaTrim = personaDefined ? personaOverride.trim() : '';
  const hasName = nameTrim !== '';
  const hasPersona = personaDefined && personaTrim !== '';
  if (!hasName && !hasPersona) {
    return null;
  }
  return {
    ...base,
    name: hasName ? nameTrim : base.name,
    persona: hasPersona ? personaTrim : base.persona,
  };
}
