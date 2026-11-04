import { useState, useRef, useEffect } from "react";
import { Mic, Square, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VoiceRecorderProps {
  onSend: (audioBlob: Blob, duration: number) => void | Promise<void>;
  onCancel: () => void;
}

export const VoiceRecorder = ({ onSend, onCancel }: VoiceRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef(false);

  useEffect(() => {
    activeRef.current = true;
    void startRecording();
    return () => {
      activeRef.current = false;
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!isRecording) return;
    const timer = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!activeRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find(type => MediaRecorder.isTypeSupported(type));
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || chunksRef.current[0]?.type || "audio/webm" });
        if (activeRef.current) setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      streamRef.current?.getTracks().forEach(track => track.stop());
      if (activeRef.current) setError("Microphone unavailable. Allow microphone access and try again.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleSend = async () => {
    if (!audioBlob?.size || sending) return;
    setSending(true); setError("");
    try { await onSend(audioBlob, duration); }
    catch (error) { setError(error instanceof Error ? error.message : "Voice note not sent. Try again."); }
    finally { if (activeRef.current) setSending(false); }
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3 p-3 border-t border-border/50 glass">
      <Button size="icon" variant="ghost" aria-label="Cancel voice note" disabled={sending} onClick={onCancel} className="text-destructive">
        <Trash2 className="w-5 h-5" />
      </Button>

      <div className="flex-1 flex items-center gap-3">
        {isRecording && <div className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />}
        <div className="flex-1 bg-surface rounded-full h-8 flex items-center px-3">
          <div className="flex-1 flex items-center gap-1">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="w-1 bg-primary rounded-full transition-all"
                style={{
                  height: isRecording ? `${Math.random() * 16 + 4}px` : "4px",
                  animationDelay: `${i * 50}ms`,
                }}
              />
            ))}
          </div>
        </div>
        <span className="text-xs text-muted-foreground font-mono min-w-[36px]">{formatDuration(duration)}</span>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

      {isRecording ? (
        <Button size="icon" variant="destructive" aria-label="Stop recording" onClick={stopRecording}>
          <Square className="w-4 h-4" />
        </Button>
      ) : (
        <Button size="icon" aria-label="Send voice note" disabled={!audioBlob?.size || sending} onClick={() => void handleSend()}>
          <Send className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
};
