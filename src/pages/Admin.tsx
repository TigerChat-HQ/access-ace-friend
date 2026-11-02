import { useEffect, useState } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import {
  ArrowLeft, Trash2, Users, FileText, MessageSquare, Search, Shield, ShieldOff, Flag,
  TrendingUp, Heart, Eye, Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { AnnouncementComposer } from "@/components/admin/AnnouncementComposer";
import { GameAdmin } from "@/components/admin/GameAdmin";
import { ReportReplyDialog } from "@/components/admin/ReportReplyDialog";

const Admin = () => {
  const { isAdmin, isSuperiorAdmin, loading } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState({ users: 0, posts: 0, comments: 0, likes: 0, stories: 0, messages: 0 });
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [admins, setAdmins] = useState<Set<string>>(new Set());
  const [moderators, setModerators] = useState<Set<string>>(new Set());
  const [advisers, setAdvisers] = useState<Set<string>>(new Set());
  const [reports, setReports] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [growth, setGrowth] = useState<{ day: string; users: number; posts: number }[]>([]);
  const [engagement, setEngagement] = useState<{ name: string; value: number }[]>([]);
  const [creating, setCreating] = useState(false);
  const [replyTarget, setReplyTarget] = useState<any | null>(null);

  const load = async () => {
    const [
      { count: usersC }, { count: postsC }, { count: commentsC },
      { count: likesC }, { count: storiesC }, { count: messagesC },
      postsData, usersData, rolesData, reportsData,
      { data: profGrowth }, { data: postGrowth },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("posts").select("*", { count: "exact", head: true }),
      supabase.from("post_comments").select("*", { count: "exact", head: true }),
      supabase.from("post_likes").select("*", { count: "exact", head: true }),
      supabase.from("stories").select("*", { count: "exact", head: true }),
      supabase.from("messages").select("*", { count: "exact", head: true }),
      supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("profiles").select("created_at").gte("created_at", new Date(Date.now() - 14 * 86400000).toISOString()),
      supabase.from("posts").select("created_at").gte("created_at", new Date(Date.now() - 14 * 86400000).toISOString()),
    ]);
    setStats({
      users: usersC || 0, posts: postsC || 0, comments: commentsC || 0,
      likes: likesC || 0, stories: storiesC || 0, messages: messagesC || 0,
    });
    setRecentPosts(postsData.data || []);
    setUsers(usersData.data || []);
    const roles = (rolesData.data || []) as { user_id: string; role: string }[];
    setAdmins(new Set(roles.filter((r) => r.role === "admin").map((r) => r.user_id)));
    setModerators(new Set(roles.filter((r) => r.role === "moderator").map((r) => r.user_id)));
    setAdvisers(new Set(roles.filter((r) => r.role === "adviser").map((r) => r.user_id)));
    setReports(reportsData.data || []);

    // Build 14-day growth series
    const days: { day: string; users: number; posts: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const u = (profGrowth || []).filter((r: any) => r.created_at.slice(0, 10) === key).length;
      const p = (postGrowth || []).filter((r: any) => r.created_at.slice(0, 10) === key).length;
      days.push({ day: label, users: u, posts: p });
    }
    setGrowth(days);
    setEngagement([
      { name: "Likes", value: likesC || 0 },
      { name: "Comments", value: commentsC || 0 },
      { name: "Stories", value: storiesC || 0 },
      { name: "Messages", value: messagesC || 0 },
    ]);
  };

  const openSuperGroup = async () => {
    setCreating(true);
    const { data, error } = await supabase.rpc("ensure_admin_super_group");
    setCreating(false);
    if (error || !data) {
      toast({ title: "Failed to open super group", description: error?.message, variant: "destructive" });
      return;
    }
    navigate(`/chats?c=${data}`);
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

  const setRole = async (userId: string, role: "admin" | "moderator" | "adviser" | "none") => {
    // Remove all elevated roles for the user
    const { error: delErr } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .in("role", ["admin", "moderator", "adviser"] as any);
    if (delErr) {
      toast({ title: "Failed", description: delErr.message, variant: "destructive" });
      return;
    }
    if (role !== "none") {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
      if (error) {
        toast({ title: "Failed", description: error.message, variant: "destructive" });
        return;
      }
    }
    toast({ title: role === "none" ? "Role cleared" : `Set as ${role}` });
    load();
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
        <h1 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Crown className="w-4 h-4 text-primary" /> Developer Panel
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <Button
          onClick={openSuperGroup}
          disabled={creating}
          className="w-full"
        >
          <Crown className="w-4 h-4 mr-2" />
          {creating ? "Opening..." : "Open Admin Super Group"}
        </Button>

        {(isSuperiorAdmin || isAdmin) && <AnnouncementComposer />}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          <Stat icon={Users} label="Users" value={stats.users} />
          <Stat icon={FileText} label="Posts" value={stats.posts} />
          <Stat icon={MessageSquare} label="Comments" value={stats.comments} />
          <Stat icon={Heart} label="Likes" value={stats.likes} />
          <Stat icon={Eye} label="Stories" value={stats.stories} />
          <Stat icon={MessageSquare} label="Messages" value={stats.messages} />
        </div>

        <section>
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5" /> Growth — last 14 days
          </h2>
          <div className="bg-card border border-border/50 rounded-xl p-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growth}>
                <defs>
                  <linearGradient id="gUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gPosts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Area type="monotone" dataKey="users" stroke="hsl(var(--primary))" fill="url(#gUsers)" />
                <Area type="monotone" dataKey="posts" stroke="hsl(var(--accent))" fill="url(#gPosts)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">
            Engagement breakdown
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-card border border-border/50 rounded-xl p-3 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={engagement}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={9} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={9} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card border border-border/50 rounded-xl p-3 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={engagement} dataKey="value" nameKey="name" innerRadius={28} outerRadius={55} paddingAngle={2}>
                    {engagement.map((_, i) => (
                      <Cell key={i} fill={["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--neon-blue))", "hsl(var(--piece-crown))"][i % 4]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2 flex items-center gap-2">
            <Flag className="w-3.5 h-3.5" /> Reports & Contact ({reports.filter((r) => r.status === "pending").length} pending)
          </h2>
          <div className="space-y-2">
            {reports.length === 0 ? (
              <p className="text-xs text-muted-foreground">No reports.</p>
            ) : (
              reports.map((r) => (
                <div key={r.id} className="bg-card border border-border/50 rounded-lg p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-foreground capitalize">
                        {r.contact_subject || `${r.target_type} report`} — <span className="text-muted-foreground break-words">{r.reason}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()} · status: {r.status}
                        {r.admin_reply_at && " · replied"}
                      </p>
                      {r.admin_reply && (
                        <p className="mt-1.5 text-xs text-primary border-l-2 border-primary/40 pl-2">
                          ↪ {r.admin_reply}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => setReplyTarget(r)}>
                        Reply
                      </Button>
                      {r.status === "pending" && (
                        <Button size="sm" variant="ghost" onClick={() => resolveReport(r.id)}>
                          Resolve
                        </Button>
                      )}
                    </div>
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
              const isMod = moderators.has(u.user_id);
              const isAdv = advisers.has(u.user_id);
              const currentRole: "admin" | "moderator" | "adviser" | "none" =
                isUserAdmin ? "admin" : isMod ? "moderator" : isAdv ? "adviser" : "none";
              return (
                <div key={u.id} className="flex flex-col gap-2 px-2 py-2 bg-card border border-border/50 rounded-lg">
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
                        {isMod && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">MOD</span>}
                        {isAdv && <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">ADV</span>}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                    </div>
                  </Link>
                  <select
                    value={currentRole}
                    onChange={(e) => setRole(u.user_id, e.target.value as any)}
                    className="text-xs bg-surface border border-border/50 rounded px-2 py-1 text-foreground"
                  >
                    <option value="none">User</option>
                    <option value="adviser">Adviser (read-only)</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                  </select>
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

        <GameAdmin />
      </div>

      {replyTarget && (
        <ReportReplyDialog
          open={!!replyTarget}
          onClose={() => setReplyTarget(null)}
          report={replyTarget}
          onReplied={load}
        />
      )}
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
