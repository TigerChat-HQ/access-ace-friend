import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Send, Loader2, Megaphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import tigerLogo from "@/assets/tiger-reaction.png";
import TigerFeedbackDialog from "@/components/TigerFeedbackDialog";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const TIGER_AI_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tiger-ai`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const SUGGESTED = [
  "How do I post a story?",
  "How do voice & video calls work?",
  "Make my account private",
  "How do I report someone?",
];

const TigerAI = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hey there! I'm **Tiger AI** — your built-in helper for everything TIGERCHATS. Ask me anything: how to post stories, manage privacy, start calls, file a report. 🐯",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackPrefill, setFeedbackPrefill] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const resp = await fetch(TIGER_AI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ANON}`,
        },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });

      if (resp.status === 429) {
        toast({ title: "Slow down", description: "Tiger AI is taking a breath, try again in a moment." });
        setLoading(false);
        return;
      }
      if (resp.status === 402) {
        toast({ title: "Out of credits", description: "Add credits in Workspace settings.", variant: "destructive" });
        setLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error("Stream failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let so_far = "";
      let pushed = false;

      const flush = (chunk: string) => {
        so_far += chunk;
        setMessages((prev) => {
          if (!pushed) {
            pushed = true;
            return [...prev, { role: "assistant", content: so_far }];
          }
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: so_far } : m
          );
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) flush(c);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      toast({ title: "Tiger AI hiccup", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card/80 backdrop-blur-md sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-1 hover:bg-surface-hover rounded-full">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <img src={tigerLogo} alt="" className="w-9 h-9" />
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground leading-tight">Tiger AI</h1>
          <p className="text-[10px] text-primary">Online · always here</p>
        </div>
        <button
          onClick={() => { setFeedbackPrefill(input); setFeedbackOpen(true); }}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-full bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors"
        >
          <Megaphone className="w-3.5 h-3.5" /> Send to admin
        </button>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.role === "assistant" && (
              <img src={tigerLogo} alt="" className="w-7 h-7 mr-2 self-end" />
            )}
            <div
              className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-card border border-border/50 text-foreground rounded-bl-sm"
              }`}
            >
              <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_strong]:text-primary">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pl-9">
            <Loader2 className="w-3 h-3 animate-spin" /> Tiger AI is thinking…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {messages.length <= 1 && (
        <div className="px-3 pb-2 flex flex-wrap gap-2">
          {SUGGESTED.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-[11px] px-3 py-1.5 rounded-full bg-card border border-border/50 text-foreground hover:bg-surface-hover transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="p-3 border-t border-border/50 glass">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Ask Tiger AI…"
            disabled={loading}
            className="flex-1 bg-surface rounded-full px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50"
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="p-2.5 rounded-full bg-primary text-primary-foreground disabled:opacity-50 neon-glow"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TigerAI;
