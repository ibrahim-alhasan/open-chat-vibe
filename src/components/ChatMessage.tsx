import { Reply, CornerUpLeft, Trash2, ShieldCheck, MoreVertical } from "lucide-react";
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

// مكون شارة التوثيق المسننة
const VerifiedBadge = () => (
  <div className="relative flex items-center justify-center">
    <svg 
      width="18" 
      height="18" 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* الخلفية المسننة */}
      <path 
        d="M12 2L14.5 7.5L20.5 8.5L16.5 13L17.5 19L12 16L6.5 19L7.5 13L3.5 8.5L9.5 7.5L12 2Z" 
        fill="#1DA1F2"
        stroke="white"
        strokeWidth="1.5"
        style={{ 
          filter: "drop-shadow(0 2px 4px rgba(29, 161, 242, 0.3))"
        }}
      />
      {/* علامة الصح */}
      <path 
        d="M9 12L11 14L15 10" 
        stroke="white" 
        strokeWidth="2.5" 
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
  const userColor = isAdmin ? "#1DA1F2" : getUserColor(displayName);
  
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
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
    setShowMobileActions(false);
    const existing = reactions.find((r) => r.emoji === emoji && r.username === currentUsername);
    if (existing) {
      await supabase.from("reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("reactions").insert({ message_id: message.id, username: currentUsername, emoji });
    }
  };

  const handleDelete = async () => {
    if (!canDelete || !onDelete) return;
    setShowMobileActions(false);
    onDelete(message.id);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (messageRef.current && !messageRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
        setShowMobileActions(false);
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

  // Mobile actions menu - يظهر بجانب الرسالة
  const renderMobileActions = () => (
    <div 
      className={`absolute z-50 flex flex-col gap-2 p-2 rounded-2xl animate-fade-in ${
        isOwn ? "left-full ml-2" : "right-full mr-2"
      } top-0`}
      style={{ 
        background: "hsl(var(--card))", 
        border: "1px solid hsl(var(--border))", 
        boxShadow: "0 8px 32px hsl(220 16% 4% / 0.6)",
        minWidth: "120px"
      }}
    >
      <button
        onClick={() => { setShowMobileActions(false); setShowEmojiPicker(true); }}
        className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-secondary/50 transition-all"
      >
        <span className="text-lg">😊</span>
        <span className="text-sm font-medium">تفاعل</span>
      </button>
      <button
        onClick={() => { setShowMobileActions(false); onReply(message); }}
        className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-secondary/50 transition-all"
      >
        <Reply className="w-4 h-4" style={{ color: "hsl(var(--muted-foreground))" }} />
        <span className="text-sm font-medium">رد</span>
      </button>
      {canDelete && (
        <button
          onClick={() => { setShowMobileActions(false); handleDelete(); }}
          className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-destructive/10 transition-all"
        >
          <Trash2 className="w-4 h-4" style={{ color: "hsl(var(--destructive))" }} />
          <span className="text-sm font-medium" style={{ color: "hsl(var(--destructive))" }}>حذف</span>
        </button>
      )}
    </div>
  );

  return (
    <div
      ref={messageRef}
      className={`flex gap-3 group animate-fade-in relative ${isOwn ? "flex-row-reverse" : "flex-row"}`}
      onMouseEnter={() => {}}
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
          cursor: isSwiping ? 'grabbing' : 'default',
        }}
      >
        {showReplyIndicator && (
          <div className="absolute -right-12 top-1/2 transform -translate-y-1/2 flex items-center gap-1 text-primary animate-pulse" style={{ direction: 'ltr' }}>
            <Reply className="w-4 h-4" />
            <span className="text-xs font-medium">رد</span>
          </div>
        )}

        {/* Username & time with modern verified badge */}
        <div className={`flex items-center gap-2 px-1 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
          <div className="flex items-center gap-1">
            {isAdmin ? (
              <>
                <span
                  className="text-xs font-semibold flex items-center gap-1"
                  style={{ color: "#1DA1F2" }}
                  onClick={() => !isOwn && onUsernameClick && message.user_id && onUsernameClick(message.user_id)}
                >
                  {isOwn ? "أنت" : displayName}
                </span>
                {/* شارة التوثيق المسننة */}
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

        {/* Message bubble with actions integrated */}
        <div className="relative w-full">
          {/* Main message bubble */}
          <div
            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed break-words select-none ${isOwn ? "rounded-tr-sm chat-bubble-own" : "rounded-tl-sm chat-bubble-other"} ${isSwiping ? 'opacity-80' : ''}`}
            style={{ direction: "rtl", textAlign: "right", boxShadow: isSwiping ? '0 4px 12px rgba(0,0,0,0.1)' : 'none' }}
          >
            {message.content}
          </div>

          {/* Emoji picker - Floating above */}
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

          {/* Mobile actions menu - يظهر بجانب الرسالة */}
          {showMobileActions && renderMobileActions()}

          {/* Desktop actions - تظهر بجانب الرسالة عند التحويم */}
          <div className={`absolute ${isOwn ? "left-full ml-2" : "right-full mr-2"} top-1/2 -translate-y-1/2 hidden md:flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10`}>
            <button
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowEmojiPicker(!showEmojiPicker); }}
              className="p-2 rounded-lg hover:scale-110 transition-all"
              style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
              title="تفاعل"
            >
              <span className="text-base">😊</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); onReply(message); }}
              className="p-2 rounded-lg hover:scale-110 transition-all"
              style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
              title="رد"
            >
              <Reply className="w-4 h-4" style={{ color: "hsl(var(--muted-foreground))" }} />
            </button>
            {canDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDelete(); }}
                className="p-2 rounded-lg hover:scale-110 transition-all"
                style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--destructive) / 0.3)", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                title="حذف"
              >
                <Trash2 className="w-4 h-4" style={{ color: "hsl(var(--destructive))" }} />
              </button>
            )}
          </div>

          {/* Mobile action button - النقاط الثلاث العمودية بجانب الرسالة */}
          <button
            onClick={() => setShowMobileActions(!showMobileActions)}
            className="md:hidden absolute top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all hover:scale-110 z-10"
            style={{ 
              background: "hsl(var(--card))", 
              border: "1px solid hsl(var(--border))",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              [isOwn ? "left-full" : "right-full"]: "4px"
            }}
          >
            <MoreVertical className="w-5 h-5" style={{ color: "hsl(var(--muted-foreground))" }} />
          </button>
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
