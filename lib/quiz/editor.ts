import type { QuizOption } from '@/lib/types/stage';

export const QUIZ_OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

export function reorderQuizOptions(
  options: QuizOption[],
  answer: string[] | undefined,
  fromIndex: number,
  toIndex: number,
): { options: QuizOption[]; answer: string[] } {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= options.length ||
    toIndex >= options.length
  ) {
    return { options, answer: answer ?? [] };
  }

  const correctValues = new Set(answer ?? []);
  const moved = options.map((option, originalIndex) => ({ option, originalIndex }));
  const [picked] = moved.splice(fromIndex, 1);
  moved.splice(toIndex, 0, picked);

  const nextOptions = moved.map(({ option }, index) => ({
    ...option,
    value: QUIZ_OPTION_LETTERS[index] ?? option.value,
  }));
  const nextAnswer: string[] = [];
  moved.forEach(({ option }, index) => {
    if (correctValues.has(option.value)) {
      nextAnswer.push(nextOptions[index].value);
    }
  });

  return { options: nextOptions, answer: nextAnswer };
}
