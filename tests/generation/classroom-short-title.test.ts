import { describe, expect, it } from 'vitest';
import { heuristicShortTitle, truncateToMaxGraphemes } from '@/lib/generation/classroom-short-title';

describe('classroom-short-title', () => {
  it('truncates to max grapheme clusters', () => {
    expect(truncateToMaxGraphemes('一二三四五六七八九十', 4)).toBe('一二三四');
  });

  it('heuristic extracts 《》 title', () => {
    expect(heuristicShortTitle('品读《荒野尘梦》整本书', 10)).toBe('荒野尘梦');
  });
});
