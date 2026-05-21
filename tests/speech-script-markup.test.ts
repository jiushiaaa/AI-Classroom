import { describe, expect, it } from 'vitest';
import {
  getWordRangeAt,
  mergeAdjacentTextSegments,
  normalizeHomophoneSelection,
  parseSpeechScript,
  prepareSpeechTextForTts,
  serializeSpeechScript,
  speechScriptToDisplayPlain,
  speechScriptToSsmlBody,
  speechScriptToTtsPlain,
} from '@/lib/utils/speech-script-markup';

describe('speech-script-markup', () => {
  it('parses pauses and homophones', () => {
    const raw = '欢迎[[AI|爱]]来到[[break:0.2]]云梯课堂';
    expect(parseSpeechScript(raw)).toEqual([
      { type: 'text', value: '欢迎' },
      { type: 'homophone', display: 'AI', speak: '爱' },
      { type: 'text', value: '来到' },
      { type: 'break', seconds: 0.2 },
      { type: 'text', value: '云梯课堂' },
    ]);
  });

  it('round-trips through serialize', () => {
    const raw = 'A[[break:0.5s]][[词|读音]]B';
    expect(serializeSpeechScript(parseSpeechScript(raw))).toBe(
      'A[[break:0.5]][[词|读音]]B',
    );
  });

  it('strips homophone markup for display-only surfaces', () => {
    expect(speechScriptToDisplayPlain('形状[[测验|111]]、互动')).toBe('形状测验、互动');
  });

  it('converts for display and TTS plain text', () => {
    const raw = '读[[AI|爱]]一下[[break:0.3]]继续';
    expect(speechScriptToDisplayPlain(raw)).toBe('读AI一下继续');
    expect(speechScriptToTtsPlain(raw)).toBe('读爱一下 继续');
  });

  it('builds SSML body for Azure', () => {
    const raw = '[[AI|爱]]好[[break:0.2]]';
    expect(speechScriptToSsmlBody(raw)).toContain('<sub alias="爱">AI</sub>');
    expect(speechScriptToSsmlBody(raw)).toContain('<break time="200ms"/>');
  });

  it('prepares Azure vs plain providers', () => {
    const raw = '[[AI|爱]]';
    expect(prepareSpeechTextForTts(raw, 'azure-tts').useSsml).toBe(true);
    expect(prepareSpeechTextForTts(raw, 'openai-tts').useSsml).toBe(false);
    expect(prepareSpeechTextForTts(raw, 'openai-tts').plainText).toBe('爱');
  });

  it('merges adjacent text segments after homophone removal', () => {
    expect(
      mergeAdjacentTextSegments([
        { type: 'text', value: '前' },
        { type: 'text', value: '动模' },
        { type: 'text', value: '后' },
      ]),
    ).toEqual([{ type: 'text', value: '前动模后' }]);
  });

  it('normalizes homophone selection when DOM end offset is short by one', () => {
    const sourceText = '形状公式、';
    expect(normalizeHomophoneSelection(sourceText, 2, '公式')).toEqual({
      start: 2,
      end: 4,
      word: '公式',
    });
    // Simulates slice(3) leaving a trailing char — normalization fixes end.
    expect(sourceText.slice(2, 4)).toBe('公式');
    expect(sourceText.slice(4)).toBe('、');
  });

  it('finds word at caret offset', () => {
    const text = 'hello innovative';
    expect(getWordRangeAt(text, 8)).toEqual({
      start: 6,
      end: 16,
      word: 'innovative',
    });
  });
});
