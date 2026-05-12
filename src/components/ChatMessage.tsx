// ChatMessage.tsx - الملف الكامل مع روابط كزر منفصل
import React from 'react';
import { Reply, CornerUpLeft, Trash2, Copy, Check, ShieldCheck, Paperclip, Download, Pin, Image as ImageIcon, Play, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { useState, useEffect, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import PollMessage from "@/components/PollMessage";

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

// Animated admin stickers
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

// ============================================
// مكون استخراج وعرض الروابط كأزرار منفصلة
// ============================================
const extractUrls = (text: string): string[] => {
  const urlPattern = /(https?:\/\/[^\s\u0600-\u06FF]+(?:[\w\-._~:/?#[\]@!$&'()*+,;=]|%[0-9A-Fa-f]{2})*)/gi;
  const urls: string[] = [];
  let match;
  while ((match = urlPattern.exec(text)) !== null) {
    urls.push(match[0]);
  }
  return urls;
};

const removeUrlsFromText = (text: string): string => {
  const urlPattern = /(https?:\/\/[^\s\u0600-\u06FF]+(?:[\w\-._~:/?#[\]@!$&'()*+,;=]|%[0-9A-Fa-f]{2})*)/gi;
  return text.replace(urlPattern, '');
};

// مكون زر فتح الرابط
const UrlButton = ({ url, onOpen }: { url: string; onOpen?: (url: string) => void }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpen) {
      onOpen(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };
  
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg mt-1" style={{ 
      background: "hsl(var(--secondary))", 
      border: "1px solid hsl(var(--border))",
      direction: "ltr"
    }}>
      <div className="flex-1 min-w-0">
        <div className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>🔗 رابط</div>
        <div className="text-[11px] truncate" style={{ color: "hsl(var(--foreground))" }}>{url}</div>
      </div>
      <button
        onClick={handleCopy}
        className="p-1.5 rounded-md transition-all hover:scale-105 active:scale-95"
        style={{ background: "hsl(var(--primary) / 0.1)" }}
        title="نسخ الرابط"
      >
        {copied ? <Check className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary))" }} /> : <Copy className="w-3.5 h-3.5" style={{ color: "hsl(var(--muted-foreground))" }} />}
      </button>
      <button
        onClick={handleOpen}
        className="p-1.5 rounded-md transition-all hover:scale-105 active:scale-95"
        style={{ background: "hsl(var(--primary) / 0.15)" }}
        title="فتح الرابط"
      >
        <ExternalLink className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary))" }} />
      </button>
    </div>
  );
};

// مكون عرض النص مع المنشنات فقط (بدون روابط تلقائية)
const TextWithMentions = ({ text, profilesMap, onUsernameClick }: { text: string; profilesMap: Record<string, { username: string; avatar_url: string | null }>; onUsernameClick?: (userId: string) => void }) => {
  // بناء قائمة المستخدمين للمنشنات
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

  return (
    <span>
      {parts.map((part, i) => {
        if (typeof part === "string") {
          return <span key={i}>{part}</span>;
        }
        return (
          <span 
            key={i} 
            className="font-semibold cursor-pointer hover:underline px-0.5 rounded"
            style={{ color: "hsl(var(--primary))", background: "hsl(var(--primary) / 0.1)" }}
            onClick={(e) => { 
              e.stopPropagation(); 
              if (part.userId && onUsernameClick) onUsernameClick(part.userId); 
            }}
          >
            @{part.mention}
          </span>
        );
      })}
    </span>
  );
};

// ============================================
// SignedFileAttachment Component
// ============================================
const SignedFileAttachment = ({
  fileUrl, fileType, fileName, isOwn, onOpenMedia, onCardClick,
}: {
  fileUrl: string;
  fileType: string | null | undefined;
  fileName: string | null | undefined;
  isOwn: boolean;
  onOpenMedia?: (url: string, type: string, name?: string) => void;
  onCardClick?: (e: React.MouseEvent) => void;
}) => {
  const isImage = fileType?.startsWith("image/");
  const isVideo = fileType?.startsWith("video/");
  const isMedia = isImage || isVideo;

  const signedUrl = useSignedUrl("public_chat_files", isMedia ? "" : fileUrl);

  const handleOpen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onOpenMedia) return;
    if (isMedia) {
      const { getSignedStorageUrl } = await import("@/lib/signedUrl");
      const url = await getSignedStorageUrl("public_chat_files", fileUrl);
      if (url) onOpenMedia(url, fileType || "image/*", fileName || "media");
    } else if (signedUrl) {
      onOpenMedia(signedUrl, fileType || "application/octet-stream", fileName || "file");
    }
  };

  return (
    <div className={`w-full ${isOwn ? "flex justify-end" : "flex justify-start"}`}>
      {isImage ? (
        <div
          onClick={onCardClick}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl max-w-[250px] cursor-pointer transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))" }}
        >
          <div
            onClick={handleOpen}
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition-transform"
            style={{ background: "hsl(var(--primary) / 0.15)" }}
            title="فتح الصورة"
          >
            <ImageIcon className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
          </div>
          <div className="flex flex-col items-start min-w-0">
            <span className="text-[12px] font-medium truncate max-w-[160px]" style={{ color: "hsl(var(--foreground))" }}>
              {fileName || "صورة"}
            </span>
            <span className="text-[10px]" style={{ color: "hsl(var(--primary))" }} onClick={handleOpen}>اضغط على الأيقونة لفتح الصورة</span>
          </div>
        </div>
      ) : isVideo ? (
        <div
          onClick={onCardClick}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl max-w-[250px] cursor-pointer transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))" }}
        >
          <div
            onClick={handleOpen}
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition-transform"
            style={{ background: "hsl(var(--primary) / 0.15)" }}
            title="تشغيل الفيديو"
          >
            <Play className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
          </div>
          <div className="flex flex-col items-start min-w-0">
            <span className="text-[12px] font-medium truncate max-w-[160px]" style={{ color: "hsl(var(--foreground))" }}>
              {fileName || "فيديو"}
            </span>
            <span className="text-[10px]" style={{ color: "hsl(var(--primary))" }} onClick={handleOpen}>اضغط على الأيقونة لتشغيل الفيديو</span>
          </div>
        </div>
      ) : !signedUrl ? (
        <div className="w-[200px] h-[44px] rounded-xl animate-pulse" style={{ background: "hsl(var(--secondary))" }} />
      ) : (
        <div
          onClick={onCardClick}
          className="flex items-center gap-2 px-3 py-2 rounded-xl max-w-[250px] cursor-pointer transition-all hover:opacity-80 active:scale-98"
          style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))" }}
        >
          <Paperclip className="w-4 h-4 flex-shrink-0" style={{ color: "hsl(var(--primary))" }} onClick={handleOpen} />
          <span className="text-xs truncate flex-1" style={{ color: "hsl(var(--foreground))" }}>{fileName || "ملف"}</span>
          <button
            onClick={handleOpen}
            className="p-1 rounded-md hover:scale-110 active:scale-90 transition-transform"
            style={{ background: "hsl(var(--primary) / 0.12)" }}
            title="تحميل الملف"
          >
            <Download className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary))" }} />
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================
// ChatMessage Component الرئيسي
// ============================================
const ChatMessage = memo(({
  message, currentUserId, currentUsername, currentAvatarUrl, reactions, profilesMap,
  isOnline, isAdmin, isCurrentUserAdmin, messageCounts, onReply, onUsernameClick, onDelete, onPin, onScrollToOriginalMessage, onOpenMedia,
}: ChatMessageProps) => {
  const isOwn = message.user_id === currentUserId;
  const profile = message.user_id && profilesMap[message.user_id];
  const displayName = profile ? profile.username : message.username;
  const userColor = isAdmin ? "#1D9BF0" : getUserColor(displayName);
  
  const isSticker = message.content.startsWith("sticker:");
  const stickerEmoji = isSticker ? message.content.replace("sticker:", "") : null;
  const isPoll = message.content.startsWith("poll:");
  const stickerAnimation = isSticker ? ADMIN_ANIMATED_STICKERS.find(s => s.emoji === stickerEmoji)?.animation || "" : "";

  // استخراج الروابط من النص
  const urls = !isSticker && !isPoll ? extractUrls(message.content) : [];
  // إزالة الروابط من النص للعرض
  const cleanText = !isSticker && !isPoll ? removeUrlsFromText(message.content).trim() : message.content;

  // Get activity rank
  const userRank = (() => {
    if (!messageCounts || !message.user_id) return 0;
    const sorted = Object.entries(messageCounts).sort(([, a], [, b]) => b - a);
    const idx = sorted.findIndex(([uid]) => uid === message.user_id);
    return idx >= 0 ? idx + 1 : 0;
  })();
  
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [reactorsPopup, setReactorsPopup] = useState<any>(null);
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
    if (!currentUserId) return;
    const myExisting = reactions.find((r) => (r as any).user_id === currentUserId);
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
    if (!reactorsPopup) return;
    const close = (e: MouseEvent) => {
      if (messageRef.current && !messageRef.current.contains(e.target as Node)) {
        setReactorsPopup(null);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [reactorsPopup]);

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
    <div id={`message-${message.id}`} ref={messageRef} className={`flex gap-2 group animate-fade-in relative ${isOwn ? "flex-row-reverse" : "flex-row"}`} onMouseLeave={handleMouseLeave}>
      
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${!isOwn ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`} 
          style={{ background: isAdmin ? "#1D9BF018" : `${userColor}18`, color: isAdmin ? "#1D9BF0" : userColor, border: isAdmin ? "2px solid #1D9BF0" : undefined }} 
          onClick={handleAvatarClick}>
          {getInitials(displayName)}
        </div>
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
            style={{ 
              background: "hsl(var(--chat-reply-bg))", 
              borderLeft: !isOwn ? `2px solid ${getUserColor(message.reply_to_username)}` : undefined, 
              borderRight: isOwn ? `2px solid ${getUserColor(message.reply_to_username)}` : undefined,
            }}
            onClick={handleOriginalMessageClick}
          >
            <div className={`min-w-0 flex-1 ${isOwn ? "text-right" : "text-left"}`}>
              <p className="font-semibold mb-0.5" style={{ color: getUserColor(message.reply_to_username) }}>
                {message.reply_to_username}
              </p>
              <p className="line-clamp-2" style={{ color: "hsl(var(--muted-foreground))" }}>
                {message.reply_to_content && message.reply_to_content.length > 80 
                  ? message.reply_to_content.slice(0, 80) + '...' 
                  : message.reply_to_content}
              </p>
            </div>
            <CornerUpLeft className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: "hsl(var(--primary))" }} />
          </div>
        )}

        {/* File attachment */}
        {message.file_url && (
          <SignedFileAttachment
            fileUrl={message.file_url}
            fileType={message.file_type}
            fileName={message.file_name}
            isOwn={isOwn}
            onOpenMedia={onOpenMedia}
            onCardClick={handleBubbleClick}
          />
        )}

        {/* Message bubble - مع إخفاء الروابط من النص وعرضها كأزرار منفصلة */}
        <div className="relative w-full">
          {isSticker ? (
            <div className={`text-[56px] leading-none py-1 ${isOwn ? "text-right" : "text-left"} cursor-pointer active:scale-95 transition-transform ${stickerAnimation}`} onClick={handleBubbleClick}>
              {stickerEmoji}
            </div>
          ) : isPoll ? (
            <PollMessage pollData={JSON.parse(message.content.replace("poll:", ""))} />
          ) : (cleanText || urls.length > 0) ? (
            <>
              {/* النص النظيف بدون روابط */}
              {cleanText && (
                <div 
                  className={`px-3 py-2 rounded-lg text-[14px] leading-[1.4] break-words select-none ${isOwn ? "rounded-tr-none chat-bubble-own" : "rounded-tl-none chat-bubble-other"} ${isSwiping ? 'opacity-80' : ''} cursor-pointer active:brightness-90 transition-all`}
                  style={{ 
                    direction: "rtl", 
                    textAlign: "right",
                    ...(isAdmin && !isOwn ? { 
                      background: "linear-gradient(135deg, hsl(207, 90%, 54%, 0.12), hsl(207, 90%, 54%, 0.05))",
                      border: "1px solid hsl(207, 90%, 54%, 0.2)",
                    } : {})
                  }} 
                  onClick={handleBubbleClick}
                >
                  <TextWithMentions 
                    text={cleanText} 
                    profilesMap={profilesMap} 
                    onUsernameClick={onUsernameClick}
                  />
                </div>
              )}
              
              {/* أزرار الروابط المنفصلة أسفل النص */}
              {urls.map((url, index) => (
                <UrlButton key={index} url={url} />
              ))}
            </>
          ) : null}

          {/* Actions popup */}
          {showActionsMenu && (
            <div className="absolute left-0 right-0 z-[9999] animate-fade-in pointer-events-none" style={{ bottom: "calc(100% + 6px)" }}>
              <div className="flex justify-center">
                <div className="flex items-center gap-1 px-1.5 py-1 rounded-xl pointer-events-auto" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
                  {EMOJIS.slice(0, 4).map((emoji) => {
                    const myReaction = reactions.find((r) => r.emoji === emoji && (r as any).user_id === currentUserId);
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
                  {isCurrentUserAdmin && onPin && !isSticker && !isPoll && (
                    <button onClick={(e) => { e.stopPropagation(); onPin(message); setShowActionsMenu(false); }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:scale-110" style={{ background: "hsl(var(--primary) / 0.15)" }} title="تثبيت">
                      <Pin className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary))" }} />
                    </button>
                  )}
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
                    const myReaction = reactions.find((r) => r.emoji === emoji && (r as any).user_id === currentUserId);
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
          <div className={`flex flex-wrap gap-1 relative ${isOwn ? "justify-end" : "justify-start"}`}>
            {Object.entries(reactionGroups).map(([emoji, group]) => {
              const myReaction = group.find((r) => (r as any).user_id === currentUserId);
              return (
                <button key={emoji} onClick={(e) => { e.stopPropagation(); setReactorsPopup(true); }}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full hover:scale-105 active:scale-95"
                  style={{
                    fontSize: "clamp(9px, 2.5vw, 11px)",
                    background: myReaction ? "hsl(var(--primary) / 0.2)" : "hsl(var(--secondary))",
                    border: myReaction ? "1px solid hsl(var(--primary) / 0.4)" : "1px solid hsl(var(--border))"
                  }}>
                  <span>{emoji}</span>
                  <span style={{ color: "hsl(var(--foreground))" }}>{group.length}</span>
                </button>
              );
            })}
            {reactorsPopup && createPortal(
              <div
                className="fixed inset-0 z-[99999] flex items-center justify-center animate-fade-in"
                style={{ background: "rgba(0,0,0,0.60)", backdropFilter: "blur(6px)" }}
                onClick={(e) => { e.stopPropagation(); setReactorsPopup(false); }}
              >
                <div
                  className="animate-scale-in"
                  style={{
                    width: "300px",
                    maxWidth: "92vw",
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "22px",
                    boxShadow: "0 24px 48px -8px rgba(0,0,0,0.7)",
                    overflow: "hidden",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className="flex items-center justify-between px-4"
                    style={{ height: "52px", borderBottom: "1px solid hsl(var(--border))" }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {Object.keys(reactionGroups).map((e) => (
                          <span key={e} style={{ fontSize: "18px" }}>{e}</span>
                        ))}
                      </div>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "hsl(var(--foreground))" }}>التفاعلات</span>
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "1px 8px",
                          borderRadius: "9999px",
                          background: "hsl(var(--secondary))",
                          color: "hsl(var(--muted-foreground))",
                        }}
                      >{reactions.length}</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setReactorsPopup(false); }}
                      style={{
                        width: "28px",
                        height: "28px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "9999px",
                        background: "hsl(var(--secondary))",
                        color: "hsl(var(--muted-foreground))",
                        fontSize: "13px",
                        flexShrink: 0,
                      }}
                    >✕</button>
                  </div>

                  <div style={{ maxHeight: "380px", overflowY: "auto", padding: "8px 0" }}>
                    {reactions.map((r) => {
                      const uid = (r as any).user_id as string | undefined;
                      const name = (uid && profilesMap[uid]?.username) || r.username || "مستخدم";
                      const isMe = uid === currentUserId;
                      return (
                        <div
                          key={r.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            padding: "10px 16px",
                            minHeight: "56px",
                            boxSizing: "border-box",
                          }}
                        >
                          {uid && profilesMap[uid]?.avatar_url ? (
                            <img
                              src={profilesMap[uid].avatar_url!}
                              alt=""
                              style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "9999px",
                                objectFit: "cover",
                                flexShrink: 0,
                                border: "2px solid hsl(var(--border))",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "9999px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "11px",
                                fontWeight: 700,
                                flexShrink: 0,
                                background: `${getUserColor(name)}25`,
                                color: getUserColor(name),
                              }}
                            >{getInitials(name)}</div>
                          )}
                          <span
                            style={{
                              flex: 1,
                              minWidth: 0,
                              fontSize: "13px",
                              fontWeight: 500,
                              color: "hsl(var(--foreground))",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >{isMe ? "أنت" : name}</span>
                          <div
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "9999px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "18px",
                              flexShrink: 0,
                              background: "hsl(var(--secondary))",
                            }}
                          >{r.emoji}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      padding: "8px 16px",
                      textAlign: "center",
                      borderTop: "1px solid hsl(var(--border))",
                      color: "hsl(var(--muted-foreground))",
                      fontSize: "11px",
                    }}
                  >
                    {reactions.length} {reactions.length === 1 ? "شخص تفاعل" : "شخص تفاعلوا"}
                  </div>
                </div>
              </div>,
              document.body
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default ChatMessage;
