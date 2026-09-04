import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

/* ── Theme helpers ── */
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

/* التصميم الرسمي للتطبيق فاتح دائمًا */
applyTheme("light");

/* ── Listen to parent iframe theme messages ── */
const handleMessage = (event: MessageEvent) => {
  if (event.data?.type === "THEME_CHANGE") {
    // التطبيق يستخدم الوضع الفاتح فقط
    applyTheme("light");
  }
};
window.addEventListener("message", handleMessage);

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
