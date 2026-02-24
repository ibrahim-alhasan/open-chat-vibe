import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Send, ChevronLeft, Reply, CornerUpLeft, X, Trash2, Image, Ban, Camera, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface DirectMessage {
  id: string;
  sender_username: string;
  receiver_username: string;
  sender_user_id: string | null;
  receiver_user_id: string | null;
  content: string;
  is_read: boolean;
  created_at: string;
  reply_to_id?: string | null;
  reply_to_content?: string | null;
  image_url?: string | null;
  image_name?: string | null;
}

interface DmReaction {
  id: string;
  dm_id: string;
  user_id: string;
  emoji: string;
}

interface Conversation {
  userId: string;
  username: string;
  lastMessage: string;
  lastTime: string;
  unreadCount: number;
  avatarUrl?: string | null;
}

interface DirectMessagesProps {
  currentUserId: string;
  currentUsername: string;
  profilesMap: Record<string, { username: string; avatar_url: string | null; allow_dms?: boolean }>;
  onlineUsers: Set<string>;
  initialConversationUserId?: string | null;
  onBack: () => void;
  isAdmin?: boolean;
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

const DirectMessages = ({ 
  currentUserId, 
  currentUsername, 
  profilesMap, 
  onlineUsers, 
  initialConversationUserId, 
  onBack,
  isAdmin = false
}: DirectMessagesProps) => {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [dmReactions, setDmReactions] = useState<DmReaction[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(initialConversationUserId || null);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<DirectMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);
  const [emojiPickerMsg, setEmojiPickerMsg] = useState<string | null>(null);
  const [blockedByMe, setBlockedByMe] = useState<Set<string>>(new Set());
  const [blockedMe, setBlockedMe] = useState<Set<string>>(new Set());
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Back button handling - use window.history for proper navigation
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (viewingImage) {
        setViewingImage(null);
      } else if (activeConversation) {
        setActiveConversation(null);
        setReplyTo(null);
        setImagePreview(null);
        setSelectedImage(null);
      } else {
        onBack();
      }
    };
    
