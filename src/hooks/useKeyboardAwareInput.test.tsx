import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useKeyboardAwareInput } from "@/hooks/useKeyboardAwareInput";

const TestInput = () => {
  const inputRef = useKeyboardAwareInput<HTMLInputElement>();
  return <input ref={inputRef} aria-label="Message" />;
};

describe("useKeyboardAwareInput", () => {
  it("scrolls a focused field into view when the visible viewport no longer contains it", () => {
    const requestFrame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);

    const { getByRole, unmount } = render(<TestInput />);
    const input = getByRole("textbox");
    const scrollIntoView = vi.fn();
    Object.defineProperty(input, "scrollIntoView", { configurable: true, value: scrollIntoView });
    vi.spyOn(input, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 900,
      top: 900,
      left: 0,
      right: 220,
      bottom: 944,
      width: 220,
      height: 44,
      toJSON: () => ({}),
    } as DOMRect);

    act(() => input.focus());

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "end",
      inline: "nearest",
    });

    unmount();
    requestFrame.mockRestore();
    vi.restoreAllMocks();
  });
});
