import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Home, Search, PlusSquare, MessageCircle, User as UserIcon, Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNotificationsFeed } from "@/hooks/useNotificationsFeed";

export const AppShell = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { unreadCount } = useNotificationsFeed();

  // Hide bottom bar on chat detail (when ?c= present on /chats) for full-screen feel
  const hideBar = location.pathname.startsWith("/chats") && location.search.includes("c=");

  const items = [
    { to: "/", icon: Home, label: "Feed", badge: 0 },
    { to: "/search", icon: Search, label: "Search", badge: 0 },
    { to: "/create", icon: PlusSquare, label: "Create", badge: 0 },
    { to: "/notifications", icon: Bell, label: "Alerts", badge: unreadCount },
    { to: "/chats", icon: MessageCircle, label: "Chats", badge: 0 },
    { to: `/u/${user?.id ?? ""}`, icon: UserIcon, label: "Profile", badge: 0 },
  ];

  return (
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
              <Icon className="w-5 h-5" />
              {badge > 0 && (
                <span className="absolute top-0 right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
              <span className="text-[10px] mt-0.5 font-medium">{label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
};
