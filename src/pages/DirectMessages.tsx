import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Send, ChevronLeft, Reply, CornerUpLeft, X, Trash2 } from "lucide-react";
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
  onBack 
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Back button handling
  useEffect(() => {
    const handlePopState = () => {
      if (activeConversation) {
        setActiveConversation(null);
      } else {
        onBack();
      }
    };
    window.history.pushState({ page: 'dms' }, '', '/dms');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [onBack, activeConversation]);

  useEffect(() => {
    if (activeConversation) {
      window.history.pushState({ page: 'dm-conversation' }, '', `/dm/${activeConversation}`);
    }
  }, [activeConversation]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const getProfile = (uid: string) => profilesMap[uid] || { username: uid.slice(0, 6), avatar_url: null };

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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_reactions" }, (payload) => {
        const r = payload.new as DmReaction;
        setDmReactions((prev) => prev.find(x => x.id === r.id) ? prev : [...prev, r]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "dm_reactions" }, (payload) => {
        const deleted = payload.old as { id: string };
        setDmReactions((prev) => prev.filter((r) => r.id !== deleted.id));
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
      if (!convMap[otherUserId]) {
        convMap[otherUserId] = { userId: otherUserId, username: otherUsername, lastMessage: msg.content, lastTime: msg.created_at, unreadCount: 0, avatarUrl: otherProfile?.avatar_url || null };
      } else if (new Date(msg.created_at) > new Date(convMap[otherUserId].lastTime)) {
        convMap[otherUserId].lastMessage = msg.content;
        convMap[otherUserId].lastTime = msg.created_at;
      }
      if (msg.receiver_user_id === currentUserId && !msg.is_read) convMap[otherUserId].unreadCount++;
    });
    setConversations(Object.values(convMap).sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime()));
  };

  const handleSend = async () => {
    if (!input.trim() || !activeConversation || sending) return;
    const content = input.trim();
    setInput("");
    const currentReply = replyTo;
    setReplyTo(null);
    setSending(true);
    const receiverProfile = getProfile(activeConversation);
    await supabase.from("direct_messages").insert({
      sender_username: currentUsername,
      receiver_username: receiverProfile.username,
      sender_user_id: currentUserId,
      receiver_user_id: activeConversation,
      content,
      reply_to_id: currentReply?.id ?? null,
      reply_to_content: currentReply?.content?.slice(0, 80) ?? null,
    });
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
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

  return (
    <div className="flex flex-col h-screen select-none" style={{ background: "hsl(var(--chat-bg))" }}>
      {/* Header */}
      <header
        className="flex-shrink-0 px-4 py-3 flex items-center gap-3"
        style={{ background: "hsl(var(--chat-header))", borderBottom: "1px solid hsl(var(--border))" }}
      >
        <button onClick={() => { if (activeConversation) { setActiveConversation(null); setReplyTo(null); } else onBack(); }}
          className="p-1.5 rounded-lg" style={{ color: "hsl(var(--muted-foreground))" }}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        {activeConversation && activeProfile ? (
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
                      <span className="font-semibold text-sm" style={{ color: "hsl(var(--foreground))" }}>{conv.username}</span>
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

                  <div
                    className={`max-w-[70%] space-y-1 flex flex-col ${isOwn ? "items-end" : "items-start"}`}
                    onTouchStart={(e) => handleMsgTouchStart(msg.id, e.touches[0].clientX)}
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
                      <div
                        className={`px-3 py-2 rounded-2xl text-sm break-words select-none ${isOwn ? "rounded-tr-sm chat-bubble-own" : "rounded-tl-sm chat-bubble-other"}`}
                        style={{ direction: "rtl", textAlign: "right" }}
                      >
                        {msg.content}
                      </div>

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
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Reply preview */}
          {replyTo && (
            <div className="flex-shrink-0 mx-4 mb-2 px-3 py-2 rounded-xl flex items-center justify-between gap-3 animate-fade-in"
              style={{ background: "hsl(var(--chat-reply-bg))", border: "1px solid hsl(var(--border))", borderRight: "3px solid hsl(var(--primary))" }}>
              <div className="flex items-center gap-2 min-w-0">
                <CornerUpLeft className="w-4 h-4 flex-shrink-0" style={{ color: "hsl(var(--primary))" }} />
                <p className="text-xs truncate" style={{ color: "hsl(var(--muted-foreground))" }}>{replyTo.content}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="flex-shrink-0 p-1 rounded-lg" style={{ color: "hsl(var(--muted-foreground))" }}>
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Input */}
          <div className="flex-shrink-0 px-4 pb-4 pt-2">
            <div className="flex items-end gap-3 p-3 rounded-2xl" style={{ background: "hsl(var(--chat-input-bg))", border: "1px solid hsl(var(--border))" }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
                onKeyDown={handleKeyDown}
                placeholder="اكتب رسالتك..."
                rows={1}
                maxLength={500}
                className="flex-1 resize-none bg-transparent outline-none text-sm leading-relaxed select-text"
                style={{ color: "hsl(var(--foreground))", minHeight: "24px", maxHeight: "120px", direction: "rtl", textAlign: "right" }}
              />
              <button onClick={handleSend} disabled={!input.trim() || sending}
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-40"
                style={{ background: input.trim() && !sending ? "var(--gradient-primary)" : "hsl(var(--secondary))" }}>
                <Send className="w-4 h-4" style={{ color: input.trim() && !sending ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))" }} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DirectMessages;