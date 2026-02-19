import { Reply, CornerUpLeft } from "lucide-react";

import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Message {
  id: string;
  username: string;
  content: string;
  reply_to: string | null;
  reply_to_username: string | null;
  reply_to_content: string | null;
  created_at: string;
  avatar_url?: string | null;
}

export interface Reaction {
  id: string;
  message_id: string;
  username: string;
  emoji: string;
}

interface ChatMessageProps {
  message: Message;
  currentUsername: string;
  currentAvatarUrl?: string | null;
  reactions: Reaction[];
  profilesMap: Record<string, string | null>;
  onReply: (message: Message) => void;
}

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

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

const getInitials = (username: string) => username.slice(0, 2).toUpperCase();

const ChatMessage = ({
  message,
  currentUsername,
  currentAvatarUrl,
  reactions,
  profilesMap,
  onReply,
}: ChatMessageProps) => {
  const isOwn = message.username === currentUsername;
  const userColor = getUserColor(message.username);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const timeAgo = formatDistanceToNow(new Date(message.created_at), {
    addSuffix: true,
    locale: ar,
  });

  // Get avatar: own messages use currentAvatarUrl, others use profilesMap
  const avatarUrl = isOwn ? currentAvatarUrl : profilesMap[message.username];

  // Group reactions by emoji
  const reactionGroups = reactions.reduce<Record<string, Reaction[]>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = [];
    acc[r.emoji].push(r);
    return acc;
  }, {});

  const handleReaction = async (emoji: string) => {
    setShowEmojiPicker(false);
    const existing = reactions.find(
      (r) => r.emoji === emoji && r.username === currentUsername
    );
    if (existing) {
      // Toggle off
      await supabase.from("reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("reactions").insert({
        message_id: message.id,
        username: currentUsername,
        emoji,
      });
    }
  };

  return (
    <div className={`flex gap-3 group animate-fade-in ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      {avatarUrl ? (
        <img
          src={avatarUrl}
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

        {/* Bubble + action buttons */}
        <div className="relative">
          {/* Clickable bubble */}
          <div
            onClick={() => setShowEmojiPicker((v) => !v)}
            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed break-words cursor-pointer select-none transition-opacity active:opacity-70 ${
              isOwn ? "rounded-tr-sm chat-bubble-own" : "rounded-tl-sm chat-bubble-other"
            }`}
            style={{ direction: "rtl", textAlign: "right" }}
          >
            {message.content}
          </div>

          {/* Emoji picker (appears above the bubble) */}
          {showEmojiPicker && (
            <div
              className={`absolute -top-12 flex gap-1 p-2 rounded-2xl z-20 animate-fade-in ${
                isOwn ? "right-0" : "left-0"
              }`}
              style={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                boxShadow: "0 8px 32px hsl(220 16% 4% / 0.6)",
              }}
            >
              {EMOJIS.map((emoji) => {
                const myReaction = reactions.find(
                  (r) => r.emoji === emoji && r.username === currentUsername
                );
                return (
                  <button
                    key={emoji}
                    onClick={(e) => { e.stopPropagation(); handleReaction(emoji); }}
                    className="w-9 h-9 flex items-center justify-center rounded-xl text-lg transition-all hover:scale-125 active:scale-90"
                    style={{
                      background: myReaction ? "hsl(var(--primary) / 0.2)" : "transparent",
                      border: myReaction ? "1px solid hsl(var(--primary) / 0.4)" : "1px solid transparent",
                    }}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          )}

          {/* Reply button (on hover) */}
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

        {/* Reactions display */}
        {Object.keys(reactionGroups).length > 0 && (
          <div className={`flex flex-wrap gap-1 px-1 ${isOwn ? "justify-end" : "justify-start"}`}>
            {Object.entries(reactionGroups).map(([emoji, group]) => {
              const myReaction = group.find((r) => r.username === currentUsername);
              return (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all hover:scale-105 active:scale-95"
                  style={{
                    background: myReaction
                      ? "hsl(var(--primary) / 0.2)"
                      : "hsl(var(--secondary))",
                    border: myReaction
                      ? "1px solid hsl(var(--primary) / 0.5)"
                      : "1px solid hsl(var(--border))",
                    color: "hsl(var(--foreground))",
                  }}
                >
                  <span>{emoji}</span>
                  <span>{group.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
