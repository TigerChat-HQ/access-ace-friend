import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Messaging registration is owned by firebase-push after user consent.
// Never unregister Firebase on startup: published apps also use lovable.app.
const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
