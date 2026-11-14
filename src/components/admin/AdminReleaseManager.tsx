import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Smartphone, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type ReleaseRow = { id: string; version: string; title: string; summary: string; created_at: string; is_active: boolean };
export const AdminReleaseManager = () => {
  const { toast } = useToast();
  const [version, setVersion] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [features, setFeatures] = useState("");
  const [updateUrl, setUpdateUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [releases, setReleases] = useState<ReleaseRow[]>([]);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any).from("app_releases")
      .select("id,version,title,summary,created_at,is_active").eq("platform", "android")
      .order("created_at", { ascending: false }).limit(8);
    if (error) {
      toast({ title: "Imeshindikana kusoma matoleo", description: error.message, variant: "destructive" });
      return;
    }
    setReleases((data || []) as ReleaseRow[]);
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const publish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\d+(\.\d+){1,3}$/.test(version.trim())) {
      toast({ title: "Toleo si sahihi", description: "Tumia muundo kama 1.0.37", variant: "destructive" });
      return;
    }
    if (!/^https:\/\//i.test(updateUrl.trim())) {
      toast({ title: "Link si sahihi", description: "Tumia link salama inayoanza na https://", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("app_releases").insert({
      platform: "android", version: version.trim(), title: title.trim(), summary: summary.trim(),
      features: features.split("\n").map((item) => item.trim()).filter(Boolean).slice(0, 5),
      update_url: updateUrl.trim(), is_active: true,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Imeshindikana kuchapisha update", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Update notes zimechapishwa", description: "Watumiaji wa APK wataanza kuona ujumbe wa toleo hili." });
    setVersion(""); setTitle(""); setSummary(""); setFeatures(""); setUpdateUrl("");
    void load();
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2"><Smartphone className="h-5 w-5 text-primary" /><div><h2 className="font-semibold">Android app updates</h2><p className="text-xs text-muted-foreground">Chapisha toleo jipya na maelezo mafupi yatakayoonekana ndani ya APK.</p></div></div>
      <form onSubmit={(event) => void publish(event)} className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label htmlFor="release-version">Version</Label><Input id="release-version" value={version} onChange={(event) => setVersion(event.target.value)} placeholder="1.0.37" required /></div>
          <div className="space-y-1"><Label htmlFor="release-url">Download / update link</Label><Input id="release-url" type="url" value={updateUrl} onChange={(event) => setUpdateUrl(event.target.value)} placeholder="https://..." required /></div>
        </div>
        <div className="space-y-1"><Label htmlFor="release-title">Kichwa cha ujumbe</Label><Input id="release-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="TigerChat imeboreshwa!" required /></div>
        <div className="space-y-1"><Label htmlFor="release-summary">Muhtasari</Label><Textarea id="release-summary" value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={500} rows={2} placeholder="Eleza kwa kifupi kilichoboreshwa..." required /></div>
        <div className="space-y-1"><Label htmlFor="release-features">Features mpya (kila kipengele mstari wake, hadi 5)</Label><Textarea id="release-features" value={features} onChange={(event) => setFeatures(event.target.value)} rows={4} placeholder={"Voice notes zenye pause na waveform\nMini-player inayoendelea chat zikibadilishwa\nTranscription yenye faragha"} /></div>
        <Button type="submit" disabled={saving} className="w-full"><UploadCloud className="mr-2 h-4 w-4" />{saving ? "Inachapisha..." : "Chapisha update notes"}</Button>
      </form>
      <div className="space-y-2"><h3 className="text-sm font-semibold">Matoleo yaliyotangazwa</h3>{releases.length ? releases.map((item) => <div key={item.id} className="rounded-lg border border-border bg-card p-3"><div className="flex items-center justify-between gap-2"><span className="font-semibold text-sm">v{item.version} · {item.title}</span><span className="text-[10px] text-muted-foreground">{item.is_active ? "Active" : "Inactive"}</span></div><p className="mt-1 text-xs text-muted-foreground">{item.summary}</p><p className="mt-1 text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p></div>) : <p className="text-xs text-muted-foreground">Bado hakuna update notes zilizochapishwa.</p>}</div>
    </section>
  );
};
