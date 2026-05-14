'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useSettingsStore } from '@/lib/store/settings';
import { useAgentRegistry } from '@/lib/orchestration/registry/store';
import { resolveAgentVoice, getAvailableProvidersWithVoices } from '@/lib/audio/voice-resolver';
import { playBrowserTTSPreview } from '@/lib/audio/browser-tts-preview';
import { getVoxCPMProviderOptions, useVoxCPMVoiceProfiles } from '@/lib/audio/voxcpm-voices';
import { VOXCPM_AUTO_VOICE_ID, VOXCPM_TTS_PROVIDER_ID } from '@/lib/audio/voxcpm';
import {
  ArrowUp,
  Sparkles,
  ChevronDown,
  Eye,
  EyeOff,
  Pencil,
  Shuffle,
  Volume2,
  VolumeX,
  Loader2,
  MessageSquare,
  Minus,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PUBLISHER_VOICE_GROUPS,
  PUBLISHER_CUSTOM_ROLES_MAX,
  loadPublisherCustomRoles,
  savePublisherCustomRoles,
  type PublisherCustomRoleRow,
  type PublisherIdentityRole,
} from '@/lib/publisher/publisher-custom-roles';
import { generateAutoRolesDemo } from '@/lib/publisher/publisher-roles-demo';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
import type { TTSProviderId } from '@/lib/audio/types';
import type { ProviderWithVoices } from '@/lib/audio/voice-resolver';

function matchesVoiceQuery(value: string | undefined, query: string): boolean {
  return !!value?.toLowerCase().includes(query);
}

function getFilteredModelGroups(provider: ProviderWithVoices, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return provider.modelGroups;

  return provider.modelGroups
    .map((group) => {
      const groupMatches =
        matchesVoiceQuery(provider.providerName, normalizedQuery) ||
        matchesVoiceQuery(provider.providerId, normalizedQuery) ||
        matchesVoiceQuery(group.modelName, normalizedQuery) ||
        matchesVoiceQuery(group.modelId, normalizedQuery);
      const voices = group.voices.filter(
        (voice) =>
          groupMatches ||
          matchesVoiceQuery(voice.name, normalizedQuery) ||
          matchesVoiceQuery(voice.id, normalizedQuery) ||
          matchesVoiceQuery(voice.language, normalizedQuery),
      );
      return { ...group, voices };
    })
    .filter((group) => group.voices.length > 0);
}

function isNonPreviewableVoice(providerId: TTSProviderId, voiceId: string): boolean {
  return providerId === VOXCPM_TTS_PROVIDER_ID && voiceId === VOXCPM_AUTO_VOICE_ID;
}

