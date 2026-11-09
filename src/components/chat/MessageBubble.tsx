import { useState, useRef, useMemo } from "react";
import { Message } from "@/types/chat";
import { cn } from "@/lib/utils";
import { playChatEmojiSound } from "@/lib/chat-emoji";
import { Button } from "@/components/ui/button";
import { Check, CheckCheck, Play, Pause, FileText, Download, Reply, Forward, Trash2, MoreVertical, Clock, Pin, Pencil } from "lucide-react";
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
  onDelete?: (messageId: string, mode?: "me" | "everyone") => void;
  myBubbleClass?: string;
  translatedText?: string;
  onStatusClick?: (storyId: string) => void;
  reactions?: { emoji: string; count: number; reactedByMe: boolean }[];
  isPinned?: boolean;
  onReact?: (emoji: string) => void;
  onTogglePin?: () => void;
  onEdit?: () => void;
  isEdited?: boolean;
}

export const MessageBubble = ({ message, replyMessage, onReply, onForward, onDelete, myBubbleClass, translatedText, onStatusClick, reactions = [], isPinned = false, onReact, onTogglePin, onEdit, isEdited = false }: MessageBubbleProps) => {
  const isMe = message.senderId === "me";
  const [playing, setPlaying] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const hasTranslation = !isMe && !!translatedText && translatedText !== message.text;
  const displayText = hasTranslation && !showOriginal ? translatedText : message.text;
  const audioRef = useRef<HTMLAudioElement>(null);

  const waveformHeights = useMemo(
    () => Array.from({ length: 16 }, () => Math.random() * 12 + 4),
    []
  );

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else void audioRef.current.play();
    setPlaying(!playing);
  };

  const isFile = message.type === "file";
  const isImage = message.type === "image";
  const isVoice = message.type === "voice";
  const isEmojiOnly = !!message.text && /^(?:\p{Extended_Pictographic}|\uFE0F|\u200D|\s)+$/u.test(message.text.trim()) && Array.from(message.text.trim()).length <= 8;

  return (
    <div className={cn("flex w-full min-w-0 mb-2 animate-fade-in group", isMe ? "justify-end" : "justify-start")}>
      {isMe && (
        <div className="flex items-center mr-1 opacity-60 md:opacity-0 group-hover:opacity-100 transition-opacity">
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
              <DropdownMenuItem onClick={onTogglePin} className="text-xs gap-2"><Pin className="w-3.5 h-3.5" /> {isPinned ? "Unpin message" : "Pin message"}</DropdownMenuItem>
              {isMe && message.type === "text" && <DropdownMenuItem onClick={onEdit} className="text-xs gap-2"><Pencil className="w-3.5 h-3.5" /> Edit message</DropdownMenuItem>}
              {isMe ? (
                <>
                  <DropdownMenuItem onClick={() => onDelete?.(message.id, "me")} className="text-xs gap-2">
                    <Trash2 className="w-3.5 h-3.5" /> Delete for me
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDelete?.(message.id, "everyone")} className="text-xs gap-2 text-destructive focus:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" /> Delete for everyone
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onClick={() => onDelete?.(message.id, "me")} className="text-xs gap-2 text-destructive focus:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" /> Delete for me
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div
        className={cn(
          "min-w-0 max-w-[78%] rounded-[1.35rem] text-[14.5px] leading-relaxed shadow-sm transition-transform active:scale-[0.98] [overflow-wrap:anywhere]",
          isImage && !message.text ? "p-1" : "px-4 py-2.5",
          isMe
            ? cn(myBubbleClass || "bg-primary text-primary-foreground", "rounded-br-md shadow-[0_4px_18px_-6px_hsl(var(--primary)/0.55)]")
            : "bg-card/90 backdrop-blur border border-border/40 text-foreground rounded-bl-md"
        )}
      >
        {isPinned && <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide opacity-70"><Pin className="h-3 w-3" /> Pinned message</div>}
        {message.statusContext && <button type="button" onClick={() => onStatusClick?.(message.statusContext!.story_id)} className="mb-2 w-full text-left border-l-2 border-current pl-2 text-xs opacity-80 hover:opacity-100 cursor-pointer"><p className="font-semibold">Status reply · Tap to view status</p><p className="line-clamp-2">{message.statusContext.caption}</p></button>}
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
              {waveformHeights.map((height, index) => (
                <div key={index} className={cn("w-1 rounded-full", isMe ? "bg-primary-foreground/60" : "bg-foreground/40")} style={{ height: `${height}px` }} />
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
            {message.text && <p dir="auto" className="mt-1 px-2">{displayText}</p>}
          </div>
        ) : isFile && message.mediaUrl && /\.(mp4|webm|mov)(\?|$)/i.test(message.mediaUrl) ? (
          <video src={message.mediaUrl} controls playsInline className="max-w-full rounded-lg" />
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
          <p dir="auto" role={isEmojiOnly ? "button" : undefined} tabIndex={isEmojiOnly ? 0 : undefined} title={isEmojiOnly ? "Tap emoji to replay sound" : undefined} onClick={isEmojiOnly ? () => playChatEmojiSound(displayText || "") : undefined} onKeyDown={isEmojiOnly ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); playChatEmojiSound(displayText || ""); } } : undefined} className={cn("whitespace-pre-wrap", isEmojiOnly && "chat-emoji-message cursor-pointer select-none")}>{(displayText || "").split(/(https:\/\/www\.google\.com\/maps\?q=-?[\d.]+,-?[\d.]+)/g).map((part, i) => part.startsWith("https://www.google.com/maps?q=") ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline">Open location in Maps</a> : part)}</p>
        )}
        {(reactions.length > 0 || onReact) && <div className="mt-2 flex flex-wrap items-center gap-1">
          {reactions.map((reaction) => <button key={reaction.emoji} type="button" onClick={() => onReact?.(reaction.emoji)} aria-pressed={reaction.reactedByMe} className={cn("rounded-full border px-2 py-0.5 text-[11px] transition-colors", reaction.reactedByMe ? "border-primary/60 bg-primary/15 text-primary" : "border-border/60 bg-background/40 hover:bg-surface-hover")}>{reaction.emoji} {reaction.count}</button>)}
          {onReact && <div className="flex items-center gap-0.5 border-l border-border/50 pl-1">{["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => <button key={emoji} type="button" onClick={() => onReact(emoji)} aria-label={`React ${emoji}`} className="rounded-full p-1 text-sm opacity-70 hover:bg-surface-hover hover:opacity-100">{emoji}</button>)}</div>}
        </div>}
        {hasTranslation && <Button variant="link" size="sm" className="h-auto p-0 mt-1 text-[11px] text-muted-foreground" onClick={() => setShowOriginal(value => !value)}>{showOriginal ? "Show translation" : "Translated · Show original"}</Button>}
        <div className={cn("flex items-center gap-1 mt-1", isMe ? "justify-end" : "justify-start", isImage && !message.text && "px-2 pb-1")}>
          <span className="text-[10px] opacity-60">{message.time}{isEdited ? " · Edited" : ""}</span>
          {isMe && (
            message.status === "pending" || message.status === "queued" ? (
              <Clock aria-label="Foleni (Inasubiri mtandao)" className="w-3.5 h-3.5 text-amber-300 opacity-80 animate-pulse" />
            ) : message.status === "read" ? (
              <CheckCheck aria-label="Read" className="w-3.5 h-3.5 text-primary" />
            ) : message.status === "delivered" ? (
              <CheckCheck aria-label="Delivered" className="w-3.5 h-3.5 opacity-60" />
            ) : (
              <Check aria-label="Sent" className="w-3.5 h-3.5 opacity-60" />
            )
          )}
        </div>
      </div>

      {!isMe && (
        <div className="flex shrink-0 items-center ml-1 opacity-60 md:opacity-0 group-hover:opacity-100 transition-opacity">
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
              <DropdownMenuItem onClick={onTogglePin} className="text-xs gap-2"><Pin className="w-3.5 h-3.5" /> {isPinned ? "Unpin message" : "Pin message"}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
};
