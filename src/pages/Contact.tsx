import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Bell, Inbox, Loader2, Send, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { contactSchema } from "@/lib/contact";
import type { Tables } from "@/integrations/supabase/types";

export default function Contact() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [items, setItems] = useState<Tables<"reports">[]>([]);
  const [fetching, setFetching] = useState(false);
  const load = useCallback(async () => {
    if (!user) return;
    setFetching(true);
    const { data, error } = await supabase.from("reports").select("*").eq("reporter_id", user.id).order("created_at", { ascending: false }).limit(100);
    if (error) setError(error.message);
    else setItems(data || []);
    setFetching(false);
  }, [user]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`contact-${user.id}-${crypto.randomUUID()}`).on("postgres_changes", { event: "*", schema: "public", table: "reports", filter: `reporter_id=eq.${user.id}` }, () => { void load(); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user, load]);
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(""); setNotice("");
    const parsed = contactSchema.safeParse({ subject, message });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || "Check your message"); return; }
    if (!user || sending) return;
    setSending(true);
    try {
      const { error } = await supabase.rpc("send_contact_message", { _subject: parsed.data.subject, _message: parsed.data.message });
      if (error) throw error;
      setSubject(""); setMessage(""); setNotice("Message sent to admin"); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send your message. Try again."); }
    finally { setSending(false); }
  };
  return <div className="h-full overflow-y-auto bg-background text-foreground">
    <Helmet><title>Contact admin | TIGERCHATS</title><meta name="description" content="Contact the TIGERCHATS team about Tanzanian Draft Game, your account, or feedback." /><link rel="canonical" href="https://access-ace-friend.lovable.app/contact" /></Helmet>
    <header className="border-b border-border px-5 py-4 flex items-center justify-between gap-4">
      <Button asChild variant="ghost" size="icon"><Link to={user ? "/settings" : "/tanzanian-draft-game"} aria-label="Go back"><ArrowLeft className="w-5 h-5" /></Link></Button>
      <h1 className="font-semibold">Contact admin</h1>
      <Button asChild variant="ghost" size="icon"><Link to={user ? "/notifications" : "/auth"} aria-label="Notifications"><Bell className="w-5 h-5" /></Link></Button>
    </header>
    <div className="max-w-3xl mx-auto px-5 py-8 space-y-8">
      <div className="flex items-center gap-3"><ShieldCheck className="w-8 h-8 text-primary" /><h2 className="text-2xl font-bold">A message to the team</h2></div>
      {loading ? <Loader2 className="animate-spin" /> : user ? <form onSubmit={send} className="space-y-4">
        <div><label htmlFor="contact-subject" className="text-sm font-medium">Subject</label><Input id="contact-subject" value={subject} onChange={e => setSubject(e.target.value)} maxLength={100} required className="mt-2" /></div>
        <div><label htmlFor="contact-message" className="text-sm font-medium">Message</label><Textarea id="contact-message" value={message} onChange={e => setMessage(e.target.value)} maxLength={4000} required rows={6} className="mt-2 resize-y" /></div>
        <div className="flex justify-between items-center gap-3"><span className="text-xs text-muted-foreground">{message.length}/4000</span><Button type="submit" disabled={sending}>{sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}Send to admin</Button></div>
      </form> : <Button asChild><Link to="/auth">Sign in to send a message</Link></Button>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
      {user && <section className="border-t border-border pt-6 space-y-4"><h2 className="font-semibold flex gap-2 items-center"><Inbox className="w-5 h-5 text-primary" />Your messages & reports</h2>
        {fetching && <Loader2 className="w-4 h-4 animate-spin" />}
        {!fetching && !items.length && <p className="text-sm text-muted-foreground">No messages yet.</p>}
        {items.map(item => <article id={item.id} key={item.id} className={`border rounded-lg p-4 space-y-3 ${params.get("report") === item.id ? "border-primary" : "border-border"}`}>
          <div className="flex items-start justify-between gap-3"><h3 className="font-semibold break-words">{item.contact_subject || item.target_type}</h3><span className="text-xs text-muted-foreground capitalize shrink-0">{item.status}</span></div>
          <p className="text-sm whitespace-pre-wrap break-words">{item.reason}</p>
          <time className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</time>
          {item.admin_reply && <div className="border-l-2 border-primary pl-4 space-y-2"><p className="text-xs font-semibold text-primary">Admin reply</p><p className="text-sm whitespace-pre-wrap break-words">{item.admin_reply}</p>{item.admin_reply_media_url && <img src={item.admin_reply_media_url} alt="Media from admin" className="max-w-full max-h-80 rounded-lg" />}</div>}
        </article>)}
      </section>}
    </div>
  </div>;
}