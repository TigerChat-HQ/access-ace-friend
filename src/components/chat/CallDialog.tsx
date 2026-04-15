import { useState, useEffect } from "react";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff } from "lucide-react";

interface CallDialogProps {
  contactName: string;
  contactAvatar: string;
  isVideo: boolean;
  onEnd: () => void;
}

export const CallDialog = ({ contactName, contactAvatar, isVideo, onEnd }: CallDialogProps) => {
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(isVideo);
  const [status, setStatus] = useState<"ringing" | "connected">("ringing");

  useEffect(() => {
    // Simulate connection after 3 seconds
    const connectTimer = setTimeout(() => setStatus("connected"), 3000);
    return () => clearTimeout(connectTimer);
  }, []);

  useEffect(() => {
    if (status !== "connected") return;
    const timer = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, [status]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center gap-8">
      {/* Pulsing avatar */}
      <div className="relative">
        <div className={`w-28 h-28 rounded-full bg-secondary flex items-center justify-center text-3xl font-bold text-secondary-foreground ${status === "ringing" ? "animate-pulse" : ""}`}>
          {contactAvatar}
        </div>
        {status === "ringing" && (
          <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-30" />
        )}
      </div>

      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground">{contactName}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {status === "ringing" ? (isVideo ? "Video calling..." : "Calling...") : formatDuration(duration)}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`p-4 rounded-full transition-colors ${isMuted ? "bg-destructive/20 text-destructive" : "bg-surface-hover text-foreground"}`}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        {isVideo && (
          <button
            onClick={() => setIsVideoOn(!isVideoOn)}
            className={`p-4 rounded-full transition-colors ${!isVideoOn ? "bg-destructive/20 text-destructive" : "bg-surface-hover text-foreground"}`}
          >
            {isVideoOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </button>
        )}

        <button
          onClick={onEnd}
          className="p-4 rounded-full bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
