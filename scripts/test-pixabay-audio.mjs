import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const candidates = [
  "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3",
  "https://cdn.pixabay.com/download/audio/2023/02/09/audio_3a7b04f698.mp3?filename=aesthetics-138637.mp3",
  "https://cdn.pixabay.com/download/audio/2022/10/16/audio_ffa3e91f8b.mp3?filename=close-study-relax-chillhop-calm-study-lofi-123089.mp3"
];
for (const url of candidates) {
  try {
    const { stdout } = await execFileAsync("curl", ["--location","--silent","--show-error","--fail","--max-time","20","--range","0-0","--output","/dev/null","--write-out","%{http_code}",url]);
    console.log(stdout.trim(), url);
  } catch (error) {
    console.log("FAILED", error instanceof Error ? error.message : String(error), url);
    process.exitCode = 1;
  }
}
