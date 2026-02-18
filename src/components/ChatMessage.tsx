import { Reply, CornerUpLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

export interface Message {
  id: string;
  username: string;
  content: string;
  reply_to: string | null;
  reply_to_username: string | null;
  reply_to_content: string | null;
  created_at: string;
}

interface ChatMessageProps {
  message: Message;
  currentUsername: string;
  currentAvatar?: string | null;
  onReply: (message: Message) => void;
}

// Generate a consistent color for a username
const getUserColor = (username: string) => {
  const colors = [
    "hsl(199, 89%, 55%)",
    "hsl(142, 71%, 45%)",
    "hsl(38, 92%, 55%)",
    "hsl(280, 65%, 60%)",
    "hsl(0, 72%, 60%)",
    "hsl(32, 98%, 55%)",
    "hsl(168, 75%, 42%)",
    "hsl(220, 80%, 60%)",
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const getInitials = (username: string) =>
  username.slice(0, 2).toUpperCase();

const ChatMessage = ({ message, currentUsername, currentAvatar, onReply }: ChatMessageProps) => {
  const isOwn = message.username === currentUsername;
  const userColor = getUserColor(message.username);

  const timeAgo = formatDistanceToNow(new Date(message.created_at), {
    addSuffix: true,
    locale: ar,
  });

  return (
    <div
      className={`flex gap-3 group animate-fade-in ${isOwn ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      {isOwn && currentAvatar ? (
        <img
          src={currentAvatar}
          alt="avatar"
          className="w-9 h-9 rounded-full flex-shrink-0 object-cover mt-1"
          style={{ border: `2px solid ${userColor}55` }}
        />
      ) : (
        <div
          className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-1"
          style={{
            background: `${userColor}22`,
            border: `2px solid ${userColor}55`,
            color: userColor,
          }}
        >
          {getInitials(message.username)}
        </div>
      )}

      {/* Message content */}
      <div className={`max-w-[70%] space-y-1 ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
        {/* Username & time */}
        <div className={`flex items-center gap-2 px-1 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
          <span className="text-xs font-semibold" style={{ color: userColor }}>
            {isOwn ? "أنت" : message.username}
          </span>
          <span className="text-xs" style={{ color: "hsl(var(--chat-timestamp))" }}>
            {timeAgo}
          </span>
        </div>

        {/* Reply preview */}
        {message.reply_to && message.reply_to_username && (
          <div
            className={`px-3 py-2 rounded-lg text-xs flex items-start gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
            style={{
              background: "hsl(var(--chat-reply-bg))",
              border: "1px solid hsl(var(--border))",
              borderRight: isOwn ? `2px solid ${getUserColor(message.reply_to_username)}` : undefined,
              borderLeft: !isOwn ? `2px solid ${getUserColor(message.reply_to_username)}` : undefined,
              maxWidth: "100%",
            }}
          >
            <CornerUpLeft className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }} />
            <div className={`min-w-0 ${isOwn ? "text-right" : "text-left"}`}>
              <p className="font-semibold mb-0.5" style={{ color: getUserColor(message.reply_to_username) }}>
                {message.reply_to_username}
              </p>
              <p className="truncate" style={{ color: "hsl(var(--muted-foreground))" }}>
                {message.reply_to_content}
              </p>
            </div>
          </div>
        )}

        {/* Bubble */}
        <div className="relative">
          <div
            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed break-words ${
              isOwn ? "rounded-tr-sm chat-bubble-own" : "rounded-tl-sm chat-bubble-other"
            }`}
            style={{ direction: "rtl", textAlign: "right" }}
          >
            {message.content}
          </div>

          {/* Reply button */}
          <button
            onClick={() => onReply(message)}
            className={`absolute top-1 opacity-0 group-hover:opacity-100 transition-all duration-150 p-1.5 rounded-lg ${
              isOwn ? "-left-8" : "-right-8"
            }`}
            style={{
              background: "hsl(var(--secondary))",
              border: "1px solid hsl(var(--border))",
              color: "hsl(var(--muted-foreground))",
            }}
            title="رد"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
