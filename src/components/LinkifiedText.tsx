import { ExternalLink } from "lucide-react";

const URL_REGEX = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]}>'"'])/g;

interface LinkifiedTextProps {
  text: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const openUrl = (url: string) => {
  const app = (window as any).AppInventor;
  if (app && typeof app.setWebViewString === "function") {
    app.setWebViewString(`open_url|${url}`);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
};

const LinkifiedText = ({ text }: LinkifiedTextProps) => {
  const parts = text.split(URL_REGEX);

  if (parts.length === 1) return <>{text}</>;

  return (
    <>
      {parts.map((part, i) => {
        if (URL_REGEX.test(part)) {
          // Reset lastIndex since we're reusing the regex
          URL_REGEX.lastIndex = 0;
          let displayUrl = part.replace(/^https?:\/\/(www\.)?/, '');
          if (displayUrl.length > 35) displayUrl = displayUrl.slice(0, 35) + '…';

          return (
            <span key={i} className="inline-flex flex-col gap-1 my-1">
              <button
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all hover:scale-[1.02] active:scale-95 break-all"
                style={{
                  background: "hsl(var(--primary) / 0.12)",
                  color: "hsl(var(--primary))",
                  border: "1px solid hsl(var(--primary) / 0.25)",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  openUrl(part);
                }}
              >
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="underline underline-offset-2">{displayUrl}</span>
              </button>
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
};

export default LinkifiedText;
