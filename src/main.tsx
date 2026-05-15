import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const savedTheme = (localStorage.getItem("theme") ?? "dark") as "dark" | "light";

document.documentElement.classList.remove("dark", "light");
document.documentElement.classList.add(savedTheme);
document.documentElement.setAttribute("data-theme", savedTheme);
document.documentElement.style.colorScheme = savedTheme;

const themeObserver = new MutationObserver(() => {
  const nextTheme = document.documentElement.classList.contains("dark") ? "dark" : "light";
  document.dispatchEvent(
    new CustomEvent("themechange", {
      detail: { theme: nextTheme },
    })
  );
});

themeObserver.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["class", "data-theme"],
});

createRoot(document.getElementById("root")!).render(<App />);
