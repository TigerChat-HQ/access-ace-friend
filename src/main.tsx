import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register the app service worker for standalone production hosting.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
