import { describe, expect, it } from 'vitest';
import { shouldShowSceneVersionHistory } from '@/lib/utils/header-toolbar-visibility';

describe('header toolbar visibility', () => {
  it('shows page history in publisher edit view even when slide insert tools are hidden', () => {
    expect(
      shouldShowSceneVersionHistory({
        readOnly: false,
        hasCurrentScene: true,
        showSlideInsertTools: false,
        showPublisherChrome: true,
        publisherEditView: true,
      }),
    ).toBe(true);
  });

  it('keeps page history available for slide edit tools', () => {
    expect(
      shouldShowSceneVersionHistory({
        readOnly: false,
        hasCurrentScene: true,
        showSlideInsertTools: true,
        showPublisherChrome: true,
        publisherEditView: true,
      }),
    ).toBe(true);
  });

  it('hides page history when the header is read-only or has no active scene', () => {
    expect(
      shouldShowSceneVersionHistory({
        readOnly: true,
        hasCurrentScene: true,
        showSlideInsertTools: false,
        showPublisherChrome: true,
        publisherEditView: true,
      }),
    ).toBe(false);

    expect(
      shouldShowSceneVersionHistory({
        readOnly: false,
        hasCurrentScene: false,
        showSlideInsertTools: false,
        showPublisherChrome: true,
        publisherEditView: true,
      }),
    ).toBe(false);
  });

  it('hides page history in publisher preview view for non-slide pages', () => {
    expect(
      shouldShowSceneVersionHistory({
        readOnly: false,
        hasCurrentScene: true,
        showSlideInsertTools: false,
        showPublisherChrome: true,
        publisherEditView: false,
      }),
    ).toBe(false);
  });
});
