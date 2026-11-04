import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, User, Eye, EyeOff, ArrowRight } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authReturnPath } from "@/lib/auth-return";
import tigerLogo from "@/assets/tigerchats-logo.png";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = authReturnPath(params.get("next"));
  const confirmationRedirect = new URL(`/auth?next=${encodeURIComponent(next)}`, window.location.origin).href;

  const resendConfirmation = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      toast({ title: "Enter your email", description: "Add your account email before requesting a new confirmation link.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: normalizedEmail,
      options: { emailRedirectTo: confirmationRedirect },
    });
    if (error) {
      toast({ title: "Could not resend confirmation", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Confirmation email sent", description: "Check your inbox and spam folder, then open the newest link." });
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNeedsEmailConfirmation(false);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error) throw error;
        toast({ title: "Welcome back! 🐯", description: "You're now logged in." });
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: confirmationRedirect,
          },
        });
        if (error) throw error;
        setNeedsEmailConfirmation(true);
        toast({
          title: "Account created! 🎉",
          description: "Check your email to verify your account.",
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
      const emailNotConfirmed = message.toLowerCase().includes("email not confirmed") || message.toLowerCase().includes("email_not_confirmed");
      setNeedsEmailConfirmation(emailNotConfirmed);
      toast({
        title: emailNotConfirmed ? "Email not confirmed" : "Error",
        description: emailNotConfirmed ? "Confirm your email address before signing in, or request a new confirmation link below." : message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        {/* Logo */}
        <div className="text-center space-y-4">
          <img src={tigerLogo} alt="TIGERCHATS" className="w-24 h-24 mx-auto" width={512} height={512} />
          <div>
            <h1 className="text-3xl font-bold neon-text text-foreground">
              TIGER<span className="text-primary">CHATS</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Fast. Secure. Premium.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 glass rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-foreground text-center">
            {isLogin ? "Welcome Back" : "Create Account"}
          </h2>

          {!isLogin && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display name"
                className="pl-10 bg-surface border-border/50 focus:border-primary"
                required={!isLogin}
              />
            </div>
          )}

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

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="pl-10 pr-10 bg-surface border-border/50 focus:border-primary"
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full neon-glow bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
          >
            {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
            <ArrowRight className="w-4 h-4" />
          </Button>

          {isLogin && (
            <button
              type="button"
              onClick={() => navigate("/forgot-password")}
              className="w-full text-center text-sm text-primary hover:underline"
            >
              Forgot Password?
            </button>
          )}

          {needsEmailConfirmation && (
            <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
              <p className="text-xs text-muted-foreground">Your account still needs email verification.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void resendConfirmation()} disabled={loading} className="w-full">
                Resend confirmation email
              </Button>
            </div>
          )}

          <p className="text-center text-sm text-muted-foreground">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline font-medium"
            >
              {isLogin ? "Sign Up" : "Sign In"}
            </button>
          </p>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          🔐 End-to-end encrypted • Your messages are private
        </p>
      </div>
    </div>
  );
};

export default Auth;
