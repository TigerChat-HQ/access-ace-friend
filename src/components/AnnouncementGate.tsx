import { useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Megaphone, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Announcement {
  id: string;
  title: string;
  body: string | null;
  media_url: string | null;
  media_type: string | null;
  priority: string;
}

export const AnnouncementGate = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [current, setCurrent] = useState<Announcement | null>(null);

  const fetchNext = useCallback(async () => {
    if (!user) return;
    const { data: dismissed } = await supabase
      .from("announcement_dismissals").select("announcement_id").eq("user_id", user.id);
    const dismissedIds = (dismissed || []).map((d) => d.announcement_id);
    let q = supabase.from("announcements").select("*").order("priority", { ascending: false }).order("created_at", { ascending: false }).limit(1);
    if (dismissedIds.length) q = q.not("id", "in", `(${dismissedIds.join(",")})`);
    const { data } = await q;
    if (data && data[0]) setCurrent(data[0] as Announcement);
  }, [user]);

  useEffect(() => { fetchNext(); }, [fetchNext]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`ann:${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "announcements" }, () => fetchNext())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, fetchNext]);

  const dismiss = async () => {
    if (!current || !user) return;
    await supabase.from("announcement_dismissals").insert({ announcement_id: current.id, user_id: user.id });
    setCurrent(null);
    setTimeout(fetchNext, 300);
  };

  return (
    <>
      {children}
      {current && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className={`relative w-full max-w-md rounded-2xl border overflow-hidden shadow-2xl ${
            current.priority === "emergency"
              ? "bg-destructive/10 border-destructive"
              : current.priority === "high"
              ? "bg-card border-primary"
              : "bg-card border-border"
          }`}>
            <button onClick={dismiss} className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-background/60 hover:bg-background">
              <X className="w-4 h-4" />
            </button>
            {current.media_url && (current.media_type?.startsWith("image") ? (
              <img src={current.media_url} alt="" className="w-full max-h-64 object-cover" />
            ) : current.media_type?.startsWith("video") ? (
              <video src={current.media_url} controls className="w-full max-h-64" />
            ) : null)}
            <div className="p-6 space-y-3">
              <div className="flex items-center gap-2">
                {current.priority === "emergency"
                  ? <AlertTriangle className="w-5 h-5 text-destructive" />
                  : <Megaphone className="w-5 h-5 text-primary" />}
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  {current.priority === "emergency" ? "Emergency" : current.priority === "high" ? "Important" : "Announcement"}
                </span>
              </div>
              <h2 className="text-xl font-bold">{current.title}</h2>
              {current.body && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{current.body}</p>}
              <Button onClick={dismiss} className="w-full" variant={current.priority === "emergency" ? "destructive" : "default"}>
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
