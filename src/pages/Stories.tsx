import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { StoryViewer } from "@/components/chat/StoryViewer";
import { StoryUploadDialog } from "@/components/chat/StoryUploadDialog";
import { useAuth } from "@/contexts/AuthContext";
import { Settings as SettingsIcon, Sparkles } from "lucide-react";
import tigerLogo from "@/assets/tigerchats-logo.png";

type Story = Tables<"stories"> & { profile?: Tables<"profiles"> };

const Stories = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [viewer, setViewer] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("stories").select("*").order("created_at", { ascending: false });
    if (data) {
      const enriched = await Promise.all(
        data.map(async (s) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", s.user_id)
            .single();
          return { ...s, profile };
        })
      );
      setStories(enriched);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const viewerData = stories.map((s) => ({
    id: s.id,
    userId: s.user_id,
    userName: s.profile?.display_name || "User",
    avatar: (s.profile?.display_name || "U").slice(0, 2).toUpperCase(),
    imageUrl: s.image_url,
    caption: s.caption || undefined,
    musicUrl: (s as any).music_url || undefined,
    mediaType: ((s as any).media_type || "image") as "image" | "video",
    textOverlay: (s as any).text_overlay || null,
    duration: (s as any).duration || null,
  }));

  return (
    <div className="h-full flex flex-col bg-background">
      {viewer !== null && (
        <StoryViewer
          stories={viewerData}
          initialIndex={viewer}
          onClose={() => setViewer(null)}
          currentUserId={user?.id}
        />
      )}

      <header className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <img src={tigerLogo} alt="" className="w-7 h-7" />
          <h1 className="text-lg font-bold tracking-tight text-foreground">Stories</h1>
        </div>
        <div className="flex items-center gap-1">
          <StoryUploadDialog onUploaded={load} />
          <Link to="/settings" className="p-2 text-muted-foreground hover:text-primary">
            <SettingsIcon className="w-5 h-5" />
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : stories.length === 0 ? (
          <div className="text-center py-20 px-6">
            <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-semibold">No stories yet</p>
            <p className="text-sm text-muted-foreground mt-1">Tap the upload button to share your first story.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {stories.map((s, i) => {
              const isVideo = (s as any).media_type === "video";
              return (
                <button
                  key={s.id}
                  onClick={() => setViewer(i)}
                  className="relative aspect-[3/5] rounded-xl overflow-hidden bg-surface group"
                >
                  {isVideo ? (
                    <video
                      src={s.image_url}
                      muted
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img
                      src={s.image_url}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  )}
                  {isVideo && (
                    <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                      VIDEO
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="text-[11px] text-white font-medium truncate">
                      {s.profile?.display_name || "User"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Stories;
