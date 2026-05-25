'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  PieChart,
  Cpu,
  MousePointer2,
  BookOpen,
  Globe,
  AlertCircle,
  RefreshCw,
  Trophy,
  Trash2,
  Copy,
  AlertTriangle,
  ClipboardPaste,
  Sparkles,
  FilePlus2,
  Loader2,
  RotateCcw,
  MoreHorizontal,
} from 'lucide-react';
import { VisuallyHidden } from 'radix-ui';
import { cn } from '@/lib/utils';
import { ThumbnailSlide } from '@/components/slide-renderer/components/ThumbnailSlide';
import { ThumbnailInteractive } from '@/components/slide-renderer/components/ThumbnailInteractive';
import { useStageStore, useCanvasStore } from '@/lib/store';
import { useI18n } from '@/lib/hooks/use-i18n';
import type { Scene, SceneType, SlideContent, InteractiveContent } from '@/lib/types/stage';
import { PENDING_SCENE_ID } from '@/lib/store/stage';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AddScenePopover, buildBlankSlideScene } from '@/components/stage/add-scene-popover';
import { AIGenerateSceneDialog } from '@/components/stage/ai-generate-scene-dialog';
import { AIModifyPanel } from '@/components/scene-renderers/ai-modify-panel';
import { useAiOptimizationMutex } from '@/lib/hooks/use-ai-optimization-mutex';
import { sceneHasPendingAiCommand } from '@/lib/utils/scene-ai-commands';
import { toast } from 'sonner';

interface SceneSidebarProps {
  readonly collapsed: boolean;
  readonly onCollapseChange: (collapsed: boolean) => void;
  readonly onSceneSelect?: (sceneId: string) => void;
  readonly onRetryOutline?: (outlineId: string) => Promise<void>;
  readonly isCourseComplete?: boolean;
  /**
   * Hide all publisher-only actions: per-scene hover toolbar (move / duplicate
   * / delete) and the sticky add-scene popover. Used by the mobile / iPad
   * preview shell so the sidebar shows only what an end student would see.
   */
  readonly readOnly?: boolean;
}

const DEFAULT_WIDTH = 220;
const MIN_WIDTH = 170;
const MAX_WIDTH = 400;

function SceneSidebarTitle({
  sceneId,
  title,
  isActive,
  readOnly,
}: {
  sceneId: string;
  title: string;
  isActive: boolean;
  readOnly: boolean;
}) {
  const updateScene = useStageStore((s) => s.updateScene);
  const titleRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = titleRef.current;
    if (!node) return;
    if (document.activeElement === node) return;
    const next = title || '';
    if (node.textContent !== next) {
      node.textContent = next;
    }
  }, [title, sceneId]);

  const commitTitle = useCallback(() => {
    if (readOnly) return;
    const node = titleRef.current;
    if (!node) return;
    const next = (node.textContent || '').trim();
    if (!next) {
      node.textContent = title || '';
      return;
    }
    if (next !== title) {
      updateScene(sceneId, { title: next });
    }
  }, [readOnly, sceneId, title, updateScene]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLSpanElement>) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        titleRef.current?.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        const node = titleRef.current;
        if (node) node.textContent = title || '';
        node?.blur();
      }
    },
    [title],
  );

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const text = e.clipboardData
      .getData('text/plain')
      .replace(/[\r\n]+/g, ' ')
      .trim();
    if (!text) return;
    const selection = globalThis.getSelection?.();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }, []);

  const stopBubble = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
  }, []);

  const className = cn(
    'text-xs font-bold truncate transition-colors min-w-0 flex-1',
    isActive
      ? 'text-purple-700 dark:text-purple-300'
      : 'text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100',
    !readOnly &&
      'cursor-text outline-none rounded px-0.5 -mx-0.5 hover:bg-black/5 dark:hover:bg-white/5 focus:bg-white/90 dark:focus:bg-gray-900/90 focus:ring-1 focus:ring-purple-300/60 dark:focus:ring-purple-500/40',
  );

  if (readOnly) {
    return (
      <span data-testid="scene-title" className={className}>
        {title}
      </span>
    );
  }

  return (
    <span
      ref={titleRef}
      data-testid="scene-title"
      className={className}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      title="点击修改页标题（回车确认，Esc 取消）"
      onBlur={commitTitle}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onMouseDown={stopBubble}
      onClick={stopBubble}
      onDragStart={(e) => e.preventDefault()}
    >
      {title}
    </span>
  );
}