    // Push initial DM state
    window.history.pushState({ page: 'dms' }, '', '/');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [onBack, activeConversation, viewingImage]);

  useEffect(() => {
    if (activeConversation && !viewingImage) {
      window.history.pushState({ page: 'dm-conversation' }, '', '/');
    }
  }, [activeConversation, viewingImage]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const getProfile = (uid: string) => profilesMap[uid] || { username: uid.slice(0, 6), avatar_url: null };

  // Fetch blocked users
  useEffect(() => {
    const fetchBlocked = async () => {
      const [byMe, meBy] = await Promise.all([
        supabase.from("blocked_users").select("blocked_user_id").eq("blocker_user_id", currentUserId),
        supabase.from("blocked_users").select("blocker_user_id").eq("blocked_user_id", currentUserId),
      ]);
      if (byMe.data) setBlockedByMe(new Set(byMe.data.map((b: any) => b.blocked_user_id)));
      if (meBy.data) setBlockedMe(new Set(meBy.data.map((b: any) => b.blocker_user_id)));
    };
    fetchBlocked();
  }, [currentUserId]);

  // Fetch DMs
  useEffect(() => {
    const fetchDMs = async () => {
      const [dmsRes, reactionsRes] = await Promise.all([
        supabase.from("direct_messages").select("*")
          .or(`sender_user_id.eq.${currentUserId},receiver_user_id.eq.${currentUserId}`)
          .order("created_at", { ascending: true }),
        supabase.from("dm_reactions").select("*"),
      ]);
      if (!dmsRes.error && dmsRes.data) {
        setMessages(dmsRes.data as DirectMessage[]);
        buildConversations(dmsRes.data as DirectMessage[]);
      }
      if (!reactionsRes.error && reactionsRes.data) setDmReactions(reactionsRes.data as DmReaction[]);
      setLoading(false);
    };
    fetchDMs();
  }, [currentUserId]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`dm-${currentUserId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, (payload) => {
        const msg = payload.new as DirectMessage;
        if (msg.sender_user_id === currentUserId || msg.receiver_user_id === currentUserId) {
          setMessages((prev) => {
            if (prev.find((m) => m.id === msg.id)) return prev;
            const newList = [...prev, msg];
            buildConversations(newList);
            return newList;
          });
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "direct_messages" }, (payload) => {
        const updated = payload.new as DirectMessage;
        setMessages((prev) => {
          const newList = prev.map((m) => (m.id === updated.id ? updated : m));
          buildConversations(newList);
          return newList;
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "direct_messages" }, (payload) => {
        const deleted = payload.old as { id: string };
        setMessages((prev) => {
          const newList = prev.filter((m) => m.id !== deleted.id);
          buildConversations(newList);
          return newList;
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_reactions" }, (payload) => {
        const r = payload.new as DmReaction;
        setDmReactions((prev) => prev.find(x => x.id === r.id) ? prev : [...prev, r]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "dm_reactions" }, (payload) => {
        const deleted = payload.old as { id: string };
        setDmReactions((prev) => prev.filter((r) => r.id !== deleted.id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "blocked_users" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const row = payload.new as any;
          if (row.blocker_user_id === currentUserId) setBlockedByMe(prev => new Set([...prev, row.blocked_user_id]));
          if (row.blocked_user_id === currentUserId) setBlockedMe(prev => new Set([...prev, row.blocker_user_id]));
        }
        if (payload.eventType === "DELETE") {
          const row = payload.old as any;
          if (row.blocker_user_id === currentUserId) setBlockedByMe(prev => { const s = new Set(prev); s.delete(row.blocked_user_id); return s; });
          if (row.blocked_user_id === currentUserId) setBlockedMe(prev => { const s = new Set(prev); s.delete(row.blocker_user_id); return s; });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUserId]);

  // Mark as read
  useEffect(() => {
    if (!activeConversation) return;
    const unreadIds = messages
      .filter((m) => m.sender_user_id === activeConversation && m.receiver_user_id === currentUserId && !m.is_read)
      .map((m) => m.id);
    if (unreadIds.length > 0) {
      supabase.from("direct_messages").update({ is_read: true }).in("id", unreadIds).then(() => {
        setMessages((prev) => prev.map((m) => (unreadIds.includes(m.id) ? { ...m, is_read: true } : m)));
      });
    }
  }, [activeConversation, currentUserId, messages]);

  useEffect(() => { scrollToBottom(); }, [messages, activeConversation, scrollToBottom]);

  const buildConversations = (allMessages: DirectMessage[]) => {
    const convMap: Record<string, Conversation> = {};
    allMessages.forEach((msg) => {
      const otherUserId = msg.sender_user_id === currentUserId ? msg.receiver_user_id : msg.sender_user_id;
      if (!otherUserId) return;
      const otherProfile = profilesMap[otherUserId];
      const otherUsername = otherProfile ? otherProfile.username : (msg.sender_user_id === currentUserId ? msg.receiver_username : msg.sender_username);
      const lastMessageContent = msg.image_url ? "📷 صورة" : msg.content;
      
      if (!convMap[otherUserId]) {
        convMap[otherUserId] = { 
          userId: otherUserId, 
          username: otherUsername, 
          lastMessage: lastMessageContent, 
          lastTime: msg.created_at, 
          unreadCount: 0, 
          avatarUrl: otherProfile?.avatar_url || null 
        };
      } else if (new Date(msg.created_at) > new Date(convMap[otherUserId].lastTime)) {
        convMap[otherUserId].lastMessage = lastMessageContent;
        convMap[otherUserId].lastTime = msg.created_at;
      }
      if (msg.receiver_user_id === currentUserId && !msg.is_read) convMap[otherUserId].unreadCount++;
    });
    setConversations(Object.values(convMap).sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime()));
  };

  const isConversationBlocked = activeConversation ? (blockedByMe.has(activeConversation) || blockedMe.has(activeConversation)) : false;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert("حجم الصورة يجب أن يكون أقل من 5 ميجابايت");
        return;
      }
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        alert("يرجى اختيار صورة فقط");
        return;
      }

      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUserId}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('direct_message_images')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Error uploading image:', uploadError);
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('direct_message_images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error in uploadImage:', error);
      return null;
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || !activeConversation || sending || isConversationBlocked) return;
    
    const content = input.trim();
    setInput("");
    const currentReply = replyTo;
    setReplyTo(null);
    setSending(true);
    setUploadingImage(true);
    
    const receiverProfile = getProfile(activeConversation);
    
    let imageUrl = null;
    let imageName = null;
    
    if (selectedImage) {
      imageUrl = await uploadImage(selectedImage);
      imageName = selectedImage.name;
      setSelectedImage(null);
      setImagePreview(null);
    }

    await supabase.from("direct_messages").insert({
      sender_username: currentUsername,
      receiver_username: receiverProfile.username,
      sender_user_id: currentUserId,
      receiver_user_id: activeConversation,
      content: content || (imageUrl ? "📷 صورة" : ""),
      reply_to_id: currentReply?.id ?? null,
      reply_to_content: currentReply?.content?.slice(0, 80) ?? null,
      image_url: imageUrl,
      image_name: imageName
    });
    
    setSending(false);
    setUploadingImage(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { 
      e.preventDefault(); 
      handleSend(); 
    }
  };

  const handleDmReaction = async (dmId: string, emoji: string) => {
    setEmojiPickerMsg(null);
    const existing = dmReactions.find((r) => r.dm_id === dmId && r.emoji === emoji && r.user_id === currentUserId);
    if (existing) {
      await supabase.from("dm_reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("dm_reactions").insert({ dm_id: dmId, user_id: currentUserId, emoji });
    }
  };

  const handleBlockUser = async () => {
    if (!activeConversation) return;
    
    if (blockedByMe.has(activeConversation)) {
      // Unblock
      await supabase.from("blocked_users")
        .delete()
        .eq("blocker_user_id", currentUserId)
        .eq("blocked_user_id", activeConversation);
    } else {
      // Block
      await supabase.from("blocked_users").insert({
        blocker_user_id: currentUserId,
        blocked_user_id: activeConversation
      });
    }
  };

  const handleDeleteMessage = async (messageId: string, imageUrl?: string | null) => {
    if (!isAdmin && !messages.find(m => m.id === messageId)?.sender_user_id === currentUserId) return;
    
    // Delete image from storage if exists
    if (imageUrl) {
      const path = imageUrl.split('/').pop();
      if (path) {
        await supabase.storage.from('direct_message_images').remove([path]);
      }
    }
    
    await supabase.from("direct_messages").delete().eq("id", messageId);
  };

  const activeMessages = messages.filter(
    (m) =>
      (m.sender_user_id === currentUserId && m.receiver_user_id === activeConversation) ||
      (m.sender_user_id === activeConversation && m.receiver_user_id === currentUserId)
  );

  const activeProfile = activeConversation ? getProfile(activeConversation) : null;
  const isActiveOnline = activeConversation ? onlineUsers.has(activeConversation) : false;

  // Swipe state per message
  const [swipeState, setSwipeState] = useState<{ msgId: string; offset: number; startX: number; startTime: number } | null>(null);

  const handleMsgTouchStart = (msgId: string, x: number) => {
    setSwipeState({ msgId, offset: 0, startX: x, startTime: Date.now() });
  };
  const handleMsgTouchMove = (x: number) => {
    if (!swipeState) return;
    const delta = x - swipeState.startX;
    if (delta > 0) setSwipeState({ ...swipeState, offset: Math.min(delta, 100) });
  };
  const handleMsgTouchEnd = () => {
    if (!swipeState) return;
    if (swipeState.offset > 50 && Date.now() - swipeState.startTime < 500) {
      const msg = activeMessages.find(m => m.id === swipeState.msgId);
      if (msg) setReplyTo(msg);
    }
    setSwipeState(null);
  };

  // Image viewer modal
  if (viewingImage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={() => setViewingImage(null)}>
        <img src={viewingImage} alt="Large view" className="max-w-full max-h-full object-contain" />
        <button 
          onClick={() => setViewingImage(null)}
          className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen select-none" style={{ background: "hsl(var(--chat-bg))" }}>
      {/* Header */}
      <header
        className="flex-shrink-0 px-4 py-3 flex items-center gap-3"
        style={{ background: "hsl(var(--chat-header))", borderBottom: "1px solid hsl(var(--border))" }}
      >
        <button onClick={() => { if (activeConversation) { setActiveConversation(null); setReplyTo(null); setImagePreview(null); setSelectedImage(null); } else onBack(); }}
          className="p-1.5 rounded-lg" style={{ color: "hsl(var(--muted-foreground))" }}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        {activeConversation && activeProfile ? (
          <div className="flex items-center justify-between flex-1">
            <div className="flex items-center gap-3">
              <div className="relative">
                {activeProfile.avatar_url ? (
                  <img src={activeProfile.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" style={{ border: `2px solid ${getUserColor(activeProfile.username)}55` }} />
                ) : (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: `${getUserColor(activeProfile.username)}22`, color: getUserColor(activeProfile.username), border: `2px solid ${getUserColor(activeProfile.username)}55` }}>
                    {activeProfile.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
                {isActiveOnline && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2" style={{ background: "hsl(var(--chat-online))", borderColor: "hsl(var(--chat-header))" }} />}
              </div>
              <div>
                <h2 className="font-bold text-sm" style={{ color: "hsl(var(--foreground))" }}>{activeProfile.username}</h2>
                <p className="text-xs" style={{ color: isActiveOnline ? "hsl(var(--chat-online))" : "hsl(var(--muted-foreground))" }}>
                  {isActiveOnline ? "متصل" : "غير متصل"}
                </p>
              </div>
            </div>
            
            {/* Block/Unblock button */}
            <button
              onClick={handleBlockUser}
              className={`p-2 rounded-lg transition-all active:scale-90 flex items-center gap-2 text-sm ${
                blockedByMe.has(activeConversation) ? 'opacity-70' : ''
              }`}
              style={{ 
                background: blockedByMe.has(activeConversation) ? "hsl(var(--destructive) / 0.1)" : "hsl(var(--secondary))",
                color: blockedByMe.has(activeConversation) ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))"
              }}
            >
              <Ban className="w-4 h-4" />
              <span className="hidden sm:inline">
                {blockedByMe.has(activeConversation) ? "إلغاء الحظر" : "حظر"}
              </span>
            </button>
          </div>
        ) : (
          <h2 className="font-bold text-sm" style={{ color: "hsl(var(--foreground))" }}>الرسائل الخاصة</h2>
        )}
      </header>

      {!activeConversation ? (
        /* Conversation list */
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "hsl(var(--primary))", borderTopColor: "transparent" }} />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>لا توجد محادثات بعد</p>
            </div>
          ) : (
            conversations.map((conv) => {
              const isOnline = onlineUsers.has(conv.userId);
              const isBlocked = blockedByMe.has(conv.userId);
              const blockedByOther = blockedMe.has(conv.userId);
              
              return (
                <div
                  key={conv.userId}
                  onClick={() => setActiveConversation(conv.userId)}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:opacity-80"
                  style={{ borderBottom: "1px solid hsl(var(--border) / 0.5)" }}
                >
                  <div className="relative flex-shrink-0">
                    {conv.avatarUrl ? (
                      <img src={conv.avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover" style={{ border: `2px solid ${getUserColor(conv.username)}55` }} />
                    ) : (
                      <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: `${getUserColor(conv.username)}22`, color: getUserColor(conv.username), border: `2px solid ${getUserColor(conv.username)}55` }}>
                        {conv.username.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    {isOnline && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2" style={{ background: "hsl(var(--chat-online))", borderColor: "hsl(var(--chat-bg))" }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm flex items-center gap-2" style={{ color: "hsl(var(--foreground))" }}>
                        {conv.username}
                        {(isBlocked || blockedByOther) && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "hsl(var(--destructive) / 0.1)", color: "hsl(var(--destructive))" }}>
                            {isBlocked ? "محظور" : "محظور من قبل المستخدم"}
                          </span>
                        )}
                      </span>
                      <span className="text-xs" style={{ color: "hsl(var(--chat-timestamp))" }}>
                        {formatDistanceToNow(new Date(conv.lastTime), { addSuffix: true, locale: ar })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs truncate" style={{ color: "hsl(var(--muted-foreground))" }}>{conv.lastMessage}</p>
                      {conv.unreadCount > 0 && (
                        <span className="min-w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center px-1"
                          style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", fontSize: "10px" }}>
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Active conversation */
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {activeMessages.map((msg) => {
              const isOwn = msg.sender_user_id === currentUserId;
              const senderProfile = msg.sender_user_id ? getProfile(msg.sender_user_id) : { username: msg.sender_username, avatar_url: null };
              const msgReactions = dmReactions.filter(r => r.dm_id === msg.id);
              const reactionGroups = msgReactions.reduce<Record<string, DmReaction[]>>((acc, r) => {
                if (!acc[r.emoji]) acc[r.emoji] = [];
                acc[r.emoji].push(r);
                return acc;
              }, {});
              const currentSwipe = swipeState?.msgId === msg.id ? swipeState.offset : 0;
              const showSwipeReply = currentSwipe > 30;
              const canDelete = isAdmin || isOwn;

              return (
                <div
                  key={msg.id}
                  className={`flex gap-2 animate-fade-in ${isOwn ? "flex-row-reverse" : "flex-row"}`}
                  onMouseEnter={() => setHoveredMsg(msg.id)}
                  onMouseLeave={() => { setHoveredMsg(null); if (swipeState?.msgId === msg.id) setSwipeState(null); }}
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0 mt-1">
                    {senderProfile.avatar_url ? (
                      <img src={senderProfile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" style={{ border: `2px solid ${getUserColor(senderProfile.username)}55` }} />
                    ) : (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: `${getUserColor(senderProfile.username)}22`, color: getUserColor(senderProfile.username), border: `2px solid ${getUserColor(senderProfile.username)}55` }}>
                        {senderProfile.username.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    {/* Swipe reply indicator */}
                    {showSwipeReply && (
                      <div className="absolute -right-10 top-1/2 -translate-y-1/2 animate-pulse z-10">
                        <Reply className="w-5 h-5" style={{ color: "hsl(var(--primary))" }} />
                      </div>
                    )}

                    <div
                      className={`max-w-[70vw] space-y-1 flex flex-col ${isOwn ? "items-end" : "items-start"}`}
                      onTouchStart={(e) => { if (!(e.target as HTMLElement).closest('button')) handleMsgTouchStart(msg.id, e.touches[0].clientX); }}
                      onTouchMove={(e) => handleMsgTouchMove(e.touches[0].clientX)}
                      onTouchEnd={handleMsgTouchEnd}
                      onMouseDown={(e) => { if (!(e.target as HTMLElement).closest('button')) handleMsgTouchStart(msg.id, e.clientX); }}
                      onMouseMove={(e) => handleMsgTouchMove(e.clientX)}
                      onMouseUp={handleMsgTouchEnd}
                      style={{ transform: `translateX(${currentSwipe}px)`, transition: swipeState?.msgId === msg.id ? 'none' : 'transform 0.2s ease' }}
                    >
                      {/* Reply preview */}
                      {msg.reply_to_content && (
                        <div className="px-3 py-1.5 rounded-lg text-xs" style={{ background: "hsl(var(--chat-reply-bg))", border: "1px solid hsl(var(--border))", borderRight: isOwn ? "2px solid hsl(var(--primary))" : undefined, borderLeft: !isOwn ? "2px solid hsl(var(--primary))" : undefined }}>
                          <p className="truncate" style={{ color: "hsl(var(--muted-foreground))" }}>{msg.reply_to_content}</p>
                        </div>
                      )}

                      <div className="relative">
                        {/* Image message */}
                        {msg.image_url && (
                          <div 
                            className={`mb-2 rounded-2xl overflow-hidden cursor-pointer transition-transform hover:scale-[1.02] ${
                              isOwn ? "rounded-tr-sm" : "rounded-tl-sm"
                            }`}
                            onClick={() => setViewingImage(msg.image_url!)}
                          >
                            <img 
                              src={msg.image_url} 
                              alt={msg.image_name || "صورة"} 
                              className="max-w-[250px] max-h-[300px] object-cover"
                            />
                            {msg.image_name && (
                              <div className="px-3 py-1 text-xs flex items-center gap-1" style={{ background: "hsl(var(--secondary))" }}>
                                <FileText className="w-3 h-3" />
                                <span className="truncate">{msg.image_name}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Text message */}
                        {msg.content && msg.content !== "📷 صورة" && (
                          <div
                            className={`px-3 py-2 rounded-2xl text-sm break-words select-none ${
                              isOwn ? "rounded-tr-sm chat-bubble-own" : "rounded-tl-sm chat-bubble-other"
                            }`}
                            style={{ direction: "rtl", textAlign: "right" }}
                          >
                            {msg.content}
                          </div>
                        )}

                        {/* Emoji picker */}
                        {emojiPickerMsg === msg.id && (
                          <div className={`absolute -top-12 flex gap-1 p-2 rounded-2xl z-50 animate-fade-in ${isOwn ? "right-0" : "left-0"}`}
                            style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "0 8px 32px hsl(220 16% 4% / 0.6)" }}>
                            {EMOJIS.map((emoji) => {
                              const myReaction = msgReactions.find((r) => r.emoji === emoji && r.user_id === currentUserId);
                              return (
                                <button key={emoji} onClick={() => handleDmReaction(msg.id, emoji)}
                                  className="w-8 h-8 flex items-center justify-center rounded-xl text-base transition-all hover:scale-125 active:scale-90"
                                  style={{ background: myReaction ? "hsl(var(--primary) / 0.2)" : "transparent", border: myReaction ? "1px solid hsl(var(--primary) / 0.4)" : "1px solid transparent" }}>
                                  {emoji}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Action buttons */}
                        {hoveredMsg === msg.id && (
                          <div className={`absolute top-0 flex gap-1 z-10 ${isOwn ? "-left-16" : "-right-16"}`}>
                            <button onClick={() => setEmojiPickerMsg(emojiPickerMsg === msg.id ? null : msg.id)}
                              className="p-1 rounded-lg" style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
                              <span className="text-xs">😊</span>
                            </button>
                            <button onClick={() => setReplyTo(msg)}
                              className="p-1 rounded-lg" style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
                              <Reply className="w-3 h-3" />
                            </button>
                            {canDelete && (
                              <button onClick={() => handleDeleteMessage(msg.id, msg.image_url)}
                                className="p-1 rounded-lg" style={{ background: "hsl(var(--destructive) / 0.1)", border: "1px solid hsl(var(--destructive) / 0.3)", color: "hsl(var(--destructive))" }}>
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Reactions */}
                      {Object.keys(reactionGroups).length > 0 && (
                        <div className={`flex flex-wrap gap-1 ${isOwn ? "justify-end" : "justify-start"}`}>
                          {Object.entries(reactionGroups).map(([emoji, group]) => {
                            const myReaction = group.find((r) => r.user_id === currentUserId);
                            return (
                              <button key={emoji} onClick={() => handleDmReaction(msg.id, emoji)}
                                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs hover:scale-105 active:scale-95"
                                style={{ background: myReaction ? "hsl(var(--primary) / 0.2)" : "hsl(var(--secondary))", border: myReaction ? "1px solid hsl(var(--primary) / 0.5)" : "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }}>
                                <span>{emoji}</span><span>{group.length}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <span className="text-xs px-1" style={{ color: "hsl(var(--chat-timestamp))" }}>
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: ar })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Image preview */}
          {imagePreview && (
            <div className="flex-shrink-0 mx-4 mb-2 p-2 rounded-xl flex items-center gap-3 animate-fade-in"
              style={{ background: "hsl(var(--chat-reply-bg))", border: "1px solid hsl(var(--border))" }}>
              <img src={imagePreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg" />
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate" style={{ color: "hsl(var(--foreground))" }}>{selectedImage?.name}</p>
                <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {((selectedImage?.size || 0) / 1024).toFixed(1)} KB
                </p>
              </div>
              <button 
                onClick={() => { setSelectedImage(null); setImagePreview(null); }}
                className="p-1.5 rounded-lg" style={{ color: "hsl(var(--muted-foreground))" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Reply preview */}
          {replyTo && (
            <div className="flex-shrink-0 mx-4 mb-2 px-3 py-2 rounded-xl flex items-center justify-between gap-3 animate-fade-in"
              style={{ background: "hsl(var(--chat-reply-bg))", border: "1px solid hsl(var(--border))", borderRight: "3px solid hsl(var(--primary))" }}>
              <div className="flex items-center gap-2 min-w-0">
                <CornerUpLeft className="w-4 h-4 flex-shrink-0" style={{ color: "hsl(var(--primary))" }} />
                <p className="text-xs truncate" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {replyTo.image_url ? "📷 صورة" : replyTo.content}
                </p>
              </div>
              <button onClick={() => setReplyTo(null)} className="flex-shrink-0 p-1 rounded-lg" style={{ color: "hsl(var(--muted-foreground))" }}>
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Input or blocked message */}
          <div className="flex-shrink-0 px-4 pb-4 pt-2">
            {isConversationBlocked ? (
              <div className="flex items-center justify-center py-3 rounded-2xl text-sm"
                style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", border: "1px solid hsl(var(--border))" }}>
                {blockedByMe.has(activeConversation!) ? "لقد حظرت هذا المستخدم" : "هذا المستخدم حظرك"}
              </div>
            ) : (
              <div className="flex items-end gap-2 p-2 rounded-2xl" style={{ background: "hsl(var(--chat-input-bg))", border: "1px solid hsl(var(--border))" }}>
                {/* Image upload button */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-40"
                  style={{ background: "hsl(var(--secondary))" }}
                >
                  <Camera className="w-4 h-4" style={{ color: "hsl(var(--muted-foreground))" }} />
                </button>

                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
                  onKeyDown={handleKeyDown}
                  placeholder={uploadingImage ? "جاري رفع الصورة..." : "اكتب رسالتك..."}
                  rows={1}
                  maxLength={500}
                  disabled={uploadingImage}
                  className="flex-1 resize-none bg-transparent outline-none text-sm leading-relaxed select-text disabled:opacity-50"
                  style={{ color: "hsl(var(--foreground))", minHeight: "24px", maxHeight: "120px", direction: "rtl", textAlign: "right" }}
                />
                <button onClick={handleSend} disabled={(!input.trim() && !selectedImage) || sending || uploadingImage}
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-40"
                  style={{ background: (input.trim() || selectedImage) && !sending && !uploadingImage ? "var(--gradient-primary)" : "hsl(var(--secondary))" }}>
                  <Send className="w-4 h-4" style={{ color: (input.trim() || selectedImage) && !sending && !uploadingImage ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))" }} />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default DirectMessages;
