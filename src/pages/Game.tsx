import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Clock, Sparkles, ArrowRight, RotateCcw, Crown, Flame } from "lucide-react";

type Question = {
  id: string;
  category: string;
  difficulty: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
};

type TrophyRow = { tier: string; name: string; min_score: number; icon: string; color: string };
type Leader = { user_id: string; score: number; trophy_tier: string | null; profile?: { display_name: string | null; avatar_url: string | null } };

const TIME_PER_Q = 15;
const POINTS_PER_Q = 10;

const Game = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [phase, setPhase] = useState<"intro" | "playing" | "result">("intro");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [trophies, setTrophies] = useState<TrophyRow[]>([]);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_Q);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [earnedTrophy, setEarnedTrophy] = useState<TrophyRow | null>(null);
  const [confetti, setConfetti] = useState(false);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [myTrophies, setMyTrophies] = useState<string[]>([]);

  // Load trophies + leaderboard once
  useEffect(() => {
    (async () => {
      const [{ data: tro }, { data: lb }] = await Promise.all([
        supabase.from("trophies").select("*").order("min_score"),
        supabase.from("game_attempts").select("user_id,score,trophy_tier").order("score", { ascending: false }).limit(10),
      ]);
      setTrophies((tro || []) as TrophyRow[]);
      if (lb && lb.length) {
        const ids = Array.from(new Set(lb.map((l: any) => l.user_id)));
        const { data: profs } = await supabase.from("profiles").select("user_id,display_name,avatar_url").in("user_id", ids);
        const byId = new Map((profs || []).map((p: any) => [p.user_id, p]));
        setLeaders(lb.map((l: any) => ({ ...l, profile: byId.get(l.user_id) })));
      }
      if (user) {
        const { data: mine } = await supabase.from("user_trophies").select("trophy_tier").eq("user_id", user.id);
        setMyTrophies((mine || []).map((m: any) => m.trophy_tier));
      }
    })();
  }, [user]);

  // Countdown
  useEffect(() => {
    if (phase !== "playing" || revealed) return;
    if (timeLeft <= 0) {
      setRevealed(true);
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, revealed, phase]);

  const current = questions[idx];
  const progressPct = questions.length ? Math.round(((idx + (revealed ? 1 : 0)) / questions.length) * 100) : 0;

  const startGame = async () => {
    const { data, error } = await supabase
      .from("game_questions")
      .select("*")
      .eq("is_active", true)
      .limit(50);
    if (error || !data || data.length === 0) {
      toast({ title: "No questions available", description: error?.message, variant: "destructive" });
      return;
    }
    const shuffled = (data as any[])
      .map((q) => ({ ...q, options: Array.isArray(q.options) ? q.options : JSON.parse(q.options) }))
      .sort(() => Math.random() - 0.5)
      .slice(0, 10) as Question[];
    setQuestions(shuffled);
    setIdx(0);
    setScore(0);
    setCorrect(0);
    setSelected(null);
    setRevealed(false);
    setTimeLeft(TIME_PER_Q);
    setStartedAt(Date.now());
    setEarnedTrophy(null);
    setPhase("playing");
  };

  const choose = (i: number) => {
    if (revealed) return;
    setSelected(i);
    setRevealed(true);
    if (i === current.correct_index) {
      const bonus = Math.round((timeLeft / TIME_PER_Q) * 5);
      setScore((s) => s + POINTS_PER_Q + bonus);
      setCorrect((c) => c + 1);
    }
  };

  const next = async () => {
    if (idx + 1 < questions.length) {
      setIdx((i) => i + 1);
      setSelected(null);
      setRevealed(false);
      setTimeLeft(TIME_PER_Q);
      return;
    }
    // Finish
    const finalScore = score;
    const finalCorrect = correct;
    const pct = Math.round((finalCorrect / questions.length) * 100);
    const earned = [...trophies].reverse().find((t) => pct >= t.min_score) || null;
    const duration = Math.round((Date.now() - startedAt) / 1000);

    if (user) {
      const { data: attempt } = await supabase
        .from("game_attempts")
        .insert({
          user_id: user.id,
          score: finalScore,
          correct_count: finalCorrect,
          total_questions: questions.length,
          duration_seconds: duration,
          trophy_tier: earned?.tier ?? null,
        })
        .select("id")
        .single();
      if (earned && !myTrophies.includes(earned.tier)) {
        await supabase.from("user_trophies").insert({
          user_id: user.id,
          trophy_tier: earned.tier,
          attempt_id: attempt?.id,
        });
        setMyTrophies((m) => [...m, earned.tier]);
      }
    }
    setEarnedTrophy(earned);
    setPhase("result");
    if (earned) {
      setConfetti(true);
      setTimeout(() => setConfetti(false), 3500);
    }
  };

  const reset = () => {
    setPhase("intro");
    setQuestions([]);
  };

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-background via-background to-primary/5">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Tanzanian <span className="text-primary">Draft Game</span>
            </h1>
            <p className="text-xs text-muted-foreground">Answer fast. Earn trophies. Climb the ranks.</p>
          </div>
          <Trophy className="w-7 h-7 text-primary drop-shadow-[0_0_12px_hsl(var(--primary)/0.6)]" />
        </header>

        {phase === "intro" && (
          <IntroPanel
            trophies={trophies}
            myTrophies={myTrophies}
            leaders={leaders}
            onStart={startGame}
          />
        )}

        {phase === "playing" && current && (
          <PlayPanel
            current={current}
            idx={idx}
            total={questions.length}
            selected={selected}
            revealed={revealed}
            timeLeft={timeLeft}
            score={score}
            progressPct={progressPct}
            onChoose={choose}
            onNext={next}
          />
        )}

        {phase === "result" && (
          <ResultPanel
            score={score}
            correct={correct}
            total={questions.length}
            trophy={earnedTrophy}
            confetti={confetti}
            onPlayAgain={startGame}
            onHome={reset}
          />
        )}
      </div>
    </div>
  );
};

