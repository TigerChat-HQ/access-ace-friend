import { useState } from "react";
import { Send, Smile, Paperclip, Mic } from "lucide-react";

interface MessageInputProps {
  onSend: (text: string) => void;
}

export const MessageInput = ({ onSend }: MessageInputProps) => {
  const [text, setText] = useState("");

  const handleSend = () => {
    if (text.trim()) {
      onSend(text.trim());
      setText("");
    }
  };

  return (
    <div className="p-3 border-t border-border/50 glass">
      <div className="flex items-center gap-2">
        <button className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-foreground">
          <Smile className="w-5 h-5" />
        </button>
        <button className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-foreground">
          <Paperclip className="w-5 h-5" />
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
          className="flex-1 bg-surface rounded-full px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50 transition-all"
        />
        {text.trim() ? (
          <button
            onClick={handleSend}
            className="p-2.5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-all neon-glow"
          >
            <Send className="w-4 h-4" />
          </button>
        ) : (
          <button className="p-2.5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-all neon-glow">
            <Mic className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
