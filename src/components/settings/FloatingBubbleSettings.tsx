import { useEffect, useState } from "react";

const PREFS_KEY = "tigerchat-floating-bubble-prefs";
const HIDDEN_KEY = "tigerchat-floating-bubble-hidden";
const ENABLED_KEY = "tigerchat-floating-bubble-enabled";
const EVENT_NAME = "tigerchat:bubble-settings-changed";

type BubblePrefs = {
  size: "small" | "normal" | "large";
  color: "primary" | "blue" | "purple" | "orange";
  shape: "circle" | "rounded";
  opacity: 70 | 85 | 100;
  snap: boolean;
};
const DEFAULT_PREFS: BubblePrefs = { size: "normal", color: "primary", shape: "circle", opacity: 100, snap: true };

const readPrefs = (): BubblePrefs => {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") }; }
  catch { return DEFAULT_PREFS; }
};
const emitChange = () => window.dispatchEvent(new Event(EVENT_NAME));

export const FloatingBubbleSettings = () => {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(ENABLED_KEY) !== "false"; } catch { return true; }
  });
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(HIDDEN_KEY) === "true"; } catch { return false; }
  });
  const [prefs, setPrefs] = useState<BubblePrefs>(readPrefs);

  useEffect(() => {
    const sync = () => {
      try {
        setEnabled(localStorage.getItem(ENABLED_KEY) !== "false");
        setHidden(localStorage.getItem(HIDDEN_KEY) === "true");
        setPrefs(readPrefs());
      } catch { /* storage may be unavailable */ }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const updatePrefs = (patch: Partial<BubblePrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* storage may be unavailable */ }
    emitChange();
  };
  const updateEnabled = (value: boolean) => {
    setEnabled(value);
    try { localStorage.setItem(ENABLED_KEY, String(value)); } catch { /* storage may be unavailable */ }
    emitChange();
  };
  const updateHidden = (value: boolean) => {
    setHidden(value);
    try { localStorage.setItem(HIDDEN_KEY, String(value)); } catch { /* storage may be unavailable */ }
    emitChange();
  };
  const reset = () => {
    setPrefs(DEFAULT_PREFS);
    setHidden(false);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(DEFAULT_PREFS));
      localStorage.setItem(HIDDEN_KEY, "false");
    } catch { /* storage may be unavailable */ }
    emitChange();
  };

  return (
    <section className="space-y-3 border-b border-border py-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Floating chat bubble</h3>
        <p className="text-xs text-muted-foreground">Dhibiti bubble yote hapa, bila kufungua menyu yake.</p>
      </div>
      <label className="flex items-center justify-between gap-3">
        <span><span className="block text-sm font-medium text-foreground">Enable bubble</span><span className="text-xs text-muted-foreground">Onyesha au ficha bubble kwenye kurasa zote.</span></span>
        <input type="checkbox" checked={enabled} onChange={(e) => updateEnabled(e.target.checked)} aria-label="Enable floating chat bubble" />
      </label>
      <label className="flex items-center justify-between gap-3">
        <span><span className="block text-sm font-medium text-foreground">Hide bubble</span><span className="text-xs text-muted-foreground">Ficha kwa muda; unaweza kuirudisha hapa.</span></span>
        <input type="checkbox" checked={hidden} disabled={!enabled} onChange={(e) => updateHidden(e.target.checked)} aria-label="Hide floating chat bubble" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-muted-foreground">Size
          <select value={prefs.size} onChange={(e) => updatePrefs({ size: e.target.value as BubblePrefs["size"] })} className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm text-foreground">
            <option value="small">Small</option><option value="normal">Normal</option><option value="large">Large</option>
          </select>
        </label>
        <label className="text-xs text-muted-foreground">Color
          <select value={prefs.color} onChange={(e) => updatePrefs({ color: e.target.value as BubblePrefs["color"] })} className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm text-foreground">
            <option value="primary">Theme</option><option value="blue">Blue</option><option value="purple">Purple</option><option value="orange">Orange</option>
          </select>
        </label>
        <label className="text-xs text-muted-foreground">Shape
          <select value={prefs.shape} onChange={(e) => updatePrefs({ shape: e.target.value as BubblePrefs["shape"] })} className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm text-foreground">
            <option value="circle">Circle</option><option value="rounded">Rounded</option>
          </select>
        </label>
        <label className="text-xs text-muted-foreground">Opacity
          <select value={String(prefs.opacity)} onChange={(e) => updatePrefs({ opacity: Number(e.target.value) as BubblePrefs["opacity"] })} className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm text-foreground">
            <option value="100">100%</option><option value="85">85%</option><option value="70">70%</option>
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs text-foreground">
        <input type="checkbox" checked={prefs.snap} onChange={(e) => updatePrefs({ snap: e.target.checked })} />
        Snap to nearest screen edge after dragging
      </label>
      {typeof window !== "undefined" && typeof window.TigerNative?.openMessageBubbleSettings === "function" && <button type="button" onClick={() => window.TigerNative?.openMessageBubbleSettings?.()} className="w-full rounded-lg border border-border px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-muted">Manage Android system notification bubbles…</button>}
      <button type="button" onClick={reset} className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted">Reset bubble settings</button>
    </section>
  );
};