function AgentVoicePill({
  agent,
  agentIndex,
  availableProviders,
  disabled,
}: {
  agent: AgentConfig;
  agentIndex: number;
  availableProviders: ProviderWithVoices[];
  disabled?: boolean;
}) {
  const { t, locale } = useI18n();
  const updateAgent = useAgentRegistry((s) => s.updateAgent);
  const ttsProvidersConfig = useSettingsStore((s) => s.ttsProvidersConfig);
  const resolved = resolveAgentVoice(agent, agentIndex, availableProviders);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [voiceQuery, setVoiceQuery] = useState('');
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const previewCancelRef = useRef<(() => void) | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const visibleProviderGroups = availableProviders
    .map((provider) => ({
      provider,
      groups: getFilteredModelGroups(provider, voiceQuery),
    }))
    .filter(({ groups }) => groups.length > 0);

  const displayName = (() => {
    for (const p of availableProviders) {
      if (p.providerId === resolved.providerId) {
        const v = p.voices.find((voice) => voice.id === resolved.voiceId);
        if (v) return v.id === VOXCPM_AUTO_VOICE_ID ? t('settings.voxcpmAutoVoice') : v.name;
      }
    }
    return resolved.voiceId;
  })();

  const stopPreview = useCallback(() => {
    previewCancelRef.current?.();
    previewCancelRef.current = null;
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.src = '';
      previewAudioRef.current = null;
    }
    setPreviewingId(null);
  }, []);

  const handlePreview = useCallback(
    async (providerId: TTSProviderId, voiceId: string, modelId?: string) => {
      const key = `${providerId}::${voiceId}`;
      if (previewingId === key) {
        stopPreview();
        return;
      }
      stopPreview();
      setPreviewingId(key);

      const previewText = t('settings.ttsTestTextDefault');

      if (providerId === 'browser-native-tts') {
        const { promise, cancel } = playBrowserTTSPreview({ text: previewText, voice: voiceId });
        previewCancelRef.current = cancel;
        try {
          await promise;
        } catch {
          // ignore abort
        }
        setPreviewingId(null);
        return;
      }

      // Server TTS
      try {
        const controller = new AbortController();
        previewAbortRef.current = controller;
        const providerConfig = ttsProvidersConfig[providerId];
        const providerOptions =
          providerId === 'voxcpm-tts'
            ? {
                ...(providerConfig?.providerOptions || {}),
                ...(await getVoxCPMProviderOptions(voiceId, {
                  agentName: agent.name,
                  role: agent.role,
                  persona: agent.persona,
                  locale,
                })),
              }
            : undefined;
        const res = await fetch('/api/generate/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: previewText,
            audioId: 'voice-preview',
            ttsProviderId: providerId,
            ttsModelId: modelId || providerConfig?.modelId,
            ttsVoice: voiceId,
            ttsSpeed: 1,
            ttsApiKey: providerConfig?.apiKey,
            ttsBaseUrl:
              providerConfig?.serverBaseUrl ||
              providerConfig?.baseUrl ||
              providerConfig?.customDefaultBaseUrl,
            ttsProviderOptions: providerOptions,
          }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('TTS error');
        const data = await res.json();
        if (!data.base64) throw new Error('No audio');

        const audio = new Audio(`data:audio/${data.format || 'mp3'};base64,${data.base64}`);
        previewAudioRef.current = audio;
        audio.addEventListener('ended', () => setPreviewingId(null));
        audio.addEventListener('error', () => setPreviewingId(null));
        await audio.play();
      } catch {
        setPreviewingId(null);
      }
    },
    [
      agent.name,
      agent.persona,
      agent.role,
      locale,
      previewingId,
      stopPreview,
      t,
      ttsProvidersConfig,
    ],
  );

  // Cleanup on unmount
  useEffect(() => () => stopPreview(), [stopPreview]);

  if (disabled) {
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex items-center gap-1.5 h-6 w-[100px] rounded-full bg-muted/40 px-2.5 text-[11px] text-muted-foreground/30 shrink-0 cursor-not-allowed"
      >
        <VolumeX className="size-3 shrink-0" />
        <span className="truncate flex-1 text-left">{displayName}</span>
      </div>
    );
  }

  return (
    <Popover
      open={popoverOpen}
      onOpenChange={(open) => {
        setPopoverOpen(open);
        if (!open) {
          setVoiceQuery('');
          stopPreview();
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 h-6 w-[100px] rounded-full bg-primary/10 hover:bg-primary/20 dark:bg-primary/25 dark:hover:bg-primary/35 px-2.5 text-[11px] text-primary/80 hover:text-primary dark:text-primary/90 transition-colors shrink-0 cursor-pointer"
        >
          <Volume2 className="size-3 shrink-0" />
          <span className="truncate flex-1 text-left">{displayName}</span>
          <ChevronDown className="size-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={4}
        className="w-80 p-0 sm:w-96"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border/50 p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/50" />
            <input
              value={voiceQuery}
              onChange={(e) => setVoiceQuery(e.target.value)}
              autoFocus
              aria-label={t('agentBar.searchVoice')}
              placeholder={t('agentBar.searchVoice')}
              className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            />
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto p-1">
          {visibleProviderGroups.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground/60">
              {t('agentBar.noMatchingVoices')}
            </div>
          )}
          {visibleProviderGroups.map(({ provider, groups }) =>
            groups.map((group) => (
              <div key={`${provider.providerId}::${group.modelId}`}>
                <div className="sticky top-0 bg-popover px-2 py-1 text-[11px] font-medium text-muted-foreground/60">
                  {group.modelId
                    ? `${provider.providerName} · ${group.modelName}`
                    : provider.providerName}
                </div>
                {group.voices.map((voice) => {
                  const isActive =
                    resolved.providerId === provider.providerId &&
                    resolved.voiceId === voice.id &&
                    (resolved.modelId || '') === (group.modelId || '');
                  const previewKey = `${provider.providerId}::${voice.id}`;
                  const isPreviewing = previewingId === previewKey;
                  const canPreview = !isNonPreviewableVoice(provider.providerId, voice.id);
                  return (
                    <div
                      key={previewKey}
                      className={cn(
                        'flex items-center gap-1.5 rounded-sm transition-colors',
                        isActive ? 'bg-primary/10' : 'hover:bg-muted',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          updateAgent(agent.id, {
                            voiceConfig: {
                              providerId: provider.providerId,
                              modelId: group.modelId || undefined,
                              voiceId: voice.id,
                            },
                          });
                          setPopoverOpen(false);
                        }}
                        className={cn(
                          'flex-1 text-left text-[13px] px-2 py-1.5 min-w-0 truncate',
                          isActive ? 'text-primary font-medium' : 'text-foreground',
                        )}
                      >
                        {voice.id === VOXCPM_AUTO_VOICE_ID
                          ? t('settings.voxcpmAutoVoice')
                          : voice.name}
                      </button>
                      {canPreview && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreview(provider.providerId, voice.id, group.modelId);
                          }}
                          className={cn(
                            'flex size-6 shrink-0 items-center justify-center rounded-sm transition-colors',
                            isPreviewing
                              ? 'text-primary'
                              : 'text-muted-foreground/40 hover:text-muted-foreground',
                          )}
                        >
                          {isPreviewing ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Volume2 className="size-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )),
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Teacher voice pill — reads/writes global ttsProviderId + ttsVoice (single source of truth).
 * This ensures lecture and discussion use the same voice for the teacher.
 */
function TeacherVoicePill({
  availableProviders,
  disabled,
  previewDisplayName,
}: {
  availableProviders: ProviderWithVoices[];
  disabled?: boolean;
  /** Used for provider preview metadata (e.g. VoxCPM) when the user renamed the teacher */
  previewDisplayName?: string;
}) {
  const { t, locale } = useI18n();
  const ttsProviderId = useSettingsStore((s) => s.ttsProviderId);
  const ttsVoice = useSettingsStore((s) => s.ttsVoice);
  const setTTSProvider = useSettingsStore((s) => s.setTTSProvider);
  const setTTSVoice = useSettingsStore((s) => s.setTTSVoice);
  const setTTSProviderConfig = useSettingsStore((s) => s.setTTSProviderConfig);
  const ttsProvidersConfig = useSettingsStore((s) => s.ttsProvidersConfig);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [voiceQuery, setVoiceQuery] = useState('');
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const previewCancelRef = useRef<(() => void) | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const visibleProviderGroups = availableProviders
    .map((provider) => ({
      provider,
      groups: getFilteredModelGroups(provider, voiceQuery),
    }))
    .filter(({ groups }) => groups.length > 0);

  const displayName = (() => {
    for (const p of availableProviders) {
      if (p.providerId === ttsProviderId) {
        const v = p.voices.find((voice) => voice.id === ttsVoice);
        if (v) return v.id === VOXCPM_AUTO_VOICE_ID ? t('settings.voxcpmAutoVoice') : v.name;
      }
    }
    return ttsVoice || 'default';
  })();

  const stopPreview = useCallback(() => {
    previewCancelRef.current?.();
    previewCancelRef.current = null;
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.src = '';
      previewAudioRef.current = null;
    }
    setPreviewingId(null);
  }, []);

  const handlePreview = useCallback(
    async (providerId: TTSProviderId, voiceId: string, modelId?: string) => {
      const key = `${providerId}::${voiceId}`;
      if (previewingId === key) {
        stopPreview();
        return;
      }
      stopPreview();
      setPreviewingId(key);

      const previewText = t('settings.ttsTestTextDefault');

      if (providerId === 'browser-native-tts') {
        const { promise, cancel } = playBrowserTTSPreview({ text: previewText, voice: voiceId });
        previewCancelRef.current = cancel;
        try {
          await promise;
        } catch {
          // ignore abort
        }
        setPreviewingId(null);
        return;
      }

      try {
        const controller = new AbortController();
        previewAbortRef.current = controller;
        const providerConfig = ttsProvidersConfig[providerId];
        const providerOptions =
          providerId === 'voxcpm-tts'
            ? {
                ...(providerConfig?.providerOptions || {}),
                ...(await getVoxCPMProviderOptions(voiceId, {
                  agentName: previewDisplayName?.trim() || 'Teacher',
                  role: 'teacher',
                  locale,
                })),
              }
            : undefined;
        const res = await fetch('/api/generate/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: previewText,
            audioId: 'voice-preview',
            ttsProviderId: providerId,
            ttsModelId: modelId || providerConfig?.modelId,
            ttsVoice: voiceId,
            ttsSpeed: 1,
            ttsApiKey: providerConfig?.apiKey,
            ttsBaseUrl:
              providerConfig?.serverBaseUrl ||
              providerConfig?.baseUrl ||
              providerConfig?.customDefaultBaseUrl,
            ttsProviderOptions: providerOptions,
          }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('TTS error');
        const data = await res.json();
        if (!data.base64) throw new Error('No audio');
        const audio = new Audio(`data:audio/${data.format || 'mp3'};base64,${data.base64}`);
        previewAudioRef.current = audio;
        audio.addEventListener('ended', () => setPreviewingId(null));
        audio.addEventListener('error', () => setPreviewingId(null));
        await audio.play();
      } catch {
        setPreviewingId(null);
      }
    },
    [locale, previewDisplayName, previewingId, stopPreview, t, ttsProvidersConfig],
  );

  useEffect(() => () => stopPreview(), [stopPreview]);

  if (disabled) {
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex items-center gap-1.5 h-6 w-[100px] rounded-full bg-muted/40 px-2.5 text-[11px] text-muted-foreground/30 shrink-0 cursor-not-allowed"
      >
        <VolumeX className="size-3 shrink-0" />
        <span className="truncate flex-1 text-left">{displayName}</span>
      </div>
    );
  }

  return (
    <Popover
      open={popoverOpen}
      onOpenChange={(open) => {
        setPopoverOpen(open);
        if (!open) {
          setVoiceQuery('');
          stopPreview();
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 h-6 w-[100px] rounded-full bg-primary/10 hover:bg-primary/20 dark:bg-primary/25 dark:hover:bg-primary/35 px-2.5 text-[11px] text-primary/80 hover:text-primary dark:text-primary/90 transition-colors shrink-0 cursor-pointer"
        >
          <Volume2 className="size-3 shrink-0" />
          <span className="truncate flex-1 text-left">{displayName}</span>
          <ChevronDown className="size-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={4}
        className="w-80 p-0 sm:w-96"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border/50 p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/50" />
            <input
              value={voiceQuery}
              onChange={(e) => setVoiceQuery(e.target.value)}
              autoFocus
              aria-label={t('agentBar.searchVoice')}
              placeholder={t('agentBar.searchVoice')}
              className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            />
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto p-1">
          {visibleProviderGroups.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground/60">
              {t('agentBar.noMatchingVoices')}
            </div>
          )}
          {visibleProviderGroups.map(({ provider, groups }) =>
            groups.map((group) => (
              <div key={`${provider.providerId}::${group.modelId}`}>
                <div className="sticky top-0 bg-popover px-2 py-1 text-[11px] font-medium text-muted-foreground/60">
                  {group.modelId
                    ? `${provider.providerName} · ${group.modelName}`
                    : provider.providerName}
                </div>
                {group.voices.map((voice) => {
                  const currentModelId = ttsProvidersConfig[ttsProviderId]?.modelId || '';
                  const isActive =
                    ttsProviderId === provider.providerId &&
                    ttsVoice === voice.id &&
                    currentModelId === (group.modelId || '');
                  const previewKey = `${provider.providerId}::${voice.id}`;
                  const isPreviewing = previewingId === previewKey;
                  const canPreview = !isNonPreviewableVoice(provider.providerId, voice.id);
                  return (
                    <div
                      key={previewKey}
                      className={cn(
                        'flex items-center gap-1.5 rounded-sm transition-colors',
                        isActive ? 'bg-primary/10' : 'hover:bg-muted',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setTTSProvider(provider.providerId);
                          setTTSVoice(voice.id);
                          if (group.modelId) {
                            setTTSProviderConfig(provider.providerId, { modelId: group.modelId });
                          }
                          setPopoverOpen(false);
                        }}
                        className={cn(
                          'flex-1 text-left text-[13px] px-2 py-1.5 min-w-0 truncate',
                          isActive ? 'text-primary font-medium' : 'text-foreground',
                        )}
                      >
                        {voice.id === VOXCPM_AUTO_VOICE_ID
                          ? t('settings.voxcpmAutoVoice')
                          : voice.name}
                      </button>
                      {canPreview && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreview(provider.providerId, voice.id, group.modelId);
                          }}
                          className={cn(
                            'flex size-6 shrink-0 items-center justify-center rounded-sm transition-colors',
                            isPreviewing
                              ? 'text-primary'
                              : 'text-muted-foreground/40 hover:text-muted-foreground',
                          )}
                        >
                          {isPreviewing ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Volume2 className="size-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )),
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function publisherRoleInitial(
  row: PublisherCustomRoleRow,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const n = row.displayName.trim();
  if (n.length > 0) return n.slice(0, 1).toUpperCase();
  if (row.identity === 'teacher') return t('agentBar.identityShortTeacher');
  if (row.identity === 'assistant') return t('agentBar.identityShortAssistant');
  return t('agentBar.identityShortStudent');
}

/**
 * Auto generation panel: intro strip when empty / compact hint when roles exist,
 * prompt + submit, then generated role list.
 */
interface AutoGenerateRolesPanelProps {
  value: PublisherCustomRoleRow[];
  onChange: (rows: PublisherCustomRoleRow[]) => void;
}

function AutoGenerateRolesPanel({
  value,
  onChange,
}: Readonly<AutoGenerateRolesPanelProps>) {
  const { t } = useI18n();
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  const remainingCapacity = Math.max(0, PUBLISHER_CUSTOM_ROLES_MAX - value.length);
  const atCapacity = remainingCapacity === 0;

  const patchRow = (id: string, patch: Partial<PublisherCustomRoleRow>) => {
    onChange(value.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    onChange(value.filter((r) => r.id !== id));
    setExpandedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const identityLabel = (identity: PublisherIdentityRole) => {
    if (identity === 'teacher') return t('agentBar.identityTeacher');
    if (identity === 'assistant') return t('agentBar.identityAssistant');
    return t('agentBar.identityStudent');
  };

  const roleBadgeClassFor = (identity: PublisherIdentityRole): string => {
    if (identity === 'assistant') {
      return 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300';
    }
    if (identity === 'teacher') {
      return 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300';
    }
    return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300';
  };

  const handleGenerate = async () => {
    if (busy) return;
    const text = prompt.trim();
    if (text.length < 2) {
      toast.error(t('agentBar.autoGenerate.errorTooShort'));
      return;
    }
    if (atCapacity) {
      toast.error(t('agentBar.publisherMaxRoles', { max: PUBLISHER_CUSTOM_ROLES_MAX }));
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    try {
      const result = await generateAutoRolesDemo(text, {
        existing: value.length,
        signal: controller.signal,
      });
      const merged = [...value, ...result.rows].slice(0, PUBLISHER_CUSTOM_ROLES_MAX);
      onChange(merged);
      // Auto-expand the freshly generated rows so the user sees the personas.
      setExpandedIds((prev) => {
        const next = new Set(prev);
        for (const row of result.rows) next.add(row.id);
        return next;
      });
      setPrompt('');
      const verb =
        result.intent.identity === 'assistant'
          ? t('agentBar.identityAssistant')
          : t('agentBar.identityStudent');
      toast.success(
        t('agentBar.autoGenerate.success', {
          count: result.rows.length,
          identity: verb,
        }),
      );
      if (result.clamped) {
        toast.message(
          t('agentBar.autoGenerate.clampedHint', { max: PUBLISHER_CUSTOM_ROLES_MAX }),
        );
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      const code = err instanceof Error ? err.message : '';
      if (code === 'CAPACITY_FULL') {
        toast.error(t('agentBar.publisherMaxRoles', { max: PUBLISHER_CUSTOM_ROLES_MAX }));
      } else if (code === 'EMPTY_PROMPT') {
        toast.error(t('agentBar.autoGenerate.errorTooShort'));
      } else {
        toast.error(t('agentBar.autoGenerate.errorGeneric'));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  // Cancel any in-flight demo generation when the panel unmounts (popover close).
  useEffect(() => () => abortRef.current?.abort(), []);

  return (
    <div className="space-y-3">
      {/* Intro — full card when empty; compact strip when roles already exist (localStorage restore) */}
      {value.length === 0 ? (
        <div className="rounded-xl border border-violet-200/70 dark:border-violet-800/50 bg-violet-50/55 dark:bg-violet-950/25 px-3.5 py-3 sm:px-4 flex items-start gap-3">
          <div
            className="shrink-0 flex size-9 items-center justify-center rounded-full bg-violet-100/90 dark:bg-violet-900/45 ring-1 ring-violet-200/60 dark:ring-violet-700/50"
            aria-hidden
          >
            <Shuffle className="size-[18px] text-violet-600 dark:text-violet-300" />
          </div>
          <div className="min-w-0 flex-1 space-y-1 text-left">
            <p className="text-[12px] text-foreground/90 leading-relaxed font-medium">
              {t('agentBar.autoIntroDefault')}
            </p>
            <p className="text-[10.5px] text-muted-foreground leading-relaxed">
              {t('agentBar.autoPromptHint')}
            </p>
            <p className="text-[10px] text-muted-foreground/75 pt-0.5">
              {t('agentBar.voiceAutoAssign')}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2.5 rounded-xl border border-violet-200/55 dark:border-violet-800/45 bg-violet-50/40 dark:bg-violet-950/20 px-3 py-2.5">
          <Shuffle className="size-4 shrink-0 text-violet-600 dark:text-violet-300 mt-0.5" aria-hidden />
          <p className="text-[11px] text-muted-foreground leading-relaxed text-left min-w-0 flex-1">
            {t('agentBar.autoMoreHint')}
          </p>
        </div>
      )}

      {/* ── Prompt + submit ── */}
      <div className="relative rounded-xl border border-border/55 bg-background/80 dark:bg-slate-950/40 overflow-hidden shadow-sm">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, 200))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void handleGenerate();
            }
          }}
          placeholder={t('agentBar.autoGenerate.inputPlaceholder')}
          rows={value.length === 0 ? 3 : 2}
          disabled={busy}
          className={cn(
            'text-[12.5px] min-h-[72px] max-h-[140px] resize-none pr-12 leading-relaxed border-0 rounded-none shadow-none',
            'bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0',
          )}
          aria-label={t('agentBar.autoGenerate.inputAria')}
        />
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={busy || prompt.trim().length < 2 || atCapacity}
          className={cn(
            'absolute bottom-2.5 right-2.5 inline-flex size-8 items-center justify-center rounded-full transition-all shrink-0',
            'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-sm',
            'hover:shadow-md hover:from-violet-600 hover:to-fuchsia-600',
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:from-violet-500 disabled:hover:to-fuchsia-500',
          )}
          aria-label={t('agentBar.autoGenerate.submitAria')}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowUp className="size-4" />
          )}
        </button>
      </div>

      {/* ── Generated role list ── */}
      {value.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[11px] text-muted-foreground/75">
              {t('agentBar.autoGenerate.listTitle', {
                count: value.length,
                max: PUBLISHER_CUSTOM_ROLES_MAX,
              })}
            </span>
            {atCapacity && (
              <span className="text-[10.5px] text-amber-600 dark:text-amber-400">
                {t('agentBar.autoGenerate.atCapacity')}
              </span>
            )}
          </div>
          {value.map((row) => {
            const isExpanded = expandedIds.has(row.id);
            const roleBadgeClass = roleBadgeClassFor(row.identity);
            return (
              <div
                key={row.id}
                className={cn(
                  'rounded-xl border transition-colors',
                  row.enabled
                    ? 'border-violet-300/70 bg-violet-50/40 dark:border-violet-800/60 dark:bg-violet-950/20'
                    : 'border-border/50 bg-muted/15',
                )}
              >
                <div className="flex items-center gap-2 px-2.5 py-2">
                  <Checkbox
                    checked={row.enabled}
                    onCheckedChange={(c) => patchRow(row.id, { enabled: c === true })}
                    aria-label={t('agentBar.publisherEnableRole')}
                    className="shrink-0"
                  />
                  <div className="size-8 rounded-full overflow-hidden ring-1 ring-border/40 shrink-0 bg-muted">
                    {row.avatar ? (
                      <img src={row.avatar} alt="" className="size-full object-cover" />
                    ) : (
                      <div
                        className={cn(
                          'size-full flex items-center justify-center text-[10px] font-bold text-white',
                          row.identity === 'teacher' &&
                            'bg-gradient-to-br from-blue-500 to-indigo-600',
                          row.identity === 'assistant' &&
                            'bg-gradient-to-br from-violet-500 to-fuchsia-600',
                          row.identity === 'student' &&
                            'bg-gradient-to-br from-emerald-500 to-teal-600',
                        )}
                      >
                        {publisherRoleInitial(row, t)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 flex items-center gap-1.5">
                    <input
                      type="text"
                      value={row.displayName}
                      onChange={(e) =>
                        patchRow(row.id, { displayName: e.target.value.slice(0, 24) })
                      }
                      placeholder={t('agentBar.customRoleNamePlaceholder')}
                      className={cn(
                        'min-w-0 flex-1 text-[13px] font-medium bg-transparent outline-none border-none px-0 py-0',
                        'focus:bg-white/70 dark:focus:bg-slate-800/60 focus:px-1.5 focus:rounded-md focus:ring-1 focus:ring-violet-300/70 transition-all',
                      )}
                      aria-label={t('agentBar.customRoleName')}
                    />
                    <Select
                      value={row.identity}
                      onValueChange={(v) =>
                        patchRow(row.id, { identity: v as PublisherIdentityRole })
                      }
                    >
                      <SelectTrigger
                        size="sm"
                        className={cn(
                          'h-5 px-1.5 text-[10px] font-medium rounded-full border-0 gap-1 shrink-0',
                          roleBadgeClass,
                        )}
                      >
                        <SelectValue>{identityLabel(row.identity)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="assistant">
                          {t('agentBar.identityAssistant')}
                        </SelectItem>
                        <SelectItem value="student">{t('agentBar.identityStudent')}</SelectItem>
                        {/* Legacy data may carry identity='teacher' from the
                            previous editor; expose it so users can switch off,
                            but the demo generator will never produce it. */}
                        {row.identity === 'teacher' && (
                          <SelectItem value="teacher">{t('agentBar.identityTeacher')}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <Select
                    value={row.voiceId}
                    onValueChange={(vid) => patchRow(row.id, { voiceId: vid })}
                  >
                    <SelectTrigger size="sm" className="h-7 text-[10px] px-1.5 w-[7.5rem] min-w-0">
                      <SelectValue placeholder={t('agentBar.voiceLoading')} />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {PUBLISHER_VOICE_GROUPS.map((g) => (
                        <SelectGroup key={g.groupLabelKey}>
                          <SelectLabel className="text-[11px]">{t(g.groupLabelKey)}</SelectLabel>
                          {g.voices.map((v) => (
                            <SelectItem key={v.id} value={v.id} className="text-[12px]">
                              {t(v.nameKey)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => toggleExpand(row.id)}
                        className="size-6 inline-flex items-center justify-center rounded-md text-muted-foreground/60 hover:bg-muted/60 hover:text-foreground transition-colors shrink-0"
                        aria-label={
                          isExpanded
                            ? t('agentBar.collapsePersona')
                            : t('agentBar.viewPersona')
                        }
                      >
                        {isExpanded ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-[11px]">
                      {isExpanded ? t('agentBar.collapsePersona') : t('agentBar.viewPersona')}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="size-6 inline-flex items-center justify-center rounded-md text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"
                        aria-label={t('agentBar.publisherDeleteRole')}
                      >
                        <X className="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-[11px]">
                      {t('agentBar.publisherDeleteRole')}
                    </TooltipContent>
                  </Tooltip>
                </div>
                {isExpanded && (
                  <div className="px-3 pb-2.5 pt-0.5">
                    <Textarea
                      value={row.prompt}
                      onChange={(e) => patchRow(row.id, { prompt: e.target.value })}
                      placeholder={t('agentBar.customRolePromptPlaceholder')}
                      rows={4}
                      className="text-[11.5px] leading-relaxed resize-none bg-background/60 border-border/40 focus-visible:border-violet-300/70 focus-visible:ring-violet-300/30"
                      aria-label={t('agentBar.customRolePrompt')}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Preset roles panel — optional display name and full persona overrides per
 * built-in preset (assistant + students). Voice via AgentVoicePill; teacher
 * row keeps supplement-style persona; non-teacher presets use editable textarea.
 */
interface PresetRolesPanelProps {
  agents: AgentConfig[];
  teacherAgent: AgentConfig | undefined;
  selectedAgentIds: string[];
  setSelectedAgentIds: (ids: string[]) => void;
  availableProviders: ProviderWithVoices[];
  ttsEnabled: boolean;
  showVoice: boolean;
  getAgentName: (agent: { id: string; name: string }) => string;
  teacherCustomDisplayName: string;
  setTeacherCustomDisplayName: (value: string) => void;
  teacherPersonaSupplement: string;
  setTeacherPersonaSupplement: (value: string) => void;
  teacherNameEdit: boolean;
  setTeacherNameEdit: (value: boolean) => void;
  teacherPersonaExpanded: boolean;
  setTeacherPersonaExpanded: (value: boolean | ((prev: boolean) => boolean)) => void;
  presetAgentOverrides: Record<string, { name?: string; persona?: string }>;
  patchPresetAgentOverride: (
    agentId: string,
    patch: Partial<{ name: string | undefined; persona: string | undefined }>,
  ) => void;
  /** When false, inline name editors close (popover dismissed). */
  popoverOpen: boolean;
}

function PresetRolesPanel({
  agents,
  teacherAgent,
  selectedAgentIds,
  setSelectedAgentIds,
  availableProviders,
  ttsEnabled,
  showVoice,
  getAgentName,
  teacherCustomDisplayName,
  setTeacherCustomDisplayName,
  teacherPersonaSupplement,
  setTeacherPersonaSupplement,
  teacherNameEdit,
  setTeacherNameEdit,
  teacherPersonaExpanded,
  setTeacherPersonaExpanded,
  presetAgentOverrides,
  patchPresetAgentOverride,
  popoverOpen,
}: Readonly<PresetRolesPanelProps>) {
  const { t } = useI18n();

  const [editingPresetNameId, setEditingPresetNameId] = useState<string | null>(null);

  useEffect(() => {
    if (!popoverOpen) {
      setEditingPresetNameId(null);
    }
  }, [popoverOpen]);
  const teacherDisplayLabel =
    teacherAgent &&
    (teacherCustomDisplayName.trim() === ''
      ? getAgentName(teacherAgent)
      : teacherCustomDisplayName.trim());

  // Take the 5 non-teacher built-in agents (default-2..default-6).
  const presets = useMemo(
    () => agents.filter((a) => a.isDefault && a.role !== 'teacher').slice(0, 5),
    [agents],
  );

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const togglePreset = (id: string, enabled: boolean) => {
    if (enabled) {
      if (!selectedAgentIds.includes(id)) {
        setSelectedAgentIds([...selectedAgentIds, id]);
      }
    } else {
      setSelectedAgentIds(selectedAgentIds.filter((sid) => sid !== id));
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const personaText = (a: AgentConfig): string => {
    const key = `settings.agentPersonas.${a.id}`;
    const translated = t(key);
    return translated !== key ? translated : a.persona;
  };

  const enabledCount = presets.filter((p) => selectedAgentIds.includes(p.id)).length;

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground/75 leading-relaxed">
        {t('agentBar.presetIntro')}
      </p>
      <h3 className="text-[12px] font-semibold text-foreground/90">
        {t('agentBar.presetRolesHeading')}
      </h3>
      <div className="space-y-1.5">
        {teacherAgent && teacherDisplayLabel && (
          <div
            className={cn(
              'rounded-xl border transition-colors',
              'border-violet-300/70 bg-violet-50/40 dark:border-violet-800/60 dark:bg-violet-950/20',
            )}
          >
            <div className="group/name flex items-center gap-2 px-2.5 py-2">
              <Checkbox
                checked
                disabled
                aria-label={t('agentBar.presetEnableAria')}
                className="shrink-0 opacity-60"
              />
              <div
                className="size-8 rounded-full overflow-hidden ring-1 ring-border/40 shrink-0"
                style={{ boxShadow: `0 0 0 2px ${teacherAgent.color}30` }}
              >
                <img
                  src={teacherAgent.avatar}
                  alt=""
                  className="size-full object-cover"
                  aria-hidden
                />
              </div>
              <div className="min-w-0 flex-1">
                {teacherNameEdit ? (
                  <Input
                    value={teacherCustomDisplayName}
                    onChange={(e) => setTeacherCustomDisplayName(e.target.value)}
                    onBlur={() => setTeacherNameEdit(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        (e.target as HTMLInputElement).blur();
                      }
                      if (e.key === 'Escape') {
                        setTeacherNameEdit(false);
                      }
                    }}
                    autoFocus
                    maxLength={64}
                    placeholder={getAgentName(teacherAgent)}
                    aria-label={t('agentBar.teacherNameAria')}
                    className="h-7 text-[13px] font-medium min-w-0 w-full bg-background/90 border-border/60"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[13px] font-medium truncate">{teacherDisplayLabel}</span>
                    <span
                      className={cn(
                        'shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                        'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
                      )}
                    >
                      {t('settings.agentRoles.teacher')}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTeacherNameEdit(true);
                      }}
                      className={cn(
                        'size-6 shrink-0 inline-flex items-center justify-center rounded-md transition-colors',
                        'text-muted-foreground/70 max-sm:opacity-100',
                        'opacity-0 group-hover/name:opacity-100 focus-visible:opacity-100',
                        'hover:bg-muted/60 hover:text-foreground',
                      )}
                      aria-label={t('agentBar.teacherEditNameAria')}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
              {showVoice && (
                <TeacherVoicePill
                  availableProviders={availableProviders}
                  disabled={!ttsEnabled}
                  previewDisplayName={teacherDisplayLabel}
                />
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTeacherPersonaExpanded((v) => !v);
                    }}
                    className="size-6 inline-flex items-center justify-center rounded-md text-muted-foreground/60 hover:bg-muted/60 hover:text-foreground transition-colors shrink-0"
                    aria-label={
                      teacherPersonaExpanded
                        ? t('agentBar.collapsePersona')
                        : t('agentBar.viewPersona')
                    }
                  >
                    {teacherPersonaExpanded ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[11px]">
                  {teacherPersonaExpanded
                    ? t('agentBar.collapsePersona')
                    : t('agentBar.viewPersona')}
                </TooltipContent>
              </Tooltip>
            </div>
            {teacherPersonaExpanded && (
              <div className="px-3 pb-2.5 pt-0.5">
                <Textarea
                  value={teacherPersonaSupplement}
                  onChange={(e) => setTeacherPersonaSupplement(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  placeholder={t('agentBar.teacherPersonaHint')}
                  maxLength={4000}
                  rows={4}
                  aria-label={t('agentBar.teacherPersonaAria')}
                  className="text-[11.5px] leading-relaxed resize-none bg-background/60 border-border/40 focus-visible:border-violet-300/70 focus-visible:ring-violet-300/30"
                />
              </div>
            )}
          </div>
        )}
        {presets.map((agent, idx) => {
          const isSelected = selectedAgentIds.includes(agent.id);
          const isExpanded = expandedIds.has(agent.id);
          const baselinePersona = personaText(agent);
          const ovr = presetAgentOverrides[agent.id];
          const defaultLabel = getAgentName(agent);
          const displayName = ovr?.name?.trim() ? ovr.name.trim() : defaultLabel;
          const roleBadgeClass =
            agent.role === 'assistant'
              ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300'
              : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300';
          const isNameEdit = editingPresetNameId === agent.id;
          return (
            <div
              key={agent.id}
              className={cn(
                'rounded-xl border transition-colors',
                isSelected
                  ? 'border-violet-300/70 bg-violet-50/40 dark:border-violet-800/60 dark:bg-violet-950/20'
                  : 'border-border/50 bg-muted/15',
              )}
            >
              <div className="group/name flex items-center gap-2 px-2.5 py-2">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(c) => togglePreset(agent.id, c === true)}
                  aria-label={t('agentBar.presetEnableAria')}
                  className="shrink-0"
                />
                <div
                  className="size-8 rounded-full overflow-hidden ring-1 ring-border/40 shrink-0"
                  style={{ boxShadow: `0 0 0 2px ${agent.color}30` }}
                >
                  <img
                    src={agent.avatar}
                    alt=""
                    className="size-full object-cover"
                    aria-hidden
                  />
                </div>
                <div className="min-w-0 flex-1">
                  {isNameEdit ? (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Input
                        value={ovr?.name ?? ''}
                        onChange={(e) =>
                          patchPresetAgentOverride(agent.id, { name: e.target.value })
                        }
                        onBlur={() => {
                          const raw = (presetAgentOverrides[agent.id]?.name ?? '').trim();
                          if (raw === '') {
                            patchPresetAgentOverride(agent.id, { name: undefined });
                          } else {
                            patchPresetAgentOverride(agent.id, { name: raw });
                          }
                          setEditingPresetNameId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                          }
                          if (e.key === 'Escape') {
                            setEditingPresetNameId(null);
                          }
                        }}
                        autoFocus
                        maxLength={64}
                        placeholder={defaultLabel}
                        aria-label={t('agentBar.presetRoleNameAria')}
                        className="h-7 text-[13px] font-medium min-w-0 flex-1 bg-background/90 border-border/60"
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                      />
                      <span
                        className={cn(
                          'shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                          roleBadgeClass,
                        )}
                      >
                        {t(`settings.agentRoles.${agent.role}`)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[13px] font-medium truncate">{displayName}</span>
                      <span
                        className={cn(
                          'shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                          roleBadgeClass,
                        )}
                      >
                        {t(`settings.agentRoles.${agent.role}`)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingPresetNameId(agent.id);
                        }}
                        className={cn(
                          'size-6 shrink-0 inline-flex items-center justify-center rounded-md transition-colors',
                          'text-muted-foreground/70 max-sm:opacity-100',
                          'opacity-0 group-hover/name:opacity-100 focus-visible:opacity-100',
                          'hover:bg-muted/60 hover:text-foreground',
                        )}
                        aria-label={t('agentBar.presetEditNameAria')}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                {showVoice && (
                  <AgentVoicePill
                    agent={agent}
                    agentIndex={idx + 1}
                    availableProviders={availableProviders}
                    disabled={!ttsEnabled}
                  />
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => toggleExpand(agent.id)}
                      className="size-6 inline-flex items-center justify-center rounded-md text-muted-foreground/60 hover:bg-muted/60 hover:text-foreground transition-colors shrink-0"
                      aria-label={
                        isExpanded
                          ? t('agentBar.collapsePersona')
                          : t('agentBar.viewPersona')
                      }
                    >
                      {isExpanded ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-[11px]">
                    {isExpanded
                      ? t('agentBar.collapsePersona')
                      : t('agentBar.viewPersona')}
                  </TooltipContent>
                </Tooltip>
              </div>
              {isExpanded && (
                <div className="px-3 pb-2.5 pt-0.5">
                  <Textarea
                    value={ovr?.persona !== undefined ? ovr.persona : baselinePersona}
                    onChange={(e) =>
                      patchPresetAgentOverride(agent.id, { persona: e.target.value })
                    }
                    onBlur={() => {
                      const raw = presetAgentOverrides[agent.id]?.persona;
                      if (raw === undefined) return;
                      const tr = raw.trim();
                      if (tr === '' || tr === baselinePersona.trim()) {
                        patchPresetAgentOverride(agent.id, { persona: undefined });
                      }
                    }}
                    maxLength={4000}
                    rows={4}
                    aria-label={t('agentBar.presetPersonaAria')}
                    className="text-[11.5px] leading-relaxed resize-none bg-background/60 border-border/40 focus-visible:border-violet-300/70 focus-visible:ring-violet-300/30"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10.5px] text-muted-foreground/60 text-center pt-0.5">
        {t('agentBar.presetCount', {
          count: enabledCount,
          total: presets.length,
        })}
      </p>
    </div>
  );
}

/**
 * Classroom role configuration entry. Renders as a small round icon-only
 * trigger (sized to match other bottom-toolbar icon buttons) that opens a
 * popover panel above it. Style/interaction mirrors `BookLibraryDialog` and
 * `GenerationConfigPopover` so all three toolbar dialogs feel consistent.
 */
export function AgentBar() {
  const { t } = useI18n();
  const { listAgents } = useAgentRegistry();
  const selectedAgentIds = useSettingsStore((s) => s.selectedAgentIds);
  const setSelectedAgentIds = useSettingsStore((s) => s.setSelectedAgentIds);
  const maxTurns = useSettingsStore((s) => s.maxTurns);
  const setMaxTurns = useSettingsStore((s) => s.setMaxTurns);
  const agentMode = useSettingsStore((s) => s.agentMode);
  const setAgentMode = useSettingsStore((s) => s.setAgentMode);
  const ttsProvidersConfig = useSettingsStore((s) => s.ttsProvidersConfig);
  const ttsEnabled = useSettingsStore((s) => s.ttsEnabled);
  const teacherCustomDisplayName = useSettingsStore((s) => s.teacherCustomDisplayName);
  const teacherPersonaSupplement = useSettingsStore((s) => s.teacherPersonaSupplement);
  const setTeacherCustomDisplayName = useSettingsStore((s) => s.setTeacherCustomDisplayName);
  const setTeacherPersonaSupplement = useSettingsStore((s) => s.setTeacherPersonaSupplement);
  const presetAgentOverrides = useSettingsStore((s) => s.presetAgentOverrides);
  const patchPresetAgentOverride = useSettingsStore((s) => s.patchPresetAgentOverride);

  const [publisherCustomRoles, setPublisherCustomRoles] = useState<PublisherCustomRoleRow[]>([]);
  const [teacherNameEdit, setTeacherNameEdit] = useState(false);
  const [teacherPersonaExpanded, setTeacherPersonaExpanded] = useState(false);

  const [open, setOpen] = useState(false);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const { profiles: voxcpmProfiles } = useVoxCPMVoiceProfiles();

  useEffect(() => {
    if (!open) {
      setTeacherNameEdit(false);
      setTeacherPersonaExpanded(false);
    }
  }, [open]);

  // Load browser native TTS voices
  useEffect(() => {
    if (typeof globalThis.window === 'undefined' || !globalThis.speechSynthesis) return;
    const loadVoices = () => setBrowserVoices(globalThis.speechSynthesis.getVoices());
    loadVoices();
    globalThis.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () =>
      globalThis.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, []);

  useEffect(() => {
    setPublisherCustomRoles(loadPublisherCustomRoles());
  }, []);

  const setPublisherCustomRolesPersist = useCallback((rows: PublisherCustomRoleRow[]) => {
    setPublisherCustomRoles(rows);
    savePublisherCustomRoles(rows);
  }, []);

  const allAgents = listAgents();
  const agents = allAgents.filter((a) => !a.isGenerated);
  const teacherAgent = agents.find((a) => a.role === 'teacher');
  const serverProviders = getAvailableProvidersWithVoices(ttsProvidersConfig, voxcpmProfiles);
  const availableProviders: ProviderWithVoices[] = [
    ...serverProviders,
    ...(browserVoices.length > 0
      ? [
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
        ]
      : []),
  ];
  const showVoice = availableProviders.length > 0;

  /**
   * UI tab → settings storage mapping:
   *   预设模式 (PresetRolesPanel)  ↔  agentMode === 'custom'
   *   自动生成 (AutoGenerate)      ↔  agentMode === 'auto'
   * The 'custom' value is preserved for backward-compat with persisted state
   * and downstream code that already understands 'auto' | 'custom'.
   */
  const handleModeChange = (mode: 'auto' | 'custom') => {
    setAgentMode(mode);
    if (mode === 'custom') {
      // When switching into preset mode, ensure selectedAgentIds only contains
      // valid registry IDs (drop any leftover auto-generated IDs from a prior
      // session) and always include the teacher.
      const registryIds = selectedAgentIds.filter((id) => agents.some((a) => a.id === id));
      const hasTeacher = registryIds.some((id) => {
        const a = agents.find((agent) => agent.id === id);
        return a?.role === 'teacher';
      });
      if (!hasTeacher && teacherAgent) {
        registryIds.unshift(teacherAgent.id);
      }
      setSelectedAgentIds(
        registryIds.length > 0 ? registryIds : ['default-1', 'default-2', 'default-3'],
      );
    }
  };

  const getAgentName = (agent: { id: string; name: string }) => {
    const key = `settings.agentNames.${agent.id}`;
    const translated = t(key);
    return translated !== key ? translated : agent.name;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <PopoverTrigger asChild>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={t('agentBar.configTooltip')}
              aria-expanded={open}
              className={cn(
                'inline-flex items-center justify-center rounded-full border size-8 shrink-0 transition-all cursor-pointer',
                open
                  ? 'border-violet-400/70 bg-violet-100 dark:bg-violet-900/35 text-violet-700 dark:text-violet-300'
                  : 'bg-white border-border/60 text-muted-foreground/70 hover:bg-muted/40 hover:text-foreground',
              )}
            >
              <Users className="size-3.5" />
            </button>
          </TooltipTrigger>
        </PopoverTrigger>
        {!open && (
          <TooltipContent side="top" sideOffset={4}>
            {t('agentBar.configTooltip')}
          </TooltipContent>
        )}
      </Tooltip>

      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        collisionPadding={12}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          '!p-0 !gap-0 overflow-hidden bg-white dark:bg-slate-900',
          'w-[min(calc(100vw-2rem),520px)] rounded-2xl border border-border/60',
          'shadow-xl shadow-black/[0.06] dark:shadow-black/30 ring-1 ring-black/[0.03]',
          'max-h-[min(85dvh,720px)] flex flex-col',
        )}
      >
        {/* ── Header ── */}
        <div className="relative px-5 pt-5 pb-3 border-b border-border/50 shrink-0 text-left space-y-1.5 pr-14">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            aria-label={t('common.close')}
          >
            <X className="size-4" />
          </button>
          <h2 className="text-base font-semibold pr-2">{t('agentBar.popoverTitle')}</h2>
          <p className="text-[12px] leading-relaxed break-words text-muted-foreground">
            {t('agentBar.popoverIntro')}
          </p>
        </div>

        {/* ── Mode tabs ── */}
        <div className="px-4 pt-3 shrink-0">
          <div className="flex rounded-xl bg-muted/45 p-1 gap-1">
            <button
              type="button"
              onClick={() => handleModeChange('custom')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-[12px] font-medium transition-all',
                agentMode === 'custom'
                  ? 'bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 shadow-sm ring-1 ring-border/40'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Users className="size-3.5 shrink-0 opacity-80" />
              {t('agentBar.modePreset')}
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('auto')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-[12px] font-medium transition-all',
                agentMode === 'auto'
                  ? 'bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 shadow-sm ring-1 ring-border/40'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Sparkles className="size-3.5 shrink-0 opacity-80" />
              {t('agentBar.modeAuto')}
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
          {agentMode === 'custom' ? (
            <PresetRolesPanel
              agents={agents}
              teacherAgent={teacherAgent}
              selectedAgentIds={selectedAgentIds}
              setSelectedAgentIds={setSelectedAgentIds}
              availableProviders={availableProviders}
              ttsEnabled={ttsEnabled}
              showVoice={showVoice}
              getAgentName={getAgentName}
              teacherCustomDisplayName={teacherCustomDisplayName}
              setTeacherCustomDisplayName={setTeacherCustomDisplayName}
              teacherPersonaSupplement={teacherPersonaSupplement}
              setTeacherPersonaSupplement={setTeacherPersonaSupplement}
              teacherNameEdit={teacherNameEdit}
              setTeacherNameEdit={setTeacherNameEdit}
              teacherPersonaExpanded={teacherPersonaExpanded}
              setTeacherPersonaExpanded={setTeacherPersonaExpanded}
              presetAgentOverrides={presetAgentOverrides}
              patchPresetAgentOverride={patchPresetAgentOverride}
              popoverOpen={open}
            />
          ) : (
            <AutoGenerateRolesPanel
              value={publisherCustomRoles}
              onChange={setPublisherCustomRolesPersist}
            />
          )}
        </div>

        {/* ── Footer: Max turns ── */}
        <div className="flex items-center gap-2 border-t border-border/50 px-4 py-2.5 shrink-0 bg-muted/20">
          <MessageSquare className="size-3.5 text-muted-foreground/60 shrink-0" />
          <span className="text-[12px] text-muted-foreground/85 flex-1">
            {t('settings.maxTurns')}
          </span>
          <div className="flex items-center rounded-full bg-background border border-border/60 h-7 shrink-0 px-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const v = Math.max(1, Number.parseInt(maxTurns || '1') - 1);
                setMaxTurns(String(v));
              }}
              className="size-6 flex items-center justify-center text-muted-foreground/70 hover:text-foreground transition-colors rounded-full hover:bg-muted"
              aria-label="−"
            >
              <Minus className="size-3" />
            </button>
            <input
              type="text"
              inputMode="numeric"
              value={maxTurns}
              onChange={(e) => {
                const raw = e.target.value.replaceAll(/\D/g, '');
                if (!raw) {
                  setMaxTurns('');
                  return;
                }
                const v = Math.min(20, Math.max(1, Number.parseInt(raw)));
                setMaxTurns(String(v));
              }}
              onBlur={() => {
                if (!maxTurns || Number.parseInt(maxTurns) < 1) setMaxTurns('1');
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-7 h-6 text-[12px] font-semibold tabular-nums text-center bg-transparent outline-none border-none"
              aria-label={t('settings.maxTurns')}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const v = Math.min(20, Number.parseInt(maxTurns || '1') + 1);
                setMaxTurns(String(v));
              }}
              className="size-6 flex items-center justify-center text-muted-foreground/70 hover:text-foreground transition-colors rounded-full hover:bg-muted"
              aria-label="+"
            >
              <Plus className="size-3" />
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
