'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LoaderCircle, Smartphone, X } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';

export type WechatLoginStep = 'wechat' | 'phone' | 'denied';

interface WechatLoginModalProps {
  open: boolean;
  classroomId: string;
  onSuccess: (payload: { openid: string; phoneMasked: string }) => void;
}

const WECHAT_GREEN = '#07C160';

export function WechatLoginModal({ open, classroomId, onSuccess }: WechatLoginModalProps) {
  const { t } = useI18n();
  const [step, setStep] = useState<WechatLoginStep>('wechat');
  const [wechatLoading, setWechatLoading] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setStep('wechat');
      setWechatLoading(false);
      setPhoneLoading(false);
    }
  }, [open, classroomId]);

  const handleWechatLogin = useCallback(() => {
    if (wechatLoading) return;
    setWechatLoading(true);
    window.setTimeout(() => {
      setWechatLoading(false);
      setStep('phone');
    }, 900);
  }, [wechatLoading]);

  const handleAuthorizePhone = useCallback(() => {
    if (phoneLoading) return;
    setPhoneLoading(true);
    window.setTimeout(() => {
      setPhoneLoading(false);
      onSuccess({
        openid: `demo_openid_${classroomId.slice(0, 8)}`,
        phoneMasked: '138****5678',
      });
    }, 700);
  }, [classroomId, onSuccess, phoneLoading]);

  const handleDenyPhone = useCallback(() => {
    setStep('denied');
  }, []);

  const handleClose = useCallback(() => {
    setStep('denied');
  }, []);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[250] flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="wechat-login-title"
        >
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />

          <motion.div
            className="relative z-10 w-full max-w-[400px] sm:mx-4"
            initial={{ opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 32 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="rounded-t-3xl bg-white px-6 pb-8 pt-5 shadow-2xl sm:rounded-3xl dark:bg-zinc-900">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-zinc-500">{t('wechatLogin.brand')}</p>
                  <h2 id="wechat-login-title" className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    {step === 'phone'
                      ? t('wechatLogin.phoneTitle')
                      : step === 'denied'
                        ? t('wechatLogin.deniedTitle')
                        : t('wechatLogin.title')}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                  aria-label={t('wechatLogin.close')}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {step === 'wechat' ? (
                <div className="space-y-4">
                  <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {t('wechatLogin.subtitle')}
                  </p>
                  <button
                    type="button"
                    onClick={handleWechatLogin}
                    disabled={wechatLoading}
                    className={cn(
                      'flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-base font-medium text-white transition',
                      wechatLoading ? 'opacity-80' : 'hover:opacity-95 active:scale-[0.99]',
                    )}
                    style={{ backgroundColor: WECHAT_GREEN }}
                  >
                    {wechatLoading ? (
                      <LoaderCircle className="h-5 w-5 animate-spin" />
                    ) : (
                      <WechatIcon className="h-5 w-5" />
                    )}
                    {t('wechatLogin.wechatButton')}
                  </button>
                  <p className="text-center text-xs text-zinc-400">{t('wechatLogin.demoHint')}</p>
                </div>
              ) : null}

              {step === 'phone' ? (
                <div className="space-y-4">
                  <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {t('wechatLogin.phoneSubtitle')}
                  </p>
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/60">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: WECHAT_GREEN }}
                      >
                        <Smartphone className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {t('wechatLogin.phoneLabel')}
                        </p>
                        <p className="text-xs text-zinc-500">{t('wechatLogin.phonePurpose')}</p>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAuthorizePhone}
                    disabled={phoneLoading}
                    className="w-full rounded-xl py-3 text-base font-medium text-white transition hover:opacity-95 disabled:opacity-80"
                    style={{ backgroundColor: WECHAT_GREEN }}
                  >
                    {phoneLoading ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        {t('wechatLogin.authorizing')}
                      </span>
                    ) : (
                      t('wechatLogin.authorizePhone')
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDenyPhone}
                    className="w-full py-2 text-sm text-zinc-500 transition hover:text-zinc-700"
                  >
                    {t('wechatLogin.denyPhone')}
                  </button>
                </div>
              ) : null}

              {step === 'denied' ? (
                <div className="space-y-4">
                  <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {t('wechatLogin.deniedSubtitle')}
                  </p>
                  <button
                    type="button"
                    onClick={() => setStep('wechat')}
                    className="w-full rounded-xl py-3 text-base font-medium text-white"
                    style={{ backgroundColor: WECHAT_GREEN }}
                  >
                    {t('wechatLogin.retry')}
                  </button>
                </div>
              ) : null}

              <p className="mt-5 text-center text-[11px] leading-relaxed text-zinc-400">
                {t('wechatLogin.privacy')}
              </p>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function WechatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M9.5 4C5.91 4 3 6.13 3 8.86c0 1.47.79 2.8 2.05 3.77L4.5 15l2.73-1.36c.92.26 1.9.4 2.92.4.18 0 .36-.01.54-.02C9.82 15.58 9.5 16.7 9.5 18c0 3.04 3.13 5.5 7 5.5.7 0 1.37-.08 2-.23L20.5 24l-1.2-3.6C20.43 19.37 21 18.18 21 16.86 21 14.13 18.09 12 14.5 12c-.17 0-.34.01-.5.02C13.2 9.28 11.58 8 9.5 8 6.46 8 4 10.13 4 12.86c0 .34.05.67.14 1C3.56 13.2 3 12.08 3 10.86 3 7.13 6.46 4 9.5 4zm5 6c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-5 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm8.5 4.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm-5 0c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z" />
    </svg>
  );
}