// ---------- Sub components ----------

const IntroPanel = ({
  trophies,
  myTrophies,
  leaders,
  onStart,
}: {
  trophies: TrophyRow[];
  myTrophies: string[];
  leaders: Leader[];
  onStart: () => void;
}) => (
  <div className="space-y-5">
    <div className="rounded-2xl p-5 bg-gradient-to-br from-primary/15 via-card to-card border border-primary/20 shadow-[0_8px_40px_hsl(var(--primary)/0.15)]">
      <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wider">
        <Sparkles className="w-3.5 h-3.5" /> How to play
      </div>
      <ul className="mt-3 text-sm text-muted-foreground space-y-1.5">
        <li>• 10 questions about Tanzania — culture, history, geography, sports.</li>
        <li>• {TIME_PER_Q}s per question. Faster answers earn time bonus.</li>
        <li>• Score 40%+ to unlock your first trophy. 100% earns Diamond Tiger.</li>
      </ul>
      <button
        onClick={onStart}
        className="mt-5 w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-[0_0_24px_hsl(var(--primary)/0.4)] hover:opacity-90 active:scale-[0.98] transition flex items-center justify-center gap-2"
      >
        <Flame className="w-4 h-4" /> Start Game
      </button>
    </div>

    <section>
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Crown className="w-4 h-4 text-primary" /> Trophy Tiers
      </h2>
      <div className="grid grid-cols-5 gap-2">
        {trophies.map((t) => {
          const owned = myTrophies.includes(t.tier);
          return (
            <div
              key={t.tier}
              className={`rounded-xl p-2.5 text-center border transition ${
                owned ? "border-primary/50 bg-primary/10" : "border-border/50 bg-card/50 opacity-60"
              }`}
            >
              <div className="text-2xl">{t.icon}</div>
              <div className="text-[10px] font-semibold mt-1 capitalize">{t.tier}</div>
              <div className="text-[9px] text-muted-foreground">{t.min_score}%+</div>
            </div>
          );
        })}
      </div>
    </section>

    <section>
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Trophy className="w-4 h-4 text-primary" /> Top 10 Leaderboard
      </h2>
      <div className="rounded-xl border border-border/50 bg-card/50 divide-y divide-border/40">
        {leaders.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground text-center">No scores yet — be the first!</div>
        ) : (
          leaders.map((l, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5">
              <span className={`text-xs font-bold w-5 ${i < 3 ? "text-primary" : "text-muted-foreground"}`}>
                #{i + 1}
              </span>
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-[11px] font-semibold">
                {(l.profile?.display_name || "U").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{l.profile?.display_name || "Player"}</div>
              </div>
              {l.trophy_tier && <span className="text-base">{trophies.find((t) => t.tier === l.trophy_tier)?.icon}</span>}
              <span className="text-sm font-bold text-primary tabular-nums">{l.score}</span>
            </div>
          ))
        )}
      </div>
    </section>
  </div>
);

