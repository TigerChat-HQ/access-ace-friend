const CACHE_PREFIX = "tigerchats:offline-data:v1";

const cacheKey = (userId: string, kind: string, id = "all") =>
  `${CACHE_PREFIX}:${encodeURIComponent(userId)}:${kind}:${encodeURIComponent(id)}`;

export const readOfflineData = <T,>(userId: string | null | undefined, kind: string, id = "all"): T | null => {
  if (!userId || typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(cacheKey(userId, kind, id));
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
};

export const writeOfflineData = <T,>(userId: string | null | undefined, kind: string, value: T, id = "all") => {
  if (!userId || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(cacheKey(userId, kind, id), JSON.stringify(value));
  } catch (error) {
    // Keep the app usable if device storage is full or disabled.
    console.warn("Could not persist offline chat data:", error);
  }
};

export const clearOfflineDataForUser = (userId: string) => {
  if (typeof localStorage === "undefined") return;
  const prefix = `${CACHE_PREFIX}:${encodeURIComponent(userId)}:`;
  try {
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index);
      if (key?.startsWith(prefix)) localStorage.removeItem(key);
    }
  } catch (error) {
    console.warn("Could not clear cached offline chat data:", error);
  }
};
