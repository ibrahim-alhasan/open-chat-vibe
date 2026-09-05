export {};

declare global {
  interface Window {
    AppInventor?: {
      setWebViewString?: (message: string) => void;
    };
    AppBridge?: {
      removeSplashScreen?: () => void;
      getTheme?: () => "dark" | "light" | string;
    };
    __APP_THEME__?: "dark" | "light" | string;
  }
}