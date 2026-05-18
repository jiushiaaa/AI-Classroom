'use client';

import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  HelpCircle,
  History,
  Loader2,
  PenLine,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStageStore } from '@/lib/store/stage';
import { useSettingsStore } from '@/lib/store/settings';
import { useUserProfileStore } from '@/lib/store/user-profile';
import type { SceneVersion } from '@/lib/types/stage';
import type { SceneVersionSaveStatus } from '@/lib/hooks/use-scene-version-autosave';
import { buildSceneVersion, mergeSceneVersion } from '@/lib/utils/scene-version-history';

interface SceneVersionHistoryButtonProps {
  readonly sceneId: string | null;
  readonly saveStatus: SceneVersionSaveStatus;
}

function formatVersionTime(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}

function formatWeekLabel(timestamp: number) {
  const now = Date.now();
  const diff = now - timestamp;
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  if (diff < weekMs) return '本周';
  if (diff < weekMs * 2) return '上周';
  return '更早';
}

function VersionSourceIcon({ source }: { readonly source: SceneVersion['source'] }) {
  if (source === 'ai') return <Sparkles className="size-3.5 text-violet-500" />;
  if (source === 'restore') return <RotateCcw className="size-3.5 text-blue-500" />;
  return <PenLine className="size-3.5 text-fuchsia-600" />;
}

