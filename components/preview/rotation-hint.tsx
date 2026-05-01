'use client';

import { motion, AnimatePresence } from 'motion/react';
import { Smartphone, RotateCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/hooks/use-i18n';
import type { PreviewDevice } from '@/lib/store/preview-device';

interface RotationHintProps {
  readonly device: PreviewDevice;
}

/**
 * RotationHint
 *
 * Briefly displays a "landscape recommended" toast when the publisher first
 * switches to mobile preview, then auto-dismisses after ~2.8 seconds. The
 * hint re-appears each time the user toggles back into mobile mode.
 */
export function RotationHint({ device }: RotationHintProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (device !== 'mobile') {
      setVisible(false);
      return;
    }
    setVisible(true);
    const id = setTimeout(() => setVisible(false), 2800);
    return () => clearTimeout(id);
  }, [device]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-black/70 backdrop-blur-md text-white shadow-lg ring-1 ring-white/10">
            <div className="relative">
              <Smartphone className="w-4 h-4" />
              <motion.div
                className="absolute -top-1 -right-1.5 text-purple-300"
                animate={{ rotate: [0, -90, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                <RotateCw className="w-3 h-3" />
              </motion.div>
            </div>
            <span className="text-sm font-medium">{t('preview.rotateHint')}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
