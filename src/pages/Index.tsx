import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import ChatMessage, { Message, Reaction } from "@/components/ChatMessage";
import UsernameModal from "@/components/UsernameModal";
import SettingsModal from "@/components/SettingsModal";
import { Send, X, MessageCircle, Users, CornerUpLeft, LogOut, Settings } from "lucide-react";

const Index = () => {
  const [username, setUsername] = useState<string | null>(() =>
    localStorage.getItem("chat_username")
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() =>
    localStorage.getItem("chat_avatar_url")
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, string | null>>({});
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Fetch initial messages
  useEffect(() => {
    const fetchAll = async () => {
      const [messagesRes, reactionsRes, profilesRes] = await Promise.all([
        supabase.from("messages").select("*").order("created_at", { ascending: true }).limit(100),
        supabase.from("reactions").select("*"),
        supabase.from("profiles").select("*"),
      ]);

      if (!messagesRes.error && messagesRes.data) setMessages(messagesRes.data as Message[]);
      if (!reactionsRes.error && reactionsRes.data) setReactions(reactionsRes.data as Reaction[]);
      if (!profilesRes.error && profilesRes.data) {
        const map: Record<string, string | null> = {};
        profilesRes.data.forEach((p: { username: string; avatar_url: string | null }) => {
          map[p.username] = p.avatar_url;
        });
        setProfilesMap(map);
      }
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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "profiles" }, (payload) => {
        const p = payload.new as { username: string; avatar_url: string | null };
        setProfilesMap((prev) => ({ ...prev, [p.username]: p.avatar_url }));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (payload) => {
        const p = payload.new as { username: string; avatar_url: string | null };
        setProfilesMap((prev) => ({ ...prev, [p.username]: p.avatar_url }));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Presence for online count
  useEffect(() => {
    if (!username) return;

    const presenceChannel = supabase.channel("presence-chat", {
      config: { presence: { key: username } },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        setOnlineCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({ username, online_at: new Date().toISOString() });
        }
      });

    return () => { supabase.removeChannel(presenceChannel); };
  }, [username]);

  // Scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleJoin = async (name: string, avatarFile?: File | null) => {
    localStorage.setItem("chat_username", name);
    let url: string | null = null;

    if (avatarFile) {
      const ext = avatarFile.name.split(".").pop();
      const fileName = `${name}_${Date.now()}.${ext}`;
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

    // Save profile
    await supabase.from("profiles").upsert({
      username: name,
      avatar_url: url,
      updated_at: new Date().toISOString(),
    });

    setUsername(name);
    setAvatarUrl(url);
    setProfilesMap((prev) => ({ ...prev, [name]: url }));
  };

  const handleSend = async () => {
    if (!input.trim() || !username || sending) return;
    const content = input.trim();
    setInput("");
    setReplyTo(null);
    setSending(true);

    await supabase.from("messages").insert({
      username,
      content,
      reply_to: replyTo?.id ?? null,
      reply_to_username: replyTo?.username ?? null,
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
    setProfilesMap((prev) => ({ ...prev, [newUsername]: newAvatarUrl }));
  };

  if (!username) {
    return <UsernameModal onJoin={handleJoin} />;
  }

  return (
    <div className="flex flex-col h-screen" style={{ background: "hsl(var(--chat-bg))" }}>
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
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full animate-pulse-dot"
                style={{ background: "hsl(var(--chat-online))" }}
              />
              <span className="text-xs" style={{ color: "hsl(var(--chat-online))" }}>
                {onlineCount} متصل الآن
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Users className="w-4 h-4" style={{ color: "hsl(var(--muted-foreground))" }} />
          <span
            className="text-xs px-2 py-1 rounded-lg"
            style={{ background: "hsl(var(--secondary))", color: "hsl(var(--secondary-foreground))" }}
          >
            {username}
          </span>
          {/* Avatar in header */}
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="avatar"
              className="w-8 h-8 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
              style={{ border: "2px solid hsl(var(--primary) / 0.5)" }}
              onClick={() => setShowSettings(true)}
            />
          ) : null}
          {/* Settings button */}
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
          messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              currentUsername={username}
              currentAvatarUrl={avatarUrl}
              reactions={reactions.filter((r) => r.message_id === msg.id)}
              profilesMap={profilesMap}
              onReply={setReplyTo}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

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
                رد على {replyTo.username}
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
            }}
            onKeyDown={handleKeyDown}
            placeholder="اكتب رسالتك هنا..."
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
        <p className="text-center text-xs mt-2" style={{ color: "hsl(var(--muted-foreground))" }}>
          اضغط Enter للإرسال • Shift+Enter لسطر جديد
        </p>
      </div>

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          currentUsername={username}
          currentAvatarUrl={avatarUrl}
          onClose={() => setShowSettings(false)}
          onSave={handleSettingsSave}
        />
      )}
    </div>
  );
};

export default Index;
