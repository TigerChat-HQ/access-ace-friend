import { chmod, mkdir, mkdtemp, rm, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const version = "4.4.1";
const root = process.cwd();
const projectDir = resolve(root, "public/games/tiger-city-3d/project");
const outputDir = resolve(root, "public/games/tiger-city-3d");
const installDir = join(tmpdir(), "godot-" + version);
const templateDir = join(process.env.HOME || tmpdir(), ".local/share/godot/export_templates", version + ".stable");
const editorZip = join(installDir, "godot.zip");
const templatesZip = join(installDir, "templates.tpz");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status}`);
}

async function download(url, destination) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) throw new Error(`Download failed (${response.status}): ${url}`);
  await pipeline(Readable.fromWeb(response.body), (await import("node:fs")).createWriteStream(destination));
}

if (!existsSync(projectDir)) throw new Error("Godot game source folder is missing: " + projectDir);
await mkdir(installDir, { recursive: true });
await mkdir(templateDir, { recursive: true });
console.log("Downloading Godot " + version + " editor and Web export templates...");
await download(`https://github.com/godotengine/godot/releases/download/${version}-stable/Godot_v${version}-stable_linux.x86_64.zip`, editorZip);
await download(`https://github.com/godotengine/godot/releases/download/${version}-stable/Godot_v${version}-stable_export_templates.tpz`, templatesZip);
run("unzip", ["-q", "-o", editorZip, "-d", installDir]);
const templateExtract = join(installDir, "template-extract");
await mkdir(templateExtract, { recursive: true });
run("unzip", ["-q", "-o", templatesZip, "-d", templateExtract]);
const extractedTemplates = join(templateExtract, "templates");
if (!existsSync(extractedTemplates)) throw new Error("Godot export template archive did not contain templates/");
for (const entry of (await (await import("node:fs/promises")).readdir(extractedTemplates))) {
  const source = join(extractedTemplates, entry);
  const target = join(templateDir, entry);
  run("cp", ["-a", source, target]);
}
const godotBin = join(installDir, `Godot_v${version}-stable_linux.x86_64`);
await chmod(godotBin, 0o755);
console.log("Importing and validating TIGER CITY 3D...");
run(godotBin, ["--headless", "--editor", "--path", projectDir, "--quit"]);
console.log("Exporting single-threaded WebGL game into TigerChat public assets...");
run(godotBin, ["--headless", "--path", projectDir, "--export-release", "Web", join(outputDir, "index.html")]);
console.log("TIGER CITY 3D Web export completed.");
await rm(installDir, { recursive: true, force: true });
