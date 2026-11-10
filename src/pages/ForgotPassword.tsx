import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Mail, ArrowLeft, ArrowRight, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import tigerLogo from "@/assets/tigerchats-logo.png";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setLoading(true);
    try {
      const redirectTo = new URL("/reset-password", window.location.origin).toString();
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
      if (error) throw error;
      setEmail(normalizedEmail);
      setSent(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Jaribu tena baada ya muda mfupi.";
      toast({ title: "Imeshindikana kutuma kiungo", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="tiger-app-safe-area min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6 animate-fade-in text-center">
          <CheckCircle className="w-16 h-16 text-primary mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Angalia email yako</h2>
          <p className="text-sm text-muted-foreground">
            Ikiwa akaunti ipo, tumetuma kiungo cha kubadilisha password kwenda <span className="text-foreground font-medium">{email}</span>. Kagua Inbox na Spam.
          </p>
          <Button variant="outline" onClick={() => navigate("/auth")} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Rudi kuingia
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="tiger-app-safe-area min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="text-center space-y-4">
          <img src={tigerLogo} alt="TIGERCHATS" className="w-20 h-20 mx-auto" width={512} height={512} />
          <h1 className="text-2xl font-bold text-foreground">Umesahau password?</h1>
          <p className="text-sm text-muted-foreground">Weka email ya akaunti yako; tutakutumia kiungo kipya cha kubadilisha password.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 glass rounded-2xl p-6">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="pl-10 bg-surface border-border/50 focus:border-primary"
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full neon-glow bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
            {loading ? "Inatuma..." : "Tuma kiungo kipya"}
            <ArrowRight className="w-4 h-4" />
          </Button>
          <button type="button" onClick={() => navigate("/auth")} className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors">
            Rudi kuingia
          </button>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
