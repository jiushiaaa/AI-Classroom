'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Code2,
  Download,
  Eye,
  FileText,
  ImageIcon,
  Maximize2,
  Monitor,
  PenLine,
  Play,
  Presentation,
  Rocket,
  RotateCw,
  Smartphone,
  Tablet,
  Volume2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const scenes = [
  {
    id: 1,
    title: '欢迎',
    type: '封面页',
    note: '欢迎来到云梯 AI 课堂的演示页面。在这里你将依次体验文字、图片、图表、视频、形状、公式、测验、互动模拟、项目协作的完整编辑能力。左侧是课堂大纲，右侧是讲解笔记，你可以随时点击修改本页的讲稿内容。',
    thumbnail: 'cover',
  },
  {
    id: 2,
    title: '图文混排',
    type: '知识讲解',
    note: '我们先来看可再生能源的整体格局。左侧这张图展示的是大型集中式光伏电站，是目前装机增量最大的可再生能源。',
    thumbnail: 'image',
  },
  {
    id: 3,
    title: '数据可视化',
    type: '图表页',
    note: '从这张柱状图可以清晰看到近五年的装机趋势。太阳能在 2024 年实现了跳跃式增长，几乎是 2020 年的三倍以上。',
    thumbnail: 'chart',
  },
  {
    id: 4,
    title: '形状与流程图',
    type: '流程页',
    note: '现在我们看一下整套课堂的工作流。从原始图书上传到 AI 解析，再到出版商精修，最后学生扫码进入课堂，一共四步。',
    thumbnail: 'flow',
  },
  {
    id: 5,
    title: '视频讲解',
    type: '视频页',
    note: '这一页可以承载一段视频素材，也可以由 AI 根据教材内容自动生成讲解视频，用于替代传统真人录播。',
    thumbnail: 'video',
  },
  {
    id: 6,
    title: '公式与代码',
    type: '公式页',
    note: '公式和代码内容在编辑态中保持可校对、可替换，避免生成后的复杂内容只能被动查看。',
    thumbnail: 'code',
  },
];

const insertTools = [
  { label: '文字', icon: FileText, color: 'text-violet-600' },
  { label: '图片', icon: ImageIcon, color: 'text-emerald-600' },
  { label: '图表', icon: Presentation, color: 'text-sky-600' },
  { label: '视频', icon: Monitor, color: 'text-indigo-600' },
  { label: '题目', icon: PenLine, color: 'text-orange-500' },
  { label: 'AI 调优', icon: Rocket, color: 'text-violet-600' },
];

export default function EditorPreviewLabPage() {
  const [activeSceneId, setActiveSceneId] = useState(1);
  const [previewOpen, setPreviewOpen] = useState(false);
  const activeScene = scenes.find((scene) => scene.id === activeSceneId) ?? scenes[0];

  return (
    <main className="h-screen overflow-hidden bg-[#f7f8fb] text-slate-900">
      <div className="grid h-full grid-cols-[262px_minmax(0,1fr)_400px]">
        <SceneSidebar activeSceneId={activeSceneId} onSelect={setActiveSceneId} />

        <section className="flex min-w-0 flex-col border-x border-slate-100">
          <header className="flex h-[104px] shrink-0 items-center bg-[#fbfcff] px-10">
            <Button size="icon-sm" variant="ghost" aria-label="返回">
              <ArrowLeft className="size-5 text-slate-400" />
            </Button>

            <div className="ml-5">
              <div className="text-sm font-semibold text-slate-400">当前场景</div>
              <h1 className="text-2xl font-bold leading-tight text-slate-950">{activeScene.title}</h1>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <Button
                className="h-12 rounded-[18px] bg-violet-600 px-6 text-base font-bold shadow-[0_12px_24px_rgba(124,58,237,0.25)] hover:bg-violet-700"
                onClick={() => setPreviewOpen(true)}
              >
                <Eye className="size-5" />
                预览
              </Button>
              <ToolbarIcon active icon={BookOpen} label="笔记视图" />
              <ToolbarIcon active icon={Monitor} label="桌面预览" />
              <ToolbarIcon icon={Smartphone} label="手机" />
              <ToolbarIcon icon={Tablet} label="平板" />
              <ToolbarIcon icon={Rocket} label="生成" />
              <ToolbarIcon icon={Download} label="下载" />
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-hidden px-3 pb-3">
            <div className="flex h-full flex-col rounded-t-2xl border border-slate-100 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.04)]">
              <div className="flex min-h-0 flex-1 items-center justify-center px-16 py-10">
                <SlideCanvas scene={activeScene} />
              </div>

              <div className="h-[232px] shrink-0 border-t border-slate-100 bg-white">
                <PlaybackStrip />
                <EditorBottomPanel />
              </div>
            </div>
          </div>
        </section>

        <NotesPanel activeSceneId={activeSceneId} />
      </div>

      {previewOpen ? <PreviewOverlay onClose={() => setPreviewOpen(false)} /> : null}
    </main>
  );
}

