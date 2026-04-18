import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { reportContent } from "@/hooks/useBlocks";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  targetType: "post" | "comment" | "user";
  targetId: string;
}

const REASONS = [
  "Spam",
  "Hate speech",
  "Nudity or sexual content",
  "Harassment or bullying",
  "False information",
  "Violence",
  "Other",
];

export const ReportDialog = ({ open, onOpenChange, targetType, targetId }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!user) return;
    setSubmitting(true);
    const { error } = await reportContent(
      user.id,
      targetType,
      targetId,
      details ? `${reason}: ${details}` : reason
    );
    setSubmitting(false);
    if (error) {
      toast({ title: "Failed to report", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Report sent", description: "Thank you. Our team will review it." });
      setDetails("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border/50 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-foreground">Report {targetType}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            {REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  reason === r ? "bg-primary/10 text-primary" : "hover:bg-surface-hover text-foreground"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <Textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Add details (optional)"
            className="bg-surface border-border/50 resize-none"
            rows={3}
          />
          <Button onClick={submit} disabled={submitting} className="w-full">
            {submitting ? "Sending..." : "Submit report"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
