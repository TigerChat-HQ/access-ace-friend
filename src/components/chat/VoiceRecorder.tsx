import { useCallback, useEffect, useRef, useState } from "react";
import { acquireSharedMicrophone } from "@/lib/audioCapture";
import { Mic, Square, Send, Trash2, Loader2, RefreshCw } from "lucide-react";

interface VoiceRecorderProps {
  onSend: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
}

const supportedAudioMimeType = () => {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
  return ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]
    .find((type) => MediaRecorder.isTypeSupported(type)) || "";
};

export const VoiceRecorder = ({ onSend, onCancel }: VoiceRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isStarting, setIsStarting] = useState(true);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const mountedRef = useRef(true);

  const releaseCaptureRef = useRef<(() => void) | null>(null);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    releaseCaptureRef.current?.();
    releaseCaptureRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    setError("");
    setAudioBlob(null);
    setDuration(0);
    setIsStarting(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Kifaa hiki hakiruhusu kurekodi sauti. Sasisha Android System WebView na ujaribu tena.");
      // Acquire the app-wide microphone lease before asking Android for the device.
      // This prevents a voice note and a WebRTC call from racing for the same mic.
      releaseCaptureRef.current = await acquireSharedMicrophone("voice-note");
      // Android WebView devices/drivers sometimes reject advanced audio constraints with
      // "Could not start audio source". Retry with the browser's simplest microphone request.
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch (firstError) {
        const firstName = firstError instanceof DOMException ? firstError.name : "";
        if (!["NotReadableError", "AbortError", "OverconstrainedError"].includes(firstName)) throw firstError;
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      if (!mountedRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      const mimeType = supportedAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data?.size) chunksRef.current.push(event.data); };
      recorder.onerror = () => {
        if (mountedRef.current) { setError("Kurekodi kumesimama. Hakikisha ruhusa ya Microphone imeruhusiwa kisha ujaribu tena."); setIsRecording(false); }
        releaseStream();
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || chunksRef.current[0]?.type || mimeType || "application/octet-stream";
        const blob = new Blob(chunksRef.current, { type });
        if (mountedRef.current) {
          if (blob.size > 0) setAudioBlob(blob);
          else setError("Hakuna sauti iliyorekodiwa. Ruhusu Microphone kisha ujaribu tena.");
          setDuration(Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)));
          setIsRecording(false);
        }
        releaseStream();
      };
      recorder.start(500);
      startedAtRef.current = Date.now();
      setIsRecording(true);
    } catch (cause) {
      releaseStream();
      const name = cause instanceof DOMException ? cause.name : "";
      const message = name === "NotAllowedError" || name === "PermissionDeniedError"
        ? "Ruhusa ya Microphone imekataliwa. Fungua App permissions za TigerChat, ruhusu Microphone, kisha bonyeza Jaribu tena."
        : name === "NotFoundError" ? "Hakuna kipaza sauti (Microphone) kilichopatikana."
        : name === "NotReadableError" || name === "AbortError"
          ? "Microphone haikuweza kuanzishwa. Funga app nyingine inayotumia sauti, hakikisha ruhusa ya Microphone ipo, kisha bonyeza Jaribu tena."
          : cause instanceof Error ? cause.message : "Imeshindikana kuanza kurekodi sauti.";
      if (mountedRef.current) { setError(message); setIsRecording(false); }
    } finally {
      if (mountedRef.current) setIsStarting(false);
    }
  }, [releaseStream]);

  useEffect(() => {
    mountedRef.current = true;
    void startRecording();
    return () => {
      mountedRef.current = false;
      if (recorderRef.current?.state === "recording") { try { recorderRef.current.stop(); } catch { /* already stopped */ } }
      releaseStream();
    };
  }, [startRecording, releaseStream]);

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") {
      try { recorderRef.current.stop(); } catch { setError("Imeshindikana kusimamisha kurekodi."); }
    }
    setIsRecording(false);
  };
  const handleSend = () => audioBlob?.size ? onSend(audioBlob, duration) : setError("Rekodi sauti kabla ya kuituma.");
  const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-3 p-3 border-t border-border/50 glass">
      <button type="button" onClick={onCancel} aria-label="Cancel voice recording" className="p-2 rounded-full hover:bg-surface-hover text-destructive transition-colors"><Trash2 className="w-5 h-5" /></button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          {isRecording && <div className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse shrink-0" />}
          {isStarting ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <div className="flex-1 bg-surface rounded-full h-8 flex items-center px-3"><div className="flex-1 flex items-center gap-1">{Array.from({ length: 20 }).map((_, i) => <div key={i} className="w-1 bg-primary rounded-full" style={{ height: isRecording ? `${4 + ((i * 7 + duration * 3) % 13)}px` : "4px" }} />)}</div></div>}
          <span className="text-xs text-muted-foreground font-mono min-w-[36px]">{formatDuration(duration)}</span>
        </div>
        {error && <p role="alert" className="mt-1 text-[11px] leading-tight text-destructive">{error}</p>}
      </div>
      {isRecording ? <button type="button" onClick={stopRecording} aria-label="Stop recording" className="p-2.5 rounded-full bg-destructive text-destructive-foreground"><Square className="w-4 h-4" /></button>
        : audioBlob ? <button type="button" onClick={handleSend} aria-label="Send voice message" className="p-2.5 rounded-full bg-primary text-primary-foreground neon-glow"><Send className="w-4 h-4" /></button>
        : <button type="button" onClick={() => void startRecording()} disabled={isStarting} aria-label="Retry voice recording" className="p-2.5 rounded-full bg-primary text-primary-foreground disabled:opacity-50">{isStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : error ? <RefreshCw className="w-4 h-4" /> : <Mic className="w-4 h-4" />}</button>}
    </div>
  );
};
