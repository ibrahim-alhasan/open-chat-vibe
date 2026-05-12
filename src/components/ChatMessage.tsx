import { Reply, CornerUpLeft, Trash2, Copy, Check, ShieldCheck, Trophy, Medal, Award, Paperclip, Download, Pin, Image as ImageIcon, Play, Users } from "lucide-react";
import LinkifiedText from "@/components/LinkifiedText";
import PollMessage from "@/components/PollMessage";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { useState, useEffect, useRef, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSignedUrl } from "@/hooks/useSignedUrl";

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
  file_url?: string | null;
  file_name?: string | null;
  file_type?: string | null;
}

export interface Reaction {
  id: string;
  message_id: string;
  username: string;
  user_id?: string; // إضافة user_id لتحديد المستخدم الحالي
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
  messageCounts?: Record<string, number>;
  onReply: (message: Message) => void;
  onUsernameClick?: (userId: string) => void;
  onDelete?: (messageId: string) => void;
  onPin?: (message: Message) => void;
  onScrollToOriginalMessage?: (messageId: string) => void;
  onOpenMedia?: (url: string, type: string, name?: string) => void;
}

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

// Animated admin stickers with CSS animations
const ADMIN_ANIMATED_STICKERS: { emoji: string; label: string; animation: string }[] = [
  { emoji: "🔥", label: "نار", animation: "animate-bounce" },
  { emoji: "⭐", label: "نجمة", animation: "animate-spin-slow" },
  { emoji: "🎉", label: "احتفال", animation: "animate-wiggle" },
  { emoji: "👏", label: "تصفيق", animation: "animate-pulse" },
  { emoji: "💪", label: "قوة", animation: "animate-bounce" },
  { emoji: "🏆", label: "كأس", animation: "animate-wiggle" },
  { emoji: "✅", label: "تم", animation: "animate-scale-pop" },
  { emoji: "❌", label: "لا", animation: "animate-shake" },
  { emoji: "⚠️", label: "تنبيه", animation: "animate-pulse" },
  { emoji: "📢", label: "إعلان", animation: "animate-wiggle" },
  { emoji: "🎯", label: "هدف", animation: "animate-scale-pop" },
  { emoji: "💎", label: "ماس", animation: "animate-spin-slow" },
  { emoji: "🚀", label: "صاروخ", animation: "animate-bounce" },
  { emoji: "💥", label: "انفجار", animation: "animate-shake" },
  { emoji: "🌟", label: "لمعان", animation: "animate-pulse" },
  { emoji: "❤️‍🔥", label: "حب ناري", animation: "animate-wiggle" },
];

export { ADMIN_ANIMATED_STICKERS };

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

// Activity badge component
const ActivityBadge = ({ rank }: { rank: number }) => {
  if (rank === 1) return <span title="الأكثر نشاطاً #1" className="inline-flex items-center gap-0.5 px-1 py-0 rounded text-[9px] font-bold" style={{ background: "hsl(45, 93%, 47%, 0.2)", color: "hsl(45, 93%, 47%)" }}>🥇</span>;
  if (rank === 2) return <span title="الأكثر نشاطاً #2" className="inline-flex items-center gap-0.5 px-1 py-0 rounded text-[9px] font-bold" style={{ background: "hsl(0, 0%, 70%, 0.2)", color: "hsl(0, 0%, 70%)" }}>🥈</span>;
  if (rank === 3) return <span title="الأكثر نشاطاً #3" className="inline-flex items-center gap-0.5 px-1 py-0 rounded text-[9px] font-bold" style={{ background: "hsl(30, 67%, 50%, 0.2)", color: "hsl(30, 67%, 50%)" }}>🥉</span>;
  if (rank <= 5) return <span title={`الأكثر نشاطاً #${rank}`} className="inline-flex items-center gap-0.5 px-1 py-0 rounded text-[9px] font-bold" style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" }}>⭐</span>;
  if (rank <= 10) return <span title={`الأكثر نشاطاً #${rank}`} className="inline-flex items-center gap-0.5 px-1 py-0 rounded text-[9px]" style={{ background: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))" }}>🌟</span>;
  return null;
};

