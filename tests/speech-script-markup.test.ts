import { describe, expect, it } from 'vitest';
import {
  getWordRangeAt,
  mergeAdjacentTextSegments,
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

  it('finds word at caret offset', () => {
    const text = 'hello innovative';
    expect(getWordRangeAt(text, 8)).toEqual({
      start: 6,
      end: 16,
      word: 'innovative',
    });
  });
});
