/**
 * Expand short publisher keywords into a full classroom-role system prompt (AI Magic Fix).
 */

import { NextRequest } from 'next/server';
import { callLLM } from '@/lib/ai/llm';
import { isProviderKeyRequired } from '@/lib/ai/providers';
import { createLogger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { resolveModelFromRequest } from '@/lib/server/resolve-model';

const log = createLogger('PublisherRolePrompt API');

export const maxDuration = 60;

const MAX_DRAFT = 600;
const MAX_OUTPUT_CHARS = 4000;

interface RequestBody {
  draft: string;
  displayName?: string;
  identity: 'teacher' | 'assistant' | 'student';
  /** BCP 47 locale hint for output language, e.g. zh-CN */
  locale?: string;
}

function stripFences(text: string): string {
  let s = text.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:\w+)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return s.trim();
}

function identityInstruction(identity: RequestBody['identity']): string {
  if (identity === 'teacher') {
    return 'The agent is the lead instructor (主讲教师) in a live AI classroom.';
  }
  if (identity === 'assistant') {
    return 'The agent is a teaching assistant (助教): supports the teacher, clarifies, and guides discussion.';
  }
  return 'The agent is a student persona (学生角色): asks questions, reflects misconceptions, and participates in discussion.';
}

export async function POST(req: NextRequest) {
  let modelString: string | undefined;
  try {
    const body = (await req.json()) as RequestBody;
    const draft = typeof body.draft === 'string' ? body.draft.trim() : '';
    const displayName =
      typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 80) : '';
    const identity = body.identity;
    const locale =
      typeof body.locale === 'string' && body.locale.length > 0 ? body.locale.slice(0, 20) : 'zh-CN';

    if (!draft || draft.length < 2) {
      return apiError('INVALID_REQUEST', 400, 'draft must be at least 2 characters');
    }
    if (draft.length > MAX_DRAFT) {
      return apiError('INVALID_REQUEST', 400, `draft must be at most ${MAX_DRAFT} characters`);
    }
    if (identity !== 'teacher' && identity !== 'assistant' && identity !== 'student') {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'identity must be teacher, assistant, or student');
    }

    const {
      model: languageModel,
      modelString: ms,
      apiKey,
      providerId,
      thinkingConfig,
    } = await resolveModelFromRequest(req, body);
    modelString = ms;

    if (isProviderKeyRequired(providerId) && !apiKey) {
      return apiError('MISSING_API_KEY', 401, 'API Key is required for this provider');
    }

    const system = `You are an expert instructional designer for multi-agent AI classrooms.
Your task: turn a short keyword or phrase from a publisher into a single, polished **system prompt** (persona + behavior) for one classroom agent.

Rules:
- Output **plain text only** — no markdown, no JSON, no bullet labels like "System:".
- 3–8 sentences, vivid and concrete; include tone, expertise level, how they interact with students, and one or two classroom behaviors.
- Stay aligned with the given role type (teacher / assistant / student).
- If a display name is provided, weave it naturally into the persona (as the character's name).
- Write in the same primary language as the publisher's draft (e.g. Chinese if the draft is Chinese; English if English). If the draft mixes languages, prefer the language of ${locale}.
- Do not mention that you are an AI or that this text was "generated".`;

    const user = `Role type:\n${identityInstruction(identity)}
${displayName ? `\nCharacter display name (use in persona): ${displayName}\n` : ''}
Publisher keywords / short notes (verbatim):\n${JSON.stringify(draft)}\n\nWrite the final system prompt only.`;

    log.info(`Publisher role prompt expand [identity=${identity}, model=${modelString}]`);

    const result = await callLLM(
      {
        model: languageModel,
        system,
        prompt: user,
        maxOutputTokens: 900,
      },
      'publisher-role-prompt',
      undefined,
      thinkingConfig,
    );

    let prompt = stripFences(result.text || '');
    if (!prompt) {
      return apiError('GENERATION_FAILED', 500, 'Model returned empty text');
    }
    if (prompt.length > MAX_OUTPUT_CHARS) {
      prompt = prompt.slice(0, MAX_OUTPUT_CHARS).trim();
    }

    return apiSuccess({ prompt });
  } catch (error) {
    log.error(
      `Publisher role prompt failed [model=${modelString ?? 'unknown'}]:`,
      error,
    );
    return apiError('INTERNAL_ERROR', 500, error instanceof Error ? error.message : String(error));
  }
}
