import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MoreVertical } from "lucide-react";
import { ChatPrefs, useChatPreferences } from "@/hooks/useChatPreferences";
import { cn } from "@/lib/utils";

const WALLPAPERS: { key: string; label: string; bg: string; emoji?: string }[] = [
  { key: "default", label: "Default", bg: "bg-background" },
  { key: "tiger", label: "Tiger", emoji: "🐅", bg: "chat-wallpaper-tiger bg-gradient-to-br from-black via-orange-950/70 to-black" },
  { key: "neon", label: "Neon", bg: "bg-gradient-to-br from-emerald-900/40 via-black to-purple-900/40" },
  { key: "ocean", label: "Ocean", bg: "bg-gradient-to-br from-blue-900/50 to-cyan-900/50" },
  { key: "black-car", label: "Black Sports Car", emoji: "🏎️", bg: "chat-wallpaper-car bg-gradient-to-br from-black via-zinc-900 to-slate-950" },
  { key: "black-lion", label: "Black Lion", emoji: "🦁", bg: "chat-wallpaper-lion bg-gradient-to-br from-black via-stone-950 to-amber-950/70" },
  { key: "black-wolf", label: "Black Wolf", emoji: "🐺", bg: "chat-wallpaper-wolf bg-gradient-to-br from-black via-slate-950 to-blue-950/70" },
  { key: "black-eagle", label: "Black Eagle", emoji: "🦅", bg: "chat-wallpaper-eagle bg-gradient-to-br from-black via-neutral-950 to-zinc-900" },
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
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export const ChatCustomizationDialog = ({ conversationId, open: controlledOpen, onOpenChange, hideTrigger = false }: Props) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const { prefs, save } = useChatPreferences(conversationId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <button
            className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-foreground"
            title="Chat options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </DialogTrigger>
      )}
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
                  <span className="flex h-full flex-col items-center justify-center gap-1 bg-black/10 px-1">
                    {w.emoji && <span className="text-3xl drop-shadow-[0_3px_5px_rgba(0,0,0,.8)]" aria-hidden="true">{w.emoji}</span>}
                    <span className="text-center text-[11px] font-semibold text-foreground drop-shadow-[0_1px_3px_rgba(0,0,0,.9)]">{w.label}</span>
                  </span>
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

export const wallpaperClass = (key: string | null): string => {
  const w = WALLPAPERS.find((x) => x.key === key);
  return w?.bg || "";
};

export const bubbleColorClass = (key: string | null): string => {
  // Keep every message surface black; the saved color preference now accents
  // the 4D edge instead of recoloring the message body.
  switch (key) {
    case "blue":
      return "border-blue-300/25 ring-1 ring-blue-400/15";
    case "purple":
      return "border-purple-300/25 ring-1 ring-purple-400/15";
    case "pink":
      return "border-pink-300/25 ring-1 ring-pink-400/15";
    case "orange":
      return "border-orange-300/25 ring-1 ring-orange-400/15";
    default:
      return "border-emerald-300/20 ring-1 ring-emerald-400/10";
  }
};

export const fontSizeClass = (size: ChatPrefs["font_size"]): string => {
  if (size === "small") return "text-xs";
  if (size === "large") return "text-base";
  return "text-sm";
};
