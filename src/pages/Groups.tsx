import { Link } from "react-router-dom";
import { useConversations } from "@/hooks/useChat";
import { Users, Plus, Settings as SettingsIcon } from "lucide-react";
import { NewGroupDialog } from "@/components/chat/NewGroupDialog";
import tigerLogo from "@/assets/tigerchats-logo.png";

const Groups = () => {
  const { conversations, loading, refetch } = useConversations();
  const groups = conversations.filter((c) => c.type === "group");

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <img src={tigerLogo} alt="" className="w-7 h-7" />
          <h1 className="text-lg font-bold tracking-tight text-foreground">Groups</h1>
        </div>
        <div className="flex items-center gap-1">
          <NewGroupDialog onCreated={() => refetch()} />
          <Link to="/settings" className="p-2 text-muted-foreground hover:text-primary">
            <SettingsIcon className="w-5 h-5" />
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-20 px-6">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-semibold">No groups yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Create a group to chat with multiple friends.</p>
            <NewGroupDialog
              onCreated={() => refetch()}
              trigger={
                <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-full text-sm font-semibold neon-glow">
                  <Plus className="w-4 h-4" /> New group
                </button>
              }
            />
          </div>
        ) : (
          <>
          <div className="px-4 pt-3 pb-1">
            <NewGroupDialog
              onCreated={() => refetch()}
              trigger={
                <button className="w-full inline-flex items-center justify-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-semibold border border-primary/30">
                  <Plus className="w-4 h-4" /> New group
                </button>
              }
            />
          </div>
          <ul className="divide-y divide-border/50">
            {groups.map((g) => (
              <li key={g.id}>
                <Link
                  to={`/chats?c=${g.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-secondary-foreground">
                    {(g.name || "G").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{g.name || "Group"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {g.lastMessage?.content || "No messages yet"}
                    </p>
                  </div>
                  {g.unreadCount > 0 && (
                    <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                      {g.unreadCount}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          </>
        )}
      </div>
    </div>
  );
};

export default Groups;
