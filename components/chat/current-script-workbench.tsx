'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gauge, Loader2, Mic2, Pause, Play, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { DEFAULT_TEACHER_AVATAR } from '@/components/roundtable/constants';
import { useAgentRegistry } from '@/lib/orchestration/registry/store';
import { useSettingsStore } from '@/lib/store/settings';
import { TeacherVoicePill } from '@/components/agent/agent-bar';
import { getAvailableProvidersWithVoices } from '@/lib/audio/voice-resolver';
import { useVoxCPMVoiceProfiles } from '@/lib/audio/voxcpm-voices';
import type { LectureNoteEntry } from '@/lib/types/chat';
import type { EngineMode } from '@/lib/playback';
import type { AgentConfig } from '@/lib/orchestration/registry/types';

interface CurrentScriptWorkbenchProps {
  readonly note: LectureNoteEntry | null;
  readonly engineMode: EngineMode;
  readonly onEditSpeech?: (sceneId: string, actionId: string, newText: string) => void;
  readonly onAiGenerateScene?: (sceneId: string, userInstructions?: string) => void;
  readonly onUploadTeacherVoice?: (sceneId: string, file: File) => Promise<void> | void;
  readonly onRemoveTeacherVoice?: (sceneId: string) => void;
  readonly onPlayPause?: () => void;
}

