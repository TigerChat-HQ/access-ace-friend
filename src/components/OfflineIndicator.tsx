import { useState, useEffect } from "react";
import { WifiOff, Wifi } from "lucide-react";

export const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="bg-amber-500/95 text-black text-xs font-semibold py-1.5 px-3 text-center flex items-center justify-center gap-1.5 shadow-md sticky top-0 z-[100] backdrop-blur-md animate-in slide-in-from-top duration-200">
        <WifiOff className="w-3.5 h-3.5 shrink-0" />
        <span>Upo nje ya mtandao (Offline) — TIGERCHAT inafanya kazi kutoka kwenye kache</span>
      </div>
    );
  }

  if (showReconnected) {
    return (
      <div className="bg-emerald-500/95 text-black text-xs font-semibold py-1.5 px-3 text-center flex items-center justify-center gap-1.5 shadow-md sticky top-0 z-[100] backdrop-blur-md animate-in slide-in-from-top duration-200">
        <Wifi className="w-3.5 h-3.5 shrink-0" />
        <span>Mtandao umerudi! TIGERCHAT imeunganishwa tena</span>
      </div>
    );
  }

  return null;
};
