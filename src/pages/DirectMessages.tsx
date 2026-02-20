import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Send, MessageSquare, ChevronLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface DirectMessage {
  id: string;
  sender_username: string;
  receiver_username: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface Conversation {
  username: string;
  lastMessage: string;
  lastTime: string;
  unreadCount: number;
  avatarUrl?: string | null;
}

interface DirectMessagesProps {
  currentUsername: string;
  profilesMap: Record<string, string | null>;
  initialConversation?: string | null;
  onBack: () => void;
}

const getUserColor = (username: string) => {
  const colors = [
    "hsl(199, 89%, 55%)",
    "hsl(142, 71%, 45%)",
    "hsl(38, 92%, 55%)",
    "hsl(280, 65%, 60%)",
    "hsl(0, 72%, 60%)",
    "hsl(32, 98%, 55%)",
    "hsl(168, 75%, 42%)",
    "hsl(220, 80%, 60%)",
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const DirectMessages = ({ currentUsername, profilesMap, initialConversation, onBack }: DirectMessagesProps) => {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(initialConversation || null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Fetch all DMs for this user
  useEffect(() => {
    const fetchDMs = async () => {
      const { data, error } = await supabase
        .from("direct_messages")
        .select("*")
        .or(`sender_username.eq.${currentUsername},receiver_username.eq.${currentUsername}`)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setMessages(data as DirectMessage[]);
        buildConversations(data as DirectMessage[]);
      }
      setLoading(false);
    };

    fetchDMs();
  }, [currentUsername]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`dm-${currentUsername}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, (payload) => {
        const msg = payload.new as DirectMessage;
        if (msg.sender_username === currentUsername || msg.receiver_username === currentUsername) {
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
  }, [currentUsername]);

  // Mark messages as read when opening a conversation
  useEffect(() => {
    if (!activeConversation) return;

    const unreadIds = messages
      .filter(
        (m) =>
          m.sender_username === activeConversation &&
          m.receiver_username === currentUsername &&
          !m.is_read
      )
      .map((m) => m.id);

    if (unreadIds.length > 0) {
      supabase
        .from("direct_messages")
        .update({ is_read: true })
        .in("id", unreadIds)
        .then(() => {
          setMessages((prev) =>
            prev.map((m) => (unreadIds.includes(m.id) ? { ...m, is_read: true } : m))
          );
        });
    }
  }, [activeConversation, currentUsername]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeConversation, scrollToBottom]);

  const buildConversations = (allMessages: DirectMessage[]) => {
    const convMap: Record<string, Conversation> = {};

    allMessages.forEach((msg) => {
      const other = msg.sender_username === currentUsername ? msg.receiver_username : msg.sender_username;
      if (!convMap[other]) {
        convMap[other] = {
          username: other,
          lastMessage: msg.content,
          lastTime: msg.created_at,
          unreadCount: 0,
          avatarUrl: null,
        };
      } else {
        if (new Date(msg.created_at) > new Date(convMap[other].lastTime)) {
          convMap[other].lastMessage = msg.content;
          convMap[other].lastTime = msg.created_at;
        }
      }
      // Count unread
      if (msg.receiver_username === currentUsername && !msg.is_read) {
        convMap[other].unreadCount++;
      }
    });

    setConversations(Object.values(convMap).sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime()));
  };

  const handleSend = async () => {
    if (!input.trim() || !activeConversation || sending) return;
    const content = input.trim();
    setInput("");
    setSending(true);

    await supabase.from("direct_messages").insert({
      sender_username: currentUsername,
      receiver_username: activeConversation,
      content,
    });

    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const activeMessages = messages.filter(
    (m) =>
      (m.sender_username === currentUsername && m.receiver_username === activeConversation) ||
      (m.sender_username === activeConversation && m.receiver_username === currentUsername)
  );

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <div className="flex h-screen" style={{ background: "hsl(var(--chat-bg))" }}>
      {/* Conversations List */}
      <div
        className={`flex flex-col border-l ${activeConversation ? "hidden md:flex" : "flex"} w-full md:w-80`}
        style={{
          background: "hsl(var(--chat-header))",
          borderColor: "hsl(var(--border))",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
          style={{
            borderBottom: "1px solid hsl(var(--border))",
            boxShadow: "0 1px 20px hsl(220 16% 4% / 0.4)",
          }}
        >
          <button
            onClick={onBack}
            className="p-2 rounded-xl hover:opacity-70 transition-opacity"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-sm" style={{ color: "hsl(var(--foreground))" }}>
              الرسائل الخاصة
            </h1>
            {totalUnread > 0 && (
              <p className="text-xs" style={{ color: "hsl(var(--primary))" }}>
                {totalUnread} رسالة غير مقروءة
              </p>
            )}
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div
                className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "hsl(var(--primary))", borderTopColor: "transparent" }}
              />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 gap-4 text-center px-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: "hsl(var(--secondary))" }}
              >
                <MessageSquare className="w-8 h-8" style={{ color: "hsl(var(--muted-foreground))" }} />
              </div>
              <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                لا توجد محادثات بعد. اضغط على اسم مستخدم في الدردشة العامة لبدء محادثة خاصة.
              </p>
            </div>
          ) : (
            conversations.map((conv) => {
              const color = getUserColor(conv.username);
              const avatar = profilesMap[conv.username];
              const isActive = activeConversation === conv.username;
              return (
                <button
                  key={conv.username}
                  onClick={() => setActiveConversation(conv.username)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-right transition-colors"
                  style={{
                    background: isActive ? "hsl(var(--primary) / 0.1)" : "transparent",
                    borderRight: isActive ? `3px solid hsl(var(--primary))` : "3px solid transparent",
                  }}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {avatar ? (
                      <img
                        src={avatar}
                        alt={conv.username}
                        className="w-11 h-11 rounded-full object-cover"
                        style={{ border: `2px solid ${color}55` }}
                      />
                    ) : (
                      <div
                        className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold"
                        style={{ background: `${color}22`, border: `2px solid ${color}55`, color }}
                      >
                        {conv.username.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    {conv.unreadCount > 0 && (
                      <span
                        className="absolute -top-1 -right-1 min-w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center px-1"
                        style={{
                          background: "hsl(var(--primary))",
                          color: "hsl(var(--primary-foreground))",
                        }}
                      >
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 text-right">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-xs flex-shrink-0"
                        style={{ color: "hsl(var(--chat-timestamp))" }}
                      >
                        {formatDistanceToNow(new Date(conv.lastTime), { addSuffix: false, locale: ar })}
                      </span>
                      <span
                        className={`text-sm font-semibold truncate ${conv.unreadCount > 0 ? "font-bold" : ""}`}
                        style={{ color: "hsl(var(--foreground))" }}
                      >
                        {conv.username}
                      </span>
                    </div>
                    <p
                      className={`text-xs truncate mt-0.5 ${conv.unreadCount > 0 ? "font-medium" : ""}`}
                      style={{
                        color: conv.unreadCount > 0 ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                      }}
                    >
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
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{ background: "hsl(var(--secondary))" }}
            >
              <MessageSquare className="w-10 h-10" style={{ color: "hsl(var(--muted-foreground))" }} />
            </div>
            <p className="text-lg font-semibold" style={{ color: "hsl(var(--foreground))" }}>
              اختر محادثة
            </p>
            <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              اختر محادثة من القائمة أو ابدأ محادثة جديدة من الدردشة العامة
            </p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div
              className="flex-shrink-0 px-4 py-3 flex items-center gap-3"
              style={{
                background: "hsl(var(--chat-header))",
                borderBottom: "1px solid hsl(var(--border))",
                boxShadow: "0 1px 20px hsl(220 16% 4% / 0.4)",
              }}
            >
              <button
                onClick={() => setActiveConversation(null)}
                className="md:hidden p-2 rounded-xl hover:opacity-70 transition-opacity"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              {(() => {
                const avatar = profilesMap[activeConversation];
                const color = getUserColor(activeConversation);
                return avatar ? (
                  <img src={avatar} alt={activeConversation} className="w-9 h-9 rounded-full object-cover" style={{ border: `2px solid ${color}55` }} />
                ) : (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: `${color}22`, border: `2px solid ${color}55`, color }}>
                    {activeConversation.slice(0, 2).toUpperCase()}
                  </div>
                );
              })()}
              <span className="font-semibold text-sm" style={{ color: "hsl(var(--foreground))" }}>
                {activeConversation}
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {activeMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                  <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                    ابدأ المحادثة مع {activeConversation} 👋
                  </p>
                </div>
              ) : (
                activeMessages.map((msg) => {
                  const isOwn = msg.sender_username === currentUsername;
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-2 animate-fade-in ${isOwn ? "flex-row-reverse" : "flex-row"}`}
                    >
                      <div
                        className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm leading-relaxed break-words ${
                          isOwn ? "rounded-tr-sm chat-bubble-own" : "rounded-tl-sm chat-bubble-other"
                        }`}
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
                style={{
                  background: "hsl(var(--chat-input-bg))",
                  border: "1px solid hsl(var(--border))",
                  transition: "border-color 0.2s",
                }}
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
                  placeholder={`رسالة لـ ${activeConversation}...`}
                  rows={1}
                  maxLength={500}
                  className="flex-1 resize-none bg-transparent outline-none text-sm leading-relaxed"
                  style={{
                    color: "hsl(var(--foreground))",
                    minHeight: "24px",
                    maxHeight: "120px",
                    direction: "rtl",
                    textAlign: "right",
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed glow-primary"
                  style={{
                    background: input.trim() && !sending ? "var(--gradient-primary)" : "hsl(var(--secondary))",
                  }}
                >
                  <Send
                    className="w-4 h-4"
                    style={{
                      color: input.trim() && !sending ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                    }}
                  />
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