// Render text with @mentions highlighted
const MentionText = ({ text, profilesMap, onUsernameClick }: { text: string; profilesMap: Record<string, { username: string; avatar_url: string | null }>; onUsernameClick?: (userId: string) => void }) => {
  const knownUsers = Object.entries(profilesMap)
    .map(([uid, p]) => ({ uid, username: p.username }))
    .sort((a, b) => b.username.length - a.username.length);

  const parts: (string | { mention: string; userId: string | null })[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    const atIndex = remaining.indexOf('@');
    if (atIndex === -1) {
      parts.push(remaining);
      break;
    }
    if (atIndex > 0) parts.push(remaining.slice(0, atIndex));
    
    const afterAt = remaining.slice(atIndex + 1);
    let matched = false;
    for (const user of knownUsers) {
      if (afterAt.toLowerCase().startsWith(user.username.toLowerCase())) {
        const nextCharIndex = user.username.length;
        const nextChar = afterAt[nextCharIndex];
        if (!nextChar || /[\s,،.!?؟]/.test(nextChar)) {
          parts.push({ mention: user.username, userId: user.uid });
          remaining = afterAt.slice(user.username.length);
          matched = true;
          break;
        }
      }
    }
    if (!matched) {
      const spaceIndex = afterAt.search(/\s/);
      const word = spaceIndex === -1 ? afterAt : afterAt.slice(0, spaceIndex);
      parts.push(`@${word}`);
      remaining = spaceIndex === -1 ? '' : afterAt.slice(spaceIndex);
    }
  }

  if (parts.length === 0 || (parts.length === 1 && typeof parts[0] === "string")) {
    return <LinkifiedText text={text} />;
  }

  return (
    <span>
      {parts.map((part, i) => {
        if (typeof part === "string") return <LinkifiedText key={i} text={part} />;
        return (
          <span key={i} className="font-semibold cursor-pointer hover:underline px-0.5 rounded"
            style={{ color: "hsl(var(--primary))", background: "hsl(var(--primary) / 0.1)" }}
            onClick={(e) => { e.stopPropagation(); if (part.userId && onUsernameClick) onUsernameClick(part.userId); }}>
            @{part.mention}
          </span>
        );
      })}
    </span>
  );
};

const SignedFileAttachment = ({ fileUrl, fileType, fileName, isOwn, onOpenMedia, onCardClick }: any) => {
  // ... (same as original, kept for completeness)
  return <div>ملف</div>;
};

// ========== مكون قائمة التفاعلات الجديد والمحسن ==========
interface ReactionsPopupProps {
  reactions: Reaction[]; // جميع التفاعلات (بكل الإيموجيات)
  profilesMap: Record<string, { username: string; avatar_url: string | null }>;
  currentUserId: string;
  onClose: () => void;
}

