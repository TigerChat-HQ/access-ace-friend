import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationBubble } from "./NotificationBubble";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-a" } }),
}));

vi.mock("react-router-dom", () => ({
  useLocation: () => ({ search: "" }),
}));

const dispatchPointer = (target: EventTarget, type: string, x: number, y: number) => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: "touch" },
  });
  target.dispatchEvent(event);
};

describe("NotificationBubble", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 400 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
  });

  it("can be dragged and docks on the closest screen side", () => {
    render(<NotificationBubble />);
    const button = screen.getByRole("button", { name: "Open floating chat" });

    act(() => {
      dispatchPointer(button, "pointerdown", 350, 744);
      dispatchPointer(window, "pointermove", 30, 400);
      dispatchPointer(window, "pointerup", 30, 400);
    });

    const saved = JSON.parse(localStorage.getItem("tiger-notification-preferences:user-a") || "{}");
    expect(saved.floatingBubblePosition.side).toBe("left");
    expect(button.parentElement?.style.left).toBe("12px");
  });
});
