// Curated royalty-free background tracks (Pixabay / public CDN — no key required)
export interface FreeTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  duration: number; // seconds
  mood: string;
}

export const FREE_TRACKS: FreeTrack[] = [
  { id: "lofi-1", title: "Lofi Chill", artist: "Pixabay", duration: 142, mood: "Sad",
    url: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3" },
  { id: "vibes-1", title: "Good Vibes", artist: "Pixabay", duration: 100, mood: "Happy",
    url: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3" },
  { id: "cinema-1", title: "Cinematic Atmosphere", artist: "Pixabay", duration: 168, mood: "Motivation",
    url: "https://cdn.pixabay.com/download/audio/2022/10/30/audio_347eba5811.mp3" },
  { id: "dance-1", title: "Powerful Beat", artist: "Pixabay", duration: 122, mood: "Happy",
    url: "https://cdn.pixabay.com/download/audio/2022/08/04/audio_2dde668d05.mp3" },
  { id: "ambient-1", title: "Dreamy Ambient", artist: "Pixabay", duration: 165, mood: "Love",
    url: "https://cdn.pixabay.com/download/audio/2022/11/22/audio_febc508520.mp3" },
  { id: "guitar-1", title: "Acoustic Guitar", artist: "Pixabay", duration: 142, mood: "Love",
    url: "https://cdn.pixabay.com/download/audio/2022/03/10/audio_99fc832300.mp3" },
  { id: "trap-1", title: "Trap Drift", artist: "Pixabay", duration: 130, mood: "Motivation",
    url: "https://cdn.pixabay.com/download/audio/2023/02/28/audio_550d875f4f.mp3" },
  { id: "rock-1", title: "Rock Energy", artist: "Pixabay", duration: 154, mood: "Energetic",
    url: "https://cdn.pixabay.com/download/audio/2022/09/26/audio_72b5ad58cb.mp3" },
];
