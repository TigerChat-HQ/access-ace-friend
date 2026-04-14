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
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6 animate-fade-in text-center">
          <CheckCircle className="w-16 h-16 text-primary mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Check Your Email</h2>
          <p className="text-sm text-muted-foreground">
            We sent a password reset link to <span className="text-foreground font-medium">{email}</span>
          </p>
          <Button variant="outline" onClick={() => navigate("/auth")} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="text-center space-y-4">
          <img src={tigerLogo} alt="TIGERCHATS" className="w-20 h-20 mx-auto" width={512} height={512} />
          <h1 className="text-2xl font-bold text-foreground">Forgot Password?</h1>
          <p className="text-sm text-muted-foreground">Enter your email and we'll send you a reset link</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 glass rounded-2xl p-6">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="pl-10 bg-surface border-border/50 focus:border-primary"
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full neon-glow bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
            {loading ? "Sending..." : "Send Reset Link"}
            <ArrowRight className="w-4 h-4" />
          </Button>
          <button type="button" onClick={() => navigate("/auth")} className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors">
            Back to Login
          </button>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
