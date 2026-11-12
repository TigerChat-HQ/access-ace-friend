export type PresenceLanguage = "en" | "sw";

export const formatLastSeen = (value: string | null | undefined, language: PresenceLanguage = "en"): string => {
  if (!value) return language === "sw" ? "Mara ya mwisho haijulikani" : "Last seen unavailable";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return language === "sw" ? "Mara ya mwisho haijulikani" : "Last seen unavailable";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return language === "sw" ? "Alionekana sasa hivi" : "Last seen just now";
  if (minutes < 60) return language === "sw" ? `Alionekana dakika ${minutes} zilizopita` : `Last seen ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return language === "sw" ? `Alionekana saa ${hours} zilizopita` : `Last seen ${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return language === "sw" ? `Alionekana siku ${days} zilizopita` : `Last seen ${days} days ago`;
  return language === "sw"
    ? `Alionekana ${new Date(timestamp).toLocaleDateString("sw-TZ", { day: "numeric", month: "short" })} saa ${new Date(timestamp).toLocaleTimeString("sw-TZ", { hour: "2-digit", minute: "2-digit" })}`
    : `Last seen ${new Date(timestamp).toLocaleDateString("en", { day: "numeric", month: "short" })} at ${new Date(timestamp).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}`;
};