export function CurrentScriptWorkbench({
  note,
  engineMode,
  onEditSpeech,
  onAiGenerateScene,
  onUploadTeacherVoice,
  onRemoveTeacherVoice: _onRemoveTeacherVoice,
  onPlayPause,
}: CurrentScriptWorkbenchProps) {
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
  const [draft, setDraft] = useState('');
  const [aiInstruction, setAiInstruction] = useState('');
  const [uploading, setUploading] = useState(false);
  const [teacherControlsOpen, setTeacherControlsOpen] = useState(false);
  const [demoPlaying, setDemoPlaying] = useState(false);
  const demoStopRef = useRef<(() => void) | null>(null);
  const agentsRecord = useAgentRegistry((state) => state.agents);
  const selectedAgentIds = useSettingsStore((state) => state.selectedAgentIds);
  const teacherCustomDisplayName = useSettingsStore((state) => state.teacherCustomDisplayName);
  const presetAgentOverrides = useSettingsStore((state) => state.presetAgentOverrides);
  const ttsSpeed = useSettingsStore((state) => state.ttsSpeed);
  const setTTSSpeed = useSettingsStore((state) => state.setTTSSpeed);
  const ttsEnabled = useSettingsStore((state) => state.ttsEnabled);
  const ttsProvidersConfig = useSettingsStore((state) => state.ttsProvidersConfig);
  const { profiles: voxcpmProfiles } = useVoxCPMVoiceProfiles();

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
  const availableProviders = useMemo(
    () => getAvailableProvidersWithVoices(ttsProvidersConfig, voxcpmProfiles),
    [ttsProvidersConfig, voxcpmProfiles],
  );

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

    const text = draft.trim() || scriptText.trim();
    setDemoPlaying(true);

    if (typeof window !== 'undefined' && 'speechSynthesis' in window && text) {
      window.speechSynthesis.cancel();
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
        window.speechSynthesis.cancel();
      };
      window.speechSynthesis.speak(utterance);
      return;
    }

    const timer = window.setTimeout(() => {
      demoStopRef.current = null;
      setDemoPlaying(false);
    }, Math.max(1200, Math.min(6000, text.length * 120)));
    demoStopRef.current = () => window.clearTimeout(timer);
  }, [demoPlaying, draft, engineIsPlaying, onPlayPause, scriptText, stopDemoSpeech, ttsSpeed]);

  useEffect(() => () => stopDemoSpeech(), [stopDemoSpeech]);

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
    <section className="min-h-[188px] shrink-0 border-t border-gray-100/60 bg-white/95 px-4 py-3 shadow-[0_-8px_20px_rgba(15,23,42,0.025)] dark:border-gray-800/60 dark:bg-gray-950">
      <div className="flex h-full gap-3">
        <div
          className="relative flex w-[72px] shrink-0 items-start px-2.5 py-2.5"
          onMouseEnter={() => setTeacherControlsOpen(true)}
          onMouseLeave={() => setTeacherControlsOpen(false)}
          onFocus={() => setTeacherControlsOpen(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setTeacherControlsOpen(false);
            }
          }}
        >
          <div className="flex min-w-0 items-start gap-2">
            <button
              type="button"
              className="group flex shrink-0 flex-col items-start rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-purple-200"
              aria-label="AI老师设置"
              aria-expanded={teacherControlsOpen}
            >
              <AvatarImage
                src={selectedTeacherAvatar}
                alt={selectedTeacherName}
                className="size-9 shadow-sm ring-1 ring-purple-100/70 transition-transform group-hover:scale-105 dark:ring-purple-900/30"
              />
              {!teacherControlsOpen && (
                <span className="mt-1.5 max-w-[54px] truncate text-[11px] font-semibold text-gray-700 dark:text-gray-200">
                  AI老师
                </span>
              )}
            </button>

            <div
              className={cn(
                'absolute left-[62px] top-2 z-30 flex h-10 min-w-0 items-center overflow-hidden rounded-xl border border-gray-100/80 bg-white/95 shadow-[0_8px_24px_rgba(15,23,42,0.13)] backdrop-blur transition-all duration-200 dark:border-gray-800 dark:bg-gray-950/95',
                teacherControlsOpen
                  ? 'w-[226px] opacity-100'
                  : 'w-0 border-transparent opacity-0 shadow-none pointer-events-none',
              )}
            >
              <div className="min-w-0 flex-1 pl-1.5">
                <TeacherVoicePill
                  availableProviders={availableProviders}
                  disabled={!ttsEnabled}
                  previewDisplayName={selectedTeacherName}
                />
              </div>
              <div className="mx-1 h-5 w-px bg-gray-100 dark:bg-gray-800" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <label
                    className={cn(
                      'flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-900',
                      uploading && 'pointer-events-none opacity-70',
                    )}
                    aria-label="上传真人语音替换当前页"
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
                <TooltipContent side="top">上传真人语音替换当前页</TooltipContent>
              </Tooltip>
              <Popover>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="mr-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-900"
                        aria-label="设置老师语速"
                      >
                        <Gauge className="size-4" />
                      </button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top">设置老师语速</TooltipContent>
                </Tooltip>
                <PopoverContent side="top" align="end" sideOffset={8} className="w-64 rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">Speed</span>
                    <Slider
                      value={[ttsSpeed]}
                      min={0.6}
                      max={1.5}
                      step={0.05}
                      onValueChange={(value) => setTTSSpeed(value[0] ?? 1)}
                    />
                    <span className="w-12 text-right text-sm text-gray-700">{ttsSpeed.toFixed(2)}x</span>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        <Tabs defaultValue="edit" className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-end gap-2">
            <TabsList className="h-8 rounded-lg bg-gray-100 p-1 dark:bg-gray-900">
              <TabsTrigger value="edit" className="h-6 gap-1 rounded-md px-2 text-xs">
                编辑讲稿
              </TabsTrigger>
              <TabsTrigger value="ai" className="h-6 gap-1 rounded-md px-2 text-xs">
                AI优化
              </TabsTrigger>
            </TabsList>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleDemoPlayPause}
                  aria-label={isPlaying ? '暂停语音' : '播放语音'}
                  className={cn(
                    'h-8 w-8 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-900 dark:hover:text-gray-100',
                    isPlaying && 'text-gray-900 dark:text-gray-100',
                  )}
                >
                  {isPlaying ? (
                    <Pause className="size-4 fill-current" />
                  ) : (
                    <Play className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{isPlaying ? '暂停语音' : '播放语音'}</TooltipContent>
            </Tooltip>
          </div>

          <TabsContent value="edit" className="mt-0 min-h-[124px]">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commitDraft}
              disabled={!canEdit}
              placeholder="输入当前页 AI 老师要讲的话"
              className="min-h-[124px] resize-y border-0 bg-transparent px-1 pt-1 font-mono text-[18px] leading-[2.15] tracking-normal text-gray-950 shadow-none focus-visible:ring-0 dark:text-gray-100"
            />
          </TabsContent>

          <TabsContent value="ai" className="mt-0 min-h-[124px]">
            <div className="relative min-h-[124px] p-1">
              <Textarea
                value={aiInstruction}
                onChange={(event) => setAiInstruction(event.target.value)}
                placeholder="可选：输入优化需求，比如更像老师讲课、更生动、更简洁、增加互动提问。不填写则根据当前页面内容生成优化稿。"
                className="min-h-[124px] resize-y border-0 bg-transparent px-1 pb-10 pt-1 font-mono text-[17px] leading-[2] tracking-normal shadow-none focus-visible:ring-0"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() =>
                  onAiGenerateScene?.(
                    note.sceneId,
                    aiInstruction.trim().length > 0 ? aiInstruction : undefined,
                  )
                }
                aria-label="生成优化稿"
                className="absolute bottom-2 right-2 size-8 rounded-lg text-purple-600 hover:bg-purple-50 hover:text-purple-700 dark:text-purple-300 dark:hover:bg-purple-950/30"
              >
                <Send className="size-5" />
              </Button>
            </div>
          </TabsContent>

        </Tabs>
      </div>
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
