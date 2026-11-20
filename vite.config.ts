import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from "node:url";
import { componentTagger } from "lovable-tagger";

const localReact = fileURLToPath(new URL("./node_modules/react/index.js", import.meta.url));
const localReactJsxRuntime = fileURLToPath(new URL("./node_modules/react/jsx-runtime.js", import.meta.url));
const localReactJsxDevRuntime = fileURLToPath(new URL("./node_modules/react/jsx-dev-runtime.js", import.meta.url));

function revisionFor(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

const offlinePrecachePlugin: Plugin = {
  name: "tigerchat-offline-precache-manifest",
  apply: "build",
  generateBundle(_options, bundle) {
    const bundledFiles = Object.keys(bundle)
      .filter((file) => file !== "sw.js" && /\.(?:js|css|woff2?|png|jpe?g|svg|webp|ico|mp3|ogg)$/i.test(file))
      .map((file) => "/" + file)
      .sort();
    const staticFiles = [
      "/", "/index.html", "/manifest.json", "/favicon.ico",
      "/pwa-icon-192.png", "/pwa-icon-512.png", "/placeholder.svg",
      "/firebase-messaging-sw.js", "/assets/coca-cola-cap.png", "/assets/pepsi-cap.png",
    ];
    const serviceWorker = bundle["sw.js"];
    const workerSource = serviceWorker?.type === "asset" ? String(serviceWorker.source) : "";
    const normalizedWorker = workerSource.replace(
      /const CACHE_NAME = "[^"]+";/,
      'const CACHE_NAME = "__BUILD_REVISION__";',
    );
    const revision = revisionFor([...bundledFiles, normalizedWorker].join("|"));
    this.emitFile({
      type: "asset",
      fileName: "precache-manifest-" + revision + ".json",
      source: JSON.stringify([...new Set([...staticFiles, ...bundledFiles])]),
    });
    if (serviceWorker?.type === "asset") {
      serviceWorker.source = workerSource
        .replace(/const CACHE_NAME = "[^"]+";/, "const CACHE_NAME = \"tigerchats-offline-" + revision + "\";")
        .replace("__PRECACHE_MANIFEST__", "/precache-manifest-" + revision + ".json");
    }
  },
};

export default defineConfig(({ mode }) => ({
  server: { host: "::", port: 8080, hmr: { overlay: false } },
  plugins: [react(), mode === "development" && componentTagger(), offlinePrecachePlugin].filter(Boolean),
  resolve: {
    alias: [
      { find: /^react$/, replacement: localReact },
      { find: /^react\/jsx-runtime$/, replacement: localReactJsxRuntime },
      { find: /^react\/jsx-dev-runtime$/, replacement: localReactJsxDevRuntime },
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
    ],
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    preserveSymlinks: false,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/recharts/") || id.includes("/node_modules/d3-") ||
              id.includes("/node_modules/victory-vendor/") || id.includes("/node_modules/internmap/")) return "charts";
          if (id.includes("/node_modules/firebase/") || id.includes("/node_modules/@firebase/")) return "firebase";
        },
      },
    },
  },
  optimizeDeps: { include: ["react", "react-dom/client", "@tanstack/react-query"], force: true },
}));
