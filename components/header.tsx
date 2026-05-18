'use client';

import {
  ArrowLeft,
  Loader2,
  Download,
  FileDown,
  Package,
  Archive,
  Captions,
  CaptionsOff,
  Pencil,
  Play,
} from 'lucide-react';
import {
  SlideEditHistoryButtons,
  SlideEditInsertToolbar,
} from '@/components/slide-renderer/Editor/slide-edit-insert-toolbar';
import { Separator } from '@/components/ui/separator';
import { SceneProvider } from '@/lib/contexts/scene-context';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useStageStore } from '@/lib/store/stage';
import { useSettingsStore } from '@/lib/store/settings';
import { useMediaGenerationStore } from '@/lib/store/media-generation';
import { useExportPPTX } from '@/lib/export/use-export-pptx';
import { useExportClassroom } from '@/lib/export/use-export-classroom';
import { DevicePreviewTabs } from './preview/device-preview-tabs';
import { PublishButton } from './publish/publish-button';
import { EditModeToggleButton } from '@/components/canvas/edit-mode-toggle-button';
import { SceneVersionHistoryButton } from '@/components/scene-version-history-panel';
import { useSceneVersionAutosave } from '@/lib/hooks/use-scene-version-autosave';

interface HeaderProps {
  /** AI-summarised course / classroom name (stage.name), editable in the header. */
  readonly classroomTitle: string;
  /**
   * When true, hide the centre device-preview tab group. Used by the in-frame
   * Header inside mobile / iPad preview mode so the tabs aren't duplicated
   * (the publisher switches device from the page-level tab strip outside the
   * frame).
   */
  readonly hideDeviceTabs?: boolean;
  /**
   * When true, hide all publisher-only actions (publish, export). Used by the
   * mobile / iPad preview frames so the in-frame chrome shows ONLY what an end
   * student would see — the publisher edits exclusively from the web view.
   */
  readonly readOnly?: boolean;
  /**
   * Publisher (ToB) lean editor view flag. When true the page hides the
   * right ChatArea panel + the bottom Roundtable, and the header swaps the
   * existing "进入编辑" affordance for a single "预览" button. When false the
   * publisher sees the full webpage version (chat + roundtable + AI teacher
   * dialogue) and a "返回编辑" button is offered to come back.
   */
  readonly publisherEditView?: boolean;
  readonly onTogglePublisherEditView?: () => void;
  /** Slide insert tools (text / image / video / …) in the top bar centre. */
  readonly showSlideInsertTools?: boolean;
}

