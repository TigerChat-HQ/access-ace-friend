export const CHAT_LANGUAGES = [
  { code: "sw", label: "Kiswahili" }, { code: "en", label: "English" },
  { code: "fr", label: "Français" }, { code: "es", label: "Español" },
  { code: "ar", label: "العربية" }, { code: "pt", label: "Português" },
  { code: "de", label: "Deutsch" }, { code: "hi", label: "हिन्दी" },
  { code: "zh", label: "中文" }, { code: "ja", label: "日本語" },
] as const;

export function canTranslate(message: { senderId: string; type: string; text: string }) {
  return message.senderId !== "me" && (message.type === "text" || message.type === "image") && message.text.trim().length > 0;
}

export function translationLanguage(value: string | null): string {
  return CHAT_LANGUAGES.some(language => language.code === value) ? value || "off" : "off";
}