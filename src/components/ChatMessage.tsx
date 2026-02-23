import { Reply, CornerUpLeft, Trash2, Check } from "lucide-react";
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
  isAdmin?: boolean;
  isCurrentUserAdmin?: boolean;
  onReply: (message: Message) => void;
  onUsernameClick?: (userId: string) => void;
  onDelete?: (messageId: string) => void;
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

// شارة التوثيق المحسنة - علامة صح زرقاء في دائرة
const VerifiedBadge = () => (
  <svg>
    <path d="M20.396 11c.745-.765.745-2.066 0-2.831l-1.09-1.12.354-1.52c.254-1.092-.59-2.138-1.692-2.098l-1.566.057-.63-1.437C15.322 1.01 14.1.573 13.17 1.156l-1.32.827-1.32-.827C9.6.573 8.378 1.01 7.928 2.051l-.63 1.437-1.566-.057c-1.102-.04-1.946 1.006-1.692 2.098l.354 1.52-1.09 1.12c-.745.765-.745 2.066 0 2.831l1.09 1.12-.354 1.52c-.254 1.092.59 2.138 1.692 2.098l1.566-.057.63 1.437c.45 1.041 1.672 1.478 2.602.895l1.32-.827 1.32.827c.93.583 2.152.146 2.602-.895l.63-1.437 1.566.057c1.102.04 1.946-1.006 1.692-2.098l-.354-1.52 1.09-1.12z" fill="#1D9BF0"/>
    <path d="M9.585 14.929l-3.28-3.28 1.168-1.168 2.112 2.112 5.048-5.048 1.168 1.168-6.216 6.216z" fill="white"/>
  </svg>
);

const ChatMessage = ({
  message,
  currentUserId,
  currentUsername,
  currentAvatarUrl,
  reactions,
  profilesMap,
  isOnline,
  isAdmin,
  isCurrentUserAdmin,
  onReply,
  onUsernameClick,
  onDelete,
}: ChatMessageProps) => {
  const isOwn = message.user_id === currentUserId;
  const profile = message.user_id && profilesMap[message.user_id];
  const displayName = profile ? profile.username : message.username;
  const avatarUrl = isOwn ? currentAvatarUrl : (profile ? profile.avatar_url : null);
  const userColor = isAdmin ? "#1D9BF0" : getUserColor(displayName);
  
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [showReplyIndicator, setShowReplyIndicator] = useState(false);
  
  const messageRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; time: number } | null>(null);
  const isClickOnButtonRef = useRef(false);

  const timeAgo = formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: ar });

  const canDelete = isOwn || isCurrentUserAdmin;

  const reactionGroups = reactions.reduce<Record<string, Reaction[]>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = [];
    acc[r.emoji].push(r);
    return acc;
  }, {});

  const handleReaction = async (emoji: string) => {
    setShowEmojiPicker(false);
    setShowActionsMenu(false);
    const existing = reactions.find((r) => r.emoji === emoji && r.username === currentUsername);
    if (existing) {
      await supabase.from("reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("reactions").insert({ message_id: message.id, username: currentUsername, emoji });
    }
  };

  const handleDelete = async () => {
    if (!canDelete || !onDelete) return;
    setShowActionsMenu(false);
    onDelete(message.id);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (messageRef.current && !messageRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
        setShowActionsMenu(false);
      }
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

  const handleBubbleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setShowActionsMenu(!showActionsMenu);
    setShowEmojiPicker(false);
  };

  return (
    <div
      ref={messageRef}
      className={`flex gap-3 group animate-fade-in relative ${isOwn ? "flex-row-reverse" : "flex-row"}`}
      onMouseLeave={handleMouseLeave}
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
          cursor: isSwiping ? 'grabbing' : 'pointer',
        }}
      >
        {showReplyIndicator && (
          <div className="absolute -right-12 top-1/2 transform -translate-y-1/2 flex items-center gap-1 text-primary animate-pulse" style={{ direction: 'ltr' }}>
            <Reply className="w-4 h-4" />
            <span className="text-xs font-medium">رد</span>
          </div>
        )}

        {/* Username & time with verified badge */}
     
