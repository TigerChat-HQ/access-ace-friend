import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { ArrowLeft, Trash2, Users, FileText, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const Admin = () => {
  const { isAdmin, loading } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState({ users: 0, posts: 0, comments: 0 });
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);

  const load = async () => {
    const [{ count: users }, { count: posts }, { count: comments }, postsData, usersData] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("posts").select("*", { count: "exact", head: true }),
      supabase.from("post_comments").select("*", { count: "exact", head: true }),
      supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    setStats({ users: users || 0, posts: posts || 0, comments: comments || 0 });
    setRecentPosts(postsData.data || []);
    setRecentUsers(usersData.data || []);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  if (loading) return <div className="h-full flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  const removePost = async (id: string) => {
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Post removed" });
      load();
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
        <button onClick={() => navigate(-1)} className="text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-semibold text-foreground">Admin Panel</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="grid grid-cols-3 gap-2">
          <Stat icon={Users} label="Users" value={stats.users} />
          <Stat icon={FileText} label="Posts" value={stats.posts} />
          <Stat icon={MessageSquare} label="Comments" value={stats.comments} />
        </div>

        <section>
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Recent posts</h2>
          <div className="space-y-2">
            {recentPosts.map((p) => (
              <div key={p.id} className="bg-card border border-border/50 rounded-lg p-3 flex gap-3">
                {p.media_url && p.media_type === "image" && (
                  <img src={p.media_url} alt="" className="w-12 h-12 rounded object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</p>
                  <p className="text-sm text-foreground truncate">{p.caption || `[${p.media_type}]`}</p>
                </div>
                <Button size="sm" variant="destructive" onClick={() => removePost(p.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Recent users</h2>
          <div className="space-y-1">
            {recentUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-2 py-2 bg-card border border-border/50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold">
                  {(u.display_name || "U").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{u.display_name || "Unnamed"}</p>
                  <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

const Stat = ({ icon: Icon, label, value }: { icon: any; label: string; value: number }) => (
  <div className="bg-card border border-border/50 rounded-xl p-3 text-center">
    <Icon className="w-5 h-5 text-primary mx-auto mb-1" />
    <p className="text-lg font-bold text-foreground">{value}</p>
    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
  </div>
);

export default Admin;
