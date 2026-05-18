// Stage and Scene data types
import type { Slide } from '@/lib/types/slides';
import type { Action } from '@/lib/types/action';
import type { PBLProjectConfig } from '@/lib/pbl/types';
import type { WidgetType, WidgetConfig, TeacherAction } from '@/lib/types/widgets';
import type { AICommand } from '@/lib/types/ai-command';

export type SceneType = 'slide' | 'quiz' | 'interactive' | 'pbl';

export type StageMode = 'autonomous' | 'playback';

/**
 * Whether a scene type supports the in-canvas "manual edit" mode (the
 * Pencil / 进入编辑 button in the header & canvas toolbar).
 *
 * Only the PPTist slide canvas is editable by hand — `quiz` (测试题),
 * `interactive` (模拟实验 / 在线编程 / 思维导图 / 3D / game widgets) and
 * `pbl` (项目挑战) all have generated structures that are impractical for
 * the publisher to tweak manually, so they rely on the per-scene
 * "AI 单页助手" / "AI 调优" flow instead of inline editing.
 */
export function isManuallyEditableSceneType(type: SceneType | undefined): boolean {
  return type === 'slide';
}

export type Whiteboard = Omit<Slide, 'theme' | 'turningMode' | 'sectionTag' | 'type'>;

/**
 * Stage - Represents the entire classroom/course
 */
export interface Stage {
  id: string;
  name: string;
  /**
   * AI-polished title (≤10 graphemes) for the course-completion screen.
   * Optional; when absent the client may generate once and persist.
   */
  completionTitleShort?: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  // Stage metadata
  languageDirective?: string;
  style?: string;
  // Whiteboard data
  whiteboard?: Whiteboard[];
  // Agent IDs selected when this classroom was created
  agentIds?: string[];
  /**
   * Server-generated agent configurations.
   * Embedded in persisted classroom JSON so clients can hydrate
   * the agent registry without relying on IndexedDB pre-population.
   * Only present for API-generated classrooms.
   */
  generatedAgentConfigs?: Array<{
    id: string;
    name: string;
    role: string;
    persona: string;
    avatar: string;
    color: string;
    priority: number;
  }>;
  /**
   * True when this classroom was generated with Interactive Mode enabled
   * (the INTERACTIVE_OUTLINES prompt branch).
   * Absent on legacy classrooms, imports, and regular-mode generations.
   */
  interactiveMode?: boolean;
  /**
   * Book this classroom is bound to on the 书链 (bookln.cn) B-end platform.
   * Set when the publisher started from a book in the home book picker (or
   * uploaded a PDF that was registered as a book on bookln). The publish
   * flow reads this to (a) show "已与《XXX》绑定" in the dialog and (b)
   * deep-link to the matching entry on bookln's AI 智能书 list page so
   * the publisher can finalise the QR code there.
   *
   * Pure-frontend demo: hardcoded on the bundled demo classroom. Real
   * generation pipelines should populate this when persisting the stage.
   */
  boundBook?: {
    /** bookln-side book id (or our internal mock id, fine for the demo). */
    id: string;
    title: string;
    /** Optional subject tag to render as a chip alongside the title. */
    subject?: string;
    /** Tailwind gradient classes for a placeholder cover. */
    coverGradient?: string;
    /** Emoji rendered at center of the placeholder cover. */
    coverEmoji?: string;
  };
}

/**
 * Scene - Represents a single page/scene in the course
 */
export interface Scene {
  id: string;
  stageId: string; // ID of the parent stage (for data integrity checks)
  type: SceneType;
  title: string;
  order: number; // Display order

  // Type-specific content
  content: SceneContent;

  // Actions to execute during playback
  actions?: Action[];

  // Whiteboards to explain deeply
  whiteboards?: Slide[];

  // Multi-agent discussion configuration
  multiAgent?: {
    enabled: boolean; // Enable multi-agent for this scene
    agentIds: string[]; // Which agents to include (from registry)
    directorPrompt?: string; // Optional custom director instructions
  };

  /**
   * Publisher-issued AI modification instructions accumulated for the whole
   * scene (page). Stored chronologically; UI shows the most recent entries
   * on top. Drives the always-visible "AI 单页助手" launcher in edit mode and
   * the per-component "AI 调优" button on interactive / PBL widgets — both
   * ultimately read and write this single source of truth so history is
   * unified regardless of which entry point was used.
   *
   * `InteractiveContent.aiCommands` and `PBLContent.aiCommands` remain on
   * those types for back-compat with previously persisted classroom JSON;
   * new code should prefer this scene-level field.
   */
  aiCommands?: AICommand[];

  /**
   * Page-level version history for publisher edits. Unlike `aiCommands`,
   * this stores restorable content snapshots, covering both manual edits and
   * AI optimizations.
   */
  versions?: SceneVersion[];

  // Metadata
  createdAt?: number;
  updatedAt?: number;
}

export type SceneVersionSource = 'manual' | 'ai' | 'restore';

export interface SceneVersion {
  id: string;
  timestamp: number;
  source: SceneVersionSource;
  title: string;
  content: SceneContent;
  actions?: Action[];
  instruction?: string;
  summary?: string;
  authorName?: string;
  signature: string;
}

/**
 * Scene content based on type
 */
export type SceneContent = SlideContent | QuizContent | InteractiveContent | PBLContent;

/**
 * Slide content - PPTist Canvas data
 */
export interface SlideContent {
  type: 'slide';
  // PPTist slide data structure
  canvas: Slide;
}

/**
 * Quiz content - React component props/data
 */
export interface QuizContent {
  type: 'quiz';
  questions: QuizQuestion[];
}

export interface QuizOption {
  label: string; // Display text
  value: string; // Selection key: "A", "B", "C", "D"
}

export interface QuizQuestion {
  id: string;
  type: 'single' | 'multiple' | 'short_answer';
  question: string;
  options?: QuizOption[];
  answer?: string[]; // Correct answer values: ["A"], ["A","C"], or undefined for text
  analysis?: string; // Explanation shown after grading
  commentPrompt?: string; // Grading guidance for text questions
  hasAnswer?: boolean; // Whether auto-grading is possible
  points?: number; // Points per question (default 1)
}

/**
 * Interactive content - Interactive web page (iframe)
 */
export interface InteractiveContent {
  type: 'interactive';
  url: string; // URL of the interactive page
  // Optional: embedded HTML content
  html?: string;
  // Ultra Mode widget fields
  widgetType?: WidgetType;
  widgetConfig?: WidgetConfig;
  teacherActions?: TeacherAction[];
  /**
   * Publisher-issued AI modification instructions accumulated for this widget.
   * Stored chronologically; ui shows the most recent entries on top.
   */
  aiCommands?: AICommand[];
}

/**
 * PBL content - Project-based learning
 */
export interface PBLContent {
  type: 'pbl';
  projectConfig: PBLProjectConfig;
  /** See `InteractiveContent.aiCommands`. */
  aiCommands?: AICommand[];
}

// Re-export generation types for convenience
export type {
  UserRequirements,
  SceneOutline,
  GenerationSession,
  GenerationProgress,
  UploadedDocument,
} from './generation';
