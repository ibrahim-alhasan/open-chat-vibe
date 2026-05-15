import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const saved = localStorage.getItem("theme") || "dark";
document.documentElement.classList.add(saved);

const observer = new MutationObserver(() => {
  const theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
  localStorage.setItem("theme", theme);
  window.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
});
observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

createRoot(document.getElementById("root")!).render(<App />);
