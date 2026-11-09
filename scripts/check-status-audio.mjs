import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const source = await readFile(new URL("../src/data/freeMusic.ts", import.meta.url), "utf8");
const tracks = [...source.matchAll(/id: "([^"]+)", title: "([^"]+)"[^\n]*mood: "(Happy|Sad|Love|Motivation)"[^\n]*url: "(https:\/\/en\.freepd\.cn\/api\/music\/[^"]+)"/g)]
  .map((match) => ({ id: match[1], title: match[2], mood: match[3], url: match[4] }));

const expected = { Happy: 5, Sad: 5, Love: 5, Motivation: 5 };
const counts = Object.fromEntries(Object.keys(expected).map((mood) => [mood, tracks.filter((track) => track.mood === mood).length]));
if (tracks.length !== 20 || new Set(tracks.map((track) => track.url)).size !== 20 ||
    Object.entries(expected).some(([mood, count]) => counts[mood] !== count)) {
  throw new Error("Status music catalog must contain 20 unique CC0 tracks with five per mood. Found: " + JSON.stringify(counts));
}

async function checkTrack(track) {
  const headArgs = [
    "--head", "--location", "--silent", "--show-error", "--fail", "--max-time", "15",
    "--output", "/dev/null", "--write-out", "%{http_code}", track.url,
  ];
  try {
    let status;
    try {
      const { stdout } = await execFileAsync("curl", headArgs);
      status = Number(stdout.trim());
    } catch {
      const { stdout } = await execFileAsync("curl", [
        "--location", "--silent", "--show-error", "--fail", "--max-time", "30",
        "--range", "0-0", "--output", "/dev/null", "--write-out", "%{http_code}", track.url,
      ]);
      status = Number(stdout.trim());
    }
    if (status < 200 || status >= 300) throw new Error("HTTP " + status);
    return { id: track.id, ok: true, status };
  } catch (error) {
    return { id: track.id, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

const results = [];
for (let i = 0; i < tracks.length; i += 4) {
  results.push(...await Promise.all(tracks.slice(i, i + 4).map(checkTrack)));
}
const failed = results.filter((result) => !result.ok);
console.log("Checked " + results.length + " FreePD CC0 tracks:", JSON.stringify(counts));
if (failed.length) {
  console.error("Unavailable status tracks:", JSON.stringify(failed));
  process.exitCode = 1;
} else {
  console.log("All 20 CC0 status music URLs responded successfully.");
}
