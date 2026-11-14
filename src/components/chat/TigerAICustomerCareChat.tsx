import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import tigerLogo from "@/assets/tiger-reaction.png";

type ChatMessage = { role: "user" | "assistant"; content: string };

const TIGER_AI_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tiger-ai`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface Props { onBack: () => void }

export const TigerAICustomerCareChat = ({ onBack }: Props) => {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: "assistant",
    content: "Habari! Mimi ni **Tiger AI Customer Care** 🐯. Naweza kukusaidia kuhusu akaunti, ujumbe, voice/video calls, usalama na matumizi ya TigerChat. Una tatizo gani leo?"
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const response = await fetch(TIGER_AI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}` },
        body: JSON.stringify({
          messages: next,
          app_context: { current_path: "/chats", entry_point: "customer_care" }
        })
      });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || (response.status === 429 ? "Tiger AI ina maombi mengi. Jaribu tena." : "Tiger AI haipatikani kwa sasa. Jaribu tena baadaye."));
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      let assistantAdded = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta) {
              answer += delta;
              setMessages(current => assistantAdded
                ? current.map((item, index) => index === current.length - 1 ? { ...item, content: answer } : item)
                : [...current, { role: "assistant", content: answer }]);
              assistantAdded = true;
            }
          } catch { /* Ignore incomplete/non-JSON SSE lines. */ }
        }
      }
      if (!assistantAdded) throw new Error("Tiger AI haikutoa jibu. Tafadhali jaribu tena.");
    } catch (error) {
      setMessages(current => [...current, {
        role: "assistant",
        content: error instanceof Error ? error.message : "Kumetokea hitilafu. Jaribu tena."
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col bg-background">
      <header className="tiger-page-header glass">
        <button type="button" onClick={onBack} className="tiger-header-action md:hidden" aria-label="Back to chats"><ArrowLeft className="h-5 w-5" /></button>
        <img src={tigerLogo} alt="" className="h-10 w-10 rounded-full" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-foreground">Tiger AI Customer Care</h2>
          <p className="text-[11px] text-emerald-500">Msaidizi wa TigerChat · AI</p>
        </div>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            {message.role === "assistant" && <img src={tigerLogo} alt="" className="mr-2 h-7 w-7 self-end rounded-full" />}
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${message.role === "user" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border border-border/50 bg-card text-foreground"}`}>
              <div className="prose prose-sm dark:prose-invert max-w-none break-words"><ReactMarkdown>{message.content}</ReactMarkdown></div>
            </div>
          </div>
        ))}
        {loading && <div className="flex items-center gap-2 pl-9 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Tiger AI anajibu…</div>}
        <div ref={endRef} />
      </div>
      <div className="border-t border-border/50 p-3">
        <div className="flex items-center gap-2">
          <input ref={inputRef} value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Andika ujumbe kwa Tiger AI…" disabled={loading} className="min-w-0 flex-1 rounded-full bg-surface px-4 py-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/50" />
          <button type="button" onClick={() => void send()} disabled={loading || !input.trim()} aria-label="Send message" className="rounded-full bg-primary p-3 text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" /></button>
        </div>
        <p className="px-2 pt-1.5 text-[10px] text-muted-foreground">Usitume password, PIN au taarifa za siri.</p>
      </div>
    </section>
  );
};
