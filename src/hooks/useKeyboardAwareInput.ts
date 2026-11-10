import { useEffect, useRef } from "react";

/** Keeps a focused text field visible when the mobile keyboard changes the visual viewport. */
export function useKeyboardAwareInput<T extends HTMLElement>() {
  const inputRef = useRef<T>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    let animationFrame = 0;
    const revealIfCovered = () => {
      if (document.activeElement !== input) return;
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const viewport = window.visualViewport;
        const visibleTop = viewport?.offsetTop ?? 0;
        const visibleBottom = visibleTop + (viewport?.height ?? window.innerHeight);
        const rect = input.getBoundingClientRect();
        const belowKeyboard = rect.bottom > visibleBottom - 12;
        const aboveViewport = rect.top < visibleTop + 8;

        if (belowKeyboard || aboveViewport) {
          input.scrollIntoView({
            behavior: "smooth",
            block: belowKeyboard ? "end" : "nearest",
            inline: "nearest",
          });
        }
      });
    };

    const viewport = window.visualViewport;
    input.addEventListener("focus", revealIfCovered);
    window.addEventListener("resize", revealIfCovered);
    viewport?.addEventListener("resize", revealIfCovered);
    viewport?.addEventListener("scroll", revealIfCovered);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      input.removeEventListener("focus", revealIfCovered);
      window.removeEventListener("resize", revealIfCovered);
      viewport?.removeEventListener("resize", revealIfCovered);
      viewport?.removeEventListener("scroll", revealIfCovered);
    };
  }, []);

  return inputRef;
}
