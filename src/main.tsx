import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register Service Worker for PWA Add to Home Screen & push notifications
if (
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  window.location.protocol.startsWith("http") &&
  !window.frameElement
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // SW registered successfully
      })
      .catch((err) => {
        console.warn("ServiceWorker registration skipped or failed:", err);
      });
  });
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
