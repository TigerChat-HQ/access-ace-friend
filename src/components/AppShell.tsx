import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Home, MessageCircle, Users, Sparkles, User as UserIcon, Trophy, Mail, Settings, Bot, Bell, Crown } from "lucide-react";
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

export const AppShell = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { unreadMessages, unreadNotifications } = useUnreadBadges();
  const { isAdmin, loading: roleLoading } = useUserRole();
  useNotifications();

  const hideBar = location.pathname.startsWith("/chats") && location.search.includes("c=");

  const items = [
    { to: "/", icon: Home, label: "Home", badge: 0 },
    { to: "/chats", icon: MessageCircle, label: "Chats", badge: unreadMessages },
    { to: "/groups", icon: Users, label: "Groups", badge: 0 },
    { to: "/stories", icon: Sparkles, label: "Stories", badge: 0 },
    { to: "/game", icon: Trophy, label: "Game", badge: 0 },
    { to: `/u/${user?.id ?? ""}`, icon: UserIcon, label: "Profile", badge: unreadNotifications },
    ...(!roleLoading && isAdmin
      ? [{ to: "/admin", icon: Crown, label: "Admin Panel", badge: 0 }]
      : []),
  ];

  return (
    <AppLockGate>
      <CallProvider>
        <AnnouncementGate>
          <div className="h-[100dvh] flex bg-background">
            <NotificationBubble />
            <aside className="hidden lg:flex w-56 shrink-0 flex-col border-r border-border bg-card p-4 gap-2">
              <div className="flex items-center gap-2 py-4 mb-4 font-bold"><img src={logo} alt="" className="w-9 h-9" />TIGERCHATS</div>
              {items.map(({to, icon: Icon, label}) => <Button key={label} asChild variant={location.pathname === to ? "secondary" : "ghost"} className="justify-start"><NavLink to={to} end={to === "/"}><Icon className="w-4 h-4 mr-3" />{label}</NavLink></Button>)}
              <div className="border-t border-border my-3" />
              {[{to:"/tiger-ai", icon:Bot, label:"Tiger AI"}, {to:"/contact",icon:Mail,label:"Contact admin"},{to:"/notifications",icon:Bell,label:"Notifications"},{to:"/settings",icon:Settings,label:"Settings"}].map(({to,icon:Icon,label}) => <Button asChild variant="ghost" key={to} className="justify-start"><NavLink to={to}><Icon className="w-4 h-4 mr-3" />{label}</NavLink></Button>)}
            </aside>
            <div className="flex flex-1 flex-col min-h-0 min-w-0">
              <main className="flex-1 min-h-0 min-w-0 overflow-hidden">
                <Outlet />
              </main>
              {!hideBar && (
                <nav aria-label="Main navigation" className="lg:hidden flex items-center gap-1 overflow-x-auto border-t border-border/50 bg-card/80 backdrop-blur-md px-1 py-1.5 safe-area-bottom">
                  {items.map(({ to, icon: Icon, label, badge }) => (
                    <NavLink
                      key={label}
                      to={to}
                      end={to === "/"}
                      className={({ isActive }) =>
                        `relative flex shrink-0 min-w-[3.25rem] flex-col items-center justify-center px-2 py-1.5 rounded-lg transition-colors ${
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
                      <span className="text-[10px] mt-0.5 font-medium whitespace-nowrap">{label}</span>
                    </NavLink>
                  ))}
                </nav>
              )}
            </div>
          </div>
        </AnnouncementGate>
      </CallProvider>
    </AppLockGate>
  );
};
