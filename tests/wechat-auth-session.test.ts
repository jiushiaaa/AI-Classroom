import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  clearWechatAuthSession,
  isWechatAuthValidForClassroom,
  saveWechatAuthSession,
  WECHAT_AUTH_STORAGE_KEY,
} from '@/lib/student/wechat-auth-session';

function installSessionStorageMock(): void {
  const store = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  });
}

describe('wechat auth session (demo)', () => {
  beforeEach(() => {
    installSessionStorageMock();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false when no session exists', () => {
    expect(isWechatAuthValidForClassroom('class-a')).toBe(false);
  });

  it('validates session only for matching classroom id', () => {
    saveWechatAuthSession({
      openid: 'oid',
      phoneMasked: '138****0000',
      classroomId: 'class-a',
      loggedInAt: Date.now(),
    });
    expect(isWechatAuthValidForClassroom('class-a')).toBe(true);
    expect(isWechatAuthValidForClassroom('class-b')).toBe(false);
  });

  it('clears stored session', () => {
    saveWechatAuthSession({
      openid: 'oid',
      phoneMasked: '138****0000',
      classroomId: 'class-a',
      loggedInAt: Date.now(),
    });
    clearWechatAuthSession();
    expect(sessionStorage.getItem(WECHAT_AUTH_STORAGE_KEY)).toBeNull();
  });
});
