import { useCallback, useEffect, useState, type FormEvent } from "react";
import { BarChart3, Plus, X, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

interface PollOption { id: string; option_text: string; position: number; }
interface PollVote { option_id: string; user_id: string; }
interface PollItem {
  id: string; question: string; allows_multiple: boolean; created_at: string;
  options: PollOption[]; votes: PollVote[];
}

interface ChatPollsProps { conversationId: string; userId: string; }

export const ChatPolls = ({ conversationId, userId }: ChatPollsProps) => {
  const [polls, setPolls] = useState<PollItem[]>([]);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [allowsMultiple, setAllowsMultiple] = useState(false);
  const [saving, setSaving] = useState(false);
  const [voting, setVoting] = useState<string | null>(null);

  const loadPolls = useCallback(async () => {
    const client = supabase as any;
    const { data: pollRows, error } = await client.from("chat_polls").select("id,question,allows_multiple,created_at")
      .eq("conversation_id", conversationId).order("created_at", { ascending: false });
    if (error) { toast.error("Could not load polls"); return; }
    const ids = (pollRows || []).map((poll: any) => poll.id);
    if (!ids.length) { setPolls([]); return; }
    const [{ data: optionRows, error: optionError }, { data: voteRows, error: voteError }] = await Promise.all([
      client.from("chat_poll_options").select("id,poll_id,option_text,position").in("poll_id", ids).order("position"),
      client.from("chat_poll_votes").select("poll_id,option_id,user_id").in("poll_id", ids),
    ]);
    if (optionError || voteError) { toast.error("Could not load poll results"); return; }
    setPolls((pollRows || []).map((poll: any) => ({
      ...poll,
      options: (optionRows || []).filter((option: any) => option.poll_id === poll.id),
      votes: (voteRows || []).filter((vote: any) => vote.poll_id === poll.id),
    })));
  }, [conversationId]);

  useEffect(() => { void loadPolls(); }, [loadPolls]);
  useEffect(() => {
    const channel = supabase.channel(`polls:${conversationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_polls", filter: `conversation_id=eq.${conversationId}` }, () => { void loadPolls(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_poll_options" }, () => { void loadPolls(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_poll_votes" }, () => { void loadPolls(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [conversationId, loadPolls]);

  const createPoll = async (event: FormEvent) => {
    event.preventDefault();
    const cleanOptions = options.map((option) => option.trim()).filter(Boolean);
    if (!question.trim() || cleanOptions.length < 2) { toast.error("Enter a question and at least two options"); return; }
    setSaving(true);
    const { error } = await (supabase as any).rpc("create_chat_poll", {
      _conversation_id: conversationId,
      _question: question.trim(),
      _options: cleanOptions,
      _allows_multiple: allowsMultiple,
      _expires_at: null,
    });
    setSaving(false);
    if (error) { toast.error(error.message || "Could not create poll"); return; }
    setQuestion(""); setOptions(["", ""]); setAllowsMultiple(false); setOpen(false);
    toast.success("Poll created");
    await loadPolls();
  };

  const castVote = async (pollId: string, optionId: string) => {
    setVoting(optionId);
    const { error } = await (supabase as any).rpc("cast_chat_poll_vote", { _poll_id: pollId, _option_id: optionId });
    setVoting(null);
    if (error) { toast.error(error.message || "Vote could not be saved"); return; }
    await loadPolls();
  };

  return (
    <section className="border-b border-border/50 bg-card/50 px-3 py-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><BarChart3 className="h-4 w-4" /> Polls <span className="rounded-full bg-surface px-1.5 py-0.5">{polls.length}</span></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 rounded-full"><Plus className="h-3.5 w-3.5" /> Create poll</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create a poll</DialogTitle></DialogHeader>
            <form onSubmit={createPoll} className="space-y-3">
              <Input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a question..." maxLength={500} required />
              {options.map((option, index) => <div key={index} className="flex items-center gap-2"><Input value={option} onChange={(event) => setOptions((current) => current.map((item, i) => i === index ? event.target.value : item))} placeholder={`Option ${index + 1}`} maxLength={200} /><Button type="button" variant="ghost" size="icon" disabled={options.length <= 2} onClick={() => setOptions((current) => current.filter((_, i) => i !== index))} aria-label="Remove option"><X className="h-4 w-4" /></Button></div>)}
              <Button type="button" variant="outline" size="sm" disabled={options.length >= 10} onClick={() => setOptions((current) => [...current, ""])}><Plus className="mr-1 h-3.5 w-3.5" /> Add option</Button>
              <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={allowsMultiple} onChange={(event) => setAllowsMultiple(event.target.checked)} /> Allow multiple answers</label>
              <Button type="submit" className="w-full" disabled={saving}>{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : "Publish poll"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {polls.length > 0 && <div className="flex gap-3 overflow-x-auto pb-1">
        {polls.map((poll) => {
          const total = poll.votes.length;
          const voterCount = new Set(poll.votes.map((vote) => vote.user_id)).size;
          return <div key={poll.id} className="min-w-[250px] max-w-[320px] flex-1 rounded-xl border border-border/60 bg-background/80 p-3">
            <p className="mb-2 text-sm font-semibold">{poll.question}</p>
            <p className="mb-2 text-[10px] text-muted-foreground">{voterCount} voter{voterCount === 1 ? "" : "s"} · {poll.allows_multiple ? "Multiple answers" : "Single answer"}</p>
            <div className="space-y-2">{poll.options.map((option) => {
              const count = poll.votes.filter((vote) => vote.option_id === option.id).length;
              const selected = poll.votes.some((vote) => vote.option_id === option.id && vote.user_id === userId);
              const percent = voterCount ? Math.round(count / voterCount * 100) : 0;
              return <button key={option.id} type="button" disabled={voting !== null} onClick={() => void castVote(poll.id, option.id)} className="w-full text-left disabled:opacity-60">
                <div className={`relative overflow-hidden rounded-lg border px-2.5 py-2 text-xs ${selected ? "border-primary/60 bg-primary/5" : "border-border/60 bg-surface/60"}`}>
                  <div className="absolute inset-y-0 left-0 bg-primary/10 transition-all" style={{ width: `${percent}%` }} />
                  <div className="relative flex items-center justify-between gap-2"><span className="flex items-center gap-1.5">{selected && <Check className="h-3 w-3 text-primary" />}{option.option_text}</span><span className="tabular-nums text-muted-foreground">{percent}% · {count}</span></div>
                </div>
              </button>;
            })}</div>
          </div>;
        })}
      </div>}
    </section>
  );
};
