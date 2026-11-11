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
    expect(result.trajectory.length).toBeGreaterThan(1);
    expect(result.trajectory.at(-1)?.balls).toHaveLength(result.state.balls.length);
  });
  it("awards ball-in-hand after cue scratch", () => {
    const state = createInitialPoolState("eight_ball", "p1", "p2");
    const cue = state.balls.find(ball => ball.id === 0)!;
    cue.x = 0.5; cue.y = 0.14;
    const result = simulatePoolShot(state, "p1", "p2", { angle: -Math.PI / 2, power: 100, requestId: "scratch-1" });
    expect(result.foulReason).toBe("scratch");
    expect(result.state.ballInHandFor).toBe("p2");
  });
  it("respot 9-ball when the 9 is pocketed on a foul", () => {
    const state = createInitialPoolState("nine_ball", "p1", "p2");
    const cue = state.balls.find(ball => ball.id === 0)!;
    const nine = state.balls.find(ball => ball.id === 9)!;
    state.balls = [cue, nine, { ...state.balls.find(ball => ball.id === 1)!, x: 0.52, y: 0.5 }];
    cue.x = 0.5; cue.y = 0.14; nine.x = 0.5; nine.y = 0.12;
    const result = simulatePoolShot(state, "p1", "p2", { angle: -Math.PI / 2, power: 100, requestId: "nine-scratch" });
    expect(result.foul).toBe(true);
    expect(result.state.balls.find(ball => ball.id === 9)?.pocketed).toBe(false);
  });
  it("keeps 8-ball groups unassigned after a legal break pocket", () => {
    const state = createInitialPoolState("eight_ball", "p1", "p2");
    const cue = state.balls.find(ball => ball.id === 0)!;
    const first = state.balls.find(ball => ball.id === 1)!;
    cue.x = 0.5; cue.y = 0.5;
    first.x = 0.5; first.y = 0.25;
    state.balls = state.balls.map(ball => ball.id === 0 ? cue : ball.id === 1 ? first : { ...ball, pocketed: true });
    const result = simulatePoolShot(state, "p1", "p2", { angle: -Math.PI / 2, power: 100, requestId: "break-pocket" });
    expect(result.foul).toBe(false);
    expect(result.pocketed).toContain(1);
    expect(result.state.groups.p1).toBeNull();
    expect(result.state.groups.p2).toBeNull();
  });
  it("does not assign 8-ball groups on the break", () => {
    const state = createInitialPoolState("eight_ball", "p1", "p2");
    expect(state.groups.p1).toBeNull();
    expect(state.groups.p2).toBeNull();
  });
  it("requires valid ball-in-hand placement", () => {
    const state = createInitialPoolState("eight_ball", "p1", "p2");
    state.ballInHandFor = "p1";
    expect(() => simulatePoolShot(state, "p1", "p2", { angle: 0, power: 50, requestId: "no-placement" })).toThrow("Place the cue ball");
    expect(() => simulatePoolShot(state, "p1", "p2", { angle: 0, power: 50, cuePosition: { x: 0.68, y: 0.5 }, requestId: "overlap" })).toThrow("overlaps");
  });
});
describe("Pool competitive rules and shot replay", () => {
  it("records an initial and final trajectory frame for every shot", () => {
    const state = createInitialPoolState("eight_ball", "p1", "p2");
    const result = simulatePoolShot(state, "p1", "p2", { angle: 0, power: 60, requestId: "replay-1" });
    expect(result.trajectory[0].balls.find(ball => ball.id === 0)?.x).toBeGreaterThan(0.22);
    expect(result.trajectory.at(-1)?.balls.find(ball => ball.id === 0)?.pocketed).toBe(false);
  });
  it("does not allow the 8-ball to be legally pocketed on the break", () => {
    const state = createInitialPoolState("eight_ball", "p1", "p2");
    const cue = state.balls.find(ball => ball.id === 0)!;
    const eight = state.balls.find(ball => ball.id === 8)!;
    state.balls = [cue, eight, { ...state.balls.find(ball => ball.id === 1)!, x: 0.52, y: 0.5 }];
    cue.x = 0.5; cue.y = 0.5; eight.x = 0.5; eight.y = 0.12;
    const result = simulatePoolShot(state, "p1", "p2", { angle: -Math.PI / 2, power: 100, requestId: "break-eight" });
    expect(result.winnerId).toBeNull();
    expect(result.state.balls.find(ball => ball.id === 8)?.pocketed).toBe(false);
  });
});

  it("awards the opponent the rack after three 9-ball fouls by one player", () => {
    let state = createInitialPoolState("nine_ball", "p1", "p2");
    for (let index = 1; index <= 3; index += 1) {
      state.currentTurn = "p1";
      state.ballInHandFor = null;
      const result = simulatePoolShot(state, "p1", "p2", {
        angle: Math.PI / 2, power: 5, requestId: "three-foul-" + index
      });
      state = result.state;
      expect(state.foulStreak.p1).toBe(index);
      if (index < 3) expect(result.winnerId).toBeNull();
      else expect(result.winnerId).toBe("p2");
    }
  });
