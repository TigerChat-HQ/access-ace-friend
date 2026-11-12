import { describe, expect, it, vi } from "vitest";
import { drawFaceEffect, type FacePoint } from "@/lib/reelFaceTracking";

const makeContext = () => ({
  save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(),
  beginPath: vi.fn(), roundRect: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
  moveTo: vi.fn(), lineTo: vi.fn(), bezierCurveTo: vi.fn(), closePath: vi.fn(),
  fillText: vi.fn(), strokeText: vi.fn(),
}) as unknown as CanvasRenderingContext2D;

const landmarks = (): FacePoint[] => {
  const points = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  points[33] = { x: 0.35, y: 0.4 };
  points[263] = { x: 0.65, y: 0.4 };
  points[1] = { x: 0.5, y: 0.52 };
  points[10] = { x: 0.5, y: 0.25 };
  points[152] = { x: 0.5, y: 0.75 };
  points[234] = { x: 0.3, y: 0.5 };
  points[454] = { x: 0.7, y: 0.5 };
  points[172] = { x: 0.4, y: 0.7 };
  return points;
};

describe("Reels face-tracked AR overlays", () => {
  it("does not draw when the effect is disabled", () => {
    const context = makeContext();
    drawFaceEffect(context, landmarks(), 720, 1280, "none");
    expect(context.save).not.toHaveBeenCalled();
  });

  it.each(["glasses", "crown", "moustache", "tiger-mask"] as const)("draws the %s overlay from face landmarks", (effect) => {
    const context = makeContext();
    drawFaceEffect(context, landmarks(), 720, 1280, effect);
    expect(context.save).toHaveBeenCalled();
    expect(context.beginPath).toHaveBeenCalled();
    expect(context.restore).toHaveBeenCalled();
  });

  it("ignores missing face landmarks safely", () => {
    const context = makeContext();
    drawFaceEffect(context, undefined, 720, 1280, "glasses");
    expect(context.save).not.toHaveBeenCalled();
  });
});
