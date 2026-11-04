import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Megaphone, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const AnnouncementComposer = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<"normal" | "high" | "emergency">("normal");
  const [list, setList] = useState<Tables<"announcements">[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(50);
    if (error) {
      toast({ title: "Could not load announcements", description: error.message, variant: "destructive" });
      return;
    }
    setList(data || []);
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  const publish = async () => {
    if (!user || !title.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("announcements").insert({
      author_id: user.id, title: title.trim(), body: body.trim() || null, priority, is_active: true,
    });
    setBusy(false);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Published", description: "All users will see this popup." });
    setTitle(""); setBody(""); setPriority("normal");
    void load();
  };

  const remove = async (id: string) => {
    setBusy(true);
    const { data, error } = await supabase
      .from("announcements")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();
    setBusy(false);

    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    if (!data) {
      toast({
        title: "Announcement was not deleted",
        description: "No row was deleted. Refresh the page and check your admin permissions.",
        variant: "destructive",
      });
      await load();
      return;
    }

    setList((current) => current.filter((announcement) => announcement.id !== id));
    toast({ title: "Announcement deleted" });
  };

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Megaphone className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Global Announcement</h3>
      </div>
      <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Textarea placeholder="Message body (optional)" value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
      <div className="flex items-center gap-2">
        {(["normal", "high", "emergency"] as const).map((p) => (
          <button key={p} onClick={() => setPriority(p)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              priority === p ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-surface-hover"
            }`}>{p}</button>
        ))}
        <Button onClick={publish} disabled={busy || !title.trim()} className="ml-auto">Publish to all</Button>
      </div>
      {list.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border/30">
          <p className="text-xs text-muted-foreground">Recent</p>
          {list.map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-xs p-2 rounded bg-surface">
              <span className={`w-2 h-2 rounded-full ${a.is_active ? "bg-primary" : "bg-muted"}`} />
              <span className="flex-1 truncate font-medium">{a.title}</span>
              <span className="text-[10px] text-muted-foreground uppercase">{a.priority}</span>
              <button type="button" disabled={busy} onClick={() => void remove(a.id)} className="p-1 hover:bg-destructive/20 rounded disabled:opacity-50" aria-label={`Delete ${a.title}`}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
