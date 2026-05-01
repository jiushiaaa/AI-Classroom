'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertCircle, User, Users, Sparkles, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';

interface AgentSettingsProps {
  selectedAgentIds: string[];
  maxTurns: string;
  agentMode: 'auto' | 'custom';
  onMaxTurnsChange: (value: string) => void;
  onAgentModeChange: (mode: 'auto' | 'custom') => void;
}

export function AgentSettings({
  selectedAgentIds,
  maxTurns,
  agentMode,
  onMaxTurnsChange,
  onAgentModeChange,
}: AgentSettingsProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{t('settings.agentMode')}</Label>
          <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
            <button
              type="button"
              onClick={() => onAgentModeChange('auto')}
              className={cn(
                'px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5',
                agentMode === 'auto'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {t('settings.agentModeAuto')}
            </button>
            <button
              type="button"
              onClick={() => onAgentModeChange('custom')}
              className={cn(
                'px-4 py-1.5 text-sm font-medium rounded-md transition-all',
                agentMode === 'custom'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t('settings.agentModeCustom')}
            </button>
          </div>
        </div>

        {agentMode === 'custom' ? (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/40 border border-border/60 text-sm text-muted-foreground">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{t('settings.agentModeCustomHint')}</span>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 text-sm">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{t('settings.agentModeAutoDesc')}</span>
          </div>
        )}

        {agentMode === 'custom' && (
          <>
            <div className="space-y-2 border-l-4 border-purple-500 pl-4">
              <Label>{t('settings.maxTurns')}</Label>
              <p className="text-xs text-muted-foreground">{t('settings.maxTurnsDesc')}</p>
              <Input
                type="number"
                min="1"
                max="20"
                value={maxTurns}
                onChange={(e) => onMaxTurnsChange(e.target.value)}
                className="w-24"
              />
            </div>

            <div
              className={cn(
                'p-3 rounded-lg text-sm border',
                selectedAgentIds.length === 0
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                  : selectedAgentIds.length === 1
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                    : 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
              )}
            >
              {selectedAgentIds.length === 0 && (
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" />
                  {t('settings.atLeastOneAgent')}
                </span>
              )}
              {selectedAgentIds.length === 1 && (
                <span className="flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  <strong>{t('settings.singleAgentMode')}</strong> — {t('settings.directAnswer')}
                </span>
              )}
              {selectedAgentIds.length > 1 && (
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  <strong>{t('settings.multiAgentMode')}</strong> —{' '}
                  {t('settings.agentsCollaboratingCount', {
                    count: selectedAgentIds.length,
                  })}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
