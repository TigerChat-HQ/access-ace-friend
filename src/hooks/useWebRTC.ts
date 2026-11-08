// @refresh reset
import { useState, useEffect, useRef, useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type CallSignalData = {
  callId?: string;
  from?: string;
  sdp?: string;
  type?: RTCSdpType;
  renegotiate?: boolean;
  candidate?: RTCIceCandidateInit;
  reason?: string;
  [key: string]: unknown;
};

type CallSignal = {
  id: string;
  caller_id: string;
  callee_id: string;
  conversation_id: string;
  call_type: "voice" | "video";
  signal_type: string;
  signal_data?: CallSignalData | null;
  status: string;
  callId?: string;
};

const db = supabase as unknown as SupabaseClient;

type SignalInsert = {
  caller_id: string;
  callee_id: string;
  conversation_id?: string;
  call_type: string;
  signal_type: string;
  signal_data?: CallSignalData;
  status?: string;
};

const insertSignal = async (data: SignalInsert) => {
  const { error } = await db.from("call_signals").insert(data);
  if (error) throw error;
};

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"] },
    { urls: ["stun:stun.cloudflare.com:3478"] },
    {
      urls: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:443"],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
  iceCandidatePoolSize: 2,
};

const RING_TIMEOUT_MS = 45000;
const RECENT_CALL_WINDOW_MS = 15000;

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

type QueuedIce = { info: CallInfo; candidate: RTCIceCandidateInit };

export const useWebRTC = () => {
  const { user } = useAuth();
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [activeCall, setActiveCall] = useState<CallInfo | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [duration, setDuration] = useState(0);
  const [remoteStream, setRemoteStream] = useState<MediaStream>(() => new MediaStream());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const callIdRef = useRef<string | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iceQueue = useRef<RTCIceCandidateInit[]>([]);
  const localIceQueue = useRef<QueuedIce[]>([]);
  const signalReadyCallId = useRef<string | null>(null);
  const processedSignalIds = useRef<Set<string>>(new Set());
  const statusRef = useRef<CallStatus>("idle");
  const callRef = useRef<CallInfo | null>(null);
  const facingRef = useRef<"user" | "environment">("user");

  const getSignalKey = useCallback((signal: CallSignal, fallbackCallId?: string) => {
    const callId = signal?.signal_data?.callId || signal?.callId || fallbackCallId || signal?.id;
    return callId ? `${signal?.signal_type ?? "signal"}:${callId}` : null;
  }, []);

  useEffect(() => { statusRef.current = callStatus; }, [callStatus]);
  useEffect(() => { callRef.current = activeCall; }, [activeCall]);

  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current && localVideoRef.current.srcObject !== localStreamRef.current)
      localVideoRef.current.srcObject = localStreamRef.current;
    if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== remoteStream)
      remoteVideoRef.current.srcObject = remoteStream;
  });

  const cleanupMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    pcRef.current?.close();
    pcRef.current = null;
    iceQueue.current = [];
    localIceQueue.current = [];
    signalReadyCallId.current = null;
    pendingOfferRef.current = null;
    processedSignalIds.current.clear();
    setRemoteStream(new MediaStream());
    if (durationTimerRef.current) { clearInterval(durationTimerRef.current); durationTimerRef.current = null; }
    if (ringTimerRef.current) { clearTimeout(ringTimerRef.current); ringTimerRef.current = null; }
    if (disconnectTimerRef.current) { clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null; }
    setDuration(0);
    setIsMuted(false);
  }, []);

  const finish = useCallback(() => {
    cleanupMedia();
    callIdRef.current = null;
    statusRef.current = "ended";
    setCallStatus("ended");
    setTimeout(() => { statusRef.current = "idle"; callRef.current = null; setCallStatus("idle"); setActiveCall(null); }, 1500);
  }, [cleanupMedia]);

  const sendSignal = useCallback(async (info: CallInfo, type: string, data: CallSignalData = {}, status = "active") => {
    if (!user) throw new Error("You must be signed in to call.");
    await insertSignal({
      caller_id: info.callerId,
      callee_id: info.calleeId,
      conversation_id: info.conversationId,
      call_type: info.callType,
      signal_type: type,
      signal_data: { ...data, callId: info.callId, from: user.id },
      status,
    });
    if (type === "offer" && info.callerId === user.id) {
      void import("@/lib/dispatch-push").then(({ dispatchPush }) => dispatchPush(info.conversationId, info.callId));
    }
  }, [user]);

  const flushLocalIce = useCallback(async (info: CallInfo) => {
    signalReadyCallId.current = info.callId;
    const queued = localIceQueue.current.filter((item) => item.info.callId === info.callId);
    localIceQueue.current = localIceQueue.current.filter((item) => item.info.callId !== info.callId);
    if (queued.length > 0) {
      await Promise.allSettled(
        queued.map((item) => sendSignal(info, "ice-candidate", { candidate: item.candidate }))
      );
    }
  }, [sendSignal]);

  const endCall = useCallback(async () => {
    const info = callRef.current;
    try {
      if (info) await sendSignal(info, "hangup", { reason: statusRef.current === "outgoing" || statusRef.current === "incoming" ? "missed" : "ended" }, "ended");
    } catch (error) { console.error("Could not send call end:", error); }
    finally { finish(); }
  }, [sendSignal, finish]);

  const getMedia = async (video: boolean) => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Calls require a supported browser and a secure HTTPS connection.");
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: video ? { facingMode: facingRef.current, width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    });
  };

  const createPeerConnection = useCallback((info: CallInfo) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      const candidate = event.candidate.toJSON();
      if (signalReadyCallId.current !== info.callId) {
        localIceQueue.current.push({ info, candidate });
      } else {
        void sendSignal(info, "ice-candidate", { candidate }).catch((error) => console.error("Call ICE signal failed:", error));
      }
    };

    pc.onnegotiationneeded = async () => {
      if (user?.id !== info.callerId || statusRef.current !== "connected" || pc.signalingState !== "stable") return;
      try {
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);
        await sendSignal(info, "offer", { sdp: offer.sdp, type: offer.type, renegotiate: true });
      } catch (error) { console.error("Call reconnect failed:", error); }
    };

    const markConnected = () => {
      if (statusRef.current === "connected") return;
      statusRef.current = "connected";
      if (disconnectTimerRef.current) { clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null; }
      if (ringTimerRef.current) { clearTimeout(ringTimerRef.current); ringTimerRef.current = null; }
      setCallStatus("connected");
      if (!durationTimerRef.current) durationTimerRef.current = setInterval(() => setDuration((value) => value + 1), 1000);
    };

    pc.ontrack = (event) => {
      markConnected();
      setRemoteStream((prev) => {
        const stream = new MediaStream(prev.getTracks());
        (event.streams[0]?.getTracks() || [event.track]).forEach((track) => {
          if (!stream.getTracks().includes(track)) stream.addTrack(track);
        });
        return stream;
      });
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") {
        markConnected();
      } else if (state === "disconnected") {
        try {
          pc.restartIce();
        } catch (error: unknown) {
          console.warn("ICE restart could not be requested:", error);
        }
        if (!disconnectTimerRef.current) disconnectTimerRef.current = setTimeout(() => { void endCall(); }, 15000);
      } else if (state === "failed") {
        void endCall();
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === "connected" || state === "completed") {
        markConnected();
      } else if (state === "failed") {
        void endCall();
      }
    };
    return pc;
  }, [sendSignal, endCall, user?.id]);

  const flushRemoteIce = async () => {
    const pc = pcRef.current;
    if (!pc) return;
    for (const candidate of iceQueue.current) { try { await pc.addIceCandidate(candidate); } catch (error) { console.warn("Queued ICE candidate rejected:", error); } }
    iceQueue.current = [];
  };

  const startCall = useCallback(async (
    calleeId: string, conversationId: string, callType: "voice" | "video", calleeName: string, calleeAvatar: string,
  ) => {
    if (!user || statusRef.current !== "idle") return;
    const info: CallInfo = {
      callId: crypto.randomUUID(), callerId: user.id, calleeId, conversationId, callType,
      callerName: calleeName, callerAvatar: calleeAvatar,
    };
    callIdRef.current = info.callId;
    callRef.current = info;
    statusRef.current = "outgoing";
    setActiveCall(info);
    setCallStatus("outgoing");
    setIsVideoOn(callType === "video");
    localIceQueue.current = [];
    signalReadyCallId.current = null;
    try {
      const stream = await getMedia(callType === "video");
      if (callIdRef.current !== info.callId) { stream.getTracks().forEach((track) => track.stop()); return; }
      localStreamRef.current = stream;
      setLocalStream(stream);
      const pc = createPeerConnection(info);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal(info, "offer", { sdp: offer.sdp, type: offer.type }, "pending");
      await flushLocalIce(info);
      ringTimerRef.current = setTimeout(() => { if (statusRef.current === "outgoing") void endCall(); }, RING_TIMEOUT_MS);
    } catch (error) {
      console.error("Failed to start call:", error);
      alert(error instanceof DOMException ? `Allow microphone${callType === "video" ? " and camera" : ""} access to make calls.` : "The call could not be sent. Check HTTPS, permissions, and your connection.");
      cleanupMedia();
      callIdRef.current = null;
      callRef.current = null;
      statusRef.current = "idle";
      setCallStatus("idle");
      setActiveCall(null);
    }
  }, [user, createPeerConnection, cleanupMedia, sendSignal, flushLocalIce, endCall]);

  const acceptCall = useCallback(async (info: CallInfo, offer: RTCSessionDescriptionInit) => {
    if (!user) return;
    statusRef.current = "connecting";
    setCallStatus("connecting");
    callIdRef.current = info.callId;
    if (ringTimerRef.current) { clearTimeout(ringTimerRef.current); ringTimerRef.current = null; }
    localIceQueue.current = [];
    signalReadyCallId.current = null;
    try {
      const stream = await getMedia(info.callType === "video");
      if (callIdRef.current !== info.callId) { stream.getTracks().forEach((track) => track.stop()); return; }
      localStreamRef.current = stream;
      setLocalStream(stream);
      const pc = createPeerConnection(info);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      await pc.setRemoteDescription(offer);
      await flushRemoteIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal(info, "answer", { sdp: answer.sdp, type: answer.type });
      await flushLocalIce(info);
      ringTimerRef.current = setTimeout(() => { if (statusRef.current === "connecting") void endCall(); }, RING_TIMEOUT_MS);
    } catch (error) {
      console.error("Failed to accept call:", error);
      alert("Allow microphone/camera access and check your connection to answer the call.");
      try { await sendSignal(info, "reject", {}, "ended"); }
      finally { finish(); }
    }
  }, [user, createPeerConnection, sendSignal, flushLocalIce, finish, endCall]);

  const acceptIncomingCall = useCallback(() => {
    const info = callRef.current;
    const offer = pendingOfferRef.current;
    if (info && offer && statusRef.current === "incoming") return acceptCall(info, offer);
  }, [acceptCall]);

  const rejectCall = useCallback(async () => {
    const info = callRef.current;
    try { if (info) await sendSignal(info, "reject", {}, "ended"); }
    catch (error) { console.error("Call decline failed:", error); }
    finally { finish(); }
  }, [sendSignal, finish]);

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsMuted(!track.enabled); }
  }, []);

  const toggleVideo = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsVideoOn(track.enabled); }
  }, []);

  const switchCamera = useCallback(async () => {
    const pc = pcRef.current;
    const stream = localStreamRef.current;
    if (!pc || !stream || !stream.getVideoTracks()[0]) return;
    const nextFacing = facingRef.current === "user" ? "environment" : "user";
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: nextFacing } });
      const nextTrack = nextStream.getVideoTracks()[0];
      if (!nextTrack) return;
      nextTrack.enabled = stream.getVideoTracks()[0].enabled;
      const sender = pc.getSenders().find((item) => item.track?.kind === "video");
      await sender?.replaceTrack(nextTrack);
      const oldTrack = stream.getVideoTracks()[0];
      stream.removeTrack(oldTrack);
      oldTrack.stop();
      stream.addTrack(nextTrack);
      facingRef.current = nextFacing;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    } catch (error) { console.error("Switch camera failed:", error); }
  }, []);

  useEffect(() => {
    if (!user) return;
    let disposed = false;

    const handle = async (payload: { new: unknown }) => {
      const signal = payload.new as CallSignal;
      const data = signal.signal_data || {};
      if (data.from === user.id) return;
      const callId = data.callId || signal.id;
      if (!callId) return;

      const signalKey = getSignalKey(signal, callId);
      if (signalKey && processedSignalIds.current.has(signalKey)) return;
      if (signalKey) processedSignalIds.current.add(signalKey);

      switch (signal.signal_type) {
        case "offer": {
          if (signal.callee_id !== user.id) return;
          if (data.renegotiate && callId === callIdRef.current && pcRef.current && callRef.current) {
            const pc = pcRef.current;
            await pc.setRemoteDescription({ sdp: data.sdp, type: data.type });
            await flushRemoteIce();
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await sendSignal(callRef.current, "answer", { sdp: answer.sdp, type: answer.type });
            return;
          }
          if (callId === callIdRef.current || statusRef.current !== "idle") return;
          const info: CallInfo = {
            callId, callerId: signal.caller_id, calleeId: signal.callee_id,
            conversationId: signal.conversation_id, callType: signal.call_type,
            callerName: "Incoming caller", callerAvatar: "U",
          };
          callIdRef.current = callId;
          callRef.current = info;
          statusRef.current = "incoming";
          setActiveCall(info);
          setCallStatus("incoming");
          setIsVideoOn(signal.call_type === "video");
          pendingOfferRef.current = { sdp: data.sdp, type: data.type };
          ringTimerRef.current = setTimeout(() => { if (statusRef.current === "incoming") void endCall(); }, RING_TIMEOUT_MS);
          void supabase.from("profiles").select("display_name").eq("user_id", signal.caller_id).maybeSingle().then(({ data: profile }) => {
            if (callIdRef.current !== callId) return;
            const named = { ...info, callerName: profile?.display_name || "Unknown", callerAvatar: (profile?.display_name || "U").slice(0, 2).toUpperCase() };
            callRef.current = named;
            setActiveCall(named);
          });
          break;
        }
        case "answer": {
          if (callId !== callIdRef.current || !pcRef.current || pcRef.current.signalingState !== "have-local-offer") return;
          if (statusRef.current !== "connected") { statusRef.current = "connecting"; setCallStatus("connecting"); }
          await pcRef.current.setRemoteDescription({ sdp: data.sdp, type: data.type });
          await flushRemoteIce();
          break;
        }
        case "ice-candidate": {
          if (callId !== callIdRef.current || !data.candidate) return;
          if (pcRef.current?.remoteDescription) {
            try { await pcRef.current.addIceCandidate(data.candidate); }
            catch (error) { console.warn("ICE candidate rejected:", error); }
          } else iceQueue.current.push(data.candidate);
          break;
        }
        case "hangup":
        case "reject":
        case "missed":
          if (callId === callIdRef.current) finish();
          break;
      }
    };

    const channel = supabase
      .channel(`call-signals-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "call_signals", filter: `callee_id=eq.${user.id}` }, (payload) => { void handle(payload).catch((error) => console.error("Incoming call signal failed:", error)); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "call_signals", filter: `caller_id=eq.${user.id}` }, (payload) => { void handle(payload).catch((error) => console.error("Call signal failed:", error)); })
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        const since = new Date(Date.now() - RECENT_CALL_WINDOW_MS).toISOString();
        const { data: recent } = await supabase.from("call_signals").select("*")
          .eq("callee_id", user.id).gte("created_at", since).order("created_at", { ascending: true }).limit(50);
        if (disposed || !recent?.length) return;
        const recentSignals = recent as unknown as CallSignal[];
        const completed = new Set(recentSignals
          .filter((row) => ["answer", "hangup", "reject", "missed"].includes(row.signal_type))
          .map((row) => row.signal_data?.callId)
          .filter((callId): callId is string => typeof callId === "string"));
        const pendingOffer = recentSignals.find((row) => row.signal_type === "offer" && row.status === "pending" &&
          row.caller_id !== user.id && typeof row.signal_data?.callId === "string" && !completed.has(row.signal_data.callId));
        if (pendingOffer) await handle({ new: pendingOffer });
      });

    return () => { disposed = true; void supabase.removeChannel(channel); };
  }, [user, finish, endCall, sendSignal, getSignalKey]);

  useEffect(() => () => { cleanupMedia(); }, [user?.id, cleanupMedia]);

  return {
    callStatus, activeCall, isMuted, isVideoOn, duration,
    localVideoRef, remoteVideoRef, remoteStream, localStream,
    startCall, acceptCall, acceptIncomingCall, rejectCall, endCall, toggleMute, toggleVideo, switchCamera,
  };
};
