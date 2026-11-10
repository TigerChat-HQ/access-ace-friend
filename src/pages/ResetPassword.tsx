import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import tigerLogo from "@/assets/tigerchats-logo.png";

const PASSWORD_RECOVERY_STORAGE_KEY = "tigerchat:password-recovery";

const hasStoredRecoverySession = () => {
  try {
    return window.sessionStorage.getItem(PASSWORD_RECOVERY_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [linkError, setLinkError] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    const tokenHash = url.searchParams.get("token_hash");
    const tokenType = url.searchParams.get("type");
    let hasRecoveryPayload =
      hashParams.get("type") === "recovery" ||
      url.searchParams.has("code") ||
      (tokenType === "recovery" && !!tokenHash) ||
      hasStoredRecoverySession();

    const authError =
      url.searchParams.get("error_description") ||
      hashParams.get("error_description");

    if (authError) {
      setLinkError(authError.replace(/\+/g, " "));
      setCheckingLink(false);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === "PASSWORD_RECOVERY") {
        try {
          window.sessionStorage.setItem(PASSWORD_RECOVERY_STORAGE_KEY, "true");
        } catch {
          // The recovery event remains valid for this mounted page.
        }
        setIsRecovery(true);
        setLinkError("");
      } else if (
        event === "INITIAL_SESSION" &&
        session &&
        (hasRecoveryPayload || hasStoredRecoverySession())
      ) {
        setIsRecovery(true);
        setLinkError("");
      }

      if (event === "SIGNED_OUT") {
        try {
          window.sessionStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
        } catch {
          // Ignore unavailable session storage.
        }
        setIsRecovery(false);
      }
    });

    const initializeRecovery = async () => {
      // Support customized recovery templates that redirect with token_hash.
      if (tokenType === "recovery" && tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        if (!active) return;
        if (error) {
          setLinkError("Kiungo kimeisha muda wake au tayari kimetumika. Omba kiungo kipya.");
          setCheckingLink(false);
          return;
        }

        hasRecoveryPayload = true;
        try {
          window.sessionStorage.setItem(PASSWORD_RECOVERY_STORAGE_KEY, "true");
        } catch {
          // The verified session is still available in Supabase auth storage.
        }
        window.history.replaceState({}, document.title, "/reset-password");
      }

      const { data, error } = await supabase.auth.getSession();
      if (!active) return;

      if (error) {
        setLinkError(error.message);
      } else if (data.session && (hasRecoveryPayload || hasStoredRecoverySession())) {
        setIsRecovery(true);
        setLinkError("");
      } else if (!authError) {
        setLinkError("Kiungo si sahihi au muda wake umeisha. Omba kiungo kipya.");
      }
      setCheckingLink(false);
    };

    void initializeRecovery();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: "Password ni fupi", description: "Tumia angalau herufi 8.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Password hazifanani", description: "Hakikisha password zote mbili zinafanana.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      try {
        window.sessionStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
      } catch {
        // Ignore unavailable session storage.
      }
      await supabase.auth.signOut({ scope: "local" });
      setSuccess(true);
      toast({ title: "Password imebadilishwa 🔐", description: "Sasa unaweza kuingia kwa password mpya." });
      window.setTimeout(() => navigate("/auth", { replace: true }), 1800);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Jaribu tena kwa kiungo kipya.";
      toast({ title: "Imeshindikana kubadilisha password", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (checkingLink) {
    return (
      <div className="tiger-app-safe-area min-h-screen flex items-center justify-center bg-background p-4">
        <p className="text-muted-foreground">Inathibitisha kiungo cha password...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="tiger-app-safe-area min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 animate-fade-in">
          <CheckCircle className="w-16 h-16 text-primary mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Password imebadilishwa!</h2>
          <p className="text-sm text-muted-foreground">Unaelekezwa kwenye ukurasa wa kuingia...</p>
        </div>
      </div>
    );
  }

  if (!isRecovery) {
    return (
      <div className="tiger-app-safe-area min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-md">
          <img src={tigerLogo} alt="TIGERCHATS" className="w-16 h-16 mx-auto" width={512} height={512} />
          <p className="text-muted-foreground">{linkError || "Kiungo si sahihi au muda wake umeisha."}</p>
          <Button onClick={() => navigate("/forgot-password")} variant="default">Omba kiungo kipya</Button>
          <Button onClick={() => navigate("/auth")} variant="outline">Rudi kuingia</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="tiger-app-safe-area min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="text-center space-y-4">
          <img src={tigerLogo} alt="TIGERCHATS" className="w-20 h-20 mx-auto" width={512} height={512} />
          <h1 className="text-2xl font-bold text-foreground">Weka password mpya</h1>
          <p className="text-sm text-muted-foreground">Tumia angalau herufi 8, kisha ithibitishe hapa chini.</p>
        </div>

        <form onSubmit={handleReset} className="space-y-4 glass rounded-2xl p-6">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password mpya"
              className="pl-10 pr-10 bg-surface border-border/50 focus:border-primary"
              required
              minLength={8}
              maxLength={72}
            />
            <button type="button" aria-label={showPassword ? "Ficha password" : "Onyesha password"} onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Rudia password mpya"
              className="pl-10 bg-surface border-border/50 focus:border-primary"
              required
              minLength={8}
              maxLength={72}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full neon-glow bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
            {loading ? "Inabadilisha..." : "Hifadhi password mpya"}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
