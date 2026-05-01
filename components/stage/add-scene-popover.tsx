'use client';

/**
 * AddScenePopover
 * ---------------
 * Add-page action with two visual variants:
 *
 *  - default — sticky `+ 新建一页` button at the bottom of the SceneSidebar
 *    (appended at the end).
 *  - variant: 'slot' — slim "+" line that lives **between** two scene tiles
 *    in the sidebar. Hover-to-reveal so the sidebar isn't cluttered. Inserts
 *    the new scene at the given `insertIndex` and shifts later scenes down.
 *
 * Both variants open a popover offering two routes:
 *   1. 手动新建 — appends a blank slide scene and selects it.
 *   2. AI 辅助生成 — opens AIGenerateSceneDialog to mock an AI generation flow.
 *
 * Both routes terminate in `useStageStore.addScene` (when appending) or
 * `useStageStore.insertSceneAt` (when slotting between two scenes), so duplicate
 * / undo semantics behave identically to AI-generated scenes.
 */

import { useState } from 'react';
import { Plus, Sparkles, FilePlus2 } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useStageStore } from '@/lib/store';
import { useI18n } from '@/lib/hooks/use-i18n';
import { AIGenerateSceneDialog } from '@/components/stage/ai-generate-scene-dialog';
import type { Scene, SlideContent } from '@/lib/types/stage';
import type { SlideTheme } from '@/lib/types/slides';
import { cn } from '@/lib/utils';

const BLANK_THEME: SlideTheme = {
  backgroundColor: '#ffffff',
  themeColors: ['#7c3aed', '#2563eb', '#64748b', '#f59e0b', '#10b981'],
  fontColor: '#1e293b',
  fontName: 'Microsoft Yahei',
};

/**
 * Builds a minimal but renderable slide scene for "manual" creation.
 * Exported so the right-click context menu in SceneSidebar can reuse it for
 * the "新增空白幻灯片" item without duplicating the canvas template.
 */
export function buildBlankSlideScene(stageId: string, order: number, title: string): Scene {
  const now = Date.now();
  const sceneId = `manual-${now}`;
  const content: SlideContent = {
    type: 'slide',
    canvas: {
      id: `manual-canvas-${now}`,
      viewportSize: 1000,
      viewportRatio: 0.5625,
      theme: BLANK_THEME,
      elements: [
        {
          type: 'text',
          id: `manual-title-${now}`,
          content: title,
          left: 48,
          top: 60,
          width: 904,
          height: 80,
          rotate: 0,
          defaultFontName: BLANK_THEME.fontName,
          defaultColor: BLANK_THEME.fontColor,
          textType: 'title',
        },
        {
          type: 'text',
          id: `manual-body-${now}`,
          content: '<p>在这里输入正文内容…</p>',
          left: 48,
          top: 160,
          width: 904,
          height: 260,
          rotate: 0,
          defaultFontName: BLANK_THEME.fontName,
          defaultColor: '#475569',
          textType: 'content',
        },
      ],
    },
  };
  return {
    id: sceneId,
    stageId,
    type: 'slide',
    title,
    order,
    content,
    actions: [],
    createdAt: now,
    updatedAt: now,
  };
}

interface AddScenePopoverProps {
  /**
   * When provided, the new scene is inserted at this index in the scenes
   * array (and later scenes shift down). Omit to append at the end.
   */
  readonly insertIndex?: number;
  /**
   * Visual variant. 'default' renders the sticky bottom button. 'slot' renders
   * a slim hover-revealed "+" line designed to sit between two scene tiles.
   */
  readonly variant?: 'default' | 'slot';
}

