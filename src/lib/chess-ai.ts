import type { Chess, Move, PieceSymbol } from "chess.js";

export type ChessDifficulty = "easy" | "medium" | "hard";

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};
const CHECKMATE_SCORE = 100_000;

/**
 * Selects a legal move for the current side to move. Search moves are always
 * undone in `finally` blocks, leaving the caller's position and history intact.
 */
export function pickChessMove(game: Chess, difficulty: ChessDifficulty): Move | null {
  const legalMoves = game.moves({ verbose: true });
  if (legalMoves.length === 0) return null;

  if (difficulty === "easy") {
    const sample = Math.random();
    const index = Number.isFinite(sample)
      ? Math.min(legalMoves.length - 1, Math.max(0, Math.floor(sample * legalMoves.length)))
      : 0;
    return legalMoves[index] ?? legalMoves[0] ?? null;
  }

  if (difficulty !== "medium" && difficulty !== "hard") {
    return legalMoves[0] ?? null;
  }

  const depth = difficulty === "medium" ? 2 : 3;
  let bestMove: Move | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  let alpha = Number.NEGATIVE_INFINITY;
  const beta = Number.POSITIVE_INFINITY;

  try {
    for (const move of orderMoves(legalMoves)) {
      let madeMove = false;
      try {
        game.move(move);
        madeMove = true;
        const score = -negamax(game, depth - 1, -beta, -alpha, 1);
        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
        alpha = Math.max(alpha, score);
      } finally {
        if (madeMove) game.undo();
      }
    }
  } catch {
    // If a malformed or externally modified Chess instance interrupts search,
    // return a known legal move after all successfully made moves are undone.
    return legalMoves[0] ?? null;
  }

  return bestMove ?? legalMoves[0] ?? null;
}

function negamax(game: Chess, depth: number, alpha: number, beta: number, ply: number): number {
  const terminal = terminalScore(game, ply);
  if (terminal !== null) return terminal;
  if (depth <= 0) return evaluatePosition(game);

  const moves = game.moves({ verbose: true });
  if (moves.length === 0) return game.isCheck() ? -CHECKMATE_SCORE + ply : 0;

  let bestScore = Number.NEGATIVE_INFINITY;
  for (const move of orderMoves(moves)) {
    let madeMove = false;
    let score: number;
    try {
      game.move(move);
      madeMove = true;
      score = -negamax(game, depth - 1, -beta, -alpha, ply + 1);
    } finally {
      if (madeMove) game.undo();
    }

    bestScore = Math.max(bestScore, score);
    alpha = Math.max(alpha, score);
    if (alpha >= beta) break;
  }
  return bestScore;
}

function terminalScore(game: Chess, ply: number): number | null {
  if (game.isCheckmate()) return -CHECKMATE_SCORE + ply;
  if (game.isDraw()) return 0;
  return null;
}

function evaluatePosition(game: Chess): number {
  const sideToMove = game.turn();
  let score = 0;
  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece) continue;
      const sign = piece.color === sideToMove ? 1 : -1;
      score += sign * PIECE_VALUES[piece.type];
      score += sign * centerActivity(piece.square, piece.type);
    }
  }
  return score;
}

function centerActivity(square: Move["from"], piece: PieceSymbol): number {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  const distanceFromCenter = Math.abs(file - 3.5) + Math.abs(rank - 3.5);
  const centrality = 14 - distanceFromCenter * 4;
  return piece === "p" ? centrality * 0.7 : centrality;
}

function orderMoves(moves: Move[]): Move[] {
  return [...moves].sort((a, b) => {
    const scoreDifference = moveOrderScore(b) - moveOrderScore(a);
    if (scoreDifference !== 0) return scoreDifference;
    const aKey = `${a.from}${a.to}${a.promotion ?? ""}`;
    const bKey = `${b.from}${b.to}${b.promotion ?? ""}`;
    return aKey.localeCompare(bKey);
  });
}

function moveOrderScore(move: Move): number {
  let score = 0;
  if (move.captured) {
    // MVV-LVA makes forcing, high-value captures available early to alpha-beta.
    score += 10_000 + PIECE_VALUES[move.captured] * 10 - PIECE_VALUES[move.piece];
  }
  if (move.promotion) {
    score += 20_000 + PIECE_VALUES[move.promotion] - PIECE_VALUES.p;
  }
  if (move.san.endsWith("+") || move.san.endsWith("#")) score += 500;
  score += Math.max(0, 8 - centerDistance(move.to));
  return score;
}

function centerDistance(square: Move["to"]): number {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return Math.abs(file - 3.5) + Math.abs(rank - 3.5);
}
