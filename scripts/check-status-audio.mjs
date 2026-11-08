import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/data/freeMusic.ts", import.meta.url), "utf8");
const tracks = [...source.matchAll(/id: "([^"]+)", title: "([^"]+)"[^\n]*mood: "(Happy|Sad|Love|Motivation)"[^\n]*url: mixkit\("([^"]+)"\)/g)]
  .map((match) => ({ id: match[1], title: match[2], mood: match[3], url: "https://assets.mixkit.co/music/preview/" + match[4] }));

const expected = { Happy: 5, Sad: 5, Love: 5, Motivation: 5 };
const counts = Object.fromEntries(Object.keys(expected).map((mood) => [mood, tracks.filter((track) => track.mood === mood).length]));
if (tracks.length !== 20 || new Set(tracks.map((track) => track.url)).size !== 20 ||
    Object.entries(expected).some(([mood, count]) => counts[mood] !== count)) {
  throw new Error("Status music catalog must contain 20 unique tracks with exactly five per mood. Found: " + JSON.stringify(counts));
}

async function checkTrack(track) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    let response = await fetch(track.url, { method: "HEAD", redirect: "follow", signal: controller.signal });
    if (response.status === 405 || response.status === 403) {
      response = await fetch(track.url, { method: "GET", headers: { Range: "bytes=0-0" }, redirect: "follow", signal: controller.signal });
      await response.body?.cancel();
    }
    if (!response.ok) throw new Error("HTTP " + response.status);
    const type = response.headers.get("content-type") || "";
    if (type && !type.includes("audio") && !type.includes("octet-stream")) {
      throw new Error("Unexpected content type " + type);
    }
    return { id: track.id, ok: true };
  } catch (error) {
    return { id: track.id, ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

const results = [];
for (let i = 0; i < tracks.length; i += 4) {
  results.push(...await Promise.all(tracks.slice(i, i + 4).map(checkTrack)));
}
const failed = results.filter((result) => !result.ok);
console.log("Checked " + results.length + " Mixkit tracks:", JSON.stringify(counts));
if (failed.length) {
  console.error("Unavailable status tracks:", JSON.stringify(failed));
  process.exitCode = 1;
} else {
  console.log("All 20 status music URLs responded successfully.");
}
