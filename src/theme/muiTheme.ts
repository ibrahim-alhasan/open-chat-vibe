import { createTheme, type Theme } from "@mui/material/styles";

export const ANDROID_FONT_STACK = [
  "Roboto",
  "Noto Sans Arabic",
  "-apple-system",
  "BlinkMacSystemFont",
  "Segoe UI",
  "Helvetica Neue",
  "Arial",
  "sans-serif",
].join(", ");

/** Material Design 3 palette tuned to the app's green identity. */
const palettes = {
  light: {
    primary: "#008069",
    primaryContainer: "#a7f3e0",
    surface: "#f7faf8",
    surfaceVariant: "#ffffff",
    background: "#efeae2",
    onSurface: "#151d1a",
    outline: "#c9d3cf",
  },
  dark: {
    primary: "#00a884",
    primaryContainer: "#075045",
    surface: "#202c33",
    surfaceVariant: "#25333b",
    background: "#0b141a",
    onSurface: "#e6ebe9",
    outline: "#2f4048",
  },
} as const;

export const buildAndroidTheme = (mode: "light" | "dark"): Theme => {
  const p = palettes[mode];

  return createTheme({
    direction: "rtl",
    palette: {
      mode,
      primary: { main: p.primary, contrastText: "#ffffff" },
      secondary: { main: p.primaryContainer },
      background: { default: p.background, paper: p.surface },
      text: { primary: p.onSurface },
      divider: p.outline,
    },
    shape: { borderRadius: 16 },
    typography: {
      fontFamily: ANDROID_FONT_STACK,
      // Material 3 type scale
      h6: { fontSize: "1.125rem", fontWeight: 500, letterSpacing: "0.0125em" },
      subtitle1: { fontSize: "1rem", fontWeight: 500, letterSpacing: "0.009em" },
      subtitle2: { fontSize: "0.875rem", fontWeight: 500, letterSpacing: "0.007em" },
      body1: { fontSize: "0.9375rem", letterSpacing: "0.0107em" },
      body2: { fontSize: "0.8125rem", letterSpacing: "0.0178em" },
      caption: { fontSize: "0.75rem", letterSpacing: "0.0333em" },
      button: { fontWeight: 500, letterSpacing: "0.0892em", textTransform: "none" },
    },
    components: {
      MuiButtonBase: { defaultProps: { disableRipple: false } },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: 999, paddingInline: 20, minHeight: 40 } },
      },
      MuiIconButton: { styleOverrides: { root: { borderRadius: 999 } } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
      MuiAppBar: {
        defaultProps: { elevation: 0, color: "primary" },
        styleOverrides: { root: { boxShadow: "0 1px 3px rgba(0,0,0,.24)" } },
      },
      MuiDialog: { styleOverrides: { paper: { borderRadius: 28 } } },
      MuiTooltip: { styleOverrides: { tooltip: { borderRadius: 8, fontSize: "0.75rem" } } },
    },
  });
};
