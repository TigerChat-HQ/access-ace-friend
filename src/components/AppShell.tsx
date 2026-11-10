import { useEffect } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home, MessageCircle, Users, User as UserIcon, Trophy, Mail, Settings, Bot, Bell, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/tigerchats-logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { AppLockGate } from "@/components/AppLockGate";
import { CallProvider } from "@/contexts/CallContext";
import { AnnouncementGate } from "@/components/AnnouncementGate";
import { useUnreadBadges } from "@/hooks/useUnreadBadges";
import { useNotifications } from "@/hooks/useNotifications";
import { useUserRole } from "@/hooks/useUserRole";
import { NotificationBubble } from "@/components/NotificationBubble";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { NativePushRegistration } from "@/components/NativePushRegistration";

export const AppShell = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { unreadMessages, unreadNotifications } = useUnreadBadges();
  const { isAdmin, loading: roleLoading } = useUserRole();
  useNotifications();

  useEffect(() => {
    type NativeNavigationWindow = Window & { __tigerPendingNativePath?: string };
    const nativeWindow = window as NativeNavigationWindow;
    const navigateToNativePath = (path: string | undefined) => {
      if (!path || !path.startsWith("/") || path.startsWith("//")) return;
      nativeWindow.__tigerPendingNativePath = undefined;
      const currentPath = window.location.pathname + window.location.search + window.location.hash;
      if (currentPath !== path) navigate(path, { replace: true });
    };
    const onNativeNavigate = (event: Event) => {
      navigateToNativePath((event as CustomEvent<string>).detail);
    };
    window.addEventListener("tiger:native-navigate", onNativeNavigate);
    navigateToNativePath(nativeWindow.__tigerPendingNativePath);
    return () => window.removeEventListener("tiger:native-navigate", onNativeNavigate);
  }, [navigate]);

  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let frame = 0;
    const editableSelector = "input, textarea, select, [contenteditable='true'], [role='textbox']";

    const reveal = (doc: Document) => {
      const view = doc.defaultView;
      if (!view) return;
      const active = doc.activeElement;
      if (!(active instanceof view.HTMLElement) || !active.matches(editableSelector)) return;
      const vv = view.visualViewport;
      const top = vv?.offsetTop ?? 0;
      const bottom = top + (vv?.height ?? view.innerHeight);
      const rect = active.getBoundingClientRect();
      if (rect.bottom > bottom - 20 || rect.top < top + 12) {
        active.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" });
      }
      let parent = active.parentElement;
      while (parent && parent !== doc.body) {
        const style = view.getComputedStyle(parent);
        if (/(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight + 2) {
          const bounds = parent.getBoundingClientRect();
          if (bounds.bottom > bottom - 12) parent.scrollTop += bounds.bottom - bottom + 24;
          if (bounds.top < top + 8) parent.scrollTop -= top - bounds.top + 16;
          break;
        }
        parent = parent.parentElement;
      }
      // If the editor is inside a same-origin iframe, reveal the iframe in the app too.
      if (doc !== document) {
        const frameElement = doc.defaultView?.frameElement;
        if (frameElement instanceof HTMLElement) {
          frameElement.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" });
        }
      }
    };

    const update = () => {
      const height = viewport?.height && viewport.height > 0 ? viewport.height : window.innerHeight;
      const offsetTop = viewport?.offsetTop ?? 0;
      const inset = Math.max(0, window.innerHeight - height - offsetTop);
      const keyboardOpen = inset > 100;
      root.style.setProperty("--tiger-viewport-height", `${Math.round(height)}px`);
      root.style.setProperty("--tiger-visual-offset-top", `${Math.round(offsetTop)}px`);
      root.style.setProperty("--tiger-keyboard-inset", `${Math.round(inset)}px`);
      root.classList.toggle("tiger-keyboard-open", keyboardOpen);

      window.cancelAnimationFrame(frame);
      revealTimers.forEach((timer) => window.clearTimeout(timer));
      revealTimers.clear();
      frame = window.requestAnimationFrame(() => {
        reveal(document);
        document.querySelectorAll("iframe").forEach((frameElement) => {
          try {
            const child = frameElement.contentDocument;
            if (child) reveal(child);
          } catch {
            // Cross-origin frames must manage their own focus/scroll behavior.
          }
        });
      });
    };

    const revealTimers = new Set<number>();
    const scheduleReveal = () => {
      [60, 180, 360].forEach((delay) => {
        const timer = window.setTimeout(() => {
          revealTimers.delete(timer);
          update();
        }, delay);
        revealTimers.add(timer);
      });
    };
    const onFocusIn = () => {
      update();
      // Android keyboards animate after focus; reveal again after the visual viewport settles.
      scheduleReveal();
    };

    const attachedDocuments = new WeakSet<Document>();
    const attachedFrames = new WeakSet<HTMLIFrameElement>();
    const onFocusOut = () => window.setTimeout(update, 80);
    const attachDocument = (doc: Document) => {
      if (attachedDocuments.has(doc)) return;
      attachedDocuments.add(doc);
      doc.addEventListener("focusin", onFocusIn, true);
      doc.addEventListener("input", update, true);
      doc.addEventListener("focusout", onFocusOut, true);
    };
    const attachFrames = () => {
      document.querySelectorAll("iframe").forEach((frameElement) => {
        if (attachedFrames.has(frameElement)) return;
        attachedFrames.add(frameElement);
        frameElement.addEventListener("load", () => {
          try {
            if (frameElement.contentDocument) attachDocument(frameElement.contentDocument);
          } catch {
            // Cross-origin frames are intentionally not accessed.
          }
          update();
        });
        try {
          if (frameElement.contentDocument) attachDocument(frameElement.contentDocument);
        } catch {
          // Cross-origin frames are intentionally not accessed.
        }
      });
    };

    attachDocument(document);
    attachFrames();
    const observer = new MutationObserver(attachFrames);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("input", update, true);
      document.removeEventListener("focusout", onFocusOut, true);
      document.querySelectorAll("iframe").forEach((frameElement) => {
        try {
          const child = frameElement.contentDocument;
          child?.removeEventListener("focusin", onFocusIn, true);
          child?.removeEventListener("input", update, true);
          child?.removeEventListener("focusout", onFocusOut, true);
        } catch {
          // Cross-origin frames are intentionally not accessed.
        }
      });
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      root.classList.remove("tiger-keyboard-open");
      root.style.removeProperty("--tiger-viewport-height");
      root.style.removeProperty("--tiger-visual-offset-top");
      root.style.removeProperty("--tiger-keyboard-inset");
    };
  }, []);

  const hideBar = location.pathname.startsWith("/chats") && (location.search.includes("c=") || location.search.includes("bubble=1"));
  const items = [
    { to: "/", icon: Home, label: "Home", badge: 0 },
    { to: "/chats", icon: MessageCircle, label: "Chats", badge: unreadMessages },
    { to: "/groups", icon: Users, label: "Groups", badge: 0 },
    { to: "/game", icon: Trophy, label: "Game", badge: 0 },
    { to: `/u/${user?.id ?? ""}`, icon: UserIcon, label: "Profile", badge: unreadNotifications },
    ...(!roleLoading && isAdmin ? [{ to: "/admin", icon: Crown, label: "Admin Panel", badge: 0 }] : []),
  ];

  return (
    <AppLockGate><CallProvider><AnnouncementGate>
      <div className="flex min-h-0 bg-background" style={{ height: "var(--tiger-viewport-height, 100dvh)" }}>
        <NotificationBubble />
        <NativePushRegistration />
        <aside className="hidden h-full w-56 shrink-0 flex-col gap-2 border-r border-border bg-card p-4 lg:flex">
          <div className="mb-4 flex items-center gap-2 py-4 font-bold"><img src={logo} alt="" className="h-9 w-9" />TIGERCHATS</div>
          {items.map(({ to, icon: Icon, label }) => <Button key={label} asChild variant={location.pathname === to ? "secondary" : "ghost"} className="justify-start"><NavLink to={to} end={to === "/"}><Icon className="mr-3 h-4 w-4" />{label}</NavLink></Button>)}
          <div className="my-3 border-t border-border" />
          {[{ to: "/tiger-ai", icon: Bot, label: "Tiger AI" }, { to: "/contact", icon: Mail, label: "Contact admin" }, { to: "/notifications", icon: Bell, label: "Notifications" }, { to: "/settings", icon: Settings, label: "Settings" }].map(({ to, icon: Icon, label }) => <Button asChild variant="ghost" key={to} className="justify-start"><NavLink to={to}><Icon className="mr-3 h-4 w-4" />{label}</NavLink></Button>)}
        </aside>
        <div className="tiger-app-safe-area flex min-h-0 min-w-0 flex-1 flex-col">
          <OfflineIndicator />
          <main className="min-h-0 min-w-0 flex-1 overflow-hidden"><Outlet /></main>
          {!hideBar && <nav aria-label="Main navigation" className="flex shrink-0 items-center border-t border-border/50 bg-card/80 px-1 pt-1 backdrop-blur-md pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))] lg:hidden">
            {items.map(({ to, icon: Icon, label, badge }) => <NavLink key={label} to={to} end={to === "/"} className={({ isActive }) => `relative flex h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-0.5 transition-colors ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <span className="relative flex h-5 w-5 items-center justify-center"><Icon className="h-5 w-5" />{badge > 0 && <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground shadow-[0_0_8px_hsl(var(--primary)/0.6)]">{badge > 99 ? "99+" : badge}</span>}</span>
              <span className="max-w-full truncate text-center text-[9px] font-medium leading-3">{label}</span>
            </NavLink>)}
          </nav>}
        </div>
      </div>
    </AnnouncementGate></CallProvider></AppLockGate>
  );
};
