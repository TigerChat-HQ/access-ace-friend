import type { ChatPrefs } from "@/hooks/useChatPreferences";

const WALLPAPERS: { key: string; bg: string }[] = [
  { key: "default", bg: "bg-background" },
  { key: "tiger", bg: "bg-gradient-to-br from-black via-orange-900/30 to-black" },
  { key: "neon", bg: "bg-gradient-to-br from-emerald-900/40 via-black to-purple-900/40" },
  { key: "ocean", bg: "bg-gradient-to-br from-blue-900/50 to-cyan-900/50" },
  { key: "sunset", bg: "bg-gradient-to-br from-orange-700/40 via-pink-700/30 to-purple-900/50" },
  { key: "light", bg: "bg-zinc-100" },
];

export const wallpaperClass = (key: string | null): string => {
  const wallpaper = WALLPAPERS.find((item) => item.key === key);
  return wallpaper?.bg || "";
};

export const bubbleColorClass = (key: string | null): string => {
  switch (key) {
    case "blue":
      return "bg-blue-500 text-white";
    case "purple":
      return "bg-purple-500 text-white";
    case "pink":
      return "bg-pink-500 text-white";
    case "orange":
      return "bg-orange-500 text-white";
    default:
      return "bg-primary text-primary-foreground";
  }
};

export const fontSizeClass = (size: ChatPrefs["font_size"]): string => {
  if (size === "small") return "text-xs";
  if (size === "large") return "text-base";
  return "text-sm";
};
