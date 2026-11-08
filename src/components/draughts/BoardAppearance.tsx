import { useEffect, useState, type CSSProperties } from "react";
import { Settings2, Volume2, VolumeX, X } from "lucide-react";

export type BoardTheme = "wood" | "slate" | "ocean" | "forest";
export type PieceStyle = "classic" | "ivory" | "ruby" | "gold";

const STORAGE_KEY = "tigerchats-draughts-appearance-v2";
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

export function useDraughtsAppearance() {
  const [theme, setTheme] = useState<BoardTheme>("wood");
  const [pieceStyle, setPieceStyle] = useState<PieceStyle>("classic");
  const [scale, setScale] = useState(100);
  const [depth, setDepth] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { theme?: string; pieces?: string; scale?: number; depth?: boolean };
      if (themes.some((item) => item.value === parsed.theme)) setTheme(parsed.theme as BoardTheme);
      if (pieces.some((item) => item.value === parsed.pieces)) setPieceStyle(parsed.pieces as PieceStyle);
      if (typeof parsed.scale === "number") setScale(Math.min(120, Math.max(80, parsed.scale)));
      if (typeof parsed.depth === "boolean") setDepth(parsed.depth);
    } catch { /* Keep safe defaults when saved preferences are unavailable. */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme, pieces: pieceStyle, scale, depth })); }
    catch { /* Settings remain available for this session. */ }
  }, [theme, pieceStyle, scale, depth]);

  const boardTheme = themes.find((item) => item.value === theme) ?? themes[0];
  const pieceTheme = pieces.find((item) => item.value === pieceStyle) ?? pieces[0];
  const boardStyle = {
    "--board-dark": boardTheme.dark, "--board-light": boardTheme.light, "--board-frame": boardTheme.frame,
    "--piece-white": pieceTheme.white, "--piece-black": pieceTheme.black,
    "--piece-white-border": pieceTheme.whiteBorder, "--piece-black-border": pieceTheme.blackBorder,
  } as CSSProperties;
  const boardSizeStyle = { width: `min(100%, ${520 * scale / 100}px)`, maxWidth: "100%" } as CSSProperties;
  const board3dStyle = depth ? {
    transform: "perspective(1100px) rotateX(5deg) translateZ(8px)",
    transformOrigin: "center center",
    filter: "drop-shadow(0 24px 22px rgba(0,0,0,.42))",
  } as CSSProperties : { transform: "none", filter: "none" } as CSSProperties;

  return { theme, setTheme, pieceStyle, setPieceStyle, scale, setScale, depth, setDepth, boardStyle, boardSizeStyle, board3dStyle };
}

export function BoardAppearance({
  theme, setTheme, pieceStyle, setPieceStyle, scale, setScale, depth, setDepth,
  soundEnabled, setSoundEnabled, soundVolume, setSoundVolume, reactionVolume, setReactionVolume,
}: {
  theme: BoardTheme; setTheme: (value: BoardTheme) => void;
  pieceStyle: PieceStyle; setPieceStyle: (value: PieceStyle) => void;
  scale: number; setScale: (value: number) => void;
  depth: boolean; setDepth: (value: boolean) => void;
  soundEnabled: boolean; setSoundEnabled: (value: boolean) => void;
  soundVolume: number; setSoundVolume: (value: number) => void;
  reactionVolume: number; setReactionVolume: (value: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative z-30">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Draughts settings"
        className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-card/90 px-3 py-2 text-xs font-semibold text-foreground shadow-lg backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-xl">
        <Settings2 className="h-4 w-4 text-primary" /> Draughts settings
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 max-h-[75vh] w-[min(90vw,340px)] overflow-y-auto rounded-2xl border border-primary/25 bg-card/95 p-4 shadow-2xl backdrop-blur-2xl ring-1 ring-white/10">
          <div className="mb-3 flex items-center justify-between">
            <div><p className="text-sm font-bold text-foreground">Draughts settings</p><p className="text-[10px] text-muted-foreground">Board & sound controls</p></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close draughts settings" className="rounded-lg p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">Board settings</p>
          <label className="mb-3 block space-y-1.5 text-xs text-muted-foreground">Board theme
            <select value={theme} onChange={(event) => setTheme(event.target.value as BoardTheme)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground">
              {themes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="mb-3 block space-y-1.5 text-xs text-muted-foreground">Piece style / set
            <select value={pieceStyle} onChange={(event) => setPieceStyle(event.target.value as PieceStyle)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground">
              {pieces.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="mb-3 block space-y-2 text-xs text-muted-foreground">
            <span className="flex justify-between"><span>Board size</span><strong className="text-foreground">{scale}%</strong></span>
            <input type="range" min="80" max="120" step="5" value={scale} onChange={(event) => setScale(Number(event.target.value))} className="w-full accent-primary" />
            <span className="flex justify-between text-[10px]"><span>Compact</span><span>Large</span></span>
          </label>
          <label className="mb-3 flex cursor-pointer items-center justify-between rounded-xl border border-border/70 bg-background/70 p-3 text-xs text-foreground">
            <span><strong className="block">3D depth effect</strong><span className="text-[10px] text-muted-foreground">Perspective, lift & shadow</span></span>
            <input type="checkbox" checked={depth} onChange={(event) => setDepth(event.target.checked)} className="h-4 w-4 accent-primary" />
          </label>
          <div className="my-4 border-t border-border/70 pt-3">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">Sound settings</p>
            <button type="button" onClick={() => setSoundEnabled(!soundEnabled)} className="mb-3 flex w-full items-center justify-between rounded-xl border border-border/70 bg-background/70 p-3 text-xs text-foreground">
              <span className="font-semibold">Game & emoji sounds</span>
              <span className="flex items-center gap-1">{soundEnabled ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4" />}{soundEnabled ? "On" : "Off"}</span>
            </button>
            <label className="mb-3 block space-y-1.5 text-xs text-muted-foreground">
              <span className="flex justify-between"><span>Game volume</span><strong className="text-foreground">{Math.round(soundVolume * 100)}%</strong></span>
              <input type="range" min="0" max="1" step="0.05" value={soundVolume} onChange={(event) => setSoundVolume(Number(event.target.value))} className="w-full accent-primary" />
            </label>
            <label className="block space-y-1.5 text-xs text-muted-foreground">
              <span className="flex justify-between"><span>Emoji volume</span><strong className="text-foreground">{Math.round(reactionVolume * 100)}%</strong></span>
              <input type="range" min="0" max="1" step="0.05" value={reactionVolume} onChange={(event) => setReactionVolume(Number(event.target.value))} className="w-full accent-primary" />
            </label>
            <p className="mt-2 text-[10px] text-muted-foreground">😂 plays a human laugh; the winner hears a tiger roar.</p>
          </div>
        </div>
      )}
    </div>
  );
}
