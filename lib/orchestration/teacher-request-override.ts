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
