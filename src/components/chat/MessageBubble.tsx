import { useState, useRef, useMemo } from "react";
import { Message } from "@/types/chat";
import { cn } from "@/lib/utils";
import { Check, CheckCheck, Play, Pause, FileText, Download, Reply, Forward, Trash2, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MessageBubbleProps {
  message: Message;
  replyMessage?: Message | null;
  onReply?: (message: Message) => void;
  onForward?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
}

export const MessageBubble = ({ message, replyMessage, onReply, onForward, onDelete }: MessageBubbleProps) => {
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
    <div className={cn("flex mb-2 animate-fade-in group", isMe ? "justify-end" : "justify-start")}>
      {/* Actions menu - appears on hover */}
      {isMe && (
        <div className="flex items-center mr-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded-full hover:bg-surface-hover text-muted-foreground">
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card border-border/50 min-w-[140px]">
              <DropdownMenuItem onClick={() => onReply?.(message)} className="text-xs gap-2">
                <Reply className="w-3.5 h-3.5" /> Reply
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onForward?.(message)} className="text-xs gap-2">
                <Forward className="w-3.5 h-3.5" /> Forward
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete?.(message.id)} className="text-xs gap-2 text-destructive focus:text-destructive">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div
        className={cn(
          "max-w-[75%] rounded-2xl text-sm leading-relaxed",
          isImage && !message.text ? "p-1" : "px-4 py-2.5",
          isMe
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "glass text-foreground rounded-bl-md"
        )}
      >
        {/* Reply preview */}
        {replyMessage && (
          <div className={cn(
            "mb-2 px-3 py-1.5 rounded-lg border-l-2 text-[11px]",
            isMe ? "bg-primary-foreground/10 border-primary-foreground/40" : "bg-surface border-primary/40"
          )}>
            <p className="font-medium opacity-70 truncate">
              {replyMessage.senderId === "me" ? "You" : "Them"}
            </p>
            <p className="opacity-60 truncate">{replyMessage.text || (replyMessage.type === "image" ? "📷 Image" : "📎 File")}</p>
          </div>
        )}

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
            <div className="relative overflow-hidden rounded-lg">
              {!imgLoaded && <div className="w-48 h-48 bg-surface-hover rounded-lg animate-pulse" />}
              <img
                src={message.mediaUrl}
                alt="Image"
                loading="lazy"
                className={`rounded-lg max-w-full cursor-pointer transition-all duration-500 ${imgLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95 absolute"}`}
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

      {/* Actions for other's messages */}
      {!isMe && (
        <div className="flex items-center ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded-full hover:bg-surface-hover text-muted-foreground">
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-card border-border/50 min-w-[140px]">
              <DropdownMenuItem onClick={() => onReply?.(message)} className="text-xs gap-2">
                <Reply className="w-3.5 h-3.5" /> Reply
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onForward?.(message)} className="text-xs gap-2">
                <Forward className="w-3.5 h-3.5" /> Forward
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
};
