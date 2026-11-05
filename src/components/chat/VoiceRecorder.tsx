import { useState, useRef, useEffect } from "react";
import { Mic, Square, Send, Trash2 } from "lucide-react";

interface VoiceRecorderProps {
  onSend: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
}

export const VoiceRecorder = ({ onSend, onCancel }: VoiceRecorderProps) => {
  const [isRecording, setIsRecording] = useState(true);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    startRecording();
    return () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
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
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      onCancel();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleSend = () => {
    if (audioBlob) onSend(audioBlob, duration);
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3 p-3 border-t border-border/50 glass">
      <button onClick={onCancel} className="p-2 rounded-full hover:bg-surface-hover text-destructive transition-colors">
        <Trash2 className="w-5 h-5" />
      </button>

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

      {isRecording ? (
        <button onClick={stopRecording} className="p-2.5 rounded-full bg-destructive text-destructive-foreground">
          <Square className="w-4 h-4" />
        </button>
      ) : (
        <button onClick={handleSend} className="p-2.5 rounded-full bg-primary text-primary-foreground neon-glow">
          <Send className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
