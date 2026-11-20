export type PresenceLanguage = "en" | "sw";

/** Do not expose a contact's last-seen timestamp in chat UI. */
export const formatLastSeen = (_value: string | null | undefined, language: PresenceLanguage = "en"): string =>
  language === "sw" ? "Haipo mtandaoni" : "Offline";