const PlayPanel = ({
  current,
  idx,
  total,
  selected,
  revealed,
  timeLeft,
  score,
  progressPct,
  onChoose,
  onNext,
}: {
  current: Question;
  idx: number;
  total: number;
  selected: number | null;
  revealed: boolean;
  timeLeft: number;
  score: number;
  progressPct: number;
  onChoose: (i: number) => void;
  onNext: () => void;
}) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">
        Question <span className="text-foreground font-semibold">{idx + 1}</span> / {total}
      </span>
      <span className="text-primary font-bold tabular-nums">Score: {score}</span>
    </div>
    <div className="h-1.5 bg-surface rounded-full overflow-hidden">
      <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progressPct}%` }} />
    </div>

    <div className={`flex items-center gap-2 text-xs font-semibold ${timeLeft <= 5 ? "text-destructive animate-pulse" : "text-primary"}`}>
      <Clock className="w-3.5 h-3.5" /> {timeLeft}s
    </div>

    <div className="rounded-2xl p-5 bg-card border border-border/60">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
        {current.category} · {current.difficulty}
      </div>
      <h3 className="text-base font-semibold leading-snug">{current.question}</h3>
    </div>

    <div className="space-y-2">
      {current.options.map((opt, i) => {
        const isCorrect = i === current.correct_index;
        const isPicked = i === selected;
        let cls = "border-border/50 bg-card hover:bg-surface-hover";
        if (revealed) {
          if (isCorrect) cls = "border-primary bg-primary/15 text-primary";
          else if (isPicked) cls = "border-destructive bg-destructive/10 text-destructive";
          else cls = "border-border/30 bg-card opacity-50";
        }
        return (
          <button
            key={i}
            onClick={() => onChoose(i)}
            disabled={revealed}
            className={`w-full text-left px-4 py-3.5 rounded-xl border text-sm font-medium transition ${cls}`}
          >
            <span className="inline-block w-5 mr-2 text-muted-foreground">{String.fromCharCode(65 + i)}.</span>
            {opt}
          </button>
        );
      })}
    </div>

    {revealed && (
      <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
        {current.explanation && (
          <div className="text-xs text-muted-foreground bg-surface/60 rounded-lg px-3 py-2 border border-border/40">
            💡 {current.explanation}
          </div>
        )}
        <button
          onClick={onNext}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2"
        >
          {idx + 1 < total ? "Next Question" : "Finish"} <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    )}
  </div>
);

const ResultPanel = ({
  score,
  correct,
  total,
  trophy,
  confetti,
  onPlayAgain,
  onHome,
}: {
  score: number;
  correct: number;
  total: number;
  trophy: TrophyRow | null;
  confetti: boolean;
  onPlayAgain: () => void;
  onHome: () => void;
}) => {
  const pct = Math.round((correct / total) * 100);
  return (
    <div className="relative space-y-5 text-center py-6">
      {confetti && <ConfettiBurst />}
      <div className="text-6xl animate-in zoom-in duration-500">{trophy?.icon || "🎯"}</div>
      <div>
        <h2 className="text-2xl font-bold">{trophy ? trophy.name : "Good try!"}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {trophy ? "Trophy awarded to your profile." : "Score 40%+ next time to earn a trophy."}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
        <Stat label="Score" value={score.toString()} />
        <Stat label="Correct" value={`${correct}/${total}`} />
        <Stat label="Accuracy" value={`${pct}%`} />
      </div>

      <div className="flex gap-2 max-w-sm mx-auto">
        <button
          onClick={onPlayAgain}
          className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" /> Play Again
        </button>
        <button
          onClick={onHome}
          className="flex-1 py-3 rounded-xl bg-card border border-border text-foreground font-semibold text-sm"
        >
          Back
        </button>
      </div>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl p-3 bg-card border border-border/50">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="text-lg font-bold text-primary mt-1">{value}</div>
  </div>
);

const ConfettiBurst = () => {
  const pieces = useMemo(
    () =>
      Array.from({ length: 60 }).map((_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 2 + Math.random() * 1.5,
        color: ["hsl(var(--primary))", "#ffd700", "#a78bfa", "#60a5fa", "#f472b6"][i % 5],
        rotate: Math.random() * 360,
      })),
    [],
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute -top-4 w-2 h-3 rounded-sm"
          style={{
            left: `${p.left}%`,
            background: p.color,
            transform: `rotate(${p.rotate}deg)`,
            animation: `confetti-fall ${p.duration}s linear ${p.delay}s forwards`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.2; }
        }
      `}</style>
    </div>
  );
};

export default Game;
