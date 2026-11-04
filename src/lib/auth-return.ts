export function authReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || [...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 || char === "\\")) return "/";
  try {
    const url = new URL(value, "https://app.invalid");
    return url.origin === "https://app.invalid" && !url.pathname.startsWith("//") ? url.pathname + url.search + url.hash : "/";
  } catch { return "/"; }
}