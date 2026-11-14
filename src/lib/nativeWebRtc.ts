/**
 * Typed adapter for the Android WebRTC JavaScript bridge.
 *
 * Supabase remains the signaling transport. This adapter only controls native
 * media/PeerConnection operations and translates Android bridge events.
 * Browser callers must continue using the existing WebRTC implementation.
 */

export interface NativeIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface NativeIceCandidate {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

export interface NativeWebRtcEvent {
  type: string;
  stage?: string;
  message?: string;
  state?: string;
  video?: boolean;
  sdp?: string;
  id?: string;
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  [key: string]: unknown;
}

export interface TigerNativeWebRtcBridge {
  nativeWebRtcStart(iceServersJson: string, withVideo: boolean): void;
  nativeWebRtcCreateOffer(): void;
  nativeWebRtcCreateAnswer(): void;
  nativeWebRtcRestartIce(): void;
  nativeWebRtcSetRemoteDescription(type: string, sdp: string): void;
  nativeWebRtcAddIceCandidate(candidateJson: string): void;
  nativeWebRtcSetMuted(muted: boolean): void;
  nativeWebRtcSetRemoteAudioEnabled(enabled: boolean): void;
  nativeWebRtcSetVideoEnabled(enabled: boolean): void;
  nativeWebRtcSetVideoLayout(enabled: boolean): void;
  nativeWebRtcSwitchCamera(): void;
  nativeWebRtcClose(): void;
}

const getNativeBridge = (): TigerNativeWebRtcBridge | undefined =>
  (window as unknown as { TigerNative?: TigerNativeWebRtcBridge }).TigerNative;

const EVENT_NAME = "tiger:native-webrtc";
const OPERATION_TIMEOUT_MS = 15_000;

export const isNativeWebRtcAvailable = (): boolean =>
  typeof window !== "undefined" &&
  /Android/i.test(window.navigator.userAgent) &&
  typeof getNativeBridge()?.nativeWebRtcStart === "function";

export const subscribeNativeWebRtc = (
  listener: (event: NativeWebRtcEvent) => void,
): (() => void) => {
  const handler = (raw: Event) => {
    const detail = (raw as CustomEvent<NativeWebRtcEvent>).detail;
    if (detail && typeof detail.type === "string") listener(detail);
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
};

const waitForEvent = <T extends NativeWebRtcEvent>(
  expectedType: string,
  invoke: () => void,
  timeoutMs = OPERATION_TIMEOUT_MS,
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    let unsubscribe = () => {};
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Native WebRTC timed out waiting for ${expectedType}.`));
    }, timeoutMs);
    unsubscribe = subscribeNativeWebRtc((event) => {
      if (event.type === "error" || event.type === "cancelled") {
        clearTimeout(timeout);
        unsubscribe();
        const detail = [event.stage, event.message].filter(Boolean).join(": ");
        reject(new Error(event.type === "cancelled"
          ? "Native WebRTC call was cancelled."
          : detail
            ? `Native WebRTC ${detail}`
            : "Native WebRTC operation failed."));
        return;
      }
      if (event.type === expectedType) {
        clearTimeout(timeout);
        unsubscribe();
        resolve(event as T);
      }
    });
    try {
      invoke();
    } catch (error) {
      clearTimeout(timeout);
      unsubscribe();
      reject(error);
    }
  });

export const startNativeWebRtc = async (
  iceServers: NativeIceServer[],
  withVideo: boolean,
): Promise<NativeWebRtcEvent> => {
  const bridge = getNativeBridge();
  if (!bridge) throw new Error("Native WebRTC bridge haipatikani kwenye kifaa hiki.");
  // Android may show a permission prompt; allow time for the user to respond.
  return waitForEvent("ready", () => bridge.nativeWebRtcStart(JSON.stringify(iceServers), withVideo), 120_000);
};

export const createNativeWebRtcDescription = async (
  kind: "offer" | "answer",
): Promise<NativeWebRtcEvent & { sdp: string; type: "offer" | "answer" }> => {
  const bridge = getNativeBridge();
  if (!bridge) throw new Error("Native WebRTC bridge haipatikani.");
  return waitForEvent("local-description", () => {
    if (kind === "offer") bridge.nativeWebRtcCreateOffer();
    else bridge.nativeWebRtcCreateAnswer();
  });
};

export const restartNativeWebRtcIce = (): void => {
  getNativeBridge()?.nativeWebRtcRestartIce();
};

export const setNativeRemoteDescription = async (
  type: "offer" | "answer",
  sdp: string,
): Promise<void> => {
  const bridge = getNativeBridge();
  if (!bridge) throw new Error("Native WebRTC bridge haipatikani.");
  await waitForEvent("remote-description-set", () => bridge.nativeWebRtcSetRemoteDescription(type, sdp));
};

export const addNativeIceCandidate = (candidate: RTCIceCandidateInit): void => {
  const bridge = getNativeBridge();
  if (!bridge) throw new Error("Native WebRTC bridge haipatikani.");
  if (!candidate.candidate) return;
  bridge.nativeWebRtcAddIceCandidate(JSON.stringify(candidate));
};

export const setNativeWebRtcMuted = (muted: boolean): void => {
  getNativeBridge()?.nativeWebRtcSetMuted(muted);
};

export const setNativeRemoteAudioEnabled = (enabled: boolean): void => {
  getNativeBridge()?.nativeWebRtcSetRemoteAudioEnabled(enabled);
};

export const setNativeWebRtcVideoEnabled = (enabled: boolean): void => {
  getNativeBridge()?.nativeWebRtcSetVideoEnabled(enabled);
};

export const setNativeWebRtcVideoLayout = (enabled: boolean): void => {
  getNativeBridge()?.nativeWebRtcSetVideoLayout(enabled);
};

export const switchNativeWebRtcCamera = (): void => {
  getNativeBridge()?.nativeWebRtcSwitchCamera();
};

export const closeNativeWebRtc = (): void => {
  getNativeBridge()?.nativeWebRtcClose();
};
