import { useEffect, useMemo, useState } from "react";
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Video, X, Clock, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

type SignalRow = {
  id: string; caller_id: string; callee_id: string; conversation_id: string | null;
  call_type: string; signal_type: string; signal_data: Record<string, unknown> | null;
  status: string; created_at: string;
};
type HistoryItem = {
  callId: string; conversationId: string | null; otherUserId: string; callType: "voice" | "video";
  direction: "incoming" | "outgoing"; missed: boolean; startedAt: string; endedAt: string | null;
};
type Profile = { user_id: string; display_name: string | null; avatar_url?: string | null };

interface Props { onClose: () => void; onOpenConversation: (conversationId: string) => void; }

export const CallHistoryDialog = ({ onClose, onOpenConversation }: Props) => {
  const { user } = useAuth();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "missed">("all");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const load = async () => {
      setLoading(true); setError("");
      const { data, error: queryError } = await supabase.from("call_signals")
        .select("id,caller_id,callee_id,conversation_id,call_type,signal_type,signal_data,status,created_at")
        .or(`caller_id.eq.${user.id},callee_id.eq.${user.id}`)
        .order("created_at", { ascending: false }).limit(500);
      if (!alive) return;
      if (queryError) { setError(queryError.message); setLoading(false); return; }
      const rows = (data || []) as SignalRow[];
      const grouped = new Map<string, SignalRow[]>();
      for (const row of rows) {
        const id = typeof row.signal_data?.callId === "string" ? row.signal_data.callId : row.id;
        const group = grouped.get(id) || []; group.push(row); grouped.set(id, group);
      }
      const history: HistoryItem[] = [];
      for (const [callId, signals] of grouped) {
        const offer = signals.find(s => s.signal_type === "offer");
        if (!offer) continue;
        const end = signals.find(s => ["hangup", "reject"].includes(s.signal_type) || s.status === "ended");
        const answered = signals.some(s => s.signal_type === "answer");
        const outgoing = offer.caller_id === user.id;
        history.push({
          callId, conversationId: offer.conversation_id,
          otherUserId: outgoing ? offer.callee_id : offer.caller_id,
          callType: offer.call_type === "video" ? "video" : "voice",
          direction: outgoing ? "outgoing" : "incoming",
          missed: !answered && (!outgoing || !!end),
          startedAt: offer.created_at, endedAt: end?.created_at || null,
        });
      }
      history.sort((a,b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
      const ids = [...new Set(history.map(x => x.otherUserId))];
      const { data: people } = ids.length ? await supabase.from("profiles").select("user_id,display_name,avatar_url").in("user_id", ids) : { data: [] as Profile[] };
      if (!alive) return;
      setItems(history);
      setProfiles(Object.fromEntries(((people || []) as Profile[]).map(p => [p.user_id,p])));
      setLoading(false);
    };
    void load();
    return () => { alive = false; };
  }, [user]);

  const visible = useMemo(() => filter === "missed" ? items.filter(i => i.missed) : items, [items, filter]);
  const durationLabel = (item: HistoryItem) => {
    if (!item.endedAt) return item.missed ? "Missed" : "Duration unavailable";
    const seconds = Math.max(0, Math.floor((new Date(item.endedAt).getTime() - new Date(item.startedAt).getTime()) / 1000));
    return `${Math.floor(seconds/60)}m ${seconds%60}s`;
  };
  return <div className="fixed inset-0 z-[70] bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Call history">
    <section className="w-full sm:max-w-lg max-h-[88vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div><h2 className="font-semibold text-foreground">Call history</h2><p className="text-xs text-muted-foreground">Your recent voice and video calls</p></div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close call history"><X className="w-5 h-5" /></Button>
      </header>
      <div className="flex gap-2 p-3 border-b border-border">
        <Button size="sm" variant={filter === "all" ? "default" : "secondary"} onClick={() => setFilter("all")}>All calls</Button>
        <Button size="sm" variant={filter === "missed" ? "default" : "secondary"} onClick={() => setFilter("missed")}><PhoneMissed className="w-4 h-4 mr-1" />Missed</Button>
      </div>
      <div className="overflow-y-auto flex-1">
        {loading ? <div className="py-12 text-center text-sm text-muted-foreground">Loading call history…</div>
        : error ? <div className="p-5 text-sm text-destructive">Could not load call history: {error}</div>
        : visible.length === 0 ? <div className="py-14 text-center text-sm text-muted-foreground">No calls yet</div>
        : visible.map(item => {
          const person = profiles[item.otherUserId];
          const name = person?.display_name || "TigerChat user";
          const DirectionIcon = item.missed ? PhoneMissed : item.direction === "incoming" ? PhoneIncoming : PhoneOutgoing;
          return <article key={item.callId} className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${item.missed ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}><DirectionIcon className="w-5 h-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm text-foreground truncate">{name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">{item.callType === "video" ? <Video className="w-3 h-3" /> : <Phone className="w-3 h-3" />}{item.direction === "incoming" ? "Incoming" : "Outgoing"}{item.missed ? " · Missed" : ""} · {new Date(item.startedAt).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Clock className="w-3 h-3" />{durationLabel(item)}</p>
            </div>
            {item.conversationId && <Button size="icon" variant="ghost" title="Open chat to call back" aria-label={`Open chat with ${name}`} onClick={() => onOpenConversation(item.conversationId!)}><RotateCcw className="w-4 h-4" /></Button>}
          </article>;
        })}
      </div>
    </section>
  </div>;
};
