export const CHAT_EMOJIS = ["😀","😂","🥰","😍","😘","😎","🤩","🥳","😭","😡","😮","🤔","👏","🔥","❤️","💯","👍","👎","🙏","💪","🐯","🎉","💔","✨"];
export const CHAT_EMOJI_SOUND_KEY = "tigerchat:emoji-sounds";

// Real short recordings hosted on Wikimedia Commons (public-domain / openly licensed files).
const REAL_EMOJI_AUDIO: Record<string, string> = {
  "😀": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Laughter.ogg",
  "😂": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Laughter.ogg",
  "🥰": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Hm_and_sigh.ogg",
  "😍": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Hm_and_sigh.ogg",
  "😘": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Hm_and_sigh.ogg",
  "😎": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Human_whistling.ogg",
  "🤩": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Hurray.ogg",
  "🥳": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Hurray.ogg",
  "😭": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Euh_2.ogg",
  "😡": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Ohhh_ahhh.ogg",
  "😮": "https://commons.wikimedia.org/wiki/Special:Redirect/file/En-us-gasped.ogg",
  "🤔": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Hm_and_sigh.ogg",
  "👏": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Applause_ii.ogg",
  "🔥": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Ohhh_ahhh.ogg",
  "❤️": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Hm_and_sigh.ogg",
  "💯": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Applause_ii.ogg",
  "👍": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Hurray.ogg",
  "👎": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Euh_2.ogg",
  "🙏": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Hm_and_sigh.ogg",
  "💪": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Hurray.ogg",
  "🐯": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Tiger_Mad.ogg",
  "🎉": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Hurray.ogg",
  "💔": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Euh_2.ogg",
  "✨": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Human_whistling.ogg",
};

let activeEmojiAudio: HTMLAudioElement | null = null;
let stopTimer: number | null = null;

export function playChatEmojiSound(emoji: string) {
  if (typeof window === "undefined") return;
  const symbol = Array.from(emoji.trim()).find((item) => REAL_EMOJI_AUDIO[item]);
  const source = symbol ? REAL_EMOJI_AUDIO[symbol] : REAL_EMOJI_AUDIO["😮"];
  if (!source) return;

  if (stopTimer !== null) window.clearTimeout(stopTimer);
  if (activeEmojiAudio) {
    activeEmojiAudio.pause();
    activeEmojiAudio.currentTime = 0;
  }

  const audio = new Audio(source);
  activeEmojiAudio = audio;
  audio.preload = "auto";
  audio.volume = 0.9;
  audio.addEventListener("ended", () => {
    if (activeEmojiAudio === audio) activeEmojiAudio = null;
    if (stopTimer !== null) window.clearTimeout(stopTimer);
    stopTimer = null;
  }, { once: true });

  void audio.play().then(() => {
    stopTimer = window.setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
      if (activeEmojiAudio === audio) activeEmojiAudio = null;
      stopTimer = null;
    }, 3000);
  }).catch(() => {
    // Browsers may block automatic sound until the user has interacted with the page.
  });
}