export function SceneSidebar({
  collapsed,
  onCollapseChange,
  onSceneSelect,
  onRetryOutline,
  isCourseComplete,
  readOnly = false,
}: SceneSidebarProps) {
  const { t } = useI18n();
  const { canStart: canStartAiOptimization } = useAiOptimizationMutex();
  const {
    scenes,
    deletedScenes,
    currentSceneId,
    setCurrentSceneId,
    generatingOutlines,
    generationStatus,
  } = useStageStore();
  const failedOutlines = useStageStore.use.failedOutlines();
  const viewportSize = useCanvasStore.use.viewportSize();
  const viewportRatio = useCanvasStore.use.viewportRatio();
  const stage = useStageStore.use.stage();
  const reorderScenes = useStageStore.use.reorderScenes();
  const deleteSceneAction = useStageStore.use.deleteScene();
  const restoreScene = useStageStore.use.restoreScene();
  const purgeDeletedScene = useStageStore.use.purgeDeletedScene();
  const insertSceneAt = useStageStore.use.insertSceneAt();
  const duplicateScene = useStageStore.use.duplicateScene();
  const sceneClipboard = useStageStore.use.sceneClipboard();

  const sceneListRef = useRef<HTMLDivElement>(null);

  // Keep the active scene thumbnail in view when current page changes from any
  // source (sidebar, notes panel, transport controls, playback).
  useEffect(() => {
    if (!currentSceneId || currentSceneId === PENDING_SCENE_ID) return;
    const root = sceneListRef.current;
    if (!root) return;
    const tile = root.querySelector(`[data-scene-id="${CSS.escape(currentSceneId)}"]`);
    if (tile instanceof HTMLElement) {
      tile.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentSceneId]);

  // Drag-and-drop reordering state. We use HTML5 native DnD (no extra dep)
  // so the publisher can grab a thumbnail and drop it anywhere — including
  // between two slides. The hover line shown by `dropLineIndex` always lands
  // *between* tiles, matching WPS / Keynote behaviour.
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropLineIndex, setDropLineIndex] = useState<number | null>(null);

  // Right-click menu spawns the AI dialog at sidebar level (rather than at
  // each AddScenePopover) so the menu can pin the insertIndex independently
  // from the inline "+" slot popovers.
  const [aiDialogIndex, setAiDialogIndex] = useState<number | null>(null);
  const [aiOptimizeSceneId, setAiOptimizeSceneId] = useState<string | null>(null);

  /** Paste the clipboard's scene immediately after `index`, preserving the
   *  publisher's mental model that "paste lands here, below this slide". */
  const handlePasteAfter = useCallback(
    (index: number) => {
      if (!sceneClipboard || !stage) return;
      const now = Date.now();
      const cloned: Scene = {
        ...structuredClone(sceneClipboard),
        // Re-stamp identity so the inserted scene is a new entity.
        id: `${sceneClipboard.id}-paste-${now}`,
        stageId: stage.id,
        title: sceneClipboard.title,
        createdAt: now,
        updatedAt: now,
      };
      insertSceneAt(cloned, index + 1);
      setCurrentSceneId(cloned.id);
    },
    [insertSceneAt, sceneClipboard, setCurrentSceneId, stage],
  );

  /** Insert a fresh blank slide right after `index`. */
  const handleInsertBlankAfter = useCallback(
    (index: number) => {
      if (!stage) return;
      const order = index + 1;
      const blank = buildBlankSlideScene(
        stage.id,
        order,
        `${t('sceneActions.newPageTitle')} ${order + 1}`,
      );
      insertSceneAt(blank, order);
      setCurrentSceneId(blank.id);
    },
    [insertSceneAt, setCurrentSceneId, stage, t],
  );

  const handleSceneDragStart = (index: number) => (e: React.DragEvent<HTMLDivElement>) => {
    if (readOnly) return;
    e.dataTransfer.effectAllowed = 'move';
    // Some browsers refuse to start a drag without any payload; the value
    // itself is unused — we drive the reorder from local state.
    e.dataTransfer.setData('text/plain', String(index));
    setDraggingIndex(index);
  };

  const handleSceneDragOver =
    (index: number) => (e: React.DragEvent<HTMLDivElement>) => {
      if (readOnly || draggingIndex === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      // Decide whether the cursor is in the upper or lower half of the tile,
      // and pin the drop line to the correct gap.
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const inLowerHalf = e.clientY - rect.top > rect.height / 2;
      setDropLineIndex(inLowerHalf ? index + 1 : index);
    };

  const handleSceneDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (readOnly || draggingIndex === null || dropLineIndex === null) {
      setDraggingIndex(null);
      setDropLineIndex(null);
      return;
    }
    e.preventDefault();
    reorderScenes(draggingIndex, dropLineIndex);
    setDraggingIndex(null);
    setDropLineIndex(null);
  };

  const handleSceneDragEnd = () => {
    setDraggingIndex(null);
    setDropLineIndex(null);
  };

  const [retryingOutlineId, setRetryingOutlineId] = useState<string | null>(null);
  // Holds the id of the scene the user has just clicked the trash icon on;
  // when set, the AlertDialog opens to ask for second confirmation.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingDeleteScene = pendingDeleteId
    ? scenes.find((s) => s.id === pendingDeleteId)
    : undefined;

  const confirmDelete = () => {
    if (!pendingDeleteId) return;
    deleteSceneAction(pendingDeleteId);
    setPendingDeleteId(null);
  };

  const handleRetryOutline = async (outlineId: string) => {
    if (!onRetryOutline) return;
    setRetryingOutlineId(outlineId);
    try {
      await onRetryOutline(outlineId);
    } finally {
      setRetryingOutlineId(null);
    }
  };

  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const isDraggingRef = useRef(false);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      const startX = e.clientX;
      const startWidth = sidebarWidth;

      const handleMouseMove = (me: MouseEvent) => {
        const delta = me.clientX - startX;
        const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
        setSidebarWidth(newWidth);
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [sidebarWidth],
  );

  const getSceneTypeIcon = (type: SceneType) => {
    const icons = {
      slide: BookOpen,
      quiz: PieChart,
      interactive: MousePointer2,
      pbl: Cpu,
    };
    return icons[type] || BookOpen;
  };

  const displayWidth = collapsed ? 0 : sidebarWidth;

  return (
    <div
      style={{
        width: displayWidth,
        transition: isDraggingRef.current ? 'none' : 'width 0.3s ease',
      }}
      className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-gray-100 dark:border-gray-800 shadow-[2px_0_24px_rgba(0,0,0,0.02)] flex flex-col shrink-0 z-20 relative overflow-visible"
    >
      {/* Drag handle */}
      {!collapsed && (
        <div
          onMouseDown={handleDragStart}
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-50 group hover:bg-purple-400/30 dark:hover:bg-purple-600/30 active:bg-purple-500/40 dark:active:bg-purple-500/40 transition-colors"
        >
          <div className="absolute right-0.5 top-1/2 -translate-y-1/2 w-0.5 h-8 rounded-full bg-gray-300 dark:bg-gray-600 group-hover:bg-purple-400 dark:group-hover:bg-purple-500 transition-colors" />
        </div>
      )}

      <div className={cn('flex flex-col w-full h-full overflow-hidden', collapsed && 'hidden')}>
        {/* Scenes List */}
        <div
          ref={sceneListRef}
          data-testid="scene-list"
          className="flex-1 overflow-y-auto overflow-x-hidden p-2 scrollbar-hide pt-3"
        >
          {/* Insert-slot above the very first scene (only when editable) */}
          {!readOnly && scenes.length > 0 && <AddScenePopover variant="slot" insertIndex={0} />}

          {scenes.map((scene, index) => {
            const isActive = currentSceneId === scene.id;
            const Icon = getSceneTypeIcon(scene.type);
            const isSlide = scene.type === 'slide';
            const isInteractive = scene.type === 'interactive';
            const slideContent = isSlide ? (scene.content as SlideContent) : null;
            const interactiveContent = isInteractive ? (scene.content as InteractiveContent) : null;
            const aiPending = sceneHasPendingAiCommand(scene);
            const isDragging = draggingIndex === index;
            // Render the drop-line BELOW each tile (covers all gaps except the
            // very first one), and only render it ABOVE the first tile so we
            // don't double-paint the same gap between two adjacent tiles.
            const showDropLineAbove =
              index === 0 && dropLineIndex === 0 && draggingIndex !== 0;
            const showDropLineBelow =
              dropLineIndex === index + 1 && draggingIndex !== index && draggingIndex !== index + 1;

            return (
              <div key={scene.id} data-scene-id={scene.id} className="relative">
                {/* Drop indicator: thin purple bar above tile */}
                {showDropLineAbove && (
                  <div
                    aria-hidden
                    className="absolute -top-1 left-1 right-1 h-0.5 rounded-full bg-purple-500 dark:bg-purple-400 shadow-[0_0_6px_rgba(168,85,247,0.6)] pointer-events-none z-20"
                  />
                )}

                <ContextMenu>
                  <ContextMenuTrigger asChild disabled={readOnly}>
                    <div
                      data-testid="scene-item"
                      draggable={!readOnly}
                      onDragStart={handleSceneDragStart(index)}
                      onDragOver={handleSceneDragOver(index)}
                      onDrop={handleSceneDrop}
                      onDragEnd={handleSceneDragEnd}
                      onClick={() => {
                        if (onSceneSelect) {
                          onSceneSelect(scene.id);
                        } else {
                          setCurrentSceneId(scene.id);
                        }
                      }}
                      // Right-click also selects the scene so the publisher
                      // sees what they're acting on, mirroring WPS behaviour.
                      onContextMenu={() => {
                        if (onSceneSelect) {
                          onSceneSelect(scene.id);
                        } else {
                          setCurrentSceneId(scene.id);
                        }
                      }}
                      className={cn(
                        'group/slide relative rounded-lg transition-all duration-200 cursor-pointer flex flex-col gap-1 p-1.5 my-1',
                        isActive
                          ? 'bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-200 dark:ring-purple-700'
                          : 'hover:bg-gray-50/80 dark:hover:bg-gray-800/50',
                        isDragging && 'opacity-40 scale-[0.98] ring-1 ring-purple-300 dark:ring-purple-600',
                      )}
                    >
                {/* All hover-revealed affordances (drag handle, copy / delete
                    overlay) have been removed: drag works directly on the
                    whole tile, and right-click opens the full action menu.
                    This keeps the sidebar visually quiet at rest. */}

                {/* Scene Header */}
                <div className="flex justify-between items-center px-2 pt-0.5">
                  <div className="flex items-center gap-2 max-w-full">
                    <span
                      className={cn(
                        'text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shrink-0',
                        isActive
                          ? 'bg-purple-600 dark:bg-purple-500 text-white shadow-sm shadow-purple-500/30'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
                      )}
                    >
                      {index + 1}
                    </span>
                    <SceneSidebarTitle
                      sceneId={scene.id}
                      title={scene.title}
                      isActive={isActive}
                      readOnly={readOnly}
                    />
                  </div>
                </div>

                {/* Thumbnail */}
                <div className="relative aspect-video w-full rounded overflow-hidden bg-gray-100 dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/5">
                  {!readOnly && (
                    <div
                      className={cn(
                        'absolute inset-0 z-30 flex items-end justify-center gap-1.5 pb-1.5 px-1',
                        'bg-gradient-to-t from-black/55 via-black/20 to-transparent',
                        'opacity-0 pointer-events-none transition-opacity duration-150',
                        'group-hover/slide:opacity-100 group-hover/slide:pointer-events-auto',
                      )}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDeleteId(scene.id);
                        }}
                        className="inline-flex items-center gap-0.5 rounded-md bg-white/95 dark:bg-zinc-900/95 px-2 py-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 shadow-sm ring-1 ring-rose-200/60 dark:ring-rose-800/40 hover:bg-rose-50 dark:hover:bg-rose-950/40 active:scale-95"
                      >
                        <Trash2 className="size-3 shrink-0" />
                        {t('sceneActions.hoverDelete')}
                      </button>
                      <button
                        type="button"
                        disabled={!canStartAiOptimization || aiPending}
                        title={
                          !canStartAiOptimization
                            ? t('aiModify.globalBusyTooltip')
                            : aiPending
                              ? t('aiModify.statusPending')
                              : t('sceneActions.hoverAiOptimize')
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!canStartAiOptimization) {
                            toast.error(t('aiModify.globalBusyToast'));
                            return;
                          }
                          if (aiPending) return;
                          setAiOptimizeSceneId(scene.id);
                        }}
                        className={cn(
                          'inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-[10px] font-bold shadow-sm active:scale-95',
                          canStartAiOptimization && !aiPending
                            ? 'bg-white/95 dark:bg-zinc-900/95 text-violet-700 dark:text-violet-300 ring-1 ring-violet-200/70 dark:ring-violet-700/40 hover:bg-violet-50 dark:hover:bg-violet-950/30'
                            : 'bg-white/70 dark:bg-zinc-900/70 text-gray-400 dark:text-gray-500 ring-1 ring-gray-200/60 dark:ring-gray-700/40 cursor-not-allowed opacity-70',
                        )}
                      >
                        <Sparkles className="size-3 shrink-0" />
                        {aiPending ? t('aiModify.statusPending') : t('sceneActions.hoverAiOptimize')}
                      </button>
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    {isSlide && slideContent ? (
                      <ThumbnailSlide
                        slide={slideContent.canvas}
                        viewportSize={viewportSize}
                        viewportRatio={viewportRatio}
                        size={Math.max(100, sidebarWidth - 28)}
                      />
                    ) : scene.type === 'quiz' ? (
                      /* Quiz: question bar + 2x2 option grid */
                      <div className="w-full h-full bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20 p-2 flex flex-col">
                        <div className="h-1.5 w-4/5 bg-orange-200/70 dark:bg-orange-700/30 rounded-full mb-1.5" />
                        <div className="flex-1 grid grid-cols-2 gap-1">
                          {[0, 1, 2, 3].map((i) => (
                            <div
                              key={i}
                              className={cn(
                                'rounded flex items-center gap-1 px-1',
                                i === 1
                                  ? 'bg-orange-400/20 dark:bg-orange-500/20 border border-orange-300/50 dark:border-orange-600/30'
                                  : 'bg-white/60 dark:bg-white/5 border border-orange-100/60 dark:border-orange-800/20',
                              )}
                            >
                              <div
                                className={cn(
                                  'w-1.5 h-1.5 rounded-full shrink-0',
                                  i === 1
                                    ? 'bg-orange-400 dark:bg-orange-500'
                                    : 'bg-orange-200 dark:bg-orange-700/50',
                                )}
                              />
                              <div
                                className={cn(
                                  'h-1 rounded-full flex-1',
                                  i === 1
                                    ? 'bg-orange-300/60 dark:bg-orange-600/40'
                                    : 'bg-orange-100/80 dark:bg-orange-800/30',
                                )}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : scene.type === 'interactive' && interactiveContent?.html ? (
                      /* Interactive: live iframe preview */
                      <ThumbnailInteractive
                        content={interactiveContent}
                        size={Math.max(100, sidebarWidth - 28)}
                      />
                    ) : scene.type === 'interactive' ? (
                      /* Interactive: browser window with chrome + content */
                      <div className="w-full h-full bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 p-1.5 flex flex-col">
                        <div className="flex items-center gap-1 mb-1 pb-1 border-b border-emerald-200/40 dark:border-emerald-700/20">
                          <div className="flex gap-0.5">
                            <div className="w-1 h-1 rounded-full bg-red-300 dark:bg-red-500/60" />
                            <div className="w-1 h-1 rounded-full bg-amber-300 dark:bg-amber-500/60" />
                            <div className="w-1 h-1 rounded-full bg-green-300 dark:bg-green-500/60" />
                          </div>
                          <div className="h-1.5 flex-1 bg-emerald-200/40 dark:bg-emerald-700/30 rounded-full ml-0.5" />
                        </div>
                        <div className="flex-1 flex gap-1">
                          <div className="w-1/4 space-y-1 pt-0.5">
                            {[1, 2, 3].map((i) => (
                              <div
                                key={i}
                                className="h-0.5 w-full bg-emerald-200/60 dark:bg-emerald-700/30 rounded-full"
                              />
                            ))}
                          </div>
                          <div className="flex-1 bg-emerald-100/40 dark:bg-emerald-800/20 rounded flex items-center justify-center border border-emerald-200/40 dark:border-emerald-700/20">
                            <Globe className="w-4 h-4 text-emerald-300/80 dark:text-emerald-600/50" />
                          </div>
                        </div>
                      </div>
                    ) : scene.type === 'pbl' ? (
                      /* PBL: kanban board with 3 columns */
                      <div className="w-full h-full bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 p-1.5 flex flex-col">
                        <div className="flex items-center gap-1 mb-1.5">
                          <div className="w-1.5 h-1.5 rounded bg-blue-300 dark:bg-blue-600" />
                          <div className="h-1 w-8 bg-blue-200/60 dark:bg-blue-700/30 rounded-full" />
                        </div>
                        <div className="flex-1 flex gap-1 overflow-hidden">
                          {[0, 1, 2].map((col) => (
                            <div
                              key={col}
                              className="flex-1 bg-white/50 dark:bg-white/5 rounded p-0.5 flex flex-col gap-0.5"
                            >
                              <div
                                className={cn(
                                  'h-0.5 w-3 rounded-full mb-0.5',
                                  col === 0
                                    ? 'bg-blue-300/70'
                                    : col === 1
                                      ? 'bg-amber-300/70'
                                      : 'bg-green-300/70',
                                )}
                              />
                              {Array.from({
                                length: col === 0 ? 3 : col === 1 ? 2 : 1,
                              }).map((_, i) => (
                                <div
                                  key={i}
                                  className="h-2 w-full bg-blue-100/60 dark:bg-blue-800/20 rounded border border-blue-200/30 dark:border-blue-700/20"
                                />
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      /* Fallback */
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-gray-50 dark:bg-gray-800 text-gray-300 dark:text-gray-500">
                        <Icon className="w-4 h-4" />
                        <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">
                          {scene.type}
                        </span>
                      </div>
                    )}

                    {aiPending ? (
                      <div
                        className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1.5 bg-purple-100/55 dark:bg-purple-950/45 backdrop-blur-[2px] pointer-events-none"
                        role="status"
                        aria-live="polite"
                      >
                        <Loader2 className="w-5 h-5 text-purple-600 dark:text-purple-300 animate-spin" />
                        <span className="text-[9px] font-semibold text-purple-700 dark:text-purple-200 px-1.5 text-center leading-tight">
                          {t('aiModify.statusPending')}
                        </span>
                      </div>
                    ) : null}

                    {isSlide && (
                      <div
                        className={cn(
                          'absolute inset-0 bg-purple-500/0 transition-colors',
                          isActive
                            ? 'bg-purple-500/0'
                            : 'group-hover:bg-black/5 dark:group-hover:bg-white/5',
                        )}
                      />
                    )}
                  </div>
                </div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-52">
                    <ContextMenuItem
                      onClick={() => duplicateScene(scene.id)}
                      className="gap-2"
                    >
                      <Copy className="size-4 text-gray-500" />
                      <span>{t('sceneActions.contextMenu.copy')}</span>
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => handlePasteAfter(index)}
                      disabled={!sceneClipboard}
                      className="gap-2"
                    >
                      <ClipboardPaste className="size-4 text-gray-500" />
                      <span>{t('sceneActions.contextMenu.paste')}</span>
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={() => setAiDialogIndex(index + 1)}
                      className="gap-2"
                    >
                      <Sparkles className="size-4 text-purple-500" />
                      <span>{t('sceneActions.contextMenu.aiAdd')}</span>
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => handleInsertBlankAfter(index)}
                      className="gap-2"
                    >
                      <FilePlus2 className="size-4 text-gray-500" />
                      <span>{t('sceneActions.contextMenu.addBlank')}</span>
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={() => setPendingDeleteId(scene.id)}
                      variant="destructive"
                      className="gap-2"
                    >
                      <Trash2 className="size-4" />
                      <span>{t('sceneActions.contextMenu.delete')}</span>
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>

                {/* Drop indicator: thin purple bar below tile */}
                {showDropLineBelow && (
                  <div
                    aria-hidden
                    className="absolute -bottom-1 left-1 right-1 h-0.5 rounded-full bg-purple-500 dark:bg-purple-400 shadow-[0_0_6px_rgba(168,85,247,0.6)] pointer-events-none z-20"
                  />
                )}

                {/* Insert-slot below this scene → inserts at index+1.
                    Hidden during a drag so the slot isn't competing with the
                    drop indicator for the same gap. */}
                {!readOnly && draggingIndex === null && (
                  <AddScenePopover variant="slot" insertIndex={index + 1} />
                )}
              </div>
            );
          })}

          {/* Single placeholder for the next generating page (clickable) */}
          {generatingOutlines.length > 0 &&
            (() => {
              const outline = generatingOutlines[0];
              const isFailed = failedOutlines.some((f) => f.id === outline.id);
              const isRetrying = retryingOutlineId === outline.id;
              const isPaused = generationStatus === 'paused';
              const isActive = currentSceneId === PENDING_SCENE_ID;

              return (
                <div
                  key={`generating-${outline.id}`}
                  onClick={() => {
                    if (isFailed) return;
                    if (onSceneSelect) {
                      onSceneSelect(PENDING_SCENE_ID);
                    } else {
                      setCurrentSceneId(PENDING_SCENE_ID);
                    }
                  }}
                  className={cn(
                    'group relative rounded-lg flex flex-col gap-1 p-1.5 transition-all duration-200',
                    isFailed
                      ? 'opacity-100 cursor-default'
                      : 'cursor-pointer hover:bg-gray-50/80 dark:hover:bg-gray-800/50',
                    !isFailed && !isActive && 'opacity-60',
                    isActive &&
                      !isFailed &&
                      'bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-200 dark:ring-purple-700 opacity-100',
                  )}
                >
                  {/* Scene Header */}
                  <div className="flex justify-between items-center px-2 pt-0.5">
                    <div className="flex items-center gap-2 max-w-full">
                      <span
                        className={cn(
                          'text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shrink-0',
                          isActive && !isFailed
                            ? 'bg-purple-600 dark:bg-purple-500 text-white shadow-sm shadow-purple-500/30'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500',
                        )}
                      >
                        {scenes.length + 1}
                      </span>
                      <span
                        className={cn(
                          'text-xs font-bold truncate transition-colors',
                          isActive && !isFailed
                            ? 'text-purple-700 dark:text-purple-300'
                            : isFailed
                              ? 'text-gray-700 dark:text-gray-200'
                              : 'text-gray-400 dark:text-gray-500',
                        )}
                      >
                        {outline.title}
                      </span>
                    </div>
                  </div>

                  {/* Skeleton Thumbnail */}
                  <div
                    className={cn(
                      'relative aspect-video w-full rounded overflow-hidden ring-1',
                      isFailed
                        ? 'bg-red-50/30 dark:bg-red-950/10 ring-red-100 dark:ring-red-900/20'
                        : 'bg-gray-100 dark:bg-gray-800 ring-black/5 dark:ring-white/5',
                    )}
                  >
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                      {isFailed ? (
                        <div className="flex items-center gap-1 text-xs font-medium text-red-500/90 dark:text-red-400">
                          {onRetryOutline ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRetryOutline(outline.id);
                              }}
                              disabled={isRetrying}
                              className="p-1 -ml-1 rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                              title={t('generation.retryScene')}
                            >
                              <RefreshCw
                                className={cn('w-3.5 h-3.5', isRetrying && 'animate-spin')}
                              />
                            </button>
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {isRetrying
                              ? t('generation.retryingScene')
                              : t('stage.generationFailed')}
                          </span>
                        </div>
                      ) : (
                        <>
                          <div
                            className={cn(
                              'h-2 w-3/5 bg-gray-200 dark:bg-gray-700 rounded',
                              !isPaused && 'animate-pulse',
                            )}
                          />
                          <div
                            className={cn(
                              'h-1.5 w-2/5 bg-gray-200 dark:bg-gray-700 rounded',
                              !isPaused && 'animate-pulse',
                            )}
                          />
                          <span className="text-[9px] font-medium text-gray-400 dark:text-gray-500 mt-0.5">
                            {isPaused ? t('stage.paused') : t('stage.generating')}
                          </span>
                        </>
                      )}
                    </div>
                    {!isFailed && !isPaused && (
                      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent" />
                    )}
                  </div>
                </div>
              );
            })()}

          {/* Course-complete placeholder (shown when outline is exhausted) */}
          {isCourseComplete &&
            generatingOutlines.length === 0 &&
            (() => {
              const isActive = currentSceneId === PENDING_SCENE_ID;
              return (
                <div
                  key="course-complete-slot"
                  onClick={() => {
                    if (onSceneSelect) {
                      onSceneSelect(PENDING_SCENE_ID);
                    } else {
                      setCurrentSceneId(PENDING_SCENE_ID);
                    }
                  }}
                  className={cn(
                    'group relative rounded-lg flex flex-col gap-1 p-1.5 transition-all duration-200 cursor-pointer hover:bg-amber-50/60 dark:hover:bg-amber-900/10',
                    !isActive && 'opacity-80',
                    isActive &&
                      'bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-700 opacity-100',
                  )}
                >
                  <div className="flex justify-between items-center px-2 pt-0.5">
                    <div className="flex items-center gap-2 max-w-full">
                      <span
                        className={cn(
                          'text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shrink-0',
                          isActive
                            ? 'bg-amber-500 dark:bg-amber-400 text-white shadow-sm shadow-amber-500/30'
                            : 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400',
                        )}
                      >
                        {scenes.length + 1}
                      </span>
                      <span
                        className={cn(
                          'text-xs font-bold truncate transition-colors',
                          isActive
                            ? 'text-amber-700 dark:text-amber-300'
                            : 'text-amber-600 dark:text-amber-400',
                        )}
                      >
                        {t('stage.courseComplete')}
                      </span>
                    </div>
                  </div>
                  <div
                    className={cn(
                      'relative aspect-video w-full rounded overflow-hidden ring-1 flex items-center justify-center transition-all',
                      'bg-amber-50/80 dark:bg-amber-950/20',
                      isActive
                        ? 'ring-amber-300 dark:ring-amber-700'
                        : 'ring-amber-100 dark:ring-amber-900/40',
                    )}
                  >
                    {/* soft radial glow */}
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          'radial-gradient(circle at 50% 55%, rgba(251, 191, 36, 0.14), transparent 65%)',
                      }}
                    />
                    {/* sparkles (subtle) */}
                    <svg
                      viewBox="0 0 20 20"
                      className="absolute top-1 right-1.5 w-1.5 h-1.5 text-amber-300/70 dark:text-amber-400/60"
                      aria-hidden
                    >
                      <path
                        d="M10 1 L12 8 L19 10 L12 12 L10 19 L8 12 L1 10 L8 8 Z"
                        fill="currentColor"
                      />
                    </svg>
                    <svg
                      viewBox="0 0 20 20"
                      className="absolute bottom-1 left-1.5 w-1 h-1 text-amber-300/60 dark:text-amber-400/50"
                      aria-hidden
                    >
                      <path
                        d="M10 1 L12 8 L19 10 L12 12 L10 19 L8 12 L1 10 L8 8 Z"
                        fill="currentColor"
                      />
                    </svg>
                    <Trophy
                      className="relative w-8 h-8 text-amber-500 dark:text-amber-400"
                      strokeWidth={1.6}
                    />
                  </div>
                </div>
              );
            })()}
        </div>

      </div>

      {!readOnly ? (
        <div className="shrink-0 border-t border-gray-100 bg-white/85 px-2 py-2 dark:border-gray-800 dark:bg-slate-900/85">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  'relative flex h-10 w-full items-center justify-center rounded-lg transition-colors',
                  deletedScenes.length > 0
                    ? 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800/60 dark:text-gray-300 dark:hover:bg-gray-800'
                    : 'bg-gray-50/60 text-gray-300 dark:bg-gray-800/30 dark:text-gray-600',
                )}
                title="回收站"
                aria-label="回收站"
              >
                <Trash2 className="size-4" />
                {deletedScenes.length > 0 ? (
                  <span className="absolute right-2 top-2 size-1.5 rounded-full bg-violet-500" />
                ) : null}
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="right"
              align="end"
              sideOffset={8}
              className="w-80 rounded-xl border-gray-100 p-0 shadow-xl dark:border-gray-800"
            >
              <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">回收站</h3>
                <p className="mt-0.5 text-xs text-gray-400">已删除页面可在这里恢复</p>
              </div>
              <div className="max-h-80 overflow-y-auto py-1">
                {deletedScenes.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-400">
                    暂无已删除页面
                  </div>
                ) : (
                  deletedScenes.map((scene) => (
                    <div
                      key={scene.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                        <BookOpen className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                          {scene.title}
                        </div>
                        <div className="mt-0.5 text-xs text-gray-400">已删除页面</div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                            aria-label="更多操作"
                            title="更多"
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32">
                          <DropdownMenuItem onClick={() => restoreScene(scene.id)}>
                            <RotateCcw className="size-4" />
                            <span>恢复</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => purgeDeletedScene(scene.id)}
                          >
                            <Trash2 className="size-4" />
                            <span>彻底删除</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      ) : null}

      {/* Sidebar-owned AI generate dialog: opened from the right-click menu's
          "AI 新增幻灯片" item. Inline "+" slots own their own AI dialog
          instances, but the right-click menu needs an independently-pinned
          insertIndex hence its own controller here. */}
      <AIGenerateSceneDialog
        open={aiDialogIndex !== null}
        onOpenChange={(open) => {
          if (!open) setAiDialogIndex(null);
        }}
        insertIndex={aiDialogIndex ?? undefined}
      />

      <Dialog
        open={aiOptimizeSceneId !== null}
        onOpenChange={(open) => {
          if (!open) setAiOptimizeSceneId(null);
        }}
      >
        <DialogContent
          showCloseButton
          className={cn(
            'sm:max-w-lg !p-0 !gap-0 overflow-hidden border-0',
            'rounded-2xl shadow-xl shadow-black/[0.06] dark:shadow-black/30 ring-1 ring-black/[0.03]',
          )}
        >
          <VisuallyHidden.Root>
            <DialogTitle>{t('sceneActions.aiOptimizeDialogTitle')}</DialogTitle>
          </VisuallyHidden.Root>
          {aiOptimizeSceneId ? (
            <AIModifyPanel
              sceneId={aiOptimizeSceneId}
              onClose={() => setAiOptimizeSceneId(null)}
              layout="embedded"
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!pendingDeleteId}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <AlertDialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden border-0 shadow-[0_25px_60px_-12px_rgba(0,0,0,0.15)] dark:shadow-[0_25px_60px_-12px_rgba(0,0,0,0.5)]">
          <VisuallyHidden.Root>
            <AlertDialogTitle>{t('sceneActions.confirmDeleteTitle')}</AlertDialogTitle>
          </VisuallyHidden.Root>
          <div className="h-1 bg-gradient-to-r from-rose-400 via-red-400 to-pink-400" />
          <div className="px-6 pt-5 pb-2 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center mb-4 ring-1 ring-rose-200/50 dark:ring-rose-700/30">
              <AlertTriangle className="w-6 h-6 text-rose-500 dark:text-rose-400" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1.5">
              {t('sceneActions.confirmDeleteTitle')}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              {t('sceneActions.confirmDeleteMessage', {
                title: pendingDeleteScene?.title || '',
              })}
            </p>
          </div>
          <AlertDialogFooter className="px-6 pb-5 pt-3 flex-row gap-3">
            <AlertDialogCancel
              onClick={() => setPendingDeleteId(null)}
              className="flex-1 rounded-xl"
            >
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="flex-1 rounded-xl bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 text-white border-0 shadow-md shadow-rose-200/50 dark:shadow-rose-900/30"
            >
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
