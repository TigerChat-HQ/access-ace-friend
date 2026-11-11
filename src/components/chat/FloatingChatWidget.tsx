import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Maximize2, Settings } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

type BubblePosition = { left: number; top: number };

const BUBBLE_SIZE = 56;
const EDGE_GAP = 8;
const POSITION_KEY = "tigerchat-floating-bubble-position";
const PREFS_KEY = "tigerchat-floating-bubble-prefs";
type BubblePrefs = { size: "small" | "normal" | "large"; color: "primary" | "blue" | "purple" | "orange"; shape: "circle" | "rounded"; opacity: 70 | 85 | 100; snap: boolean };
const DEFAULT_PREFS: BubblePrefs = { size: "normal", color: "primary", shape: "circle", opacity: 100, snap: true };
const bubbleSizes = { small: 48, normal: 56, large: 66 };
const bubbleColors = { primary: "bg-primary", blue: "bg-blue-600", purple: "bg-purple-600", orange: "bg-orange-600" };

const clampPosition = (position: BubblePosition, size = BUBBLE_SIZE): BubblePosition => ({
  left: Math.max(EDGE_GAP, Math.min(position.left, window.innerWidth - size - EDGE_GAP)),
  top: Math.max(EDGE_GAP, Math.min(position.top, window.innerHeight - size - EDGE_GAP)),
});

/**
 * Site-wide draggable floating entry point to the full TigerChat experience.
 * The embedded route uses the same authenticated web app and existing chat UI.
 */
