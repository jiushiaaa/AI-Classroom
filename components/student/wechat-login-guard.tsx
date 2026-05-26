'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { WechatLoginModal } from '@/components/student/wechat-login-modal';
import {
  clearWechatAuthSession,
  isWechatAuthValidForClassroom,
  saveWechatAuthSession,
} from '@/lib/student/wechat-auth-session';
import { useI18n } from '@/lib/hooks/use-i18n';

interface WechatLoginGuardProps {
  classroomId: string;
  enabled: boolean;
  children: ReactNode;
}

/**
 * C-end H5 gate: blocks classroom UI until mock WeChat login + phone auth succeed.
 * Aligns with PRD 09 §6.4 (AC-10 ~ AC-12). Only active when `enabled` (mode=preview).
 */
export function WechatLoginGuard({ classroomId, enabled, children }: WechatLoginGuardProps) {
  const { t } = useI18n();
  const [ready, setReady] = useState(!enabled);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setReady(true);
      setAuthenticated(true);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('wechat_logout') === '1') {
      clearWechatAuthSession();
      params.delete('wechat_logout');
      const next = `${window.location.pathname}?${params.toString()}`.replace(/\?$/, '');
      window.history.replaceState(null, '', next || window.location.pathname);
    }

    const valid = isWechatAuthValidForClassroom(classroomId);
    setAuthenticated(valid);
    setReady(true);
  }, [classroomId, enabled]);

  const handleSuccess = useCallback(
    (payload: { openid: string; phoneMasked: string }) => {
      saveWechatAuthSession({
        openid: payload.openid,
        phoneMasked: payload.phoneMasked,
        classroomId,
        loggedInAt: Date.now(),
      });
      setAuthenticated(true);
    },
    [classroomId],
  );

  if (!enabled) {
    return <>{children}</>;
  }

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-100 text-sm text-zinc-500 dark:bg-zinc-950">
        {t('wechatLogin.loading')}
      </div>
    );
  }

  return (
    <>
      <WechatLoginModal
        open={!authenticated}
        classroomId={classroomId}
        onSuccess={handleSuccess}
      />
      {!authenticated ? (
        <div
          className="flex h-screen flex-col items-center justify-center gap-3 bg-gradient-to-b from-zinc-100 to-zinc-200 px-6 text-center dark:from-zinc-900 dark:to-zinc-950"
          aria-hidden
        >
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {t('wechatLogin.blockedHint')}
          </p>
          <p className="text-xs text-zinc-400">{t('wechatLogin.blockedSubhint')}</p>
        </div>
      ) : (
        children
      )}
    </>
  );
}
