import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { pickChessMove, type ChessDifficulty } from "./chess-ai";

const difficulties: ChessDifficulty[] = ["easy", "medium", "hard"];

describe("pickChessMove", () => {
  it.each(difficulties)("returns a legal starting move at %s difficulty", (difficulty) => {
    const game = new Chess();
    const legalSans = game.moves();

    const move = pickChessMove(game, difficulty);

    expect(move).not.toBeNull();
    expect(legalSans).toContain(move?.san);
  });

  it.each(difficulties)("preserves FEN and move history at %s difficulty", (difficulty) => {
    const game = new Chess();
    game.move("e4");
    game.move("e5");
    const fenBefore = game.fen();
    const historyBefore = game.history({ verbose: true });
    const pgnBefore = game.pgn();

    expect(pickChessMove(game, difficulty)).not.toBeNull();
    expect(game.fen()).toBe(fenBefore);
    expect(game.history({ verbose: true })).toEqual(historyBefore);
    expect(game.pgn()).toBe(pgnBefore);
  });

  it.each(difficulties)("returns null for a checkmate position at %s difficulty", (difficulty) => {
    const checkmate = new Chess("7k/6Q1/6K1/8/8/8/8/8 b - - 0 1");
    expect(checkmate.isCheckmate()).toBe(true);
    expect(pickChessMove(checkmate, difficulty)).toBeNull();
  });

  it.each(difficulties)("returns null for a terminal stalemate at %s difficulty", (difficulty) => {
    const stalemate = new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    expect(stalemate.isStalemate()).toBe(true);
    expect(pickChessMove(stalemate, difficulty)).toBeNull();
  });
});
