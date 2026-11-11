import { useEffect, useState } from "react";
import { Check, RotateCcw, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ChatPrefs } from "@/hooks/useChatPreferences";
import { getGlobalChatPreferences, resetGlobalChatPreferences, saveGlobalChatPreferences } from "@/lib/chat-global-preferences";
import { cn } from "@/lib/utils";

const wallpapers = [
  { key: "default", label: "Classic", className: "bg-background" },
  { key: "tiger", label: "Tiger", className: "chat-wallpaper-tiger bg-gradient-to-br from-black via-orange-950/70 to-black" },
  { key: "neon", label: "Neon", className: "bg-gradient-to-br from-emerald-900 via-black to-purple-900" },
  { key: "ocean", label: "Ocean", className: "bg-gradient-to-br from-blue-900 to-cyan-800" },
  { key: "black-car", label: "Sports car", className: "chat-wallpaper-car bg-gradient-to-br from-black to-slate-900" },
  { key: "black-lion", label: "Lion", className: "chat-wallpaper-lion bg-gradient-to-br from-black to-amber-950" },
  { key: "black-wolf", label: "Wolf", className: "chat-wallpaper-wolf bg-gradient-to-br from-black to-blue-950" },
  { key: "black-eagle", label: "Eagle", className: "chat-wallpaper-eagle bg-gradient-to-br from-black to-zinc-900" },
  { key: "sunset", label: "Sunset", className: "bg-gradient-to-br from-orange-700 via-pink-800 to-purple-950" },
  { key: "light", label: "Light", className: "bg-zinc-100" },
];

const colors = [
  { key: "primary", label: "Tiger green", className: "bg-primary" },
  { key: "blue", label: "Blue", className: "bg-blue-500" },
  { key: "purple", label: "Purple", className: "bg-purple-500" },
  { key: "pink", label: "Pink", className: "bg-pink-500" },
  { key: "orange", label: "Orange", className: "bg-orange-500" },
];

const defaults: ChatPrefs = { wallpaper: "default", bubble_color: "primary", font_size: "medium", theme: "default", muted_until: null };

export const ChatAppearanceSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<ChatPrefs>(defaults);

  useEffect(() => {
    if (user?.id) setPrefs({ ...defaults, ...getGlobalChatPreferences(user.id) });
  }, [user?.id]);

  const update = (patch: Partial<ChatPrefs>) => {
    if (!user?.id) return;
    const next = saveGlobalChatPreferences(user.id, patch);
    setPrefs({ ...defaults, ...next });
    toast({ title: "Default chat appearance saved", description: "New chats will use these settings. Existing chats keep their individual themes." });
  };

  const reset = () => {
    if (!user?.id) return;
    resetGlobalChatPreferences(user.id);
    setPrefs(defaults);
    toast({ title: "Chat appearance reset", description: "Default TigerChat appearance restored." });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Sparkles className="h-4 w-4 text-primary" /> Messenger + WhatsApp style</div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Set default wallpapers, message bubble colors and text size for your conversations. You can still customize each chat separately from its chat menu.</p>
      </div>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Chat wallpaper</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {wallpapers.map((wallpaper) => {
            const selected = (prefs.wallpaper || "default") === wallpaper.key;
            return (
              <button key={wallpaper.key} type="button" onClick={() => update({ wallpaper: wallpaper.key })}
                aria-pressed={selected}
                className={cn("relative h-20 overflow-hidden rounded-xl border-2 text-xs font-semibold text-white", wallpaper.className, selected ? "border-primary ring-2 ring-primary/30" : "border-border/60")}>
                <span className="absolute inset-0 flex items-end justify-between bg-black/20 p-2">
                  <span className="drop-shadow">{wallpaper.label}</span>
                  {selected && <Check className="h-4 w-4" />}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-foreground">My message bubble color</h3>
        <div className="flex flex-wrap gap-3">
          {colors.map((color) => {
            const selected = (prefs.bubble_color || "primary") === color.key;
            return <button key={color.key} type="button" onClick={() => update({ bubble_color: color.key })}
              aria-label={color.label} aria-pressed={selected}
              className={cn("flex h-11 w-11 items-center justify-center rounded-full text-white", color.className, selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background")}>
              {selected && <Check className="h-5 w-5" />}
            </button>;
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Message text size</h3>
        <div className="grid grid-cols-3 gap-2">
          {(["small", "medium", "large"] as const).map((size) => (
            <button key={size} type="button" onClick={() => update({ font_size: size })}
              aria-pressed={prefs.font_size === size}
              className={cn("rounded-xl border px-3 py-3 text-sm capitalize", prefs.font_size === size ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-surface-hover")}>
              {size === "small" ? "Small" : size === "medium" ? "Medium" : "Large"}
            </button>
          ))}
        </div>
      </section>

      <button type="button" onClick={reset} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-surface-hover hover:text-foreground">
        <RotateCcw className="h-4 w-4" /> Reset chat appearance
      </button>
    </div>
  );
};
