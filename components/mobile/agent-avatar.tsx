'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface AgentAvatarProps {
  /**
   * Avatar value from `AgentConfig.avatar`. Either an emoji ("🧑‍🏫") or a
   * URL / static path ("/avatars/teacher.png", "https://...png", "data:...").
   * The legacy mobile components rendered this string directly which made
   * URLs leak into the UI as text — this component normalises both shapes.
   */
  readonly avatar: string | null | undefined;
  readonly alt?: string;
  /** Pixel size for both width and height. Defaults to 32. */
  readonly size?: number;
  /** Fallback emoji when avatar is missing. */
  readonly fallback?: string;
  readonly className?: string;
  /** Tone the wrapper differently when the agent is currently speaking. */
  readonly highlighted?: boolean;
}

const URL_LIKE_RE = /^(\/|https?:\/\/|data:|blob:)/i;
const IMG_EXT_RE = /\.(png|jpe?g|svg|webp|gif|bmp|ico|avif)(\?.*)?$/i;

function isImageUrl(value: string): boolean {
  return URL_LIKE_RE.test(value) || IMG_EXT_RE.test(value);
}

/**
 * AgentAvatar
 *
 * Shared avatar renderer for the mobile / iPad classroom preview surfaces.
 * Handles both emoji avatars and URL-based avatars. Renders a circle that
 * always stays the requested pixel size and never lets the source string
 * leak into the DOM as visible text.
 */
export function AgentAvatar({
  avatar,
  alt,
  size = 32,
  fallback = '🙂',
  className,
  highlighted = false,
}: AgentAvatarProps) {
  const trimmed = typeof avatar === 'string' ? avatar.trim() : '';
  const hasUrl = trimmed.length > 0 && isImageUrl(trimmed);
  const emoji = trimmed.length > 0 && !hasUrl ? trimmed : fallback;

  const wrapperClass = cn(
    'inline-flex items-center justify-center rounded-full bg-white dark:bg-gray-800 overflow-hidden shrink-0',
    'ring-1 ring-black/5 dark:ring-white/10',
    highlighted && 'ring-2 ring-purple-400/70 dark:ring-purple-500/70 shadow-sm',
    className,
  );

  const dim = `${size}px`;

  if (hasUrl) {
    return (
      <span
        className={wrapperClass}
        style={{ width: dim, height: dim }}
        aria-label={alt}
      >
        <Image
          src={trimmed}
          alt={alt ?? ''}
          width={size}
          height={size}
          className="w-full h-full object-cover"
          unoptimized
        />
      </span>
    );
  }

  return (
    <span
      className={wrapperClass}
      style={{
        width: dim,
        height: dim,
        fontSize: Math.round(size * 0.55),
        lineHeight: 1,
      }}
      aria-hidden={!alt}
      aria-label={alt}
    >
      {emoji}
    </span>
  );
}
