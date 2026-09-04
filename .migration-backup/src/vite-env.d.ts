/// <reference types="vite/client" />

declare global {
  interface Window {
    AppInventor?: {
      setWebViewString?: (message: string) => void;
    };
  }
}

export {};
