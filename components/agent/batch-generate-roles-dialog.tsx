'use client';

import { useState, useEffect, useMemo } from 'react';
import { Sparkles, Loader2, Minus, Plus, Wand2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useSettingsStore } from '@/lib/store/settings';
import { getCurrentModelConfig } from '@/lib/utils/model-config';
import {
  PUBLISHER_CUSTOM_ROLES_MAX,
  PUBLISHER_VOICE_GROUPS,
  newPublisherRoleId,
  pickPublisherAvatar,
  type PublisherCustomRoleRow,
  type PublisherIdentityRole,
} from '@/lib/publisher/publisher-custom-roles';

type IdentityHint = 'auto' | 'student' | 'assistant' | 'mixed';

interface BatchGeneratedRole {
  displayName: string;
  identity: PublisherIdentityRole;
  prompt: string;
}

interface BatchGenerateRolesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Number of slots still available (will clamp count to this). */
  remainingCapacity: number;
  /** Called with newly created rows (caller appends them to the list). */
  onGenerated: (rows: PublisherCustomRoleRow[]) => void;
}

const MAX_PROMPT = 1000;

function fallbackVoiceId(identity: PublisherIdentityRole): string {
  // Pick a sensible default voice based on identity.
  const teacherGroup = PUBLISHER_VOICE_GROUPS[0];
  const assistantGroup = PUBLISHER_VOICE_GROUPS[1];
  if (identity === 'assistant' && assistantGroup?.voices[0]) {
    return assistantGroup.voices[0].id;
  }
  return teacherGroup?.voices[0]?.id ?? '';
}

function buildRowFromGenerated(g: BatchGeneratedRole): PublisherCustomRoleRow {
  const id = newPublisherRoleId();
  const identity: PublisherIdentityRole =
    g.identity === 'assistant' || g.identity === 'teacher' ? g.identity : 'student';
  return {
    id,
    displayName: g.displayName,
    identity,
    prompt: g.prompt,
    voiceId: fallbackVoiceId(identity),
    avatar: pickPublisherAvatar(identity, id),
    enabled: true,
  };
}

export function BatchGenerateRolesDialog({
  open,
  onOpenChange,
  remainingCapacity,
  onGenerated,
}: Readonly<BatchGenerateRolesDialogProps>) {
  const { t, locale } = useI18n();
  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState(3);
  const [identityHint, setIdentityHint] = useState<IdentityHint>('auto');
  const [busy, setBusy] = useState(false);

  const cap = Math.max(1, Math.min(PUBLISHER_CUSTOM_ROLES_MAX, remainingCapacity));

  useEffect(() => {
    if (!open) return;
    setPrompt('');
    setIdentityHint('auto');
    setCount(Math.min(3, cap));
    setBusy(false);
  }, [open, cap]);

  const examples = useMemo(
    () => [
      t('agentBar.batchGenerate.example1'),
      t('agentBar.batchGenerate.example2'),
      t('agentBar.batchGenerate.example3'),
    ],
    [t],
  );

  const canSubmit = prompt.trim().length >= 2 && !busy && cap > 0;

  const setCountClamped = (n: number) => {
    setCount(Math.max(1, Math.min(cap, Math.round(n || 1))));
  };

  const handleGenerate = async () => {
    if (!canSubmit) return;
    const text = prompt.trim();
    if (text.length < 2) {
      toast.error(t('agentBar.batchGenerate.errorTooShort'));
      return;
    }
    const { modelId } = useSettingsStore.getState();
    if (!modelId) {
      toast.error(t('agentBar.magicFixNoModel'));
      return;
    }
    setBusy(true);
    try {
      const config = getCurrentModelConfig();
      const payload: Record<string, unknown> = {
        prompt: text,
        count,
        identityHint,
        locale,
      };
      if (config.thinkingConfig !== undefined) {
        payload.thinkingConfig = config.thinkingConfig;
      }
      const res = await fetch('/api/generate/publisher-roles-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-model': config.modelString || '',
          'x-api-key': config.apiKey || '',
          'x-base-url': config.baseUrl || '',
          'x-provider-type': config.providerType || '',
        },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        roles?: BatchGeneratedRole[];
        error?: string;
      };
      if (!res.ok || data.success !== true || !Array.isArray(data.roles) || data.roles.length === 0) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const rows = data.roles.slice(0, cap).map(buildRowFromGenerated);
      onGenerated(rows);
      toast.success(t('agentBar.batchGenerate.success', { count: rows.length }));
      onOpenChange(false);
    } catch {
      toast.error(t('agentBar.batchGenerate.errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent
        className="max-w-md gap-4"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-1.5">
            <Wand2 className="size-4 text-violet-500" />
            {t('agentBar.batchGenerate.title')}
          </DialogTitle>
          <DialogDescription className="text-[12px] leading-relaxed">
            {t('agentBar.batchGenerate.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('agentBar.batchGenerate.promptLabel')}</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, MAX_PROMPT))}
              placeholder={t('agentBar.batchGenerate.promptPlaceholder')}
              rows={4}
              disabled={busy}
              className="text-sm min-h-[110px] resize-none"
            />
            <div className="flex flex-wrap gap-1.5">
              {examples.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  disabled={busy}
                  onClick={() => setPrompt(ex)}
                  className={cn(
                    'text-[10.5px] px-2 py-0.5 rounded-full border border-border/60 text-muted-foreground/85',
                    'hover:bg-violet-50 hover:text-violet-700 hover:border-violet-300/70',
                    'dark:hover:bg-violet-950/30 dark:hover:text-violet-300',
                    'transition-colors disabled:opacity-50',
                  )}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('agentBar.batchGenerate.countLabel')}</Label>
              <div className="flex items-center justify-between rounded-md border border-border/60 h-9 pl-2 pr-1 bg-background">
                <span className="text-[11px] text-muted-foreground/75 select-none">
                  {t('agentBar.batchGenerate.countUnit')}
                </span>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    disabled={busy || count <= 1}
                    onClick={() => setCountClamped(count - 1)}
                    className="size-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/70 disabled:opacity-25"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="min-w-[1.6rem] text-center text-[13px] font-semibold tabular-nums">
                    {count}
                  </span>
                  <button
                    type="button"
                    disabled={busy || count >= cap}
                    onClick={() => setCountClamped(count + 1)}
                    className="size-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/70 disabled:opacity-25"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-[10.5px] text-muted-foreground/65 leading-tight">
                {t('agentBar.batchGenerate.countHint', { max: cap })}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t('agentBar.batchGenerate.identityLabel')}</Label>
              <Select
                value={identityHint}
                onValueChange={(v) => setIdentityHint(v as IdentityHint)}
                disabled={busy}
              >
                <SelectTrigger className="h-9 w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">{t('agentBar.batchGenerate.identityAuto')}</SelectItem>
                  <SelectItem value="student">
                    {t('agentBar.batchGenerate.identityStudent')}
                  </SelectItem>
                  <SelectItem value="assistant">
                    {t('agentBar.batchGenerate.identityAssistant')}
                  </SelectItem>
                  <SelectItem value="mixed">
                    {t('agentBar.batchGenerate.identityMixed')}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10.5px] text-muted-foreground/65 leading-tight">
                {t('agentBar.batchGenerate.identityHintShort')}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {t('agentBar.publisherCancel')}
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => void handleGenerate()}
            className="gap-1.5"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {busy
              ? t('agentBar.batchGenerate.generating')
              : t('agentBar.batchGenerate.generateButton', { count })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