export const FloatingChatWidget = () => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<BubblePosition | null>(null);
  const [prefs, setPrefs] = useState<BubblePrefs>(() => { try { return { ...DEFAULT_PREFS, ...JSON.parse(window.localStorage.getItem(PREFS_KEY) || "{}") }; } catch { return DEFAULT_PREFS; } });
  const [showBubbleSettings, setShowBubbleSettings] = useState(false);
  const [launcherHidden, setLauncherHidden] = useState(false);
  const bubbleSize = bubbleSizes[prefs.size];
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; left: number; top: number; moved: boolean } | null>(null);
  const draggedClickRef = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Restore the user's last bubble position and keep it inside the viewport.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(POSITION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as BubblePosition;
        if (Number.isFinite(parsed.left) && Number.isFinite(parsed.top)) {
          setPosition(clampPosition(parsed, bubbleSize));
        }
      }
    } catch {
      // Ignore unavailable storage or malformed saved coordinates.
    }

    const keepOnScreen = () => {
      setPosition((current) => (current ? clampPosition(current, bubbleSize) : current));
    };
    window.addEventListener("resize", keepOnScreen);
    return () => window.removeEventListener("resize", keepOnScreen);
  }, []);

  useEffect(() => {
    if (!position) return;
    try {
      window.localStorage.setItem(POSITION_KEY, JSON.stringify(position));
    } catch {
      // The bubble remains draggable even when storage is unavailable.
    }
  }, [position]);

  useEffect(() => { try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* storage may be unavailable */ } }, [prefs]);
  useEffect(() => { setPosition((current) => current ? clampPosition(current, bubbleSize) : current); }, [bubbleSize]);

  // The embedded chat route hides this launcher to prevent recursive iframes.
  if (location.search.includes("bubble=1")) return null;

  const openFullChat = () => {
    setOpen(false);
    navigate("/chats");
  };

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const current = position ?? { left: rect.left, top: rect.top };
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: current.left,
      top: current.top,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.abs(deltaX) + Math.abs(deltaY) < 5) return;
    drag.moved = true;
    setPosition(clampPosition({ left: drag.left + deltaX, top: drag.top + deltaY }, bubbleSize));
  };

  const finishDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    draggedClickRef.current = Boolean(dragRef.current.moved);
    if (dragRef.current.moved && prefs.snap) {
      const current = position ?? { left: dragRef.current.left, top: dragRef.current.top };
      const leftEdge = current.left + bubbleSize / 2 < window.innerWidth / 2;
      setPosition(clampPosition({ left: leftEdge ? EDGE_GAP : window.innerWidth - bubbleSize - EDGE_GAP, top: current.top }, bubbleSize));
    }
    dragRef.current = null;
  };

  const toggleBubble = () => {
    if (draggedClickRef.current) {
      draggedClickRef.current = false;
      return;
    }
    setOpen((value) => !value);
  };

  return (
    <>
      {open && (
        <section
          aria-label="TigerChat floating chat"
          className="fixed z-[100] flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl"
          style={{
            right: "max(12px, env(safe-area-inset-right, 0px))",
            bottom: "calc(88px + env(safe-area-inset-bottom, 0px))",
            width: "min(430px, calc(100vw - 24px))",
            height: "min(680px, calc(var(--tiger-viewport-height, 100dvh) - 112px))",
          }}
        >
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/70 bg-card px-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <MessageCircle className="h-4 w-4" />
              </span>
              TigerChat
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setShowBubbleSettings((value) => !value)} aria-label="Bubble customization" title="Bubble settings" className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><Settings className="h-4 w-4" /></button>
              <button
                type="button"
                onClick={openFullChat}
                aria-label="Open chats page"
                title="Open full chats"
                className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close floating chat"
                className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>
          {showBubbleSettings && <div className="shrink-0 border-b border-border/70 bg-card p-3 text-xs"><div className="mb-2 flex items-center justify-between"><strong>Floating bubble</strong><div className="flex items-center gap-3"><button type="button" onClick={() => setPrefs(DEFAULT_PREFS)} className="text-primary">Reset</button><button type="button" onClick={() => { setLauncherHidden(true); setOpen(false); setShowBubbleSettings(false); }} className="text-destructive">Hide bubble</button></div></div><div className="mb-3 flex items-center gap-2"><span className="w-16 text-muted-foreground">Size</span>{(["small", "normal", "large"] as const).map((size) => <button key={size} type="button" onClick={() => setPrefs((p) => ({ ...p, size }))} aria-pressed={prefs.size === size} className={`rounded-lg border px-2 py-1 capitalize ${prefs.size === size ? "border-primary text-primary" : "border-border"}`}>{size}</button>)}</div><div className="mb-3 flex items-center gap-2"><span className="w-16 text-muted-foreground">Color</span>{(Object.keys(bubbleColors) as Array<keyof typeof bubbleColors>).map((color) => <button key={color} type="button" onClick={() => setPrefs((p) => ({ ...p, color }))} aria-label={color} aria-pressed={prefs.color === color} className={`h-6 w-6 rounded-full ${bubbleColors[color]} ${prefs.color === color ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""}`} />)}</div><div className="mb-3 flex flex-wrap items-center gap-2"><span className="w-16 text-muted-foreground">Shape</span>{(["circle", "rounded"] as const).map((shape) => <button key={shape} type="button" onClick={() => setPrefs((p) => ({ ...p, shape }))} aria-pressed={prefs.shape === shape} className={`border px-3 py-1 ${shape === "circle" ? "rounded-full" : "rounded-lg"} ${prefs.shape === shape ? "border-primary text-primary" : "border-border"}`}>{shape}</button>)}<span className="ml-2 text-muted-foreground">Opacity</span>{([100, 85, 70] as const).map((opacity) => <button key={opacity} type="button" onClick={() => setPrefs((p) => ({ ...p, opacity }))} aria-pressed={prefs.opacity === opacity} className={`rounded border px-2 py-1 ${prefs.opacity === opacity ? "border-primary text-primary" : "border-border"}`}>{opacity}%</button>)}</div><label className="flex items-center gap-2"><input type="checkbox" checked={prefs.snap} onChange={(event) => setPrefs((p) => ({ ...p, snap: event.target.checked }))} /> Snap bubble to nearest screen edge after dragging</label>{typeof window.TigerNative?.openMessageBubbleSettings === "function" && <button type="button" onClick={() => window.TigerNative?.openMessageBubbleSettings?.()} className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-left text-xs font-medium hover:bg-muted">Manage Android notification bubbles…</button>}</div>}
          <iframe
            title="TigerChat conversations"
            src="/chats?bubble=1"
            className="min-h-0 w-full flex-1 border-0 bg-background"
            allow="camera; microphone; display-capture; geolocation"
          />
        </section>
      )}

      {!launcherHidden ? <button
        type="button"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onClick={toggleBubble}
        onContextMenu={(event) => event.preventDefault()}
        aria-label={open ? "Close TigerChat or drag to move" : "Open TigerChat or drag to move"}
        aria-expanded={open}
        title="Drag to move"
        className={`fixed z-[101] flex touch-none select-none items-center justify-center ${prefs.shape === "circle" ? "rounded-full" : "rounded-2xl"} border border-primary-foreground/20 ${bubbleColors[prefs.color]} text-white shadow-[0_8px_30px_hsl(var(--primary)/0.4)] transition-transform duration-200 hover:scale-105 active:scale-95`}
        style={{ width: bubbleSize, height: bubbleSize, opacity: prefs.opacity / 100, ...(position ? { left: position.left, top: position.top } : { right: "max(16px, env(safe-area-inset-right, 0px))", bottom: "calc(18px + env(safe-area-inset-bottom, 0px))" }) }}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open && <span className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-background bg-emerald-400" />}
      </button> : <button type="button" onClick={() => setLauncherHidden(false)} className="fixed bottom-4 right-4 z-[101] rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-lg">Restore TigerChat bubble</button>}
    </>
  );
};
