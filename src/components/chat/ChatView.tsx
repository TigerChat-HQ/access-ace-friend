import { ChatContact, Message } from "@/types/chat";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { ArrowLeft, Phone, Video, MoreVertical } from "lucide-react";

interface ChatViewProps {
  contact: ChatContact;
  messages: Message[];
  onBack: () => void;
  onSend: (text: string) => void;
}

export const ChatView = ({ contact, messages, onBack, onSend }: ChatViewProps) => {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="tiger-page-header glass">
        <button onClick={onBack} className="tiger-header-action md:hidden hover:bg-surface-hover hover:text-foreground" aria-label="Back to chats">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold text-secondary-foreground">
            {contact.avatar}
          </div>
          {contact.online && (
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-foreground">{contact.name}</h3>
          <p className="text-[11px] text-muted-foreground">
            {contact.typing ? (
              <span className="text-primary">typing...</span>
            ) : contact.online ? (
              <span className="text-primary">online</span>
            ) : contact.statusLabel ? (
              <span className={contact.online ? "font-medium text-emerald-500" : "text-muted-foreground"}>{contact.statusLabel}</span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-primary">
            <Phone className="w-4 h-4" />
          </button>
          <button className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-primary">
            <Video className="w-4 h-4" />
          </button>
          <button className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-foreground">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin p-4 space-y-1">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>

      {/* Input */}
      <MessageInput onSend={onSend} />
    </div>
  );
};
