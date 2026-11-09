import { useCallback, useEffect, useState } from "react";
import { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StoryViewer } from "@/components/chat/StoryViewer";
import { StoryUploadDialog } from "@/components/chat/StoryUploadDialog";
import { Plus } from "lucide-react";

type Story = Tables<"stories"> & { profile?: Tables<"profiles"> };
type StoryMeta = Story & { music_url?: string | null; media_type?: string | null; text_overlay?: { text: string } | null; duration?: number | null; background_color?: string | null };
export const StoryFeedRail = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<StoryMeta[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.from("stories").select("*").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: true });
    const rows = (data || []) as StoryMeta[];
    const ids = [...new Set(rows.map((story) => story.user_id))];
    const { data: profiles } = ids.length ? await supabase.from("profiles").select("*").in("user_id", ids) : { data: [] };
    const byId = new Map((profiles || []).map((profile) => [profile.user_id, profile]));
    setStories(rows.map((story) => ({ ...story, profile: byId.get(story.user_id) })));
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const channel = supabase.channel("feed-active-stories").on("postgres_changes", { event: "*", schema: "public", table: "stories" }, () => { void load(); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);
  const groups = [...new Set(stories.map((story) => story.user_id))].map((id) => ({ userId: id, items: stories.filter((story) => story.user_id === id) }));
  const current = groups.find((group) => group.userId === selected);
  const viewerData = (current?.items || []).map((s) => ({
    id: s.id, userId: s.user_id, userName: s.profile?.display_name || s.profile?.username || "User",
    avatar: (s.profile?.display_name || s.profile?.username || "U").slice(0, 2).toUpperCase(),
    imageUrl: s.image_url || undefined, caption: s.caption || undefined, musicUrl: s.music_url || undefined,
    mediaType: (s.media_type || "image") as "image" | "video" | "text", textOverlay: s.text_overlay || null,
    duration: s.duration || null, backgroundColor: s.background_color || "#6D28D9",
  }));
  return <>
    <section aria-label="Active stories" className="border-b border-border/50 bg-card/40 px-3 py-3">
      <div className="flex items-start gap-3 overflow-x-auto scrollbar-thin">
        <div className="flex w-16 shrink-0 flex-col items-center gap-1">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-primary/70 bg-background"><StoryUploadDialog onUploaded={load} /><span className="pointer-events-none absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground"><Plus className="h-3 w-3" /></span></div>
          <span className="max-w-16 truncate text-[10px] text-muted-foreground">Your story</span>
        </div>
        {groups.filter((group) => group.userId !== user?.id).map((group) => {
          const profile = group.items[0]?.profile;
          const name = profile?.display_name || profile?.username || "User";
          return <button key={group.userId} type="button" onClick={() => setSelected(group.userId)} className="flex w-16 shrink-0 flex-col items-center gap-1">
            <span className="rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600 p-[2px]"><span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-background bg-secondary text-sm font-semibold text-secondary-foreground">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : name.slice(0,2).toUpperCase()}</span></span>
            <span className="max-w-16 truncate text-[10px] text-foreground">{name}</span>
          </button>;
        })}
      </div>
    </section>
    {selected && current && <StoryViewer stories={viewerData} initialIndex={0} onClose={() => setSelected(null)} currentUserId={user?.id} onStoryDeleted={(id) => setStories((items) => items.filter((item) => item.id !== id))} />}
  </>;
};
