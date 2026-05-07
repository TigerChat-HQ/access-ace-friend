import { useEffect } from "react";

/**
 * Best-effort screenshot/recording protection for web.
 * Note: True screenshot blocking requires a native app — browsers do not expose this API.
 * This blurs sensitive content when the tab loses focus and disables right-click/text selection.
 */
export const useScreenshotProtection = (active: boolean = true) => {
  useEffect(() => {
    if (!active) return;
    const onContext = (e: MouseEvent) => e.preventDefault();
    const onBlur = () => document.body.classList.add("privacy-blur");
    const onFocus = () => document.body.classList.remove("privacy-blur");
    const onVis = () => {
      if (document.hidden) document.body.classList.add("privacy-blur");
      else document.body.classList.remove("privacy-blur");
    };
    document.addEventListener("contextmenu", onContext);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    document.body.classList.add("no-select");
    return () => {
      document.removeEventListener("contextmenu", onContext);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      document.body.classList.remove("no-select", "privacy-blur");
    };
  }, [active]);
};
