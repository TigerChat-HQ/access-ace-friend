import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, MessageCircle, UserPlus, Bell, ShieldCheck } from "lucide-react";
import { useNotificationsFeed, AppNotification } from "@/hooks/useNotificationsFeed";

const iconFor = (type: AppNotification["type"]) => {
  if (type === "like" || type === "comment_like") return <Heart className="w-4 h-4 text-primary fill-primary" />;
  if (type === "comment" || type === "reply") return <MessageCircle className="w-4 h-4 text-primary" />;
  if (type === "follow" || type === "collaboration_invite" || type === "collaboration_accepted") return <UserPlus className="w-4 h-4 text-primary" />;
  if (type === "report_reply") return <ShieldCheck className="w-4 h-4 text-primary" />;
  return <Bell className="w-4 h-4 text-primary" />;
};

const textFor = (n: AppNotification) => {
  const name = n.actor?.display_name || n.actor?.username || "Someone";
  if (n.type === "like") return `${name} liked your post`;
  if (n.type === "comment") return `${name} commented on your post`;
  if (n.type === "reply") return `${name} replied to your comment`;
  if (n.type === "comment_like") return `${name} liked your comment`;
  if (n.type === "follow") return `${name} started following you`;
  if (n.type === "collaboration_invite") return `${name} invited you to collaborate on a post`;
  if (n.type === "collaboration_accepted") return `${name} accepted your post collaboration invitation`;
  if (n.type === "report_reply") return `An admin replied to your message or report`;
  return `${name} mentioned you`;
};

const timeAgo = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

const Notifications = () => {
  const navigate = useNavigate();
  const { items, loading, markAllRead } = useNotificationsFeed();

  useEffect(() => {
    // Mark as read on mount
    markAllRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card/80 backdrop-blur-md sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold text-foreground">Notifications</h1>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 px-6">
            <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-semibold">No notifications yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              When someone likes, comments, or follows you, you'll see it here.
            </p>
          </div>
        ) : (
          <ul>
            {items.map((n) => {
              const initials = (n.actor?.display_name || n.actor?.username || "U").slice(0, 2).toUpperCase();
              const target = n.type === "report_reply" ? `/contact${n.report_id ? `?report=${n.report_id}` : ""}` : n.type === "collaboration_invite" ? "/collaborations" : n.post_id ? `/post/${n.post_id}` : `/u/${n.actor_id}`;
              return (
                <li key={n.id}>
                  <Link
                    to={target}
                    className={`flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors ${
                      !n.is_read ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="relative">
                      {n.actor?.avatar_url ? (
                        <img src={n.actor.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover" />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-secondary-foreground">
                          {initials}
                        </div>
                      )}
                      <div className="absolute -bottom-0.5 -right-0.5 bg-card rounded-full p-0.5">
                        {iconFor(n.type)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">
                        {textFor(n)} <span className="text-muted-foreground">· {timeAgo(n.created_at)}</span>
                      </p>
                    </div>
                    {!n.is_read && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Notifications;
