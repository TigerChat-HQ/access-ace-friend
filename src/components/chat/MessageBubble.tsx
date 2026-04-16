import { useState, useRef, useMemo } from "react";
import { Message } from "@/types/chat";
import { cn } from "@/lib/utils";
import { Check, CheckCheck, Play, Pause, FileText, Download } from "lucide-react";

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble = ({ message }: MessageBubbleProps) => {
  const isMe = message.senderId === "me";
  const [playing, setPlaying] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const waveformHeights = useMemo(
    () => Array.from({ length: 16 }, () => Math.random() * 12 + 4),
    []
  );

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
    setPlaying(!playing);
  };

  const isFile = message.type === "file";
  const isImage = message.type === "image";
  const isVoice = message.type === "voice";

  return (
    <div className={cn("flex mb-2 animate-fade-in", isMe ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl text-sm leading-relaxed",
          isImage && !message.text ? "p-1" : "px-4 py-2.5",
          isMe
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "glass text-foreground rounded-bl-md"
        )}
      >
        {isVoice && message.mediaUrl ? (
          <div className="flex items-center gap-3 min-w-[160px]">
            <audio ref={audioRef} src={message.mediaUrl} onEnded={() => setPlaying(false)} className="hidden" />
            <button onClick={toggleAudio} className="shrink-0">
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <div className="flex-1 flex items-center gap-0.5">
              {waveformHeights.map((h, i) => (
                <div
                  key={i}
                  className={cn("w-1 rounded-full", isMe ? "bg-primary-foreground/60" : "bg-foreground/40")}
                  style={{ height: `${h}px` }}
                />
              ))}
            </div>
            <span className="text-[10px] opacity-60">{message.text || "0:00"}</span>
          </div>
        ) : isImage && message.mediaUrl ? (
          <div>
            <div className="relative">
              {!imgLoaded && <div className="w-48 h-48 bg-surface-hover rounded-lg animate-pulse" />}
              <img
                src={message.mediaUrl}
                alt="Image"
                className={cn("rounded-lg max-w-full cursor-pointer", !imgLoaded && "hidden")}
                onLoad={() => setImgLoaded(true)}
                onClick={() => window.open(message.mediaUrl, "_blank")}
              />
            </div>
            {message.text && <p className="mt-1 px-2">{message.text}</p>}
          </div>
        ) : isFile && message.mediaUrl ? (
          <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 min-w-[160px]">
            <div className={cn("p-2 rounded-lg", isMe ? "bg-primary-foreground/20" : "bg-surface")}>
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{message.text || "File"}</p>
              <p className="text-[10px] opacity-60">Tap to download</p>
            </div>
            <Download className="w-4 h-4 opacity-60" />
          </a>
        ) : (
          <p>{message.text}</p>
        )}
        <div className={cn("flex items-center gap-1 mt-1", isMe ? "justify-end" : "justify-start", isImage && !message.text && "px-2 pb-1")}>
          <span className="text-[10px] opacity-60">{message.time}</span>
          {isMe && (
            message.status === "read" ? (
              <CheckCheck className="w-3.5 h-3.5 text-neon-blue" />
            ) : (
              <Check className="w-3.5 h-3.5 opacity-60" />
            )
          )}
        </div>
      </div>
    </div>
  );
};
