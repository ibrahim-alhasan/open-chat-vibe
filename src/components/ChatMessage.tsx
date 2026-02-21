import { Reply, CornerUpLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Message {
  id: string;
  username: string;
  user_id?: string | null;
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
  currentUserId: string;
  currentUsername: string;
  currentAvatarUrl?: string | null;
  reactions: Reaction[];
  profilesMap: Record<string, { username: string; avatar_url: string | null }>;
  isOnline?: boolean;
  onReply: (message: Message) => void;
  onUsernameClick?: (userId: string) => void;
}

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

const getUserColor = (username: string) => {
  const colors = [
    "hsl(199, 89%, 55%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 55%)",
    "hsl(280, 65%, 60%)", "hsl(0, 72%, 60%)", "hsl(32, 98%, 55%)",
    "hsl(168, 75%, 42%)", "hsl(220, 80%, 60%)",
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const getInitials = (username: string) => username.slice(0, 2).toUpperCase();

const ChatMessage = ({
  message,
  currentUserId,
  currentUsername,
  currentAvatarUrl,
  reactions,
  profilesMap,
  isOnline,
  onReply,
  onUsernameClick,
}: ChatMessageProps) => {
  const isOwn = message.user_id === currentUserId;
  const profile = message.user_id && profilesMap[message.user_id];
  const displayName = profile ? profile.username : message.username;
  const avatarUrl = isOwn ? currentAvatarUrl : (profile ? profile.avatar_url : null);
  const userColor = getUserColor(displayName);
  
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [showReplyIndicator, setShowReplyIndicator] = useState(false);
  
  const messageRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; time: number } | null>(null);
  const isClickOnButtonRef = useRef(false);

  const timeAgo = formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: ar });

  const reactionGroups = reactions.reduce<Record<string, Reaction[]>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = [];
    acc[r.emoji].push(r);
    return acc;
  }, {});

  const handleReaction = async (emoji: string) => {
    setShowEmojiPicker(false);
    const existing = reactions.find((r) => r.emoji === emoji && r.username === currentUsername);
    if (existing) {
      await supabase.from("reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("reactions").insert({ message_id: message.id, username: currentUsername, emoji });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (messageRef.current && !messageRef.current.contains(event.target as Node)) setShowEmojiPicker(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isSwiping && swipeOffset > 0) {
      const timer = setTimeout(() => { setSwipeOffset(0); setShowReplyIndicator(false); }, 200);
      return () => clearTimeout(timer);
    }
  }, [isSwiping, swipeOffset]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button')) { isClickOnButtonRef.current = true; return; }
    touchStartRef.current = { x: e.touches[0].clientX, time: Date.now() };
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !isSwiping || isClickOnButtonRef.current) return;
    const deltaX = e.touches[0].clientX - touchStartRef.current.x;
    if (deltaX > 0) {
      e.preventDefault();
      const newOffset = Math.min(deltaX, 100);
      setSwipeOffset(newOffset);
      setShowReplyIndicator(newOffset > 30);
    }
  };

  const handleTouchEnd = () => {
    if (isClickOnButtonRef.current) { isClickOnButtonRef.current = false; setIsSwiping(false); return; }
    if (!touchStartRef.current || !isSwiping) { setIsSwiping(false); return; }
    if (swipeOffset > 50 && Date.now() - touchStartRef.current.time < 500) onReply(message);
    touchStartRef.current = null;
    setIsSwiping(false);
    setSwipeOffset(0);
    setShowReplyIndicator(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) { isClickOnButtonRef.current = true; return; }
    e.preventDefault();
    touchStartRef.current = { x: e.clientX, time: Date.now() };
    setIsSwiping(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!touchStartRef.current || !isSwiping || isClickOnButtonRef.current) return;
    const deltaX = e.clientX - touchStartRef.current.x;
    if (deltaX > 0) {
      e.preventDefault();
      const newOffset = Math.min(deltaX, 100);
      setSwipeOffset(newOffset);
      setShowReplyIndicator(newOffset > 30);
    }
  };

  const handleMouseUp = () => {
    if (isClickOnButtonRef.current) { isClickOnButtonRef.current = false; setIsSwiping(false); return; }
    if (!touchStartRef.current || !isSwiping) { setIsSwiping(false); return; }
    if (swipeOffset > 50 && Date.now() - touchStartRef.current.time < 500) onReply(message);
    touchStartRef.current = null;
    setIsSwiping(false);
    setSwipeOffset(0);
    setShowReplyIndicator(false);
  };

  const handleMouseLeave = () => {
    if (isSwiping) {
      touchStartRef.current = null;
      setIsSwiping(false);
      setSwipeOffset(0);
      setShowReplyIndicator(false);
      isClickOnButtonRef.current = false;
    }
  };

  const handleAvatarClick = () => {
    if (!isOwn && onUsernameClick && message.user_id) onUsernameClick(message.user_id);
  };

  return (
    <div
      ref={messageRef}
      className={`flex gap-3 group animate-fade-in ${isOwn ? "flex-row-reverse" : "flex-row"}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); handleMouseLeave(); }}
    >
      {/* Avatar with online indicator */}
      <div className="relative flex-shrink-0 mt-1">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="avatar"
            className={`w-9 h-9 rounded-full object-cover ${!isOwn ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
            style={{ border: `2px solid ${userColor}55` }}
            onClick={handleAvatarClick}
          />
        ) : (
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${!isOwn ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
            style={{ background: `${userColor}22`, border: `2px solid ${userColor}55`, color: userColor }}
            onClick={handleAvatarClick}
          >
            {getInitials(displayName)}
          </div>
        )}
        {/* Online dot */}
        {isOnline && (
          <span
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
            style={{ background: "hsl(var(--chat-online))", borderColor: "hsl(var(--chat-bg))" }}
          />
        )}
      </div>

      {/* Message content with swipe */}
      <div
        className={`max-w-[70%] space-y-1 ${isOwn ? "items-end" : "items-start"} flex flex-col relative`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwiping ? 'none' : 'transform 0.2s ease',
          cursor: isSwiping ? 'grabbing' : 'default',
        }}
      >
        {showReplyIndicator && (
          <div className="absolute -right-12 top-1/2 transform -translate-y-1/2 flex items-center gap-1 text-primary animate-pulse" style={{ direction: 'ltr' }}>
            <Reply className="w-4 h-4" />
            <span className="text-xs font-medium">رد</span>
          </div>
        )}

        {/* Username & time */}
        <div className={`flex items-center gap-2 px-1 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
          <span
            className={`text-xs font-semibold ${!isOwn ? "cursor-pointer hover:underline" : ""}`}
            style={{ color: userColor }}
            onClick={() => !isOwn && onUsernameClick && message.user_id && onUsernameClick(message.user_id)}
          >
            {isOwn ? "أنت" : displayName}
          </span>
          <span className="text-xs" style={{ color: "hsl(var(--chat-timestamp))" }}>{timeAgo}</span>
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

        {/* Bubble + actions */}
        <div className="relative">
          <div
            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed break-words select-none ${isOwn ? "rounded-tr-sm chat-bubble-own" : "rounded-tl-sm chat-bubble-other"} ${isSwiping ? 'opacity-80' : ''}`}
            style={{ direction: "rtl", textAlign: "right", boxShadow: isSwiping ? '0 4px 12px rgba(0,0,0,0.1)' : 'none' }}
          >
            {message.content}
          </div>

          {showEmojiPicker && (
            <div
              className={`absolute -top-12 flex gap-1 p-2 rounded-2xl z-50 animate-fade-in ${isOwn ? "right-0" : "left-0"}`}
              style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "0 8px 32px hsl(220 16% 4% / 0.6)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {EMOJIS.map((emoji) => {
                const myReaction = reactions.find((r) => r.emoji === emoji && r.username === currentUsername);
                return (
                  <button
                    key={emoji}
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleReaction(emoji); }}
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

          {isHovered && !isSwiping && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowEmojiPicker(!showEmojiPicker); }}
                className={`absolute top-1 transition-all duration-150 p-1.5 rounded-lg z-10 ${isOwn ? "-left-8" : "-right-8"}`}
                style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}
                title="تفاعل"
              >
                <span className="text-sm">😊</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); onReply(message); }}
                className={`absolute top-10 transition-all duration-150 p-1.5 rounded-lg z-10 ${isOwn ? "-left-8" : "-right-8"}`}
                style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}
                title="رد"
              >
                <Reply className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Reactions display */}
        {Object.keys(reactionGroups).length > 0 && (
          <div className={`flex flex-wrap gap-1 px-1 ${isOwn ? "justify-end" : "justify-start"} animate-fade-in`}>
            {Object.entries(reactionGroups).map(([emoji, group]) => {
              const myReaction = group.find((r) => r.username === currentUsername);
              return (
                <button
                  key={emoji}
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleReaction(emoji); }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all hover:scale-105 active:scale-95"
                  style={{
                    background: myReaction ? "hsl(var(--primary) / 0.2)" : "hsl(var(--secondary))",
                    border: myReaction ? "1px solid hsl(var(--primary) / 0.5)" : "1px solid hsl(var(--border))",
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