export function SceneVersionHistoryButton({
  sceneId,
  saveStatus,
}: SceneVersionHistoryButtonProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const scene = useStageStore((s) => s.scenes.find((item) => item.id === sceneId));
  const updateScene = useStageStore.use.updateScene();
  const sceneVersionPreview = useStageStore((s) => s.sceneVersionPreview);
  const setSceneVersionPreview = useStageStore.use.setSceneVersionPreview();
  const chatAreaCollapsed = useSettingsStore((s) => s.chatAreaCollapsed);
  const chatAreaWidth = useSettingsStore((s) => s.chatAreaWidth);
  const nickname = useUserProfileStore((s) => s.nickname);
  const panelRight = chatAreaCollapsed ? 0 : chatAreaWidth;

  const versions = useMemo(
    () => [...(scene?.versions ?? [])].sort((a, b) => b.timestamp - a.timestamp),
    [scene?.versions],
  );

  const groupedVersions = useMemo(() => {
    const groups = new Map<string, SceneVersion[]>();
    for (const version of versions) {
      const label = formatWeekLabel(version.timestamp);
      groups.set(label, [...(groups.get(label) ?? []), version]);
    }
    return [...groups.entries()];
  }, [versions]);

  const handleRestore = useCallback(
    (version: SceneVersion) => {
      if (!scene) return;

      const restoreVersion = buildSceneVersion({
        id: `scene-version-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: Date.now(),
        source: 'restore',
        title: version.title,
        content: version.content,
        actions: version.actions,
        summary: `恢复到 ${formatVersionTime(version.timestamp)} 的版本`,
        authorName: nickname.trim() || '少华',
      });

      updateScene(scene.id, {
        title: version.title,
        content: structuredClone(version.content),
        actions: version.actions ? structuredClone(version.actions) : undefined,
        versions: mergeSceneVersion(scene.versions, restoreVersion),
        updatedAt: Date.now(),
      });
      setSceneVersionPreview(null);
    },
    [nickname, scene, setSceneVersionPreview, updateScene],
  );

  const handleClose = useCallback(() => {
    setSceneVersionPreview(null);
    setOpen(false);
  }, [setSceneVersionPreview]);

  const handlePreview = useCallback(
    (version: SceneVersion) => {
      if (!scene) return;
      setSceneVersionPreview({
        sceneId: scene.id,
        versionId: version.id,
        title: version.title,
        content: structuredClone(version.content),
        actions: version.actions ? structuredClone(version.actions) : undefined,
      });
      setExpanded((prev) => ({
        ...prev,
        [version.id]: true,
      }));
    },
    [scene, setSceneVersionPreview],
  );

  const saveStatusNode =
    saveStatus === 'saving' ? (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-400">
        <Loader2 className="size-3 animate-spin" />
        保存中...
      </span>
    ) : saveStatus === 'saved' ? (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-400">
        <CheckCircle2 className="size-3 text-emerald-500" />
        已保存
      </span>
    ) : null;

  return (
    <>
      <div className="flex items-center gap-1.5 shrink-0">
        {saveStatusNode}
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={!sceneId}
          aria-label="历史记录"
          title="历史记录"
          className={cn(
            'relative p-2 rounded-full transition-all',
            sceneId
              ? 'text-gray-400 hover:bg-white hover:text-gray-700 hover:shadow-sm dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-200'
              : 'text-gray-300 cursor-not-allowed',
          )}
        >
          <History className="size-4" />
          {versions.length > 0 ? (
            <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-violet-500" />
          ) : null}
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.aside
            key="scene-version-history-panel"
            initial={{ x: 360, opacity: 0.96 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 360, opacity: 0.96 }}
            transition={{ type: 'spring', stiffness: 360, damping: 34 }}
            className="fixed top-14 z-30 h-[calc(100vh-3.5rem)] w-[320px] bg-white/95 dark:bg-gray-950/95 border-x border-gray-100 dark:border-gray-800 flex flex-col"
            style={{
              right: panelRight,
              maxWidth: `calc(100vw - ${panelRight}px - 24px)`,
            }}
            aria-label="历史记录"
          >
            <div className="h-14 shrink-0 border-b border-gray-100 dark:border-gray-800 px-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  历史记录
                </h2>
                <HelpCircle className="size-3.5 text-gray-400" />
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="关闭历史记录"
                title="关闭"
                className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50/40 dark:bg-gray-950">
              {versions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center px-8 text-center text-sm text-gray-400">
                  <Clock3 className="mb-3 size-7 text-gray-300" />
                  暂无历史记录。手动编辑或 AI 优化后会自动保存版本。
                </div>
              ) : (
                <div className="py-3">
                  {groupedVersions.map(([group, groupVersions]) => (
                    <section key={group}>
                      <div className="px-4 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500">
                        {group}
                      </div>
                      <div className="space-y-2 px-3 pb-2">
                        {groupVersions.map((version, index) => {
                          const latest = index === 0 && group === groupedVersions[0]?.[0];
                          const isExpanded = expanded[version.id] ?? false;
                          const isPreviewing =
                            sceneVersionPreview?.sceneId === scene?.id &&
                            sceneVersionPreview?.versionId === version.id;
                          return (
                            <div
                              key={version.id}
                              className={cn(
                                'overflow-hidden rounded-lg border bg-white shadow-sm transition-colors dark:bg-gray-900',
                                latest
                                  ? 'border-violet-200 bg-violet-50/60 dark:border-violet-800 dark:bg-violet-950/25'
                                  : 'border-gray-100 dark:border-gray-800',
                              )}
                            >
                              <button
                                type="button"
                                onClick={() => handlePreview(version)}
                                className="w-full px-3 py-3 text-left hover:bg-gray-50/80 dark:hover:bg-gray-800/60 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  {isExpanded ? (
                                    <ChevronDown className="size-4 text-gray-400" />
                                  ) : (
                                    <ChevronRight className="size-4 text-gray-400" />
                                  )}
                                  <span className="text-sm font-semibold leading-tight text-gray-900 dark:text-gray-100">
                                    {formatVersionTime(version.timestamp)}
                                  </span>
                                  {latest ? (
                                    <span className="ml-auto rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">
                                      {isPreviewing ? '预览中' : '当前页'}
                                    </span>
                                  ) : isPreviewing ? (
                                    <span className="ml-auto rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                                      预览中
                                    </span>
                                  ) : null}
                                </div>
                                {latest ? (
                                  <div className="ml-6 mt-1 text-[11px] font-medium text-violet-500">
                                    最近更新
                                  </div>
                                ) : null}
                                <div className="ml-6 mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                  <VersionSourceIcon source={version.source} />
                                  <span>
                                    {version.source === 'ai'
                                      ? 'AI 优化'
                                      : version.source === 'restore'
                                        ? '恢复版本'
                                        : '手动修改'}
                                  </span>
                                </div>
                              </button>
                              {isExpanded ? (
                                <div className="px-9 pb-3">
                                  <button
                                    type="button"
                                    onClick={() => handleRestore(version)}
                                    className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800 active:scale-95 transition dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                                  >
                                    <RotateCcw className="size-3.5" />
                                    确认加载此版本
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>

          </motion.aside>
        ) : null}
      </AnimatePresence>
    </>
  );
}
