import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Send, MessageSquare, ChevronLeft } from "lucide-react";
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
  profilesMap: Record<string, { username: string; avatar_url: string | null }>;
  onlineUsers: Set<string>;
  initialConversationUserId?: string | null;
  onBack: () => void;
}

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

const DirectMessages = ({ currentUserId, currentUsername, profilesMap, onlineUsers, initialConversationUserId, onBack }: DirectMessagesProps) => {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(initialConversationUserId || null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const getProfile = (uid: string) => profilesMap[uid] || { username: uid.slice(0, 6), avatar_url: null };

  // Fetch all DMs by user_id
  useEffect(() => {
    const fetchDMs = async () => {
      const { data, error } = await supabase
        .from("direct_messages")
        .select("*")
        .or(`sender_user_id.eq.${currentUserId},receiver_user_id.eq.${currentUserId}`)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setMessages(data as DirectMessage[]);
        buildConversations(data as DirectMessage[]);
      }
      setLoading(false);
    };
    fetchDMs();
  }, [currentUserId]);

  // Realtime subscription
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
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUserId]);

  // Mark messages as read
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
        convMap[otherUserId] = {
          userId: otherUserId,
          username: otherUsername,
          lastMessage: msg.content,
          lastTime: msg.created_at,
          unreadCount: 0,
          avatarUrl: otherProfile?.avatar_url || null,
        };
      } else {
        if (new Date(msg.created_at) > new Date(convMap[otherUserId].lastTime)) {
          convMap[otherUserId].lastMessage = msg.content;
          convMap[otherUserId].lastTime = msg.created_at;
        }
      }
      if (msg.receiver_user_id === currentUserId && !msg.is_read) convMap[otherUserId].unreadCount++;
    });
    setConversations(Object.values(convMap).sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime()));
  };

  const handleSend = async () => {
    if (!input.trim() || !activeConversation || sending) return;
    const content = input.trim();
    setInput("");
    setSending(true);

    const receiverProfile = getProfile(activeConversation);
    await supabase.from("direct_messages").insert({
      sender_username: currentUsername,
      receiver_username: receiverProfile.username,
      sender_user_id: currentUserId,
      receiver_user_id: activeConversation,
      content,
    });
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const activeMessages = messages.filter(
    (m) =>
      (m.sender_user_id === currentUserId && m.receiver_user_id === activeConversation) ||
      (m.sender_user_id === activeConversation && m.receiver_user_id === currentUserId)
  );

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  const activeProfile = activeConversation ? getProfile(activeConversation) : null;
  const isActiveOnline = activeConversation ? onlineUsers.has(activeConversation) : false;

  return (
    <div className="flex h-screen select-none" style={{ background: "hsl(var(--chat-bg))" }}>
      {/* Conversations List */}
      <div
        className={`flex flex-col border-l ${activeConversation ? "hidden md:flex" : "flex"} w-full md:w-80`}
        style={{ background: "hsl(var(--chat-header))", borderColor: "hsl(var(--border))" }}
      >
        <div
          className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid hsl(var(--border))", boxShadow: "0 1px 20px hsl(220 16% 4% / 0.4)" }}
        >
          <button onClick={onBack} className="p-2 rounded-xl hover:opacity-70 transition-opacity" style={{ color: "hsl(var(--muted-foreground))" }}>
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-sm" style={{ color: "hsl(var(--foreground))" }}>الرسائل الخاصة</h1>
            {totalUnread > 0 && (
              <p className="text-xs" style={{ color: "hsl(var(--primary))" }}>{totalUnread} رسالة غير مقروءة</p>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "hsl(var(--primary))", borderTopColor: "transparent" }} />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 gap-4 text-center px-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "hsl(var(--secondary))" }}>
                <MessageSquare className="w-8 h-8" style={{ color: "hsl(var(--muted-foreground))" }} />
              </div>
              <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                لا توجد محادثات بعد. اضغط على اسم مستخدم في الدردشة العامة لبدء محادثة خاصة.
              </p>
            </div>
          ) : (
            conversations.map((conv) => {
              const color = getUserColor(conv.username);
              const avatar = conv.avatarUrl || profilesMap[conv.userId]?.avatar_url;
              const isActive = activeConversation === conv.userId;
              const isOnline = onlineUsers.has(conv.userId);
              return (
                <button
                  key={conv.userId}
                  onClick={() => setActiveConversation(conv.userId)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-right transition-colors"
                  style={{
                    background: isActive ? "hsl(var(--primary) / 0.1)" : "transparent",
                    borderRight: isActive ? "3px solid hsl(var(--primary))" : "3px solid transparent",
                  }}
                >
                  <div className="relative flex-shrink-0">
                    {avatar ? (
                      <img src={avatar} alt={conv.username} className="w-11 h-11 rounded-full object-cover" style={{ border: `2px solid ${color}55` }} />
                    ) : (
                      <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: `${color}22`, border: `2px solid ${color}55`, color }}>
                        {conv.username.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    {/* Online indicator */}
                    <span
                      className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2"
                      style={{
                        background: isOnline ? "hsl(var(--chat-online))" : "hsl(var(--muted-foreground) / 0.4)",
                        borderColor: "hsl(var(--chat-header))",
                      }}
                    />
                    {conv.unreadCount > 0 && (
                      <span
                        className="absolute -top-1 -right-1 min-w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center px-1"
                        style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                      >
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 text-right">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs flex-shrink-0" style={{ color: "hsl(var(--chat-timestamp))" }}>
                        {formatDistanceToNow(new Date(conv.lastTime), { addSuffix: false, locale: ar })}
                      </span>
                      <span className={`text-sm font-semibold truncate ${conv.unreadCount > 0 ? "font-bold" : ""}`} style={{ color: "hsl(var(--foreground))" }}>
                        {conv.username}
                      </span>
                    </div>
                    <p className={`text-xs truncate mt-0.5 ${conv.unreadCount > 0 ? "font-medium" : ""}`}
                      style={{ color: conv.unreadCount > 0 ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))" }}>
                      {conv.lastMessage}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className={`flex-1 flex flex-col ${!activeConversation ? "hidden md:flex" : "flex"}`}>
        {!activeConversation ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{ background: "hsl(var(--secondary))" }}>
              <MessageSquare className="w-10 h-10" style={{ color: "hsl(var(--muted-foreground))" }} />
            </div>
            <p className="text-lg font-semibold" style={{ color: "hsl(var(--foreground))" }}>اختر محادثة</p>
            <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              اختر محادثة من القائمة أو ابدأ محادثة جديدة من الدردشة العامة
            </p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div
              className="flex-shrink-0 px-4 py-3 flex items-center gap-3"
              style={{ background: "hsl(var(--chat-header))", borderBottom: "1px solid hsl(var(--border))", boxShadow: "0 1px 20px hsl(220 16% 4% / 0.4)" }}
            >
              <button onClick={() => setActiveConversation(null)} className="md:hidden p-2 rounded-xl hover:opacity-70 transition-opacity" style={{ color: "hsl(var(--muted-foreground))" }}>
                <ChevronLeft className="w-5 h-5" />
              </button>
              {(() => {
                const avatar = activeProfile?.avatar_url;
                const color = getUserColor(activeProfile?.username || "");
                return (
                  <div className="relative">
                    {avatar ? (
                      <img src={avatar} alt="" className="w-9 h-9 rounded-full object-cover" style={{ border: `2px solid ${color}55` }} />
                    ) : (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: `${color}22`, border: `2px solid ${color}55`, color }}>
                        {(activeProfile?.username || "").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span
                      className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2"
                      style={{
                        background: isActiveOnline ? "hsl(var(--chat-online))" : "hsl(var(--muted-foreground) / 0.4)",
                        borderColor: "hsl(var(--chat-header))",
                      }}
                    />
                  </div>
                );
              })()}
              <div>
                <span className="font-semibold text-sm" style={{ color: "hsl(var(--foreground))" }}>
                  {activeProfile?.username}
                </span>
                <p className="text-xs" style={{ color: isActiveOnline ? "hsl(var(--chat-online))" : "hsl(var(--muted-foreground))" }}>
                  {isActiveOnline ? "متصل" : "غير متصل"}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {activeMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                  <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                    ابدأ المحادثة مع {activeProfile?.username} 👋
                  </p>
                </div>
              ) : (
                activeMessages.map((msg) => {
                  const isOwn = msg.sender_user_id === currentUserId;
                  return (
                    <div key={msg.id} className={`flex gap-2 animate-fade-in ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
                      <div
                        className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm leading-relaxed break-words ${isOwn ? "rounded-tr-sm chat-bubble-own" : "rounded-tl-sm chat-bubble-other"}`}
                        style={{ direction: "rtl", textAlign: "right" }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="flex-shrink-0 px-4 pb-4 pt-2">
              <div
                className="flex items-end gap-3 p-3 rounded-2xl"
                style={{ background: "hsl(var(--chat-input-bg))", border: "1px solid hsl(var(--border))", transition: "border-color 0.2s" }}
                onFocusCapture={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "hsl(var(--primary))";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px hsl(var(--primary) / 0.1)";
                }}
                onBlurCapture={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "hsl(var(--border))";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={`رسالة لـ ${activeProfile?.username}...`}
                  rows={1}
                  maxLength={500}
                  className="flex-1 resize-none bg-transparent outline-none text-sm leading-relaxed select-text"
                  style={{ color: "hsl(var(--foreground))", minHeight: "24px", maxHeight: "120px", direction: "rtl", textAlign: "right" }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed glow-primary"
                  style={{ background: input.trim() && !sending ? "var(--gradient-primary)" : "hsl(var(--secondary))" }}
                >
                  <Send className="w-4 h-4" style={{ color: input.trim() && !sending ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))" }} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DirectMessages;
