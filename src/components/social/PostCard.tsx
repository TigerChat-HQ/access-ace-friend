import { useEffect, useState } from "react";
import { Heart, MessageCircle, Share2, MoreVertical, Trash2, Flag, UserX, Bookmark, Archive, Pin, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { FeedPost, toggleLike, deletePost } from "@/hooks/usePosts";
import { CommentsSheet } from "./CommentsSheet";
import { ReportDialog } from "./ReportDialog";
import { ReelAnalyticsVideo } from "./ReelAnalyticsVideo";
import { StoryAvatar } from "@/components/social/StoryAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { useBlocks } from "@/hooks/useBlocks";

interface Props {
  post: FeedPost;
  onChanged?: () => void;
  isReel?: boolean;
}

type ReelCaption = { start: number; end: number; text: string };
type ReelPost = FeedPost & {
  reel_cover_url?: string | null;
  reel_audio_url?: string | null;
  reel_audio_title?: string | null;
  reel_audio_start_seconds?: number | null;
  reel_trim_start_seconds?: number | null;
  reel_trim_end_seconds?: number | null;
  reel_captions?: ReelCaption[] | null;
  post_audio_url?: string | null;
  post_audio_title?: string | null;
  post_cover_url?: string | null;
  location_name?: string | null;
  tagged_user_ids?: string[] | null;
  alt_text?: string | null;
  allow_comments?: boolean;
};

export const PostCard = ({ post, onChanged, isReel = false }: Props) => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { block } = useBlocks();
  const { toast } = useToast();
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [saved, setSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(post.caption || "");
  const [altTextDraft, setAltTextDraft] = useState(post.alt_text || "");
  const [editingCaption, setEditingCaption] = useState(false);
  const [postActionBusy, setPostActionBusy] = useState(false);

  useEffect(() => {
    if (!user) { setSaved(false); return; }
    let active = true;
    void (supabase.from("post_saves" as any).select("post_id").eq("post_id", post.id).eq("user_id", user.id).maybeSingle() as any)
      .then(({ data, error }: { data: unknown; error: unknown }) => {
        if (active && !error) setSaved(Boolean(data));
      });
    return () => { active = false; };
  }, [post.id, user?.id]);

  const handleSave = async () => {
    if (!user || saveBusy) return;
    setSaveBusy(true);
    try {
      if (saved) {
        const { error } = await (supabase.from("post_saves" as any).delete().eq("post_id", post.id).eq("user_id", user.id) as any);
        if (error) throw error;
        setSaved(false);
        toast({ title: "Removed from Saved" });
        onChanged?.();
      } else {
        const { error } = await (supabase.from("post_saves" as any).insert({ post_id: post.id, user_id: user.id }) as any);
        if (error) throw error;
        setSaved(true);
        toast({ title: "Saved to your collection" });
      }
    } catch (error) {
      toast({ title: "Could not update saved posts", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally { setSaveBusy(false); }
  };
  const storedMediaItems = Array.isArray(post.media_items)
    ? post.media_items.filter((item): item is { url: string; type: string; alt_text?: string | null } =>
        typeof item === "object" && item !== null && "url" in item && typeof item.url === "string" && "type" in item && typeof item.type === "string")
    : [];
  const mediaItems = storedMediaItems.length ? storedMediaItems : post.media_url ? [{ url: post.media_url, type: post.media_type, alt_text: post.alt_text }] : [];
  const activeMedia = mediaItems[carouselIndex] || mediaItems[0];

  const handleLike = async () => {
    if (!user) return;
    setLiked(!liked);
    setLikeCount((c) => c + (liked ? -1 : 1));
    await toggleLike(post.id, user.id, liked);
  };

  const updatePost = async (patch: Record<string, unknown>, success: string) => {
    if (!isOwner || postActionBusy) return;
    setPostActionBusy(true);
    const { error } = await (supabase.from("posts").update(patch).eq("id", post.id).eq("user_id", user!.id) as any);
    setPostActionBusy(false);
    if (error) toast({ title: "Post update failed", description: error.message, variant: "destructive" });
    else { toast({ title: success }); setEditingCaption(false); onChanged?.(); }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this post permanently?")) return;
    const { error } = await deletePost(post.id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Post deleted" });
      onChanged?.();
    }
  };

  const handleBlock = async () => {
    const { error } = await block(post.user_id);
    if (error) toast({ title: "Block failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: "User blocked" });
      onChanged?.();
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ url, title: "Check out this post" });
      else {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copied" });
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast({ title: "Could not share post", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  };

  const initials = (post.profile?.display_name || post.profile?.username || "U").slice(0, 2).toUpperCase();
  const isOwner = user?.id === post.user_id;
  const canDelete = isOwner || isAdmin;
  const reelPost = post as ReelPost;

  return (
    <article className={isReel ? "relative overflow-hidden rounded-2xl bg-card shadow-xl" : "bg-card border-b border-border/50"}>
      <header className="flex items-center justify-between px-4 py-3">
        <StoryAvatar userId={post.user_id} displayName={post.profile?.display_name} username={post.profile?.username} avatarUrl={post.profile?.avatar_url} size="md" showName />
        <DropdownMenu>
          <DropdownMenuTrigger className="p-1 text-muted-foreground hover:text-foreground">
            <MoreVertical className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isOwner && <><DropdownMenuItem onClick={() => { setCaptionDraft(post.caption || ""); setAltTextDraft(post.alt_text || ""); setEditingCaption(true); }}><Pencil className="w-4 h-4 mr-2" /> Edit post details</DropdownMenuItem><DropdownMenuItem disabled={postActionBusy} onClick={() => updatePost({ allow_comments: post.allow_comments === false }, post.allow_comments === false ? "Comments enabled" : "Comments disabled")}>{post.allow_comments === false ? "Turn comments on" : "Turn comments off"}</DropdownMenuItem><DropdownMenuItem disabled={postActionBusy} onClick={() => updatePost({ archived_at: post.archived_at ? null : new Date().toISOString() }, post.archived_at ? "Post restored" : "Post archived")}><Archive className="w-4 h-4 mr-2" /> {post.archived_at ? "Restore from archive" : "Archive post"}</DropdownMenuItem><DropdownMenuItem disabled={postActionBusy} onClick={() => updatePost({ pinned_at: post.pinned_at ? null : new Date().toISOString() }, post.pinned_at ? "Post unpinned" : "Post pinned")}><Pin className="w-4 h-4 mr-2" /> {post.pinned_at ? "Unpin post" : "Pin to profile"}</DropdownMenuItem></>}
            {canDelete && <DropdownMenuItem onClick={handleDelete} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>}
            {!isOwner && (
              <>
                <DropdownMenuItem onClick={() => setReportOpen(true)}><Flag className="w-4 h-4 mr-2" /> Report post</DropdownMenuItem>
                <DropdownMenuItem onClick={handleBlock}><UserX className="w-4 h-4 mr-2" /> Block user</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {post.media_url && post.media_type === "image" && (
        <div className="relative">
          <img src={activeMedia?.url || post.media_url} alt={activeMedia?.alt_text || post.alt_text || ""} className="w-full max-h-[600px] object-cover bg-muted" loading="lazy" />
          {mediaItems.length > 1 && <><button type="button" aria-label="Previous photo" onClick={() => setCarouselIndex((index) => (index - 1 + mediaItems.length) % mediaItems.length)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-2 text-white">‹</button><button type="button" aria-label="Next photo" onClick={() => setCarouselIndex((index) => (index + 1) % mediaItems.length)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-2 text-white">›</button><span className="absolute right-3 top-3 rounded-full bg-black/65 px-2 py-1 text-[10px] text-white">{carouselIndex + 1}/{mediaItems.length}</span></>}
          {post.post_audio_url && <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-xl bg-black/70 p-2 text-white backdrop-blur"><span className="min-w-0 flex-1 truncate text-xs">{post.post_audio_title || "Post soundtrack"}</span><audio src={post.post_audio_url} controls className="h-8 max-w-[55%]" /></div>}
        </div>
      )}
      {post.media_url && post.media_type === "video" && (
        isReel && user ? (
          <ReelAnalyticsVideo
            postId={post.id}
            creatorId={post.user_id}
            viewerId={user.id}
            src={post.media_url}
            coverUrl={reelPost.reel_cover_url}
            audioUrl={reelPost.reel_audio_url}
            audioStart={Number(reelPost.reel_audio_start_seconds || 0)}
            trimStart={Number(reelPost.reel_trim_start_seconds || 0)}
            trimEnd={reelPost.reel_trim_end_seconds === null || reelPost.reel_trim_end_seconds === undefined ? null : Number(reelPost.reel_trim_end_seconds)}
            captions={reelPost.reel_captions}
            className="relative w-full bg-black"
          />
        ) : (
          <video src={post.media_url} poster={post.post_cover_url || reelPost.reel_cover_url || undefined} controls playsInline className="w-full max-h-[600px] bg-black" />
        )
      )}

      <div className="flex items-center gap-4 px-4 py-2.5">
        <button onClick={handleLike} className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors">
          <Heart className={`w-6 h-6 ${liked ? "fill-primary text-primary" : ""}`} />
          <span className="text-sm font-medium">{likeCount}</span>
        </button>
        <button onClick={() => setCommentsOpen(true)} disabled={post.allow_comments === false} title={post.allow_comments === false ? "Comments are turned off" : "Comment"} className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors disabled:opacity-40">
          <MessageCircle className="w-6 h-6" />
          <span className="text-sm font-medium">{post.comment_count}</span>
        </button>
        <button onClick={handleShare} className="text-foreground hover:text-primary transition-colors ml-auto" aria-label="Share post"><Share2 className="w-5 h-5" /></button>
        <button onClick={handleSave} disabled={!user || saveBusy} aria-label={saved ? "Remove saved post" : "Save post"} aria-pressed={saved} className="text-foreground hover:text-primary transition-colors disabled:opacity-40"><Bookmark className={`w-5 h-5 ${saved ? "fill-current text-primary" : ""}`} /></button>
      </div>

      {editingCaption && isOwner && <div className="mx-4 mb-3 space-y-2 rounded-xl border border-border p-3"><label className="text-xs font-medium" htmlFor={`caption-${post.id}`}>Edit caption</label><textarea id={`caption-${post.id}`} value={captionDraft} maxLength={2200} onChange={(event) => setCaptionDraft(event.target.value)} className="min-h-24 w-full resize-y rounded-lg border border-border bg-background p-2 text-sm" /><label className="block text-xs font-medium" htmlFor={`alt-${post.id}`}>Accessibility alt text</label><textarea id={`alt-${post.id}`} value={altTextDraft} maxLength={500} onChange={(event) => setAltTextDraft(event.target.value)} placeholder="Describe the image for people using screen readers" className="min-h-16 w-full resize-y rounded-lg border border-border bg-background p-2 text-sm" /><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{captionDraft.length}/2200</span><div className="flex gap-2"><button type="button" onClick={() => setEditingCaption(false)} className="rounded-lg px-3 py-2 text-xs">Cancel</button><button type="button" disabled={postActionBusy || captionDraft.length > 2200} onClick={() => updatePost({ caption: captionDraft.trim(), alt_text: altTextDraft.trim() || null }, "Post details updated")} className="rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground disabled:opacity-50">Save</button></div></div></div>}
      {post.location_name && <p className="px-4 pb-2 text-xs text-muted-foreground">📍 {post.location_name}</p>}
      {post.tagged_user_ids && post.tagged_user_ids.length > 0 && <p className="px-4 pb-2 text-xs text-muted-foreground">Tagged {post.tagged_user_ids.length} {post.tagged_user_ids.length === 1 ? "person" : "people"}</p>}
      {post.caption && (
        <p className="px-4 pb-2 text-sm text-foreground whitespace-pre-wrap">
          <span className="font-semibold mr-1.5">{post.profile?.username || "user"}</span>{post.caption}
        </p>
      )}
      {post.hashtags && post.hashtags.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {post.hashtags.map((t) => <Link key={t} to={`/search?q=%23${t}`} className="text-xs text-primary hover:underline">#{t}</Link>)}
        </div>
      )}
      <p className="px-4 pb-3 text-[10px] text-muted-foreground uppercase tracking-wide">{new Date(post.created_at).toLocaleDateString()}</p>

      {commentsOpen && <CommentsSheet postId={post.id} open={commentsOpen} onOpenChange={setCommentsOpen} onChange={onChanged} />}
      {reportOpen && <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="post" targetId={post.id} />}
    </article>
  );
};
