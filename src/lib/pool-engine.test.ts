import { describe, expect, it } from "vitest";
import { createInitialPoolState, simulatePoolShot } from "../../supabase/functions/_shared/pool-engine";

describe("authoritative Pool engine", () => {
  it("creates correct rack sizes and ball identities", () => {
    expect(createInitialPoolState("eight_ball", "p1", "p2").balls).toHaveLength(16);
    expect(createInitialPoolState("nine_ball", "p1", "p2").balls).toHaveLength(10);
  });
  it("rejects wrong turns and out-of-range power", () => {
    const state = createInitialPoolState("eight_ball", "p1", "p2");
    expect(() => simulatePoolShot(state, "p2", "p1", { angle: 0, power: 50, requestId: "bad-turn" })).toThrow("not your turn");
    expect(() => simulatePoolShot(state, "p1", "p2", { angle: 0, power: 101, requestId: "bad-power" })).toThrow("Power");
  });
  it("calculates the first legal 9-ball contact on the server engine", () => {
    const state = createInitialPoolState("nine_ball", "p1", "p2");
    const result = simulatePoolShot(state, "p1", "p2", { angle: 0, power: 75, requestId: "shot-1" });
    expect(result.firstContact).toBe(1);
    expect(result.state.balls.every(ball => Number.isFinite(ball.x) && Number.isFinite(ball.y))).toBe(true);
    expect(result.status).toBe("active");
  });
  it("awards ball-in-hand after cue scratch", () => {
    const state = createInitialPoolState("eight_ball", "p1", "p2");
    const cue = state.balls.find(ball => ball.id === 0)!;
    cue.x = 0.5; cue.y = 0.14;
    const result = simulatePoolShot(state, "p1", "p2", { angle: -Math.PI / 2, power: 100, requestId: "scratch-1" });
    expect(result.foulReason).toBe("scratch");
    expect(result.state.ballInHandFor).toBe("p2");
  });
  it("requires valid ball-in-hand placement", () => {
    const state = createInitialPoolState("eight_ball", "p1", "p2");
    state.ballInHandFor = "p1";
    expect(() => simulatePoolShot(state, "p1", "p2", { angle: 0, power: 50, requestId: "no-placement" })).toThrow("Place the cue ball");
    expect(() => simulatePoolShot(state, "p1", "p2", { angle: 0, power: 50, cuePosition: { x: 0.68, y: 0.5 }, requestId: "overlap" })).toThrow("overlaps");
  });
});