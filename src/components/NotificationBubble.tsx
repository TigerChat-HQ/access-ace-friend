import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle, Minus, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getNotificationPreferences, saveNotificationPreferences, type FloatingBubblePosition, type NotificationPreferences } from "@/lib/notification-preferences";

type BubbleNotice = { title: string; body: string; url: string; tag: string; kind: "chat" | "social"; icon?: string };
type Point = { x: number; y: number };

const bubblePixels: Record<NotificationPreferences["floatingBubbleSize"], number> = {
  small: 44,
  medium: 52,
  large: 60,
};
const edgeGap = 12;
const dragThreshold = 6;

const getBounds = (size: number, width: number, height: number) => {
  const nav = document.querySelector<HTMLElement>('nav[aria-label="Main navigation"]');
  const navRect = nav?.getBoundingClientRect();
  const bottomBoundary = navRect && navRect.height > 0 && navRect.top < height
    ? Math.min(height, navRect.top)
    : height;

  return {
    minX: edgeGap,
    maxX: Math.max(edgeGap, width - size - edgeGap),
    minY: edgeGap,
    maxY: Math.max(edgeGap, bottomBoundary - size - edgeGap),
    bottomBoundary,
  };
};

const clampPoint = (point: Point, size: number, width: number, height: number): Point => {
  const bounds = getBounds(size, width, height);
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, point.x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, point.y)),
  };
};

const pointFromPosition = (position: FloatingBubblePosition, size: number, width: number, height: number): Point => {
  const bounds = getBounds(size, width, height);
  return {
    x: position.side === "left" ? bounds.minX : bounds.maxX,
    y: bounds.minY + (bounds.maxY - bounds.minY) * position.verticalOffset,
  };
};

