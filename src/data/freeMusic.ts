// 20 free-to-use Mixkit preview tracks. Tracks remain hosted by Mixkit under its Stock Music Free License.
export interface FreeTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  duration: number;
  mood: "Happy" | "Sad" | "Love" | "Motivation";
  kind: "Instrumental" | "Choir / vocal";
  source: "Mixkit";
}

const mixkit = (file: string) => "https://assets.mixkit.co/music/preview/" + file;

export const FREE_TRACKS: FreeTrack[] = [
  // Happy — 5
  { id: "happy-1", title: "Feeling Happy", artist: "Ahjay Stelino", duration: 148, mood: "Happy", kind: "Instrumental", source: "Mixkit", url: mixkit("mixkit-feeling-happy-5.mp3") },
  { id: "happy-2", title: "Happy Home", artist: "Michael Ramir C.", duration: 110, mood: "Happy", kind: "Instrumental", source: "Mixkit", url: mixkit("mixkit-happy-home-801.mp3") },
  { id: "happy-3", title: "A Very Happy Christmas", artist: "Michael Ramir C.", duration: 130, mood: "Happy", kind: "Instrumental", source: "Mixkit", url: mixkit("mixkit-a-very-happy-christmas-897.mp3") },
  { id: "happy-4", title: "Raising Me Higher", artist: "Ahjay Stelino", duration: 98, mood: "Happy", kind: "Instrumental", source: "Mixkit", url: mixkit("mixkit-raising-me-higher-34.mp3") },
  { id: "happy-5", title: "Dance with Me", artist: "Ahjay Stelino", duration: 142, mood: "Happy", kind: "Instrumental", source: "Mixkit", url: mixkit("mixkit-dance-with-me-3.mp3") },

  // Sad — 5
  { id: "sad-1", title: "Silent Descent", artist: "Eugenio Mininni", duration: 160, mood: "Sad", kind: "Instrumental", source: "Mixkit", url: mixkit("mixkit-silent-descent-614.mp3") },
  { id: "sad-2", title: "Sun and His Daughter", artist: "Eugenio Mininni", duration: 168, mood: "Sad", kind: "Choir / vocal", source: "Mixkit", url: mixkit("mixkit-sun-and-his-daughter-580.mp3") },
  { id: "sad-3", title: "Sleepy Cat", artist: "Alejandro Magaña", duration: 119, mood: "Sad", kind: "Instrumental", source: "Mixkit", url: mixkit("mixkit-sleepy-cat-135.mp3") },
  { id: "sad-4", title: "Life is a Dream", artist: "Mixkit", duration: 99, mood: "Sad", kind: "Instrumental", source: "Mixkit", url: mixkit("mixkit-life-is-a-dream-837.mp3") },
  { id: "sad-5", title: "Valley Sunset", artist: "Alejandro Magaña", duration: 134, mood: "Sad", kind: "Instrumental", source: "Mixkit", url: mixkit("mixkit-valley-sunset-127.mp3") },

  // Love / Romantic — 5
  { id: "love-1", title: "Beautiful Dream", artist: "Diego Nava", duration: 97, mood: "Love", kind: "Instrumental", source: "Mixkit", url: mixkit("mixkit-beautiful-dream-493.mp3") },
  { id: "love-2", title: "Romantic", artist: "Francisco Alvear", duration: 159, mood: "Love", kind: "Instrumental", source: "Mixkit", url: mixkit("mixkit-romantic-659.mp3") },
  { id: "love-3", title: "Love is Eternal", artist: "Ahjay Stelino", duration: 94, mood: "Love", kind: "Instrumental", source: "Mixkit", url: mixkit("mixkit-love-is-eternal-37.mp3") },
  { id: "love-4", title: "Serene View", artist: "Arulo", duration: 114, mood: "Love", kind: "Instrumental", source: "Mixkit", url: mixkit("mixkit-serene-view-443.mp3") },
  { id: "love-5", title: "Latin Lovers", artist: "Ahjay Stelino", duration: 95, mood: "Love", kind: "Instrumental", source: "Mixkit", url: mixkit("mixkit-latin-lovers-39.mp3") },

  // Motivation — 5
  { id: "motivation-1", title: "Driving Ambition", artist: "Ahjay Stelino", duration: 102, mood: "Motivation", kind: "Instrumental", source: "Mixkit", url: mixkit("mixkit-driving-ambition-32.mp3") },
  { id: "motivation-2", title: "Hip Hop 02", artist: "Lily J", duration: 115, mood: "Motivation", kind: "Instrumental", source: "Mixkit", url: mixkit("mixkit-hip-hop-02-738.mp3") },
  { id: "motivation-3", title: "Tech House Vibes", artist: "Mixkit", duration: 102, mood: "Motivation", kind: "Instrumental", source: "Mixkit", url: mixkit("mixkit-tech-house-vibes-130.mp3") },
  { id: "motivation-4", title: "Deep Urban", artist: "Arulo", duration: 289, mood: "Motivation", kind: "Instrumental", source: "Mixkit", url: mixkit("mixkit-deep-urban-623.mp3") },
  { id: "motivation-5", title: "Getting Ready", artist: "Mixkit", duration: 101, mood: "Motivation", kind: "Instrumental", source: "Mixkit", url: mixkit("mixkit-getting-ready-46.mp3") },
];
