import { ChatContact } from "@/types/chat";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

interface ChatListItemProps {
  contact: ChatContact;
  isActive: boolean;
  onClick: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export const ChatListItem = ({ contact, isActive, onClick, isFavorite = false, onToggleFavorite }: ChatListItemProps) => {
  return (
    <div className={cn("w-full flex items-center gap-2 px-3 py-3 transition-all duration-200 hover:bg-surface-hover", isActive && "bg-primary/5 border-l-2 border-primary")}>
    <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left">
      <div className="relative">
        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold text-secondary-foreground">
          {contact.avatar}
        </div>
        {contact.online && (
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-background" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm text-foreground truncate">{contact.name}</span>
          {contact.statusLabel && <span className={cn("ml-2 shrink-0 text-[9px] font-medium", contact.online ? "text-emerald-500" : "text-muted-foreground")}>{contact.statusLabel}</span>}
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
    <button type="button" onClick={(event) => { event.stopPropagation(); onToggleFavorite?.(); }} aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"} aria-pressed={isFavorite} title={isFavorite ? "Remove favorite" : "Add favorite"} className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-surface-hover hover:text-primary">
      <Star className={cn("h-4 w-4", isFavorite && "fill-current text-primary")} />
    </button>
    </div>
  );
};
