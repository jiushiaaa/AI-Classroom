'use client';

import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Cpu, MousePointer2, Trophy } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';
import type { Scene, SceneType } from '@/lib/types/stage';

interface MobileSceneDrawerProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly scenes: ReadonlyArray<Scene>;
  readonly currentSceneId: string | null;
  readonly onSelect: (sceneId: string) => void;
  readonly className?: string;
}

const TYPE_BADGE: Record<
  SceneType,
  { label: string; icon: typeof Sparkles; gradient: string }
> = {
  slide: {
    label: 'Slide',
    icon: Sparkles,
    gradient: 'from-purple-100 to-fuchsia-100 dark:from-purple-900/30 dark:to-fuchsia-900/30',
  },
  quiz: {
    label: 'Quiz',
    icon: Trophy,
    gradient: 'from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30',
  },
  interactive: {
    label: 'Interactive',
    icon: MousePointer2,
    gradient: 'from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30',
  },
  pbl: {
    label: 'PBL',
    icon: Cpu,
    gradient: 'from-sky-100 to-blue-100 dark:from-sky-900/30 dark:to-blue-900/30',
  },
};

/**
 * MobileSceneDrawer
 *
 * Slide-from-left drawer triggered by the grid button in the mobile top bar.
 * Renders one card per scene (gradient background keyed by scene type +
 * order index + title) so the publisher can verify navigation parity with
 * the desktop SceneSidebar without re-rendering full thumbnails on a phone
 * viewport.
 */
export function MobileSceneDrawer({
  open,
  onClose,
  scenes,
  currentSceneId,
  onSelect,
  className,
}: MobileSceneDrawerProps) {
  const { t } = useI18n();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scene-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
          />
          <motion.aside
            key="scene-drawer"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className={cn(
              'absolute top-0 bottom-0 left-0 z-50 w-[58%] max-w-[280px]',
              'bg-white/98 dark:bg-gray-950/98 backdrop-blur-xl border-r border-gray-200 dark:border-gray-800',
              'shadow-[8px_0_32px_-8px_rgba(0,0,0,0.2)] flex flex-col',
              className,
            )}
            aria-label={t('mobile.topBar.openSceneGrid')}
          >
            <div className="shrink-0 h-10 px-3 flex items-center justify-between border-b border-gray-100/80 dark:border-gray-800/80">
              <span className="text-[12.5px] font-semibold text-gray-700 dark:text-gray-200">
                {t('mobile.sceneDrawer.title')}
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('common.close')}
                className="p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
              {scenes.map((scene, idx) => {
                const isActive = scene.id === currentSceneId;
                const badge = TYPE_BADGE[scene.type] ?? TYPE_BADGE.slide;
                const Icon = badge.icon;
                return (
                  <button
                    key={scene.id}
                    type="button"
                    onClick={() => {
                      onSelect(scene.id);
                      onClose();
                    }}
                    className={cn(
                      'w-full text-left rounded-xl border transition-all overflow-hidden',
                      'group hover:shadow-md',
                      isActive
                        ? 'border-purple-300 dark:border-purple-600 ring-2 ring-purple-200 dark:ring-purple-700/60 shadow-md'
                        : 'border-gray-200 dark:border-gray-800',
                    )}
                  >
                    <div
                      className={cn(
                        'aspect-video w-full bg-gradient-to-br relative overflow-hidden',
                        badge.gradient,
                      )}
                    >
                      <div className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/80 dark:bg-gray-900/80 text-[9.5px] font-semibold text-gray-700 dark:text-gray-200 backdrop-blur-sm">
                        <span className="tabular-nums">{idx + 1}</span>
                        <span className="text-gray-300 dark:text-gray-600">/</span>
                        <Icon className="w-2.5 h-2.5" />
                      </div>
                    </div>
                    <div className="px-2 py-1.5">
                      <div
                        className={cn(
                          'text-[11.5px] font-medium truncate',
                          isActive
                            ? 'text-purple-700 dark:text-purple-300'
                            : 'text-gray-700 dark:text-gray-200',
                        )}
                      >
                        {scene.title || `Scene ${idx + 1}`}
                      </div>
                    </div>
                  </button>
                );
              })}
              {scenes.length === 0 && (
                <div className="text-center text-[11px] text-gray-400 dark:text-gray-500 py-6">
                  {t('mobile.sceneDrawer.empty')}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
