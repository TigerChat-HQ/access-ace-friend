import { useEffect, useState } from "react";
import { BellRing, Clock3, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

declare global { interface Window { TigerNative?: { getAppVersion?: () => string }; } }
type AppRelease = { id: string; version: string; title: string; summary: string; features: string[] | null; update_url: string | null };
type PromptState = { version: string; day: string; shownToday: number; remindAt: number; seenVersion: string };
const storageKey = (userId: string) => `tigerchat:release-prompt:${userId}`;
const localDay = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const readState = (userId: string): PromptState => {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(userId)) || "{}") as Partial<PromptState>;
    return { version: parsed.version || "", day: parsed.day || "", shownToday: Number(parsed.shownToday) || 0, remindAt: Number(parsed.remindAt) || 0, seenVersion: parsed.seenVersion || "" };
  } catch { return { version: "", day: "", shownToday: 0, remindAt: 0, seenVersion: "" }; }
};
const saveState = (userId: string, state: PromptState) => {
  try { localStorage.setItem(storageKey(userId), JSON.stringify(state)); } catch { /* storage may be disabled */ }
};
const compareVersions = (left: string, right: string) => {
  const a = left.split(/[.+-]/).map((part) => Number(part) || 0);
  const b = right.split(/[.+-]/).map((part) => Number(part) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const delta = (a[i] || 0) - (b[i] || 0);
    if (delta !== 0) return delta;
  }
  return 0;
};

export const AppUpdatePrompt = () => {
  const { user } = useAuth();
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const installedVersion = window.TigerNative?.getAppVersion?.();
    if (!installedVersion) return;
    let cancelled = false;
    const checkRelease = async () => {
      const { data, error } = await (supabase as any).from("app_releases")
        .select("id,version,title,summary,features,update_url")
        .eq("is_active", true).in("platform", ["android", "all"])
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (cancelled || error || !data) return;
      const latest = data as AppRelease;
      if (compareVersions(latest.version, installedVersion) <= 0) return;
      const today = localDay();
      const previous = readState(user.id);
      const state: PromptState = previous.version === latest.version
        ? { ...previous, day: today, shownToday: previous.day === today ? previous.shownToday : 0 }
        : { version: latest.version, day: today, shownToday: 0, remindAt: 0, seenVersion: previous.seenVersion };
      if (state.seenVersion === latest.version || state.shownToday >= 3 || state.remindAt > Date.now()) {
        saveState(user.id, state);
        return;
      }
      state.shownToday += 1;
      saveState(user.id, state);
      setRelease(latest);
    };
    void checkRelease();
    return () => { cancelled = true; };
  }, [user?.id]);

  const snooze = (hours: number) => {
    if (!user || !release) return;
    const state = readState(user.id);
    saveState(user.id, { ...state, remindAt: Date.now() + hours * 60 * 60 * 1000 });
    setRelease(null);
    setReminderOpen(false);
  };
  const markSeen = () => {
    if (!user || !release) return;
    const state = readState(user.id);
    saveState(user.id, { ...state, seenVersion: release.version, remindAt: 0 });
    setRelease(null);
    setReminderOpen(false);
  };
  if (!release) return null;

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <section role="dialog" aria-modal="true" aria-labelledby="tiger-update-title" className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-primary/25 bg-card p-4 shadow-2xl animate-fade-in">
        <button type="button" aria-label="Close update notice" onClick={() => setReminderOpen(true)} className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        <div className="mb-3 flex items-center gap-2 text-primary"><span className="rounded-xl bg-primary/10 p-2"><Sparkles className="h-5 w-5" /></span><span className="text-xs font-semibold uppercase tracking-wide">TigerChat update · v{release.version}</span></div>
        <h2 id="tiger-update-title" className="pr-7 text-lg font-bold">{release.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{release.summary}</p>
        {!!release.features?.length && <ul className="mt-3 space-y-1.5 text-sm">{release.features.slice(0, 5).map((feature, index) => <li key={index} className="flex gap-2"><span className="text-primary">•</span><span>{feature}</span></li>)}</ul>}
        {reminderOpen ? (
          <div className="mt-4 rounded-xl bg-muted/60 p-3">
            <p className="mb-2 flex items-center gap-2 text-sm font-medium"><Clock3 className="h-4 w-4" /> Nikukumbushe lini?</p>
            <div className="grid grid-cols-2 gap-2">{[1, 3, 6, 24].map((hours) => <Button key={hours} size="sm" variant="outline" onClick={() => snooze(hours)}>{hours === 24 ? "Kesho" : `Baada ya saa ${hours}`}</Button>)}</div>
            <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={() => setReminderOpen(false)}>Rudi</Button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {release.update_url && <Button className="w-full" onClick={() => { window.open(release.update_url!, "_blank", "noopener,noreferrer"); markSeen(); }}><BellRing className="mr-2 h-4 w-4" /> Sasisha TigerChat</Button>}
            <Button size="sm" variant="ghost" className="w-full" onClick={() => setReminderOpen(true)}>Ghairi / Nikumbushe baadaye</Button>
            <Button size="sm" variant="ghost" className="w-full text-xs text-muted-foreground" onClick={markSeen}>Nimeona mabadiliko</Button>
          </div>
        )}
      </section>
    </div>
  );
};
