import { useState } from "react";
import { MessageCircle, X, Maximize2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Site-wide floating entry point to the full TigerChat experience.
 * The embedded route uses the same authenticated web app and existing chat UI.
 */
export const FloatingChatWidget = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // The embedded chat route hides this launcher to prevent recursive iframes.
  if (location.search.includes("bubble=1")) return null;

  const openFullChat = () => {
    setOpen(false);
    navigate("/chats");
  };

  return (
    <>
      {open && (
        <section
          aria-label="TigerChat floating chat"
          className="fixed z-[100] flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl"
          style={{
            right: "max(12px, env(safe-area-inset-right, 0px))",
            bottom: "calc(88px + env(safe-area-inset-bottom, 0px))",
            width: "min(430px, calc(100vw - 24px))",
            height: "min(680px, calc(var(--tiger-viewport-height, 100dvh) - 112px))",
          }}
        >
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/70 bg-card px-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <MessageCircle className="h-4 w-4" />
              </span>
              TigerChat
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={openFullChat}
                aria-label="Open chats page"
                title="Open full chats"
                className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close floating chat"
                className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>
          <iframe
            title="TigerChat conversations"
            src="/chats?bubble=1"
            className="min-h-0 w-full flex-1 border-0 bg-background"
            allow="camera; microphone; display-capture; geolocation"
          />
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Close TigerChat" : "Open TigerChat"}
        aria-expanded={open}
        className="fixed z-[101] flex h-14 w-14 items-center justify-center rounded-full border border-primary-foreground/20 bg-primary text-primary-foreground shadow-[0_8px_30px_hsl(var(--primary)/0.4)] transition-transform duration-200 hover:scale-105 active:scale-95"
        style={{
          right: "max(16px, env(safe-area-inset-right, 0px))",
          bottom: "calc(18px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open && <span className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-background bg-emerald-400" />}
      </button>
    </>
  );
};
