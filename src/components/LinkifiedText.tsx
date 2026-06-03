import { ExternalLink } from "lucide-react";

interface LinkifiedTextProps {
  text: string;
}

// Regex بدون flag g لتجنب مشاكل test() المتكرر
const URL_REGEX = /https?:\/\/[^\s<]+[^\s<.,;:!?)\]}>'"]?/;

const openUrl = (url: string) => {
  const message = `open_url|${url}`;

  const sendMessage = () => {
    if (window.AppInventor && window.AppInventor.setWebViewString) {
      // App Inventor جاهز، أرسل الرسالة
      window.AppInventor.setWebViewString(message);
    } else {
      // أعد المحاولة بعد 50ms حتى يكون جاهز
      setTimeout(sendMessage, 50);
    }
  };

  sendMessage();
};

const LinkifiedText = ({ text }: LinkifiedTextProps) => {
  // نفصل النص على الروابط باستخدام split
  const parts = text.split(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]}>'"]?)/);

  if (parts.length === 1) return <>{text}</>;

  return (
    <>
      {parts.map((part, i) => {
        if (URL_REGEX.test(part)) {
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
