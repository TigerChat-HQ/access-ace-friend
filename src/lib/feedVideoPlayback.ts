let feedMuted = true;
let activeMedia: HTMLMediaElement[] = [];

export const getFeedMuted = () => feedMuted;

export const setFeedMuted = (muted: boolean) => {
  feedMuted = muted;
  for (const media of activeMedia) media.muted = muted;
};

export const claimFeedPlayback = (media: HTMLMediaElement[]) => {
  const next = media.filter(Boolean);
  if (activeMedia.some((item) => !next.includes(item))) {
    for (const item of activeMedia) {
      if (!next.includes(item)) {
        item.pause();
        item.muted = true;
      }
    }
  }
  activeMedia = next;
  for (const item of activeMedia) item.muted = feedMuted;
};

export const releaseFeedPlayback = (media: HTMLMediaElement[]) => {
  if (activeMedia.some((item) => media.includes(item))) {
    for (const item of activeMedia) {
      item.pause();
      item.muted = true;
    }
    activeMedia = [];
  }
};
