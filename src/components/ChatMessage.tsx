import { Reply, CornerUpLeft, Trash2, MoreVertical } from "lucide-react";
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

// مكون شارة التوثيق المدورة بـ 10 سنون حادة
const VerifiedBadge = () => (
  <div className="relative flex items-center justify-center">
    <svg 
      width="20" 
      height="20" 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* دائرة خارجية للتأطير */}
      <circle cx="12" cy="12" r="11" fill="#0A66C2" stroke="white" strokeWidth="1.5"/>
      
      {/* 10 سنون حادة داخل الدائرة */}
      <path 
        d="M12 3L13.5 7L17.5 7.5L14.5 10.5L15.5 14.5L12 12.5L8.5 14.5L9.5 10.5L6.5 7.5L10.5 7L12 3Z" 
        fill="white" 
        opacity="0.9"
      />
      
      {/* سنون إضافية للوصول لـ 10 سنون */}
      <path 
        d="M12 5L13 8L16 8.5L14 11L14.5 14L12 12.5L9.5 14L10 11L8 8.5L11 8L12 5Z" 
        fill="white" 
        opacity="0.7"
      />
      
      {/* علامة الصح في المنتصف */}
      <path 
        d="M9 12L11 14L16 9" 
        stroke="#0A66C2" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  </div>
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
  const userColor = isAdmin ? "#0A66C2" : getUserColor(displayName);
  
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

  // Handle message click to show three dots
  const handleMessageClick = (e: React.MouseEvent) => {
    // Don't show if clicking on a button or interactive element
    if ((e.target as HTMLElement).closest('button')) return;
    
    // Toggle actions menu on message click
    setShowActionsMenu(!showActionsMenu);
    
    // Hide emoji picker if open
    setShowEmojiPicker(false);
  };

  // Actions menu that appears above the message
  const renderActionsMenu = () => (
    <div 
      className="absolute left-1/2 transform -translate-x-1/2 z-[9999] animate-fade-in"
      style={{
        bottom: "calc(100% + 8px)", // فوق الرسالة مباشرة
      }}
    >
      <div 
        className="flex gap-2 p-2 rounded-2xl"
        style={{ 
          background: "hsl(var(--card))", 
          border: "1px solid hsl(var(--border))", 
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowEmojiPicker(true); setShowActionsMenu(false); }}
          className="flex items-center justify-center w-10 h-10 rounded-xl hover:scale-110 transition-all"
          style={{ background: "hsl(var(--secondary))" }}
          title="تفاعل"
        >
          <span className="text-lg">😊</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onReply(message); setShowActionsMenu(false); }}
          className="flex items-center justify-center w-10 h-10 rounded-xl hover:scale-110 transition-all"
          style={{ background: "hsl(var(--secondary))" }}
          title="رد"
        >
          <Reply className="w-5 h-5" style={{ color: "hsl(var(--muted-foreground))" }} />
        </button>
        {canDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDelete(); setShowActionsMenu(false); }}
            className="flex items-center justify-center w-10 h-10 rounded-xl hover:scale-110 transition-all"
            style={{ background: "hsl(var(--destructive) / 0.15)" }}
            title="حذف"
          >
            <Trash2 className="w-5 h-5" style={{ color: "hsl(var(--destructive))" }} />
          </button>
        )}
      </div>
      
      {/* سهم صغير يشير للأسفل نحو الرسالة */}
      <div 
        className="absolute left-1/2 transform -translate-x-1/2 w-3 h-3 rotate-45"
        style={{ 
          background: "hsl(var(--card))",
          borderRight: "1px solid hsl(var(--border))",
          borderBottom: "1px solid hsl(var(--border))",
          bottom: "-6px",
        }}
      />
    </div>
  );

  return (
    <div
      ref={messageRef}
      className={`flex gap-3 group animate-fade-in relative ${isOwn ? "flex-row-reverse" : "flex-row"}`}
      onMouseLeave={() => { handleMouseLeave(); }}
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
          <div className="flex items-center gap-1">
            {isAdmin ? (
              <>
                <span
                  className="text-xs font-semibold flex items-center gap-1"
                  style={{ color: "#0A66C2" }}
                  onClick={() => !isOwn && onUsernameClick && message.user_id && onUsernameClick(message.user_id)}
                >
                  {isOwn ? "أنت" : displayName}
                </span>
                {/* شارة التوثيق المدورة بـ 10 سنون حادة */}
                <VerifiedBadge />
              </>
            ) : (
              <span
                className={`text-xs font-semibold ${!isOwn ? "cursor-pointer hover:underline" : ""}`}
                style={{ color: userColor }}
                onClick={() => !isOwn && onUsernameClick && message.user_id && onUsernameClick(message.user_id)}
              >
                {isOwn ? "أنت" : displayName}
              </span>
            )}
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
            onClick={handleMessageClick}
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
          {/* Main message bubble - Clickable to show actions */}
          <div
            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed break-words select-none ${isOwn ? "rounded-tr-sm chat-bubble-own" : "rounded-tl-sm chat-bubble-other"} ${isSwiping ? 'opacity-80' : ''} cursor-pointer hover:brightness-95 transition-all`}
            style={{ 
              direction: "rtl", 
              textAlign: "right", 
              boxShadow: isSwiping ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
            }}
            onClick={handleMessageClick}
          >
            {message.content}
          </div>

          {/* ثلاث نقاط - تظهر فقط عند الضغط على الرسالة */}
          {showActionsMenu && (
            <button
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowActionsMenu(false); }}
              className="absolute -top-8 left-1/2 transform -translate-x-1/2 p-1.5 rounded-full z-[9998] animate-fade-in"
              style={{ 
                background: "hsl(var(--card))", 
                border: "1px solid hsl(var(--border))",
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              }}
            >
              <MoreVertical className="w-4 h-4" style={{ color: "hsl(var(--muted-foreground))" }} />
            </button>
          )}

          {/* Emoji picker - Floating above with high z-index */}
          {showEmojiPicker && (
            <div
              className={`absolute left-1/2 transform -translate-x-1/2 z-[9999] animate-fade-in`}
              style={{
                bottom: "calc(100% + 60px)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div 
                className="flex gap-1 p-2 rounded-2xl"
                style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}
              >
                {EMOJIS.map((emoji) => {
                  const myReaction = reactions.find((r) => r.emoji === emoji && r.username === currentUsername);
                  return (
                    <button
                      key={emoji}
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleReaction(emoji); }}
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
              <div 
                className="absolute left-1/2 transform -translate-x-1/2 w-3 h-3 rotate-45"
                style={{ 
                  background: "hsl(var(--card))",
                  borderRight: "1px solid hsl(var(--border))",
                  borderBottom: "1px solid hsl(var(--border))",
                  bottom: "-6px",
                }}
              />
            </div>
          )}

          {/* Actions menu - يظهر فوق الرسالة مع z-index عالي جداً */}
          {showActionsMenu && renderActionsMenu()}
        </div>

        {/* Reactions display - تحت الرسالة */}
        {Object.keys(reactionGroups).length > 0 && (
          <div className={`flex flex-wrap gap-1 px-1 mt-1 animate-fade-in ${
            isOwn ? "justify-end" : "justify-start"
          }`}>
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
