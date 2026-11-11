// Tanzanian-style draughts (8x8 international rules subset)
// Pieces only on dark squares: (r+c) % 2 === 1
export type Color = "w" | "b";
export interface Piece { c: Color; k: boolean }
export type Cell = Piece | null;
export type Board = Cell[]; // length 64, idx = r*8+c

export const idx = (r: number, c: number) => r * 8 + c;
export const inB = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
export const isDark = (r: number, c: number) => (r + c) % 2 === 1;

export function initialBoard(): Board {
  const b: Board = Array(64).fill(null);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (!isDark(r, c)) continue;
      if (r < 3) b[idx(r, c)] = { c: "b", k: false };
      else if (r > 4) b[idx(r, c)] = { c: "w", k: false };
    }
  }
  return b;
}

export interface Move {
  from: number;
  to: number;
  captures: number[]; // indices of captured pieces
  promote: boolean;
}

const dirs = (p: Piece) => {
  if (p.k) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  return p.c === "w" ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
};

function jumpsFrom(board: Board, from: number, piece: Piece, captured: number[] = []): Move[] {
  const r = Math.floor(from / 8), c = from % 8;
  const out: Move[] = [];
  for (const [dr, dc] of dirs(piece)) {
    let mr = r + dr, mc = c + dc;
    if (piece.k) {
      while (inB(mr, mc) && !board[idx(mr, mc)]) { mr += dr; mc += dc; }
    }
    if (!inB(mr, mc)) continue;
    const midI = idx(mr, mc);
    const mid = board[midI];
    if (!mid || mid.c === piece.c || captured.includes(midI)) continue;
    let tr = mr + dr, tc = mc + dc;
    while (inB(tr, tc) && !board[idx(tr, tc)]) {
      const toI = idx(tr, tc);
      const nb = board.slice();
      nb[from] = null;
      nb[midI] = null;
      const promote = piece.c === "w" ? tr === 0 : tr === 7;
      const movedPiece = { c: piece.c, k: piece.k || promote };
      nb[toI] = movedPiece;
      const nextCaps = [...captured, midI];
      const further = jumpsFrom(nb, toI, movedPiece, nextCaps);
      if (further.length) {
        for (const f of further) out.push({ from, to: f.to, captures: f.captures, promote: promote || f.promote });
      } else {
        out.push({ from, to: toI, captures: nextCaps, promote });
      }
      if (!piece.k) break;
      tr += dr; tc += dc;
    }
  }
  return out;
}

export function legalMoves(board: Board, color: Color): Move[] {
  const captures: Move[] = [];
  const quiets: Move[] = [];
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p || p.c !== color) continue;
    const js = jumpsFrom(board, i, p);
    if (js.length) captures.push(...js);
  }
  if (captures.length) return captures; // forced capture
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p || p.c !== color) continue;
    const r = Math.floor(i / 8), c = i % 8;
    for (const [dr, dc] of dirs(p)) {
      let tr = r + dr, tc = c + dc;
      while (inB(tr, tc) && !board[idx(tr, tc)]) {
        const promote = color === "w" ? tr === 0 : tr === 7;
        quiets.push({ from: i, to: idx(tr, tc), captures: [], promote });
        if (!p.k) break;
        tr += dr; tc += dc;
      }
    }
  }
  return quiets;
}

export function applyMove(board: Board, m: Move): Board {
  const nb = board.slice();
  const piece = nb[m.from];
  if (!piece) throw new Error("Cannot move an empty square");
  nb[m.from] = null;
  for (const ci of m.captures) nb[ci] = null;
  nb[m.to] = { c: piece.c, k: piece.k || m.promote };
  return nb;
}

export function winner(board: Board, toMove: Color): Color | null {
  const moves = legalMoves(board, toMove);
  if (moves.length === 0) return toMove === "w" ? "b" : "w";
  return null;
}

// ---- Draughts AI: positional evaluation + alpha-beta search ----
// Scores are always from black's perspective (black is the built-in AI side).
const MATERIAL_MAN = 100;
const MATERIAL_KING = 325;
const WIN_SCORE = 100_000;

