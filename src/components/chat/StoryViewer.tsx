import { useState, useEffect, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { X, Volume2, VolumeX, ShieldCheck, MessageCircle, Send, Eye, Heart, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useScreenshotProtection } from "@/hooks/useScreenshotProtection";
import { TigerReactionLayer } from "@/components/TigerReaction";
import tigerImg from "@/assets/tiger-reaction.png";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { dispatchPush } from "@/lib/dispatch-push";
import { useKeyboardAwareInput } from "@/hooks/useKeyboardAwareInput";

interface StoryData {
  id: string;
  userId: string;
  userName: string;
  avatar: string;
  imageUrl?: string;
  caption?: string;
  musicUrl?: string;
  mediaType?: "image" | "video" | "text";
  backgroundColor?: string;
  textOverlay?: { text?: string; text_color?: string; text_background?: string; text_font?: string; text_size?: number; sticker?: string; music_title?: string; music_start?: number; music_end?: number; image_filter?: string; drawing_url?: string } | null;
  duration?: number | null;
}

interface StoryViewerProps {
  stories: StoryData[];
  initialIndex: number;
  onClose: () => void;
  currentUserId?: string;
  onStoryDeleted?: (storyId: string) => void;
}

const REACTIONS = ["❤️", "🔥", "😂", "😮", "😢", "👏"];
const db = supabase as unknown as SupabaseClient;

export const StoryViewer = ({ stories, initialIndex, onClose, currentUserId, onStoryDeleted }: StoryViewerProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [floaters, setFloaters] = useState<{ id: string; emoji: string; left: number }[]>([]);
  const [tigerTrigger, setTigerTrigger] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<{ id: string; content: string; user_id: string; user_name: string }[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [viewCount, setViewCount] = useState(0);
  const [viewers, setViewers] = useState<{ id: string; user_id: string; user_name: string; viewed_at: string }[]>([]);
  const [viewsOpen, setViewsOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const replyInputRef = useKeyboardAwareInput<HTMLInputElement>();
  const story = stories[currentIndex];
  const isOwner = currentUserId && story?.userId === currentUserId;

  useScreenshotProtection(true);

  const isVideo = story?.mediaType === "video";
  const isText = story?.mediaType === "text" || !story?.imageUrl;
  const storyDuration = isVideo && story?.duration ? story.duration * 1000 : 5000;

  useEffect(() => {
    setImgLoaded(false);
    setProgress(0);
    setCounts({});
    setFloaters([]);
    setCommentsOpen(false);
    setCommentDraft("");
    setViewCount(0);
    setViewers([]);
    setViewsOpen(false);
  }, [currentIndex]);

  // Load owner view count and keep it live.
  useEffect(() => {
    if (!story || !isOwner) return;
    let active = true;
    const refreshViews = async () => {
      const { data, error } = await supabase.from("story_views").select("id, viewer_id, viewed_at").eq("story_id", story.id).order("viewed_at", { ascending: false });
      if (error || !active) return;
      const rows = data || [];
      const ids = [...new Set(rows.map(row => row.viewer_id))];
      const { data: profiles } = ids.length ? await supabase.from("profiles").select("user_id, display_name").in("user_id", ids) : { data: [] };
      const names = new Map((profiles || []).map(profile => [profile.user_id, profile.display_name || "User"]));
      if (active) {
        setViewCount(rows.length);
        setViewers(rows.map(row => ({ id: row.id, user_id: row.viewer_id, user_name: names.get(row.viewer_id) || "User", viewed_at: row.viewed_at })));
      }
    };
    void refreshViews();
    const channel = supabase.channel(`story-views-${story.id}-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "story_views", filter: `story_id=eq.${story.id}` }, () => {
        if (active) void refreshViews();
      }).subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [story?.id, isOwner]);

  // Load existing reaction counts (visible to owner & self)
  useEffect(() => {
    if (!story) return;
    (async () => {
      const { data } = await supabase
        .from("story_reactions")
        .select("emoji")
        .eq("story_id", story.id);
      if (data) {
        const c: Record<string, number> = {};
        const reactionRows = data as unknown as { emoji: string }[];
        reactionRows.forEach((reaction) => {
          c[reaction.emoji] = (c[reaction.emoji] || 0) + 1;
        });
        setCounts(c);
      }
    })();
  }, [story]);

  useEffect(() => {
    if (!story) return;
    let active = true;
    const loadComments = async () => {
      const { data, error } = await supabase.from("story_comments")
      .select("id, content, user_id")
      .eq("story_id", story.id)
      .order("created_at", { ascending: true });
      if (!active) return;
      if (error) { console.warn("Could not load story comments:", error.message); return; }
      const rows = data || [];
      const ids = [...new Set(rows.map(m => m.user_id))];
      const { data: profiles } = ids.length ? await supabase.from("profiles").select("user_id, display_name").in("user_id", ids) : { data: [] };
      const names = new Map((profiles || []).map(profile => [profile.user_id, profile.display_name || "User"]));
      if (active) setComments(rows.map(m => ({ id: m.id, content: m.content || "", user_id: m.user_id, user_name: names.get(m.user_id) || "User" })));
    };
    void loadComments();
    const channel = supabase.channel(`story-comments-${story.id}-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "story_comments", filter: "story_id=eq." + story.id }, (payload) => {
        const row = payload.new as { id: string; content: string; user_id: string };
        void supabase.from("profiles").select("display_name").eq("user_id", row.user_id).maybeSingle().then(({ data: profile }) => {
          if (active) setComments(current => current.some(item => item.id === row.id) ? current : [...current, { id: row.id, content: row.content || "", user_id: row.user_id, user_name: profile?.display_name || "User" }]);
        });
      }).subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [story?.id]);

  const sendComment = async () => {
    const content = commentDraft.trim();
    if (!content || !currentUserId || !story || commentLoading) return;
    setCommentLoading(true);
    const { data, error } = await supabase.rpc("reply_to_status", { p_story_id: story.id, p_content: content });
    if (error) {
      toast({ title: "Reply not sent", description: error.message, variant: "destructive" });
    } else if (data) {
      void dispatchPush(data);
      setCommentDraft("");
      onClose();
      navigate(`/chats?c=${data}`);
    }
    setCommentLoading(false);
  };

  // Realtime new reactions → animate floaters & bump counts
  useEffect(() => {
    if (!story) return;
    const channel = supabase
      .channel(`story-reactions-${story.id}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "story_reactions", filter: `story_id=eq.${story.id}` },
        (payload) => {
          const change = payload as unknown as { new: { emoji?: string } };
          const emoji = change.new?.emoji;
          if (!emoji) return;
          setCounts((c) => ({ ...c, [emoji]: (c[emoji] || 0) + 1 }));
          if (emoji === "🐯") {
            setTigerTrigger((t) => t + 1);
          } else {
            const id = `${Date.now()}-${Math.random()}`;
            setFloaters((f) => [...f, { id, emoji, left: 20 + Math.random() * 60 }]);
            setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 2400);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [story?.id]);

  useEffect(() => {
    if (paused || commentsOpen) return;
    const tickMs = 50;
    const inc = (tickMs / storyDuration) * 100;
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          if (currentIndex < stories.length - 1) {
            setCurrentIndex((i) => i + 1);
            return 0;
          } else {
            onClose();
            return 100;
          }
        }
        return p + inc;
      });
    }, tickMs);

    if (currentUserId && story && story.userId !== currentUserId) {
      void supabase.from("story_views").upsert({ story_id: story.id, viewer_id: currentUserId }, { onConflict: "story_id,viewer_id", ignoreDuplicates: true }).then(({ error }) => {
        if (error) console.warn("Could not record story view:", error.message);
      });
    }

    return () => clearInterval(interval);
  }, [currentIndex, stories.length, onClose, currentUserId, story, paused, commentsOpen, storyDuration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!story?.musicUrl) {
      audio.pause();
      audio.src = "";
      return;
    }
    const start = Math.max(0, story.textOverlay?.music_start ?? 0);
    const end = story.textOverlay?.music_end ?? 0;
    const seekAndPlay = () => {
      audio.currentTime = start;
      void audio.play().catch((error: unknown) => console.warn("Story audio could not be played:", error));
    };
    const loopClip = () => {
      if (end > start && audio.currentTime >= end) audio.currentTime = start;
    };
    audio.addEventListener("loadedmetadata", seekAndPlay, { once: true });
    audio.addEventListener("timeupdate", loopClip);
    audio.src = story.musicUrl;
    if (audio.readyState >= 1) seekAndPlay();
    return () => {
      audio.removeEventListener("loadedmetadata", seekAndPlay);
      audio.removeEventListener("timeupdate", loopClip);
      audio.pause();
    };
  }, [story?.musicUrl, currentIndex]);

  const toggleSound = async () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    if (!nextMuted) {
      try {
        const audio = audioRef.current;
        const video = videoRef.current;
        if (audio && story?.musicUrl) await audio.play();
        if (video && isVideo) await video.play();
      } catch {
        toast({ title: "Sound could not start", description: "Tap the play control on the status to enable audio.", variant: "destructive" });
      }
    }
  };

  const goNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setProgress(0);
    } else onClose();
  };
  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setProgress(0);
    }
  };

  const deleteStory = async () => {
    if (!story || !isOwner) return;
    if (!window.confirm("Delete this status?")) return;
    const { error } = await supabase.from("stories").delete().eq("id", story.id).eq("user_id", currentUserId!);
    if (error) {
      toast({ title: "Could not delete status", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Status deleted" });
    onStoryDeleted?.(story.id);
    onClose();
  };

  const sendReaction = async (emoji: string) => {
    if (!currentUserId || !story) return;
    if (emoji === "🐯") {
      setTigerTrigger((t) => t + 1);
    } else {
      const id = `${Date.now()}-${Math.random()}`;
      setFloaters((f) => [...f, { id, emoji, left: 40 + Math.random() * 20 }]);
      setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 2400);
    }
    await db.from("story_reactions").insert({
      story_id: story.id,
      user_id: currentUserId,
      emoji,
    });
  };

  if (!story) return null;

  return (
    <div className="fixed left-0 top-0 z-50 flex items-center justify-center bg-black select-none no-select" style={{ height: "var(--tiger-viewport-height, 100dvh)", right: 0 }}>
      <audio ref={audioRef} loop muted={muted} />

      <div className="absolute top-0 left-0 right-0 flex gap-1 p-2 z-10">
        {stories.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-100"
              style={{ width: i < currentIndex ? "100%" : i === currentIndex ? `${progress}%` : "0%" }}
            />
          </div>
        ))}
      </div>

      <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-3 mt-2">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold text-secondary-foreground">
            {story.avatar}
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">{story.userName}</p>
            <p className="text-[10px] text-white/60 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Screen privacy on
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          {(story.musicUrl || isVideo) && (
            <button onClick={() => void toggleSound()} className="p-2 rounded-full hover:bg-white/10" aria-label={muted ? "Enable status sound" : "Mute status sound"}>
              {muted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
            </button>
          )}
          {isOwner && <>
            <span className="flex items-center gap-1 text-white text-xs"><Heart className="w-4 h-4 text-rose-400" /> {Object.values(counts).reduce((total, count) => total + count, 0)}</span>
            <button type="button" onClick={() => { setViewsOpen(true); setCommentsOpen(true); }} className="flex items-center gap-1 text-white text-xs" aria-label="Show people who viewed status"><Eye className="w-4 h-4" /> {viewCount}</button>
            <button type="button" onClick={() => void deleteStory()} className="p-2 rounded-full hover:bg-white/10" aria-label="Delete status"><Trash2 className="w-4 h-4 text-white" /></button>
          </>}
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      <div className="w-full h-full flex items-center justify-center">
        {isText ? (
          <div className="w-full h-full flex items-center justify-center px-8 text-center text-white font-bold whitespace-pre-wrap" style={{ backgroundColor: story.backgroundColor || "#6D28D9", fontFamily: story.textOverlay?.text_font || "sans-serif", fontSize: (story.textOverlay?.text_size || 30) + "px" }}>
            {story.caption || story.textOverlay?.text || "Status"}
          </div>
        ) : isVideo && story.imageUrl ? (
          <video
            ref={videoRef}
            src={story.imageUrl}
            autoPlay
            muted={muted}
            playsInline
            className="max-w-full max-h-full object-contain"
            style={{ filter: story.textOverlay?.image_filter || "none" }}
            onEnded={goNext}
          />
        ) : story.imageUrl ? (
          <>
            {!imgLoaded && (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <img
              src={story.imageUrl}
              alt="Story"
              className={`max-w-full max-h-full object-contain transition-opacity duration-500 ${imgLoaded ? "opacity-100" : "opacity-0 absolute"}`}
              style={{ filter: story.textOverlay?.image_filter || "none" }}
              onLoad={() => setImgLoaded(true)}
            />
          </>
        ) : (
          <div className="text-white text-xl font-semibold">{story.caption || "📸"}</div>
        )}
      </div>

      {story.textOverlay?.text && (
        <div className="absolute inset-x-0 top-1/3 text-center px-6 pointer-events-none">
          <span className="inline-block text-2xl font-bold px-4 py-2 rounded-lg" style={{ color: story.textOverlay.text_color || "#FFFFFF", backgroundColor: story.textOverlay.text_background || "rgba(0,0,0,0.65)", fontFamily: story.textOverlay.text_font || "sans-serif", fontSize: story.textOverlay.text_size || 24 }}>
            {story.textOverlay.text}
          </span>
        </div>
      )}
      {story.textOverlay?.drawing_url && <img src={story.textOverlay.drawing_url} alt="Status drawing" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />}
      {story.textOverlay?.sticker && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-7xl">{story.textOverlay.sticker}</div>
      )}

      {/* Floating reactions */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {floaters.map((f) => (
          <span
            key={f.id}
            className="absolute bottom-24 text-4xl animate-float-up"
            style={{ left: `${f.left}%` }}
          >
            {f.emoji}
          </span>
        ))}
      </div>

      {story.musicUrl && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full z-10">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-0.5 bg-white rounded-full animate-pulse"
                style={{ height: `${8 + Math.random() * 8}px`, animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
          <span className="text-white text-[10px]">{story.textOverlay?.music_title || "♪ Playing music"}</span>
        </div>
      )}

      {story.caption && !isText && (
        <div className="absolute bottom-20 left-0 right-0 text-center px-4">
          <p className="text-white text-sm bg-black/50 inline-block px-4 py-2 rounded-full">{story.caption}</p>
        </div>
      )}

      {/* Tiger pop layer */}
      <TigerReactionLayer trigger={tigerTrigger} />

      {commentsOpen && (
        <div className="absolute bottom-20 left-3 right-3 z-30 max-h-56 rounded-xl bg-background/95 text-foreground backdrop-blur border border-border shadow-xl p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{isOwner ? `Status activity · ${comments.length} comments · ${viewCount} views` : `Private replies (${comments.length})`}</p>
            <button type="button" onClick={() => setCommentsOpen(false)} className="text-xs text-muted-foreground">Close</button>
          </div>
          <div className="overflow-y-auto min-h-0 space-y-2">
            {isOwner && viewsOpen && (
              <div className="pb-2 border-b border-border/60">
                <p className="text-xs font-semibold mb-1">Viewed by</p>
                {viewers.length === 0 ? <p className="text-xs text-muted-foreground">No views yet.</p> : viewers.map((viewer) => (
                  <p key={viewer.id} className="text-xs py-1">{viewer.user_name} <span className="text-muted-foreground">{new Date(viewer.viewed_at).toLocaleString()}</span></p>
                ))}
              </div>
            )}
            <p className="text-xs font-semibold">Comments and replies</p>
            {comments.length === 0 ? <p className="text-xs text-muted-foreground">Be the first to reply.</p> : comments.map((comment) => (
              <p key={comment.id} className="text-sm break-words"><span className="font-semibold">{comment.user_name}</span> {comment.content}</p>
            ))}
          </div>
          {!isOwner && currentUserId && (
            <form onSubmit={(event) => { event.preventDefault(); void sendComment(); }} className="flex items-center gap-2">
              <input ref={replyInputRef} value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} maxLength={1000} placeholder="Reply to status..." className="min-w-0 flex-1 rounded-full bg-muted px-3 py-2 text-sm outline-none" />
              <Button size="icon" type="submit" disabled={!commentDraft.trim() || commentLoading} aria-label="Send reply"><Send className="w-4 h-4" /></Button>
            </form>
          )}
        </div>
      )}

      {/* Reactions bar / counts */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/60 backdrop-blur px-3 py-2 rounded-full z-20">
        <button type="button" onClick={() => setCommentsOpen((open) => !open)} className="flex items-center gap-1 px-2 py-1 rounded-full text-white" aria-label="View replies">
          <MessageCircle className="w-5 h-5" />
          <span className="text-xs">{comments.length}</span>
        </button>
        {!isOwner && (
          <button
            onClick={() => sendReaction("🐯")}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/20 hover:bg-primary/40 transition-transform active:scale-150"
            title="Send Tiger 🐯"
          >
            <img src={tigerImg} alt="Tiger" className="w-7 h-7" />
          </button>
        )}
        {REACTIONS.map((e) => {
          const count = counts[e] || 0;
          return (
            <button
              key={e}
              onClick={() => !isOwner && sendReaction(e)}
              disabled={!!isOwner}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xl transition-transform active:scale-150 hover:scale-110 disabled:hover:scale-100 disabled:active:scale-100"
            >
              <span>{e}</span>
              {count > 0 && <span className="text-[11px] font-semibold text-white">{count}</span>}
            </button>
          );
        })}
        {(counts["🐯"] || 0) > 0 && isOwner && (
          <span className="flex items-center gap-1 text-white text-xs font-semibold ml-1">
            🐯 {counts["🐯"]}
          </span>
        )}
      </div>

      <button onClick={goPrev} className="absolute left-0 top-12 bottom-20 w-1/3 z-10" />
      <button onClick={goNext} className="absolute right-0 top-12 bottom-20 w-1/3 z-10" />
    </div>
  );
};
