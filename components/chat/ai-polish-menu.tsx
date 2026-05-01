'use client';

/**
 * AIPolishMenu
 * ------------
 * Floating popover that appears above a non-empty text selection inside an
 * EditableSpeech contentEditable span. Offers three mock "AI rewrite" actions:
 *
 *  - expand   (扩充)   : append a teaching-flavoured trailing clause
 *  - shrink   (精简)   : keep the leading ~60% of the selection + ellipsis
 *  - academic (学术化) : prepend a registered "in academic terms" lead-in
 *
 * After the user picks an option we run a 1-second fake spinner, replace the
 * selection content with the transformed text, then bubble a callback so the
 * host can commit the edit through P1's normal pipeline (which fires the
 * "TTS synced" toast and badge).
 *
 * The component owns no global state; the host (`EditableSpeech`) drives
 * `open`, the selection bounding rect, and the raw selected text.
 */

import { useState } from 'react';
import { Loader2, Maximize2, Minimize2, GraduationCap } from 'lucide-react';
import { motion } from 'motion/react';
import { useI18n } from '@/lib/hooks/use-i18n';

export type PolishOption = 'expand' | 'shrink' | 'academic';

interface AIPolishMenuProps {
  /** Anchor rect (viewport coordinates) of the current text selection. */
  readonly anchorRect: DOMRect;
  /** Raw selected text. */
  readonly selectedText: string;
  /**
   * Called after the 1s fake processing delay with the rewritten text.
   * The host is responsible for replacing the selection in the DOM and
   * committing the change.
   */
  readonly onApply: (rewritten: string, option: PolishOption) => void;
  /** Called when the user clicks outside or presses Escape. */
  readonly onCancel: () => void;
}

const PROCESS_DELAY_MS = 1000;

/**
 * Apply a deterministic mock "rewrite" rule. Kept as a pure helper so it can
 * be unit-tested independently and reused by host components if needed.
 */
export function applyPolish(text: string, option: PolishOption): string {
  const trimmed = text.trim();
  if (!trimmed) return text;
  switch (option) {
    case 'expand':
      return `${trimmed}—— 这一概念在教学中尤其值得我们深入理解。`;
    case 'shrink': {
      const len = Array.from(trimmed).length;
      const keep = Math.max(1, Math.ceil(len * 0.6));
      const head = Array.from(trimmed).slice(0, keep).join('');
      return `${head}…`;
    }
    case 'academic':
      return `在学术语境下，${trimmed}`;
    default:
      return text;
  }
}

export function AIPolishMenu({ anchorRect, selectedText, onApply, onCancel }: AIPolishMenuProps) {
  const { t } = useI18n();
  const [pending, setPending] = useState<PolishOption | null>(null);

  const handlePick = (opt: PolishOption) => {
    if (pending) return;
    setPending(opt);
    setTimeout(() => {
      const next = applyPolish(selectedText, opt);
      onApply(next, opt);
      setPending(null);
    }, PROCESS_DELAY_MS);
  };

  // Position the menu 8px above the selection, horizontally centered.
  // Coordinates are viewport-relative. We use a fixed-position wrapper to avoid
  // colliding with motion's transform animation on the inner element.
  const top = Math.max(8, anchorRect.top - 8);
  const left = anchorRect.left + anchorRect.width / 2;

  return (
    <div
      style={{
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        transform: 'translate(-50%, -100%)',
        zIndex: 60,
      }}
      data-testid="ai-polish-menu-wrapper"
    >
    <motion.div
      role="menu"
      aria-label={t('aiPolish.menuAriaLabel')}
      onMouseDown={(e) => {
        // Prevent the host span from losing focus / selection when the menu is
        // clicked. Without this the contentEditable selection collapses before
        // we can read it.
        e.preventDefault();
      }}
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.96 }}
      transition={{ duration: 0.14, ease: 'easeOut' }}
      className="flex items-center gap-1 rounded-full bg-white dark:bg-zinc-900 px-1.5 py-1 shadow-lg shadow-purple-500/20 ring-1 ring-purple-200/70 dark:ring-purple-700/40"
      data-testid="ai-polish-menu"
    >
      <PolishButton
        option="expand"
        Icon={Maximize2}
        label={t('aiPolish.expand')}
        onPick={handlePick}
        pending={pending}
      />
      <span className="w-px h-4 bg-zinc-200/80 dark:bg-zinc-700/60" />
      <PolishButton
        option="shrink"
        Icon={Minimize2}
        label={t('aiPolish.shrink')}
        onPick={handlePick}
        pending={pending}
      />
      <span className="w-px h-4 bg-zinc-200/80 dark:bg-zinc-700/60" />
      <PolishButton
        option="academic"
        Icon={GraduationCap}
        label={t('aiPolish.academic')}
        onPick={handlePick}
        pending={pending}
      />
      <button
        type="button"
        onClick={onCancel}
        className="ml-1 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
        aria-label={t('aiPolish.cancel')}
        title={t('aiPolish.cancel')}
      >
        ✕
      </button>
    </motion.div>
    </div>
  );
}

interface PolishButtonProps {
  readonly option: PolishOption;
  readonly Icon: typeof Maximize2;
  readonly label: string;
  readonly onPick: (option: PolishOption) => void;
  readonly pending: PolishOption | null;
}

function PolishButton({ option, Icon, label, onPick, pending }: PolishButtonProps) {
  const isPending = pending === option;
  const disabled = pending !== null;
  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => onPick(option)}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-100/80 dark:hover:bg-purple-800/40 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
    >
      {isPending ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Icon className="w-3 h-3" />
      )}
      <span>{label}</span>
    </button>
  );
}
