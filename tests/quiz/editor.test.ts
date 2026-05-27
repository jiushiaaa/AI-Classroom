import { describe, expect, it } from 'vitest';
import { reorderQuizOptions } from '@/lib/quiz/editor';
import { isManuallyEditableSceneType, type QuizOption } from '@/lib/types/stage';

describe('quiz editor helpers', () => {
  const options: QuizOption[] = [
    { value: 'A', label: '太阳能' },
    { value: 'B', label: '风能' },
    { value: 'C', label: '天然气' },
    { value: 'D', label: '生物质能' },
  ];

  it('reletters options and keeps the correct answer attached to the moved option', () => {
    const result = reorderQuizOptions(options, ['B'], 1, 0);

    expect(result.options).toEqual([
      { value: 'A', label: '风能' },
      { value: 'B', label: '太阳能' },
      { value: 'C', label: '天然气' },
      { value: 'D', label: '生物质能' },
    ]);
    expect(result.answer).toEqual(['A']);
  });

  it('keeps multiple correct answers sorted by the new option order', () => {
    const result = reorderQuizOptions(options, ['A', 'D'], 3, 1);

    expect(result.options).toEqual([
      { value: 'A', label: '太阳能' },
      { value: 'B', label: '生物质能' },
      { value: 'C', label: '风能' },
      { value: 'D', label: '天然气' },
    ]);
    expect(result.answer).toEqual(['A', 'B']);
  });

  it('treats quiz scenes as manually editable in publisher edit mode', () => {
    expect(isManuallyEditableSceneType('quiz')).toBe(true);
  });
});
