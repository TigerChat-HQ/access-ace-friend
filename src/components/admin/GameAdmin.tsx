import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Plus, Save, Trash2, Eye, EyeOff, Trophy as TrophyIcon } from "lucide-react";

type Question = {
  id: string;
  category: string;
  difficulty: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  is_active: boolean;
};

type Trophy = {
  id: string;
  tier: string;
  name: string;
  min_score: number;
  icon: string;
  color: string;
};

const blankQuestion = (): Question => ({
  id: "",
  category: "general",
  difficulty: "easy",
  question: "",
  options: ["", "", "", ""],
  correct_index: 0,
  explanation: "",
  is_active: false,
});

export const GameAdmin = () => {
  const { toast } = useToast();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [trophies, setTrophies] = useState<Trophy[]>([]);
  const [draft, setDraft] = useState<Question>(blankQuestion());
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: q }, { data: t }] = await Promise.all([
      supabase.from("game_questions").select("*").order("created_at", { ascending: false }),
      supabase.from("trophies").select("*").order("min_score"),
    ]);
    setQuestions(
      ((q as any[]) || []).map((row) => ({
        ...row,
        options: Array.isArray(row.options) ? row.options : JSON.parse(row.options || "[]"),
      })),
    );
    setTrophies((t as Trophy[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const saveDraft = async () => {
    if (!draft.question.trim() || draft.options.some((o) => !o.trim())) {
      toast({ title: "Fill all fields", variant: "destructive" });
      return;
    }
    const payload = {
      category: draft.category,
      difficulty: draft.difficulty,
      question: draft.question,
      options: draft.options as any,
      correct_index: draft.correct_index,
      explanation: draft.explanation || null,
      is_active: draft.is_active,
    };
    const { error } = await supabase.from("game_questions").insert(payload);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: draft.is_active ? "Question published" : "Saved as draft" });
    setDraft(blankQuestion());
    load();
  };

  const updateQuestion = async (id: string, patch: Partial<Question>) => {
    const { error } = await supabase
      .from("game_questions")
      .update({
        ...patch,
        options: patch.options ? (patch.options as any) : undefined,
      })
      .eq("id", id);
    if (error) return toast({ title: "Update failed", description: error.message, variant: "destructive" });
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    const { error } = await supabase.from("game_questions").delete().eq("id", id);
    if (error) return toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    setQuestions((qs) => qs.filter((q) => q.id !== id));
  };

  const updateTrophy = async (id: string, min_score: number) => {
    const { error } = await supabase.from("trophies").update({ min_score }).eq("id", id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setTrophies((ts) => ts.map((t) => (t.id === id ? { ...t, min_score } : t)));
    toast({ title: "Threshold saved" });
  };

  return (
    <section className="space-y-5">
      <h2 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-2">
        <TrophyIcon className="w-3.5 h-3.5 text-primary" /> Tanzanian Draft Game — Manage
      </h2>

      <div className="bg-card border border-border/50 rounded-xl p-3 space-y-2">
        <h3 className="text-xs font-semibold text-foreground">Trophy thresholds (% accuracy required)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {trophies.map((t) => (
            <div key={t.id} className="flex items-center gap-2 bg-surface rounded-lg px-2 py-1.5">
              <span className="text-xl">{t.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm capitalize text-foreground">{t.name}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{t.tier}</p>
              </div>
              <input
                type="number"
                min={0}
                max={100}
                defaultValue={t.min_score}
                onBlur={(e) => {
                  const v = Math.max(0, Math.min(100, Number(e.target.value)));
                  if (v !== t.min_score) updateTrophy(t.id, v);
                }}
                className="w-16 bg-background border border-border/50 rounded px-2 py-1 text-sm text-foreground text-right"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-xl p-3 space-y-2">
        <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
          <Plus className="w-3.5 h-3.5 text-primary" /> New question
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            placeholder="category"
            className="bg-background border border-border/50 rounded px-2 py-1.5 text-sm text-foreground"
          />
          <select
            value={draft.difficulty}
            onChange={(e) => setDraft({ ...draft, difficulty: e.target.value })}
            className="bg-background border border-border/50 rounded px-2 py-1.5 text-sm text-foreground"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <textarea
          value={draft.question}
          onChange={(e) => setDraft({ ...draft, question: e.target.value })}
          placeholder="Question text..."
          rows={2}
          className="w-full bg-background border border-border/50 rounded px-2 py-1.5 text-sm text-foreground"
        />
        <div className="space-y-1.5">
          {draft.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                checked={draft.correct_index === i}
                onChange={() => setDraft({ ...draft, correct_index: i })}
                className="accent-primary"
              />
              <input
                value={opt}
                onChange={(e) => {
                  const next = [...draft.options];
                  next[i] = e.target.value;
                  setDraft({ ...draft, options: next });
                }}
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                className="flex-1 bg-background border border-border/50 rounded px-2 py-1.5 text-sm text-foreground"
              />
            </div>
          ))}
        </div>
        <textarea
          value={draft.explanation || ""}
          onChange={(e) => setDraft({ ...draft, explanation: e.target.value })}
          placeholder="Explanation (shown after answer)"
          rows={2}
          className="w-full bg-background border border-border/50 rounded px-2 py-1.5 text-sm text-foreground"
        />
        <div className="flex items-center justify-between pt-1">
          <label className="text-xs text-muted-foreground flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.is_active}
              onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
              className="accent-primary"
            />
            Publish immediately {!draft.is_active && <span className="text-primary">(saving as draft)</span>}
          </label>
          <Button size="sm" onClick={saveDraft}>
            <Save className="w-3.5 h-3.5 mr-1" /> Save
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-foreground">All questions ({questions.length})</h3>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : (
          questions.map((q) => (
            <details key={q.id} className="bg-card border border-border/50 rounded-lg group">
              <summary className="cursor-pointer list-none flex items-center gap-2 px-3 py-2.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${q.is_active ? "bg-primary shadow-[0_0_6px_hsl(var(--primary))]" : "bg-muted-foreground/40"}`}
                />
                <span className="text-sm flex-1 truncate text-foreground">{q.question}</span>
                <span className="text-[10px] text-muted-foreground capitalize">{q.difficulty}</span>
              </summary>
              <div className="px-3 pb-3 space-y-2 border-t border-border/40 pt-2">
                <textarea
                  value={q.question}
                  onChange={(e) => setQuestions((qs) => qs.map((x) => (x.id === q.id ? { ...x, question: e.target.value } : x)))}
                  rows={2}
                  className="w-full bg-background border border-border/50 rounded px-2 py-1 text-sm"
                />
                {q.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={q.correct_index === i}
                      onChange={() =>
                        setQuestions((qs) => qs.map((x) => (x.id === q.id ? { ...x, correct_index: i } : x)))
                      }
                      className="accent-primary"
                    />
                    <input
                      value={opt}
                      onChange={(e) => {
                        const next = [...q.options];
                        next[i] = e.target.value;
                        setQuestions((qs) => qs.map((x) => (x.id === q.id ? { ...x, options: next } : x)));
                      }}
                      className="flex-1 bg-background border border-border/50 rounded px-2 py-1 text-sm"
                    />
                  </div>
                ))}
                <textarea
                  value={q.explanation || ""}
                  onChange={(e) =>
                    setQuestions((qs) => qs.map((x) => (x.id === q.id ? { ...x, explanation: e.target.value } : x)))
                  }
                  placeholder="Explanation"
                  rows={2}
                  className="w-full bg-background border border-border/50 rounded px-2 py-1 text-sm"
                />
                <div className="flex items-center justify-between pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateQuestion(q.id, { is_active: !q.is_active })}
                  >
                    {q.is_active ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                    {q.is_active ? "Unpublish (draft)" : "Publish"}
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        updateQuestion(q.id, {
                          question: q.question,
                          options: q.options,
                          correct_index: q.correct_index,
                          explanation: q.explanation,
                        })
                      }
                    >
                      <Save className="w-3.5 h-3.5 mr-1" /> Save
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteQuestion(q.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </details>
          ))
        )}
      </div>
    </section>
  );
};
