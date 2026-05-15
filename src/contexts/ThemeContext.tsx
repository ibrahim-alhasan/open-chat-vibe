import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: "dark" });

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const getInitialTheme = () => (document.documentElement.classList.contains("dark") ? "dark" : "light");
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    const handleThemeChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ theme: Theme }>;
      const nextTheme = customEvent?.detail?.theme ?? (document.documentElement.classList.contains("dark") ? "dark" : "light");
      setTheme(nextTheme);
    };

    document.addEventListener("themechange", handleThemeChange);
    return () => document.removeEventListener("themechange", handleThemeChange);
  }, []);

  const value = useMemo(() => ({ theme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeContext = () => useContext(ThemeContext);