export const NotificationBubble = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [notice, setNotice] = useState<BubbleNotice | null>(null);
  const [preferences, setPreferences] = useState(() => getNotificationPreferences(user?.id));
  const [expanded, setExpanded] = useState(false);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === "undefined" ? 360 : window.innerWidth,
    height: typeof window === "undefined" ? 640 : window.innerHeight,
  }));
  const [dragPoint, setDragPoint] = useState<Point | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
    startedOnButton: boolean;
  } | null>(null);
  const pointRef = useRef<Point>({ x: 0, y: 0 });
  const suppressClickRef = useRef(false);

  const bubbleSize = bubblePixels[preferences.floatingBubbleSize] ?? bubblePixels.small;
  const dockedPoint = pointFromPosition(preferences.floatingBubblePosition, bubbleSize, viewport.width, viewport.height);
  const currentPoint = dragPoint ?? dockedPoint;
  pointRef.current = currentPoint;

  useEffect(() => {
    const updatePreferences = () => setPreferences(getNotificationPreferences(user?.id));
    updatePreferences();
    setExpanded(false);
    setNotice(null);
    setDragPoint(null);
    const onNotice = (event: Event) => {
      const detail = (event as CustomEvent<BubbleNotice>).detail;
      if (!detail || (detail.kind !== "chat" && detail.kind !== "social") || !getNotificationPreferences(user?.id).floatingBubble) return;
      setNotice(detail);
    };
    const onResetPosition = () => {
      const next = saveNotificationPreferences(user?.id, {
        floatingBubblePosition: { side: "right", verticalOffset: 1 },
      });
      setPreferences(next);
      setDragPoint(null);
    };

    window.addEventListener("tiger:notification-preferences-changed", updatePreferences);
    window.addEventListener("tiger:notification", onNotice);
    window.addEventListener("tiger:notification-bubble-reset-position", onResetPosition);
    return () => {
      window.removeEventListener("tiger:notification-preferences-changed", updatePreferences);
      window.removeEventListener("tiger:notification", onNotice);
      window.removeEventListener("tiger:notification-bubble-reset-position", onResetPosition);
    };
  }, [user?.id]);

  useEffect(() => {
    const visualViewport = window.visualViewport;
    const onResize = () => {
      const visibleHeight = visualViewport?.height && visualViewport.height > 0
        ? visualViewport.height
        : window.innerHeight;
      setViewport({ width: window.innerWidth, height: visibleHeight });
      setDragPoint((point) => point ? clampPoint(point, bubbleSize, window.innerWidth, visibleHeight) : null);
    };
    onResize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    visualViewport?.addEventListener("resize", onResize);
    visualViewport?.addEventListener("scroll", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      visualViewport?.removeEventListener("resize", onResize);
      visualViewport?.removeEventListener("scroll", onResize);
    };
  }, [bubbleSize]);

  useEffect(() => {
    if (!preferences.floatingBubble) {
      setExpanded(false);
      setNotice(null);
      setDragPoint(null);
    }
  }, [preferences.floatingBubble]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      const clientX = Number.isFinite(event.clientX) ? event.clientX : drag.startX;
      const clientY = Number.isFinite(event.clientY) ? event.clientY : drag.startY;
      const deltaX = clientX - drag.startX;
      const deltaY = clientY - drag.startY;
      if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return;
      if (!drag.moved && Math.hypot(deltaX, deltaY) < dragThreshold) return;

      drag.moved = true;
      event.preventDefault();
      const nextPoint = clampPoint(
        { x: drag.originX + deltaX, y: drag.originY + deltaY },
        bubbleSize,
        window.innerWidth,
        window.innerHeight,
      );
      pointRef.current = nextPoint;
      setDragPoint(nextPoint);
    };

    const finishDrag = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      if (!drag.moved) return;

      const bounds = getBounds(bubbleSize, window.innerWidth, window.innerHeight);
      const side: FloatingBubblePosition["side"] = pointRef.current.x + bubbleSize / 2 < window.innerWidth / 2 ? "left" : "right";
      const snappedPoint = {
        x: side === "left" ? bounds.minX : bounds.maxX,
        y: Math.min(bounds.maxY, Math.max(bounds.minY, pointRef.current.y)),
      };
      const verticalRange = bounds.maxY - bounds.minY;
      const verticalOffset = verticalRange > 0
        ? (snappedPoint.y - bounds.minY) / verticalRange
        : 1;
      const next = saveNotificationPreferences(user?.id, {
        floatingBubblePosition: { side, verticalOffset },
      });
      setPreferences(next);
      setDragPoint(null);

      if (drag.startedOnButton) {
        suppressClickRef.current = true;
        window.setTimeout(() => { suppressClickRef.current = false; }, 100);
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [bubbleSize, user?.id]);

  const beginDrag = (event: ReactPointerEvent<HTMLElement>, startedOnButton: boolean) => {
    if (dragRef.current || (event.pointerType === "mouse" && event.button !== 0)) return;
    if (!startedOnButton && (event.target as HTMLElement).closest("button")) return;

    dragRef.current = {
      pointerId: event.pointerId,
      startX: Number.isFinite(event.clientX) ? event.clientX : pointRef.current.x,
      startY: Number.isFinite(event.clientY) ? event.clientY : pointRef.current.y,
      originX: pointRef.current.x,
      originY: pointRef.current.y,
      moved: false,
      startedOnButton,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture may be unavailable in older embedded browsers.
    }
  };

  const chatFrameUrl = useMemo(() => {
    const url = new URL(notice?.url || "/chats", window.location.origin);
    if (url.origin !== window.location.origin) return "/chats?bubble=1";
    url.searchParams.set("bubble", "1");
    return url.pathname + url.search + url.hash;
  }, [notice?.url]);

  if (!preferences.floatingBubble || !user || location.search.includes("bubble=1")) return null;

  const bounds = getBounds(bubbleSize, viewport.width, viewport.height);
  const spaceAbove = Math.max(0, currentPoint.y - edgeGap);
  const spaceBelow = Math.max(0, bounds.bottomBoundary - (currentPoint.y + bubbleSize) - edgeGap);
  const openAbove = spaceAbove >= spaceBelow;
  const panelMaxHeight = Math.max(180, Math.min(620, viewport.height * 0.72, openAbove ? spaceAbove : spaceBelow));
  const panelStyle: CSSProperties = {
    ...(preferences.floatingBubblePosition.side === "left" ? { left: 0 } : { right: 0 }),
    ...(openAbove ? { bottom: `calc(100% + ${edgeGap}px)` } : { top: `calc(100% + ${edgeGap}px)` }),
    height: `${panelMaxHeight}px`,
    maxHeight: `${panelMaxHeight}px`,
    minHeight: "160px",
  };
  const iconSize = Math.round(bubbleSize * 0.42);

  return (
    <div className="fixed z-[120]" style={{ left: currentPoint.x, top: currentPoint.y }}>
      {expanded && (
        <section
          aria-label="TIGERCHATS floating chat"
          className="absolute flex h-[min(72dvh,620px)] w-[min(22rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-primary/40 bg-background shadow-2xl animate-fade-in"
          style={panelStyle}
        >
          <header
            aria-label="Drag floating chat panel"
            onPointerDown={(event) => beginDrag(event, false)}
            className="flex h-12 shrink-0 select-none touch-none cursor-grab active:cursor-grabbing items-center gap-2 border-b border-border bg-card px-3"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
              <MessageCircle className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">TIGERCHATS</span>
              <span className="block text-[10px] text-muted-foreground">{notice ? "Ujumbe mpya" : "Chat ya haraka"}</span>
            </span>
            <button type="button" onClick={() => setExpanded(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Minimize chat">
              <Minus className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => { setExpanded(false); setNotice(null); }} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Close chat">
              <X className="h-4 w-4" />
            </button>
          </header>
          <iframe
            key={chatFrameUrl}
            title="TIGERCHATS quick chat"
            src={chatFrameUrl}
            className="min-h-0 w-full flex-1 border-0 bg-background"
            allow="camera; microphone; clipboard-read; clipboard-write"
          />
        </section>
      )}
      <button
        type="button"
        onPointerDown={(event) => beginDrag(event, true)}
        onClick={(event) => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            event.preventDefault();
            return;
          }
          setExpanded((value) => !value);
          setNotice(null);
        }}
        aria-label={expanded ? "Minimize floating chat" : "Open floating chat"}
        aria-expanded={expanded}
        title="Drag to move · Tap to open chat"
        className="relative flex items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-[0_8px_26px_hsl(var(--primary)/.42)] transition-transform hover:scale-105 active:scale-95 touch-none select-none cursor-grab active:cursor-grabbing"
        style={{ width: bubbleSize, height: bubbleSize, touchAction: "none" }}
      >
        {notice?.icon
          ? <img src={notice.icon} alt="" className="h-full w-full rounded-full object-cover" />
          : <MessageCircle style={{ width: iconSize, height: iconSize }} />}
        {notice && !expanded && <span className="absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full border-2 border-background bg-destructive" />}
      </button>
    </div>
  );
};
