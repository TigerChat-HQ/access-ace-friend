import { useState, useEffect } from "react";
import { Download, X, Smartphone, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import tigerLogo from "@/assets/tigerchats-logo.png";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const PWAInstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed as PWA)
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(isStandaloneMode);

    // Detect iOS
    const ua = navigator.userAgent || "";
    const isAppleMobile = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(isAppleMobile);

    // Check if dismissed within the last 24 hours
    const lastDismissed = localStorage.getItem("tigerchats_pwa_dismissed");
    if (lastDismissed) {
      const diff = Date.now() - parseInt(lastDismissed, 10);
      if (diff < 24 * 60 * 60 * 1000) {
        setDismissed(true);
      }
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  if (isStandalone || dismissed) return null;

  // If neither Chrome install prompt is ready nor iOS Safari, hide
  if (!deferredPrompt && !isIOS) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setDismissed(true);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("tigerchats_pwa_dismissed", Date.now().toString());
  };

  return (
    <>
      <div className="fixed bottom-16 lg:bottom-4 left-4 right-4 max-w-md mx-auto z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="glass rounded-2xl border border-primary/30 p-3.5 shadow-2xl bg-card/95 backdrop-blur-md flex items-center justify-between gap-3">
          <img src={tigerLogo} alt="TIGERCHATS" className="w-10 h-10 rounded-xl shrink-0" />
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-foreground truncate flex items-center gap-1.5">
              <span>Weka TIGERCHATS kwenye Screen</span>
            </h4>
            <p className="text-[11px] text-muted-foreground line-clamp-1">
              {isIOS ? "Tumia kama app kwenye iPhone/iPad" : "Pakua app kwa ufikiaji wa haraka"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              onClick={handleInstallClick}
              className="h-8 px-3 text-xs font-semibold neon-glow gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Weka</span>
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleDismiss}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              aria-label="Funga"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm glass rounded-2xl p-5 border border-primary/40 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-foreground text-sm">Weka kwenye Home Screen</h3>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setShowIOSGuide(false)} className="h-7 w-7">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Kwenye kivinjari cha Safari:
            </p>
            <ol className="text-xs space-y-2.5 text-foreground/90 pl-1">
              <li className="flex items-center gap-2">
                <span className="font-bold text-primary">1.</span> Gusa kitufe cha <Share className="w-4 h-4 text-primary inline" /> (Share) chini ya screen.
              </li>
              <li className="flex items-center gap-2">
                <span className="font-bold text-primary">2.</span> Tembeza chini na chagua <strong>&quot;Add to Home Screen&quot;</strong>.
              </li>
              <li className="flex items-center gap-2">
                <span className="font-bold text-primary">3.</span> Gusa <strong>&quot;Add&quot;</strong> juu kulia kukamilisha.
              </li>
            </ol>
            <Button className="w-full neon-glow text-xs" onClick={() => setShowIOSGuide(false)}>
              Nimeelewa
            </Button>
          </div>
        </div>
      )}
    </>
  );
};