export function Header({
  classroomTitle,
  hideDeviceTabs = false,
  readOnly = false,
  publisherEditView = false,
  onTogglePublisherEditView,
  showSlideInsertTools = false,
}: HeaderProps) {
  const { t } = useI18n();
  const router = useRouter();
  const stage = useStageStore((s) => s.stage);
  const currentSceneId = useStageStore((s) => s.currentSceneId);
  const patchStage = useStageStore((s) => s.patchStage);
  const versionSaveStatus = useSceneVersionAutosave(
    currentSceneId,
    !readOnly && showSlideInsertTools,
  );
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleEditable = publisherEditView && !readOnly && !!stage;

  useEffect(() => {
    const node = titleRef.current;
    if (!node) return;
    if (document.activeElement === node) return;
    const next = classroomTitle || '';
    if (node.textContent !== next) {
      node.textContent = next;
    }
  }, [classroomTitle, stage?.id]);

  const commitTitle = useCallback(() => {
    if (!stage) return;
    const node = titleRef.current;
    if (!node) return;
    const next = (node.textContent || '').trim();
    if (!next) {
      node.textContent = classroomTitle || '';
      return;
    }
    if (next !== classroomTitle) {
      patchStage({ name: next });
    }
  }, [stage, classroomTitle, patchStage]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLHeadingElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        titleRef.current?.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        const node = titleRef.current;
        if (node) node.textContent = classroomTitle || '';
        node?.blur();
      }
    },
    [classroomTitle],
  );

  const handleTitlePaste = useCallback((e: React.ClipboardEvent<HTMLHeadingElement>) => {
    e.preventDefault();
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

  // Export
  const { exporting: isExporting, exportPPTX, exportResourcePack } = useExportPPTX();
  const { exporting: isExportingZip, exportClassroomZip } = useExportClassroom();
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const scenes = useStageStore((s) => s.scenes);
  const generatingOutlines = useStageStore((s) => s.generatingOutlines);
  const failedOutlines = useStageStore((s) => s.failedOutlines);
  const mediaTasks = useMediaGenerationStore((s) => s.tasks);
  const teacherSubtitlesVisible = useSettingsStore((s) => s.teacherSubtitlesVisible);
  const setTeacherSubtitlesVisible = useSettingsStore((s) => s.setTeacherSubtitlesVisible);

  const canExport =
    scenes.length > 0 &&
    generatingOutlines.length === 0 &&
    failedOutlines.length === 0 &&
    Object.values(mediaTasks).every((task) => task.status === 'done' || task.status === 'failed');

  // Close dropdown when clicking outside
  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (exportMenuOpen && exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    },
    [exportMenuOpen],
  );

  // Build the publisher edit-view toggle button outside the JSX tree to
  // keep the render template free of nested ternaries (sonarqube rule).
  let editViewToggle: React.ReactNode;
  if (!onTogglePublisherEditView) {
    editViewToggle = <EditModeToggleButton variant="header" />;
  } else if (publisherEditView) {
    editViewToggle = (
      <button
        type="button"
        onClick={onTogglePublisherEditView}
        className={cn(
          'shrink-0 p-2 rounded-full transition-all cursor-pointer',
          'text-violet-600 bg-violet-50 ring-1 ring-violet-100 hover:bg-violet-100',
          'dark:text-violet-300 dark:bg-violet-950/40 dark:ring-violet-800/60 dark:hover:bg-violet-900/50',
        )}
        title="预览完整网页版（含 AI 老师对话）"
        aria-label="预览"
      >
        <Play className="w-4 h-4 fill-current" strokeWidth={0} />
      </button>
    );
  } else {
    editViewToggle = (
      <button
        type="button"
        onClick={onTogglePublisherEditView}
        className={cn(
          'shrink-0 p-2 rounded-full transition-all cursor-pointer',
          'text-gray-500 hover:bg-white hover:text-gray-700 hover:shadow-sm',
          'dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200',
        )}
        title="返回编辑视图"
        aria-label="返回编辑"
      >
        <Pencil className="w-4 h-4" strokeWidth={2.5} />
      </button>
    );
  }

  useEffect(() => {
    if (exportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [exportMenuOpen, handleClickOutside]);

  const showPublisherChrome = !!onTogglePublisherEditView;

  return (
    <header
      className={cn(
        'shrink-0 px-3 flex items-center gap-2 z-20 border-b border-gray-200/80 dark:border-gray-800/80',
        'bg-white/95 dark:bg-gray-950/95 backdrop-blur-md shadow-[0_1px_0_rgba(0,0,0,0.04)]',
        showSlideInsertTools ? 'min-h-14 py-1' : 'h-14',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 min-w-0',
          showSlideInsertTools ? 'shrink-0 max-w-[min(40%,320px)]' : 'flex-1',
        )}
      >
        <button
          onClick={() => router.push('/')}
          className="shrink-0 p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          title={t('generation.backToHome')}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        {titleEditable ? (
          <h1
            ref={titleRef}
            className={cn(
              'text-base font-semibold text-gray-800 dark:text-gray-200 tracking-tight truncate min-w-0 flex-1',
              'outline-none rounded-md px-1 -mx-1 cursor-text',
              'hover:bg-gray-100/70 dark:hover:bg-gray-800/70',
              'focus:bg-white dark:focus:bg-gray-900',
              'focus:ring-2 focus:ring-purple-300/60 dark:focus:ring-purple-500/40',
              'transition-colors',
            )}
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            aria-label="编辑课堂标题"
            title="点击直接修改课堂标题（回车确认，Esc 取消）"
            onBlur={commitTitle}
            onKeyDown={handleTitleKeyDown}
            onPaste={handleTitlePaste}
            suppressHydrationWarning
          >
            {classroomTitle || t('common.loading')}
          </h1>
        ) : (
          <h1
            className="text-base font-semibold text-gray-800 dark:text-gray-200 tracking-tight truncate min-w-0 flex-1"
            title={classroomTitle}
            suppressHydrationWarning
          >
            {classroomTitle || t('common.loading')}
          </h1>
        )}
        {showSlideInsertTools && (
          <>
            <Separator
              orientation="vertical"
              className="h-9 mx-0.5 shrink-0 bg-gray-200/90 dark:bg-gray-700/80"
            />
            <SlideEditHistoryButtons placement="title" />
            <SceneVersionHistoryButton
              sceneId={currentSceneId}
              saveStatus={versionSaveStatus}
            />
          </>
        )}
      </div>

      {/* Centre: insert tools (AIppt / Synthesia style) */}
      {showSlideInsertTools && (
        <div className="flex-1 flex items-center justify-center min-w-0 overflow-x-auto px-1">
          <SceneProvider>
            <SlideEditInsertToolbar variant="header" />
          </SceneProvider>
        </div>
      )}

      <div
        className={cn(
          'flex items-center justify-end gap-1.5 min-w-0',
          showSlideInsertTools ? 'shrink-0' : 'flex-1',
        )}
      >
        {!readOnly && (
          <>
            {showPublisherChrome && editViewToggle}
            <button
              type="button"
              onClick={() => setTeacherSubtitlesVisible(!teacherSubtitlesVisible)}
              aria-pressed={teacherSubtitlesVisible}
              title={teacherSubtitlesVisible ? '关闭 AI 老师字幕' : '开启 AI 老师字幕'}
              className={cn(
                'shrink-0 p-2 rounded-full transition-all',
                teacherSubtitlesVisible
                  ? 'text-purple-600 bg-purple-50 ring-1 ring-purple-100 hover:bg-purple-100 dark:text-purple-300 dark:bg-purple-950/40 dark:ring-purple-800/60'
                  : 'text-gray-400 hover:bg-white hover:text-gray-700 hover:shadow-sm dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-200',
              )}
            >
              {teacherSubtitlesVisible ? (
                <Captions className="w-4 h-4" />
              ) : (
                <CaptionsOff className="w-4 h-4" />
              )}
            </button>
            {!hideDeviceTabs && <DevicePreviewTabs variant="iconRail" />}
            {/* Publish — compact icon button (hover to reveal "发布"); flush
                left of the Download icon so the two share a single visual rail. */}
            <PublishButton
              disabled={!canExport}
              disabledReason={canExport ? undefined : t('share.notReady')}
            />

            {/* Export Dropdown */}
            <div className="relative" ref={exportRef}>
              <button
                onClick={() => {
                  if (canExport && !isExporting && !isExportingZip)
                    setExportMenuOpen(!exportMenuOpen);
                }}
                disabled={!canExport || isExporting || isExportingZip}
                title={
                  canExport
                    ? isExporting || isExportingZip
                      ? t('export.exporting')
                      : t('export.pptx')
                    : t('share.notReady')
                }
                className={cn(
                  'shrink-0 p-2 rounded-full transition-all',
                  canExport && !isExporting && !isExportingZip
                    ? 'text-gray-400 dark:text-gray-500 hover:bg-white dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 hover:shadow-sm'
                    : 'text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-50',
                )}
              >
                {isExporting || isExportingZip ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </button>
              {exportMenuOpen && (
                <div className="absolute top-full mt-2 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden z-50 min-w-[200px]">
                  <button
                    onClick={() => {
                      setExportMenuOpen(false);
                      exportPPTX();
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2.5"
                  >
                    <FileDown className="w-4 h-4 text-gray-400 shrink-0" />
                    <span>{t('export.pptx')}</span>
                  </button>
                  <button
                    onClick={() => {
                      setExportMenuOpen(false);
                      exportResourcePack();
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2.5"
                  >
                    <Package className="w-4 h-4 text-gray-400 shrink-0" />
                    <div>
                      <div>{t('export.resourcePack')}</div>
                      <div className="text-[11px] text-gray-400 dark:text-gray-500">
                        {t('export.resourcePackDesc')}
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setExportMenuOpen(false);
                      exportClassroomZip();
                    }}
                    disabled={isExportingZip}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2.5"
                  >
                    <Archive className="w-4 h-4 text-gray-400 shrink-0" />
                    <div>
                      <div>{t('export.classroomZip')}</div>
                      <div className="text-[11px] text-gray-400 dark:text-gray-500">
                        {t('export.classroomZipDesc')}
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