<div className={`flex items-center gap-2 px-1 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
  <div className="flex items-center gap-1.5">
    <span
      className={`text-xs font-semibold ${!isOwn && !isAdmin ? "cursor-pointer hover:underline" : ""}`}
      style={{ color: userColor }}
      onClick={() => !isOwn && onUsernameClick && message.user_id && onUsernameClick(message.user_id)}
    >
      {isOwn ? "أنت" : displayName}
    </span>
    {isAdmin && <VerifiedBadge />}
  </div>
  <span className="text-xs" style={{ color: "hsl(var(--chat-timestamp))" }}>{timeAgo}</span>
</div>

        {/* Reply preview */}
        {message.reply_to && message.reply_to_username && (
          <div
            className={`px-3 py-2 rounded-lg text-xs flex items-start gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"} cursor-pointer`}
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

        {/* Message bubble */}
        <div className="relative w-full">
          <div
            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed break-words select-none ${isOwn ? "rounded-tr-sm chat-bubble-own" : "rounded-tl-sm chat-bubble-other"} ${isSwiping ? 'opacity-80' : ''} cursor-pointer active:brightness-90 transition-all`}
            style={{ 
              direction: "rtl", 
              textAlign: "right", 
              boxShadow: isSwiping ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
            }}
            onClick={handleBubbleClick}
          >
            {message.content}
          </div>

          {/* Actions popup - fixed above message */}
          {showActionsMenu && (
            <div 
              className="absolute left-0 right-0 z-[9999] animate-fade-in pointer-events-none"
              style={{ bottom: "calc(100% + 8px)" }}
            >
              <div className="flex justify-center">
                <div 
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-2xl pointer-events-auto"
                  style={{ 
                    background: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))", 
                    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                  }}
                >
                  {/* Quick emoji reactions */}
                  {EMOJIS.slice(0, 4).map((emoji) => {
                    const myReaction = reactions.find((r) => r.emoji === emoji && r.username === currentUsername);
                    return (
                      <button
                        key={emoji}
                        onClick={(e) => { e.stopPropagation(); handleReaction(emoji); }}
                        className="w-9 h-9 flex items-center justify-center rounded-xl text-base transition-all hover:scale-125 active:scale-90"
                        style={{
                          background: myReaction ? "hsl(var(--primary) / 0.2)" : "transparent",
                        }}
                      >
                        {emoji}
                      </button>
                    );
                  })}
                  
                  {/* More emojis button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(true); setShowActionsMenu(false); }}
                    className="w-9 h-9 flex items-center justify-center rounded-xl text-xs transition-all hover:scale-110"
                    style={{ background: "hsl(var(--secondary))" }}
                  >
                    <span className="text-base">➕</span>
                  </button>
                  
                  {/* Divider */}
                  <div className="w-px h-6 mx-0.5" style={{ background: "hsl(var(--border))" }} />
                  
                  {/* Reply */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onReply(message); setShowActionsMenu(false); }}
                    className="w-9 h-9 flex items-center justify-center rounded-xl transition-all hover:scale-110"
                    style={{ background: "hsl(var(--secondary))" }}
                    title="رد"
                  >
                    <Reply className="w-4 h-4" style={{ color: "hsl(var(--muted-foreground))" }} />
                  </button>
                  
                  {/* Delete */}
                  {canDelete && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                      className="w-9 h-9 flex items-center justify-center rounded-xl transition-all hover:scale-110"
                      style={{ background: "hsl(var(--destructive) / 0.15)" }}
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" style={{ color: "hsl(var(--destructive))" }} />
                    </button>
                  )}
                </div>
              </div>
              
              {/* Arrow pointing down to message */}
              <div className="flex justify-center">
                <div 
                  className="w-3 h-3 rotate-45 -mt-1.5 pointer-events-auto"
                  style={{ 
                    background: "hsl(var(--card))",
                    borderRight: "1px solid hsl(var(--border))",
                    borderBottom: "1px solid hsl(var(--border))",
                  }}
                />
              </div>
            </div>
          )}

          {/* Full Emoji picker */}
          {showEmojiPicker && (
            <div
              className="absolute left-0 right-0 z-[9999] animate-fade-in pointer-events-none"
              style={{ bottom: "calc(100% + 8px)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center">
                <div 
                  className="flex gap-1 p-2 rounded-2xl pointer-events-auto"
                  style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}
                >
                  {EMOJIS.map((emoji) => {
                    const myReaction = reactions.find((r) => r.emoji === emoji && r.username === currentUsername);
                    return (
                      <button
                        key={emoji}
                        onClick={(e) => { e.stopPropagation(); handleReaction(emoji); }}
                        className="w-10 h-10 flex items-center justify-center rounded-xl text-lg transition-all hover:scale-125 active:scale-90"
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
              </div>
              <div className="flex justify-center">
                <div 
                  className="w-3 h-3 rotate-45 -mt-1.5 pointer-events-auto"
                  style={{ 
                    background: "hsl(var(--card))",
                    borderRight: "1px solid hsl(var(--border))",
                    borderBottom: "1px solid hsl(var(--border))",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Reactions display */}
        {Object.keys(reactionGroups).length > 0 && (
          <div className={`flex flex-wrap gap-1 px-1 mt-1 animate-fade-in ${isOwn ? "justify-end" : "justify-start"}`}>
            {Object.entries(reactionGroups).map(([emoji, group]) => {
              const myReaction = group.find((r) => r.username === currentUsername);
              return (
                <button
                  key={emoji}
                  onClick={(e) => { e.stopPropagation(); handleReaction(emoji); }}
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
