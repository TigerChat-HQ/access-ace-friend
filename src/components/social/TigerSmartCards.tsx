import { useCallback, useEffect, useState } from "react";
import { BookOpen, CheckCircle2, ExternalLink, GraduationCap, Scale, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type SmartCard = {
  id: string;
  placement: "post" | "status";
  category: string;
  title: string;
  hook: string;
  body: string;
  source_title: string;
  source_reference: string | null;
  source_url: string;
  jurisdiction: string | null;
  read_more_url: string;
  verified: boolean;
  publish_date: string;
};

const categoryLabel: Record<string, string> = {
  sheria: "Sheria",
  elimu: "Elimu",
  historia: "Historia",
  afya: "Afya",
  maarifa: "Maarifa",
};

const categoryIcon = (category: string) => category === "sheria"
  ? <Scale className="h-4 w-4" />
  : category === "elimu"
    ? <GraduationCap className="h-4 w-4" />
    : <Sparkles className="h-4 w-4" />;

const ReadMore = ({ card, children }: { card: SmartCard; children: React.ReactNode }) => (
  card.read_more_url.startsWith("/")
    ? <Link to={card.read_more_url} className="inline-flex items-center gap-1 text-xs font-bold text-primary">{children}<ExternalLink className="h-3 w-3" /></Link>
    : <a href={card.read_more_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-primary">{children}<ExternalLink className="h-3 w-3" /></a>
);

export const TigerSmartCards = () => {
  const [cards, setCards] = useState<SmartCard[]>([]);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("tiger_ai_smart_cards" as any)
      .select("id,placement,category,title,hook,body,source_title,source_reference,source_url,jurisdiction,read_more_url,verified,publish_date")
      .eq("is_active", true)
      .gte("publish_date", since)
      .order("publish_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(16);
    if (error) {
      console.warn("Tiger AI Smart Cards are not available yet:", error.message);
      return;
    }
    setCards((data || []) as unknown as SmartCard[]);
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("tiger-ai-smart-cards-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "tiger_ai_smart_cards" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const statuses = cards.filter((card) => card.placement === "status").slice(0, 6);
  const posts = cards.filter((card) => card.placement === "post").slice(0, 2);
  if (!statuses.length && !posts.length) return null;

  return (
    <section aria-label="Tiger AI Smart Cards" className="space-y-3 px-3 py-3">
      {(statuses.length > 0) && (
        <div>
          <div className="mb-2 flex items-center gap-2 px-1">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-extrabold">JE, WAJUA? · Maarifa mafupi</h2>
            <span className="ml-auto text-[10px] text-muted-foreground">Tiger AI</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {statuses.map((card) => (
              <div key={card.id} className="w-[148px] shrink-0 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-3 shadow-sm">
                <div className="flex items-center gap-1.5 text-primary">{categoryIcon(card.category)}<span className="text-[9px] font-extrabold uppercase tracking-wider">{categoryLabel[card.category] || "Maarifa"}</span></div>
                <p className="mt-2 line-clamp-3 text-xs font-bold leading-5 text-foreground">{card.hook}</p>
                <ReadMore card={card}>Soma zaidi</ReadMore>
              </div>
            ))}
          </div>
        </div>
      )}

      {posts.map((card) => (
        <article key={card.id} className="overflow-hidden rounded-2xl border border-primary/25 bg-card shadow-sm">
          <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-accent/15 px-4 py-3">
            <div className="flex items-center gap-2 text-primary">
              {categoryIcon(card.category)}
              <span className="text-[10px] font-extrabold uppercase tracking-[.16em]">{categoryLabel[card.category] || "Maarifa"}</span>
              <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold"><Sparkles className="h-3 w-3" />Tiger AI</span>
            </div>
            <h3 className="mt-2 text-base font-black leading-snug">{card.title}</h3>
            <p className="mt-1 text-sm font-bold text-primary">{card.hook}</p>
          </div>
          <div className="space-y-3 p-4">
            <p className="text-sm leading-6 text-foreground">{card.body}</p>
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
              {card.verified && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 font-bold text-emerald-600"><CheckCircle2 className="h-3 w-3" />Chanzo kimethibitishwa</span>}
              {card.jurisdiction && <span className="rounded-full bg-muted px-2 py-1">{card.jurisdiction}</span>}
            </div>
            {card.source_reference && <p className="text-[10px] leading-4 text-muted-foreground">{card.source_reference}</p>}
            <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
              <a href={card.source_url} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground hover:text-primary"><BookOpen className="h-3 w-3 shrink-0" /><span className="truncate">Chanzo: {card.source_title}</span><ExternalLink className="h-3 w-3 shrink-0" /></a>
              <ReadMore card={card}>Soma zaidi</ReadMore>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
};
