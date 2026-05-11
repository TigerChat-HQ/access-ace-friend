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
  const dirOpts = piece.k ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : dirs(piece);
  for (const [dr, dc] of dirOpts) {
    const mr = r + dr, mc = c + dc;
    const tr = r + 2 * dr, tc = c + 2 * dc;
    if (!inB(tr, tc)) continue;
    const midI = idx(mr, mc), toI = idx(tr, tc);
    const mid = board[midI];
    if (!mid || mid.c === piece.c) continue;
    if (captured.includes(midI)) continue;
    if (board[toI] && toI !== from) continue;
    // simulate
    const nb = board.slice();
    nb[from] = null;
    nb[midI] = null;
    const promote = piece.c === "w" ? tr === 0 : tr === 7;
    nb[toI] = { c: piece.c, k: piece.k || promote };
    const nextCaps = [...captured, midI];
    const further = jumpsFrom(nb, toI, nb[toI]!, nextCaps);
    if (further.length) {
      for (const f of further) out.push({ from, to: f.to, captures: [midI, ...f.captures], promote: f.promote });
    } else {
      out.push({ from: from, to: toI, captures: nextCaps, promote });
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
      const tr = r + dr, tc = c + dc;
      if (!inB(tr, tc)) continue;
      const t = idx(tr, tc);
      if (board[t]) continue;
      const promote = color === "w" ? tr === 0 : tr === 7;
      quiets.push({ from: i, to: t, captures: [], promote });
    }
  }
  return quiets;
}

export function applyMove(board: Board, m: Move): Board {
  const nb = board.slice();
  const piece = nb[m.from]!;
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

// ---- Minimax AI ----
function evaluate(board: Board): number {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p) continue;
    const v = p.k ? 3 : 1;
    score += p.c === "b" ? v : -v;
  }
  return score; // positive = good for black (AI)
}

function minimax(board: Board, depth: number, alpha: number, beta: number, color: Color): number {
  const w = winner(board, color);
  if (w) return w === "b" ? 1000 + depth : -1000 - depth;
  if (depth === 0) return evaluate(board);
  const moves = legalMoves(board, color);
  if (color === "b") {
    let best = -Infinity;
    for (const m of moves) {
      const v = minimax(applyMove(board, m), depth - 1, alpha, beta, "w");
      best = Math.max(best, v);
      alpha = Math.max(alpha, v);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      const v = minimax(applyMove(board, m), depth - 1, alpha, beta, "b");
      best = Math.min(best, v);
      beta = Math.min(beta, v);
      if (beta <= alpha) break;
    }
    return best;
  }
}

export function pickAIMove(board: Board, color: Color, depth = 4): Move | null {
  const moves = legalMoves(board, color);
  if (!moves.length) return null;
  let best = moves[0];
  let bestV = color === "b" ? -Infinity : Infinity;
  for (const m of moves) {
    const v = minimax(applyMove(board, m), depth - 1, -Infinity, Infinity, color === "b" ? "w" : "b");
    if (color === "b" ? v > bestV : v < bestV) {
      bestV = v;
      best = m;
    }
  }
  return best;
}
