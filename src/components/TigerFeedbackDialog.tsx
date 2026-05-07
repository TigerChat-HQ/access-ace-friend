import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Lightbulb, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialText?: string;
}

const TigerFeedbackDialog = ({ open, onOpenChange, initialText = "" }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [kind, setKind] = useState<"feedback" | "recommendation">("feedback");
  const [text, setText] = useState(initialText);
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!user) {
      toast({ title: "Sign in required", variant: "destructive" });
      return;
    }
    const trimmed = text.trim();
    if (trimmed.length < 5) {
      toast({ title: "Too short", description: "Add a bit more detail.", variant: "destructive" });
      return;
    }
    if (trimmed.length > 1000) {
      toast({ title: "Too long", description: "Keep it under 1000 characters.", variant: "destructive" });
      return;
    }
    setSending(true);
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: kind,
      target_id: user.id,
      reason: `[via Tiger AI] ${trimmed}`,
      status: "pending",
    });
    setSending(false);
    if (error) {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Sent to admin 🐯", description: "Thanks! Your message is now in the admin queue." });
    setText("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-primary" /> Send to Admin
          </DialogTitle>
          <DialogDescription>
            Tiger AI will forward your feedback or recommendation directly to the admin team.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          {(["feedback", "recommendation"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`text-xs px-3 py-1.5 rounded-full border capitalize ${
                kind === k
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-surface border-border/50 text-foreground"
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            kind === "feedback"
              ? "What's working, what's broken, what's confusing?"
              : "What new feature or improvement would you love to see?"
          }
          rows={5}
          maxLength={1000}
          className="bg-surface border-border/50"
        />
        <p className="text-[10px] text-muted-foreground text-right">{text.length}/1000</p>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={sending} className="bg-primary text-primary-foreground">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send to admin"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TigerFeedbackDialog;
