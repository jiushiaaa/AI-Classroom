interface SceneVersionHistoryVisibilityOptions {
  readonly readOnly: boolean;
  readonly hasCurrentScene: boolean;
  readonly showSlideInsertTools: boolean;
  readonly showPublisherChrome: boolean;
  readonly publisherEditView: boolean;
}

export function shouldShowSceneVersionHistory({
  readOnly,
  hasCurrentScene,
  showSlideInsertTools,
  showPublisherChrome,
  publisherEditView,
}: SceneVersionHistoryVisibilityOptions): boolean {
  if (readOnly || !hasCurrentScene) return false;
  return showSlideInsertTools || (showPublisherChrome && publisherEditView);
}

export function getSceneHistoryLabel(sceneIndex: number | null | undefined): string {
  if (sceneIndex === null || sceneIndex === undefined || sceneIndex < 0) {
    return '页面历史记录';
  }
  return `第 ${sceneIndex + 1} 页历史记录`;
}
