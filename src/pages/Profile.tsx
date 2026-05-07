import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFollow } from "@/hooks/useFollow";
import { useUserPosts } from "@/hooks/usePosts";
import { useUserRole } from "@/hooks/useUserRole";
import { useBlocks } from "@/hooks/useBlocks";
import { ReportDialog } from "@/components/social/ReportDialog";
import { FollowListDialog } from "@/components/social/FollowListDialog";
import {
  ArrowLeft, Settings, Shield, MessageCircle, Grid3x3, LogOut, Pencil, Lock,
  MoreVertical, Flag, UserX, UserCheck, Trash2, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tables } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";

type Profile = Tables<"profiles"> & { is_private?: boolean };

const Profile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user, signOut } = useAuth();
  const { isAdmin } = useUserRole();
  const { isBlocked, block, unblock } = useBlocks();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [followList, setFollowList] = useState<"followers" | "following" | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [form, setForm] = useState({ display_name: "", username: "", bio: "" });
  const { isFollowing, followerCount, followingCount, toggle } = useFollow(userId);
  const { posts } = useUserPosts(userId);

  const isMe = user?.id === userId;
  const blocked = userId ? isBlocked(userId) : false;

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
      setProfile(data as Profile);
      if (data) setForm({ display_name: data.display_name || "", username: data.username || "", bio: data.bio || "" });
      setLoading(false);
    })();
  }, [userId]);

  const saveProfile = async () => {
    if (!user) return;
    const username = form.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: form.display_name.trim() || null,
        username: username || null,
        bio: form.bio.trim() || null,
      })
      .eq("user_id", user.id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile updated" });
      setEditing(false);
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
      setProfile(data as Profile);
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) {
      toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("user_id", user.id);
    setProfile((p) => (p ? { ...p, avatar_url: publicUrl } : p));
  };

  const startDM = async () => {
    if (!user || !userId || isMe) return;
    const { data: myConvs } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", user.id);
    const convIds = myConvs?.map((c) => c.conversation_id) || [];
    if (convIds.length) {
      const { data: shared } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", userId)
        .in("conversation_id", convIds);
      const sharedIds = shared?.map((s) => s.conversation_id) || [];
      if (sharedIds.length) {
        const { data: directs } = await supabase
          .from("conversations")
          .select("id")
          .eq("type", "direct")
          .in("id", sharedIds)
          .limit(1);
        if (directs?.[0]) {
          navigate(`/chats?c=${directs[0].id}`);
          return;
        }
      }
    }
    const { data: convo } = await supabase.from("conversations").insert({ type: "direct" }).select().single();
    if (convo) {
      await supabase.from("conversation_members").insert([
        { conversation_id: convo.id, user_id: user.id },
        { conversation_id: convo.id, user_id: userId },
      ]);
      navigate(`/chats?c=${convo.id}`);
    }
  };

  const handleBlock = async () => {
    if (!userId) return;
    if (blocked) {
      const { error } = await unblock(userId);
      toast(error ? { title: "Failed", variant: "destructive" } : { title: "Unblocked" });
    } else {
      const { error } = await block(userId);
      toast(error ? { title: "Failed", variant: "destructive" } : { title: "User blocked" });
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return <div className="h-full flex items-center justify-center text-muted-foreground">User not found.</div>;
  }

  const initials = (profile.display_name || profile.username || "U").slice(0, 2).toUpperCase();
  const isPrivate = !!profile.is_private;
  const canSeePosts = isMe || !isPrivate || isFollowing;

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <button onClick={() => navigate(-1)} className="text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          @{profile.username || "user"}
          {isPrivate && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
        </h1>
        <div className="flex items-center gap-1">
          {isMe && isAdmin && (
            <button onClick={() => navigate("/admin")} className="p-2 text-muted-foreground hover:text-primary" title="Admin">
              <Shield className="w-5 h-5" />
            </button>
          )}
          {isMe ? (
            <button onClick={() => navigate("/settings")} className="p-2 text-muted-foreground hover:text-foreground">
              <Settings className="w-5 h-5" />
            </button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger className="p-2 text-muted-foreground hover:text-foreground">
                <MoreVertical className="w-5 h-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setReportOpen(true)}>
                  <Flag className="w-4 h-4 mr-2" /> Report user
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleBlock}>
                  {blocked ? (
                    <><UserCheck className="w-4 h-4 mr-2" /> Unblock</>
                  ) : (
                    <><UserX className="w-4 h-4 mr-2" /> Block</>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-4">
            <label className={isMe ? "cursor-pointer relative group" : ""}>
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center text-xl font-bold text-secondary-foreground">
                  {initials}
                </div>
              )}
              {isMe && (
                <>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
                  />
                  <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px]">
                    Change
                  </div>
                </>
              )}
            </label>
            <div className="flex-1 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-base font-bold text-foreground">{posts.length}</p>
                <p className="text-[11px] text-muted-foreground">Posts</p>
              </div>
              <div>
                <p className="text-base font-bold text-foreground">{followerCount}</p>
                <p className="text-[11px] text-muted-foreground">Followers</p>
              </div>
              <div>
                <p className="text-base font-bold text-foreground">{followingCount}</p>
                <p className="text-[11px] text-muted-foreground">Following</p>
              </div>
            </div>
          </div>

          {!editing ? (
            <div>
              <p className="text-sm font-semibold text-foreground">{profile.display_name || "Unnamed"}</p>
              {profile.bio && <p className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap">{profile.bio}</p>}
            </div>
          ) : (
            <div className="space-y-2">
              <input
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                placeholder="Display name"
                className="w-full bg-surface rounded-lg px-3 py-2 text-sm outline-none"
              />
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="username"
                className="w-full bg-surface rounded-lg px-3 py-2 text-sm outline-none"
              />
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="Bio"
                className="w-full bg-surface rounded-lg px-3 py-2 text-sm outline-none min-h-[60px] resize-none"
                maxLength={200}
              />
            </div>
          )}

          <div className="flex gap-2">
            {isMe ? (
              editing ? (
                <>
                  <Button onClick={saveProfile} className="flex-1">Save</Button>
                  <Button variant="outline" onClick={() => setEditing(false)} className="flex-1">Cancel</Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setEditing(true)} className="flex-1">
                    <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                  </Button>
                  <Button variant="outline" onClick={signOut}>
                    <LogOut className="w-4 h-4" />
                  </Button>
                </>
              )
            ) : (
              <>
                <Button onClick={toggle} variant={isFollowing ? "outline" : "default"} className="flex-1">
                  {isFollowing ? "Following" : "Follow"}
                </Button>
                <Button variant="outline" onClick={startDM} className="flex-1">
                  <MessageCircle className="w-4 h-4 mr-1.5" /> Message
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="border-t border-border/50">
          <div className="flex items-center justify-center py-2.5 border-b-2 border-primary">
            <Grid3x3 className="w-4 h-4 text-primary" />
          </div>
          {!canSeePosts ? (
            <div className="text-center py-12 px-6">
              <Lock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-foreground font-semibold">This account is private</p>
              <p className="text-sm text-muted-foreground mt-1">Follow to see their posts.</p>
            </div>
          ) : posts.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">No posts yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-0.5">
              {posts.map((p) => (
                <Link key={p.id} to={`/post/${p.id}`} className="aspect-square bg-muted relative overflow-hidden">
                  {p.media_url && p.media_type === "image" ? (
                    <img src={p.media_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : p.media_url && p.media_type === "video" ? (
                    <video src={p.media_url} className="w-full h-full object-cover" muted />
                  ) : (
                    <div className="p-2 text-[10px] text-foreground/80 line-clamp-6">{p.caption}</div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {reportOpen && userId && (
        <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="user" targetId={userId} />
      )}
    </div>
  );
};

export default Profile;
