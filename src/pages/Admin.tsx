import { useEffect, useState } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { ArrowLeft, Trash2, Users, FileText, MessageSquare, Search, Shield, ShieldOff, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const Admin = () => {
  const { isAdmin, loading } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState({ users: 0, posts: 0, comments: 0 });
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [admins, setAdmins] = useState<Set<string>>(new Set());
  const [reports, setReports] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const load = async () => {
    const [{ count: usersC }, { count: postsC }, { count: commentsC }, postsData, usersData, rolesData, reportsData] =
      await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("posts").select("*", { count: "exact", head: true }),
        supabase.from("post_comments").select("*", { count: "exact", head: true }),
        supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
        supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(50),
      ]);
    setStats({ users: usersC || 0, posts: postsC || 0, comments: commentsC || 0 });
    setRecentPosts(postsData.data || []);
    setUsers(usersData.data || []);
    setAdmins(new Set((rolesData.data || []).map((r: any) => r.user_id)));
    setReports(reportsData.data || []);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  if (loading)
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  if (!isAdmin) return <Navigate to="/" replace />;

  const removePost = async (id: string) => {
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Post removed" });
      load();
    }
  };

  const toggleAdmin = async (userId: string) => {
    if (admins.has(userId)) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
      if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
      else {
        toast({ title: "Demoted to user" });
        load();
      }
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
      if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
      else {
        toast({ title: "Promoted to admin" });
        load();
      }
    }
  };

  const resolveReport = async (id: string) => {
    const { error } = await supabase.from("reports").update({ status: "resolved" }).eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else load();
  };

  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (u.display_name || "").toLowerCase().includes(q) || (u.username || "").toLowerCase().includes(q);
  });

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
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2 flex items-center gap-2">
            <Flag className="w-3.5 h-3.5" /> Reports ({reports.filter((r) => r.status === "pending").length} pending)
          </h2>
          <div className="space-y-2">
            {reports.length === 0 ? (
              <p className="text-xs text-muted-foreground">No reports.</p>
            ) : (
              reports.map((r) => (
                <div key={r.id} className="bg-card border border-border/50 rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-foreground capitalize">
                        {r.target_type} report — <span className="text-muted-foreground">{r.reason}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()} · status: {r.status}
                      </p>
                    </div>
                    {r.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => resolveReport(r.id)}>
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Manage users & admins</h2>
          <div className="flex items-center gap-2 bg-surface rounded-lg px-3 py-2 mb-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="space-y-1 max-h-80 overflow-y-auto scrollbar-thin">
            {filtered.map((u) => {
              const isUserAdmin = admins.has(u.user_id);
              return (
                <div key={u.id} className="flex items-center gap-3 px-2 py-2 bg-card border border-border/50 rounded-lg">
                  <Link to={`/profile/${u.user_id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold">
                        {(u.display_name || "U").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate flex items-center gap-1.5">
                        {u.display_name || "Unnamed"}
                        {isUserAdmin && <Shield className="w-3 h-3 text-primary" />}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                    </div>
                  </Link>
                  <Button size="sm" variant={isUserAdmin ? "outline" : "default"} onClick={() => toggleAdmin(u.user_id)}>
                    {isUserAdmin ? (
                      <>
                        <ShieldOff className="w-3.5 h-3.5 mr-1" /> Demote
                      </>
                    ) : (
                      <>
                        <Shield className="w-3.5 h-3.5 mr-1" /> Make admin
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

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
