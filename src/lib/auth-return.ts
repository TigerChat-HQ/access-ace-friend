export function authReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return "/";
  try {
    const url = new URL(value, "https://app.invalid");
    return url.origin === "https://app.invalid" && !url.pathname.startsWith("//") ? url.pathname + url.search + url.hash : "/";
  } catch { return "/"; }
}