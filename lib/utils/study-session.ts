/**
 * Per-tab study timer for a stage (sessionStorage). Starts on first lesson view in playback.
 */

const key = (stageId: string) => `openmaic_study_start_${stageId}`;

export function ensureStudySessionStarted(stageId: string): void {
  if (typeof window === 'undefined' || !stageId) return;
  try {
    if (!sessionStorage.getItem(key(stageId))) {
      sessionStorage.setItem(key(stageId), String(Date.now()));
    }
  } catch {
    /* private mode / quota */
  }
}

export function getStudySessionElapsedMs(stageId: string): number {
  if (typeof window === 'undefined' || !stageId) return 0;
  try {
    const raw = sessionStorage.getItem(key(stageId));
    if (!raw) return 0;
    const start = Number(raw);
    if (!Number.isFinite(start) || start <= 0) return 0;
    return Math.max(0, Date.now() - start);
  } catch {
    return 0;
  }
}
