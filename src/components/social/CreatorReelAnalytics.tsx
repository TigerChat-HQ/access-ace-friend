import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BarChart3, Eye, Users, Clock3, Target, Download } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type EventRow = {
  event_type: string;
  viewer_id: string;
  watch_seconds: number | string;
  occurred_at: string;
};

const db = supabase as unknown as SupabaseClient;

export const CreatorReelAnalytics = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!user) return;
      setLoading(true);
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data, error } = await db
        .from("post_analytics_events")
        .select("event_type, viewer_id, watch_seconds, occurred_at")
        .eq("creator_id", user.id)
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: false })
        .limit(10000);
      if (!active) return;
      setAvailable(!error);
      setEvents((data || []) as EventRow[]);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [user]);

  const daily = useMemo(() => Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - index));
    const key = date.toISOString().slice(0, 10);
    const rows = events.filter((event) => event.occurred_at.slice(0, 10) === key);
    return {
      key,
      label: date.toLocaleDateString(undefined, { month: "numeric", day: "numeric" }),
      impressions: rows.filter((event) => event.event_type === "impression").length,
      plays: rows.filter((event) => event.event_type === "play").length,
    };
  }), [events]);

  const exportCsv = () => {
    const rows = [["date", "impressions", "plays"], ...daily.map((day) => [day.key, String(day.impressions), String(day.plays)])];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "tigerchat-reels-analytics.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const metrics = useMemo(() => {
    const impressions = events.filter((event) => event.event_type === "impression");
    const plays = events.filter((event) => event.event_type === "play").length;
    const completions = events.filter((event) => event.event_type === "retention_100").length;
    const watchSeconds = events.filter((event) => event.event_type === "watch")
      .reduce((sum, event) => sum + Number(event.watch_seconds || 0), 0);
    const retention = (type: string) => plays ? Math.round(events.filter((event) => event.event_type === type).length / plays * 100) : 0;
    return {
      impressions: impressions.length,
      reach: new Set(impressions.map((event) => event.viewer_id)).size,
      watchMinutes: Math.round(watchSeconds / 60),
      completionRate: plays ? Math.round(completions / plays * 100) : 0,
      retention25: retention("retention_25"),
      retention50: retention("retention_50"),
      retention75: retention("retention_75"),
    };
  }, [events]);

  return (
    <section className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-foreground">Reels analytics · last 30 days</h2>
        </div>
        <button onClick={exportCsv} disabled={!events.length} className="flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1.5 text-xs text-secondary-foreground disabled:opacity-40">
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>
      {loading ? (
        <p className="py-5 text-center text-sm text-muted-foreground">Loading video analytics…</p>
      ) : !available ? (
        <p role="status" className="text-sm text-muted-foreground">Reels analytics will appear after the analytics database migration is enabled.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Metric icon={<Eye className="h-4 w-4" />} label="Impressions" value={metrics.impressions.toLocaleString()} />
            <Metric icon={<Users className="h-4 w-4" />} label="Unique reach" value={metrics.reach.toLocaleString()} />
            <Metric icon={<Clock3 className="h-4 w-4" />} label="Watch time" value={`${metrics.watchMinutes} min`} />
            <Metric icon={<Target className="h-4 w-4" />} label="Completion rate" value={`${metrics.completionRate}%`} />
          </div>
          <div className="rounded-xl bg-background/70 p-3">
            <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>Daily activity · 14 days</span><span>Impressions / plays</span>
            </div>
            <div className="flex h-24 items-end gap-1">
              {daily.map((day) => {
                const max = Math.max(1, ...daily.map((item) => Math.max(item.impressions, item.plays)));
                return (
                  <div key={day.key} title={`${day.key}: ${day.impressions} impressions, ${day.plays} plays`} className="flex h-full min-w-0 flex-1 items-end justify-center gap-0.5">
                    <div className="w-1/2 rounded-t bg-primary/80" style={{ height: `${day.impressions / max * 100}%` }} />
                    <div className="w-1/2 rounded-t bg-sky-500/70" style={{ height: `${day.plays / max * 100}%` }} />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-muted-foreground"><span>{daily[0]?.label}</span><span>{daily[daily.length - 1]?.label}</span></div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground"><span>Audience retention</span><span>Share of plays reaching each point</span></div>
            {[
              ["25%", metrics.retention25],
              ["50%", metrics.retention50],
              ["75%", metrics.retention75],
              ["100%", metrics.completionRate],
            ].map(([label, value]) => (
              <div key={label} className="mb-2 grid grid-cols-[42px_1fr_38px] items-center gap-2 text-xs">
                <span className="text-muted-foreground">{label}</span>
                <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} /></div>
                <span className="text-right tabular-nums text-foreground">{value}%</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">Metrics are collected from this release onward; historical views and watch time are not backfilled. Self-views are excluded.</p>
        </>
      )}
    </section>
  );
};

const Metric = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="rounded-xl border border-border/50 bg-background/70 p-3">
    <div className="mb-1 flex items-center gap-2 text-primary">{icon}<span className="text-[11px] text-muted-foreground">{label}</span></div>
    <p className="text-xl font-bold tabular-nums text-foreground">{value}</p>
  </div>
);
