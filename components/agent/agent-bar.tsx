'use client';

import { useState, useEffect, useRef, useCallback, type MouseEvent as ReactMouseEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Sparkles,
  ChevronDown,
  ChevronUp,
  Shuffle,
  Volume2,
  VolumeX,
  Loader2,
  MessageSquare,
  Minus,
  Plus,
  Search,
  Trash2,
  Wand2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  createNewPublisherRoleDraft,
  loadPublisherCustomRoles,
  pickPublisherAvatar,
  savePublisherCustomRoles,
  type PublisherCustomRoleRow,
  type PublisherIdentityRole,
} from '@/lib/publisher/publisher-custom-roles';
import { getCurrentModelConfig } from '@/lib/utils/model-config';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { BatchGenerateRolesDialog } from '@/components/agent/batch-generate-roles-dialog';
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
}: {
  availableProviders: ProviderWithVoices[];
  disabled?: boolean;
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
                  agentName: 'Teacher',
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
    [locale, previewingId, stopPreview, t, ttsProvidersConfig],
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

function PublisherCustomRolesPanel({
  value,
  onChange,
}: {
  value: PublisherCustomRoleRow[];
  onChange: (rows: PublisherCustomRoleRow[]) => void;
}) {
  const { t, locale } = useI18n();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [draft, setDraft] = useState<PublisherCustomRoleRow | null>(null);
  const [magicBusy, setMagicBusy] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);

  const remainingCapacity = Math.max(0, PUBLISHER_CUSTOM_ROLES_MAX - value.length);

  const patchList = (id: string, patch: Partial<PublisherCustomRoleRow>) => {
    onChange(value.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleBatchGenerated = (rows: PublisherCustomRoleRow[]) => {
    if (rows.length === 0) return;
    const merged = [...value, ...rows].slice(0, PUBLISHER_CUSTOM_ROLES_MAX);
    onChange(merged);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setDraft(null);
    setMagicBusy(false);
  };

  const openCreate = () => {
    setEditorMode('create');
    setDraft(createNewPublisherRoleDraft());
    setEditorOpen(true);
  };

  const openEdit = (row: PublisherCustomRoleRow) => {
    setEditorMode('edit');
    setDraft({ ...row });
    setEditorOpen(true);
  };

  const handleSave = () => {
    if (!draft) return;
    const name = draft.displayName.trim();
    if (name.length === 0) {
      toast.error(t('agentBar.publisherSaveNameRequired'));
      return;
    }
    const avatar = pickPublisherAvatar(draft.identity, draft.id);
    const saved: PublisherCustomRoleRow = { ...draft, displayName: name, avatar };
    if (editorMode === 'create') {
      if (value.length >= PUBLISHER_CUSTOM_ROLES_MAX) {
        toast.error(t('agentBar.publisherMaxRoles', { max: PUBLISHER_CUSTOM_ROLES_MAX }));
        return;
      }
      onChange([...value, saved]);
    } else {
      onChange(value.map((r) => (r.id === saved.id ? saved : r)));
    }
    toast.success(t('agentBar.publisherSaveSuccess'));
    closeEditor();
  };

  const handleDelete = () => {
    if (!draft || editorMode !== 'edit') return;
    onChange(value.filter((r) => r.id !== draft.id));
    toast.success(t('agentBar.publisherDeleteSuccess'));
    closeEditor();
  };

  const handleDraftMagicFix = async () => {
    if (!draft) return;
    const text = draft.prompt.trim();
    if (text.length < 2) {
      toast.error(t('agentBar.magicFixTooShort'));
      return;
    }
    const { modelId } = useSettingsStore.getState();
    if (!modelId) {
      toast.error(t('agentBar.magicFixNoModel'));
      return;
    }
    setMagicBusy(true);
    try {
      const config = getCurrentModelConfig();
      const payload: Record<string, unknown> = {
        draft: text,
        identity: draft.identity,
        locale,
      };
      const dn = draft.displayName.trim();
      if (dn.length > 0) {
        payload.displayName = dn;
      }
      const body =
        config.thinkingConfig !== undefined
          ? { ...payload, thinkingConfig: config.thinkingConfig }
          : payload;
      const res = await fetch('/api/generate/publisher-role-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-model': config.modelString || '',
          'x-api-key': config.apiKey || '',
          'x-base-url': config.baseUrl || '',
          'x-provider-type': config.providerType || '',
        },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        prompt?: string;
        error?: string;
      };
      if (!res.ok || data.success !== true || typeof data.prompt !== 'string' || !data.prompt.trim()) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setDraft((d) => (d ? { ...d, prompt: data.prompt!.trim() } : null));
      toast.success(t('agentBar.magicFixSuccess'));
    } catch {
      toast.error(t('agentBar.magicFixError'));
    } finally {
      setMagicBusy(false);
    }
  };

  const identityLabel = (identity: PublisherIdentityRole) => {
    if (identity === 'teacher') return t('agentBar.identityTeacher');
    if (identity === 'assistant') return t('agentBar.identityAssistant');
    return t('agentBar.identityStudent');
  };

  const rowActivateEdit = (row: PublisherCustomRoleRow, e: ReactMouseEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    if (el.closest('[role="checkbox"]') || el.closest('[data-slot="select-trigger"]')) return;
    openEdit(row);
  };

  return (
    <>
      <div className="max-h-60 overflow-y-auto -mx-0.5 px-0.5 space-y-1.5">
        {value.length === 0 ? (
          <p className="text-[11px] text-muted-foreground/70 text-center py-4 px-2 leading-relaxed">
            {t('agentBar.customRolesEmpty')}
          </p>
        ) : (
          value.map((row) => (
            <div
              key={row.id}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openEdit(row);
                }
              }}
              onClick={(e) => rowActivateEdit(row, e)}
              className={cn(
                'flex items-center gap-2 rounded-xl border border-border/50 bg-muted/15 px-2 py-1.5 text-left transition-colors',
                'hover:bg-muted/35 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50',
              )}
            >
              <span
                className="shrink-0"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={row.enabled}
                  onCheckedChange={(c) => patchList(row.id, { enabled: c === true })}
                  aria-label={t('agentBar.publisherEnableRole')}
                />
              </span>
              <div className="size-8 rounded-full overflow-hidden ring-1 ring-border/50 shrink-0 bg-muted">
                {row.avatar ? (
                  <img src={row.avatar} alt="" className="size-full object-cover" />
                ) : (
                  <div
                    className={cn(
                      'size-full flex items-center justify-center text-[10px] font-bold text-white',
                      row.identity === 'teacher' && 'bg-gradient-to-br from-blue-500 to-indigo-600',
                      row.identity === 'assistant' && 'bg-gradient-to-br from-violet-500 to-fuchsia-600',
                      row.identity === 'student' && 'bg-gradient-to-br from-emerald-500 to-teal-600',
                    )}
                  >
                    {publisherRoleInitial(row, t)}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium truncate">{row.displayName || '—'}</div>
                <div className="text-[10px] text-muted-foreground/70 truncate">
                  {identityLabel(row.identity)}
                </div>
              </div>
              <div
                className="shrink-0 w-[min(42%,7.5rem)]"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <Select value={row.voiceId} onValueChange={(vid) => patchList(row.id, { voiceId: vid })}>
                  <SelectTrigger size="sm" className="h-7 text-[10px] px-1.5 w-full min-w-0">
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
              </div>
            </div>
          ))
        )}
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={remainingCapacity === 0}
            onClick={(e) => {
              e.stopPropagation();
              openCreate();
            }}
            className={cn(
              'flex-1 py-2 rounded-xl border border-dashed border-violet-300/60 text-[11px] font-medium text-violet-600 dark:text-violet-300 hover:bg-violet-500/5 transition-colors inline-flex items-center justify-center gap-1',
              remainingCapacity === 0 && 'opacity-40 pointer-events-none',
            )}
          >
            <Plus className="size-3" />
            {t('agentBar.addCustomRoleManual')}
          </button>
          <button
            type="button"
            disabled={remainingCapacity === 0}
            onClick={(e) => {
              e.stopPropagation();
              setBatchOpen(true);
            }}
            className={cn(
              'flex-1 py-2 rounded-xl border border-dashed text-[11px] font-medium transition-colors inline-flex items-center justify-center gap-1',
              'border-violet-400/70 bg-violet-50/40 dark:bg-violet-950/25 text-violet-700 dark:text-violet-200 hover:bg-violet-100/60 dark:hover:bg-violet-900/30',
              remainingCapacity === 0 && 'opacity-40 pointer-events-none',
            )}
          >
            <Wand2 className="size-3" />
            {t('agentBar.batchGenerate.triggerLabel')}
          </button>
        </div>
      </div>

      <BatchGenerateRolesDialog
        open={batchOpen}
        onOpenChange={setBatchOpen}
        remainingCapacity={remainingCapacity}
        onGenerated={handleBatchGenerated}
      />

      <Dialog open={editorOpen} onOpenChange={(o) => !o && closeEditor()}>
        <DialogContent
          className="max-w-md gap-4"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle className="text-base">
              {editorMode === 'create'
                ? t('agentBar.publisherEditorTitleNew')
                : t('agentBar.publisherEditorTitleEdit')}
            </DialogTitle>
            <DialogDescription className="text-[12px]">
              {t('agentBar.publisherEditorHint')}
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t('agentBar.customRoleName')}</Label>
                  <Input
                    value={draft.displayName}
                    onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
                    placeholder={t('agentBar.customRoleNamePlaceholder')}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('agentBar.customRoleIdentity')}</Label>
                  <Select
                    value={draft.identity}
                    onValueChange={(v) =>
                      setDraft({ ...draft, identity: v as PublisherIdentityRole })
                    }
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="teacher">{t('agentBar.identityTeacher')}</SelectItem>
                      <SelectItem value="assistant">{t('agentBar.identityAssistant')}</SelectItem>
                      <SelectItem value="student">{t('agentBar.identityStudent')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">{t('agentBar.customRolePrompt')}</Label>
                <div className="relative">
                  <Textarea
                    value={draft.prompt}
                    onChange={(e) => setDraft({ ...draft, prompt: e.target.value })}
                    placeholder={t('agentBar.customRolePromptPlaceholder')}
                    rows={5}
                    disabled={magicBusy}
                    className={cn(
                      'text-sm min-h-[120px] resize-none pr-[6.5rem] pb-9',
                      magicBusy && 'opacity-80',
                    )}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="absolute bottom-2 right-2 h-7 gap-1 px-2 text-[11px]"
                    disabled={magicBusy || draft.prompt.trim().length < 2}
                    onClick={() => void handleDraftMagicFix()}
                  >
                    {magicBusy ? (
                      <Loader2 className="size-3.5 animate-spin shrink-0" aria-hidden />
                    ) : (
                      <Sparkles className="size-3.5 shrink-0 text-violet-500" aria-hidden />
                    )}
                    {magicBusy ? t('agentBar.magicFixLoading') : t('agentBar.magicFixButton')}
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">{t('agentBar.voiceLabel')}</Label>
                <Select value={draft.voiceId} onValueChange={(vid) => setDraft({ ...draft, voiceId: vid })}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {PUBLISHER_VOICE_GROUPS.map((g) => (
                      <SelectGroup key={g.groupLabelKey}>
                        <SelectLabel>{t(g.groupLabelKey)}</SelectLabel>
                        {g.voices.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {t(v.nameKey)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {editorMode === 'edit' ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive justify-start px-0 sm:px-3"
                onClick={handleDelete}
              >
                <Trash2 className="size-4 shrink-0" />
                {t('agentBar.publisherDeleteRole')}
              </Button>
            ) : (
              <div className="min-w-0 flex-1" aria-hidden="true" />
            )}
            <div className="flex w-full gap-2 justify-end sm:w-auto">
              <Button type="button" variant="outline" onClick={closeEditor}>
                {t('agentBar.publisherCancel')}
              </Button>
              <Button type="button" onClick={handleSave} disabled={!draft || magicBusy}>
                {t('agentBar.publisherSave')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

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

  const [publisherCustomRoles, setPublisherCustomRoles] = useState<PublisherCustomRoleRow[]>([]);

  const [open, setOpen] = useState(false);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const { profiles: voxcpmProfiles } = useVoxCPMVoiceProfiles();
  const containerRef = useRef<HTMLDivElement>(null);

  // Load browser native TTS voices
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const loadVoices = () => setBrowserVoices(speechSynthesis.getVoices());
    loadVoices();
    speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => speechSynthesis.removeEventListener('voiceschanged', loadVoices);
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

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current && containerRef.current.contains(target)) return;
      // Don't close if clicking inside a Radix portal (Popover, Select, etc.)
      if ((target as Element).closest?.('[data-radix-popper-content-wrapper]')) return;
      if ((target as Element).closest?.('[data-slot="dialog-content"]')) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleModeChange = (mode: 'auto' | 'custom') => {
    setAgentMode(mode);
    if (mode === 'custom') {
      // Remove stale auto-generated agent IDs that may linger from a previous auto classroom
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

  const avatarRow = (
    <div className="flex items-center gap-1.5 shrink-0">
      {teacherAgent && (
        <div className="size-8 rounded-full overflow-hidden ring-2 ring-blue-400/40 dark:ring-blue-500/30 shrink-0">
          <img
            src={teacherAgent.avatar}
            alt={getAgentName(teacherAgent)}
            className="size-full object-cover"
          />
        </div>
      )}

      {agentMode === 'auto' ? (
        <>
          <div className="flex -space-x-2">
            {agents.find((a) => a.role === 'assistant') && (
              <div className="size-6 rounded-full overflow-hidden ring-[1.5px] ring-background">
                <img
                  src={agents.find((a) => a.role === 'assistant')!.avatar}
                  alt=""
                  className="size-full object-cover"
                />
              </div>
            )}
          </div>
          <Shuffle className="size-4 text-violet-400 dark:text-violet-500" />
        </>
      ) : (
        <>
          {(() => {
            const enabled = publisherCustomRoles.filter((r) => r.enabled);
            const strip = enabled.length > 0 ? enabled : publisherCustomRoles;
            if (strip.length === 0) return null;
            return (
              <div className="flex -space-x-2">
                {strip.slice(0, 4).map((row) => (
                  <div
                    key={row.id}
                    className="size-6 rounded-full ring-[1.5px] ring-background overflow-hidden shrink-0 bg-muted"
                  >
                    {row.avatar ? (
                      <img src={row.avatar} alt="" className="size-full object-cover" />
                    ) : (
                      <div
                        className={cn(
                          'size-full flex items-center justify-center text-[9px] font-bold text-white',
                          row.identity === 'teacher' && 'bg-gradient-to-br from-blue-500 to-indigo-600',
                          row.identity === 'assistant' && 'bg-gradient-to-br from-violet-500 to-fuchsia-600',
                          row.identity === 'student' && 'bg-gradient-to-br from-emerald-500 to-teal-600',
                        )}
                      >
                        {publisherRoleInitial(row, t)}
                      </div>
                    )}
                  </div>
                ))}
                {strip.length > 4 && (
                  <div className="size-6 rounded-full bg-muted ring-[1.5px] ring-background flex items-center justify-center">
                    <span className="text-[9px] font-bold text-muted-foreground">+{strip.length - 4}</span>
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}
      {showVoice &&
        (ttsEnabled ? (
          <Volume2 className="size-3.5 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors" />
        ) : (
          <VolumeX className="size-3.5 text-muted-foreground/30" />
        ))}
    </div>
  );

  return (
    <div ref={containerRef} className="relative w-96">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={cn(
              'group flex items-center gap-2 cursor-pointer rounded-full px-2.5 py-2 transition-all w-full',
              'border border-border/50 text-muted-foreground/70 hover:text-foreground hover:bg-muted/60',
            )}
            onClick={() => setOpen(!open)}
          >
            <span className="text-xs text-muted-foreground/60 group-hover:text-muted-foreground transition-colors hidden sm:block font-medium flex-1 text-left truncate">
              {open ? t('agentBar.expandedTitle') : t('agentBar.readyToLearn')}
            </span>
            {avatarRow}
            {open ? (
              <ChevronUp className="size-3 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors" />
            ) : (
              <ChevronDown className="size-3 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors" />
            )}
          </button>
        </TooltipTrigger>
        {!open && (
          <TooltipContent side="bottom" sideOffset={4}>
            {t('agentBar.configTooltip')}
          </TooltipContent>
        )}
      </Tooltip>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute right-0 top-full mt-1 z-50 w-96"
          >
            <div className="rounded-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06] shadow-[0_1px_8px_-2px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_8px_-2px_rgba(0,0,0,0.3)] px-2 py-1.5">
              {/* Teacher — always visible */}
              {teacherAgent && (
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-primary/5 mb-2">
                  <div
                    className="size-7 rounded-full overflow-hidden shrink-0 ring-1 ring-border/40"
                    style={{ boxShadow: `0 0 0 2px ${teacherAgent.color}30` }}
                  >
                    <img
                      src={teacherAgent.avatar}
                      alt={getAgentName(teacherAgent)}
                      className="size-full object-cover"
                    />
                  </div>
                  <span className="text-[13px] font-medium truncate min-w-0 flex-1">
                    {getAgentName(teacherAgent)}
                  </span>
                  {showVoice && (
                    <TeacherVoicePill
                      availableProviders={availableProviders}
                      disabled={!ttsEnabled}
                    />
                  )}
                </div>
              )}

              {/* Mode tabs: auto-generate | custom (names + identities in-panel) */}
              <div className="flex rounded-lg border bg-muted/30 p-0.5 mb-2">
                <button
                  type="button"
                  onClick={() => handleModeChange('auto')}
                  className={cn(
                    'flex-1 py-1.5 text-xs font-medium rounded-md transition-all text-center flex items-center justify-center gap-1',
                    agentMode === 'auto'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Sparkles className="h-3 w-3" />
                  {t('settings.agentModeAuto')}
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('custom')}
                  className={cn(
                    'flex-1 py-1.5 text-xs font-medium rounded-md transition-all text-center',
                    agentMode === 'custom'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t('settings.agentModeCustom')}
                </button>
              </div>

              {agentMode === 'auto' ? (
                <div className="flex flex-col items-center pt-6 pb-3 gap-4">
                  <div className="relative flex items-center justify-center">
                    <div className="absolute size-10 rounded-full bg-violet-400/10 dark:bg-violet-400/15 animate-ping [animation-duration:3s]" />
                    <div className="absolute size-12 rounded-full bg-violet-400/5 dark:bg-violet-400/10 animate-pulse [animation-duration:2.5s]" />
                    <Shuffle className="relative size-5 text-violet-400 dark:text-violet-500" />
                  </div>
                  <div className="flex-1" />
                  <div className="text-center space-y-1">
                    <p className="text-[11px] text-muted-foreground/60">
                      {t('settings.agentModeAutoDesc')}
                    </p>
                    <p className="text-[10px] text-muted-foreground/40">
                      {t('agentBar.voiceAutoAssign')}
                    </p>
                  </div>
                </div>
              ) : (
                <PublisherCustomRolesPanel
                  value={publisherCustomRoles}
                  onChange={setPublisherCustomRolesPersist}
                />
              )}

              {/* Max turns — compact stepper */}
              <div className="flex items-center gap-1.5 px-2 py-1 mt-1 border-t border-border/30">
                <MessageSquare className="size-3 text-muted-foreground/40 shrink-0" />
                <span className="text-[11px] text-muted-foreground/50 flex-1">
                  {t('settings.maxTurns')}
                </span>
                <div className="flex items-center rounded-full bg-muted/50 h-5 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const v = Math.max(1, parseInt(maxTurns || '1') - 1);
                      setMaxTurns(String(v));
                    }}
                    className="size-5 flex items-center justify-center text-muted-foreground/60 hover:text-foreground transition-colors rounded-full hover:bg-muted"
                  >
                    <Minus className="size-2.5" />
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={maxTurns}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '');
                      if (!raw) {
                        setMaxTurns('');
                        return;
                      }
                      const v = Math.min(20, Math.max(1, parseInt(raw)));
                      setMaxTurns(String(v));
                    }}
                    onBlur={() => {
                      if (!maxTurns || parseInt(maxTurns) < 1) setMaxTurns('1');
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-5 h-5 text-[11px] font-medium tabular-nums text-center bg-transparent outline-none border-none"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const v = Math.min(20, parseInt(maxTurns || '1') + 1);
                      setMaxTurns(String(v));
                    }}
                    className="size-5 flex items-center justify-center text-muted-foreground/60 hover:text-foreground transition-colors rounded-full hover:bg-muted"
                  >
                    <Plus className="size-2.5" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
