import { describe, expect, it } from "vitest";
import { applyMove, initialBoard, legalMoves, pickAIMove, type Board } from "./draughts";

describe("Draughts AI and move engine", () => {
  it("creates a standard 8x8 opening with twelve pieces per side", () => {
    const board = initialBoard();
    expect(board).toHaveLength(64);
    expect(board.filter((piece) => piece?.c === "w")).toHaveLength(12);
    expect(board.filter((piece) => piece?.c === "b")).toHaveLength(12);
  });

  it("enforces a capture when one is available", () => {
    const board: Board = Array(64).fill(null);
    board[2 * 8 + 1] = { c: "b", k: false };
    board[3 * 8 + 2] = { c: "w", k: false };
    const moves = legalMoves(board, "b");
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((move) => move.captures.length > 0)).toBe(true);
    expect(moves.some((move) => move.to === 4 * 8 + 3)).toBe(true);
  });

  it("returns a legal move for each exposed AI difficulty depth", () => {
    const board = initialBoard();
    const legal = legalMoves(board, "b");
    for (const depth of [2, 3, 4, 5]) {
      const move = pickAIMove(board, "b", depth);
      expect(move).not.toBeNull();
      expect(legal).toContainEqual(move);
    }
  });

  it("returns null when the side to move has no legal moves", () => {
    const board: Board = Array(64).fill(null);
    board[7 * 8] = { c: "w", k: false };
    expect(pickAIMove(board, "b", 3)).toBeNull();
  });

  it("applies a chosen move without mutating the original board", () => {
    const board = initialBoard();
    const move = pickAIMove(board, "b", 2);
    expect(move).not.toBeNull();
    const next = applyMove(board, move!);
    expect(next).not.toBe(board);
    expect(board.filter(Boolean)).toHaveLength(24);
    expect(next.filter(Boolean)).toHaveLength(24);
  });
});
