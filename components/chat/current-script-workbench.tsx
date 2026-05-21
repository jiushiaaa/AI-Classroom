'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Captions,
  CaptionsOff,
  Gauge,
  Loader2,
  Mic2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Timer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  SpeechScriptEditor,
  type SpeechScriptEditorHandle,
} from '@/components/chat/speech-script-editor';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { TeacherVoicePill } from '@/components/agent/agent-bar';
import { DEFAULT_TEACHER_AVATAR } from '@/components/roundtable/constants';
import { getAvailableProvidersWithVoices } from '@/lib/audio/voice-resolver';
import type { ProviderWithVoices } from '@/lib/audio/voice-resolver';
import type { TTSProviderId } from '@/lib/audio/types';
import { useVoxCPMVoiceProfiles } from '@/lib/audio/voxcpm-voices';
import { useAgentRegistry } from '@/lib/orchestration/registry/store';
import { useSettingsStore } from '@/lib/store/settings';
import { useI18n } from '@/lib/hooks/use-i18n';
import {
  LectureAudioSeekBar,
  computeLectureSeekStripVisibility,
  type LectureAudioProgress,
} from '@/components/playback/lecture-audio-seek-bar';
import type { LectureNoteEntry } from '@/lib/types/chat';
import type { EngineMode } from '@/lib/playback';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
import { getLectureNoteTeacherVoiceInfo } from '@/lib/utils/lecture-notes';
import { speechScriptToTtsPlain } from '@/lib/utils/speech-script-markup';

interface CurrentScriptWorkbenchProps {
  readonly note: LectureNoteEntry | null;
  readonly engineMode: EngineMode;
  readonly onEditSpeech?: (sceneId: string, actionId: string, newText: string) => void;
  readonly onAiGenerateScene?: (sceneId: string, userInstructions?: string) => void;
  readonly onUploadTeacherVoice?: (sceneId: string, file: File) => Promise<void> | void;
  readonly onRemoveTeacherVoice?: (sceneId: string) => void;
  readonly onPlayPause?: () => void;
  readonly lectureAudioProgress?: LectureAudioProgress | null;
  readonly onLectureAudioSeek?: (ratio: number) => void;
  readonly speechProgress?: number | null;
  readonly isOpenmaicDemoClassroom?: boolean;
  readonly lectureSeekBlocked?: boolean;
}

const AI_OPTIMIZE_PLACEHOLDER =
  '可选：输入优化需求，比如更像老师讲课、更生动、更简洁、增加互动提问。不填写则根据当前页面内容生成优化稿。';

const toolBtnClass =
  'flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-900 dark:hover:text-gray-100';

