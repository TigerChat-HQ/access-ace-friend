import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type SignalInsert = {
  caller_id: string;
  callee_id: string;
  conversation_id?: string;
  call_type: string;
  signal_type: string;
  signal_data?: any;
  status?: string;
};

const insertSignal = (data: SignalInsert) =>
  supabase.from("call_signals").insert(data as any);

// STUN + public TURN relays so calls connect across mobile carriers / strict NATs.
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
  iceCandidatePoolSize: 4,
};

const RING_TIMEOUT_MS = 45000;

export interface CallInfo {
  callId: string;
  callerId: string;
  calleeId: string;
  conversationId: string;
  callType: "voice" | "video";
  callerName?: string;
  callerAvatar?: string;
}

export type CallStatus = "idle" | "outgoing" | "incoming" | "connecting" | "connected" | "ended";

export const useWebRTC = () => {
  const { user } = useAuth();
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [activeCall, setActiveCall] = useState<CallInfo | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [duration, setDuration] = useState(0);
  const [remoteStream, setRemoteStream] = useState<MediaStream>(() => new MediaStream());

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const callIdRef = useRef<string | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iceQueue = useRef<RTCIceCandidateInit[]>([]);
  const statusRef = useRef<CallStatus>("idle");
  const callRef = useRef<CallInfo | null>(null);
  const facingRef = useRef<"user" | "environment">("user");

  useEffect(() => { statusRef.current = callStatus; }, [callStatus]);
  useEffect(() => { callRef.current = activeCall; }, [activeCall]);

  // Re-attach streams whenever video elements (re)mount
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current && localVideoRef.current.srcObject !== localStreamRef.current)
      localVideoRef.current.srcObject = localStreamRef.current;
    if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== remoteStream)
      remoteVideoRef.current.srcObject = remoteStream;
  });

  const cleanupMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    iceQueue.current = [];
    setRemoteStream(new MediaStream());
    [durationTimerRef, ringTimerRef, disconnectTimerRef].forEach((r) => {
      if (r.current) { clearInterval(r.current as any); clearTimeout(r.current as any); r.current = null; }
    });
    setDuration(0);
    setIsMuted(false);
  }, []);

  const finish = useCallback(() => {
    cleanupMedia();
    callIdRef.current = null;
    setCallStatus("ended");
    setTimeout(() => { setCallStatus("idle"); setActiveCall(null); }, 1500);
  }, [cleanupMedia]);

  const sendSignal = useCallback(async (info: CallInfo, type: string, data: any = {}, status = "active") => {
    if (!user) return;
    await insertSignal({
      caller_id: info.callerId,
      callee_id: info.calleeId,
      conversation_id: info.conversationId,
      call_type: info.callType,
      signal_type: type,
      signal_data: { ...data, callId: info.callId, from: user.id },
      status,
    });
  }, [user]);

  const endCall = useCallback(async () => {
    const info = callRef.current;
    if (info) await sendSignal(info, statusRef.current === "outgoing" ? "missed" : "hangup", {}, "ended");
    finish();
  }, [sendSignal, finish]);

  const getMedia = async (video: boolean) =>
    navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: video ? { facingMode: facingRef.current, width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    });

  const createPeerConnection = useCallback((info: CallInfo) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal(info, "ice-candidate", { candidate: e.candidate.toJSON() });
    };

    pc.ontrack = (e) => {
      setRemoteStream((prev) => {
        const s = new MediaStream(prev.getTracks());
        (e.streams[0]?.getTracks() || [e.track]).forEach((t) => {
          if (!s.getTracks().includes(t)) s.addTrack(t);
        });
        return s;
      });
    };

    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === "connected") {
        if (disconnectTimerRef.current) { clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null; }
        if (ringTimerRef.current) { clearTimeout(ringTimerRef.current); ringTimerRef.current = null; }
        setCallStatus("connected");
        if (!durationTimerRef.current)
          durationTimerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      } else if (st === "disconnected") {
        // Give unstable networks time to recover, try ICE restart
        try { pc.restartIce(); } catch {}
        if (!disconnectTimerRef.current)
          disconnectTimerRef.current = setTimeout(() => endCall(), 15000);
      } else if (st === "failed") {
        endCall();
      }
    };
    return pc;
  }, [sendSignal, endCall]);

  const flushIce = async () => {
    const pc = pcRef.current;
    if (!pc) return;
    for (const c of iceQueue.current) { try { await pc.addIceCandidate(c); } catch {} }
    iceQueue.current = [];
  };

  const startCall = useCallback(async (
    calleeId: string, conversationId: string, callType: "voice" | "video",
    calleeName: string, calleeAvatar: string,
  ) => {
    if (!user || statusRef.current !== "idle") return;
    const info: CallInfo = {
      callId: crypto.randomUUID(), callerId: user.id, calleeId, conversationId, callType,
      callerName: calleeName, callerAvatar: calleeAvatar,
    };
    callIdRef.current = info.callId;
    callRef.current = info;
    setActiveCall(info);
    setCallStatus("outgoing");
    setIsVideoOn(callType === "video");
    try {
      const stream = await getMedia(callType === "video");
      localStreamRef.current = stream;
      const pc = createPeerConnection(info);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal(info, "offer", { sdp: offer.sdp, type: offer.type }, "pending");
      ringTimerRef.current = setTimeout(() => {
        if (statusRef.current === "outgoing") endCall();
      }, RING_TIMEOUT_MS);
    } catch (err) {
      console.error("Failed to start call:", err);
      alert("Allow microphone" + (callType === "video" ? " and camera" : "") + " access to make calls.");
      cleanupMedia();
      setCallStatus("idle");
      setActiveCall(null);
    }
  }, [user, createPeerConnection, cleanupMedia, sendSignal, endCall]);

  const acceptCall = useCallback(async (info: CallInfo, offer: RTCSessionDescriptionInit) => {
    if (!user) return;
    setCallStatus("connecting");
    callIdRef.current = info.callId;
    if (ringTimerRef.current) { clearTimeout(ringTimerRef.current); ringTimerRef.current = null; }
    try {
      const stream = await getMedia(info.callType === "video");
      localStreamRef.current = stream;
      const pc = createPeerConnection(info);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      await pc.setRemoteDescription(offer);
      await flushIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal(info, "answer", { sdp: answer.sdp, type: answer.type });
    } catch (err) {
      console.error("Failed to accept call:", err);
      alert("Allow microphone/camera access to answer calls.");
      await sendSignal(info, "reject", {}, "ended");
      finish();
    }
  }, [user, createPeerConnection, sendSignal, finish]);

  const rejectCall = useCallback(async () => {
    const info = callRef.current;
    if (info) await sendSignal(info, "reject", {}, "ended");
    cleanupMedia();
    callIdRef.current = null;
    setCallStatus("idle");
    setActiveCall(null);
  }, [sendSignal, cleanupMedia]);

  const toggleMute = useCallback(() => {
    const t = localStreamRef.current?.getAudioTracks()[0];
    if (t) { t.enabled = !t.enabled; setIsMuted(!t.enabled); }
  }, []);

  const toggleVideo = useCallback(() => {
    const t = localStreamRef.current?.getVideoTracks()[0];
    if (t) { t.enabled = !t.enabled; setIsVideoOn(t.enabled); }
  }, []);

  const switchCamera = useCallback(async () => {
    const pc = pcRef.current;
    const stream = localStreamRef.current;
    if (!pc || !stream || !stream.getVideoTracks()[0]) return;
    facingRef.current = facingRef.current === "user" ? "environment" : "user";
    try {
      const ns = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facingRef.current } });
      const nt = ns.getVideoTracks()[0];
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      await sender?.replaceTrack(nt);
      const old = stream.getVideoTracks()[0];
      stream.removeTrack(old); old.stop(); stream.addTrack(nt);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    } catch (e) { console.error("switch camera failed", e); }
  }, []);

  // Signaling — one stable subscription per user, filtered server-side
  useEffect(() => {
    if (!user) return;
    const handle = async (payload: any) => {
      const s = payload.new as any;
      const d = s.signal_data || {};
      if (d.from === user.id) return; // ignore our own signals
      const callId = d.callId;

      switch (s.signal_type) {
        case "offer": {
          if (s.callee_id !== user.id) return;
          if (statusRef.current !== "idle") {
            // busy
            await insertSignal({ caller_id: s.caller_id, callee_id: s.callee_id, conversation_id: s.conversation_id,
              call_type: s.call_type, signal_type: "reject", signal_data: { callId, from: user.id, busy: true }, status: "ended" });
            return;
          }
          const { data: p } = await supabase.from("profiles").select("display_name")
            .eq("user_id", s.caller_id).maybeSingle();
          const info: CallInfo = {
            callId, callerId: s.caller_id, calleeId: s.callee_id, conversationId: s.conversation_id,
            callType: s.call_type, callerName: p?.display_name || "Unknown",
            callerAvatar: (p?.display_name || "U").slice(0, 2).toUpperCase(),
          };
          callIdRef.current = callId;
          callRef.current = info;
          setActiveCall(info);
          setCallStatus("incoming");
          setIsVideoOn(s.call_type === "video");
          (window as any).__pendingOffer = { sdp: d.sdp, type: d.type };
          ringTimerRef.current = setTimeout(() => {
            if (statusRef.current === "incoming") { callIdRef.current = null; setCallStatus("idle"); setActiveCall(null); }
          }, RING_TIMEOUT_MS);
          break;
        }
        case "answer": {
          if (callId !== callIdRef.current || !pcRef.current) return;
          if (pcRef.current.signalingState !== "have-local-offer") return;
          setCallStatus("connecting");
          await pcRef.current.setRemoteDescription({ sdp: d.sdp, type: d.type });
          await flushIce();
          break;
        }
        case "ice-candidate": {
          if (callId !== callIdRef.current || !d.candidate) return;
          if (pcRef.current?.remoteDescription) {
            try { await pcRef.current.addIceCandidate(d.candidate); } catch {}
          } else iceQueue.current.push(d.candidate);
          break;
        }
        case "hangup":
        case "reject":
        case "missed": {
          if (callId !== callIdRef.current) return;
          finish();
          break;
        }
      }
    };

    const channel = supabase
      .channel(`call-signals-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "call_signals", filter: `callee_id=eq.${user.id}` }, handle)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "call_signals", filter: `caller_id=eq.${user.id}` }, handle)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, finish]);

  return {
    callStatus, activeCall, isMuted, isVideoOn, duration,
    localVideoRef, remoteVideoRef, remoteStream,
    startCall, acceptCall, rejectCall, endCall, toggleMute, toggleVideo, switchCamera,
  };
};
