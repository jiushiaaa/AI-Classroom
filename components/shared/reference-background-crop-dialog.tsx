'use client';

import { useCallback, useEffect, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/hooks/use-i18n';
import {
  exportCroppedImageDataUrl,
  REFERENCE_BG_CROP_ASPECT,
} from '@/lib/utils/image-crop-export';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export interface ReferenceBackgroundCropDialogProps {
  readonly open: boolean;
  readonly imageSrc: string | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: (dataUrl: string) => void | Promise<void>;
  /** Shown while parent persists the cropped image. */
  readonly confirmBusy?: boolean;
}

export function ReferenceBackgroundCropDialog({
  open,
  imageSrc,
  onOpenChange,
  onConfirm,
  confirmBusy = false,
}: ReferenceBackgroundCropDialogProps) {
  const { t } = useI18n();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setExporting(false);
  }, [open, imageSrc]);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels || exporting || confirmBusy) return;
    setExporting(true);
    try {
      const dataUrl = await exportCroppedImageDataUrl(imageSrc, croppedAreaPixels);
      await onConfirm(dataUrl);
      onOpenChange(false);
    } catch {
      toast.error(t('home.referenceBg.crop.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const busy = exporting || confirmBusy;

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent
        className="max-w-[min(92vw,720px)] gap-0 p-0 overflow-hidden"
        showCloseButton={!busy}
      >
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base">{t('home.referenceBg.crop.title')}</DialogTitle>
        </DialogHeader>

        <div className="relative mx-5 h-[min(52vh,400px)] rounded-xl bg-neutral-950 overflow-hidden">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={REFERENCE_BG_CROP_ASPECT}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              objectFit="contain"
              showGrid={false}
            />
          ) : null}
        </div>

        <DialogFooter className="sm:justify-end gap-2 px-5 py-4">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={busy || !imageSrc || !croppedAreaPixels}
            onClick={() => void handleConfirm()}
          >
            {busy && <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />}
            {t('home.referenceBg.crop.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
