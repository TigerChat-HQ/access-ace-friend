import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Award, Bot, CalendarCheck, Plus, ShieldCheck, Activity, Users, Clock3 } from "lucide-react";

type BadgeType = { id: string; badge_name: string; emoji: string; description: string; award_rule: string; threshold: number; is_enabled: boolean };
type Settings = { seasons_enabled: boolean; tiger_ai_supervisor_enabled: boolean };

export function DraughtsAdminControl() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings>({ seasons_enabled: true, tiger_ai_supervisor_enabled: true });
  const [badges, setBadges] = useState<BadgeType[]>([]);
  const [season, setSeason] = useState<{ name: string } | null>(null);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🏅");
  const [description, setDescription] = useState("");
  const [rule, setRule] = useState("top_n");
  const [threshold, setThreshold] = useState(10);
  const [saving, setSaving] = useState(false);
  const [liveCounts, setLiveCounts] = useState({ active: 0, waiting: 0, total: 0 });
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [lastLiveUpdate, setLastLiveUpdate] = useState<Date | null>(null);

  const load = async () => {
    const [s, b, active] = await Promise.all([
      supabase.from("draughts_admin_settings").select("seasons_enabled,tiger_ai_supervisor_enabled").eq("id", true).maybeSingle(),
      supabase.from("draughts_badge_types").select("*").order("created_at"),
      supabase.from("draughts_seasons").select("name").eq("is_active", true).maybeSingle(),
    ]);
    if (s.data) setSettings(s.data);
    setBadges((b.data || []) as BadgeType[]);
    setSeason(active.data);
  };
  const loadLiveCounts = useCallback(async () => {
    const { data, error } = await supabase.from("draft_matches").select("id,status");
    if (error) {
      setLiveError(error.message);
      setLiveLoading(false);
      return;
    }
    const rows = data || [];
    setLiveCounts({
      active: rows.filter(row => row.status === "active").length,
      waiting: rows.filter(row => row.status === "waiting").length,
      total: rows.length,
    });
    setLiveError(null);
    setLastLiveUpdate(new Date());
    setLiveLoading(false);
  }, []);

  useEffect(() => {
    void load();
    void loadLiveCounts();
    const channel = supabase.channel("draughts-admin-live-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "draft_matches" }, () => {
        void loadLiveCounts();
      })
      .subscribe();
    // Reconcile periodically in case a realtime event is missed while a device is offline.
    const refresh = window.setInterval(() => { void loadLiveCounts(); }, 30000);
    return () => {
      window.clearInterval(refresh);
      void supabase.removeChannel(channel);
    };
  }, [loadLiveCounts]);

  const updateSetting = async (key: keyof Settings, value: boolean) => {
    const next = { ...settings, [key]: value };
    const { error } = await supabase.from("draughts_admin_settings").update({ ...next, updated_at: new Date().toISOString() }).eq("id", true);
    if (error) toast({ title: "Setting was not saved", description: error.message, variant: "destructive" });
    else { setSettings(next); toast({ title: "Draughts setting enabled/updated" }); }
  };

  const saveBadge = async () => {
    if (!name.trim() || !description.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("draughts_badge_types").insert({
      badge_name: name.trim(), emoji, description: description.trim(), award_rule: rule, threshold, is_enabled: true,
    });
    setSaving(false);
    if (error) toast({ title: "Could not create badge", description: error.message, variant: "destructive" });
    else { setName(""); setDescription(""); toast({ title: "Badge created and enabled" }); await load(); }
  };

  const toggleBadge = async (badge: BadgeType) => {
    const { error } = await supabase.from("draughts_badge_types").update({ is_enabled: !badge.is_enabled }).eq("id", badge.id);
    if (error) toast({ title: "Could not update badge", description: error.message, variant: "destructive" });
    else await load();
  };

  const closeSeason = async () => {
    if (!settings.seasons_enabled || !confirm("Close the active season, award all enabled badges, and start the next season?")) return;
    setSaving(true);
    const { data, error } = await supabase.rpc("close_draughts_season", { p_season_id: null });
    setSaving(false);
    if (error) toast({ title: "Season could not be closed", description: error.message, variant: "destructive" });
    else { const awarded = (data as { badges_awarded?: number } | null)?.badges_awarded ?? 0; toast({ title: "Season closed", description: `${awarded} badges awarded. New season started.` }); await load(); }
  };

  return <section className="rounded-2xl border border-border/60 bg-card p-4 space-y-4">
    <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary"/><div><h2 className="font-bold text-sm">Draughts Season & Badge Control</h2><p className="text-xs text-muted-foreground">Admin-only controls · Active: {season?.name || "No active season"}</p></div></div>
    <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-primary"/><h3 className="text-sm font-bold">Live Draughts Sessions</h3></div>
        <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"/>LIVE</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border/50 bg-card p-3">
          <div className="flex items-center gap-2 text-muted-foreground"><Activity className="h-4 w-4"/><span className="text-xs">Games in progress</span></div>
          <p className="mt-1 text-2xl font-bold tabular-nums">{liveLoading ? "…" : liveCounts.active}</p>
        </div>
        <div className="rounded-lg border border-border/50 bg-card p-3">
          <div className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4"/><span className="text-xs">Waiting rooms</span></div>
          <p className="mt-1 text-2xl font-bold tabular-nums">{liveLoading ? "…" : liveCounts.waiting}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span>{liveLoading ? "Loading live data…" : `${liveCounts.total} total saved matches`}</span>
        <span className="flex items-center gap-1"><Clock3 className="h-3 w-3"/>{lastLiveUpdate ? `Updated ${lastLiveUpdate.toLocaleTimeString()}` : "Waiting for data"}</span>
      </div>
      {liveError && <p role="alert" className="text-xs text-destructive">Live session data unavailable: {liveError}</p>}
    </div>
    <label className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 p-3"><span className="text-sm font-medium">Enable season management and awards</span><input type="checkbox" checked={settings.seasons_enabled} onChange={e => void updateSetting("seasons_enabled", e.target.checked)} /></label>
    <label className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 p-3"><span className="flex items-center gap-2 text-sm font-medium"><Bot className="h-4 w-4"/>Tiger AI game supervisor</span><input type="checkbox" checked={settings.tiger_ai_supervisor_enabled} onChange={e => void updateSetting("tiger_ai_supervisor_enabled", e.target.checked)} /></label>
    <Button className="w-full" disabled={!settings.seasons_enabled || saving || !season} onClick={closeSeason}><CalendarCheck className="mr-2 h-4 w-4"/>Close season & award enabled badges</Button>
    <div className="space-y-2"><h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Badge catalogue</h3>
      {badges.map(b => <div key={b.id} className="flex items-center gap-2 rounded-lg border border-border/50 p-2"><span className="text-xl">{b.emoji}</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{b.badge_name}</p><p className="text-[10px] text-muted-foreground">{b.description} · {b.award_rule.replace("_"," ")} ≥ {b.threshold}</p></div><Button size="sm" variant={b.is_enabled ? "default" : "outline"} onClick={() => void toggleBadge(b)}>{b.is_enabled ? "Enabled" : "Enable"}</Button></div>)}
    </div>
    <div className="space-y-2 rounded-xl border border-border/50 p-3"><h3 className="flex items-center gap-2 text-sm font-bold"><Plus className="h-4 w-4"/>Create a badge</h3>
      <div className="grid grid-cols-[76px_1fr] gap-2"><input value={emoji} onChange={e=>setEmoji(e.target.value)} aria-label="Badge emoji" maxLength={8} className="h-10 rounded-md border border-border bg-background px-2 text-center"/><input value={name} onChange={e=>setName(e.target.value)} placeholder="Badge name" className="h-10 rounded-md border border-border bg-background px-3 text-sm"/></div>
      <input value={description} onChange={e=>setDescription(e.target.value)} placeholder="What must a player achieve?" className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"/>
      <div className="grid grid-cols-2 gap-2"><select value={rule} onChange={e=>setRule(e.target.value)} className="h-10 rounded-md border border-border bg-background px-2 text-xs"><option value="top_n">Top N ranking</option><option value="wins">Minimum wins</option><option value="rating">Minimum rating</option><option value="participation">Games played</option></select><input type="number" min={1} value={threshold} onChange={e=>setThreshold(Math.max(1,Number(e.target.value)))} className="h-10 rounded-md border border-border bg-background px-3 text-sm"/></div>
      <Button className="w-full" disabled={saving || !name.trim() || !description.trim()} onClick={()=>void saveBadge()}><Award className="mr-2 h-4 w-4"/>{saving ? "Saving…" : "Create & enable badge"}</Button>
    </div>
  </section>;
}