export function AddScenePopover({ insertIndex, variant = 'default' }: AddScenePopoverProps) {
  const { t } = useI18n();
  const stage = useStageStore.use.stage();
  const scenes = useStageStore.use.scenes();
  const addScene = useStageStore.use.addScene();
  const insertSceneAt = useStageStore.use.insertSceneAt();
  const setCurrentSceneId = useStageStore.use.setCurrentSceneId();

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  const canAdd = !!stage;
  const isSlot = variant === 'slot';

  const targetIndex = insertIndex ?? scenes.length;

  const handleManual = () => {
    if (!stage) return;
    const blank = buildBlankSlideScene(
      stage.id,
      targetIndex,
      `${t('sceneActions.newPageTitle')} ${targetIndex + 1}`,
    );
    if (insertIndex === undefined) {
      addScene(blank);
    } else {
      insertSceneAt(blank, insertIndex);
    }
    setCurrentSceneId(blank.id);
    setPopoverOpen(false);
  };

  const handleAIRoute = () => {
    setPopoverOpen(false);
    // micro-delay so popover unmount animation doesn't fight the dialog mount
    setTimeout(() => setAiDialogOpen(true), 80);
  };

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          {isSlot ? (
            <button
              type="button"
              disabled={!canAdd}
              data-testid="add-scene-slot"
              aria-label={t('sceneActions.addPage')}
              className={cn(
                'group/slot relative w-full flex items-center justify-center cursor-pointer',
                // Slim hit-target with breathing room — collapses to a hairline
                // until hovered/focused so the sidebar doesn't feel cluttered.
                'h-3 -my-1.5',
                'transition-all duration-200',
                !canAdd && 'cursor-not-allowed',
                popoverOpen && 'h-6 my-0',
              )}
            >
              {/* Hairline that grows into a purple bar on hover */}
              <span
                className={cn(
                  'absolute left-2 right-2 h-px rounded-full transition-all duration-200',
                  popoverOpen
                    ? 'bg-purple-400 dark:bg-purple-500 h-0.5 left-1.5 right-1.5'
                    : 'bg-transparent group-hover/slot:bg-purple-300/80 dark:group-hover/slot:bg-purple-500/60 group-focus-visible/slot:bg-purple-300/80',
                )}
              />
              {/* Centred + circle that fades in */}
              <span
                className={cn(
                  'relative inline-flex items-center justify-center size-5 rounded-full',
                  'bg-white dark:bg-slate-900 ring-1 transition-all duration-200',
                  popoverOpen
                    ? 'ring-purple-400 dark:ring-purple-500 text-purple-600 dark:text-purple-300 opacity-100 scale-100'
                    : 'ring-purple-200 dark:ring-purple-700/60 text-purple-500 dark:text-purple-300 opacity-0 scale-75 group-hover/slot:opacity-100 group-hover/slot:scale-100 group-focus-visible/slot:opacity-100 group-focus-visible/slot:scale-100',
                )}
              >
                <Plus className="size-3" strokeWidth={2.4} />
              </span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!canAdd}
              data-testid="add-scene-button"
              className={cn(
                'w-full flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-medium',
                'border border-dashed transition-all duration-150',
                canAdd
                  ? 'border-purple-200 dark:border-purple-700/50 text-purple-600 dark:text-purple-300 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 active:scale-[0.98]'
                  : 'border-gray-200 dark:border-gray-700 text-gray-400 cursor-not-allowed',
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('sceneActions.addPage')}</span>
            </button>
          )}
        </PopoverTrigger>
        <PopoverContent
          align={isSlot ? 'start' : 'center'}
          side={isSlot ? 'right' : 'top'}
          sideOffset={isSlot ? 12 : 8}
          className="w-56 p-1.5 rounded-xl"
        >
          <button
            type="button"
            onClick={handleManual}
            className="w-full flex items-start gap-2.5 rounded-lg p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <span className="mt-0.5 w-7 h-7 shrink-0 rounded-md bg-gray-100 dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300">
              <FilePlus2 className="w-3.5 h-3.5" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-semibold text-gray-900 dark:text-gray-100">
                {t('sceneActions.manualCreate')}
              </span>
              <span className="block text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                {t('sceneActions.manualCreateHint')}
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={handleAIRoute}
            className="w-full flex items-start gap-2.5 rounded-lg p-2 text-left hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
          >
            <span className="mt-0.5 w-7 h-7 shrink-0 rounded-md bg-gradient-to-br from-purple-500 to-indigo-500 text-white flex items-center justify-center shadow-sm shadow-purple-500/30">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-semibold text-purple-700 dark:text-purple-300">
                {t('sceneActions.aiGenerate')}
              </span>
              <span className="block text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                {t('sceneActions.aiGenerateHint')}
              </span>
            </span>
          </button>
        </PopoverContent>
      </Popover>

      <AIGenerateSceneDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        insertIndex={insertIndex}
      />
    </>
  );
}
