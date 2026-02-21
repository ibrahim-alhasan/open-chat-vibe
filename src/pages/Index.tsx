import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import ChatMessage, { Message, Reaction } from "@/components/ChatMessage";
import UsernameModal from "@/components/UsernameModal";
import SettingsModal from "@/components/SettingsModal";
import UserProfileModal from "@/components/UserProfileModal";
import DirectMessages from "@/pages/DirectMessages";
import { Send, X, MessageCircle, Users, CornerUpLeft, Settings, MessageSquare } from "lucide-react";

const Index = () => {
  const [userId] = useState<string>(() => {
    let id = localStorage.getItem("chat_user_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("chat_user_id", id);
    }
    return id;
  });

  const [username, setUsername] = useState<string | null>(() =>
    localStorage.getItem("chat_username")
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() =>
    localStorage.getItem("chat_avatar_url")
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, { username: string; avatar_url: string | null }>>({});
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [totalUsers, setTotalUsers] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showDMs, setShowDMs] = useState(false);
  const [dmInitialUserId, setDmInitialUserId] = useState<string | null>(null);
  const [profileModal, setProfileModal] = useState<string | null>(null); // user_id
  const [unreadDMs, setUnreadDMs] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Helper to get profile info by user_id
  const getProfile = (uid: string) => profilesMap[uid] || { username: uid.slice(0, 6), avatar_url: null };

  // Fetch unread DMs count by user_id
  useEffect(() => {
    if (!userId) return;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from("direct_messages")
        .select("*", { count: "exact", head: true })
        .eq("receiver_user_id", userId)
        .eq("is_read", false);
      setUnreadDMs(count || 0);
    };
    fetchUnread();
  }, [userId]);

  // Realtime unread DMs by user_id
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`unread-dm-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, (payload) => {
        const msg = payload.new as { receiver_user_id: string | null; is_read: boolean };
        if (msg.receiver_user_id === userId && !msg.is_read) {
          setUnreadDMs((prev) => prev + 1);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "direct_messages" }, (payload) => {
        const msg = payload.new as { receiver_user_id: string | null; is_read: boolean };
        const old = payload.old as { is_read: boolean };
        if (msg.receiver_user_id === userId && !old.is_read && msg.is_read) {
          setUnreadDMs((prev) => Math.max(0, prev - 1));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // Fetch initial data
  useEffect(() => {
    const fetchAll = async () => {
      const [messagesRes, reactionsRes, profilesRes, totalCountRes] = await Promise.all([
        supabase.from("messages").select("*").order("created_at", { ascending: true }).limit(100),
        supabase.from("reactions").select("*"),
        supabase.from("profiles").select("*"),
        supabase.from("profiles").select("*", { count: 'exact', head: true }),
      ]);

      if (!messagesRes.error && messagesRes.data) setMessages(messagesRes.data as Message[]);
      if (!reactionsRes.error && reactionsRes.data) setReactions(reactionsRes.data as Reaction[]);
      if (!profilesRes.error && profilesRes.data) {
        const map: Record<string, { username: string; avatar_url: string | null }> = {};
        profilesRes.data.forEach((p: { user_id: string | null; username: string; avatar_url: string | null }) => {
          if (p.user_id) {
            map[p.user_id] = { username: p.username, avatar_url: p.avatar_url };
          }
        });
        setProfilesMap(map);
      }
      if (!totalCountRes.error) setTotalUsers(totalCountRes.count || 0);
      setLoading(false);
    };
    fetchAll();
  }, []);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel("public-chat-all")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const newMessage = payload.new as Message;
        setMessages((prev) => {
          if (prev.find((m) => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reactions" }, (payload) => {
        const r = payload.new as Reaction;
        setReactions((prev) => {
          if (prev.find((x) => x.id === r.id)) return prev;
          return [...prev, r];
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "reactions" }, (payload) => {
        const deleted = payload.old as { id: string };
        setReactions((prev) => prev.filter((r) => r.id !== deleted.id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload) => {
        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          const p = payload.new as { user_id: string | null; username: string; avatar_url: string | null };
          if (p.user_id) {
            setProfilesMap((prev) => ({ ...prev, [p.user_id!]: { username: p.username, avatar_url: p.avatar_url } }));
          }
          if (payload.eventType === "INSERT") setTotalUsers(prev => prev + 1);
        }
        if (payload.eventType === "DELETE") {
          const p = payload.old as { user_id: string | null };
          if (p.user_id) {
            setProfilesMap((prev) => {
              const newMap = { ...prev };
              delete newMap[p.user_id!];
              return newMap;
            });
          }
          setTotalUsers(prev => Math.max(0, prev - 1));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Presence for online count + typing
  useEffect(() => {
    if (!username || !userId) return;

    const presenceChannel = supabase.channel("presence-chat", {
      config: { presence: { key: userId } },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const keys = Object.keys(state);
        setOnlineCount(keys.length);
        setOnlineUsers(new Set(keys));
        
        // Check typing status
        const typing = new Set<string>();
        keys.forEach(key => {
          const presences = state[key] as any[];
          if (presences && presences.length > 0 && presences[0].is_typing && key !== userId) {
            typing.add(key);
          }
        });
        setTypingUsers(typing);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({ user_id: userId, username, is_typing: false, online_at: new Date().toISOString() });
        }
      });

    presenceChannelRef.current = presenceChannel;

    return () => { 
      supabase.removeChannel(presenceChannel);
      presenceChannelRef.current = null;
    };
  }, [username, userId]);

  // Scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Handle typing indicator
  const handleTyping = () => {
    if (!presenceChannelRef.current) return;
    presenceChannelRef.current.track({ user_id: userId, username, is_typing: true, online_at: new Date().toISOString() });
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      presenceChannelRef.current?.track({ user_id: userId, username, is_typing: false, online_at: new Date().toISOString() });
    }, 2000);
  };

  const handleJoin = async (name: string, avatarFile?: File | null) => {
    localStorage.setItem("chat_username", name);
    let url: string | null = null;

    if (avatarFile) {
      const ext = avatarFile.name.split(".").pop();
      const fileName = `${userId}_${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage
        .from("avatars")
        .upload(fileName, avatarFile, { upsert: true });
      if (!error && data) {
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(data.path);
        url = urlData.publicUrl;
      }
    }

    if (url) localStorage.setItem("chat_avatar_url", url);
    else localStorage.removeItem("chat_avatar_url");

    await supabase.from("profiles").upsert(
      { user_id: userId, username: name, avatar_url: url, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

    setUsername(name);
    setAvatarUrl(url);
    setProfilesMap((prev) => ({ ...prev, [userId]: { username: name, avatar_url: url } }));
  };

  const handleSend = async () => {
    if (!input.trim() || !username || sending) return;
    const content = input.trim();
    setInput("");
    setReplyTo(null);
    setSending(true);

    // Stop typing
    presenceChannelRef.current?.track({ user_id: userId, username, is_typing: false, online_at: new Date().toISOString() });

    await supabase.from("messages").insert({
      username,
      user_id: userId,
      content,
      reply_to: replyTo?.id ?? null,
      reply_to_username: replyTo ? getProfile(replyTo.user_id || "").username : null,
      reply_to_content: replyTo?.content?.slice(0, 80) ?? null,
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

  const handleLeave = () => {
    localStorage.removeItem("chat_username");
    localStorage.removeItem("chat_avatar_url");
    setUsername(null);
    setAvatarUrl(null);
  };

  const handleSettingsSave = (newUsername: string, newAvatarUrl: string | null) => {
    setUsername(newUsername);
    setAvatarUrl(newAvatarUrl);
    setProfilesMap((prev) => ({ ...prev, [userId]: { username: newUsername, avatar_url: newAvatarUrl } }));
  };

  // Get typing users names
  const typingNames = Array.from(typingUsers).map(uid => getProfile(uid).username).filter(Boolean);

  if (!username) {
    return <UsernameModal onJoin={handleJoin} />;
  }

  if (showDMs) {
    return (
      <DirectMessages
        currentUserId={userId}
        currentUsername={username}
        profilesMap={profilesMap}
        onlineUsers={onlineUsers}
        initialConversationUserId={dmInitialUserId}
        onBack={() => { 
          setShowDMs(false); 
          setDmInitialUserId(null); 
          setUnreadDMs(0);
          // إعادة تعيين الـ history عند العودة
          window.history.replaceState({ page: 'public-chat' }, '', '/');
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen select-none" style={{ background: "hsl(var(--chat-bg))" }}>
      {/* Header */}
      <header
        className="flex-shrink-0 px-4 py-3 flex items-center justify-between"
        style={{
          background: "hsl(var(--chat-header))",
          borderBottom: "1px solid hsl(var(--border))",
          boxShadow: "0 1px 20px hsl(220 16% 4% / 0.4)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center glow-primary"
            style={{ background: "var(--gradient-primary)" }}
          >
            <MessageCircle className="w-5 h-5" style={{ color: "hsl(var(--primary-foreground))" }} />
          </div>
          <div>
            <h1 className="font-bold text-sm" style={{ color: "hsl(var(--foreground))" }}>
              الدردشة العامة
            </h1>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full animate-pulse-dot"
                  style={{ background: "hsl(var(--chat-online))" }}
                />
                <span className="text-xs" style={{ color: "hsl(var(--chat-online))" }}>
                  {onlineCount} متصل
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="w-3 h-3" style={{ color: "hsl(var(--muted-foreground))" }} />
                <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {totalUsers} إجمالي
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { 
              setDmInitialUserId(null); 
              setShowDMs(true); 
            }}
            title="الرسائل الخاصة"
            className="relative p-1.5 rounded-lg transition-colors hover:opacity-70"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            <MessageSquare className="w-4 h-4" />
            {unreadDMs > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-4 h-4 rounded-full text-xs font-bold flex items-center justify-center px-0.5"
                style={{
                  background: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                  fontSize: "10px",
                }}
              >
                {unreadDMs}
              </span>
            )}
          </button>

          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="avatar"
              className="w-8 h-8 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
              style={{ border: "2px solid hsl(var(--primary) / 0.5)" }}
              onClick={() => setShowSettings(true)}
            />
          ) : null}
          <button
            onClick={() => setShowSettings(true)}
            title="الإعدادات"
            className="p-1.5 rounded-lg transition-colors hover:opacity-70"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="text-center space-y-3">
              <div
                className="w-10 h-10 rounded-full border-2 border-t-transparent mx-auto animate-spin"
                style={{ borderColor: "hsl(var(--primary))", borderTopColor: "transparent" }}
              />
              <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                جارٍ تحميل الرسائل...
              </p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "hsl(var(--secondary))" }}
            >
              <MessageCircle className="w-8 h-8" style={{ color: "hsl(var(--muted-foreground))" }} />
            </div>
            <div>
              <p className="font-medium" style={{ color: "hsl(var(--foreground))" }}>
                لا توجد رسائل بعد
              </p>
              <p className="text-sm mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                كن أول من يبدأ المحادثة! 👋
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const msgProfile = msg.user_id ? getProfile(msg.user_id) : { username: msg.username, avatar_url: null };
            return (
              <ChatMessage
                key={msg.id}
                message={msg}
                currentUserId={userId}
                currentUsername={username}
                currentAvatarUrl={avatarUrl}
                reactions={reactions.filter((r) => r.message_id === msg.id)}
                profilesMap={profilesMap}
                isOnline={msg.user_id ? onlineUsers.has(msg.user_id) : false}
                onReply={setReplyTo}
                onUsernameClick={(uid) => setProfileModal(uid)}
              />
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Typing indicator */}
      {typingNames.length > 0 && (
        <div className="flex-shrink-0 px-6 py-1.5 animate-fade-in">
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "hsl(var(--primary))", animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "hsl(var(--primary))", animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "hsl(var(--primary))", animationDelay: "300ms" }} />
            </div>
            <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
              {typingNames.length === 1
                ? `${typingNames[0]} يكتب...`
                : `${typingNames.join(" و ")} يكتبون...`}
            </span>
          </div>
        </div>
      )}

      {/* Reply preview */}
      {replyTo && (
        <div
          className="flex-shrink-0 mx-4 mb-2 px-3 py-2 rounded-xl flex items-center justify-between gap-3 animate-fade-in"
          style={{
            background: "hsl(var(--chat-reply-bg))",
            border: "1px solid hsl(var(--border))",
            borderRight: "3px solid hsl(var(--primary))",
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <CornerUpLeft className="w-4 h-4 flex-shrink-0" style={{ color: "hsl(var(--primary))" }} />
            <div className="min-w-0">
              <p className="text-xs font-semibold" style={{ color: "hsl(var(--primary))" }}>
                رد على {replyTo.user_id ? getProfile(replyTo.user_id).username : replyTo.username}
              </p>
              <p className="text-xs truncate" style={{ color: "hsl(var(--muted-foreground))" }}>
                {replyTo.content}
              </p>
            </div>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            className="flex-shrink-0 p-1 rounded-lg transition-colors"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="flex-shrink-0 px-4 pb-4" style={{ paddingTop: replyTo ? "0" : "0.5rem" }}>
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
              handleTyping();
            }}
            onKeyDown={handleKeyDown}
            placeholder="اكتب رسالتك هنا..."
            rows={1}
            maxLength={500}
            className="flex-1 resize-none bg-transparent outline-none text-sm leading-relaxed select-text"
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

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          currentUsername={username}
          currentAvatarUrl={avatarUrl}
          userId={userId}
          onClose={() => setShowSettings(false)}
          onSave={handleSettingsSave}
        />
      )}

      {/* User Profile Modal */}
      {profileModal && (
        <UserProfileModal
          userId={profileModal}
          username={getProfile(profileModal).username}
          avatarUrl={getProfile(profileModal).avatar_url}
          currentUserId={userId}
          isOnline={onlineUsers.has(profileModal)}
          onClose={() => setProfileModal(null)}
          onStartDM={(uid) => {
            setDmInitialUserId(uid);
            setShowDMs(true);
            setProfileModal(null);
          }}
        />
      )}
    </div>
  );
};

export default Index;
