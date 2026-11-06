import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Send, Loader2, Megaphone, Image as ImageIcon, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import tigerLogo from "@/assets/tiger-reaction.png";
import TigerFeedbackDialog from "@/components/TigerFeedbackDialog";

interface Msg {
  role: "user" | "assistant";
  content: string;
  image_url?: string;
  video_url?: string;
}

const TIGER_AI_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tiger-ai`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const SUGGESTED = [
  "Translate 'good morning' to Swahili",
  "Generate an image of a neon tiger in Dar es Salaam",
  "Generate HQ image of a Maasai warrior at sunset",
  "Make a video of a tiger running (preview)",
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

  const detectImageRequest = (t: string) =>
    /^(generate|create|draw|make|design)\s+(an?|the|hq\s+)?\s*(image|picture|pic|art|illustration|wallpaper|photo)/i.test(t.trim());
  const detectVideoRequest = (t: string) =>
    /^(generate|create|make|produce)\s+(an?|the|short\s+)?\s*(video|clip|reel|motion)/i.test(t.trim()) ||
    /\bvideo of\b/i.test(t);
  const detectHQ = (t: string) => /\b(hq|high\s*quality|4k|cinematic|pro)\b/i.test(t);

  const sendVideo = async (prompt: string) => {
    setMessages((m) => [...m, { role: "user", content: prompt }]);
    setInput("");
    setLoading(true);
    setMessages((m) => [
      ...m,
      { role: "assistant", content: "🎬 Rendering your clip — this can take 30-90 seconds…" },
    ]);
    const setLast = (msg: Msg) =>
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = msg;
        return copy;
      });
    const call = async (body: object) => {
      const resp = await fetch(TIGER_AI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}` },
        body: JSON.stringify(body),
      });
      return { ok: resp.ok, data: await resp.json().catch(() => ({})) };
    };
    try {
      const created = await call({ video_prompt: prompt });
      if (!created.ok || !created.data.video_id) {
        setLast({ role: "assistant", content: created.data?.error || "Video generation failed. Try again shortly." });
        return;
      }
      const started = Date.now();
      while (Date.now() - started < 6 * 60 * 1000) {
        await new Promise((r) => setTimeout(r, 7000));
        const { ok, data } = await call({ video_id: created.data.video_id });
        if (!ok || data.status === "failed") {
          setLast({ role: "assistant", content: data?.error || "Video generation failed." });
          return;
        }
        if (data.status === "completed" && data.video_url) {
          setLast({ role: "assistant", content: data.text || "Here's your clip 🐯🎬", video_url: data.video_url });
          return;
        }
        setLast({
          role: "assistant",
          content: `🎬 Rendering your clip${data.progress ? ` — ${data.progress}%` : ""}… (1-3 min)`,
        });
      }
      setLast({ role: "assistant", content: "Video is taking longer than expected. Please try again later." });
    } catch (error: unknown) {
      toast({ title: "Video gen failed", description: error instanceof Error ? error.message : "An unexpected generation error occurred", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const sendImage = async (prompt: string) => {
    setLoading(true);
    setMessages((m) => [...m, { role: "user", content: prompt }]);
    setInput("");
    try {
      const resp = await fetch(TIGER_AI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}` },
        body: JSON.stringify({ image_prompt: prompt, hq: detectHQ(prompt) }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Image gen failed");
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.text || "Here you go 🐯", image_url: data.image_url },
      ]);
    } catch (e: any) {
      toast({ title: "Image gen failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    if (detectVideoRequest(text)) return sendVideo(text);
    if (detectImageRequest(text)) return sendImage(text);
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
                {m.image_url && (
                  <img src={m.image_url} alt="Tiger AI generated" className="mt-2 rounded-lg max-w-full" />
                )}
                {m.video_url && (
                  <video
                    src={m.video_url}
                    controls
                    playsInline
                    className="mt-2 rounded-lg max-w-full bg-black"
                  />
                )}
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
          <button
            onClick={() => { setFeedbackPrefill(""); setFeedbackOpen(true); }}
            className="text-[11px] px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition-colors flex items-center gap-1"
          >
            <Megaphone className="w-3 h-3" /> Send feedback to admin
          </button>
        </div>
      )}

      <TigerFeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} initialText={feedbackPrefill} />


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
