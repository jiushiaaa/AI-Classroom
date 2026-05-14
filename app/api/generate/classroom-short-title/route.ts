/**
 * Generates a ≤10-grapheme display title for the classroom completion screen.
 */

import { NextRequest } from 'next/server';
import { callLLM } from '@/lib/ai/llm';
import { createLogger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { resolveModelFromRequest } from '@/lib/server/resolve-model';
import {
  buildShortTitleMessages,
  heuristicShortTitle,
  parseShortTitleJson,
} from '@/lib/generation/classroom-short-title';

const log = createLogger('Classroom Short Title API');

export const maxDuration = 60;

interface RequestBody {
  rawTitle: string;
  sceneTitles?: string[];
  languageDirective?: string;
}

export async function POST(req: NextRequest) {
  let rawPreview: string | undefined;
  try {
    const body = (await req.json()) as RequestBody;
    const rawTitle = typeof body.rawTitle === 'string' ? body.rawTitle.trim() : '';
    rawPreview = rawTitle.slice(0, 80);
    if (!rawTitle) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'rawTitle is required');
    }

    const sceneTitles = Array.isArray(body.sceneTitles)
      ? body.sceneTitles.filter((t): t is string => typeof t === 'string').map((t) => t.trim())
      : undefined;
    const languageDirective =
      typeof body.languageDirective === 'string' ? body.languageDirective.trim() : undefined;

    const { model: languageModel, thinkingConfig } = await resolveModelFromRequest(req, body);

    const { system, user } = buildShortTitleMessages({
      rawTitle,
      sceneTitles,
      languageDirective,
    });

    const result = await callLLM(
      { model: languageModel, system, prompt: user },
      'classroom-short-title',
      undefined,
      thinkingConfig,
    );

    const parsed = parseShortTitleJson(result.text);
    const shortTitle = parsed || heuristicShortTitle(rawTitle);

    log.info(`Short title for "${rawPreview}…" → "${shortTitle}"`);

    return apiSuccess({ shortTitle });
  } catch (error) {
    log.error(`classroom-short-title failed [raw="${rawPreview ?? ''}"]:`, error);
    return apiError('INTERNAL_ERROR', 500, error instanceof Error ? error.message : String(error));
  }
}