function evaluate(board: Board): number {
  let score = 0;
  let blackMen = 0;
  let whiteMen = 0;
  for (let i = 0; i < 64; i++) {
    const piece = board[i];
    if (!piece) continue;
    const row = Math.floor(i / 8);
    const col = i % 8;
    const center = 3.5 - Math.abs(3.5 - col) + 3.5 - Math.abs(3.5 - row);
    if (piece.k) {
      score += piece.c === "b" ? MATERIAL_KING : -MATERIAL_KING;
      score += (piece.c === "b" ? 1 : -1) * center * 2.5;
    } else {
      if (piece.c === "b") blackMen++; else whiteMen++;
      score += piece.c === "b" ? MATERIAL_MAN : -MATERIAL_MAN;
      // Reward advancement and central squares without outweighing material.
      const advancement = piece.c === "b" ? row : 7 - row;
      const positional = advancement * 3 + center * 1.8;
      score += piece.c === "b" ? positional : -positional;
      // Men on the home rank protect promotion lanes.
      if ((piece.c === "b" && row === 0) || (piece.c === "w" && row === 7)) {
        score += piece.c === "b" ? 5 : -5;
      }
    }
  }
  // A small material-dependent bonus rewards keeping pieces active.
  score += (blackMen - whiteMen) * 1.5;
  return score;
}

function moveOrderScore(move: Move): number {
  return move.captures.length * 100 + (move.promote ? 80 : 0);
}

function positionKey(board: Board, color: Color, depth: number): string {
  let key = color + ":" + depth + ":";
  for (const piece of board) key += piece ? (piece.c === "b" ? "b" : "w") + (piece.k ? "K" : "m") : ".";
  return key;
}

type SearchEntry = { score: number; bestMove: Move | null; bound: "exact" | "lower" | "upper" };
function search(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  color: Color,
  table: Map<string, SearchEntry>,
): number {
  const moves = legalMoves(board, color);
  if (moves.length === 0) return color === "b" ? -WIN_SCORE - depth : WIN_SCORE + depth;
  if (depth <= 0) return evaluate(board);

  const key = positionKey(board, color, depth);
  const originalAlpha = alpha;
  const originalBeta = beta;
  const cached = table.get(key);
  if (cached) {
    if (cached.bound === "exact") return cached.score;
    if (cached.bound === "lower") alpha = Math.max(alpha, cached.score);
    if (cached.bound === "upper") beta = Math.min(beta, cached.score);
    if (beta <= alpha) return cached.score;
  }

  const ordered = [...moves].sort((a, b) => moveOrderScore(b) - moveOrderScore(a));
  const maximizing = color === "b";
  let best = maximizing ? -Infinity : Infinity;
  let bestMove: Move | null = null;
  let cutoff = false;

  for (const move of ordered) {
    const next = applyMove(board, move);
    const value = search(next, depth - 1, alpha, beta, maximizing ? "w" : "b", table);
    if ((maximizing && value > best) || (!maximizing && value < best)) {
      best = value;
      bestMove = move;
    }
    if (maximizing) alpha = Math.max(alpha, best);
    else beta = Math.min(beta, best);
    if (beta <= alpha) { cutoff = true; break; }
  }

  // Preserve alpha-beta bounds so transposition hits never treat a cutoff as exact.
  if (table.size >= 50_000) table.clear();
  const bound: SearchEntry["bound"] = best <= originalAlpha ? "upper" : best >= originalBeta ? "lower" : "exact";
  table.set(key, { score: best, bestMove, bound });
  return best;
}

export function pickAIMove(board: Board, color: Color, depth = 4): Move | null {
  const moves = legalMoves(board, color);
  if (!moves.length) return null;
  const safeDepth = Math.max(1, Math.min(7, Math.floor(depth)));
  const table = new Map<string, SearchEntry>();
  const ordered = [...moves].sort((a, b) => moveOrderScore(b) - moveOrderScore(a));
  let best = ordered[0];
  let bestScore = color === "b" ? -Infinity : Infinity;
  let alpha = -Infinity;
  let beta = Infinity;

  for (const move of ordered) {
    const score = search(
      applyMove(board, move),
      safeDepth - 1,
      alpha,
      beta,
      color === "b" ? "w" : "b",
      table,
    );
    if ((color === "b" && score > bestScore) || (color === "w" && score < bestScore)) {
      bestScore = score;
      best = move;
    }
    if (color === "b") alpha = Math.max(alpha, bestScore);
    else beta = Math.min(beta, bestScore);
  }
  return best;
}
