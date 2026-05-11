import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Send, X, ImageIcon, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  report: any;
  onReplied: () => void;
}

export const ReportReplyDialog = ({ open, onClose, report, onReplied }: Props) => {
  const { toast } = useToast();
  const [reply, setReply] = useState(report?.admin_reply || "");
  const [mediaUrl, setMediaUrl] = useState<string | null>(report?.admin_reply_media_url || null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  const generateMedia = async () => {
    if (!aiPrompt.trim()) {
      toast({ title: "Describe the image first", variant: "destructive" });
      return;
    }
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke("admin-generate-media", {
      body: { prompt: aiPrompt },
    });
    setGenerating(false);
    if (error || !data?.url) {
      toast({
        title: "AI generation failed",
        description: error?.message || data?.error || "Try a different prompt",
        variant: "destructive",
      });
      return;
    }
    setMediaUrl(data.url);
    toast({ title: "Image generated" });
  };

  const send = async () => {
    if (!reply.trim()) {
      toast({ title: "Write a reply first", variant: "destructive" });
      return;
    }
    setSending(true);
    const { data: u } = await supabase.auth.getUser();
    const adminId = u?.user?.id;
    const { error } = await supabase
      .from("reports")
      .update({
        admin_reply: reply,
        admin_reply_media_url: mediaUrl,
        admin_reply_at: new Date().toISOString(),
        replied_by: adminId,
        status: "resolved",
      })
      .eq("id", report.id);
    setSending(false);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    // Notify the reporter that an admin replied
    if (adminId && report?.reporter_id && report.reporter_id !== adminId) {
      await supabase.from("notifications").insert({
        recipient_id: report.reporter_id,
        actor_id: adminId,
        type: "report_reply",
      });
    }
    toast({ title: "Reply sent & user notified" });
    onReplied();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            Reply to report
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary capitalize">
              {report?.target_type}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg bg-surface border border-border/50 p-3">
            <p className="text-xs text-muted-foreground mb-1">User wrote:</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{report?.reason}</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground">Your reply</label>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={4}
              placeholder="Thank you for your feedback..."
              className="mt-1 w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
            <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> AI media generator
            </p>
            <div className="flex gap-2">
              <input
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Describe an image to attach..."
                className="flex-1 bg-background border border-border/50 rounded px-2 py-1.5 text-sm"
              />
              <Button size="sm" onClick={generateMedia} disabled={generating}>
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              </Button>
            </div>
            {mediaUrl && (
              <div className="relative">
                <img src={mediaUrl} alt="generated" className="rounded-lg w-full max-h-64 object-cover" />
                <button
                  onClick={() => setMediaUrl(null)}
                  className="absolute top-2 right-2 p-1 rounded-full bg-background/80 backdrop-blur"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {!mediaUrl && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <ImageIcon className="w-3 h-3" /> Generated images attach automatically.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={send} disabled={sending}>
              <Send className="w-3.5 h-3.5 mr-1" /> {sending ? "Sending..." : "Send Reply"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
