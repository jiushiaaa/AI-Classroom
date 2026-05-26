'use client';

import { useId, useRef } from 'react';
import { ImagePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import { toast } from 'sonner';
import { readAvatarImageFile } from '@/lib/utils/avatar-image-upload';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface PresetAgentAvatarProps {
  src: string;
  ringColor?: string;
  onAvatarChange: (dataUrl: string) => void;
  className?: string;
}

/**
 * Circular agent avatar with hover overlay to upload / replace a custom image.
 */
export function PresetAgentAvatar({
  src,
  ringColor,
  onAvatarChange,
  className,
}: Readonly<PresetAgentAvatarProps>) {
  const { t } = useI18n();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const result = await readAvatarImageFile(file);
    if (!result.ok) {
      if (result.error === 'tooLarge') {
        toast.error(t('profile.fileTooLarge'));
      } else if (result.error === 'invalidType') {
        toast.error(t('profile.invalidFileType'));
      } else {
        toast.error(t('agentBar.avatarUploadFailed'));
      }
      return;
    }
    onAvatarChange(result.dataUrl);
  };

  const openPicker = () => inputRef.current?.click();

  return (
    <>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => void handleFileChange(e)}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openPicker();
            }}
            className={cn(
              'group/avatar relative size-8 rounded-full overflow-hidden ring-1 ring-border/40 shrink-0 cursor-pointer',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70',
              className,
            )}
            style={ringColor ? { boxShadow: `0 0 0 2px ${ringColor}30` } : undefined}
            aria-label={t('agentBar.replaceAvatarAria')}
          >
            <img src={src} alt="" className="size-full object-cover" aria-hidden />
            <span
              className={cn(
                'absolute inset-0 flex items-center justify-center bg-black/45 text-white',
                'opacity-0 transition-opacity group-hover/avatar:opacity-100',
                'group-focus-visible/avatar:opacity-100',
              )}
              aria-hidden
            >
              <ImagePlus className="size-3.5" />
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[11px]">
          {t('agentBar.replaceAvatarTooltip')}
        </TooltipContent>
      </Tooltip>
    </>
  );
}
