import { useState, useRef } from "react";
import { Send, Smile, Paperclip, Mic, X, FileText, Reply } from "lucide-react";
import { VoiceRecorder } from "./VoiceRecorder";
import { Message } from "@/types/chat";
import { cn } from "@/lib/utils";

interface MessageInputProps {
  onSend: (text: string) => void;
  onSendVoice?: (blob: Blob, duration: number) => void;
  onSendFile?: (file: File) => void;
  onTyping?: () => void;
  replyTo?: Message | null;
  onCancelReply?: () => void;
}

export const MessageInput = ({ onSend, onSendVoice, onSendFile, onTyping, replyTo, onCancelReply }: MessageInputProps) => {
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (attachedFile && onSendFile) {
      onSendFile(attachedFile);
      setAttachedFile(null);
      setPreview(null);
    }
    if (text.trim()) {
      onSend(text.trim());
      setText("");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachedFile(file);
    if (file.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(file));
    } else {
      setPreview(null);
    }
    e.target.value = "";
  };

  const removeAttachment = () => {
    if (preview) URL.revokeObjectURL(preview);
    setAttachedFile(null);
    setPreview(null);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    onTyping?.();
  };

  if (isRecording) {
    return (
      <VoiceRecorder
        onSend={(blob, duration) => {
          onSendVoice?.(blob, duration);
          setIsRecording(false);
        }}
        onCancel={() => setIsRecording(false)}
      />
    );
  }

  return (
    <div className="p-3 border-t border-border/50 glass">
      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-2 mb-2 p-2 bg-surface rounded-lg border-l-2 border-primary">
          <Reply className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-primary font-medium">
              {replyTo.senderId === "me" ? "You" : "Them"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {replyTo.text || (replyTo.type === "image" ? "📷 Image" : replyTo.type === "voice" ? "🎤 Voice" : "📎 File")}
            </p>
          </div>
          <button onClick={onCancelReply} className="p-1 rounded-full hover:bg-surface-hover">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Attachment preview */}
      {attachedFile && (
        <div className="flex items-center gap-2 mb-2 p-2 bg-surface rounded-lg">
          {preview ? (
            <img src={preview} alt="Preview" className="w-16 h-16 object-cover rounded-md" />
          ) : (
            <div className="w-16 h-16 bg-surface-hover rounded-md flex items-center justify-center">
              <FileText className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-foreground truncate">{attachedFile.name}</p>
            <p className="text-[10px] text-muted-foreground">{(attachedFile.size / 1024).toFixed(1)} KB</p>
          </div>
          <button onClick={removeAttachment} className="p-1 rounded-full hover:bg-surface-hover">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-foreground">
          <Smile className="w-5 h-5" />
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-foreground"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <input ref={fileRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx,.zip" onChange={handleFileChange} className="hidden" />
        <input
          value={text}
          onChange={handleTextChange}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
          className="flex-1 bg-surface rounded-full px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50 transition-all"
        />
        {text.trim() || attachedFile ? (
          <button
            onClick={handleSend}
            className="p-2.5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-all neon-glow"
          >
            <Send className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => setIsRecording(true)}
            className="p-2.5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-all neon-glow"
          >
            <Mic className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
