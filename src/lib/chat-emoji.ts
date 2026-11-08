export const CHAT_EMOJIS = ["😀","😂","🥰","😍","😘","😎","🤩","🥳","😭","😡","😮","🤔","👏","🔥","❤️","💯","👍","👎","🙏","💪","🐯","🎉","💔","✨"];
export const CHAT_EMOJI_SOUND_KEY = "tigerchat:emoji-sounds";

let audioContext: AudioContext | null = null;

export const playChatEmojiSound = (emoji: string) => {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext ||= new AudioContextClass();
    const context = audioContext;
    if (context.state === "suspended") void context.resume();
    const now = context.currentTime;
    const frequencies = emoji.includes("😂") || emoji.includes("😀") || emoji.includes("🥳") || emoji.includes("🎉")
      ? [660, 880, 1046]
      : emoji.includes("❤️") || emoji.includes("🥰") || emoji.includes("😍") || emoji.includes("😘")
      ? [523, 659, 784]
      : emoji.includes("😡") || emoji.includes("💔") || emoji.includes("👎")
      ? [220, 165, 130]
      : emoji.includes("🐯") || emoji.includes("🔥") || emoji.includes("💪")
      ? [392, 587, 784]
      : [440, 554, 659];
    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index === 0 ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.075);
      gain.gain.setValueAtTime(0.0001, now + index * 0.075);
      gain.gain.exponentialRampToValueAtTime(0.075, now + index * 0.075 + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.075 + 0.19);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now + index * 0.075);
      oscillator.stop(now + index * 0.075 + 0.2);
    });
  } catch (error) {
    console.debug("Chat emoji sound unavailable", error);
  }
};
