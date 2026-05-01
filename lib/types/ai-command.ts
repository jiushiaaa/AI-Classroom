/**
 * AI modify command record for interactive / PBL scenes.
 *
 * The publisher cannot hand-edit a complex widget's underlying code, so we
 * accumulate natural-language instructions on the scene and let the (mocked)
 * AI agent claim it has applied them. The list serves both as user history
 * and as visible breadcrumb proving "this widget has been customised".
 *
 * Lifecycle:
 *   pending     → AI is "thinking" (component shows local loading overlay)
 *   previewing  → AI returned a candidate change; publisher must confirm
 *                 with apply or undo
 *   applied     → publisher confirmed; recorded in history
 *   failed      → unused by the current mock; reserved for real backend
 */
export type AICommandStatus = 'pending' | 'previewing' | 'applied' | 'failed';

export interface AICommand {
  id: string;
  timestamp: number;
  /** Raw instruction the publisher typed in. */
  instruction: string;
  status: AICommandStatus;
  /**
   * Mock-generated short summary describing what the AI claims to have changed
   * (e.g. "已将灯泡数量从 1 个调整为 2 个"). Populated when status === 'previewing'
   * or 'applied'.
   */
  summary?: string;
  /**
   * Optional error message when status === 'failed'. Reserved for future use;
   * the current mock never fails.
   */
  error?: string;
}
