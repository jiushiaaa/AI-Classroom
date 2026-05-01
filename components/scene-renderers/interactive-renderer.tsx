'use client';

import { useMemo, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'motion/react';
import type { InteractiveContent } from '@/lib/types/stage';
import { useWidgetIframeStore } from '@/lib/store/widget-iframe';
import { useStageStore } from '@/lib/store/stage';
import { useEditModeStore } from '@/lib/store/edit-mode';
import { patchHtmlForIframe } from '@/lib/utils/iframe';
import { AILoadingOverlay } from './ai-loading-overlay';

interface InteractiveRendererProps {
  readonly content: InteractiveContent;
  readonly sceneId: string;
}

export function InteractiveRenderer({ content, sceneId }: InteractiveRendererProps) {
  const isEditing = useEditModeStore.use.isEditing();
  // Prefer scene-level aiCommands (canonical) and fall back to legacy
  // content-level for previously persisted classroom JSON.
  const sceneAiCommands = useStageStore(
    (s) => s.scenes.find((scene) => scene.id === sceneId)?.aiCommands,
  );
  const aiCommands = sceneAiCommands ?? content.aiCommands ?? [];
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const registerIframe = useWidgetIframeStore((state) => state.registerIframe);
  const setActiveScene = useWidgetIframeStore((state) => state.setActiveScene);

  const patchedHtml = useMemo(
    () => (content.html ? patchHtmlForIframe(content.html) : undefined),
    [content.html],
  );

  // Create iframe messaging callback
  const sendMessageToIframe = useCallback((type: string, payload: Record<string, unknown>) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type, ...payload }, '*');
    }
  }, []);

  // Register iframe messaging callback on mount, unregister on unmount
  // Key by sceneId to prevent race conditions on scene switch
  useEffect(() => {
    registerIframe(sceneId, sendMessageToIframe);
    setActiveScene(sceneId);
    return () => {
      registerIframe(sceneId, null);
    };
  }, [sceneId, registerIframe, sendMessageToIframe, setActiveScene]);

  const pendingCommand = aiCommands.find((c) => c.status === 'pending');

  return (
    <div className="group w-full h-full relative">
      <iframe
        ref={iframeRef}
        srcDoc={patchedHtml}
        src={patchedHtml ? undefined : content.url}
        className="absolute inset-0 w-full h-full border-0"
        title={`Interactive Scene ${sceneId}`}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
      <AnimatePresence>
        {isEditing && pendingCommand ? (
          <AILoadingOverlay key="overlay" instruction={pendingCommand.instruction} />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
