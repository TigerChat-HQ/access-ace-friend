import { useState, useEffect, useRef } from "react";
import { X, Volume2, VolumeX, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface StoryData {
  id: string;
  userId: string;
  userName: string;
  avatar: string;
  imageUrl?: string;
  caption?: string;
  musicUrl?: string;
  mediaType?: "image" | "video";
  textOverlay?: { text: string } | null;
  duration?: number | null;
}

interface StoryViewerProps {
  stories: StoryData[];
  initialIndex: number;
  onClose: () => void;
  currentUserId?: string;
}

const REACTIONS = ["❤️", "🔥", "😂", "😮", "😢", "👏"];

export const StoryViewer = ({ stories, initialIndex, onClose, currentUserId }: StoryViewerProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reactionFlash, setReactionFlash] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const story = stories[currentIndex];

  const isVideo = story?.mediaType === "video";
  const storyDuration = isVideo && story?.duration ? story.duration * 1000 : 5000;

  useEffect(() => {
    setImgLoaded(false);
    setProgress(0);
  }, [currentIndex]);

  useEffect(() => {
    if (paused) return;
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
      supabase.from("story_views").insert({
        story_id: story.id,
        viewer_id: currentUserId,
      }).then(() => {});
    }

    return () => clearInterval(interval);
  }, [currentIndex, stories.length, onClose, currentUserId, story, paused, storyDuration]);

  useEffect(() => {
    if (audioRef.current) {
      if (story?.musicUrl) {
        audioRef.current.src = story.musicUrl;
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    }
  }, [story?.musicUrl, currentIndex]);

  const goNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setProgress(0);
    }
  };

  const sendReaction = async (emoji: string) => {
    setReactionFlash(emoji);
    setTimeout(() => setReactionFlash(null), 1200);
    if (currentUserId && story) {
      await supabase.from("story_reactions" as any).insert({
        story_id: story.id,
        user_id: currentUserId,
        emoji,
      });
    }
  };

  if (!story) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none">
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
          <span className="text-white font-semibold text-sm">{story.userName}</span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          {(story.musicUrl || isVideo) && (
            <button onClick={() => setMuted(!muted)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
              {muted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
            </button>
          )}
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      <div className="w-full h-full flex items-center justify-center">
        {isVideo && story.imageUrl ? (
          <video
            ref={videoRef}
            src={story.imageUrl}
            autoPlay
            muted={muted}
            playsInline
            className="max-w-full max-h-full object-contain"
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
              onLoad={() => setImgLoaded(true)}
            />
          </>
        ) : (
          <div className="text-white text-xl font-semibold">{story.caption || "📸"}</div>
        )}
      </div>

      {story.textOverlay?.text && (
        <div className="absolute inset-x-0 top-1/3 text-center px-6 pointer-events-none">
          <span className="inline-block bg-black/60 text-white text-2xl font-bold px-4 py-2 rounded-lg">
            {story.textOverlay.text}
          </span>
        </div>
      )}

      {reactionFlash && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-7xl animate-scale-in">{reactionFlash}</span>
        </div>
      )}

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
          <span className="text-white text-[10px]">♪ Playing music</span>
        </div>
      )}

      {story.caption && (
        <div className="absolute bottom-20 left-0 right-0 text-center px-4">
          <p className="text-white text-sm bg-black/50 inline-block px-4 py-2 rounded-full">{story.caption}</p>
        </div>
      )}

      {/* Reactions bar */}
      {currentUserId && story.userId !== currentUserId && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 backdrop-blur px-3 py-2 rounded-full z-20">
          {REACTIONS.map((e) => (
            <button
              key={e}
              onClick={() => sendReaction(e)}
              className="text-2xl transition-transform active:scale-150 hover:scale-125"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <button onClick={goPrev} className="absolute left-0 top-12 bottom-20 w-1/3 z-10" />
      <button onClick={goNext} className="absolute right-0 top-12 bottom-20 w-1/3 z-10" />
    </div>
  );
};
