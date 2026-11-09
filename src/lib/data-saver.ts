const DATA_SAVER_KEY = "tigerchats:data-saver";

export const isDataSaverEnabled = (): boolean => {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem(DATA_SAVER_KEY) === "true"; } catch { return false; }
};

/** Use Supabase image transformation for public storage images when Data Saver is on. */
export const getMediaDisplayUrl = (url: string, enabled = isDataSaverEnabled()): string => {
  if (!enabled || !url) return url;
  try {
    const parsed = new URL(url);
    const marker = "/storage/v1/object/public/";
    const index = parsed.pathname.indexOf(marker);
    if (index < 0) return url;
    const bucketAndPath = parsed.pathname.slice(index + marker.length);
    if (/\.(mp4|webm|mov|mp3|m4a|ogg|pdf)(?:$)/i.test(bucketAndPath)) return url;
    parsed.pathname = parsed.pathname.slice(0, index) + "/storage/v1/render/image/public/" + bucketAndPath;
    parsed.searchParams.set("width", "480");
    parsed.searchParams.set("quality", "55");
    parsed.searchParams.set("resize", "contain");
    return parsed.toString();
  } catch { return url; }
};
