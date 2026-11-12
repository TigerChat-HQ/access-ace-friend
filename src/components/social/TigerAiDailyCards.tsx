import { useCallback, useEffect, useState } from "react";
import { Clock3, Sparkles, MessageCircle, Send, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type AiCard = {
  id: string;
  card_type: "status" | "post";
  title: string;
  body: string;
  theme: "sunset" | "ocean" | "forest" | "royal";
  created_at: string;
  expires_at: string;
};

const themes: Record<AiCard["theme"], string> = {
  sunset: "from-orange-500 via-rose-600 to-fuchsia-800",
  ocean: "from-cyan-500 via-blue-700 to-indigo-950",
  forest: "from-emerald-500 via-teal-700 to-slate-950",
  royal: "from-violet-600 via-purple-800 to-slate-950",
};

export const TigerAiDailyCards = () => {
  const [cards, setCards] = useState<AiCard[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("tiger_ai_social_cards")
      .select("id,card_type,title,body,theme,created_at,expires_at")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(4);
    if (error) {
      console.warn("Tiger AI daily cards unavailable", error);
      setCards([]);
    } else {
      setCards((data || []) as AiCard[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase.channel("tiger-ai-daily-social-cards")
      .on("postgres_changes", { event: "*", schema: "public", table: "tiger_ai_social_cards" }, () => void load())
      .subscribe();
    const refresh = window.setInterval(() => void load(), 60_000);
    return () => {
      window.clearInterval(refresh);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  if (loading || cards.length === 0) return null;

  return (
    <section aria-label="Machapisho ya kila siku ya Tiger AI" className="space-y-3 px-3 py-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="h-4 w-4" /></span>
          <div><h2 className="text-sm font-extrabold">Tiger AI Daily</h2><p className="text-[10px] text-muted-foreground">Status na machapisho mapya kila siku</p></div>
        </div>
        <span className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[10px] font-bold text-primary">{cards.length}/4 leo</span>
      </div>
      {cards.map((card) => (
        <article key={card.id} className={`relative isolate overflow-hidden rounded-3xl bg-gradient-to-br ${themes[card.theme] || themes.sunset} p-5 text-white shadow-xl shadow-black/10`}>
          <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full border-[18px] border-white/10" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-12 -left-6 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider backdrop-blur">
                <Sparkles className="h-3 w-3" /> Tiger AI · {card.card_type === "status" ? "Status" : "Post"}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-white/80"><Clock3 className="h-3 w-3" /> Saa 24</span>
            </div>
            <h3 className="mt-4 text-xl font-black leading-tight drop-shadow-sm">{card.title}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-white/95">{card.body}</p>
            <div className="mt-5 flex items-center justify-between border-t border-white/20 pt-3 text-[10px] text-white/75">
              <span className="font-semibold tracking-wide">TIGERCHATS COMMUNITY</span>
              <span>Hujifuta baada ya saa 24</span>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
};
