import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// CSS is now loaded (import above is synchronous in the bundled output).
// Reveal content by adding css-ready — this disables the FOUC guard in index.html.
document.documentElement.classList.add("css-ready");

createRoot(document.getElementById("root")!).render(<App />);
