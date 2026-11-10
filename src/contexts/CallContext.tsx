// @refresh reset
// A call-hook update must remount this owner instead of reusing an old hook queue.
import { createContext, useContext, ReactNode } from "react";
import { useWebRTC } from "@/hooks/useWebRTC";
import { CallDialog } from "@/components/chat/CallDialog";

type CallCtx = ReturnType<typeof useWebRTC>;
const Ctx = createContext<CallCtx | null>(null);

export const CallProvider = ({ children }: { children: ReactNode }) => {
  const webrtc = useWebRTC();
  return (
    <Ctx.Provider value={webrtc}>
      {children}
      {webrtc.callStatus !== "idle" && webrtc.activeCall && (
        <CallDialog
          callInfo={webrtc.activeCall}
          callStatus={webrtc.callStatus}
          isMuted={webrtc.isMuted}
          isVideoOn={webrtc.isVideoOn}
          duration={webrtc.duration}
          remoteStream={webrtc.remoteStream}
          localStream={webrtc.localStream}
          localVideoRef={webrtc.localVideoRef}
          remoteVideoRef={webrtc.remoteVideoRef}
          onAccept={() => { webrtc.acceptIncomingCall(); window.TigerNative?.dismissChatNotification?.(); }}
          onReject={() => { webrtc.rejectCall(); window.TigerNative?.dismissChatNotification?.(); }}
          onEnd={() => { webrtc.endCall(); window.TigerNative?.dismissChatNotification?.(); }}
          onToggleMute={webrtc.toggleMute}
          onToggleVideo={webrtc.toggleVideo}
          onSwitchCamera={webrtc.switchCamera}
        />
      )}
    </Ctx.Provider>
  );
};

export const useCall = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCall must be inside CallProvider");
  return v;
};
