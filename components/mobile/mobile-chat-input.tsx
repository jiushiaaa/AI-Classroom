'use client';

import { useCallback, useState } from 'react';
import { Send } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';

interface MobileChatInputProps {
  readonly onSend: (text: string) => void | Promise<void>;
  readonly disabled?: boolean;
  /** When true, "send" turns into a stop affordance handled by `onStop`. */
  readonly isStreaming?: boolean;
  readonly onStop?: () => void | Promise<void>;
  readonly className?: string;
}

/**
 * MobileChatInput
 *
 * Pill-shaped input with a circular gradient send button. Press Enter to
 * submit; Shift+Enter inserts newline. While the active session is streaming,
 * the send affordance flips to "stop" so the publisher can interrupt the
 * agent loop without leaving the mobile UI.
 */
export function MobileChatInput({
  onSend,
  disabled = false,
  isStreaming = false,
  onStop,
  className,
}: MobileChatInputProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState('');

  const submit = useCallback(async () => {
    const text = draft.trim();
    if (!text || disabled) return;
    setDraft('');
    await onSend(text);
  }, [draft, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        submit();
      }
    },
    [submit],
  );

  const showStop = isStreaming && !!onStop;

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 bg-white/95 dark:bg-gray-900/95 border-t border-gray-100 dark:border-gray-800 backdrop-blur-md',
        className,
      )}
    >
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder={t('mobile.qa.inputPlaceholder')}
        disabled={disabled && !showStop}
        className={cn(
          'flex-1 resize-none bg-gray-100 dark:bg-gray-800 rounded-full px-3.5 py-1.5',
          'text-[12.5px] leading-5 text-gray-800 dark:text-gray-100 placeholder:text-gray-400',
          'outline-none focus:ring-2 focus:ring-purple-300/50 dark:focus:ring-purple-700/50',
          'transition-all max-h-20 overflow-y-auto',
        )}
      />
      {showStop ? (
        <button
          type="button"
          onClick={() => onStop?.()}
          aria-label={t('mobile.qa.stop')}
          title={t('mobile.qa.stop')}
          className={cn(
            'shrink-0 w-9 h-9 rounded-full inline-flex items-center justify-center',
            'bg-gradient-to-br from-rose-500 to-red-500 text-white shadow-md shadow-rose-500/25',
            'hover:shadow-rose-500/40 hover:from-rose-600 hover:to-red-600 active:scale-[0.96]',
            'transition-all',
          )}
        >
          <span className="block w-3 h-3 rounded-[3px] bg-white" />
        </button>
      ) : (
        <button
          type="button"
          onClick={submit}
          disabled={disabled || draft.trim().length === 0}
          aria-label={t('mobile.qa.send')}
          title={t('mobile.qa.send')}
          className={cn(
            'shrink-0 inline-flex items-center justify-center gap-1 h-9 px-3.5 rounded-full text-xs font-semibold',
            'transition-all',
            disabled || draft.trim().length === 0
              ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-br from-purple-500 via-violet-500 to-fuchsia-500 text-white shadow-md shadow-purple-500/25 hover:shadow-purple-500/40 hover:from-purple-600 hover:via-violet-600 hover:to-fuchsia-600 active:scale-[0.97]',
          )}
        >
          <span>{t('mobile.qa.send')}</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
