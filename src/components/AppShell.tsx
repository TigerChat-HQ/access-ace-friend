import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Home, Search, PlusSquare, MessageCircle, User as UserIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export const AppShell = () => {
  const { user } = useAuth();
  const location = useLocation();

  // Hide bottom bar on chat detail (when ?c= present on /chats) for full-screen feel
  const hideBar = location.pathname.startsWith("/chats") && location.search.includes("c=");

  const items = [
    { to: "/", icon: Home, label: "Feed" },
    { to: "/search", icon: Search, label: "Search" },
    { to: "/create", icon: PlusSquare, label: "Create" },
    { to: "/chats", icon: MessageCircle, label: "Chats" },
    { to: `/u/${user?.id ?? ""}`, icon: UserIcon, label: "Profile" },
  ];

  return (
    <div className="h-screen flex flex-col bg-background">
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
      {!hideBar && (
        <nav className="flex items-center justify-around border-t border-border/50 bg-card/80 backdrop-blur-md px-2 py-1.5 safe-area-bottom">
          {items.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={label}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center px-3 py-1.5 rounded-lg transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] mt-0.5 font-medium">{label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
};
