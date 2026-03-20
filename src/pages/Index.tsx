import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import ChatMessage, { Message, Reaction } from "@/components/ChatMessage";
import UsernameModal from "@/components/UsernameModal";
import SettingsModal from "@/components/SettingsModal";
import UserProfileModal from "@/components/UserProfileModal";
import DirectMessages from "@/pages/DirectMessages";
import ChatInfo from "@/components/ChatInfo";
import AdminPanel from "@/components/AdminPanel";
import { Send, X, MessageCircle, Users, CornerUpLeft, Settings, MessageSquare, ChevronDown, ArrowRight, Reply, Lock, Unlock, ShieldCheck, Ban } from "lucide-react";

const MESSAGES_PER_PAGE = 50;

const Index = () => {
  const [userId] = useState<string>(() => {
    let id = localStorage.getItem("chat_user_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("chat_user_id", id);
    }
    return id;
  });

  const [username, setUsername] = useState<string | null>(() => localStorage.getItem("chat_username"));
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => localStorage.getItem("chat_avatar_url"));
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, { username: string; avatar_url: string | null; allow_dms?: boolean }>>({});
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [bannedUserIds, setBannedUserIds] = useState<Set<string>>(new Set());
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [messagePage, setMessagePage] = useState(0);
  const [sending, setSending] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [totalUsers, setTotalUsers] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showDMs, setShowDMs] = useState(false);
  const [dmInitialUserId, setDmInitialUserId] = useState<string | null>(null);
  const [profileModal, setProfileModal] = useState<string | null>(null);
  const [unreadDMs, setUnreadDMs] = useState(0);
  const [isReturningFromDMs, setIsReturningFromDMs] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [threadMessage, setThreadMessage] = useState<Message | null>(null);
  const [threadInput, setThreadInput] = useState("");
  const [threadSending, setThreadSending] = useState(false);
  const [chatLocked, setChatLocked] = useState(true); // default locked until confirmed open
  const [chatLockLoaded, setChatLockLoaded] = useState(false);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [chatBg, setChatBg] = useState<string | null>(() => localStorage.getItem("chat_bg_image"));
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isFirstLoadRef = useRef(true);
  const isLoadingMoreRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const isUserScrollingUpRef = useRef(false);

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
    }
    setHasNewMessages(false);
  }, []);

  const forceScrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "auto", block: "end" });
    }
    setHasNewMessages(false);
  }, []);

  const getProfile = (uid: string) => profilesMap[uid] || { username: uid.slice(0, 6), avatar_url: null };
  const isCurrentUserAdmin = adminIds.has(userId);
  const isUserBanned = bannedUserIds.has(userId);

  // مراقبة التمرير
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      isUserScrollingUpRef.current = scrollTop < lastScrollTopRef.current;
      lastScrollTopRef.current = scrollTop;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
      if (isNearBottom) setHasNewMessages(false);
      if (scrollTop < 100 && hasMoreMessages && !isLoadingMoreRef.current && !loading) loadMoreMessages();
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMoreMessages, loading]);

  // الاستماع لزر الرجوع في المتصفح
  useEffect(() => {
    const handlePopState = () => {
      if (showAdminPanel) {
        setShowAdminPanel(false);
      } else if (showChatInfo) {
        setShowChatInfo(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showAdminPanel, showChatInfo]);

  // Push history state when opening sections
  useEffect(() => {
    if (showChatInfo) {
      window.history.pushState({ page: 'chat-info' }, '', '/');
    }
  }, [showChatInfo]);

  useEffect(() => {
    if (showAdminPanel) {
      window.history.pushState({ page: 'admin-panel' }, '', '/');
    }
  }, [showAdminPanel]);

  useEffect(() => {
    if (showDMs) {
      window.history.pushState({ page: 'dms' }, '', '/');
    }
  }, [showDMs]);



  useEffect(() => {
    if (!loading && messages.length > 0 && isFirstLoadRef.current) {
      setTimeout(() => { forceScrollToBottom(); isFirstLoadRef.current = false; }, 100);
    }
  }, [loading, messages.length, forceScrollToBottom]);

  // جلب الرسائل غير المقروءة
  useEffect(() => {
    if (!userId) return;
    const fetchUnread = async () => {
      const { count } = await supabase.from("direct_messages").select("*", { count: "exact", head: true }).eq("receiver_user_id", userId).eq("is_read", false);
      setUnreadDMs(count || 0);
    };
    fetchUnread();
  }, [userId]);

  // الاستماع للرسائل الخاصة الجديدة
  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel(`unread-dm-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, (payload) => {
        const msg = payload.new as { receiver_user_id: string | null; is_read: boolean };
        if (msg.receiver_user_id === userId && !msg.is_read) setUnreadDMs((prev) => prev + 1);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "direct_messages" }, (payload) => {
        const msg = payload.new as { receiver_user_id: string | null; is_read: boolean };
        const old = payload.old as { is_read: boolean };
        if (msg.receiver_user_id === userId && !old.is_read && msg.is_read) setUnreadDMs((prev) => Math.max(0, prev - 1));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // تحميل البيانات الأولية
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const [messagesRes, reactionsRes, profilesRes, totalCountRes, adminsRes, chatSettingsRes, bannedRes] = await Promise.all([
          supabase.from("messages").select("*").order("created_at", { ascending: false }).limit(MESSAGES_PER_PAGE),
          supabase.from("reactions").select("*"),
          supabase.from("profiles").select("*"),
          supabase.from("profiles").select("*", { count: 'exact', head: true }),
          supabase.from("admins").select("user_id"),
          supabase.from("chat_settings").select("*").limit(1).single(),
          supabase.from("banned_users").select("user_id"),
        ]);

        if (!messagesRes.error && messagesRes.data) {
          const sortedMessages = (messagesRes.data as Message[]).reverse();
          setMessages(sortedMessages);
          const { count } = await supabase.from("messages").select("*", { count: 'exact', head: true });
          setHasMoreMessages((count || 0) > MESSAGES_PER_PAGE);
        }
        if (!reactionsRes.error && reactionsRes.data) setReactions(reactionsRes.data as Reaction[]);
        if (!profilesRes.error && profilesRes.data) {
          const map: Record<string, { username: string; avatar_url: string | null; allow_dms?: boolean }> = {};
          profilesRes.data.forEach((p: any) => {
            if (p.user_id) map[p.user_id] = { username: p.username, avatar_url: p.avatar_url, allow_dms: p.allow_dms ?? true };
          });
          setProfilesMap(map);
        }
        if (!totalCountRes.error) setTotalUsers(totalCountRes.count || 0);
        if (!adminsRes.error && adminsRes.data) setAdminIds(new Set(adminsRes.data.map((a: any) => a.user_id)));
        if (!bannedRes.error && bannedRes.data) setBannedUserIds(new Set(bannedRes.data.map((b: any) => b.user_id)));
        if (!chatSettingsRes.error && chatSettingsRes.data) {
          setChatLocked(chatSettingsRes.data.is_locked);
        } else {
          setChatLocked(false);
        }
        setChatLockLoaded(true);
      } catch (error) {
        console.error("Error fetching initial data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  // تحميل المزيد من الرسائل
  const loadMoreMessages = useCallback(async () => {
    if (loadingMore || !hasMoreMessages || isLoadingMoreRef.current) return;
    isLoadingMoreRef.current = true;
    setLoadingMore(true);
    const nextPage = messagePage + 1;
    const oldestMessage = messages[0];
    const container = messagesContainerRef.current;
    const prevScrollHeight = container?.scrollHeight || 0;
    try {
      const { data, error } = await supabase.from("messages").select("*").order("created_at", { ascending: false }).lt("created_at", oldestMessage.created_at).limit(MESSAGES_PER_PAGE);
      if (!error && data && data.length > 0) {
        const olderMessages = (data as Message[]).reverse();
        setMessages(prev => [...olderMessages, ...prev]);
        setMessagePage(nextPage);
        setHasMoreMessages(data.length === MESSAGES_PER_PAGE);
        // Preserve scroll position after prepending
        requestAnimationFrame(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = newScrollHeight - prevScrollHeight;
          }
        });
      } else {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error("Error loading more messages:", error);
    } finally {
      setLoadingMore(false);
      isLoadingMoreRef.current = false;
    }
  }, [loadingMore, hasMoreMessages, messagePage, messages]);

  // الاستماع للتغييرات في الوقت الفعلي
  useEffect(() => {
    const channel = supabase.channel("public-chat-all")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const newMessage = payload.new as Message;
        setMessages((prev) => {
          if (prev.find((m) => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });
        if (messagesContainerRef.current) {
          const container = messagesContainerRef.current;
          const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
          if (isNearBottom) setTimeout(() => scrollToBottom(true), 100);
          else if (newMessage.user_id !== userId) setHasNewMessages(true);
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) => {
        const deleted = payload.old as { id: string };
        setMessages((prev) => prev.filter((m) => m.id !== deleted.id));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reactions" }, (payload) => {
        const r = payload.new as Reaction;
        setReactions((prev) => prev.find((x) => x.id === r.id) ? prev : [...prev, r]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "reactions" }, (payload) => {
        const deleted = payload.old as { id: string };
        setReactions((prev) => prev.filter((r) => r.id !== deleted.id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload) => {
        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          const p = payload.new as any;
          if (p.user_id) setProfilesMap((prev) => ({ ...prev, [p.user_id]: { username: p.username, avatar_url: p.avatar_url, allow_dms: p.allow_dms ?? true } }));
          if (payload.eventType === "INSERT") setTotalUsers(prev => prev + 1);
        }
        if (payload.eventType === "DELETE") {
          const p = payload.old as any;
          if (p.user_id) setProfilesMap((prev) => { const m = { ...prev }; delete m[p.user_id]; return m; });
          setTotalUsers(prev => Math.max(0, prev - 1));
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_settings" }, (payload) => {
        const settings = payload.new as any;
        setChatLocked(settings.is_locked);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "banned_users" }, (payload) => {
        const banned = payload.new as any;
        setBannedUserIds(prev => new Set([...prev, banned.user_id]));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "banned_users" }, (payload) => {
        const unbanned = payload.old as any;
        setBannedUserIds(prev => { const s = new Set(prev); s.delete(unbanned.user_id); return s; });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [scrollToBottom, userId]);

  // إدارة حالة التواجد
  useEffect(() => {
    if (!username || !userId) return;
    const presenceChannel = supabase.channel("presence-chat", { config: { presence: { key: userId } } });
    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const keys = Object.keys(state);
        setOnlineCount(keys.length);
        setOnlineUsers(new Set(keys));
        const typing = new Set<string>();
        keys.forEach(key => {
          const presences = state[key] as any[];
          if (presences?.[0]?.is_typing && key !== userId) typing.add(key);
        });
        setTypingUsers(typing);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({ user_id: userId, username, is_typing: false, online_at: new Date().toISOString() });
        }
      });
    presenceChannelRef.current = presenceChannel;
    return () => { supabase.removeChannel(presenceChannel); presenceChannelRef.current = null; };
  }, [username, userId]);

  // التمرير عند العودة من الرسائل الخاصة
  useEffect(() => {
    if (isReturningFromDMs) {
      forceScrollToBottom();
      const timeout1 = setTimeout(forceScrollToBottom, 50);
      const timeout2 = setTimeout(forceScrollToBottom, 150);
      const timeout3 = setTimeout(forceScrollToBottom, 300);
      const resetTimeout = setTimeout(() => setIsReturningFromDMs(false), 400);
      return () => { clearTimeout(timeout1); clearTimeout(timeout2); clearTimeout(timeout3); clearTimeout(resetTimeout); };
    }
  }, [isReturningFromDMs, forceScrollToBottom]);

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
      const { data, error } = await supabase.storage.from("avatars").upload(fileName, avatarFile, { upsert: true });
      if (!error && data) {
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(data.path);
        url = urlData.publicUrl;
      }
    }
    if (url) localStorage.setItem("chat_avatar_url", url);
    else localStorage.removeItem("chat_avatar_url");
    await supabase.from("profiles").upsert({ user_id: userId, username: name, avatar_url: url, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    setUsername(name);
    setAvatarUrl(url);
    setProfilesMap((prev) => ({ ...prev, [userId]: { username: name, avatar_url: url } }));
  };

  const handleSend = async () => {
    if (!input.trim() || !username || sending || isUserBanned) return;
    if (chatLocked && !isCurrentUserAdmin) return;
    const content = input.trim();
    setInput("");
    setSending(true);
    presenceChannelRef.current?.track({ user_id: userId, username, is_typing: false, online_at: new Date().toISOString() });
    await supabase.from("messages").insert({ username, user_id: userId, content });
    setSending(false);
    inputRef.current?.focus();
  };

  const handleDeleteMessage = async (messageId: string) => {
    await supabase.from("messages").delete().eq("id", messageId);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleSettingsSave = (newUsername: string, newAvatarUrl: string | null) => {
    setUsername(newUsername);
    setAvatarUrl(newAvatarUrl);
    setProfilesMap((prev) => ({ ...prev, [userId]: { username: newUsername, avatar_url: newAvatarUrl, allow_dms: prev[userId]?.allow_dms } }));
  };

  const handleBackFromDMs = () => {
    setIsReturningFromDMs(true);
    setShowDMs(false);
    setDmInitialUserId(null);
    setUnreadDMs(0);
    window.history.replaceState({ page: 'public-chat' }, '', '/');
  };

  const handleToggleChatLock = async () => {
    const newLocked = !chatLocked;
    await supabase.from("chat_settings").update({ is_locked: newLocked, locked_by: userId, locked_at: newLocked ? new Date().toISOString() : null }).neq("id", "00000000-0000-0000-0000-000000000000");
    setChatLocked(newLocked);
  };

  // Thread functions
  const getReplyCount = useCallback((messageId: string) => messages.filter(m => m.reply_to === messageId).length, [messages]);
  const getThreadReplies = useCallback((messageId: string) => messages.filter(m => m.reply_to === messageId), [messages]);

  const handleOpenThread = (message: Message) => {
    setThreadMessage(message);
    window.history.pushState({ page: 'thread' }, '', '/');
  };

  const handleCloseThread = () => {
    setThreadMessage(null);
    setThreadInput("");
    setTimeout(() => forceScrollToBottom(), 100);
    setTimeout(() => forceScrollToBottom(), 300);
  };

  const handleThreadSend = async () => {
    if (!threadInput.trim() || !username || threadSending || !threadMessage) return;
    if (isUserBanned) return;
    if (chatLocked && !isCurrentUserAdmin) return;
    const content = threadInput.trim();
    setThreadInput("");
    setThreadSending(true);
    await supabase.from("messages").insert({
      username, user_id: userId, content,
      reply_to: threadMessage.id,
      reply_to_username: threadMessage.user_id ? getProfile(threadMessage.user_id).username : threadMessage.username,
      reply_to_content: threadMessage.content?.slice(0, 80) ?? null,
    });
    setThreadSending(false);
    setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (threadMessage) { e.preventDefault(); handleCloseThread(); }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [threadMessage]);

  const typingNames = Array.from(typingUsers).map(uid => getProfile(uid).username).filter(Boolean);

  // Get admin profiles for locked chat display
  const adminProfiles = Array.from(adminIds).map(id => ({ id, ...getProfile(id) }));

  if (!username) return <UsernameModal onJoin={handleJoin} />;

  if (showChatInfo) {
    return (
      <ChatInfo totalUsers={totalUsers} onlineCount={onlineCount} profilesMap={profilesMap} adminIds={adminIds} onlineUsers={onlineUsers} onUsernameClick={(uid) => { setShowChatInfo(false); setProfileModal(uid); }} />
    );
  }

  if (showAdminPanel && isCurrentUserAdmin) {
    return (
      <div className="flex flex-col h-screen select-none" style={{ background: "hsl(var(--chat-bg))" }}>
        <header className="flex-shrink-0 px-4 py-2.5 flex items-center gap-3" style={{ background: "hsl(var(--chat-header))", borderBottom: "1px solid hsl(var(--border))" }}>
          <button onClick={() => setShowAdminPanel(false)} className="p-1.5 rounded-full hover:opacity-70" style={{ color: "hsl(var(--primary))" }}>
            <ChevronDown className="w-5 h-5 rotate-90" />
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" style={{ color: "hsl(var(--primary))" }} />
            <h1 className="font-semibold text-[15px]" style={{ color: "hsl(var(--foreground))" }}>لوحة المشرفين</h1>
          </div>
        </header>
        <AdminPanel profilesMap={profilesMap} />
      </div>
    );
  }

  if (showDMs) {
    return (
      <DirectMessages currentUserId={userId} currentUsername={username} profilesMap={profilesMap} onlineUsers={onlineUsers} initialConversationUserId={dmInitialUserId} onBack={handleBackFromDMs} isAdmin={isCurrentUserAdmin} />
    );
  }

  // Thread View
  if (threadMessage) {
    const threadReplies = getThreadReplies(threadMessage.id);
    const threadParentProfile = threadMessage.user_id ? getProfile(threadMessage.user_id) : { username: threadMessage.username, avatar_url: null };

    return (
      <div className="flex flex-col h-screen select-none" style={{ background: "hsl(var(--chat-bg))" }}>
        <header className="flex-shrink-0 px-4 py-2.5 flex items-center gap-3" style={{ background: "hsl(var(--chat-header))", borderBottom: "1px solid hsl(var(--border))" }}>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-[15px]" style={{ color: "hsl(var(--foreground))" }}>الردود</h1>
            <p className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
              {threadReplies.length} رد على {threadParentProfile.username}
            </p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          <div className="pb-3 mb-3" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
            <ChatMessage message={threadMessage} currentUserId={userId} currentUsername={username} currentAvatarUrl={avatarUrl} reactions={reactions.filter((r) => r.message_id === threadMessage.id)} profilesMap={profilesMap} isOnline={threadMessage.user_id ? onlineUsers.has(threadMessage.user_id) : false} isAdmin={threadMessage.user_id ? adminIds.has(threadMessage.user_id) : false} isCurrentUserAdmin={isCurrentUserAdmin} onReply={() => {}} onUsernameClick={(uid) => setProfileModal(uid)} onDelete={handleDeleteMessage} />
          </div>

          {threadReplies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Reply className="w-7 h-7 mb-2" style={{ color: "hsl(var(--muted-foreground))" }} />
              <p className="text-[13px]" style={{ color: "hsl(var(--muted-foreground))" }}>لا توجد ردود بعد</p>
            </div>
          ) : (
            threadReplies.map((reply) => (
              <ChatMessage key={reply.id} message={reply} currentUserId={userId} currentUsername={username} currentAvatarUrl={avatarUrl} reactions={reactions.filter((r) => r.message_id === reply.id)} profilesMap={profilesMap} isOnline={reply.user_id ? onlineUsers.has(reply.user_id) : false} isAdmin={reply.user_id ? adminIds.has(reply.user_id) : false} isCurrentUserAdmin={isCurrentUserAdmin} onReply={() => {}} onUsernameClick={(uid) => setProfileModal(uid)} onDelete={handleDeleteMessage} />
            ))
          )}
          <div ref={threadEndRef} />
        </div>

        {isUserBanned ? (
          <div className="flex-shrink-0 px-3 pb-3 pt-2">
            <div className="rounded-2xl p-3 text-center" style={{ background: "hsl(var(--destructive) / 0.1)", border: "1px solid hsl(var(--destructive) / 0.3)" }}>
              <div className="flex items-center justify-center gap-2">
                <Ban className="w-4 h-4" style={{ color: "hsl(var(--destructive))" }} />
                <span className="text-[12px] font-medium" style={{ color: "hsl(var(--destructive))" }}>تم حظرك من الدردشة العامة</span>
              </div>
            </div>
          </div>
        ) : chatLocked && !isCurrentUserAdmin ? (
          <div className="flex-shrink-0 px-3 pb-3 pt-2">
            <div className="rounded-2xl p-3 text-center" style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))" }}>
              <div className="flex items-center justify-center gap-2">
                <Lock className="w-4 h-4" style={{ color: "hsl(var(--destructive))" }} />
                <span className="text-[12px] font-medium" style={{ color: "hsl(var(--destructive))" }}>الدردشة مغلقة - لا يمكن الرد</span>
              </div>
            </div>
          </div>
        ) : (
        <div className="flex-shrink-0 px-3 pb-3 pt-1.5">
          <div className="flex items-end gap-2 p-2 rounded-full" style={{ background: "hsl(var(--chat-input-bg))", border: "1px solid hsl(var(--border))" }}>
            <textarea value={threadInput}
              onChange={(e) => { setThreadInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleThreadSend(); } }}
              placeholder="اكتب رداً..."
              rows={1} maxLength={500}
              className="flex-1 resize-none bg-transparent outline-none text-[14px] leading-relaxed select-text px-3"
              style={{ color: "hsl(var(--foreground))", minHeight: "24px", maxHeight: "120px", direction: "rtl", textAlign: "right" }}
            />
            <button onClick={handleThreadSend} disabled={!threadInput.trim() || threadSending}
              className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 disabled:opacity-40"
              style={{ background: threadInput.trim() && !threadSending ? "hsl(var(--primary))" : "hsl(var(--secondary))" }}>
              <Send className="w-4 h-4" style={{ color: threadInput.trim() && !threadSending ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))" }} />
            </button>
          </div>
        </div>
        )}

        {profileModal && (
          <UserProfileModal userId={profileModal} username={getProfile(profileModal).username} avatarUrl={getProfile(profileModal).avatar_url} currentUserId={userId} isOnline={onlineUsers.has(profileModal)} isAdmin={adminIds.has(profileModal)} isCurrentUserAdmin={isCurrentUserAdmin} allowDms={profilesMap[profileModal]?.allow_dms ?? true} onClose={() => setProfileModal(null)} onStartDM={(uid) => { setDmInitialUserId(uid); setShowDMs(true); setProfileModal(null); }} />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen select-none" style={{ background: "hsl(var(--chat-bg))" }}>
      {/* Header - WhatsApp style */}
      <header className="flex-shrink-0 px-4 py-2.5 flex items-center justify-between" style={{ background: "hsl(var(--chat-header))", borderBottom: "1px solid hsl(var(--border))" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "hsl(var(--primary))" }}>
            <MessageCircle className="w-4.5 h-4.5" style={{ color: "hsl(var(--primary-foreground))" }} />
          </div>
          <button onClick={() => setShowChatInfo(true)} className="text-right hover:opacity-80 transition-opacity">
            <h1 className="font-semibold text-[15px]" style={{ color: "hsl(var(--foreground))" }}>الدردشة العامة</h1>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: "hsl(var(--chat-online))" }} />
                <span className="text-[11px]" style={{ color: "hsl(var(--chat-online))" }}>{onlineCount} متصل</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3" style={{ color: "hsl(var(--muted-foreground))" }} />
                <span className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{totalUsers}</span>
              </div>
            </div>
          </button>
        </div>
        <div className="flex items-center gap-1">
          {isCurrentUserAdmin && (
            <button onClick={() => setShowAdminPanel(true)} title="لوحة المشرفين"
              className="p-2 rounded-full transition-colors hover:opacity-70"
              style={{ color: "hsl(var(--primary))" }}>
              <ShieldCheck className="w-4.5 h-4.5" />
            </button>
          )}
          {isCurrentUserAdmin && (
            <button onClick={handleToggleChatLock} title={chatLocked ? "فتح الدردشة" : "إغلاق الدردشة"}
              className="p-2 rounded-full transition-colors hover:opacity-70"
              style={{ color: chatLocked ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))" }}>
              {chatLocked ? <Lock className="w-4.5 h-4.5" /> : <Unlock className="w-4.5 h-4.5" />}
            </button>
          )}
          <button onClick={() => { setDmInitialUserId(null); setShowDMs(true); }} title="الرسائل الخاصة"
            className="relative p-2 rounded-full transition-colors hover:opacity-70" style={{ color: "hsl(var(--muted-foreground))" }}>
            <MessageSquare className="w-4.5 h-4.5" />
            {unreadDMs > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full text-[10px] font-bold flex items-center justify-center px-1"
                style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}>{unreadDMs}</span>
            )}
          </button>
          {avatarUrl && (
            <img src={avatarUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
              style={{ border: "2px solid hsl(var(--primary) / 0.4)" }} onClick={() => setShowSettings(true)} />
          )}
          <button onClick={() => setShowSettings(true)} title="الإعدادات" className="p-2 rounded-full transition-colors hover:opacity-70" style={{ color: "hsl(var(--muted-foreground))" }}>
            <Settings className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

      {/* Messages area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 relative" style={chatBg ? { backgroundImage: `url(${chatBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } : undefined}>
        {loadingMore && (
          <div className="flex justify-center py-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))" }}>
              <div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "hsl(var(--primary))", borderTopColor: "transparent" }} />
              <span className="text-[11px]">جاري تحميل رسائل أقدم...</span>
            </div>
          </div>
        )}

        {!hasMoreMessages && messages.length > 0 && !loadingMore && (
          <div className="flex justify-center py-2">
            <span className="text-[11px] px-3 py-1 rounded-full" style={{ background: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))" }}>هذه بداية المحادثة</span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="text-center space-y-3">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent mx-auto animate-spin" style={{ borderColor: "hsl(var(--primary))", borderTopColor: "transparent" }} />
              <p className="text-[13px]" style={{ color: "hsl(var(--muted-foreground))" }}>جارٍ تحميل الرسائل...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "hsl(var(--secondary))" }}>
              <MessageCircle className="w-7 h-7" style={{ color: "hsl(var(--muted-foreground))" }} />
            </div>
            <div>
              <p className="font-medium text-[14px]" style={{ color: "hsl(var(--foreground))" }}>لا توجد رسائل بعد</p>
              <p className="text-[12px] mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>كن أول من يبدأ المحادثة! 👋</p>
            </div>
          </div>
        ) : (
          <>
            {messages.filter(msg => !msg.reply_to).map((msg) => (
              <ChatMessage key={msg.id} message={msg} currentUserId={userId} currentUsername={username} currentAvatarUrl={avatarUrl} reactions={reactions.filter((r) => r.message_id === msg.id)} profilesMap={profilesMap} isOnline={msg.user_id ? onlineUsers.has(msg.user_id) : false} isAdmin={msg.user_id ? adminIds.has(msg.user_id) : false} isCurrentUserAdmin={isCurrentUserAdmin} replyCount={getReplyCount(msg.id)} onReply={handleOpenThread} onUsernameClick={(uid) => setProfileModal(uid)} onDelete={handleDeleteMessage} onOpenThread={handleOpenThread} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}

        {(showScrollButton || hasNewMessages) && (
          <div className="fixed bottom-20 right-4 flex flex-col items-end gap-2 z-10">
            {hasNewMessages && (
              <button onClick={() => scrollToBottom(true)} className="px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 animate-bounce" style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}>
                <span className="text-[12px]">رسائل جديدة</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            )}
            {showScrollButton && !hasNewMessages && (
              <button onClick={() => scrollToBottom(true)} className="w-9 h-9 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform" style={{ background: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))", border: "1px solid hsl(var(--border))" }}>
                <ChevronDown className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Typing indicator */}
      {typingNames.length > 0 && (
        <div className="flex-shrink-0 px-4 py-1 animate-fade-in">
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "hsl(var(--primary))", animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "hsl(var(--primary))", animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "hsl(var(--primary))", animationDelay: "300ms" }} />
            </div>
            <span className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
              {typingNames.length === 1 ? `${typingNames[0]} يكتب...` : `${typingNames.join(" و ")} يكتبون...`}
            </span>
          </div>
        </div>
      )}

      {/* Banned user message */}
      {!chatLockLoaded ? null : isUserBanned && !isCurrentUserAdmin ? (
        <div className="flex-shrink-0 px-3 pb-3 pt-2">
          <div className="rounded-2xl p-4 text-center space-y-2" style={{ background: "hsl(var(--destructive) / 0.1)", border: "1px solid hsl(var(--destructive) / 0.3)" }}>
            <div className="flex items-center justify-center gap-2">
              <Ban className="w-4 h-4" style={{ color: "hsl(var(--destructive))" }} />
              <span className="text-[13px] font-medium" style={{ color: "hsl(var(--destructive))" }}>تم حظرك من الدردشة العامة</span>
            </div>
            <p className="text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>تواصل مع المشرفين لمزيد من المعلومات</p>
          </div>
        </div>
      ) : chatLocked && !isCurrentUserAdmin ? (
        <div className="flex-shrink-0 px-3 pb-3 pt-2">
          <div className="rounded-2xl p-4 text-center space-y-3" style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))" }}>
            <div className="flex items-center justify-center gap-2">
              <Lock className="w-4 h-4" style={{ color: "hsl(var(--destructive))" }} />
              <span className="text-[13px] font-medium" style={{ color: "hsl(var(--destructive))" }}>الدردشة مغلقة حالياً</span>
            </div>
            <p className="text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>قم بالتواصل مع المشرفين للمزيد من المعلومات</p>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {adminProfiles.map((admin) => (
                <button key={admin.id} onClick={() => { setDmInitialUserId(admin.id); setShowDMs(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all hover:scale-105 active:scale-95"
                  style={{ background: "hsl(var(--chat-input-bg))", border: "1px solid hsl(var(--border))" }}>
                  {admin.avatar_url ? (
                    <img src={admin.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ background: "hsl(var(--primary) / 0.2)", color: "hsl(var(--primary))" }}>
                      {admin.username.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <ShieldCheck className="w-3 h-3" style={{ color: "hsl(var(--primary))" }} />
                  <span className="text-[11px] font-medium" style={{ color: "hsl(var(--foreground))" }}>{admin.username}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Input area - WhatsApp style */
        <div className="flex-shrink-0 px-3 pb-3 pt-1.5">
          {chatLocked && isCurrentUserAdmin && (
            <div className="flex items-center justify-center gap-2 mb-2 px-3 py-1.5 rounded-full" style={{ background: "hsl(var(--destructive) / 0.1)" }}>
              <Lock className="w-3 h-3" style={{ color: "hsl(var(--destructive))" }} />
              <span className="text-[11px]" style={{ color: "hsl(var(--destructive))" }}>الدردشة مغلقة - أنت مشرف يمكنك الكتابة</span>
            </div>
          )}
          <div className="flex items-end gap-2">
            <div className="flex-1 flex items-end p-1.5 rounded-full" style={{ background: "hsl(var(--chat-input-bg))", border: "1px solid hsl(var(--border))" }}>
              <textarea ref={inputRef} value={input}
                onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; handleTyping(); }}
                onKeyDown={handleKeyDown}
                placeholder="اكتب رسالتك..."
                rows={1} maxLength={500}
                className="flex-1 resize-none bg-transparent outline-none text-[14px] leading-relaxed select-text px-3"
                style={{ color: "hsl(var(--foreground))", minHeight: "24px", maxHeight: "120px", direction: "rtl", textAlign: "right" }}
              />
            </div>
            <button onClick={handleSend} disabled={!input.trim() || sending}
              className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 disabled:opacity-40"
              style={{ background: input.trim() && !sending ? "hsl(var(--primary))" : "hsl(var(--secondary))" }}>
              <Send className="w-4 h-4" style={{ color: input.trim() && !sending ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))" }} />
            </button>
          </div>
        </div>
      )}

      {showSettings && (
        <SettingsModal currentUsername={username} currentAvatarUrl={avatarUrl} userId={userId} onClose={() => setShowSettings(false)} onSave={handleSettingsSave} chatBg={chatBg} onChatBgChange={(bg) => { setChatBg(bg); if (bg) localStorage.setItem("chat_bg_image", bg); else localStorage.removeItem("chat_bg_image"); }} />
      )}

      {profileModal && (
        <UserProfileModal userId={profileModal} username={getProfile(profileModal).username} avatarUrl={getProfile(profileModal).avatar_url} currentUserId={userId} isOnline={onlineUsers.has(profileModal)} isAdmin={adminIds.has(profileModal)} isCurrentUserAdmin={isCurrentUserAdmin} allowDms={profilesMap[profileModal]?.allow_dms ?? true} onClose={() => setProfileModal(null)} onStartDM={(uid) => { setDmInitialUserId(uid); setShowDMs(true); setProfileModal(null); }} />
      )}
    </div>
  );
};

export default Index;
