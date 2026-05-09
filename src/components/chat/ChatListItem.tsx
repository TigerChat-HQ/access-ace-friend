import { ChatContact } from "@/types/chat";
import { cn } from "@/lib/utils";

interface ChatListItemProps {
  contact: ChatContact;
  isActive: boolean;
  onClick: () => void;
}

export const ChatListItem = ({ contact, isActive, onClick }: ChatListItemProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 transition-all duration-200 hover:bg-surface-hover text-left",
        isActive && "bg-surface neon-glow"
      )}
    >
      <div className="relative">
        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold text-secondary-foreground">
          {contact.avatar}
        </div>
        {contact.online && (
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-primary border-2 border-background" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm text-foreground truncate">{contact.name}</span>
          <span className="text-[10px] text-muted-foreground ml-2 shrink-0">{contact.time}</span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-xs text-muted-foreground truncate">
            {contact.typing ? (
              <span className="text-primary animate-pulse-neon">typing...</span>
            ) : (
              contact.lastMessage
            )}
          </span>
          {contact.unread > 0 && (
            <span
              aria-label={`${contact.unread} unread`}
              className="ml-2 shrink-0 w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]"
            />
          )}
        </div>
      </div>
    </button>
  );
};
