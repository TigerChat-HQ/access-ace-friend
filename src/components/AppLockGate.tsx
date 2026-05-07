import { useEffect } from "react";
import { Fingerprint } from "lucide-react";
import { useAppLock } from "@/hooks/useAppLock";
import { Button } from "@/components/ui/button";
import tigerLogo from "@/assets/tigerchats-logo.png";

export const AppLockGate = ({ children }: { children: React.ReactNode }) => {
  const { enabled, locked, unlock } = useAppLock();

  useEffect(() => {
    if (enabled && locked) unlock().catch(() => {});
  }, [enabled, locked, unlock]);

  if (!enabled || !locked) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center gap-6 p-6">
      <img src={tigerLogo} alt="TIGERCHATS" className="w-20 h-20 opacity-80" />
      <div className="text-center">
        <h1 className="text-xl font-bold text-foreground">App Locked</h1>
        <p className="text-sm text-muted-foreground mt-1">Verify with biometrics to continue</p>
      </div>
      <Button onClick={() => unlock()} size="lg" className="gap-2">
        <Fingerprint className="w-5 h-5" /> Unlock
      </Button>
    </div>
  );
};
