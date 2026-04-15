import { useState, useRef } from "react";
import { Message } from "@/types/chat";
import { cn } from "@/lib/utils";
import { Check, CheckCheck, Play, Pause } from "lucide-react";

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble = ({ message }: MessageBubbleProps) => {
  const isMe = message.senderId === "me";
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  return (
    <div className={cn("flex mb-2 animate-fade-in", isMe ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
          isMe
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "glass text-foreground rounded-bl-md"
        )}
      >
        {message.type === "voice" && message.mediaUrl ? (
          <div className="flex items-center gap-3 min-w-[160px]">
            <audio
              ref={audioRef}
              src={message.mediaUrl}
              onEnded={() => setPlaying(false)}
              className="hidden"
            />
            <button onClick={toggleAudio} className="shrink-0">
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <div className="flex-1 flex items-center gap-0.5">
              {Array.from({ length: 16 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-1 rounded-full",
                    isMe ? "bg-primary-foreground/60" : "bg-foreground/40"
                  )}
                  style={{ height: `${Math.random() * 12 + 4}px` }}
                />
              ))}
            </div>
            <span className="text-[10px] opacity-60">{message.text || "0:00"}</span>
          </div>
        ) : message.type === "image" && message.mediaUrl ? (
          <img src={message.mediaUrl} alt="Image" className="rounded-lg max-w-full" />
        ) : (
          <p>{message.text}</p>
        )}
        <div className={cn("flex items-center gap-1 mt-1", isMe ? "justify-end" : "justify-start")}>
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
