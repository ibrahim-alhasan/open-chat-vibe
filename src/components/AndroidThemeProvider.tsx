import { useMemo, type ReactNode } from "react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { useThemeContext } from "@/contexts/ThemeContext";
import { buildAndroidTheme } from "@/theme/muiTheme";

/** Bridges the app theme (light/dark) into Material Design components. */
export const AndroidThemeProvider = ({ children }: { children: ReactNode }) => {
  const { theme } = useThemeContext();
  const muiTheme = useMemo(() => buildAndroidTheme(theme), [theme]);

  return <MuiThemeProvider theme={muiTheme}>{children}</MuiThemeProvider>;
};

export default AndroidThemeProvider;
