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
    const visualViewport = window.visualViewport;
    let revealFrame = 0;

    const updateVisibleHeight = () => {
      const height = visualViewport?.height && visualViewport.height > 0
        ? visualViewport.height
        : window.innerHeight;
      const offsetTop = visualViewport?.offsetTop ?? 0;
      const keyboardOpen = window.innerHeight - height - offsetTop > 120;
      root.style.setProperty("--tiger-viewport-height", `${Math.round(height)}px`);
      root.style.setProperty("--tiger-visual-offset-top", `${Math.round(offsetTop)}px`);
      root.style.setProperty("--tiger-keyboard-inset", `${Math.max(0, Math.round(window.innerHeight - height - offsetTop))}px`);
      root.classList.toggle("tiger-keyboard-open", keyboardOpen);

      if (document.activeElement instanceof HTMLElement && document.activeElement.matches("input, textarea, [contenteditable='true'], [role='textbox']")) {
        window.cancelAnimationFrame(revealFrame);
        revealFrame = window.requestAnimationFrame(() => {
          const active = document.activeElement;
          if (!(active instanceof HTMLElement)) return;
          const visibleTop = visualViewport?.offsetTop ?? 0;
          const visibleBottom = visibleTop + (visualViewport?.height ?? window.innerHeight);
          const rect = active.getBoundingClientRect();
          if (rect.bottom > visibleBottom - 16 || rect.top < visibleTop + 8) {
            active.scrollIntoView({ behavior: "auto", block: "nearest", inline: "nearest" });
          }
          // Keep the nearest independently scrolling sandbox/panel aligned too.
          let parent = active.parentElement;
          while (parent && parent !== document.body) {
            const style = window.getComputedStyle(parent);
            if (/(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight + 2) {
              const parentRect = parent.getBoundingClientRect();
              if (parentRect.bottom > visibleBottom) parent.scrollTop += parentRect.bottom - visibleBottom + 16;
              if (parentRect.top < visibleTop) parent.scrollTop -= visibleTop - parentRect.top + 8;
              break;
            }
            parent = parent.parentElement;
          }
        });
      }
    };

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.matches("input, textarea, [contenteditable='true'], [role='textbox']")) {
        window.setTimeout(updateVisibleHeight, 50);
        window.setTimeout(updateVisibleHeight, 250);
      }
    };
    document.addEventListener("focusin", onFocusIn, true);
    updateVisibleHeight();
    window.addEventListener("resize", updateVisibleHeight);
    window.addEventListener("orientationchange", updateVisibleHeight);
    visualViewport?.addEventListener("resize", updateVisibleHeight);
    visualViewport?.addEventListener("scroll", updateVisibleHeight);

    return () => {
      window.cancelAnimationFrame(revealFrame);
      document.removeEventListener("focusin", onFocusIn, true);
      window.removeEventListener("resize", updateVisibleHeight);
      window.removeEventListener("orientationchange", updateVisibleHeight);
      visualViewport?.removeEventListener("resize", updateVisibleHeight);
      visualViewport?.removeEventListener("scroll", updateVisibleHeight);
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