export function CurrentScriptWorkbench({
  note,
  engineMode,
  onEditSpeech,
  onAiGenerateScene,
  onUploadTeacherVoice,
  onRemoveTeacherVoice,
  onPlayPause,
  lectureAudioProgress,
  onLectureAudioSeek,
  speechProgress,
  isOpenmaicDemoClassroom = false,
  lectureSeekBlocked = false,
}: CurrentScriptWorkbenchProps) {
  const { t } = useI18n();
  const speechItems = useMemo(
    () =>
      note?.items.filter(
        (item): item is Extract<LectureNoteEntry['items'][number], { kind: 'speech' }> =>
          item.kind === 'speech',
      ) ?? [],
    [note],
  );
  const scriptText = useMemo(
    () => speechItems.map((item) => item.text).join('\n'),
    [speechItems],
  );
  const teacherVoiceInfo = useMemo(
    () =>
      note
        ? getLectureNoteTeacherVoiceInfo(note)
        : {
            hasPublisherVoice: false,
            voiceName: '',
          },
    [note],
  );
  const [draft, setDraft] = useState('');
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiOptimizeOpen, setAiOptimizeOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [demoPlaying, setDemoPlaying] = useState(false);
  const demoStopRef = useRef<(() => void) | null>(null);
  const scriptEditorRef = useRef<SpeechScriptEditorHandle>(null);
  const agentsRecord = useAgentRegistry((state) => state.agents);
  const selectedAgentIds = useSettingsStore((state) => state.selectedAgentIds);
  const teacherCustomDisplayName = useSettingsStore((state) => state.teacherCustomDisplayName);
  const presetAgentOverrides = useSettingsStore((state) => state.presetAgentOverrides);
  const ttsSpeed = useSettingsStore((state) => state.ttsSpeed);
  const setTTSSpeed = useSettingsStore((state) => state.setTTSSpeed);
  const ttsEnabled = useSettingsStore((state) => state.ttsEnabled);
  const ttsProvidersConfig = useSettingsStore((state) => state.ttsProvidersConfig);
  const teacherSubtitlesVisible = useSettingsStore((state) => state.teacherSubtitlesVisible);
  const setTeacherSubtitlesVisible = useSettingsStore((state) => state.setTeacherSubtitlesVisible);
  const { profiles: voxcpmProfiles } = useVoxCPMVoiceProfiles();
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof globalThis.window === 'undefined' || !globalThis.speechSynthesis) return;
    const loadVoices = () => setBrowserVoices(globalThis.speechSynthesis.getVoices());
    loadVoices();
    globalThis.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => globalThis.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, []);

  const availableProviders = useMemo((): ProviderWithVoices[] => {
    const serverProviders = getAvailableProvidersWithVoices(ttsProvidersConfig, voxcpmProfiles);
    if (browserVoices.length === 0) return serverProviders;
    return [
      ...serverProviders,
      {
        providerId: 'browser-native-tts' as TTSProviderId,
        providerName: 'Browser Native',
        voices: browserVoices.map((v) => ({ id: v.voiceURI, name: v.name })),
        modelGroups: [
          {
            modelId: '',
            modelName: 'Browser Native',
            voices: browserVoices.map((v) => ({ id: v.voiceURI, name: v.name })),
          },
        ],
      },
    ];
  }, [browserVoices, ttsProvidersConfig, voxcpmProfiles]);

  useEffect(() => {
    setDraft(scriptText);
  }, [scriptText]);

  const canEdit = Boolean(note && speechItems.length > 0 && onEditSpeech);
  const dirty = draft.trim() !== scriptText.trim();
  const engineIsPlaying = engineMode === 'playing' || engineMode === 'live';
  const isPlaying = engineIsPlaying || demoPlaying;
  const teacherAgents = useMemo(() => {
    const agents = Object.values(agentsRecord).filter(
      (agent) => agent.role === 'teacher' || agent.isGenerated,
    );
    return agents.length > 0 ? agents : Object.values(agentsRecord).slice(0, 3);
  }, [agentsRecord]);
  const selectedTeacher =
    selectedAgentIds.map((id) => agentsRecord[id]).find((agent) => agent?.role === 'teacher') ??
    teacherAgents[0];
  const selectedTeacherName = getTeacherDisplayName(
    selectedTeacher,
    teacherCustomDisplayName,
    presetAgentOverrides,
  );
  const selectedTeacherAvatar = selectedTeacher?.avatar || DEFAULT_TEACHER_AVATAR;

  const engineStateForSeek: 'idle' | 'playing' | 'paused' =
    engineMode === 'playing' || engineMode === 'live'
      ? 'playing'
      : engineMode === 'paused'
        ? 'paused'
        : 'idle';

  const { showHtmlAudioSeek, showDemoTranscriptProgress } = computeLectureSeekStripVisibility({
    lectureAudioProgress,
    onLectureAudioSeek,
    lectureSeekBlocked,
    isOpenmaicDemoClassroom,
    engineState: engineStateForSeek,
    speechProgress,
  });

  const seekProgress: LectureAudioProgress = showHtmlAudioSeek
    ? lectureAudioProgress!
    : showDemoTranscriptProgress
      ? {
          currentMs: (speechProgress ?? 0) * 60000,
          durationMs: 60000,
        }
      : {
          currentMs: lectureAudioProgress?.currentMs ?? 0,
          durationMs: lectureAudioProgress?.durationMs ?? 60000,
        };

  const seekEnabled =
    Boolean(onLectureAudioSeek) &&
    !lectureSeekBlocked &&
    (showHtmlAudioSeek || showDemoTranscriptProgress);

  const syncDraftToScene = useCallback(
    (nextDraft: string) => {
      if (!note || speechItems.length === 0 || nextDraft.trim() === scriptText.trim()) return;
      if (speechItems.length === 1) {
        onEditSpeech?.(note.sceneId, speechItems[0].actionId, nextDraft);
        return;
      }

      const nextTexts = nextDraft
        .split(/\n+/)
        .map((text) => text.trim())
        .filter(Boolean);
      speechItems.forEach((speech, index) => {
        const nextText = nextTexts[index] ?? speech.text;
        if (nextText !== speech.text) {
          onEditSpeech?.(note.sceneId, speech.actionId, nextText);
        }
      });
    },
    [note, onEditSpeech, scriptText, speechItems],
  );

  useEffect(() => {
    if (!canEdit || !dirty) return;
    const timer = setTimeout(() => {
      syncDraftToScene(draft);
    }, 250);
    return () => clearTimeout(timer);
  }, [canEdit, dirty, draft, syncDraftToScene]);

  const commitDraft = () => {
    syncDraftToScene(draft);
  };

  const stopDemoSpeech = useCallback(() => {
    demoStopRef.current?.();
    demoStopRef.current = null;
    setDemoPlaying(false);
  }, []);

  const handleDemoPlayPause = useCallback(() => {
    if (engineIsPlaying) {
      onPlayPause?.();
      return;
    }

    if (demoPlaying) {
      stopDemoSpeech();
      return;
    }

    const text = speechScriptToTtsPlain(draft.trim() || scriptText.trim());
    setDemoPlaying(true);

    if (typeof globalThis.window !== 'undefined' && 'speechSynthesis' in globalThis.window && text) {
      globalThis.window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = ttsSpeed;
      utterance.onend = () => {
        demoStopRef.current = null;
        setDemoPlaying(false);
      };
      utterance.onerror = () => {
        demoStopRef.current = null;
        setDemoPlaying(false);
      };
      demoStopRef.current = () => {
        globalThis.window.speechSynthesis.cancel();
      };
      globalThis.window.speechSynthesis.speak(utterance);
      return;
    }

    const timer = globalThis.window.setTimeout(() => {
      demoStopRef.current = null;
      setDemoPlaying(false);
    }, Math.max(1200, Math.min(6000, text.length * 120)));
    demoStopRef.current = () => globalThis.window.clearTimeout(timer);
  }, [demoPlaying, draft, engineIsPlaying, onPlayPause, scriptText, stopDemoSpeech, ttsSpeed]);

  useEffect(() => () => stopDemoSpeech(), [stopDemoSpeech]);

  const handleAiOptimizeConfirm = () => {
    if (!note) return;
    onAiGenerateScene?.(
      note.sceneId,
      aiInstruction.trim().length > 0 ? aiInstruction.trim() : undefined,
    );
    setAiOptimizeOpen(false);
  };

  const closeAiOptimizeDialog = () => {
    setAiOptimizeOpen(false);
  };

  if (!note) {
    return (
      <section className="h-[168px] shrink-0 border-t border-gray-100/60 bg-white/95 px-5 py-4 dark:border-gray-800/60 dark:bg-gray-950">
        <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-gray-200/70 text-sm text-gray-400 dark:border-gray-800/70">
          当前页暂无讲稿
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-[200px] shrink-0 flex-col border-t border-gray-100/60 bg-white/95 shadow-[0_-8px_20px_rgba(15,23,42,0.025)] dark:border-gray-800/60 dark:bg-gray-950">
      {/* 与预览页 Roundtable 一致：进度条在底部面板顶部 */}
      <div className="shrink-0 border-b border-gray-100/40 px-3 pb-1.5 pt-0 dark:border-gray-700/30">
        <LectureAudioSeekBar
          progress={seekProgress}
          onSeek={onLectureAudioSeek ?? (() => {})}
          disabled={!seekEnabled}
          smoothFollow={showDemoTranscriptProgress}
          aria-label={
            showHtmlAudioSeek
              ? t('roundtable.lectureSeekBar')
              : t('roundtable.demoRevealProgress')
          }
        />
      </div>

      <div className="flex min-h-0 flex-1 gap-3 px-4 py-3">
        <div className="group/teacher-voice relative flex w-[88px] shrink-0 flex-col items-center px-1 pt-0.5">
          <div className="relative">
            <AvatarImage
              src={selectedTeacherAvatar}
              alt={selectedTeacherName}
              className="size-9 shadow-sm ring-1 ring-purple-100/70 transition-shadow group-hover/teacher-voice:ring-purple-200/90 dark:ring-purple-900/30 dark:group-hover/teacher-voice:ring-purple-700/50"
            />
            {availableProviders.length > 0 && (
              <div
                className={cn(
                  'pointer-events-none absolute left-[calc(100%+6px)] top-1/2 z-30 flex -translate-y-1/2 items-center gap-1.5',
                  'rounded-lg border border-gray-200/90 bg-white/98 px-2 py-1 shadow-md shadow-gray-900/8',
                  'opacity-0 transition-opacity duration-150',
                  'dark:border-gray-700/80 dark:bg-gray-950/98 dark:shadow-black/30',
                  'group-hover/teacher-voice:pointer-events-auto group-hover/teacher-voice:opacity-100',
                  'focus-within:pointer-events-auto focus-within:opacity-100',
                )}
              >
                <span className="shrink-0 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                  声音
                </span>
                <TeacherVoicePill
                  availableProviders={availableProviders}
                  disabled={!ttsEnabled}
                  previewDisplayName={selectedTeacherName}
                />
              </div>
            )}
          </div>
          <span className="mt-1.5 max-w-[72px] truncate text-center text-[11px] font-semibold text-gray-700 dark:text-gray-200">
            AI老师
          </span>
          {teacherVoiceInfo.hasPublisherVoice && (
            <span className="mt-0.5 max-w-[72px] truncate text-center text-[9px] text-emerald-600 dark:text-emerald-400">
              本页真人
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative mb-2 flex min-h-8 shrink-0 items-center">
            <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => scriptEditorRef.current?.insertPause()}
                    aria-label="插入停顿"
                    className={toolBtnClass}
                  >
                    <Timer className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">插入停顿（选中后按 Delete 可删除）</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <label
                    className={cn(
                      toolBtnClass,
                      'cursor-pointer',
                      teacherVoiceInfo.hasPublisherVoice &&
                        'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-emerald-950/25 dark:text-emerald-300 dark:hover:bg-emerald-900/35',
                      uploading && 'pointer-events-none opacity-70',
                    )}
                    aria-label={
                      teacherVoiceInfo.hasPublisherVoice
                        ? '替换真人语音'
                        : '上传真人语音替换当前页'
                    }
                  >
                    {uploading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Mic2 className="size-4" />
                    )}
                    <input
                      type="file"
                      accept="audio/*"
                      className="sr-only"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        event.currentTarget.value = '';
                        if (!file || !note) return;
                        setUploading(true);
                        try {
                          await onUploadTeacherVoice?.(note.sceneId, file);
                        } finally {
                          setUploading(false);
                        }
                      }}
                    />
                  </label>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {teacherVoiceInfo.hasPublisherVoice ? '替换真人语音' : '上传真人语音替换当前页'}
                </TooltipContent>
              </Tooltip>

              {teacherVoiceInfo.hasPublisherVoice && onRemoveTeacherVoice && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!note) return;
                        setUploading(true);
                        try {
                          await onRemoveTeacherVoice(note.sceneId);
                        } finally {
                          setUploading(false);
                        }
                      }}
                      disabled={uploading}
                      aria-label="移除真人语音，恢复 AI 老师声音"
                      className={cn(
                        toolBtnClass,
                        'bg-emerald-50 text-emerald-700 hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-70 dark:bg-emerald-950/25 dark:text-emerald-300 dark:hover:bg-red-950/25 dark:hover:text-red-300',
                      )}
                    >
                      {uploading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <RotateCcw className="size-4" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">移除真人语音，恢复 AI 老师声音</TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleDemoPlayPause}
                    aria-label={isPlaying ? '暂停语音' : '播放语音'}
                    className={cn(toolBtnClass, isPlaying && 'text-gray-900 dark:text-gray-100')}
                  >
                    {isPlaying ? (
                      <Pause className="size-4 fill-current" />
                    ) : (
                      <Play className="size-4" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">{isPlaying ? '暂停语音' : '播放语音'}</TooltipContent>
              </Tooltip>

              <Popover>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={toolBtnClass}
                        aria-label="设置老师语速"
                      >
                        <Gauge className="size-4" />
                      </button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top">设置老师语速</TooltipContent>
                </Tooltip>
                <PopoverContent side="top" align="center" sideOffset={8} className="w-64 rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">语速</span>
                    <Slider
                      value={[ttsSpeed]}
                      min={0.6}
                      max={1.5}
                      step={0.05}
                      onValueChange={(value) => setTTSSpeed(value[0] ?? 1)}
                    />
                    <span className="w-12 text-right text-sm text-gray-700 dark:text-gray-300">
                      {ttsSpeed.toFixed(2)}x
                    </span>
                  </div>
                </PopoverContent>
              </Popover>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setTeacherSubtitlesVisible(!teacherSubtitlesVisible)}
                    aria-pressed={teacherSubtitlesVisible}
                    aria-label={
                      teacherSubtitlesVisible ? '关闭 AI 老师字幕' : '开启 AI 老师字幕'
                    }
                    className={toolBtnClass}
                  >
                    {teacherSubtitlesVisible ? (
                      <Captions className="size-4" />
                    ) : (
                      <CaptionsOff className="size-4" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {teacherSubtitlesVisible ? '关闭 AI 老师字幕' : '开启 AI 老师字幕'}
                </TooltipContent>
              </Tooltip>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setAiOptimizeOpen(true)}
                  aria-label="AI 优化讲稿"
                  className="ml-auto size-8 rounded-lg text-purple-600 hover:bg-purple-50 hover:text-purple-700 dark:text-purple-300 dark:hover:bg-purple-950/30"
                >
                  <Sparkles className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">AI 优化讲稿</TooltipContent>
            </Tooltip>
          </div>

          <SpeechScriptEditor
            ref={scriptEditorRef}
            value={draft}
            onChange={setDraft}
            onBlur={commitDraft}
            disabled={!canEdit}
            placeholder="输入当前页 AI 老师要讲的话；选中文字可设置同音读法"
            className="min-h-[100px] flex-1 resize-y border-0 bg-transparent shadow-none"
          />
        </div>
      </div>

      <Dialog open={aiOptimizeOpen} onOpenChange={setAiOptimizeOpen}>
        <DialogContent className="max-w-md gap-4 sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>AI 优化讲稿</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              可填写优化方向，也可留空直接根据当前页内容生成优化稿。
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={aiInstruction}
            onChange={(event) => setAiInstruction(event.target.value)}
            placeholder={AI_OPTIMIZE_PLACEHOLDER}
            rows={4}
            className="min-h-[88px] resize-y text-sm"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeAiOptimizeDialog}>
              取消
            </Button>
            <Button type="button" onClick={handleAiOptimizeConfirm}>
              开始优化
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function getTeacherDisplayName(
  agent: AgentConfig | undefined,
  customTeacherName: string,
  overrides: Record<string, { name?: string; persona?: string }>,
) {
  if (!agent) return 'AI老师';
  if (agent.id === 'default-1' && customTeacherName.trim()) return customTeacherName.trim();
  return overrides[agent.id]?.name?.trim() || agent.name || 'AI老师';
}

function AvatarImage({
  src,
  alt,
  className,
}: {
  readonly src: string;
  readonly alt: string;
  readonly className?: string;
}) {
  if (src.startsWith('/') || src.startsWith('http')) {
    return (
      <span className={cn('block overflow-hidden rounded-full bg-white dark:bg-gray-900', className)}>
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'flex items-center justify-center rounded-full bg-gray-100 text-lg dark:bg-gray-900',
        className,
      )}
      aria-label={alt}
    >
      {src || alt.slice(0, 1)}
    </span>
  );
}
