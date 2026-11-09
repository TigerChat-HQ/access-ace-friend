import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import tigerLogo from "@/assets/tigerchats-logo.png";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signupPending, setSignupPending] = useState(false);
  const [resending, setResending] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const normalizedEmail = email.trim().toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizedEmail || !password) return;
    if (!isLogin && password.length < 8) {
      toast({ title: "Password is too short", description: "Tumia angalau herufi 8 kwa usalama.", variant: "destructive" });
      return;
    }
    if (!isLogin && displayName.trim().length < 2) {
      toast({ title: "Jina halijakamilika", description: "Weka jina lenye angalau herufi 2.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) throw error;
        toast({ title: "Karibu tena 🐯", description: "Umeingia kwenye TIGERCHATS." });
        navigate("/", { replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { display_name: displayName.trim() },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        if (data.session) {
          toast({ title: "Akaunti imefunguliwa 🎉", description: "Karibu TIGERCHATS." });
          navigate("/", { replace: true });
        } else {
          setSignupPending(true);
          toast({ title: "Thibitisha barua pepe", description: "Tumetuma kiungo cha uthibitisho. Kagua Inbox na Spam." });
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "";
      const lower = message.toLowerCase();
      const friendly = lower.includes("invalid login credentials")
        ? "Email au password si sahihi. Hakikisha umeandika vizuri."
        : lower.includes("email not confirmed")
          ? "Bado hujathibitisha email yako. Tumia kitufe cha kutuma uthibitisho tena."
          : lower.includes("already registered") || lower.includes("already been registered")
            ? "Email hii tayari ina akaunti. Jaribu kuingia badala ya kujisajili."
            : lower.includes("rate limit") || lower.includes("too many requests")
              ? "Umejaribu mara nyingi. Subiri kidogo kisha ujaribu tena."
              : message || "Jaribu tena baada ya muda mfupi.";
      toast({ title: "Imeshindikana", description: friendly, variant: "destructive" });
      if (lower.includes("email not confirmed")) setSignupPending(true);
    } finally {
      setLoading(false);
    }
  };

  const resendConfirmation = async () => {
    if (!normalizedEmail) {
      toast({ title: "Weka email kwanza", description: "Andika email uliyotumia kujisajili.", variant: "destructive" });
      return;
    }
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: normalizedEmail,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      toast({ title: "Imeshindikana kutuma", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Ombi limetumwa", description: "Kagua Inbox, Spam na Promotions." });
    }
    setResending(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="text-center space-y-4">
          <img src={tigerLogo} alt="TIGERCHATS" className="w-24 h-24 mx-auto" width={512} height={512} />
          <div>
            <h1 className="text-3xl font-bold neon-text text-foreground">TIGER<span className="text-primary">CHATS</span></h1>
            <p className="text-sm text-muted-foreground mt-1">Fast. Secure. Premium.</p>
          </div>
        </div>

        {signupPending ? (
          <div className="glass rounded-2xl p-6 space-y-4 text-center">
            <CheckCircle className="w-12 h-12 text-primary mx-auto" />
            <h2 className="text-xl font-semibold text-foreground">Thibitisha email yako</h2>
            <p className="text-sm text-muted-foreground">
              Tumetuma kiungo cha uthibitisho kwenda <strong className="text-foreground">{normalizedEmail}</strong>.
              Kagua Inbox, Spam na Promotions kabla ya kuomba kiungo kingine.
            </p>
            <Button type="button" onClick={() => void resendConfirmation()} disabled={resending} className="w-full">
              {resending ? "Inatuma..." : "Tuma uthibitisho tena"}
            </Button>
            <Button type="button" variant="outline" onClick={() => { setSignupPending(false); setIsLogin(true); }} className="w-full">
              Rudi kuingia
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 glass rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-foreground text-center">{isLogin ? "Karibu tena" : "Fungua akaunti"}</h2>

            {!isLogin && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jina lako" className="pl-10 bg-surface border-border/50 focus:border-primary" required minLength={2} maxLength={60} />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" className="pl-10 bg-surface border-border/50 focus:border-primary" required />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type={showPassword ? "text" : "password"} autoComplete={isLogin ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (angalau herufi 8)" className="pl-10 pr-10 bg-surface border-border/50 focus:border-primary" required minLength={isLogin ? 1 : 8} maxLength={72} />
              <button type="button" aria-label={showPassword ? "Ficha password" : "Onyesha password"} onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <Button type="submit" disabled={loading} className="w-full neon-glow bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
              {loading ? "Subiri kidogo..." : isLogin ? "Ingia" : "Fungua akaunti"}
              <ArrowRight className="w-4 h-4" />
            </Button>

            {isLogin && (
              <button type="button" onClick={() => navigate("/forgot-password")} className="w-full text-center text-sm text-primary hover:underline">
                Umesahau password?
              </button>
            )}

            <p className="text-center text-sm text-muted-foreground">
              {isLogin ? "Huna akaunti?" : "Tayari una akaunti?"}{" "}
              <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline font-medium">
                {isLogin ? "Jisajili" : "Ingia"}
              </button>
            </p>
          </form>
        )}

        <p className="text-center text-xs text-muted-foreground">🔐 Akaunti zinalindwa. Usimpe mtu password au msimbo wako wa uthibitisho.</p>
      </div>
    </div>
  );
};

export default Auth;
