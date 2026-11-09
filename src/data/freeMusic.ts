// FreePD music tracks are released under CC0 / public-domain terms.
export interface FreeTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  duration: number;
  mood: "Happy" | "Sad" | "Love" | "Motivation";
  kind: "Instrumental" | "Whistling / voice";
  source: "FreePD CC0";
}

export const FREE_TRACKS: FreeTrack[] = [
  // Happy — 5
  { id: "happy-1", title: "City Sunshine", artist: "FreePD", duration: 180, mood: "Happy", kind: "Instrumental", source: "FreePD CC0", url: "https://en.freepd.cn/api/music/5570626561742f436974792053756e7368696e652e6d7033" },
  { id: "happy-2", title: "Funshine", artist: "FreePD", duration: 180, mood: "Happy", kind: "Instrumental", source: "FreePD CC0", url: "https://en.freepd.cn/api/music/5570626561742f46756e7368696e652e6d7033" },
  { id: "happy-3", title: "Happy Whistling Ukulele", artist: "FreePD", duration: 180, mood: "Happy", kind: "Whistling / voice", source: "FreePD CC0", url: "https://en.freepd.cn/api/music/5570626561742f48617070792057686973746c696e6720556b756c656c652e6d7033" },
  { id: "happy-4", title: "Motions", artist: "FreePD", duration: 180, mood: "Happy", kind: "Instrumental", source: "FreePD CC0", url: "https://en.freepd.cn/api/music/5570626561742f4d6f74696f6e732e6d7033" },
  { id: "happy-5", title: "Inspiration", artist: "FreePD", duration: 180, mood: "Happy", kind: "Instrumental", source: "FreePD CC0", url: "https://en.freepd.cn/api/music/5570626561742f496e737069726174696f6e2e6d7033" },

  // Sad — 5
  { id: "sad-1", title: "2017 12 01 in C Major", artist: "FreePD", duration: 180, mood: "Sad", kind: "Instrumental", source: "FreePD CC0", url: "https://en.freepd.cn/api/music/5a6f6e65642f3230313720313220303120696e2043204d616a6f722e6d7033" },
  { id: "sad-2", title: "2017 12 02 in D Minor", artist: "FreePD", duration: 180, mood: "Sad", kind: "Instrumental", source: "FreePD CC0", url: "https://en.freepd.cn/api/music/5a6f6e65642f3230313720313220303220696e2044204d696e6f722e6d7033" },
  { id: "sad-3", title: "2017 12 04 in A Minor", artist: "FreePD", duration: 180, mood: "Sad", kind: "Instrumental", source: "FreePD CC0", url: "https://en.freepd.cn/api/music/5a6f6e65642f3230313720313220303420696e2041204d696e6f722e6d7033" },
  { id: "sad-4", title: "2017 12 05 in Ab Major", artist: "FreePD", duration: 180, mood: "Sad", kind: "Instrumental", source: "FreePD CC0", url: "https://en.freepd.cn/api/music/5a6f6e65642f3230313720313220303520696e204162204d616a6f722e6d7033" },
  { id: "sad-5", title: "A Turn for the Worse", artist: "FreePD", duration: 180, mood: "Sad", kind: "Instrumental", source: "FreePD CC0", url: "https://en.freepd.cn/api/music/5a6f6e65642f41205475726e20666f722074686520576f7273652e6d7033" },

  // Love / Romantic — 5
  { id: "love-1", title: "Lovely Piano Song", artist: "FreePD", duration: 180, mood: "Love", kind: "Instrumental", source: "FreePD CC0", url: "https://en.freepd.cn/api/music/526f6d616e63652f4c6f76656c79205069616e6f20536f6e672e6d7033" },
  { id: "love-2", title: "Night in Venice", artist: "FreePD", duration: 180, mood: "Love", kind: "Instrumental", source: "FreePD CC0", url: "https://en.freepd.cn/api/music/526f6d616e63652f4e6967687420696e2056656e6963652e6d7033" },
  { id: "love-3", title: "Landra's Dream", artist: "FreePD", duration: 180, mood: "Love", kind: "Instrumental", source: "FreePD CC0", url: "https://en.freepd.cn/api/music/526f6d616e63652f4c616e647261277320447265616d2e6d7033" },
  { id: "love-4", title: "Champ de tournesol", artist: "FreePD", duration: 180, mood: "Love", kind: "Instrumental", source: "FreePD CC0", url: "https://en.freepd.cn/api/music/526f6d616e63652f4368616d7020646520746f75726e65736f6c2e6d7033" },
  { id: "love-5", title: "La Citadelle", artist: "FreePD", duration: 180, mood: "Love", kind: "Instrumental", source: "FreePD CC0", url: "https://en.freepd.cn/api/music/526f6d616e63652f4c61204369746164656c6c652e6d7033" },

  // Motivation — 5
  { id: "motivation-1", title: "Adventure", artist: "FreePD", duration: 180, mood: "Motivation", kind: "Instrumental", source: "FreePD CC0", url: "https://en.freepd.cn/api/music/457069632f416476656e747572652e6d7033" },
  { id: "motivation-2", title: "Adventures of Flying Jack", artist: "FreePD", duration: 180, mood: "Motivation", kind: "Instrumental", source: "FreePD CC0", url: "https://en.freepd.cn/api/music/457069632f416476656e7475726573206f6620466c79696e67204a61636b2e6d7033" },
  { id: "motivation-3", title: "Battle Ready", artist: "FreePD", duration: 180, mood: "Motivation", kind: "Instrumental", source: "FreePD CC0", url: "https://en.freepd.cn/api/music/457069632f426174746c652052656164792e6d7033" },
  { id: "motivation-4", title: "Beyond — Part 2", artist: "FreePD", duration: 180, mood: "Motivation", kind: "Instrumental", source: "FreePD CC0", url: "https://en.freepd.cn/api/music/457069632f4265796f6e64202d207061727420322e6d7033" },
  { id: "motivation-5", title: "Cornfield Chase", artist: "FreePD", duration: 180, mood: "Motivation", kind: "Instrumental", source: "FreePD CC0", url: "https://en.freepd.cn/api/music/457069632f436f726e6669656c642043686173652e6d7033" },
];
