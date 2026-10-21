import { describe, expect, it } from "vitest";
import { applyMove, legalMoves, type Board } from "./draughts";

describe("flying kings", () => {
  it("travels any distance along all four empty diagonals", () => {
    const board: Board = Array(64).fill(null);
    board[28] = { c: "w", k: true };
    expect(legalMoves(board, "w").map(m => m.to).sort((a,b) => a-b)).toEqual([1,7,10,14,19,21,35,37,42,46,49,55,56]);
  });
  it("captures a distant opponent with every available landing beyond it", () => {
    const board: Board = Array(64).fill(null);
    board[49] = { c: "w", k: true };
    board[35] = { c: "b", k: false };
    const moves = legalMoves(board, "w");
    expect(moves.map(m => m.to)).toEqual([28,21,14,7]);
    expect(moves.every(m => m.captures.length === 1 && m.captures[0] === 35)).toBe(true);
  });
  it("cannot fly through its own piece or two adjacent opponents", () => {
    const board: Board = Array(64).fill(null);
    board[49] = { c: "w", k: true };
    board[35] = { c: "w", k: false };
    expect(legalMoves(board, "w").filter(m => m.from === 49).map(m => m.to)).not.toContain(28);
    board[35] = { c: "b", k: false };
    board[28] = { c: "b", k: false };
    expect(legalMoves(board, "w").filter(m => m.from === 49).every(m => m.captures.length === 0)).toBe(true);
  });
  it("chains flying captures without duplicating captured indices", () => {
    const board: Board = Array(64).fill(null);
    board[49] = { c: "w", k: true };
    board[35] = { c: "b", k: false };
    board[19] = { c: "b", k: false };
    const move = legalMoves(board, "w").find(m => m.to === 10);
    expect(move?.captures).toEqual([35,19]);
    if (!move) throw new Error("Missing flying chain");
    const result = applyMove(board, move);
    expect(result[35]).toBeNull();
    expect(result[19]).toBeNull();
    expect(result[10]).toEqual({ c: "w", k: true });
  });
  it("keeps ordinary men limited to one-square quiet moves", () => {
    const board: Board = Array(64).fill(null);
    board[49] = { c: "w", k: false };
    expect(legalMoves(board, "w").map(m => m.to)).toEqual([40,42]);
  });
});