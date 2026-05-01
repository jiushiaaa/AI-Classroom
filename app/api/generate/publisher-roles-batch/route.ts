/**
 * Batch-generate N polished classroom-role drafts (displayName + identity + system prompt) from
 * a single short publisher request. Used by the "AI batch generate roles" wizard.
 */

import { NextRequest } from 'next/server';
import { callLLM } from '@/lib/ai/llm';
import { isProviderKeyRequired } from '@/lib/ai/providers';
import { createLogger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { resolveModelFromRequest } from '@/lib/server/resolve-model';

const log = createLogger('PublisherRolesBatch API');

export const maxDuration = 60;

const MAX_PROMPT = 1000;
const MAX_COUNT = 8;
const MIN_COUNT = 1;
const MAX_OUTPUT_PROMPT_CHARS = 2000;
const MAX_DISPLAY_NAME_CHARS = 40;

type IdentityHint = 'auto' | 'student' | 'assistant' | 'mixed';

interface RequestBody {
  prompt: string;
  count: number;
  identityHint?: IdentityHint;
  /** BCP 47 locale hint, e.g. zh-CN */
  locale?: string;
}

interface RawRole {
  displayName?: unknown;
  identity?: unknown;
  prompt?: unknown;
}

interface NormalizedRole {
  displayName: string;
  identity: 'teacher' | 'assistant' | 'student';
  prompt: string;
}

function stripFences(text: string): string {
  let s = text.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:\w+)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return s.trim();
}

function clampCount(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : MIN_COUNT;
  return Math.max(MIN_COUNT, Math.min(MAX_COUNT, v));
}

function identityInstruction(hint: IdentityHint, locale: string): string {
  const isZh = /^zh/i.test(locale);
  if (hint === 'student') {
    return isZh
      ? '所有角色都必须是「学生」(identity = "student")，可以有不同性格 / 学习风格。'
      : 'All roles must be students (identity = "student") with diverse personalities or learning styles.';
  }
  if (hint === 'assistant') {
    return isZh
      ? '所有角色都必须是「助教」(identity = "assistant")，定位略有差异。'
      : 'All roles must be teaching assistants (identity = "assistant") with subtly different focuses.';
  }
  if (hint === 'mixed') {
    return isZh
      ? '混合身份：1 个 assistant，其余全部为 student。不要包含 teacher。'
      : 'Mixed identities: exactly one assistant, all the rest are students. Do NOT include any teacher.';
  }
  return isZh
    ? '根据用户描述自行判断每个角色的身份；可以是 student / assistant，但不要包含 teacher（主讲教师由系统单独管理）。如未明确，倾向 student。'
    : 'Infer each role\'s identity from the user description. Use student or assistant only — never teacher (the lead instructor is managed separately). When unclear, prefer student.';
}

function normalizeRole(raw: RawRole): NormalizedRole | null {
  const displayName =
    typeof raw.displayName === 'string' ? raw.displayName.trim().slice(0, MAX_DISPLAY_NAME_CHARS) : '';
  const promptStr =
    typeof raw.prompt === 'string' ? raw.prompt.trim().slice(0, MAX_OUTPUT_PROMPT_CHARS) : '';
  if (!displayName || !promptStr) return null;
  // teacher is not allowed; coerce to assistant. Default to student otherwise.
  const identity: NormalizedRole['identity'] =
    raw.identity === 'assistant' || raw.identity === 'teacher' ? 'assistant' : 'student';
  return { displayName, identity, prompt: promptStr };
}

function tryParseRoles(text: string): NormalizedRole[] {
  const cleaned = stripFences(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) return [];
    try {
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return [];
    }
  }
  let arr: unknown[] = [];
  if (Array.isArray(parsed)) {
    arr = parsed;
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.roles)) arr = obj.roles;
    else if (Array.isArray(obj.items)) arr = obj.items;
  }
  const out: NormalizedRole[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const role = normalizeRole(item as RawRole);
    if (role) out.push(role);
  }
  return out;
}

export async function POST(req: NextRequest) {
  let modelString: string | undefined;
  try {
    const body = (await req.json()) as RequestBody;
    const userPrompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const count = clampCount(body.count);
    const identityHint: IdentityHint =
      body.identityHint === 'student' ||
      body.identityHint === 'assistant' ||
      body.identityHint === 'mixed'
        ? body.identityHint
        : 'auto';
    const locale =
      typeof body.locale === 'string' && body.locale.length > 0 ? body.locale.slice(0, 20) : 'zh-CN';

    if (!userPrompt || userPrompt.length < 2) {
      return apiError('INVALID_REQUEST', 400, 'prompt must be at least 2 characters');
    }
    if (userPrompt.length > MAX_PROMPT) {
      return apiError('INVALID_REQUEST', 400, `prompt must be at most ${MAX_PROMPT} characters`);
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

    const isZh = /^zh/i.test(locale);

    const system = `You are an expert instructional designer for multi-agent AI classrooms.
Your task: from a single short publisher request, design exactly ${count} DISTINCT classroom-role personas, each with a unique character.

Output rules:
- Output **strict JSON only** (a single JSON array). No markdown, no commentary, no trailing text.
- Each array element: { "displayName": string, "identity": "student" | "assistant", "prompt": string }
- "displayName" — 2 to ${MAX_DISPLAY_NAME_CHARS} chars, vivid character name (e.g. 「好奇的小薇」 / "Curious Casey"). Must be UNIQUE across the array.
- "identity" — only "student" or "assistant"; NEVER "teacher".
- "prompt" — a 3–8-sentence plain-text persona/system prompt: tone, expertise level, classroom interaction style, 1–2 specific behaviors. No markdown, no JSON inside, no labels.
- All roles must feel diverse — DIFFERENT personalities, learning styles, or focuses. Avoid repetitive phrasing.
- Identity rule: ${identityInstruction(identityHint, locale)}
- Language: write displayName + prompt in the same primary language as the publisher's request. If mixed, prefer ${locale}.
- Do not mention that you are an AI or that this text was "generated".`;

    const user = `${isZh ? '出版商需求（原文）' : "Publisher request (verbatim)"}:\n${JSON.stringify(userPrompt)}\n\n${
      isZh ? `请输出恰好 ${count} 个角色的 JSON 数组。` : `Output a JSON array with exactly ${count} roles.`
    }`;

    log.info(
      `Publisher roles batch [count=${count}, hint=${identityHint}, model=${modelString}]`,
    );

    const result = await callLLM(
      {
        model: languageModel,
        system,
        prompt: user,
        maxOutputTokens: 2400,
      },
      'publisher-roles-batch',
      undefined,
      thinkingConfig,
    );

    const roles = tryParseRoles(result.text || '');
    if (roles.length === 0) {
      return apiError('GENERATION_FAILED', 500, 'Model returned no valid roles');
    }

    // Trim to requested count; if model returned fewer, return what we have.
    const trimmed = roles.slice(0, count);

    // Deduplicate display names (case-insensitive) — append index suffix on collision.
    const seen = new Set<string>();
    const finalRoles = trimmed.map((r, i) => {
      const lower = r.displayName.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        return r;
      }
      return { ...r, displayName: `${r.displayName} ${i + 1}` };
    });

    return apiSuccess({ roles: finalRoles });
  } catch (error) {
    log.error(
      `Publisher roles batch failed [model=${modelString ?? 'unknown'}]:`,
      error,
    );
    return apiError(
      'INTERNAL_ERROR',
      500,
      error instanceof Error ? error.message : String(error),
    );
  }
}
