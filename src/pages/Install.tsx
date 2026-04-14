import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, Share, Smartphone, CheckCircle } from "lucide-react";
import tigerLogo from "@/assets/tigerchats-logo.png";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua));

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 animate-fade-in">
          <CheckCircle className="w-16 h-16 text-primary mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Already Installed!</h2>
          <p className="text-sm text-muted-foreground">TIGERCHATS is on your home screen 🐯</p>
          <Button onClick={() => window.location.href = "/"} className="neon-glow">Open App</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8 animate-fade-in text-center">
        <img src={tigerLogo} alt="TIGERCHATS" className="w-24 h-24 mx-auto" width={512} height={512} />
        <div>
          <h1 className="text-3xl font-bold neon-text text-foreground">
            TIGER<span className="text-primary">CHATS</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">Install TIGERCHATS on your device</p>
        </div>

        <div className="glass rounded-2xl p-6 space-y-6">
          {deferredPrompt ? (
            <Button onClick={handleInstall} className="w-full neon-glow gap-2" size="lg">
              <Download className="w-5 h-5" /> Install TIGERCHATS
            </Button>
          ) : isIOS ? (
            <div className="space-y-4">
              <Smartphone className="w-10 h-10 text-primary mx-auto" />
              <p className="text-sm text-foreground font-medium">Install on iPhone/iPad:</p>
              <ol className="text-left text-sm text-muted-foreground space-y-2">
                <li className="flex gap-2"><span className="text-primary font-bold">1.</span> Tap the <Share className="w-4 h-4 inline text-primary" /> Share button in Safari</li>
                <li className="flex gap-2"><span className="text-primary font-bold">2.</span> Scroll down and tap "Add to Home Screen"</li>
                <li className="flex gap-2"><span className="text-primary font-bold">3.</span> Tap "Add" to install</li>
              </ol>
            </div>
          ) : (
            <div className="space-y-4">
              <Smartphone className="w-10 h-10 text-primary mx-auto" />
              <p className="text-sm text-foreground font-medium">Install on Android:</p>
              <ol className="text-left text-sm text-muted-foreground space-y-2">
                <li className="flex gap-2"><span className="text-primary font-bold">1.</span> Open the browser menu (⋮)</li>
                <li className="flex gap-2"><span className="text-primary font-bold">2.</span> Tap "Add to Home Screen" or "Install App"</li>
                <li className="flex gap-2"><span className="text-primary font-bold">3.</span> Confirm the installation</li>
              </ol>
            </div>
          )}
        </div>

        <Button variant="outline" onClick={() => window.location.href = "/"} className="gap-2">
          Continue in Browser
        </Button>

        <p className="text-xs text-muted-foreground">🔐 End-to-end encrypted • Fast & Secure</p>
      </div>
    </div>
  );
};

export default Install;
