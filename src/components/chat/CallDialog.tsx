import { useEffect, useRef } from "react";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2 } from "lucide-react";
import type { CallInfo, CallStatus } from "@/hooks/useWebRTC";

interface CallDialogProps {
  callInfo: CallInfo;
  callStatus: CallStatus;
  isMuted: boolean;
  isVideoOn: boolean;
  duration: number;
  remoteStream: MediaStream;
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
}

// Ringtone using Web Audio API
const useRingtone = (shouldPlay: boolean) => {
  const ctxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!shouldPlay) {
      oscRef.current?.stop();
      ctxRef.current?.close().catch(() => {});
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    try {
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      oscRef.current = osc;
      osc.type = "sine";
      osc.frequency.value = 440;
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      let on = true;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      intervalRef.current = setInterval(() => {
        on = !on;
        gain.gain.setTargetAtTime(on ? 0.15 : 0, ctx.currentTime, 0.05);
      }, on ? 1000 : 2000);
    } catch {}
    return () => {
      oscRef.current?.stop();
      ctxRef.current?.close().catch(() => {});
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [shouldPlay]);
};

export const CallDialog = ({
  callInfo,
  callStatus,
  isMuted,
  isVideoOn,
  duration,
  remoteStream,
  localVideoRef,
  remoteVideoRef,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  onToggleVideo,
}: CallDialogProps) => {
  const isVideo = callInfo.callType === "video";
  const isIncoming = callStatus === "incoming";
  const contactName = callInfo.callerName || "Unknown";
  const contactAvatar = callInfo.callerAvatar || "??";

  useRingtone(callStatus === "incoming" || callStatus === "outgoing");

  // Attach remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, remoteVideoRef]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const statusText = () => {
    switch (callStatus) {
      case "outgoing": return isVideo ? "Video calling..." : "Calling...";
      case "incoming": return isVideo ? "Incoming video call..." : "Incoming call...";
      case "connecting": return "Connecting...";
      case "connected": return formatDuration(duration);
      case "ended": return "Call ended";
      default: return "";
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-between py-16 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-black animate-pulse opacity-50" />

      {/* Remote video (full screen background when connected) */}
      {isVideo && callStatus === "connected" && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Local video preview (small pip) */}
      {isVideo && isVideoOn && (callStatus === "connected" || callStatus === "connecting" || callStatus === "outgoing") && (
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="absolute top-4 right-4 w-32 h-44 rounded-2xl object-cover border-2 border-primary/50 z-20 shadow-lg"
        />
      )}

      {/* Top section - avatar & status */}
      <div className="relative z-10 text-center">
        <div className="relative mx-auto w-32 h-32 mb-6">
          {(callStatus === "outgoing" || callStatus === "incoming") && (
            <>
              <div className="absolute inset-0 rounded-full border-2 border-primary/40 animate-ping" />
              <div className="absolute -inset-3 rounded-full border border-primary/20 animate-ping" style={{ animationDelay: "0.5s" }} />
            </>
          )}
          {callStatus === "connecting" && (
            <div className="absolute inset-0 rounded-full border-2 border-primary/60 animate-spin" style={{ borderTopColor: "transparent" }} />
          )}
          <div className={`relative w-32 h-32 rounded-full bg-secondary flex items-center justify-center text-4xl font-bold text-secondary-foreground ${callStatus === "outgoing" || callStatus === "incoming" ? "animate-pulse" : ""}`}>
            {contactAvatar}
          </div>
          {callStatus === "connected" && (
            <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-primary border-2 border-black" />
          )}
        </div>

        <h2 className="text-2xl font-bold text-foreground">{contactName}</h2>
        <p className="text-sm text-muted-foreground mt-2 min-h-[20px]">
          {callStatus === "outgoing" && <span className="animate-pulse">{statusText()}</span>}
          {callStatus === "incoming" && <span className="animate-pulse text-primary">{statusText()}</span>}
          {callStatus === "connecting" && <span className="text-primary">{statusText()}</span>}
          {callStatus === "connected" && <span className="text-primary font-mono">{statusText()}</span>}
          {callStatus === "ended" && <span className="text-destructive">{statusText()}</span>}
        </p>
        <p className="text-[10px] text-muted-foreground/50 mt-4">🔒 End-to-end encrypted</p>
      </div>

      {/* Bottom controls */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Incoming call: Accept / Reject */}
        {isIncoming ? (
          <div className="flex items-center gap-12">
            <button
              onClick={onReject}
              className="p-5 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all active:scale-95 shadow-lg shadow-destructive/30"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
            <button
              onClick={onAccept}
              className="p-5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-95 shadow-lg shadow-primary/30 animate-pulse"
            >
              {isVideo ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
            </button>
          </div>
        ) : (
          <>
            {/* Active call controls */}
            <div className="flex items-center gap-8">
              <button
                onClick={onToggleMute}
                className={`flex flex-col items-center gap-1 ${isMuted ? "text-destructive" : "text-foreground"}`}
              >
                <div className={`p-4 rounded-full transition-colors ${isMuted ? "bg-destructive/20" : "bg-surface-hover"}`}>
                  {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </div>
                <span className="text-[10px] text-muted-foreground">Mute</span>
              </button>

              {isVideo && (
                <button
                  onClick={onToggleVideo}
                  className={`flex flex-col items-center gap-1 ${!isVideoOn ? "text-destructive" : "text-foreground"}`}
                >
                  <div className={`p-4 rounded-full transition-colors ${!isVideoOn ? "bg-destructive/20" : "bg-surface-hover"}`}>
                    {isVideoOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                  </div>
                  <span className="text-[10px] text-muted-foreground">Camera</span>
                </button>
              )}

              <button className="flex flex-col items-center gap-1 text-foreground">
                <div className="p-4 rounded-full bg-surface-hover transition-colors">
                  <Volume2 className="w-6 h-6" />
                </div>
                <span className="text-[10px] text-muted-foreground">Speaker</span>
              </button>
            </div>

            {/* End call */}
            <button
              onClick={onEnd}
              className="p-5 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all active:scale-95 shadow-lg shadow-destructive/30"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
