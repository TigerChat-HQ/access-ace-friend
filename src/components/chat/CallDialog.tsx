import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2, VolumeX, SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playRingtone, playRingbackTone } from "@/lib/ringtones";
import type { CallInfo, CallStatus } from "@/hooks/useWebRTC";

interface CallDialogProps {
  callInfo: CallInfo;
  callStatus: CallStatus;
  isMuted: boolean;
  isVideoOn: boolean;
  nativeVideo: boolean;
  duration: number;
  remoteStream: MediaStream;
  localStream: MediaStream | null;
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onSwitchCamera: () => void;
}

const useCallRingtone = (mode: "incoming" | "outgoing" | null) => {
  useEffect(() => {
    if (!mode) return;
    const play = () => mode === "incoming" ? playRingtone("incoming_call") : playRingbackTone();
    let stopCurrent = play();
    const interval = window.setInterval(() => {
      stopCurrent();
      stopCurrent = play();
    }, mode === "incoming" ? 1900 : 3000);
    return () => {
      window.clearInterval(interval);
      stopCurrent();
    };
  }, [mode]);
};

export const CallDialog = ({
  callInfo,
  callStatus,
  isMuted,
  isVideoOn,
  nativeVideo,
  duration,
  remoteStream,
  localStream,
  localVideoRef,
  remoteVideoRef,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  onToggleVideo,
  onSwitchCamera,
}: CallDialogProps) => {
  const isVideo = callInfo.callType === "video";
  const isIncoming = callStatus === "incoming";
  const isOutgoing = callStatus === "outgoing" || callStatus === "ringing";
  const contactName = callInfo.callerName || "Unknown";
  const contactAvatar = callInfo.callerAvatar || "??";

  useCallRingtone(callStatus === "incoming" ? "incoming" : callStatus === "ringing" ? "outgoing" : null);

  useEffect(() => {
    if (!nativeVideo) return;
    const root = document.getElementById("root");
    const previousRootVisibility = root?.style.visibility ?? "";
    const previousBodyBackground = document.body.style.background;
    const previousHtmlBackground = document.documentElement.style.background;
    if (root) root.style.visibility = "hidden";
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
    return () => {
      if (root) root.style.visibility = previousRootVisibility;
      document.body.style.background = previousBodyBackground;
      document.documentElement.style.background = previousHtmlBackground;
    };
  }, [nativeVideo]);

  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream, localVideoRef, callStatus, isVideoOn]);

  useEffect(() => {
    const media = isVideo ? remoteVideoRef.current : remoteAudioRef.current;
    if (!media) return;
    media.srcObject = remoteStream;
    media.muted = !soundOn;
    if (remoteStream.getTracks().length > 0) {
      void media.play().then(() => setPlaybackBlocked(false)).catch(() => setPlaybackBlocked(true));
    }
  }, [remoteStream, remoteVideoRef, callStatus, isVideo, soundOn]);

  const resumePlayback = () => {
    const media = isVideo ? remoteVideoRef.current : remoteAudioRef.current;
    if (media) void media.play().then(() => setPlaybackBlocked(false)).catch(() => setPlaybackBlocked(true));
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const statusText = () => {
    switch (callStatus) {
      case "outgoing": return isVideo ? "Video calling..." : "Calling...";
      case "ringing": return "Ringing...";
      case "incoming": return isVideo ? "Incoming video call..." : "Incoming call...";
      case "connecting": return "Connecting...";
      case "connected": return formatDuration(duration);
      case "ended": return "Call ended";
      default: return "";
    }
  };

  return createPortal((
    <div className={`fixed inset-0 z-50 ${nativeVideo ? "bg-transparent" : "bg-background"} flex flex-col items-center justify-between gap-6 px-3 py-6 sm:py-12 overflow-y-auto`}>
      {!nativeVideo && <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-background animate-pulse opacity-50" />}

      {!isVideo && <audio ref={remoteAudioRef} autoPlay />}
      {/* Remote video (full screen background when connected) */}
      {isVideo && !nativeVideo && callStatus === "connected" && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Local video preview (small pip) */}
      {isVideo && !nativeVideo && isVideoOn && (callStatus === "connected" || callStatus === "connecting" || isOutgoing) && (
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="absolute top-4 right-4 w-24 sm:w-32 aspect-[3/4] rounded-lg object-cover border-2 border-primary/50 z-20 shadow-lg"
        />
      )}

      {/* Top section - avatar & status */}
      <div className={`relative z-10 text-center ${isVideo && callStatus === "connected" ? "bg-background/70 rounded-lg px-4 py-2 max-w-[60%]" : ""}`}>
        <div className={`relative mx-auto w-32 h-32 mb-6 ${isVideo && callStatus === "connected" ? "hidden" : ""}`}>
          {(isOutgoing || callStatus === "incoming") && (
            <>
              <div className="absolute inset-0 rounded-full border-2 border-primary/40 animate-ping" />
              <div className="absolute -inset-3 rounded-full border border-primary/20 animate-ping" style={{ animationDelay: "0.5s" }} />
            </>
          )}
          {callStatus === "connecting" && (
            <div className="absolute inset-0 rounded-full border-2 border-primary/60 animate-spin" style={{ borderTopColor: "transparent" }} />
          )}
          <div className={`relative w-32 h-32 rounded-full bg-secondary flex items-center justify-center text-4xl font-bold text-secondary-foreground ${isOutgoing || callStatus === "incoming" ? "animate-pulse" : ""}`}>
            {contactAvatar}
          </div>
          {callStatus === "connected" && (
            <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-primary border-2 border-background" />
          )}
        </div>

        <h2 className="text-2xl font-bold text-foreground break-words">{contactName}</h2>
        <p className="text-sm text-muted-foreground mt-2 min-h-[20px]">
          {callStatus === "outgoing" && <span className="animate-pulse">{statusText()}</span>}
          {callStatus === "ringing" && <span className="animate-pulse text-primary font-semibold">{statusText()}</span>}
          {callStatus === "incoming" && <span className="animate-pulse text-primary">{statusText()}</span>}
          {callStatus === "connecting" && <span className="text-primary">{statusText()}</span>}
          {callStatus === "connected" && <span className="text-primary font-mono">{statusText()}</span>}
          {callStatus === "ended" && <span className="text-destructive">{statusText()}</span>}
        </p>
      </div>

      {/* Bottom controls */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        {playbackBlocked && <Button onClick={resumePlayback} variant="secondary"><Volume2 className="w-4 h-4 mr-2" />Enable call sound</Button>}
        {/* Incoming call: Accept / Reject */}
        {isIncoming ? (
          <div className="flex items-center gap-12">
            <Button
              aria-label="Decline call" title="Decline call" variant="ghost" onClick={onReject}
              className="h-auto p-5 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all active:scale-95 shadow-lg shadow-destructive/30"
            >
              <PhoneOff className="w-7 h-7" />
            </Button>
            <Button
              aria-label="Accept call" title="Accept call" variant="ghost" onClick={onAccept}
              className="h-auto p-5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-95 shadow-lg shadow-primary/30 animate-pulse"
            >
              {isVideo ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
            </Button>
          </div>
        ) : (
          <>
            {/* Active call controls */}
            <div className="flex items-center gap-2 sm:gap-6">
              <Button
                aria-label={isMuted ? "Unmute microphone" : "Mute microphone"} title="Microphone" variant="ghost" onClick={onToggleMute}
                className={`h-auto px-2 flex flex-col items-center gap-1 ${isMuted ? "text-destructive" : "text-foreground"}`}
              >
                <div className={`p-4 rounded-full transition-colors ${isMuted ? "bg-destructive/20" : "bg-surface-hover"}`}>
                  {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </div>
                <span className="text-[10px] text-muted-foreground">Mute</span>
              </Button>

              {isVideo && (
                <Button
                  aria-label={isVideoOn ? "Turn camera off" : "Turn camera on"} title="Camera" variant="ghost" onClick={onToggleVideo}
                  className={`h-auto px-2 flex flex-col items-center gap-1 ${!isVideoOn ? "text-destructive" : "text-foreground"}`}
                >
                  <div className={`p-4 rounded-full transition-colors ${!isVideoOn ? "bg-destructive/20" : "bg-surface-hover"}`}>
                    {isVideoOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                  </div>
                  <span className="text-[10px] text-muted-foreground">Camera</span>
                </Button>
              )}

              <Button variant="ghost" title="Call sound" aria-label={soundOn ? "Mute call sound" : "Enable call sound"} onClick={() => setSoundOn(v => !v)} className="h-auto px-2 flex flex-col items-center gap-1 text-foreground">
                <div className="p-4 rounded-full bg-surface-hover transition-colors">
                  {soundOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
                </div>
                <span className="text-[10px] text-muted-foreground">Sound</span>
              </Button>
            </div>

            {isVideo && callStatus === "connected" && (
              <Button variant="secondary" size="icon" onClick={onSwitchCamera} aria-label="Switch camera" title="Switch camera"><SwitchCamera className="w-5 h-5" /></Button>
            )}
            {/* End call */}
            <Button
              aria-label="End call" title="End call" variant="ghost" onClick={onEnd}
              className="h-auto p-5 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all active:scale-95 shadow-lg shadow-destructive/30"
            >
              <PhoneOff className="w-7 h-7" />
            </Button>
          </>
        )}
      </div>
    </div>
  ), document.body);
};