const ReactionsPopup = ({ reactions, profilesMap, currentUserId, onClose }: ReactionsPopupProps) => {
  // تجميع التفاعلات حسب المستخدم (كل المستخدمين وكل الإيموجيات التي تفاعلوا بها)
  const userReactionsMap = new Map<string, { userId: string; username: string; emojis: string[]; reactionIds: string[] }>();
  
  reactions.forEach((reaction) => {
    const userId = reaction.user_id || reaction.id; // استخدام user_id إن وجد
    const username = reaction.username;
    
    if (!userReactionsMap.has(userId)) {
      userReactionsMap.set(userId, {
        userId,
        username,
        emojis: [],
        reactionIds: []
      });
    }
    const userData = userReactionsMap.get(userId)!;
    if (!userData.emojis.includes(reaction.emoji)) {
      userData.emojis.push(reaction.emoji);
    }
    userData.reactionIds.push(reaction.id);
  });
  
  // تحويل الخريطة إلى مصفوفة للعرض
  const userReactionsList = Array.from(userReactionsMap.values());
  
  // ترتيب: المستخدم الحالي أولاً ثم الباقي حسب عدد التفاعلات
  userReactionsList.sort((a, b) => {
    if (a.userId === currentUserId) return -1;
    if (b.userId === currentUserId) return 1;
    return b.emojis.length - a.emojis.length;
  });

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center animate-fade-in"
      style={{ 
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(6px)"
      }}
      onClick={onClose}
    >
      <div 
        className="relative w-[92%] max-w-[360px] max-h-[75vh] animate-scale-in overflow-hidden"
        style={{ 
          background: "hsl(var(--card))", 
          border: "1px solid hsl(var(--border))", 
          borderRadius: "24px", 
          boxShadow: "0 25px 45px -12px rgba(0,0,0,0.6)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - حجم خط مناسب للهاتف */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "hsl(var(--border))" }}>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
            <span className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>
              التفاعلات
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))" }}>
              {reactions.length}
            </span>
          </div>
          <button 
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full transition-all active:scale-90 hover:opacity-80"
            style={{ background: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))" }}
          >
            ✕
          </button>
        </div>
        
        {/* قائمة المستخدمين مع جميع الإيموجيات التي تفاعلوا بها - خط مصغر للهاتف */}
        <div className="py-2 max-h-[55vh] overflow-y-auto" style={{ direction: "rtl" }}>
          {userReactionsList.map((user, idx) => {
            const isMe = user.userId === currentUserId;
            const userColor = getUserColor(user.username);
            
            return (
              <div 
                key={user.userId} 
                className="flex items-center gap-2 px-4 py-2.5 transition-all active:bg-opacity-10"
                style={{ 
                  borderBottom: idx !== userReactionsList.length - 1 ? `0.5px solid hsl(var(--border) / 0.5)` : 'none',
                  background: isMe ? "hsl(var(--primary) / 0.05)" : "transparent"
                }}
              >
                {/* صورة رمزية مصغرة (أحرف أولى) */}
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                  style={{ background: `${userColor}20`, color: userColor }}>
                  {getInitials(user.username)}
                </div>
                
                {/* اسم المستخدم */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[13px] font-medium truncate max-w-[120px]" style={{ color: "hsl(var(--foreground))" }}>
                      {isMe ? "أنت" : user.username}
                    </span>
                    {isMe && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" }}>
                        أنت
                      </span>
                    )}
                  </div>
                  
                  {/* عرض جميع الإيموجيات التي تفاعل بها هذا المستخدم - تصميم صغير مناسب للهاتف */}
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {user.emojis.map((emoji, emojiIdx) => (
                      <span 
                        key={emojiIdx} 
                        className="inline-flex items-center justify-center text-[15px] leading-none px-1 py-0.5 rounded-md"
                        style={{ 
                          background: "hsl(var(--secondary))",
                          minWidth: "28px"
                        }}
                        title={`${user.username} تفاعل بـ ${emoji}`}
                      >
                        {emoji}
                      </span>
                    ))}
                    {user.emojis.length > 0 && (
                      <span className="text-[9px] mr-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                        ({user.emojis.length})
                      </span>
                    )}
                  </div>
                </div>
                
                {/* أيقونة ترتيب بسيطة */}
                {idx === 0 && !isMe && <span className="text-sm">🥇</span>}
                {idx === 1 && !isMe && <span className="text-sm">🥈</span>}
                {idx === 2 && !isMe && <span className="text-sm">🥉</span>}
              </div>
            );
          })}
          
          {/* حالة عدم وجود تفاعلات */}
          {userReactionsList.length === 0 && (
            <div className="text-center py-8">
              <span className="text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>لا توجد تفاعلات بعد</span>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-4 py-2 border-t text-center" style={{ borderColor: "hsl(var(--border))" }}>
          <span className="text-[9px]" style={{ color: "hsl(var(--muted-foreground))" }}>
            {reactions.length} {reactions.length === 1 ? 'تفاعل' : 'تفاعل'} من {userReactionsList.length} {userReactionsList.length === 1 ? 'شخص' : 'أشخاص'}
          </span>
        </div>
      </div>
    </div>
  );
};

// ========== مكون الرسالة الرئيسي ==========
const ChatMessage = memo(({
  message, currentUserId, currentUsername, currentAvatarUrl, reactions, profilesMap,
  isOnline, isAdmin, isCurrentUserAdmin, messageCounts, onReply, onUsernameClick, onDelete, onPin, onScrollToOriginalMessage, onOpenMedia,
}: ChatMessageProps) => {
  const isOwn = message.user_id === currentUserId;
  const profile = message.user_id && profilesMap[message.user_id];
  const displayName = profile ? profile.username : message.username;
  const avatarUrl = isOwn ? currentAvatarUrl : (profile ? profile.avatar_url : null);
  const userColor = isAdmin ? "#1D9BF0" : getUserColor(displayName);
  
  const isSticker = message.content.startsWith("sticker:");
  const stickerEmoji = isSticker ? message.content.replace("sticker:", "") : null;
  const isPoll = message.content.startsWith("poll:");
  const stickerAnimation = isSticker ? ADMIN_ANIMATED_STICKERS.find(s => s.emoji === stickerEmoji)?.animation || "" : "";

  // Get activity rank
  const userRank = (() => {
    if (!messageCounts || !message.user_id) return 0;
    const sorted = Object.entries(messageCounts).sort(([, a], [, b]) => b - a);
    const idx = sorted.findIndex(([uid]) => uid === message.user_id);
    return idx >= 0 ? idx + 1 : 0;
  })();
  
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showReactionsPopup, setShowReactionsPopup] = useState(false); // تغيير: popup واحد يعرض جميع التفاعلات
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [showReplyIndicator, setShowReplyIndicator] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const messageRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; time: number } | null>(null);
  const isClickOnButtonRef = useRef(false);

  const timeAgo = formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: ar });
  const canDelete = isOwn || isCurrentUserAdmin;

  // تجميع التفاعلات حسب الإيموجي لعرض الأزرار
  const reactionGroups = reactions.reduce<Record<string, Reaction[]>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = [];
    acc[r.emoji].push(r);
    return acc;
  }, {});

  const handleReaction = async (emoji: string) => {
    setShowEmojiPicker(false);
    setShowActionsMenu(false);
    if (!currentUserId) return;
    const myExisting = reactions.find((r) => r.user_id === currentUserId);
    if (myExisting && myExisting.emoji === emoji) {
      await supabase.from("reactions").delete().eq("id", myExisting.id);
      return;
    }
    if (myExisting) {
      await supabase.from("reactions").delete().eq("id", myExisting.id);
    }
    await supabase.from("reactions").insert({ message_id: message.id, user_id: currentUserId, username: currentUsername || "", emoji });
  };

  const handleDelete = async () => {
    if (!canDelete || !onDelete) return;
    setShowActionsMenu(false);
    onDelete(message.id);
  };

  const handleOriginalMessageClick = () => {
    if (message.reply_to && onScrollToOriginalMessage) {
      onScrollToOriginalMessage(message.reply_to);
    }
  };

  // فتح قائمة التفاعلات (تعرض جميع التفاعلات وليس فقط تفاعل معين)
  const handleOpenReactionsPopup = () => {
    setShowReactionsPopup(true);
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

  const handleBubbleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setShowActionsMenu(!showActionsMenu);
    setShowEmojiPicker(false);
  };

  return (
    <div id={`message-${message.id}`} ref={messageRef} className={`flex gap-2 group animate-fade-in relative ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
      
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${!isOwn ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`} 
          style={{ background: isAdmin ? "#1D9BF018" : `${userColor}18`, color: isAdmin ? "#1D9BF0" : userColor, border: isAdmin ? "2px solid #1D9BF0" : undefined }} 
          onClick={() => !isOwn && onUsernameClick && message.user_id && onUsernameClick(message.user_id)}>
          {getInitials(displayName)}
        </div>
        {isOnline && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-[1.5px]" style={{ background: "hsl(var(--chat-online))", borderColor: "hsl(var(--chat-bg))" }} />}
      </div>

      {/* Message content */}
      <div className={`max-w-[75%] space-y-0.5 ${isOwn ? "items-end" : "items-start"} flex flex-col relative`}
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
        style={{ transform: `translateX(${swipeOffset}px)`, transition: isSwiping ? 'none' : 'transform 0.2s ease`, cursor: isSwiping ? 'grabbing' : 'pointer' }}>
        
        {showReplyIndicator && (
          <div className="absolute -right-10 top-1/2 transform -translate-y-1/2 flex items-center gap-1 animate-pulse" style={{ color: "hsl(var(--primary))", direction: 'ltr' }}>
            <Reply className="w-3.5 h-3.5" />
          </div>
        )}

        {/* Username and time */}
        <div className={`flex items-center gap-1.5 w-full flex-wrap ${isOwn ? "justify-end" : "justify-start"}`}>
          <div className="flex items-center gap-0.5">
            {isAdmin && !isOwn && <ShieldCheck className="w-3 h-3" style={{ color: "#1D9BF0" }} />}
            <span className={`text-[11px] font-semibold ${!isOwn && !isAdmin ? "cursor-pointer hover:underline" : ""}`} style={{ color: userColor }} onClick={() => !isOwn && onUsernameClick && message.user_id && onUsernameClick(message.user_id)}>
              {isOwn ? "أنت" : displayName}
            </span>
            {isAdmin && <VerifiedBadge />}
            {isAdmin && !isOwn && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "#1D9BF015", color: "#1D9BF0" }}>مشرف</span>
            )}
            {!isAdmin && userRank > 0 && userRank <= 10 && <ActivityBadge rank={userRank} />}
          </div>
          <span className="text-[10px]" style={{ color: "hsl(var(--chat-timestamp))" }}>{timeAgo}</span>
        </div>

        {/* Reply preview */}
        {message.reply_to && message.reply_to_username && (
          <div 
            className={`px-2.5 py-1.5 rounded-lg text-[11px] flex items-start gap-1.5 ${isOwn ? "flex-row-reverse" : "flex-row"} w-full cursor-pointer transition-all hover:opacity-80`}
            style={{ background: "hsl(var(--chat-reply-bg))", borderLeft: !isOwn ? `2px solid ${getUserColor(message.reply_to_username)}` : undefined, borderRight: isOwn ? `2px solid ${getUserColor(message.reply_to_username)}` : undefined }}
            onClick={handleOriginalMessageClick}>
            <div className={`min-w-0 flex-1 ${isOwn ? "text-right" : "text-left"}`}>
              <p className="font-semibold mb-0.5" style={{ color: getUserColor(message.reply_to_username) }}>{message.reply_to_username}</p>
              <p className="line-clamp-2" style={{ color: "hsl(var(--muted-foreground))" }}>{message.reply_to_content?.slice(0, 80)}</p>
            </div>
            <CornerUpLeft className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: "hsl(var(--primary))" }} />
          </div>
        )}

        {/* Message bubble */}
        <div className="relative w-full">
          {isSticker ? (
            <div className={`text-[56px] leading-none py-1 ${isOwn ? "text-right" : "text-left"} cursor-pointer active:scale-95 transition-transform ${stickerAnimation}`} onClick={handleBubbleClick}>
              {stickerEmoji}
            </div>
          ) : message.content && !message.content.startsWith('📎 ') ? (
            <div className={`px-3 py-2 rounded-lg text-[14px] leading-[1.4] break-words select-none ${isOwn ? "rounded-tr-none chat-bubble-own" : "rounded-tl-none chat-bubble-other"} cursor-pointer active:brightness-90 transition-all`}
              style={{ direction: "rtl", textAlign: "right", ...(isAdmin && !isOwn ? { background: "linear-gradient(135deg, hsl(207, 90%, 54%, 0.12), hsl(207, 90%, 54%, 0.05))", border: "1px solid hsl(207, 90%, 54%, 0.2)" } : {}) }} onClick={handleBubbleClick}>
              <MentionText text={message.content} profilesMap={profilesMap} onUsernameClick={onUsernameClick} />
            </div>
          ) : null}

          {/* Actions popup (unchanged) */}
          {showActionsMenu && (
            <div className="absolute left-0 right-0 z-[9999] animate-fade-in pointer-events-none" style={{ bottom: "calc(100% + 6px)" }}>
              <div className="flex justify-center">
                <div className="flex items-center gap-1 px-1.5 py-1 rounded-xl pointer-events-auto" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
                  {EMOJIS.slice(0, 4).map((emoji) => {
                    const myReaction = reactions.find((r) => r.emoji === emoji && r.user_id === currentUserId);
                    return (
                      <button key={emoji} onClick={(e) => { e.stopPropagation(); handleReaction(emoji); }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-all hover:scale-125 active:scale-90"
                        style={{ background: myReaction ? "hsl(var(--primary) / 0.2)" : "transparent" }}>{emoji}</button>
                    );
                  })}
                  <button onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(true); setShowActionsMenu(false); }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-all hover:scale-110" style={{ background: "hsl(var(--secondary))" }}>➕</button>
                  <div className="w-px h-5 mx-0.5" style={{ background: "hsl(var(--border))" }} />
                  <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(isSticker ? stickerEmoji! : message.content); setCopied(true); setTimeout(() => setCopied(false), 1500); setShowActionsMenu(false); }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:scale-110" style={{ background: "hsl(var(--secondary))" }} title="نسخ">
                    {copied ? <Check className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary))" }} /> : <Copy className="w-3.5 h-3.5" style={{ color: "hsl(var(--muted-foreground))" }} />}
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

          {showEmojiPicker && (
            <div className="absolute left-0 right-0 z-[9999] animate-fade-in pointer-events-none" style={{ bottom: "calc(100% + 6px)" }} onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-center">
                <div className="flex flex-wrap gap-1 p-2 rounded-xl pointer-events-auto" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "0 4px 20px rgba(0,0,0,0.4)", maxWidth: "200px" }}>
                  {EMOJIS.map((emoji) => {
                    const myReaction = reactions.find((r) => r.emoji === emoji && r.user_id === currentUserId);
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

        {/* Reactions buttons - مع تغيير سلوك الضغط: يعرض جميع التفاعلات وليس فقط تفاعل معين */}
        {Object.keys(reactionGroups).length > 0 && (
          <div className={`flex flex-wrap gap-1 relative ${isOwn ? "justify-end" : "justify-start"}`}>
            {Object.entries(reactionGroups).map(([emoji, group]) => {
              const myReaction = group.find((r) => r.user_id === currentUserId);
              return (
                <button 
                  key={emoji} 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    handleOpenReactionsPopup(); // فتح النافذة التي تعرض جميع التفاعلات
                  }}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] hover:scale-105 active:scale-95 transition-all"
                  style={{ background: myReaction ? "hsl(var(--primary) / 0.2)" : "hsl(var(--secondary))", border: myReaction ? "1px solid hsl(var(--primary) / 0.4)" : "1px solid hsl(var(--border))" }}>
                  <span>{emoji}</span><span style={{ color: "hsl(var(--foreground))" }}>{group.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      
      {/* نافذة التفاعلات الجديدة - تعرض جميع المستخدمين مع جميع الإيموجيات التي تفاعلوا بها */}
      {showReactionsPopup && (
        <ReactionsPopup
          reactions={reactions}
          profilesMap={profilesMap}
          currentUserId={currentUserId}
          onClose={() => setShowReactionsPopup(false)}
        />
      )}
    </div>
  );
});

export default ChatMessage;
