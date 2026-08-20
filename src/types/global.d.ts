export {};

declare global {
  interface Window {
    AppInventor?: {
      setWebViewString?: (message: string) => void;
    };
    AppBridge?: {
      removeSplashScreen?: () => void;
    };
  }
}