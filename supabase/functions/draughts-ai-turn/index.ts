import { createClient } from "npm:@supabase/supabase-js@2";

type Color = "w" | "b";
type Piece = { c: Color; k: boolean };
type Board = Array<Piece | null>;
type Move = { from: number; to: number; captures: number[]; promote: boolean };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const inside = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
const dirs = (p: Piece): number[][] => p.k
  ? [[-1,-1],[-1,1],[1,-1],[1,1]]
  : p.c === "w" ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]];

function jumps(board: Board, from: number, piece: Piece, captured: number[] = []): Move[] {
  const r = Math.floor(from / 8), c = from % 8, out: Move[] = [];
  for (const [dr, dc] of dirs(piece)) {
    let mr = r + dr, mc = c + dc;
    if (piece.k) while (inside(mr, mc) && !board[mr * 8 + mc]) { mr += dr; mc += dc; }
    if (!inside(mr, mc)) continue;
    const mid = mr * 8 + mc, target = board[mid];
    if (!target || target.c === piece.c || captured.includes(mid)) continue;
    let tr = mr + dr, tc = mc + dc;
    while (inside(tr, tc) && !board[tr * 8 + tc]) {
      const to = tr * 8 + tc, next = board.slice();
      next[from] = null; next[mid] = null;
      const promote = piece.c === "w" ? tr === 0 : tr === 7;
      const moved = { c: piece.c, k: piece.k || promote };
      next[to] = moved;
      const caps = [...captured, mid], further = jumps(next, to, moved, caps);
      if (further.length) for (const f of further) out.push({ from, to: f.to, captures: f.captures, promote: promote || f.promote });
      else out.push({ from, to, captures: caps, promote });
      if (!piece.k) break;
      tr += dr; tc += dc;
    }
  }
  return out;
}
function legalMoves(board: Board, color: Color): Move[] {
  const captures: Move[] = [], quiets: Move[] = [];
  for (let i = 0; i < 64; i++) if (board[i]?.c === color) captures.push(...jumps(board, i, board[i]!));
  if (captures.length) return captures;
  for (let i = 0; i < 64; i++) {
    const p = board[i]; if (!p || p.c !== color) continue;
    const r = Math.floor(i / 8), c = i % 8;
    for (const [dr, dc] of dirs(p)) {
      let tr = r + dr, tc = c + dc;
      while (inside(tr, tc) && !board[tr * 8 + tc]) {
        quiets.push({ from: i, to: tr * 8 + tc, captures: [], promote: color === "w" ? tr === 0 : tr === 7 });
        if (!p.k) break;
        tr += dr; tc += dc;
      }
    }
  }
  return quiets;
}
function applyMove(board: Board, m: Move): Board {
  const next = board.slice(), p = next[m.from];
  if (!p) throw new Error("AI selected an empty square");
  next[m.from] = null;
  for (const i of m.captures) next[i] = null;
  next[m.to] = { c: p.c, k: p.k || m.promote };
  return next;
}
function winner(board: Board, color: Color): Color | null {
  return legalMoves(board, color).length ? null : color === "w" ? "b" : "w";
}
const evaluate = (board: Board): number => {
  let score = 0, blackMen = 0, whiteMen = 0;
  for (let i = 0; i < 64; i++) {
    const p = board[i]; if (!p) continue;
    const row = Math.floor(i / 8), col = i % 8;
    const center = 3.5 - Math.abs(3.5 - col) + 3.5 - Math.abs(3.5 - row);
    if (p.k) score += (p.c === "b" ? 1 : -1) * (325 + center * 2.5);
    else {
      if (p.c === "b") blackMen++; else whiteMen++;
      const advancement = p.c === "b" ? row : 7 - row;
      const positional = 100 + advancement * 3 + center * 1.8 + ((p.c === "b" && row === 0) || (p.c === "w" && row === 7) ? 5 : 0);
      score += (p.c === "b" ? 1 : -1) * positional;
    }
  }
  return score + (blackMen - whiteMen) * 1.5;
};
const orderScore = (m: Move) => m.captures.length * 100 + (m.promote ? 80 : 0);
function search(board: Board, depth: number, alpha: number, beta: number, color: Color): number {
  const moves = legalMoves(board, color);
  if (!moves.length) return color === "b" ? -100000 - depth : 100000 + depth;
  if (depth <= 0) return evaluate(board);
  let best = color === "b" ? -Infinity : Infinity;
  for (const m of moves.sort((a,b) => orderScore(b) - orderScore(a))) {
    const value = search(applyMove(board, m), depth - 1, alpha, beta, color === "b" ? "w" : "b");
    best = color === "b" ? Math.max(best, value) : Math.min(best, value);
    if (color === "b") alpha = Math.max(alpha, best); else beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}
function pickAIMove(board: Board, depth: number): Move | null {
  const moves = legalMoves(board, "b");
  if (!moves.length) return null;
  let best = moves[0], bestScore = -Infinity, alpha = -Infinity;
  for (const m of moves.sort((a,b) => orderScore(b) - orderScore(a))) {
    const score = search(applyMove(board, m), depth - 1, alpha, Infinity, "w");
    if (score > bestScore) { bestScore = score; best = m; }
    alpha = Math.max(alpha, bestScore);
  }
  return best;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !service) return json({ error: "Server configuration is incomplete" }, 503);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);
    const token = authHeader.slice(7);
    const authClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Invalid session" }, 401);

    const body = await req.json();
    const matchId = typeof body.match_id === "string" ? body.match_id : "";
    const revision = Number(body.revision);
    if (!/^[0-9a-f-]{36}$/i.test(matchId) || !Number.isInteger(revision)) return json({ error: "Invalid match or revision" }, 400);
    const depth = ({ easy: 2, medium: 3, hard: 4, expert: 5 } as Record<string, number>)[body.difficulty] ?? 3;
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: match, error: loadError } = await admin.from("draft_matches")
      .select("*").eq("id", matchId).maybeSingle();
    if (loadError || !match) return json({ error: "Match not found" }, 404);
    if (match.player_white !== authData.user.id || !match.vs_ai) return json({ error: "Only the human player in this AI match can request the AI turn" }, 403);
    if (match.status !== "active" || match.current_turn !== "b") return json({ error: "It is not the AI turn" }, 409);
    if (match.revision !== revision) return json({ error: "Board revision conflict" }, 409);
    const board = match.board as Board;
    if (!Array.isArray(board) || board.length !== 64) return json({ error: "Stored board is invalid" }, 500);

    const move = pickAIMove(board, depth);
    let nextBoard = board, nextTurn = "b", status = "finished", matchWinner = "white";
    if (move) {
      nextBoard = applyMove(board, move);
      const won = winner(nextBoard, "w");
      nextTurn = "w";
      status = won ? "finished" : "active";
      matchWinner = won === "w" ? "white" : won === "b" ? "black" : null;
    }
    const { data: saved, error: saveError } = await admin.rpc("commit_draft_move", {
      p_id: matchId, p_revision: revision, p_board: nextBoard,
      p_turn: nextTurn, p_move: move, p_status: status, p_winner: matchWinner,
    });
    if (saveError) {
      const conflict = /revision conflict|not active/i.test(saveError.message);
      return json({ error: saveError.message }, conflict ? 409 : 400);
    }
    return json({ match: saved, move });
  } catch (error) {
    console.error("draughts-ai-turn", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected server error" }, 500);
  }
});
