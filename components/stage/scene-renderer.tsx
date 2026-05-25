'use client';

import { useMemo } from 'react';
import { AnimatePresence } from 'motion/react';
import type { Scene, StageMode } from '@/lib/types/stage';
import { SlideEditor as SlideRenderer } from '../slide-renderer/Editor';
import { QuizView } from '../scene-renderers/quiz-view';
import { InteractiveRenderer } from '../scene-renderers/interactive-renderer';
import { PBLRenderer } from '../scene-renderers/pbl-renderer';
import { AILoadingOverlay } from '../scene-renderers/ai-loading-overlay';
import { resolveSceneAiCommands } from '@/lib/utils/scene-ai-commands';

interface SceneRendererProps {
  readonly scene: Scene;
  readonly mode: StageMode;
  /**
   * P3: when true, slide scenes render the full PPTist Canvas (editable)
   * even though the global `mode` is still `'playback'`. Quiz scenes pick
   * up the same flag through their own editing pathway.
   */
  readonly editing?: boolean;
}

export function SceneRenderer({ scene, mode, editing = false }: SceneRendererProps) {
  const renderer = useMemo(() => {
    switch (scene.type) {
      case 'slide':
        if (scene.content.type !== 'slide') return <div>Invalid slide content</div>;
        {
          const aiCommands = resolveSceneAiCommands(scene);
          const pendingCommand = aiCommands.find((c) => c.status === 'pending');
          return (
            <div className="relative h-full w-full min-h-0">
              <SlideRenderer mode={mode} forceEditing={editing} />
              <AnimatePresence>
                {pendingCommand ? (
                  <AILoadingOverlay key="slide-ai-overlay" instruction={pendingCommand.instruction} />
                ) : null}
              </AnimatePresence>
            </div>
          );
        }
      case 'quiz':
        if (scene.content.type !== 'quiz') return <div>Invalid quiz content</div>;
        {
          const aiCommands = resolveSceneAiCommands(scene);
          const pendingCommand = aiCommands.find((c) => c.status === 'pending');
          return (
            <div className="relative h-full w-full min-h-0">
              <QuizView
                key={scene.id}
                questions={scene.content.questions}
                sceneId={scene.id}
                editing={editing}
              />
              <AnimatePresence>
                {pendingCommand ? (
                  <AILoadingOverlay key="quiz-ai-overlay" instruction={pendingCommand.instruction} />
                ) : null}
              </AnimatePresence>
            </div>
          );
        }
      case 'interactive':
        if (scene.content.type !== 'interactive') return <div>Invalid interactive content</div>;
        return <InteractiveRenderer content={scene.content} sceneId={scene.id} />;
      case 'pbl':
        if (scene.content.type !== 'pbl') return <div>Invalid PBL content</div>;
        return <PBLRenderer content={scene.content} mode={mode} sceneId={scene.id} />;
      default:
        return <div>Unknown scene type</div>;
    }
  }, [scene, mode, editing]);

  return <div className="w-full h-full">{renderer}</div>;
}
