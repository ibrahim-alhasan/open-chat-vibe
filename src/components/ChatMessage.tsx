import { Reply, CornerUpLeft, Trash2, Copy, Check } from "lucide-react";
import LinkifiedText from "@/components/LinkifiedText";
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
  replyCount?: number;
  onReply: (message: Message) => void;
  onUsernameClick?: (userId: string) => void;
  onDelete?: (messageId: string) => void;
  onOpenThread?: (message: Message) => void;
}

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

const getUserColor = (username: string) => {
  const colors = [
    "hsl(142, 70%, 50%)", "hsl(199, 89%, 55%)", "hsl(38, 92%, 55%)",
    "hsl(280, 65%, 60%)", "hsl(0, 72%, 60%)", "hsl(32, 98%, 55%)",
    "hsl(168, 75%, 42%)", "hsl(220, 80%, 60%)",
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const getInitials = (username: string) => username.slice(0, 2).toUpperCase();

const VerifiedBadge = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#1D9BF0", display: "inline-block", marginRight: "3px" }}>
    <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
    <path d="m9 12 2 2 4-4"/>
  </svg>
);

const ChatMessage = ({
  message, currentUserId, currentUsername, currentAvatarUrl, reactions, profilesMap,
  isOnline, isAdmin, isCurrentUserAdmin, replyCount = 0, onReply, onUsernameClick, onDelete, onOpenThread,
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
  const [copied, setCopied] = useState(false);
  
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
    if (existing) await supabase.from("reactions").delete().eq("id", existing.id);
    else await supabase.from("reactions").insert({ message_id: message.id, username: currentUsername, emoji });
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
    if (deltaX > 0) { e.preventDefault(); const newOffset = Math.min(deltaX, 100); setSwipeOffset(newOffset); setShowReplyIndicator(newOffset > 30); }
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
    if (isSwiping) { touchStartRef.current = null; setIsSwiping(false); setSwipeOffset(0); setShowReplyIndicator(false); isClickOnButtonRef.current = false; }
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
    <div ref={messageRef} className={`flex gap-2 group animate-fade-in relative ${isOwn ? "flex-row-reverse" : "flex-row"}`} onMouseLeave={handleMouseLeave}>
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {avatarUrl ? (
          <img src={avatarUrl} alt="avatar" className={`w-8 h-8 rounded-full object-cover ${!isOwn ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`} onClick={handleAvatarClick} />
        ) : (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${!isOwn ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`} style={{ background: `${userColor}18`, color: userColor }} onClick={handleAvatarClick}>
            {getInitials(displayName)}
          </div>
        )}
        {isOnline && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-[1.5px]" style={{ background: "hsl(var(--chat-online))", borderColor: "hsl(var(--chat-bg))" }} />}
      </div>

      {/* Message content */}
      <div className={`max-w-[75%] space-y-0.5 ${isOwn ? "items-end" : "items-start"} flex flex-col relative`}
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
        style={{ transform: `translateX(${swipeOffset}px)`, transition: isSwiping ? 'none' : 'transform 0.2s ease', cursor: isSwiping ? 'grabbing' : 'pointer' }}>
        
        {showReplyIndicator && (
          <div className="absolute -right-10 top-1/2 transform -translate-y-1/2 flex items-center gap-1 animate-pulse" style={{ color: "hsl(var(--primary))", direction: 'ltr' }}>
            <Reply className="w-3.5 h-3.5" />
          </div>
        )}

        {/* Username and time */}
        <div className={`flex items-center gap-1.5 w-full ${isOwn ? "justify-end" : "justify-start"}`}>
          <div className="flex items-center gap-0.5">
            <span className={`text-[11px] font-semibold ${!isOwn && !isAdmin ? "cursor-pointer hover:underline" : ""}`} style={{ color: userColor }} onClick={() => !isOwn && onUsernameClick && message.user_id && onUsernameClick(message.user_id)}>
              {isOwn ? "أنت" : displayName}
            </span>
            {isAdmin && <VerifiedBadge />}
          </div>
          <span className="text-[10px]" style={{ color: "hsl(var(--chat-timestamp))" }}>{timeAgo}</span>
        </div>

        {/* Reply preview */}
        {message.reply_to && message.reply_to_username && (
          <div className={`px-2.5 py-1.5 rounded-lg text-[11px] flex items-start gap-1.5 ${isOwn ? "flex-row-reverse" : "flex-row"} w-full`}
            style={{ background: "hsl(var(--chat-reply-bg))", borderLeft: !isOwn ? `2px solid ${getUserColor(message.reply_to_username)}` : undefined, borderRight: isOwn ? `2px solid ${getUserColor(message.reply_to_username)}` : undefined }}>
            <div className={`min-w-0 ${isOwn ? "text-right" : "text-left"}`}>
              <p className="font-semibold mb-0.5" style={{ color: getUserColor(message.reply_to_username) }}>{message.reply_to_username}</p>
              <p className="truncate" style={{ color: "hsl(var(--muted-foreground))" }}>{message.reply_to_content}</p>
            </div>
          </div>
        )}

        {/* Message bubble - WhatsApp style */}
        <div className="relative w-full">
          <div className={`px-3 py-2 rounded-lg text-[14px] leading-[1.4] break-words select-none ${isOwn ? "rounded-tr-none chat-bubble-own" : "rounded-tl-none chat-bubble-other"} ${isSwiping ? 'opacity-80' : ''} cursor-pointer active:brightness-90 transition-all`}
            style={{ direction: "rtl", textAlign: "right" }} onClick={handleBubbleClick}>
            <LinkifiedText text={message.content} />
          </div>

          {/* Actions popup */}
          {showActionsMenu && (
            <div className="absolute left-0 right-0 z-[9999] animate-fade-in pointer-events-none" style={{ bottom: "calc(100% + 6px)" }}>
              <div className="flex justify-center">
                <div className="flex items-center gap-1 px-1.5 py-1 rounded-xl pointer-events-auto" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
                  {EMOJIS.slice(0, 4).map((emoji) => {
                    const myReaction = reactions.find((r) => r.emoji === emoji && r.username === currentUsername);
                    return (
                      <button key={emoji} onClick={(e) => { e.stopPropagation(); handleReaction(emoji); }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-all hover:scale-125 active:scale-90"
                        style={{ background: myReaction ? "hsl(var(--primary) / 0.2)" : "transparent" }}>{emoji}</button>
                    );
                  })}
                  <button onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(true); setShowActionsMenu(false); }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-all hover:scale-110" style={{ background: "hsl(var(--secondary))" }}>➕</button>
                  <div className="w-px h-5 mx-0.5" style={{ background: "hsl(var(--border))" }} />
                  <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(message.content); setCopied(true); setTimeout(() => setCopied(false), 1500); setShowActionsMenu(false); }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:scale-110" style={{ background: "hsl(var(--secondary))" }} title="نسخ">
                    {copied ? <Check className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary))" }} /> : <Copy className="w-3.5 h-3.5" style={{ color: "hsl(var(--muted-foreground))" }} />}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onReply(message); setShowActionsMenu(false); }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:scale-110" style={{ background: "hsl(var(--secondary))" }} title="رد">
                    <Reply className="w-3.5 h-3.5" style={{ color: "hsl(var(--muted-foreground))" }} />
                  </button>
                  {canDelete && (
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:scale-110" style={{ background: "hsl(var(--destructive) / 0.15)" }} title="حذف">
                      <Trash2 className="w-3.5 h-3.5" style={{ color: "hsl(var(--destructive))" }} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex justify-center">
                <div className="w-2.5 h-2.5 rotate-45 -mt-1.5 pointer-events-auto" style={{ background: "hsl(var(--card))", borderRight: "1px solid hsl(var(--border))", borderBottom: "1px solid hsl(var(--border))" }} />
              </div>
            </div>
          )}

          {/* Full Emoji picker */}
          {showEmojiPicker && (
            <div className="absolute left-0 right-0 z-[9999] animate-fade-in pointer-events-none" style={{ bottom: "calc(100% + 6px)" }} onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-center">
                <div className="flex flex-wrap gap-1 p-2 rounded-xl pointer-events-auto" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "0 4px 20px rgba(0,0,0,0.4)", maxWidth: "200px" }}>
                  {EMOJIS.map((emoji) => {
                    const myReaction = reactions.find((r) => r.emoji === emoji && r.username === currentUsername);
                    return (
                      <button key={emoji} onClick={(e) => { e.stopPropagation(); handleReaction(emoji); }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-all hover:scale-125 active:scale-90"
                        style={{ background: myReaction ? "hsl(var(--primary) / 0.2)" : "transparent" }}>{emoji}</button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Reactions */}
        {Object.keys(reactionGroups).length > 0 && (
          <div className={`flex flex-wrap gap-1 ${isOwn ? "justify-end" : "justify-start"}`}>
            {Object.entries(reactionGroups).map(([emoji, group]) => {
              const myReaction = group.find((r) => r.username === currentUsername);
              return (
                <button key={emoji} onClick={(e) => { e.stopPropagation(); handleReaction(emoji); }}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] hover:scale-105 active:scale-95"
                  style={{ background: myReaction ? "hsl(var(--primary) / 0.2)" : "hsl(var(--secondary))", border: myReaction ? "1px solid hsl(var(--primary) / 0.4)" : "1px solid hsl(var(--border))" }}>
                  <span>{emoji}</span><span style={{ color: "hsl(var(--foreground))" }}>{group.length}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Thread reply count */}
        {replyCount > 0 && onOpenThread && (
          <button onClick={(e) => { e.stopPropagation(); onOpenThread(message); }}
            className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full transition-all hover:scale-105 active:scale-95"
            style={{ color: "hsl(var(--primary))", background: "hsl(var(--primary) / 0.1)" }}>
            <Reply className="w-3 h-3" />
            <span>{replyCount} رد</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
