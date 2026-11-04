import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MoreVertical } from "lucide-react";
import { ChatPrefs, useChatPreferences } from "@/hooks/useChatPreferences";
import { cn } from "@/lib/utils";

const WALLPAPERS: { key: string; label: string; bg: string }[] = [
  { key: "default", label: "Default", bg: "bg-background" },
  { key: "tiger", label: "Tiger", bg: "bg-gradient-to-br from-black via-orange-900/30 to-black" },
  { key: "neon", label: "Neon", bg: "bg-gradient-to-br from-emerald-900/40 via-black to-purple-900/40" },
  { key: "ocean", label: "Ocean", bg: "bg-gradient-to-br from-blue-900/50 to-cyan-900/50" },
  { key: "sunset", label: "Sunset", bg: "bg-gradient-to-br from-orange-700/40 via-pink-700/30 to-purple-900/50" },
  { key: "light", label: "Light", bg: "bg-zinc-100" },
];

const COLORS = [
  { key: "primary", label: "Green", className: "bg-primary" },
  { key: "blue", label: "Blue", className: "bg-blue-500" },
  { key: "purple", label: "Purple", className: "bg-purple-500" },
  { key: "pink", label: "Pink", className: "bg-pink-500" },
  { key: "orange", label: "Orange", className: "bg-orange-500" },
];

const FONT_SIZES: ChatPrefs["font_size"][] = ["small", "medium", "large"];

interface Props {
  conversationId: string;
}

export const ChatCustomizationDialog = ({ conversationId }: Props) => {
  const [open, setOpen] = useState(false);
  const { prefs, save } = useChatPreferences(conversationId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-foreground"
          title="Chat options"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border/50 max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Chat customization</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase">Wallpaper</p>
            <div className="grid grid-cols-3 gap-2">
              {WALLPAPERS.map((w) => (
                <button
                  key={w.key}
                  onClick={() => save({ wallpaper: w.key })}
                  className={cn(
                    "h-20 rounded-lg border-2 transition-all overflow-hidden",
                    w.bg,
                    prefs.wallpaper === w.key || (!prefs.wallpaper && w.key === "default")
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border/50"
                  )}
                >
                  <span className="text-[11px] font-medium text-foreground/80">{w.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase">Bubble color</p>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => save({ bubble_color: c.key })}
                  className={cn(
                    "w-10 h-10 rounded-full transition-transform",
                    c.className,
                    (prefs.bubble_color || "primary") === c.key
                      ? "ring-2 ring-foreground ring-offset-2 ring-offset-card scale-110"
                      : ""
                  )}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase">Font size</p>
            <div className="flex gap-2">
              {FONT_SIZES.map((f) => (
                <button
                  key={f}
                  onClick={() => save({ font_size: f })}
                  className={cn(
                    "flex-1 py-2 rounded-lg border text-sm capitalize transition-colors",
                    prefs.font_size === f
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-surface-hover"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
