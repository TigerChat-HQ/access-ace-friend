import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TwoFactorSecurity({ challengeOnly = false, onVerified }: { challengeOnly?: boolean; onVerified?: () => void }) {
  const [factor, setFactor] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { void supabase.auth.mfa.listFactors().then(({ data, error }) => {
    if (error) { setError(error.message); return; }
    const existing = data?.totp.find(f => f.status === "verified");
    setFactor(existing?.id ?? null); setVerified(!!existing);
  }); }, []);
  const enroll = async () => {
    setBusy(true); setError("");
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", issuer: "TIGERCHATS", friendlyName: `Authenticator ${Date.now()}` });
    if (error) setError(error.message);
    else { setFactor(data.id); setQr(data.totp.qr_code); }
    setBusy(false);
  };
  const verify = async () => {
    if (!factor) return;
    setBusy(true); setError("");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor, code });
    if (error) setError(error.message);
    else { setVerified(true); setQr(""); setCode(""); onVerified?.(); }
    setBusy(false);
  };
  const disable = async () => {
    if (!factor) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor });
    if (error) setError(error.message);
    else { setFactor(null); setVerified(false); }
    setBusy(false);
  };
  return <section className="space-y-3 border-t border-border py-4">
    <h2 className="font-semibold">Two-factor authentication</h2>
    <p className="text-sm text-muted-foreground">{challengeOnly ? "Enter the code from your authenticator app." : verified ? "Authenticator protection is enabled." : "Protect your account with an authenticator app."}</p>
    {qr && <img src={qr} alt="Authenticator setup QR code" className="h-48 w-48" />}
    {(qr || challengeOnly) && <form onSubmit={e => { e.preventDefault(); void verify(); }} className="space-y-3">
      <Input aria-label="Authenticator code" autoComplete="one-time-code" inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} />
      <Button disabled={busy || code.length !== 6} type="submit">Verify code</Button>
    </form>}
    {!challengeOnly && !qr && <Button variant="outline" disabled={busy} onClick={() => void (verified ? disable() : enroll())}>{verified ? "Disable two-factor authentication" : "Set up authenticator"}</Button>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}

const OFFLINE_AUTH_GRACE_MS = 24 * 60 * 60 * 1000;

export function TwoFactorGate({ children }: { children: React.ReactNode }) {
  const { session, signOut } = useAuth();
  const [state, setState] = useState<"loading" | "ready" | "challenge" | "error">("loading");

  useEffect(() => {
    let active = true;
    const grantKey = session?.user?.id ? `tigerchats:offline-auth-grant:${session.user.id}` : null;

    const hasRecentOfflineGrant = () => {
      if (!grantKey) return false;
      try {
        const grantedAt = Number(localStorage.getItem(grantKey));
        const age = Date.now() - grantedAt;
        return Number.isFinite(grantedAt) && grantedAt > 0 && age >= 0 && age <= OFFLINE_AUTH_GRACE_MS;
      } catch {
        return false;
      }
    };

    const evaluateAccess = async () => {
      if (!session) {
        setState("ready");
        return;
      }

      if (!navigator.onLine) {
        setState(hasRecentOfflineGrant() ? "ready" : "error");
        return;
      }

      setState("loading");
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!active) return;

      if (error) {
        // navigator.onLine can be true on captive portals or broken networks.
        // Only reuse a recently verified local grant; never create one on failure.
        setState(hasRecentOfflineGrant() ? "ready" : "error");
        return;
      }

      const needsChallenge = data?.nextLevel === "aal2" && data.currentLevel !== "aal2";
      if (needsChallenge) {
        if (grantKey) {
          try { localStorage.removeItem(grantKey); } catch { /* storage may be unavailable */ }
        }
        setState("challenge");
        return;
      }

      // Record only that the server accepted the current assurance level.
      // Passwords, MFA secrets, and access tokens are never copied to this marker.
      if (grantKey) {
        try { localStorage.setItem(grantKey, String(Date.now())); } catch { /* offline continuity is optional */ }
      }
      setState("ready");
    };

    void evaluateAccess();
    const handleOnline = () => { void evaluateAccess(); };
    window.addEventListener("online", handleOnline);
    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
    };
  }, [session?.access_token, session?.user?.id]);

  if (state === "ready") return <>{children}</>;
  return <div className="min-h-screen bg-background flex items-center justify-center p-6"><div className="w-full max-w-sm space-y-4">
    {state === "challenge" ? <TwoFactorSecurity challengeOnly onVerified={() => {
      if (session?.user?.id) {
        try { localStorage.setItem("tigerchats:offline-auth-grant:" + session.user.id, String(Date.now())); } catch { /* offline continuity is optional */ }
      }
      setState("ready");
    }} /> : <p>{state === "error" ? "Offline access is unavailable. Connect to the internet and verify your account first." : "Checking account protection…"}</p>}
    <Button variant="ghost" onClick={() => void signOut()}>Sign out</Button>
  </div></div>;
}