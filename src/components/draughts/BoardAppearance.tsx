import { useEffect, useState, type CSSProperties } from "react";

export type BoardTheme = "wood" | "slate" | "ocean" | "forest";
export type PieceStyle = "classic" | "ivory" | "ruby" | "gold";

const STORAGE_KEY = "tigerchats-draughts-appearance-v1";

const themes: { value: BoardTheme; label: string; dark: string; light: string; frame: string }[] = [
  { value: "wood", label: "Classic Wood", dark: "#87502e", light: "#e7c99f", frame: "linear-gradient(135deg,#f2d6a4,#8b572f,#3f2417)" },
  { value: "slate", label: "Slate Gray", dark: "#475569", light: "#cbd5e1", frame: "linear-gradient(135deg,#e2e8f0,#64748b,#1e293b)" },
  { value: "ocean", label: "Ocean Blue", dark: "#164e78", light: "#b9dced", frame: "linear-gradient(135deg,#bae6fd,#0369a1,#082f49)" },
  { value: "forest", label: "Forest Green", dark: "#245b3c", light: "#c5dfc5", frame: "linear-gradient(135deg,#bbf7d0,#166534,#052e16)" },
];

const pieces: { value: PieceStyle; label: string; white: string; black: string; whiteBorder: string; blackBorder: string }[] = [
  { value: "classic", label: "Classic · White & Black", white: "#f8fafc", black: "#18181b", whiteBorder: "#cbd5e1", blackBorder: "#52525b" },
  { value: "ivory", label: "Ivory & Onyx", white: "#fff1cf", black: "#171717", whiteBorder: "#d6b978", blackBorder: "#525252" },
  { value: "ruby", label: "Ruby & Sapphire", white: "#e11d48", black: "#1d4ed8", whiteBorder: "#fecdd3", blackBorder: "#93c5fd" },
  { value: "gold", label: "Gold & Silver", white: "#d4a017", black: "#94a3b8", whiteBorder: "#fde68a", blackBorder: "#e2e8f0" },
];

const defaults = { theme: "wood" as BoardTheme, pieces: "classic" as PieceStyle };

export function useDraughtsAppearance() {
  const [theme, setTheme] = useState<BoardTheme>(defaults.theme);
  const [pieceStyle, setPieceStyle] = useState<PieceStyle>(defaults.pieces);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { theme?: string; pieces?: string };
      if (themes.some((item) => item.value === parsed.theme)) setTheme(parsed.theme as BoardTheme);
      if (pieces.some((item) => item.value === parsed.pieces)) setPieceStyle(parsed.pieces as PieceStyle);
    } catch {
      // Ignore unavailable storage or malformed preferences.
    }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme, pieces: pieceStyle })); }
    catch { /* Preferences remain usable for this session if storage is unavailable. */ }
  }, [theme, pieceStyle]);

  const boardTheme = themes.find((item) => item.value === theme) ?? themes[0];
  const pieceTheme = pieces.find((item) => item.value === pieceStyle) ?? pieces[0];
  const boardStyle = {
    "--board-dark": boardTheme.dark,
    "--board-light": boardTheme.light,
    "--board-frame": boardTheme.frame,
    "--piece-white": pieceTheme.white,
    "--piece-black": pieceTheme.black,
    "--piece-white-border": pieceTheme.whiteBorder,
    "--piece-black-border": pieceTheme.blackBorder,
  } as CSSProperties;

  return { theme, setTheme, pieceStyle, setPieceStyle, boardStyle };
}

export function BoardAppearance({
  theme, setTheme, pieceStyle, setPieceStyle,
}: {
  theme: BoardTheme;
  setTheme: (value: BoardTheme) => void;
  pieceStyle: PieceStyle;
  setPieceStyle: (value: PieceStyle) => void;
}) {
  return (
    <section className="rounded-xl border border-border/60 bg-card/70 p-3 space-y-3" aria-label="Board appearance settings">
      <h2 className="text-sm font-semibold">Board appearance</h2>
      <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        Board Theme
        <select value={theme} onChange={(event) => setTheme(event.target.value as BoardTheme)} className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground">
          {themes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <span className="flex gap-1.5" aria-hidden="true">{themes.map((item) => <span key={item.value} title={item.label} className="h-5 flex-1 rounded border border-border/50" style={{ background: `linear-gradient(90deg,${item.dark} 50%,${item.light} 50%)` }} />)}</span>
      </label>
      <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        Piece Style / Set
        <select value={pieceStyle} onChange={(event) => setPieceStyle(event.target.value as PieceStyle)} className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground">
          {pieces.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <span className="flex gap-2" aria-hidden="true">{pieces.map((item) => <span key={item.value} className="flex flex-1 items-center justify-center gap-1 rounded border border-border/50 py-1"><i className="h-4 w-4 rounded-full border" style={{ background: item.white, borderColor: item.whiteBorder }} /><i className="h-4 w-4 rounded-full border" style={{ background: item.black, borderColor: item.blackBorder }} /></span>)}</span>
      </label>
    </section>
  );
}