function SceneSidebar({
  activeSceneId,
  onSelect,
}: {
  activeSceneId: number;
  onSelect: (id: number) => void;
}) {
  return (
    <aside className="flex min-h-0 flex-col bg-white">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 pb-8 pt-4">
        {scenes.map((scene) => (
          <button
            key={scene.id}
            type="button"
            onClick={() => onSelect(scene.id)}
            className={cn(
              'block w-full rounded-xl border bg-white p-2 text-left transition',
              activeSceneId === scene.id
                ? 'border-violet-200 bg-violet-50/30 shadow-[0_10px_24px_rgba(124,58,237,0.08)]'
                : 'border-transparent hover:border-slate-100',
            )}
          >
            <div className="mb-2 flex items-center gap-2 px-1">
              <span
                className={cn(
                  'flex size-5 items-center justify-center rounded-full text-xs font-bold',
                  activeSceneId === scene.id
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-200 text-slate-500',
                )}
              >
                {scene.id}
              </span>
              <span
                className={cn(
                  'truncate text-sm font-bold',
                  activeSceneId === scene.id ? 'text-violet-700' : 'text-slate-700',
                )}
              >
                {scene.title}
              </span>
            </div>
            <div className="rounded-md border border-slate-100 bg-white p-2">
              <Thumbnail kind={scene.thumbnail} />
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}

function Thumbnail({ kind }: { kind: string }) {
  if (kind === 'image') {
    return (
      <div className="aspect-video rounded bg-slate-50 p-3">
        <div className="grid h-full grid-cols-[1.2fr_0.8fr] gap-3">
          <div className="rounded bg-[linear-gradient(135deg,#111827,#f8fafc)]" />
          <div className="space-y-1.5 pt-1">
            <div className="h-1.5 w-12 rounded bg-slate-400" />
            <div className="h-1.5 w-16 rounded bg-slate-200" />
            <div className="h-1.5 w-10 rounded bg-violet-300" />
          </div>
        </div>
      </div>
    );
  }

  if (kind === 'chart') {
    return (
      <div className="aspect-video rounded bg-slate-50 px-6 py-4">
        {[80, 64, 52, 38].map((width, index) => (
          <div key={width} className="mb-2 flex items-center gap-2">
            <div className="h-1.5 w-8 rounded bg-slate-200" />
            <div
              className={cn('h-2 rounded', index === 0 ? 'bg-violet-600' : 'bg-violet-300')}
              style={{ width }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (kind === 'flow') {
    return (
      <div className="aspect-video rounded bg-slate-50 p-4">
        <div className="flex h-full items-center gap-1">
          {['bg-violet-100', 'bg-sky-100', 'bg-emerald-100', 'bg-amber-100'].map((color) => (
            <div key={color} className={cn('h-10 flex-1 rounded border border-slate-200', color)} />
          ))}
        </div>
      </div>
    );
  }

  if (kind === 'video') {
    return (
      <div className="relative aspect-video overflow-hidden rounded bg-[linear-gradient(135deg,#d9f99d,#fef3c7)]">
        <div className="absolute inset-x-4 bottom-4 h-2 rounded-full bg-white/80" />
        <div className="absolute left-1/2 top-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-violet-700">
          <Play className="size-4 fill-current" />
        </div>
      </div>
    );
  }

  if (kind === 'code') {
    return (
      <div className="aspect-video rounded bg-white p-5">
        <Code2 className="mb-3 size-5 text-violet-600" />
        <div className="h-1.5 w-24 rounded bg-violet-300" />
      </div>
    );
  }

  return (
    <div className="aspect-video rounded bg-white px-6 py-5">
      <div className="mb-10 h-1.5 w-24 rounded bg-slate-300" />
      <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-violet-600">
        文字 · 图片 · 图表 · 视频 · 题目 · AI 调优
      </div>
    </div>
  );
}

function ToolbarIcon({
  icon: Icon,
  active,
  label,
}: {
  icon: typeof BookOpen;
  active?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'flex size-11 items-center justify-center rounded-full text-slate-400 transition',
        active ? 'bg-violet-50 text-violet-600 shadow-sm' : 'hover:bg-slate-100 hover:text-slate-600',
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}

function SlideCanvas({ scene }: { scene: (typeof scenes)[number] }) {
  return (
    <div className="relative aspect-[16/9] w-full max-w-[1228px] rounded-xl bg-white shadow-[0_20px_44px_rgba(15,23,42,0.12)]">
      <div className="absolute left-[8%] top-[18%]">
        <h2 className="text-[26px] font-black leading-none text-slate-800">云梯 AI 课堂</h2>
      </div>

      <div className="absolute left-[8%] top-[50%] -translate-y-1/2">
        <p className="max-w-[560px] text-[22px] leading-[1.34] text-slate-600">
          面向出版商的图书伴学课堂演示
          <br />
          本页展示纯文本编辑能力，可在右侧修改讲稿。
        </p>
      </div>

      <div className="absolute bottom-[18%] left-[8%] flex max-w-[430px] flex-wrap items-center gap-x-3 gap-y-2 text-[17px] font-bold">
        {insertTools.map((tool, index) => {
          const Icon = tool.icon;
          return (
            <div key={tool.label} className="flex items-center gap-2">
              <Icon className={cn('size-5', tool.color)} />
              <span className={tool.color}>{tool.label}</span>
              {index < insertTools.length - 1 ? <span className="text-violet-400">·</span> : null}
            </div>
          );
        })}
      </div>

      <div className="absolute bottom-12 right-12 text-[22px] font-medium text-slate-400">
        第 {scene.id} / 10 页 · 演示数据
      </div>

      <div className="absolute bottom-[-18px] right-[-16px] text-[54px] font-black text-slate-100">
        {String(scene.id).padStart(2, '0')}
      </div>
    </div>
  );
}

function PlaybackStrip() {
  return (
    <div className="flex h-14 items-center border-b border-slate-100 px-8">
      <div className="flex items-center gap-3 text-slate-400">
        <BookOpen className="size-5" />
        <span className="text-sm font-semibold">1 / 11</span>
      </div>

      <div className="mx-auto flex h-10 items-center gap-5 rounded-xl bg-slate-50 px-4 text-slate-500">
        <Volume2 className="size-5" />
        <span className="text-sm font-semibold">1x</span>
        <ChevronLeft className="size-4 text-slate-300" />
        <Play className="size-5" />
        <ChevronRight className="size-4" />
        <RotateCw className="size-4" />
        <PenLine className="size-5" />
      </div>

      <div className="flex items-center gap-4 text-slate-500">
        <Maximize2 className="size-5" />
        <BookOpen className="size-5" />
      </div>
    </div>
  );
}

function EditorBottomPanel() {
  return (
    <div className="flex h-[178px] items-center px-8">
      <div className="w-16 shrink-0 border-r border-slate-100 pr-5">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-300">
          <BookOpen className="size-7" />
        </div>
      </div>

      <div className="ml-8 flex min-w-0 flex-1 items-center">
        <div className="w-full max-w-4xl rounded-[28px] border border-slate-100 bg-white px-8 py-5 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-500">
            <FileText className="size-4 text-violet-500" />
            本页讲解稿
          </div>
          <p className="truncate text-lg text-slate-600">
            欢迎来到云梯 AI 课堂的演示页面。编辑态仅保留讲稿校对与播放预览，不展示 AI 助教、学生角色和输入入口。
          </p>
        </div>
      </div>
    </div>
  );
}

function NotesPanel({ activeSceneId }: { activeSceneId: number }) {
  return (
    <aside className="flex min-h-0 flex-col bg-white px-4">
      <div className="flex h-[76px] shrink-0 items-center border-b border-slate-100">
        <div className="flex flex-1 items-center justify-center gap-2 border-b-2 border-slate-950 pb-4 text-base font-bold text-slate-950">
          <BookOpen className="size-5" />
          笔记
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4">
        {scenes.slice(0, 4).map((scene) => (
          <article
            key={scene.id}
            className={cn(
              'rounded-xl p-6',
              scene.id === activeSceneId
                ? 'border border-violet-100 bg-violet-50'
                : 'bg-slate-50/70 text-slate-500',
            )}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'size-2.5 rounded-full',
                    scene.id === activeSceneId ? 'bg-violet-600' : 'bg-slate-300',
                  )}
                />
                <span
                  className={cn(
                    'text-sm font-bold',
                    scene.id === activeSceneId ? 'text-violet-700' : 'text-slate-400',
                  )}
                >
                  第 {scene.id} 页
                </span>
              </div>
              {scene.id === activeSceneId ? (
                <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-600">
                  当前页
                </span>
              ) : null}
            </div>
            <h3 className="mb-3 text-lg font-bold text-slate-900">{scene.title}</h3>
            <p className="text-[15px] leading-8 text-slate-600">{scene.note}</p>
          </article>
        ))}
      </div>
    </aside>
  );
}

function PreviewOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 p-8 backdrop-blur-sm">
      <div className="flex h-full flex-col rounded-2xl bg-[#f8fafc] shadow-2xl">
        <div className="flex h-16 items-center border-b border-slate-200 bg-white px-6">
          <div>
            <div className="text-xs font-semibold text-slate-400">学生端预览</div>
            <div className="text-lg font-bold">欢迎</div>
          </div>
          <Button className="ml-auto" onClick={onClose}>
            <PenLine className="size-4" />
            返回编辑
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center bg-slate-950 p-10">
          <div className="aspect-video w-full max-w-5xl rounded-xl bg-white p-16">
            <h2 className="text-5xl font-black">云梯 AI 课堂</h2>
            <p className="mt-10 max-w-2xl text-2xl leading-relaxed text-slate-600">
              这里是独立预览态，用于检查发布后的学生体验。编辑态中删除的圆桌对话、语音输入和学生角色，只在预览中验证。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
