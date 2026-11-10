import { useEffect, useMemo, useState } from "react";
import { MessageCircle, X, Minus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getNotificationPreferences } from "@/lib/notification-preferences";

type BubbleNotice = { title: string; body: string; url: string; tag: string; kind: "chat" | "social" };

export const NotificationBubble = () => {
  const { user } = useAuth();
  const [notice, setNotice] = useState<BubbleNotice | null>(null);
  const [enabled, setEnabled] = useState(() => getNotificationPreferences(user?.id).floatingBubble);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const update = () => setEnabled(getNotificationPreferences(user?.id).floatingBubble);
    const onNotice = (event: Event) => {
      const detail = (event as CustomEvent<BubbleNotice>).detail;
      if (!detail || detail.kind !== "chat" || !getNotificationPreferences(user?.id).floatingBubble) return;
      setNotice(detail);
    };
    window.addEventListener("tiger:notification-preferences-changed", update);
    window.addEventListener("tiger:notification", onNotice);
    return () => {
      window.removeEventListener("tiger:notification-preferences-changed", update);
      window.removeEventListener("tiger:notification", onNotice);
    };
  }, [user?.id]);

  const chatFrameUrl = useMemo(() => {
    const url = new URL(notice?.url || "/chats", window.location.origin);
    if (url.origin !== window.location.origin) return "/chats?bubble=1";
    url.searchParams.set("bubble", "1");
    return url.pathname + url.search + url.hash;
  }, [notice?.url]);

  if (!enabled || !user) return null;

  return (
    <div className="fixed z-[120] bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-3 sm:bottom-5 sm:right-5">
      {expanded && (
        <section
          aria-label="TIGERCHATS floating chat"
          className="absolute bottom-[4.25rem] right-0 flex h-[min(72dvh,620px)] w-[min(22rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-primary/40 bg-background shadow-2xl animate-fade-in"
        >
          <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
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
        onClick={() => { setExpanded((value) => !value); setNotice(null); }}
        aria-label={expanded ? "Minimize floating chat" : "Open floating chat"}
        aria-expanded={expanded}
        className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-[0_8px_26px_hsl(var(--primary)/.42)] transition-transform hover:scale-105 active:scale-95"
      >
        <MessageCircle className="h-6 w-6" />
        {notice && !expanded && <span className="absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full border-2 border-background bg-destructive" />}
      </button>
    </div>
  );
};
