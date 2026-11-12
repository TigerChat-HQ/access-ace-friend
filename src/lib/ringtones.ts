export type RingtoneKind = "incoming_call" | "incoming_sms";

export const ringtoneOptions = [
  { id: "pulse", label: "Pulse" },
  { id: "classic", label: "Classic Bell" },
  { id: "spark", label: "Spark" },
  { id: "twinkle", label: "Twinkle" },
  { id: "siren", label: "Siren" },
  { id: "campus", label: "Campus Chime" },
  { id: "echo", label: "Echo" },
  { id: "soft", label: "Soft Pop" },
  { id: "vibe", label: "Vibe" },
  { id: "alert", label: "Alert" },
] as const;

export type RingtoneId = (typeof ringtoneOptions)[number]["id"];

const patterns: Record<RingtoneId, { notes: number[]; gap: number }> = {
  pulse: { notes: [440, 660, 440], gap: 0.26 },
  classic: { notes: [523.25, 587.33, 659.25, 783.99], gap: 0.22 },
  spark: { notes: [660, 880, 990, 660], gap: 0.18 },
  twinkle: { notes: [659.25, 783.99, 880, 1046.5], gap: 0.2 },
  siren: { notes: [220, 330, 220, 330], gap: 0.18 },
  campus: { notes: [392, 523.25, 659.25], gap: 0.24 },
  echo: { notes: [440, 440, 660, 660], gap: 0.22 },
  soft: { notes: [293.66, 392, 349.23], gap: 0.27 },
  vibe: { notes: [392, 523.25, 698.46, 523.25], gap: 0.25 },
  alert: { notes: [830.61, 415.3, 830.61], gap: 0.18 },
};

const defaults: Record<RingtoneKind, RingtoneId> = {
  incoming_call: "pulse",
  incoming_sms: "spark",
};

export const getStoredRingtone = (kind: RingtoneKind): RingtoneId => {
  if (typeof window === "undefined") return defaults[kind];
  const stored = window.localStorage.getItem(`tiger-ringtone-${kind}`);
  return ringtoneOptions.some((option) => option.id === stored)
    ? (stored as RingtoneId)
    : defaults[kind];
};

export const setStoredRingtone = (kind: RingtoneKind, value: RingtoneId) => {
  if (typeof window !== "undefined") window.localStorage.setItem(`tiger-ringtone-${kind}`, value);
};

// Plays one short, synthesized tone pattern. No bundled audio assets are required.
export const playRingtone = (kind: RingtoneKind): (() => void) => {
  if (typeof window === "undefined") return () => {};
  const AudioContextConstructor =
    window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return () => {};

  const { notes, gap } = patterns[getStoredRingtone(kind)];
  let context: AudioContext;
  try {
    context = new AudioContextConstructor();
  } catch {
    return () => {};
  }

  const gain = context.createGain();
  gain.gain.value = 0.0001;
  gain.connect(context.destination);
  const startAt = context.currentTime + 0.03;

  notes.forEach((frequency, index) => {
    const at = startAt + index * gap;
    const oscillator = context.createOscillator();
    oscillator.type = index % 2 === 0 ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.connect(gain);
    gain.gain.setValueAtTime(0.12, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
    oscillator.start(at);
    oscillator.stop(at + 0.17);
  });

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    void context.close().catch(() => {});
  };
};


// Caller-side ringback tone: the familiar paired low/high "duuuuh" sound.
export const playRingbackTone = (): (() => void) => {
  if (typeof window === "undefined") return () => {};
  const AudioContextConstructor =
    window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return () => {};
  let context: AudioContext;
  try { context = new AudioContextConstructor(); } catch { return () => {}; }
  void context.resume().catch(() => {});
  const startAt = context.currentTime + 0.04;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.10, startAt + 0.08);
  gain.gain.setValueAtTime(0.10, startAt + 1.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 1.25);
  gain.connect(context.destination);
  [440, 480].forEach((frequency) => {
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startAt);
    oscillator.connect(gain);
    oscillator.start(startAt);
    oscillator.stop(startAt + 1.27);
  });
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    void context.close().catch(() => {});
  };
};
