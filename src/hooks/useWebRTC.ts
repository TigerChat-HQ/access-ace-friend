import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Json } from "@/integrations/supabase/types";

type SignalInsert = {
  caller_id: string;
  callee_id: string;
  conversation_id?: string;
  call_type: string;
  signal_type: string;
  signal_data?: Json;
  status?: string;
};

const insertSignal = (data: SignalInsert) =>
  supabase.from("call_signals").insert(data as any);

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

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

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream>(new MediaStream());
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const callIdRef = useRef<string | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);

  // Clean up media tracks
  const cleanupMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    remoteStreamRef.current = new MediaStream();
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    setDuration(0);
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback((callInfo: CallInfo) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    // Send ICE candidates via Supabase
    pc.onicecandidate = async (event) => {
      if (event.candidate && callInfo.callId) {
        await supabase.from("call_signals").insert({
          caller_id: callInfo.callerId,
          callee_id: callInfo.calleeId,
          conversation_id: callInfo.conversationId,
          call_type: callInfo.callType,
          signal_type: "ice-candidate",
          signal_data: { candidate: event.candidate.toJSON() },
          status: "active",
        });
      }
    };

    // Handle remote tracks
    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        remoteStreamRef.current.addTrack(track);
      });
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setCallStatus("connected");
        durationTimerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        endCall();
      }
    };

    return pc;
  }, []);

  // Start an outgoing call
  const startCall = useCallback(async (
    calleeId: string,
    conversationId: string,
    callType: "voice" | "video",
    calleeName: string,
    calleeAvatar: string,
  ) => {
    if (!user || callStatus !== "idle") return;

    const callId = crypto.randomUUID();
    callIdRef.current = callId;

    const callInfo: CallInfo = {
      callId,
      callerId: user.id,
      calleeId,
      conversationId,
      callType,
      callerName: calleeName,
      callerAvatar: calleeAvatar,
    };
    setActiveCall(callInfo);
    setCallStatus("outgoing");
    setIsVideoOn(callType === "video");

    try {
      // Get local media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = createPeerConnection(callInfo);

      // Add local tracks
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await supabase.from("call_signals").insert({
        caller_id: user.id,
        callee_id: calleeId,
        conversation_id: conversationId,
        call_type: callType,
        signal_type: "offer",
        signal_data: { sdp: offer.sdp, type: offer.type, callId },
        status: "pending",
      });
    } catch (err) {
      console.error("Failed to start call:", err);
      cleanupMedia();
      setCallStatus("idle");
      setActiveCall(null);
    }
  }, [user, callStatus, createPeerConnection, cleanupMedia]);

  // Accept an incoming call
  const acceptCall = useCallback(async (callInfo: CallInfo, offerSdp: RTCSessionDescriptionInit) => {
    if (!user) return;

    setCallStatus("connecting");
    callIdRef.current = callInfo.callId;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callInfo.callType === "video",
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = createPeerConnection(callInfo);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));

      // Process queued ICE candidates
      for (const candidate of iceCandidatesQueue.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      iceCandidatesQueue.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await supabase.from("call_signals").insert({
        caller_id: callInfo.callerId,
        callee_id: callInfo.calleeId,
        conversation_id: callInfo.conversationId,
        call_type: callInfo.callType,
        signal_type: "answer",
        signal_data: { sdp: answer.sdp, type: answer.type, callId: callInfo.callId },
        status: "active",
      });
    } catch (err) {
      console.error("Failed to accept call:", err);
      cleanupMedia();
      setCallStatus("idle");
      setActiveCall(null);
    }
  }, [user, createPeerConnection, cleanupMedia]);

  // Reject an incoming call
  const rejectCall = useCallback(async () => {
    if (!activeCall || !user) return;
    await supabase.from("call_signals").insert({
      caller_id: activeCall.callerId,
      callee_id: activeCall.calleeId,
      conversation_id: activeCall.conversationId,
      call_type: activeCall.callType,
      signal_type: "reject",
      signal_data: { callId: activeCall.callId },
      status: "ended",
    });
    cleanupMedia();
    setCallStatus("idle");
    setActiveCall(null);
  }, [activeCall, user, cleanupMedia]);

  // End an active call
  const endCall = useCallback(async () => {
    if (!activeCall || !user) return;
    await supabase.from("call_signals").insert({
      caller_id: activeCall.callerId,
      callee_id: activeCall.calleeId,
      conversation_id: activeCall.conversationId,
      call_type: activeCall.callType,
      signal_type: "hangup",
      signal_data: { callId: activeCall.callId },
      status: "ended",
    });
    cleanupMedia();
    setCallStatus("ended");
    setTimeout(() => {
      setCallStatus("idle");
      setActiveCall(null);
    }, 1500);
  }, [activeCall, user, cleanupMedia]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOn(videoTrack.enabled);
    }
  }, []);

  // Listen for incoming signals via Supabase Realtime
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("call-signals")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_signals",
        },
        async (payload) => {
          const signal = payload.new as any;

          // Only process signals meant for us
          if (signal.caller_id !== user.id && signal.callee_id !== user.id) return;

          const callId = signal.signal_data?.callId;

          switch (signal.signal_type) {
            case "offer": {
              // Incoming call
              if (signal.callee_id === user.id && callStatus === "idle") {
                // Fetch caller profile
                const { data: callerProfile } = await supabase
                  .from("profiles")
                  .select("display_name")
                  .eq("user_id", signal.caller_id)
                  .single();

                const info: CallInfo = {
                  callId: callId || signal.id,
                  callerId: signal.caller_id,
                  calleeId: signal.callee_id,
                  conversationId: signal.conversation_id,
                  callType: signal.call_type,
                  callerName: callerProfile?.display_name || "Unknown",
                  callerAvatar: (callerProfile?.display_name || "U").slice(0, 2).toUpperCase(),
                };
                setActiveCall(info);
                setCallStatus("incoming");
                setIsVideoOn(signal.call_type === "video");

                // Store the offer SDP for when user accepts
                (window as any).__pendingOffer = { sdp: signal.signal_data.sdp, type: signal.signal_data.type };
              }
              break;
            }
            case "answer": {
              // Our outgoing call was answered
              if (signal.callee_id === user.id || signal.caller_id === user.id) {
                if (callIdRef.current === callId && pcRef.current) {
                  setCallStatus("connecting");
                  const answerDesc = new RTCSessionDescription({
                    sdp: signal.signal_data.sdp,
                    type: signal.signal_data.type,
                  });
                  await pcRef.current.setRemoteDescription(answerDesc);

                  // Process queued ICE candidates
                  for (const candidate of iceCandidatesQueue.current) {
                    await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                  }
                  iceCandidatesQueue.current = [];
                }
              }
              break;
            }
            case "ice-candidate": {
              if (pcRef.current && pcRef.current.remoteDescription) {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(signal.signal_data.candidate));
              } else {
                iceCandidatesQueue.current.push(signal.signal_data.candidate);
              }
              break;
            }
            case "hangup":
            case "reject": {
              if (activeCall && callId === callIdRef.current) {
                cleanupMedia();
                setCallStatus("ended");
                setTimeout(() => {
                  setCallStatus("idle");
                  setActiveCall(null);
                }, 1500);
              }
              break;
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, callStatus, activeCall, cleanupMedia]);

  return {
    callStatus,
    activeCall,
    isMuted,
    isVideoOn,
    duration,
    localVideoRef,
    remoteVideoRef,
    remoteStream: remoteStreamRef.current,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
  };
};
