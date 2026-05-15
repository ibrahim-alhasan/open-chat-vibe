import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Apply theme from localStorage before first render to avoid flash
const savedTheme = localStorage.getItem('theme') ?? 'dark';
document.documentElement.classList.remove('dark', 'light');
document.documentElement.classList.add(savedTheme);
document.documentElement.setAttribute('data-theme', savedTheme);
document.documentElement.style.colorScheme = savedTheme;

// Watch for external theme injections (from Expo WebView)
const observer = new MutationObserver(() => {
  const isDark = document.documentElement.classList.contains('dark');
  const theme = isDark ? 'dark' : 'light';
  document.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
});
observer.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['class', 'data-theme'],
});

createRoot(document.getElementById("root")!).render(<App />);
