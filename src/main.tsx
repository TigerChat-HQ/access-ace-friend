import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { installGlobalDiagnostics } from "@/lib/diagnostics";

installGlobalDiagnostics();
import "./index.css";

// Register the PWA worker after first paint so installation does not compete
// with React startup and the first screen becoming interactive.
if (
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  window.location.protocol.startsWith("http") &&
  !window.frameElement
) {
  const registerWorker = () => {
    window.setTimeout(() => {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => {
          console.warn("ServiceWorker registration skipped or failed:", err);
        });
    }, 1200);
  };

  if (document.readyState === "complete") {
    registerWorker();
  } else {
    window.addEventListener("load", registerWorker, { once: true });
  }
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
