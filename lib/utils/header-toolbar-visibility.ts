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
