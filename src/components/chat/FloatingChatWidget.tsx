import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Maximize2, Settings } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

type BubblePosition = { left: number; top: number };

const BUBBLE_SIZE = 56;
const EDGE_GAP = 8;
const POSITION_KEY = "tigerchat-floating-bubble-position";
const PREFS_KEY = "tigerchat-floating-bubble-prefs";
const HIDDEN_KEY = "tigerchat-floating-bubble-hidden";
const ENABLED_KEY = "tigerchat-floating-bubble-enabled";
const BUBBLE_SETTINGS_EVENT = "tigerchat:bubble-settings-changed";
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
export const FloatingChatWidget = ({ unreadMessages = 0 }: { unreadMessages?: number }) => {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(() => { try { return window.localStorage.getItem(ENABLED_KEY) !== "false"; } catch { return true; } });
  const [position, setPosition] = useState<BubblePosition | null>(null);
  const [prefs, setPrefs] = useState<BubblePrefs>(() => { try { return { ...DEFAULT_PREFS, ...JSON.parse(window.localStorage.getItem(PREFS_KEY) || "{}") }; } catch { return DEFAULT_PREFS; } });
  const [launcherHidden, setLauncherHidden] = useState(() => { try { return window.localStorage.getItem(HIDDEN_KEY) === "true"; } catch { return false; } });
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
  useEffect(() => { try { window.localStorage.setItem(HIDDEN_KEY, String(launcherHidden)); } catch { /* storage may be unavailable */ } }, [launcherHidden]);
  useEffect(() => {
    const sync = () => {
      try {
        setEnabled(window.localStorage.getItem(ENABLED_KEY) !== "false");
        setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(window.localStorage.getItem(PREFS_KEY) || "{}") });
        setLauncherHidden(window.localStorage.getItem(HIDDEN_KEY) === "true");
      } catch { /* ignore unavailable storage */ }
    };
    window.addEventListener(BUBBLE_SETTINGS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(BUBBLE_SETTINGS_EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
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
              <button type="button" onClick={() => navigate("/settings")} aria-label="Bubble settings in General Settings" title="Bubble settings" className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><Settings className="h-4 w-4" /></button>
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
                    <iframe
            title="TigerChat conversations"
            src="/chats?bubble=1"
            className="min-h-0 w-full flex-1 border-0 bg-background"
            allow="camera; microphone; display-capture; geolocation"
          />
        </section>
      )}

      {enabled && !launcherHidden ? <button
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
        {!open && unreadMessages > 0 && <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-background bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{unreadMessages > 99 ? "99+" : unreadMessages}</span>}
      </button> : <button type="button" onClick={() => setLauncherHidden(false)} className="fixed bottom-4 right-4 z-[101] rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-lg">Restore TigerChat bubble</button>}
    </>
  );
};
