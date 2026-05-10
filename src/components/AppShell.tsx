import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Home, MessageCircle, Users, Sparkles, User as UserIcon, Trophy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AppLockGate } from "@/components/AppLockGate";
import { CallProvider } from "@/contexts/CallContext";
import { AnnouncementGate } from "@/components/AnnouncementGate";
import { useUnreadBadges } from "@/hooks/useUnreadBadges";

export const AppShell = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { unreadMessages, unreadNotifications } = useUnreadBadges();

  const hideBar = location.pathname.startsWith("/chats") && location.search.includes("c=");

  const items = [
    { to: "/", icon: Home, label: "Home", badge: 0 },
    { to: "/chats", icon: MessageCircle, label: "Chats", badge: unreadMessages },
    { to: "/groups", icon: Users, label: "Groups", badge: 0 },
    { to: "/stories", icon: Sparkles, label: "Stories", badge: 0 },
    { to: "/game", icon: Trophy, label: "Game", badge: 0 },
    { to: `/u/${user?.id ?? ""}`, icon: UserIcon, label: "Profile", badge: unreadNotifications },
  ];

  return (
    <AppLockGate>
      <CallProvider>
        <AnnouncementGate>
          <div className="h-[100dvh] flex flex-col bg-background">
            <main className="flex-1 overflow-hidden">
              <Outlet />
            </main>
            {!hideBar && (
              <nav className="flex items-center justify-around border-t border-border/50 bg-card/80 backdrop-blur-md px-1 py-1.5 safe-area-bottom">
                {items.map(({ to, icon: Icon, label, badge }) => (
                  <NavLink
                    key={label}
                    to={to}
                    end={to === "/"}
                    className={({ isActive }) =>
                      `relative flex flex-col items-center justify-center px-2 py-1.5 rounded-lg transition-colors ${
                        isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                      }`
                    }
                  >
                    <div className="relative">
                      <Icon className="w-5 h-5" />
                      {badge > 0 && (
                        <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center shadow-[0_0_8px_hsl(var(--primary)/0.6)]">
                          {badge > 99 ? "99+" : badge}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] mt-0.5 font-medium">{label}</span>
                  </NavLink>
                ))}
              </nav>
            )}
          </div>
        </AnnouncementGate>
      </CallProvider>
    </AppLockGate>
  );
};
