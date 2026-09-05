import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

type Theme = "dark" | "light";

const isTheme = (value: unknown): value is Theme => value === "dark" || value === "light";

const getNativeTheme = (): Theme | null => {
  try {
    const bridgeTheme = window.AppBridge?.getTheme?.();
    if (isTheme(bridgeTheme)) return bridgeTheme;
  } catch {
    // The native bridge is unavailable in a normal browser.
  }

  if (isTheme(window.__APP_THEME__)) return window.__APP_THEME__;
  if (isTheme(document.documentElement.dataset.theme)) return document.documentElement.dataset.theme;

  return null;
};

const notifyParentTheme = (theme: "dark" | "light") => {
  try {
    if (window.parent !== window) {
      window.parent.postMessage(
        { type: "THEME_CHANGE", isDarkMode: theme === "dark", theme },
        "*"
      );
    }
  } catch {
    // cross-origin iframe restrictions
  }
};

const applyTheme = (theme: "dark" | "light") => {
  document.documentElement.classList.remove("dark", "light");
  document.documentElement.classList.add(theme);
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem("theme", theme);

  document.dispatchEvent(
    new CustomEvent("themechange", {
      detail: { theme },
    })
  );

  notifyParentTheme(theme);
};

const initialTheme = getNativeTheme()
  ?? (isTheme(localStorage.getItem("theme")) ? localStorage.getItem("theme") as Theme : null)
  ?? (window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light");

applyTheme(initialTheme);

const applyIncomingTheme = (value: unknown, isDarkMode?: unknown) => {
  const nextTheme = isTheme(value) ? value : isDarkMode === true ? "dark" : isDarkMode === false ? "light" : null;
  if (nextTheme) applyTheme(nextTheme);
};

/* ── Listen to the Android WebView theme bridge ── */
const handleMessage = (event: MessageEvent) => {
  if (event.data?.type === "THEME_CHANGE") {
    applyIncomingTheme(event.data.theme, event.data.isDarkMode);
  }
};
window.addEventListener("message", handleMessage);

const handleNativeThemeEvent = (event: Event) => {
  const customEvent = event as CustomEvent<{ theme?: unknown; isDarkMode?: unknown }>;
  applyIncomingTheme(customEvent.detail?.theme, customEvent.detail?.isDarkMode);
};
window.addEventListener("theme-change", handleNativeThemeEvent);

const themeObserver = new MutationObserver(() => {
  const nextTheme = document.documentElement.classList.contains("dark") ? "dark" : "light";
  document.dispatchEvent(
    new CustomEvent("themechange", {
      detail: { theme: nextTheme },
    })
  );
  notifyParentTheme(nextTheme);
});

themeObserver.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["class", "data-theme"],
});

createRoot(document.getElementById("root")!).render(<App />);

/* ── Notify native shell that the app is ready (hide splash screen) ── */
const removeSplashScreen = () => {
  try {
    window.AppBridge?.removeSplashScreen?.();
  } catch {
    // native bridge unavailable
  }
};

if (document.readyState === "complete") {
  removeSplashScreen();
} else {
  window.addEventListener("load", removeSplashScreen, { once: true });
}
