import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getNotificationPreferences } from "@/lib/notification-preferences";

type BubbleNotice = { title: string; body: string; url: string; tag: string; kind: "chat" | "social" };

export const NotificationBubble = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notice, setNotice] = useState<BubbleNotice | null>(null);
  const [enabled, setEnabled] = useState(() => getNotificationPreferences(user?.id).floatingBubble);

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

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 9000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  if (!enabled || !notice) return null;
  return (
    <div className="fixed z-[100] bottom-20 right-3 sm:bottom-5 sm:right-5 w-[min(21rem,calc(100vw-1.5rem))] animate-fade-in">
      <div className="rounded-2xl border border-primary/30 bg-card/95 p-3 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => { navigate(notice.url); setNotice(null); }}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            aria-label="Open new message"
          >
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <MessageCircle className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-card bg-primary" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">{notice.title}</span>
              <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">{notice.body}</span>
              <span className="mt-1 block text-[10px] font-semibold text-primary">Gusa kufungua mazungumzo</span>
            </span>
          </button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setNotice(null)} aria-label="Dismiss notification">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
