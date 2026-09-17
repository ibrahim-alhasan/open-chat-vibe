const MATERIAL_WEB_SCRIPTS = [
  {
    tagName: "md-icon-button",
    src: "https://cdn.jsdelivr.net/npm/@material/web@2.3.0/iconbutton/icon-button.js",
  },
  {
    tagName: "md-filled-icon-button",
    src: "https://cdn.jsdelivr.net/npm/@material/web@2.3.0/iconbutton/filled-icon-button.js",
  },
] as const;

/**
 * Loads Material Web as browser-native components without changing the host
 * app's package or build configuration. The CSS fallback remains active until
 * the custom element is defined, and also covers offline/native WebView usage.
 */
export const loadMaterialWeb = async (): Promise<void> => {
  if (typeof document === "undefined") return;

  await Promise.all(
    MATERIAL_WEB_SCRIPTS.map(({ tagName, src }) => {
      if (customElements.get(tagName)) return Promise.resolve();

      const existingScript = document.querySelector<HTMLScriptElement>(
        `script[data-material-web="${tagName}"]`,
      );
      if (existingScript) {
        return customElements.whenDefined(tagName).then(() => undefined);
      }

      return new Promise<void>((resolve) => {
        const script = document.createElement("script");
        script.type = "module";
        script.src = src;
        script.dataset.materialWeb = tagName;
        script.onload = () => resolve();
        script.onerror = () => resolve();
        document.head.appendChild(script);
      });
    }),
  );
};