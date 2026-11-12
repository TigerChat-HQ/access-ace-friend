/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase generated types do not yet include the pending PR migrations; any casts are isolated to the database boundary. */
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, MessageCircle, Share2, MoreVertical, Trash2, Flag, UserX, Bookmark, Archive, Pin, Pencil, BarChart3, UserPlus, Images } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { FeedPost, toggleLike, deletePost } from "@/hooks/usePosts";
import { CommentsSheet } from "./CommentsSheet";
import { PostInsightsDialog } from "./PostInsightsDialog";
import { PostCollaborationDialog } from "./PostCollaborationDialog";
import { PostMediaEditorDialog } from "./PostMediaEditorDialog";
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
import { claimFeedPlayback, getFeedMuted, releaseFeedPlayback, setFeedMuted } from "@/lib/feedVideoPlayback";

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
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [collaborationOpen, setCollaborationOpen] = useState(false);
  const [mediaEditorOpen, setMediaEditorOpen] = useState(false);
  const [collaboratorNames, setCollaboratorNames] = useState<string[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const feedVideoRef = useRef<HTMLVideoElement>(null);
  const [saved, setSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(post.caption || "");
  const [altTextDraft, setAltTextDraft] = useState(post.alt_text || "");
  const [locationDraft, setLocationDraft] = useState(post.location_name || "");
  const [audienceDraft, setAudienceDraft] = useState(post.audience || "public");
  const [editingCaption, setEditingCaption] = useState(false);
  const [postActionBusy, setPostActionBusy] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const queryClient = useQueryClient();
  const { data: followingIds = [] } = useQuery({
    queryKey: ["following-ids", user?.id],
    enabled: Boolean(isReel && user),
    staleTime: 60_000,
    queryFn: async () => {
      if (!user) return [] as string[];
      const { data, error } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);
      if (error) throw error;
      return (data || []).map((row) => row.following_id);
    },
  });
  const followingCreator = followingIds.includes(post.user_id);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: ids, error } = await supabase.rpc("get_post_collaborator_ids" as any, { _post_id: post.id } as any) as any;
      if (error || !ids?.length) { if (active) setCollaboratorNames([]); return; }
      const userIds = ids.map((row: { user_id: string }) => row.user_id);
      const { data: profiles } = await supabase.from("profiles").select("username,display_name").in("user_id", userIds);
      if (active) setCollaboratorNames((profiles || []).map(profile => profile.username || profile.display_name || "user"));
    })();
    return () => { active = false; };
  }, [post.id]);

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

  useEffect(() => {
    const video = feedVideoRef.current;
    if (!video || activeMedia?.type !== "video" || isReel) return;
    video.muted = true;
    const start = () => {
      claimFeedPlayback([video]);
      video.muted = getFeedMuted();
      void video.play().catch(() => undefined);
    };
    const stop = () => {
      video.pause();
      releaseFeedPlayback([video]);
    };
    if (!("IntersectionObserver" in window)) {
      start();
      return stop;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.6) start();
      else stop();
    }, { threshold: [0, 0.6, 1] });
    observer.observe(video);
    return () => { observer.disconnect(); stop(); };
  }, [activeMedia?.url, activeMedia?.type, isReel]);



  const handleFollowCreator = async () => {
    if (!user || user.id === post.user_id || followBusy || followingCreator) return;
    setFollowBusy(true);
    try {
      const { error } = await supabase.from("follows").insert({ follower_id: user.id, following_id: post.user_id });
      if (error && error.code !== "23505") throw error;
      const { error: attributionError } = await (supabase as any).from("reel_follow_attributions").insert({
        reel_id: post.id, creator_id: post.user_id, follower_id: user.id,
      });
      if (attributionError && attributionError.code !== "23505") console.warn("Reel follow attribution was not recorded", attributionError);
      queryClient.setQueryData<string[]>(["following-ids", user.id], (previous = []) => previous.includes(post.user_id) ? previous : [...previous, post.user_id]);
      toast({ title: "You are now following this creator" });
    } catch (error) {
      toast({ title: "Could not follow creator", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally { setFollowBusy(false); }
  };

  const handleLike = async () => {
    if (!user) return;
    setLiked(!liked);
    setLikeCount((c) => c + (liked ? -1 : 1));
    await toggleLike(post.id, user.id, liked);
  };

  const updatePost = async (patch: Record<string, unknown>, success: string) => {
    if (!isOwner || postActionBusy) return;
    setPostActionBusy(true);
    const { error } = await (supabase as any).from("posts").update(patch).eq("id", post.id).eq("user_id", user!.id);
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
      if (user) {
        const { error } = await (supabase as any).from("post_shares").insert({ post_id: post.id, user_id: user.id });
        if (error) console.warn("Share analytics could not be recorded", error);
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
            {isOwner && <><DropdownMenuItem onClick={() => setMediaEditorOpen(true)}><Images className="w-4 h-4 mr-2" /> Edit media</DropdownMenuItem><DropdownMenuItem onClick={() => setCollaborationOpen(true)}><UserPlus className="w-4 h-4 mr-2" /> Invite collaborator</DropdownMenuItem><DropdownMenuItem onClick={() => setInsightsOpen(true)}><BarChart3 className="w-4 h-4 mr-2" /> View insights</DropdownMenuItem><DropdownMenuItem onClick={() => { setCaptionDraft(post.caption || ""); setAltTextDraft(post.alt_text || ""); setLocationDraft(post.location_name || ""); setAudienceDraft(post.audience || "public"); setEditingCaption(true); }}><Pencil className="w-4 h-4 mr-2" /> Edit post details</DropdownMenuItem><DropdownMenuItem disabled={postActionBusy} onClick={() => updatePost({ allow_comments: post.allow_comments === false }, post.allow_comments === false ? "Comments enabled" : "Comments disabled")}>{post.allow_comments === false ? "Turn comments on" : "Turn comments off"}</DropdownMenuItem><DropdownMenuItem disabled={postActionBusy} onClick={() => updatePost({ hide_like_count: !post.hide_like_count }, post.hide_like_count ? "Like count is visible" : "Like count hidden")}>{post.hide_like_count ? "Show like count" : "Hide like count"}</DropdownMenuItem><DropdownMenuItem disabled={postActionBusy} onClick={() => updatePost({ archived_at: post.archived_at ? null : new Date().toISOString() }, post.archived_at ? "Post restored" : "Post archived")}><Archive className="w-4 h-4 mr-2" /> {post.archived_at ? "Restore from archive" : "Archive post"}</DropdownMenuItem><DropdownMenuItem disabled={postActionBusy} onClick={() => updatePost({ pinned_at: post.pinned_at ? null : new Date().toISOString() }, post.pinned_at ? "Post unpinned" : "Post pinned")}><Pin className="w-4 h-4 mr-2" /> {post.pinned_at ? "Unpin post" : "Pin to profile"}</DropdownMenuItem></>}
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
      {collaboratorNames.length > 0 && <p className="px-4 pb-2 text-xs text-muted-foreground">With {collaboratorNames.map(name => `@${name}`).join(", ")}</p>}

      {post.media_url && activeMedia?.type !== "video" && (
        <div className="relative" onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { if (touchStartX.current === null || mediaItems.length < 2) return; const delta = event.changedTouches[0].clientX - touchStartX.current; if (Math.abs(delta) > 45) setCarouselIndex((index) => (index + (delta < 0 ? 1 : -1) + mediaItems.length) % mediaItems.length); touchStartX.current = null; }}>
          <img src={activeMedia?.url || post.media_url} alt={activeMedia?.alt_text || post.alt_text || ""} onDoubleClick={() => { if (!liked) void handleLike(); }} className="w-full max-h-[600px] object-cover bg-muted" loading="lazy" />
          {mediaItems.length > 1 && <><button type="button" aria-label="Previous photo" onClick={() => setCarouselIndex((index) => (index - 1 + mediaItems.length) % mediaItems.length)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-2 text-white">‹</button><button type="button" aria-label="Next photo" onClick={() => setCarouselIndex((index) => (index + 1) % mediaItems.length)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-2 text-white">›</button><span className="absolute right-3 top-3 rounded-full bg-black/65 px-2 py-1 text-[10px] text-white">{carouselIndex + 1}/{mediaItems.length}</span></>}
          {post.post_audio_url && <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-xl bg-black/70 p-2 text-white backdrop-blur"><span className="min-w-0 flex-1 truncate text-xs">{post.post_audio_title || "Post soundtrack"}</span><audio src={post.post_audio_url} controls className="h-8 max-w-[55%]" /></div>}
        </div>
      )}
      {mediaItems.filter((item) => item.type !== "video").length > 1 && (
        <div className="grid grid-cols-5 gap-1 px-2 pb-2" aria-label="Picha za chapisho">
          {mediaItems.filter((item) => item.type !== "video").slice(0, 5).map((item, index, images) => {
            const imageIndex = mediaItems.indexOf(item);
            const extraCount = images.length - 5;
            return (
              <button key={item.url + index} type="button" onClick={() => setCarouselIndex(imageIndex)} aria-label={index === 4 && extraCount > 0 ? `Fungua picha ${imageIndex + 1}, na picha nyingine ${extraCount}` : `Fungua picha ${imageIndex + 1}`} className={`relative aspect-square overflow-hidden rounded-lg border-2 bg-muted ${carouselIndex === imageIndex ? "border-primary" : "border-transparent"}`}>
                <img src={item.url} alt={item.alt_text || ""} loading="lazy" className="h-full w-full object-cover" />
                {index === 4 && extraCount > 0 && <span className="absolute inset-0 flex items-center justify-center bg-black/65 text-sm font-black text-white">{`+${extraCount}`}</span>}
              </button>
            );
          })}
        </div>
      )}
      {post.media_url && activeMedia?.type === "video" && (
        <div className="relative" onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { if (touchStartX.current === null || mediaItems.length < 2) return; const delta = event.changedTouches[0].clientX - touchStartX.current; if (Math.abs(delta) > 45) setCarouselIndex((index) => (index + (delta < 0 ? 1 : -1) + mediaItems.length) % mediaItems.length); touchStartX.current = null; }}>
          {isReel && user && carouselIndex === 0 ? (
            <ReelAnalyticsVideo
              postId={post.id}
              creatorId={post.user_id}
              viewerId={user.id}
              src={activeMedia.url}
              coverUrl={reelPost.reel_cover_url}
              audioUrl={reelPost.reel_audio_url}
              audioStart={Number(reelPost.reel_audio_start_seconds || 0)}
              trimStart={Number(reelPost.reel_trim_start_seconds || 0)}
              trimEnd={reelPost.reel_trim_end_seconds === null || reelPost.reel_trim_end_seconds === undefined ? null : Number(reelPost.reel_trim_end_seconds)}
              captions={reelPost.reel_captions}
              className="relative w-full bg-black"
            />
          ) : (
            <video ref={feedVideoRef} src={activeMedia.url} poster={carouselIndex === 0 ? post.post_cover_url || reelPost.reel_cover_url || undefined : undefined} controls playsInline muted={getFeedMuted()} onVolumeChange={(event) => setFeedMuted(event.currentTarget.muted)} onDoubleClick={() => { if (!liked) void handleLike(); }} className="w-full max-h-[600px] bg-black" />
          )}
          {mediaItems.length > 1 && <><button type="button" aria-label="Previous media" onClick={() => setCarouselIndex((index) => (index - 1 + mediaItems.length) % mediaItems.length)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-2 text-white">‹</button><button type="button" aria-label="Next media" onClick={() => setCarouselIndex((index) => (index + 1) % mediaItems.length)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-2 text-white">›</button><span className="absolute right-3 top-3 rounded-full bg-black/65 px-2 py-1 text-[10px] text-white">{carouselIndex + 1}/{mediaItems.length}</span></>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
        <button onClick={handleLike} className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors">
          <Heart className={`w-6 h-6 ${liked ? "fill-primary text-primary" : ""}`} />
          {!post.hide_like_count && <span className="text-sm font-medium">{likeCount}</span>}
        </button>
        <button onClick={() => setCommentsOpen(true)} disabled={post.allow_comments === false} title={post.allow_comments === false ? "Comments are turned off" : "Comment"} className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors disabled:opacity-40">
          <MessageCircle className="w-6 h-6" />
          <span className="text-sm font-medium">{post.comment_count}</span>
        </button>
        {isReel && user?.id !== post.user_id && <button type="button" onClick={() => void handleFollowCreator()} disabled={followBusy || followingCreator} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground disabled:opacity-50">{followingCreator ? "Following" : followBusy ? "…" : "Follow"}</button>}
        {isReel && <Link to={`/reels/studio?remix=${post.id}`} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground">Remix</Link>}
        {isReel && <Link to={`/reels/studio?duet=${post.id}`} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground">Duet</Link>}
        <button onClick={handleShare} className="text-foreground hover:text-primary transition-colors ml-auto" aria-label="Share post"><Share2 className="w-5 h-5" /></button>
        <button onClick={handleSave} disabled={!user || saveBusy} aria-label={saved ? "Remove saved post" : "Save post"} aria-pressed={saved} className="text-foreground hover:text-primary transition-colors disabled:opacity-40"><Bookmark className={`w-5 h-5 ${saved ? "fill-current text-primary" : ""}`} /></button>
      </div>

      {editingCaption && isOwner && <div className="mx-4 mb-3 space-y-2 rounded-xl border border-border p-3"><label className="text-xs font-medium" htmlFor={`caption-${post.id}`}>Edit caption</label><textarea id={`caption-${post.id}`} value={captionDraft} maxLength={2200} onChange={(event) => setCaptionDraft(event.target.value)} className="min-h-24 w-full resize-y rounded-lg border border-border bg-background p-2 text-sm" /><label className="block text-xs font-medium" htmlFor={`alt-${post.id}`}>Accessibility alt text</label><textarea id={`alt-${post.id}`} value={altTextDraft} maxLength={500} onChange={(event) => setAltTextDraft(event.target.value)} placeholder="Describe the image for people using screen readers" className="min-h-16 w-full resize-y rounded-lg border border-border bg-background p-2 text-sm" /><label className="block text-xs font-medium" htmlFor={`location-${post.id}`}>Location</label><input id={`location-${post.id}`} value={locationDraft} maxLength={120} onChange={(event) => setLocationDraft(event.target.value)} placeholder="Add a location" className="w-full rounded-lg border border-border bg-background p-2 text-sm" /><label className="block text-xs font-medium" htmlFor={`audience-${post.id}`}>Post audience</label><select id={`audience-${post.id}`} value={audienceDraft} onChange={(event) => setAudienceDraft(event.target.value)} className="w-full rounded-lg border border-border bg-background p-2 text-sm"><option value="public">Public</option><option value="followers">Followers</option><option value="private">Only me</option></select><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{captionDraft.length}/2200</span><div className="flex gap-2"><button type="button" onClick={() => setEditingCaption(false)} className="rounded-lg px-3 py-2 text-xs">Cancel</button><button type="button" disabled={postActionBusy || captionDraft.length > 2200} onClick={() => updatePost({ caption: captionDraft.trim(), alt_text: altTextDraft.trim() || null, location_name: locationDraft.trim() || null, audience: audienceDraft }, "Post details updated")} className="rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground disabled:opacity-50">Save</button></div></div></div>}
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
      {mediaEditorOpen && <PostMediaEditorDialog postId={post.id} initialItems={mediaItems} initialAudioUrl={post.post_audio_url} initialAudioTitle={post.post_audio_title} initialCoverUrl={post.post_cover_url} open={mediaEditorOpen} onOpenChange={setMediaEditorOpen} onSaved={onChanged} />}
      {collaborationOpen && <PostCollaborationDialog postId={post.id} open={collaborationOpen} onOpenChange={setCollaborationOpen} />}
      {insightsOpen && <PostInsightsDialog postId={post.id} open={insightsOpen} onOpenChange={setInsightsOpen} />}
      {reportOpen && <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="post" targetId={post.id} />}
    </article>
  );
};
