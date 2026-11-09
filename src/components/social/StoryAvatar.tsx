import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { StoryViewer } from "@/components/chat/StoryViewer";

type Story = Tables<"stories"> & { profile?: Tables<"profiles"> };
type StoryMeta = Story & { music_url?: string | null; media_type?: string | null; text_overlay?: { text: string } | null; duration?: number | null; background_color?: string | null };

interface Props { userId: string; displayName?: string | null; username?: string | null; avatarUrl?: string | null; size?: "sm" | "md" | "lg"; showName?: boolean; className?: string; }
export const StoryAvatar = ({ userId, displayName, username, avatarUrl, size = "md", showName = false, className = "" }: Props) => {
  const navigate = useNavigate();
  const [stories, setStories] = useState<StoryMeta[]>([]);
  const [viewer, setViewer] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.from("stories").select("*").eq("user_id", userId).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: true });
      if (active) { setStories((data || []) as StoryMeta[]); setLoaded(true); }
    };
    void load();
    return () => { active = false; };
  }, [userId]);
  const initials = (displayName || username || "U").slice(0, 2).toUpperCase();
  const dimensions = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-16 w-16" : "h-10 w-10";
  const viewerData = stories.map((s) => ({
    id: s.id, userId: s.user_id, userName: displayName || "User", avatar: initials,
    imageUrl: s.image_url || undefined, caption: s.caption || undefined, musicUrl: s.music_url || undefined,
    mediaType: (s.media_type || "image") as "image" | "video" | "text", textOverlay: s.text_overlay || null,
    duration: s.duration || null, backgroundColor: s.background_color || "#6D28D9",
  }));
  const open = () => stories.length ? setViewer(true) : navigate(`/u/${userId}`);
  return <>
    <button type="button" onClick={open} aria-label={stories.length ? `Open ${displayName || username || "user"} story` : `View ${displayName || username || "user"} profile`} className={`inline-flex items-center gap-2 text-left ${className}`}>
      <span className={`shrink-0 rounded-full p-[2px] ${stories.length ? "bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600" : "bg-transparent"}`}><span className={`flex ${dimensions} items-center justify-center overflow-hidden rounded-full border-2 border-background bg-secondary text-xs font-semibold text-secondary-foreground`}>{avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initials}</span></span>
      {showName && <span className="min-w-0"><span className="block truncate text-sm font-semibold text-foreground">{displayName || "User"}</span>{username && <span className="block truncate text-[11px] text-muted-foreground">@{username}</span>}</span>}
      {!loaded && <span className="sr-only">Checking active stories</span>}
    </button>
    {viewer && <StoryViewer stories={viewerData} initialIndex={0} onClose={() => setViewer(false)} />}
  </>;
};
