import { useState, useRef, useEffect } from "react";
import { Message } from "@/types/chat";
import { useVoiceNotePlayer } from "@/contexts/VoiceNotePlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { playChatEmojiSound } from "@/lib/chat-emoji";
import { getMediaDisplayUrl, isDataSaverEnabled } from "@/lib/data-saver";
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
  const { activeVoiceNoteId, isVoiceNotePlaying, currentTime, duration, playbackRate, registerVoiceNote, playVoiceNote, togglePlayback, seekTo, cyclePlaybackRate } = useVoiceNotePlayer();
  const playing = activeVoiceNoteId === message.id && isVoiceNotePlaying;
  const audioProgress = activeVoiceNoteId === message.id ? currentTime : 0;
  const audioDuration = activeVoiceNoteId === message.id ? duration : 0;
  const [transcriptVisible, setTranscriptVisible] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState("");
  const [showTranscriptionConsent, setShowTranscriptionConsent] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const hasTranslation = !isMe && !!translatedText && translatedText !== message.text;
  const displayText = hasTranslation && !showOriginal ? translatedText : message.text;
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const dataSaver = isDataSaverEnabled();
  const mediaUrl = message.mediaUrl ? getMediaDisplayUrl(message.mediaUrl, dataSaver) : undefined;
  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => { const touch = event.touches[0]; touchStartRef.current = { x: touch.clientX, y: touch.clientY }; };
  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current; touchStartRef.current = null;
    if (!start || !onReply) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x; const dy = touch.clientY - start.y;
    if (Math.abs(dx) >= 58 && Math.abs(dy) <= 48) onReply(message);
  };

  useEffect(() => {
    if (!isVoice || !mediaUrl) return;
    return registerVoiceNote({ id: message.id, src: mediaUrl, label: message.text || "Voice note" });
  }, [isVoice, mediaUrl, message.id, message.text, registerVoiceNote]);

  useEffect(() => {
    if (!isVoice) return;
    let current = true;
    const loadTranscript = async () => {
      try {
        const { data } = await supabase.from("voice_note_transcripts").select("transcript").eq("message_id", message.id).maybeSingle();
        if (current && data?.transcript) setTranscript(data.transcript);
      } catch { /* transcript is optional and private */ }
    };
    void loadTranscript();
    return () => { current = false; };
  }, [isVoice, message.id]);

  const handleTranscribe = async () => {
    if (!mediaUrl) return;
    setShowTranscriptionConsent(false);
    setTranscribing(true);
    setTranscriptionError("");
    try {
      const audioResponse = await fetch(mediaUrl);
      if (!audioResponse.ok) throw new Error("Imeshindikana kupakua voice note.");
      const audioBlob = await audioResponse.blob();
      if (!audioBlob.size || audioBlob.size > 8 * 1024 * 1024) throw new Error("Voice note lazima iwe chini ya MB 8 ili kuandikwa.");
      const form = new FormData();
      form.append("messageId", message.id);
      form.append("audio", audioBlob, audioBlob.type.includes("webm") ? "voice-note.webm" : "voice-note.m4a");
      const { data, error } = await supabase.functions.invoke<{ transcript: string }>("transcribe-voice-note", { body: form });
      if (error) throw error;
      if (!data?.transcript) throw new Error("Hakuna maneno yaliyotambuliwa kwenye sauti hii.");
      setTranscript(data.transcript);
      setTranscriptVisible(true);
    } catch (error) {
      setTranscriptionError(error instanceof Error ? error.message : "Imeshindikana kuandika maneno ya sauti.");
    } finally {
      setTranscribing(false);
    }
  };

  const formatAudioTime = (seconds: number) => Number.isFinite(seconds)
    ? `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`
    : "0:00";

  const toggleAudio = () => {
    if (activeVoiceNoteId === message.id) togglePlayback();
    else playVoiceNote(message.id);
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
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={cn(
          "min-w-0 max-w-[78%] rounded-[1.35rem] text-[14.5px] leading-relaxed shadow-sm transition-transform active:scale-[0.98] [overflow-wrap:anywhere]",
          isImage && !message.text ? "p-1" : "px-4 py-2.5",
          isMe
            ? cn("relative isolate rounded-br-md border border-cyan-300/20 bg-[#080a0f] !text-white shadow-[0_7px_0_rgba(0,0,0,0.55),0_16px_28px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.16)] ring-1 ring-cyan-300/10", myBubbleClass)
            : "relative isolate rounded-bl-md border border-white/15 bg-[#080a0f] !text-white shadow-[0_7px_0_rgba(0,0,0,0.58),0_16px_28px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.14)] ring-1 ring-white/10 backdrop-blur-xl"
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
          <>
          <div className="flex items-center gap-3 min-w-[160px]">
            
            <button onClick={toggleAudio} className="shrink-0">
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <input aria-label="Seek voice message" type="range" min={0} max={audioDuration || 0} step={0.1} value={Math.min(audioProgress, audioDuration || 0)} onChange={(event) => { const next = Number(event.target.value); seekTo(next); }} className="w-full h-1 accent-current cursor-pointer" />
              <div className="flex items-center justify-between text-[10px] opacity-60"><span>{formatAudioTime(audioProgress)}</span><span>{formatAudioTime(audioDuration) || message.text || "0:00"}</span></div>
            </div>
            <button type="button" aria-label="Change playback speed" onClick={cyclePlaybackRate} className="shrink-0 rounded-full px-1.5 py-1 text-[10px] font-semibold bg-white/10 hover:bg-white/20">{playbackRate}×</button>
          </div>
          <div className="mt-2">
            <button type="button" onClick={() => transcript ? setTranscriptVisible((visible) => !visible) : setShowTranscriptionConsent((visible) => !visible)} disabled={transcribing} className="text-[11px] underline underline-offset-2 opacity-80 hover:opacity-100 disabled:opacity-50">
              {transcribing ? "Inaandika sauti..." : transcript ? (transcriptVisible ? "Ficha maandishi" : "Onyesha maandishi") : showTranscriptionConsent ? "Ficha ruhusa" : "Andika maneno ya sauti"}
            </button>
            {showTranscriptionConsent && !transcript && (
              <div className="mt-2 rounded-lg bg-white/10 p-2">
                <p className="text-[11px] leading-relaxed">Sauti itatumwa kwa Google Gemini AI na itashughulikiwa chini ya masharti ya faragha ya mtoa huduma. TigerChat haihifadhi faili la sauti kwenye jedwali la transcript; maandishi yataonekana kwenye akaunti yako tu.</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => void handleTranscribe()} disabled={transcribing} className="rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground">Kubali na endelea</button>
                  <button type="button" onClick={() => setShowTranscriptionConsent(false)} className="rounded-md bg-white/10 px-2 py-1 text-[10px]">Ghairi</button>
                </div>
              </div>
            )}
            {transcriptionError && <p role="alert" className="mt-1 text-[11px] text-red-300">{transcriptionError}</p>}
            {transcriptVisible && transcript && <p dir="auto" className="mt-2 rounded-lg bg-white/10 p-2 text-xs whitespace-pre-wrap">{transcript}</p>}
          </div>
          </>
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
          <video src={mediaUrl || message.mediaUrl} controls playsInline preload={dataSaver ? "none" : "metadata"} className="max-w-full rounded-lg" />
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
          <p dir="auto" role={isEmojiOnly ? "button" : undefined} tabIndex={isEmojiOnly ? 0 : undefined} title={isEmojiOnly ? "Tap emoji to replay sound" : undefined} onClick={isEmojiOnly ? () => playChatEmojiSound(displayText || "") : undefined} onKeyDown={isEmojiOnly ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); playChatEmojiSound(displayText || ""); } } : undefined} className={cn("whitespace-pre-wrap", isEmojiOnly && "chat-emoji-message cursor-pointer select-none")}>{(displayText || "").split(/((?:https?:\/\/|www\.)[^\s<]+)/gi).map((part, i) => /^https?:\/\//i.test(part) || /^www\./i.test(part) ? <a key={i} href={/^https?:\/\//i.test(part) ? part : `https://${part}`} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="underline break-all">{part}</a> : part)}</p>
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
