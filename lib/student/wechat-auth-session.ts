/** Demo-only session for C-end WeChat login + phone authorization (PRD 09 §6.4). */

export const WECHAT_AUTH_STORAGE_KEY = 'openmaic_wechat_auth_demo';

export interface WechatAuthSession {
  openid: string;
  phoneMasked: string;
  classroomId: string;
  loggedInAt: number;
}

export function readWechatAuthSession(): WechatAuthSession | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(WECHAT_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WechatAuthSession;
    if (!parsed.openid || !parsed.phoneMasked || !parsed.classroomId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isWechatAuthValidForClassroom(classroomId: string): boolean {
  const session = readWechatAuthSession();
  return session?.classroomId === classroomId;
}

export function saveWechatAuthSession(session: WechatAuthSession): void {
  sessionStorage.setItem(WECHAT_AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearWechatAuthSession(): void {
  sessionStorage.removeItem(WECHAT_AUTH_STORAGE_KEY);
}
