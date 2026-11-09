import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/data/freeMusic.ts", import.meta.url), "utf8");
const tracks = [...source.matchAll(/\{\s*id:\s*"([^"]+)"[^\n]*mood:\s*"(Happy|Sad|Love|Motivation)"[^\n]*url:\s*"(https:\/\/[^"]+)"[^\n]*\}/g)]
  .map((match) => ({ id: match[1], mood: match[2], url: match[3] }));

const expected = { Happy: 5, Sad: 5, Love: 5, Motivation: 5 };
const counts = Object.fromEntries(Object.keys(expected).map((mood) => [mood, tracks.filter((track) => track.mood === mood).length]));
const ids = tracks.map((track) => track.id);
const urls = tracks.map((track) => track.url);

if (tracks.length !== 20 ||
    new Set(ids).size !== 20 ||
    new Set(urls).size !== 20 ||
    Object.entries(expected).some(([mood, count]) => counts[mood] !== count)) {
  throw new Error("Status music catalog must contain 20 unique tracks with five per mood. Found: " + JSON.stringify(counts));
}

for (const track of tracks) {
  const url = new URL(track.url);
  if (url.protocol !== "https:" || url.hostname !== "en.freepd.cn" || !url.pathname.startsWith("/api/music/")) {
    throw new Error("Invalid FreePD audio URL for " + track.id);
  }
}

console.log("Status music catalog validated without external network calls:", JSON.stringify(counts));
