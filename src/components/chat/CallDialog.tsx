import { useState, useEffect, useRef } from "react";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2 } from "lucide-react";

interface CallDialogProps {
  contactName: string;
  contactAvatar: string;
  isVideo: boolean;
  onEnd: () => void;
}

// Generate a realistic ring tone using Web Audio API
const useRingtone = (shouldPlay: boolean) => {
  const ctxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!shouldPlay) {
      oscRef.current?.stop();
      ctxRef.current?.close();
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    try {
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      oscRef.current = osc;
      gainRef.current = gain;

      osc.type = "sine";
      osc.frequency.value = 440;
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      // Ring pattern: 1s on, 2s off
      let on = true;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      intervalRef.current = setInterval(() => {
        on = !on;
        gain.gain.setTargetAtTime(on ? 0.15 : 0, ctx.currentTime, 0.05);
        if (on) osc.frequency.setValueAtTime(440, ctx.currentTime);
      }, on ? 1000 : 2000);
    } catch {
      // Audio not available
    }

    return () => {
      oscRef.current?.stop();
      ctxRef.current?.close().catch(() => {});
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [shouldPlay]);
};

export const CallDialog = ({ contactName, contactAvatar, isVideo, onEnd }: CallDialogProps) => {
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(isVideo);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [status, setStatus] = useState<"ringing" | "connecting" | "connected" | "ended">("ringing");
  const videoRef = useRef<HTMLVideoElement>(null);

  useRingtone(status === "ringing");

  // Simulate realistic connection flow
  useEffect(() => {
    const ringTimer = setTimeout(() => setStatus("connecting"), 4000);
    const connectTimer = setTimeout(() => setStatus("connected"), 6000);
    return () => {
      clearTimeout(ringTimer);
      clearTimeout(connectTimer);
    };
  }, []);

  // Request camera for video calls
  useEffect(() => {
    if (!isVideo || status === "ended") return;
    let stream: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then((s) => {
      stream = s;
      if (videoRef.current) videoRef.current.srcObject = s;
    }).catch(() => {});
    return () => { stream?.getTracks().forEach((t) => t.stop()); };
  }, [isVideo, status]);

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

  const handleEnd = () => {
    setStatus("ended");
    setTimeout(onEnd, 500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-between py-16 overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-black animate-pulse opacity-50" />

      {/* Video preview (self) */}
      {isVideo && isVideoOn && (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm"
        />
      )}

      {/* Top section */}
      <div className="relative z-10 text-center">
        {/* Pulsing avatar with multiple rings */}
        <div className="relative mx-auto w-32 h-32 mb-6">
          {status === "ringing" && (
            <>
              <div className="absolute inset-0 rounded-full border-2 border-primary/40 animate-ping" />
              <div className="absolute -inset-3 rounded-full border border-primary/20 animate-ping" style={{ animationDelay: "0.5s" }} />
              <div className="absolute -inset-6 rounded-full border border-primary/10 animate-ping" style={{ animationDelay: "1s" }} />
            </>
          )}
          {status === "connecting" && (
            <div className="absolute inset-0 rounded-full border-2 border-primary/60 animate-spin" style={{ borderTopColor: "transparent" }} />
          )}
          <div className={`relative w-32 h-32 rounded-full bg-secondary flex items-center justify-center text-4xl font-bold text-secondary-foreground ${status === "ringing" ? "animate-pulse" : ""}`}>
            {contactAvatar}
          </div>
          {status === "connected" && (
            <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-primary border-2 border-black" />
          )}
        </div>

        <h2 className="text-2xl font-bold text-foreground">{contactName}</h2>
        <p className="text-sm text-muted-foreground mt-2 min-h-[20px]">
          {status === "ringing" && (
            <span className="animate-pulse">{isVideo ? "Video calling..." : "Calling..."}</span>
          )}
          {status === "connecting" && (
            <span className="text-primary">Connecting...</span>
          )}
          {status === "connected" && (
            <span className="text-primary font-mono">{formatDuration(duration)}</span>
          )}
          {status === "ended" && (
            <span className="text-destructive">Call ended</span>
          )}
        </p>

        {/* Encryption notice */}
        <p className="text-[10px] text-muted-foreground/50 mt-4">🔒 End-to-end encrypted</p>
      </div>

      {/* Bottom controls */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Secondary controls */}
        <div className="flex items-center gap-8">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`flex flex-col items-center gap-1 ${isMuted ? "text-destructive" : "text-foreground"}`}
          >
            <div className={`p-4 rounded-full transition-colors ${isMuted ? "bg-destructive/20" : "bg-surface-hover"}`}>
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </div>
            <span className="text-[10px] text-muted-foreground">Mute</span>
          </button>

          {isVideo && (
            <button
              onClick={() => setIsVideoOn(!isVideoOn)}
              className={`flex flex-col items-center gap-1 ${!isVideoOn ? "text-destructive" : "text-foreground"}`}
            >
              <div className={`p-4 rounded-full transition-colors ${!isVideoOn ? "bg-destructive/20" : "bg-surface-hover"}`}>
                {isVideoOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
              </div>
              <span className="text-[10px] text-muted-foreground">Camera</span>
            </button>
          )}

          <button
            onClick={() => setIsSpeaker(!isSpeaker)}
            className={`flex flex-col items-center gap-1 ${isSpeaker ? "text-primary" : "text-foreground"}`}
          >
            <div className={`p-4 rounded-full transition-colors ${isSpeaker ? "bg-primary/20" : "bg-surface-hover"}`}>
              <Volume2 className="w-6 h-6" />
            </div>
            <span className="text-[10px] text-muted-foreground">Speaker</span>
          </button>
        </div>

        {/* End call button */}
        <button
          onClick={handleEnd}
          className="p-5 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all active:scale-95 shadow-lg shadow-destructive/30"
        >
          <PhoneOff className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
};
