import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface StoryData {
  id: string;
  userId: string;
  userName: string;
  avatar: string;
  imageUrl?: string;
  caption?: string;
}

interface StoryViewerProps {
  stories: StoryData[];
  initialIndex: number;
  onClose: () => void;
  currentUserId?: string;
}

export const StoryViewer = ({ stories, initialIndex, onClose, currentUserId }: StoryViewerProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const story = stories[currentIndex];

  useEffect(() => {
    setProgress(0);
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
        return p + 2;
      });
    }, 100);

    // Record view
    if (currentUserId && story && story.userId !== currentUserId) {
      supabase.from("story_views").insert({
        story_id: story.id,
        viewer_id: currentUserId,
      }).then(() => {});
    }

    return () => clearInterval(interval);
  }, [currentIndex, stories.length, onClose, currentUserId, story]);

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

  if (!story) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      {/* Progress bars */}
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

      {/* Header */}
      <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-3 mt-2">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold text-secondary-foreground">
            {story.avatar}
          </div>
          <span className="text-white font-semibold text-sm">{story.userName}</span>
        </div>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors mt-2">
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Story content */}
      <div className="w-full h-full flex items-center justify-center">
        {story.imageUrl ? (
          <img src={story.imageUrl} alt="Story" className="max-w-full max-h-full object-contain" />
        ) : (
          <div className="text-white text-xl font-semibold">{story.caption || "📸"}</div>
        )}
      </div>

      {/* Caption */}
      {story.caption && story.imageUrl && (
        <div className="absolute bottom-8 left-0 right-0 text-center px-4">
          <p className="text-white text-sm bg-black/50 inline-block px-4 py-2 rounded-full">{story.caption}</p>
        </div>
      )}

      {/* Navigation */}
      <button onClick={goPrev} className="absolute left-0 top-0 bottom-0 w-1/3 z-10" />
      <button onClick={goNext} className="absolute right-0 top-0 bottom-0 w-1/3 z-10" />
    </div>
  );
};
