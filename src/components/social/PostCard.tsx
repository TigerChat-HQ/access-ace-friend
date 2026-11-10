import { useState } from "react";
import { Heart, MessageCircle, Share2, MoreVertical, Trash2, Flag, UserX } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
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
  reel_audio_start_seconds?: number | null;
  reel_trim_start_seconds?: number | null;
  reel_trim_end_seconds?: number | null;
  reel_captions?: ReelCaption[] | null;
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

  const handleLike = async () => {
    if (!user) return;
    setLiked(!liked);
    setLikeCount((c) => c + (liked ? -1 : 1));
    await toggleLike(post.id, user.id, liked);
  };

  const handleDelete = async () => {
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
        <img src={post.media_url} alt="" className="w-full max-h-[600px] object-cover bg-muted" loading="lazy" />
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
          <video src={post.media_url} poster={reelPost.reel_cover_url || undefined} controls playsInline className="w-full max-h-[600px] bg-black" />
        )
      )}

      <div className="flex items-center gap-4 px-4 py-2.5">
        <button onClick={handleLike} className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors">
          <Heart className={`w-6 h-6 ${liked ? "fill-primary text-primary" : ""}`} />
          <span className="text-sm font-medium">{likeCount}</span>
        </button>
        <button onClick={() => setCommentsOpen(true)} className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors">
          <MessageCircle className="w-6 h-6" />
          <span className="text-sm font-medium">{post.comment_count}</span>
        </button>
        <button onClick={handleShare} className="text-foreground hover:text-primary transition-colors ml-auto"><Share2 className="w-5 h-5" /></button>
      </div>

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
