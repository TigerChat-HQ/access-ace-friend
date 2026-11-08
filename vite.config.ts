import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from "node:url";
import { componentTagger } from "lovable-tagger";

const localReact = fileURLToPath(new URL("./node_modules/react/index.js", import.meta.url));
const localReactJsxRuntime = fileURLToPath(new URL("./node_modules/react/jsx-runtime.js", import.meta.url));
const localReactJsxDevRuntime = fileURLToPath(new URL("./node_modules/react/jsx-dev-runtime.js", import.meta.url));

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
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
  optimizeDeps: {
    include: ["react", "react-dom/client", "@tanstack/react-query"],
    force: true,
  },
}));
