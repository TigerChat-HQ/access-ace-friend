import { useEffect, useState } from "react";
import { AlertTriangle, CalendarDays, ExternalLink, Sparkles, Trophy, Cake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type HistoryItem = { year: number | null; title: string; summary: string; source_url: string };
type DailyHistory = {
  positive_events: HistoryItem[];
  negative_events: HistoryItem[];
  births: HistoryItem[];
};
type DailyPost = { id: string; date_key: string; title: string; content: DailyHistory; source_urls: string[] };

const HistoryList = ({ items }: { items: HistoryItem[] }) => (
  <ol className="space-y-3">
    {items.map((item, index) => (
      <li key={`${item.title}-${index}`} className="text-sm">
        <p className="font-semibold text-foreground">{item.year ? `${item.year} — ` : ""}{item.title}</p>
        <p className="mt-0.5 text-muted-foreground leading-relaxed">{item.summary}</p>
        <a href={item.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1 text-xs text-primary hover:underline">
          Chanzo <ExternalLink className="w-3 h-3" />
        </a>
      </li>
    ))}
  </ol>
);

export const TigerDailyHistory = () => {
  const [post, setPost] = useState<DailyPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.from("tiger_ai_daily_posts").select("*").order("date_key", { ascending: false }).limit(1).maybeSingle();
      if (!active) return;
      if (data) setPost(data as unknown as DailyPost);
      setLoading(false);
    };
    void load();
    const channel = supabase.channel("tiger-ai-daily-history-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tiger_ai_daily_posts" }, () => void load())
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  if (loading || !post) return null;
  const dateLabel = new Date(`${post.date_key}T12:00:00`).toLocaleDateString("sw-TZ", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <article className="mx-3 my-3 overflow-hidden rounded-2xl border border-primary/25 bg-card shadow-sm">
      <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-accent/15 px-4 py-4">
        <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-4 h-4" /> Tiger AI • Historia ya leo
        </div>
        <h2 className="mt-1 text-lg font-extrabold text-foreground">{post.title}</h2>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="w-3.5 h-3.5" /> {dateLabel}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">Matukio ya kihistoria yaliyotokea tarehe hii, duniani kote.</p>
      </div>

      <div className="space-y-5 p-4">
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-emerald-600">
            <Trophy className="w-4 h-4" /> Mambo 5 mazuri yaliyotokea
          </h3>
          <HistoryList items={post.content.positive_events || []} />
        </section>
        <div className="border-t border-border/60" />
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-destructive">
            <AlertTriangle className="w-4 h-4" /> Mambo 5 mabaya yaliyotokea
          </h3>
          <HistoryList items={post.content.negative_events || []} />
        </section>
        <div className="border-t border-border/60" />
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-primary">
            <Cake className="w-4 h-4" /> Watu maarufu waliozaliwa leo
          </h3>
          <HistoryList items={post.content.births || []} />
        </section>
      </div>
      <p className="border-t border-border/60 px-4 py-2.5 text-[10px] text-muted-foreground">
        Taarifa zimekusanywa kutoka Wikipedia On This Day. Fungua “Chanzo” kuthibitisha kila kipengele.
      </p>
    </article>
  );
};
