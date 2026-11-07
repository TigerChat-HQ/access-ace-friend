import { useEffect, useMemo, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Message } from "@/types/chat";
import { canTranslate, translationLanguage } from "@/lib/chat-translation";

export function useChatTranslation(userId: string | undefined, conversationId: string | null, messages: Message[]) {
  const key = `tiger:translation:${userId || "guest"}:${conversationId || "none"}`;
  const [selection, setSelection] = useState<{ key: string; language: string }>({ key: "", language: "off" });
  const [results, setResults] = useState<{ key: string; values: Record<string, string> }>({ key: "", values: {} });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let language = "off";
    try { language = translationLanguage(localStorage.getItem(key)); } catch { /* Device storage unavailable. */ }
    setSelection({ key, language });
  }, [key]);
  const language = selection.key === key ? selection.language : "off";
  const resultKey = `${key}:${language}`;
  const translations = results.key === resultKey ? results.values : {};
  const ids = useMemo(() => messages.filter(canTranslate).map(message => message.id).join(","), [messages]);

  useEffect(() => {
    if (!userId || !conversationId || language === "off") { setLoading(false); setError(""); return; }
    let cancelled = false;
    // Local to this request: changing rooms/languages cannot expose another chat's results.
    const existing = results.key === resultKey ? results.values : {};
    const missing = ids.split(",").filter(id => id && !existing[id]);
    if (!missing.length) return;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        for (let offset = 0; offset < missing.length; offset += 20) {
          if (cancelled) return;
          const { data, error: requestError } = await supabase.functions.invoke("translate-chat", { body: { conversationId, language, messageIds: missing.slice(offset, offset + 20) } });
          if (requestError) {
            const detail = requestError instanceof FunctionsHttpError ? await requestError.context.json().catch(() => null) : null;
            throw new Error(detail?.error || requestError.message);
          }
          if (cancelled) return;
          const values: Record<string, string> = {};
          for (const item of data.translations || []) if (typeof item.id === "string" && typeof item.text === "string") values[item.id] = item.text;
          setResults(previous => ({ key: resultKey, values: { ...(previous.key === resultKey ? previous.values : {}), ...values } }));
        }
      } catch (failure) { if (!cancelled) setError(failure instanceof Error ? failure.message : "Translation unavailable"); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
    // Only new messages, language selection or an explicit retry trigger requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, conversationId, language, ids, attempt, resultKey]);

  return { language, translations, loading, error, retry: () => setAttempt(value => value + 1), setLanguage: (next: string) => {
    const value = translationLanguage(next);
    try { localStorage.setItem(key, value); } catch { /* Works for this visit without persistence. */ }
    setSelection({ key, language: value });
  } };
}