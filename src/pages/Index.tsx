import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import ChatMessage, { Message, Reaction } from "@/components/ChatMessage";
import UsernameModal from "@/components/UsernameModal";
import SettingsModal from "@/components/SettingsModal";
import UserProfileModal from "@/components/UserProfileModal";
import DirectMessages from "@/pages/DirectMessages";
import { Send, X, MessageCircle, Users, CornerUpLeft, Settings, MessageSquare, ChevronDown, ArrowRight, Reply } from "lucide-react";

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
  const threadEndRef = useRef<HTMLDivElement>(null);
  
  // Refs
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
      messagesEndRef.current.scrollIntoView({ 
        behavior: smooth ? "smooth" : "auto",
        block: "end"
      });
    }
    setHasNewMessages(false);
  }, []);

  const forceScrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: "auto",
        block: "end"
      });
    }
    setHasNewMessages(false);
  }, []);

  const getProfile = (uid: string) => profilesMap[uid] || { username: uid.slice(0, 6), avatar_url: null };
  const isCurrentUserAdmin = adminIds.has(userId);

  // مراقبة التمرير
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      
      // التحقق مما إذا كان المستخدم يمرر للأعلى
      isUserScrollingUpRef.current = scrollTop < lastScrollTopRef.current;
      lastScrollTopRef.current = scrollTop;
      
      // التحقق مما إذا كان قريب من الأسفل
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
      
      // إذا كان المستخدم قريب من الأسفل، إخفاء إشعار الرسائل الجديدة
      if (isNearBottom) {
        setHasNewMessages(false);
      }
      
      // تحميل المزيد من الرسائل عند الاقتراب من الأعلى
      if (scrollTop < 100 && hasMoreMessages && !isLoadingMoreRef.current && !loading) {
        loadMoreMessages();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMoreMessages, loading]);

  // التمرير للأسفل بعد التحميل الأول
  useEffect(() => {
    if (!loading && messages.length > 0 && isFirstLoadRef.current) {
      setTimeout(() => {
        forceScrollToBottom();
        isFirstLoadRef.current = false;
      }, 100);
    }
  }, [loading, messages.length, forceScrollToBottom]);

  // جلب الرسائل غير المقروءة
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
        // جلب أحدث 50 رسالة (مرتبة تنازلياً ثم تصاعدياً للعرض)
        const [messagesRes, reactionsRes, profilesRes, totalCountRes, adminsRes] = await Promise.all([
          supabase
            .from("messages")
            .select("*")
            .order("created_at", { ascending: false }) // نجلب الأحدث أولاً
            .limit(MESSAGES_PER_PAGE),
          supabase.from("reactions").select("*"),
          supabase.from("profiles").select("*"),
          supabase.from("profiles").select("*", { count: 'exact', head: true }),
          supabase.from("admins").select("user_id"),
        ]);

        if (!messagesRes.error && messagesRes.data) {
          // نقلب الترتيب لنعرض من الأقدم للأحدث
          const sortedMessages = (messagesRes.data as Message[]).reverse();
          setMessages(sortedMessages);
          
          // التحقق من وجود المزيد من الرسائل
          const { count } = await supabase
            .from("messages")
            .select("*", { count: 'exact', head: true });
          
          setHasMoreMessages((count || 0) > MESSAGES_PER_PAGE);
        }
        
        if (!reactionsRes.error && reactionsRes.data) {
          setReactions(reactionsRes.data as Reaction[]);
        }
        
        if (!profilesRes.error && profilesRes.data) {
          const map: Record<string, { username: string; avatar_url: string | null; allow_dms?: boolean }> = {};
          profilesRes.data.forEach((p: any) => {
            if (p.user_id) map[p.user_id] = { 
              username: p.username, 
              avatar_url: p.avatar_url, 
              allow_dms: p.allow_dms ?? true 
            };
          });
          setProfilesMap(map);
        }
        
        if (!totalCountRes.error) {
          setTotalUsers(totalCountRes.count || 0);
        }
        
        if (!adminsRes.error && adminsRes.data) {
          setAdminIds(new Set(adminsRes.data.map((a: any) => a.user_id)));
        }
      } catch (error) {
        console.error("Error fetching initial data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchInitialData();
  }, []);

  // تحميل المزيد من الرسائل (الرسائل الأقدم)
  const loadMoreMessages = useCallback(async () => {
    if (loadingMore || !hasMoreMessages || isLoadingMoreRef.current) return;
    
    isLoadingMoreRef.current = true;
    setLoadingMore(true);
    
    const nextPage = messagePage + 1;
    // نجلب الرسائل الأقدم من أقدم رسالة لدينا حالياً
    const oldestMessage = messages[0];
    
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false })
        .lt("created_at", oldestMessage.created_at) // نجلب ما هو أقدم من أقدم رسالة
        .limit(MESSAGES_PER_PAGE);
      
      if (!error && data && data.length > 0) {
        // نقلب الترتيب ونضيفها في البداية
        const olderMessages = (data as Message[]).reverse();
        setMessages(prev => [...olderMessages, ...prev]);
        setMessagePage(nextPage);
        setHasMoreMessages(data.length === MESSAGES_PER_PAGE);
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
        
        // التحقق من عدم وجود الرسالة مسبقاً
        setMessages((prev) => {
          if (prev.find((m) => m.id === newMessage.id)) return prev;
          return [...prev, newMessage]; // نضيف الرسالة الجديدة في النهاية
        });
        
        // التحقق مما إذا كان يجب التمرير للأسفل تلقائياً
        if (messagesContainerRef.current) {
          const container = messagesContainerRef.current;
          const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
          
          if (isNearBottom) {
            // إذا كان المستخدم قريب من الأسفل، نمرر تلقائياً
            setTimeout(() => scrollToBottom(true), 100);
          } else if (newMessage.user_id !== userId) {
            // إذا كان المستخدم بعيد عن الأسفل وهناك رسالة جديدة من شخص آخر، نظهر الإشعار
            setHasNewMessages(true);
          }
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
          if (p.user_id) {
            setProfilesMap((prev) => ({ 
              ...prev, 
              [p.user_id]: { 
                username: p.username, 
                avatar_url: p.avatar_url, 
                allow_dms: p.allow_dms ?? true 
              } 
            }));
          }
          if (payload.eventType === "INSERT") setTotalUsers(prev => prev + 1);
        }
        if (payload.eventType === "DELETE") {
          const p = payload.old as any;
          if (p.user_id) {
            setProfilesMap((prev) => { 
              const m = { ...prev }; 
              delete m[p.user_id]; 
              return m; 
            });
          }
          setTotalUsers(prev => Math.max(0, prev - 1));
        }
      })
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [scrollToBottom, userId]);

  // إدارة حالة التواجد
  useEffect(() => {
    if (!username || !userId) return;
    
    const presenceChannel = supabase.channel("presence-chat", { 
      config: { presence: { key: userId } } 
    });
    
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
          await presenceChannel.track({ 
            user_id: userId, 
            username, 
            is_typing: false, 
            online_at: new Date().toISOString() 
          });
        }
      });
      
    presenceChannelRef.current = presenceChannel;
    
    return () => { 
      supabase.removeChannel(presenceChannel); 
      presenceChannelRef.current = null; 
    };
  }, [username, userId]);

  // التمرير عند العودة من الرسائل الخاصة
  useEffect(() => {
    if (isReturningFromDMs) {
      forceScrollToBottom();
      
      const timeout1 = setTimeout(forceScrollToBottom, 50);
      const timeout2 = setTimeout(forceScrollToBottom, 150);
      const timeout3 = setTimeout(forceScrollToBottom, 300);
      
      const resetTimeout = setTimeout(() => {
        setIsReturningFromDMs(false);
      }, 400);
      
      return () => {
        clearTimeout(timeout1);
        clearTimeout(timeout2);
        clearTimeout(timeout3);
        clearTimeout(resetTimeout);
      };
    }
  }, [isReturningFromDMs, forceScrollToBottom]);

  const handleTyping = () => {
    if (!presenceChannelRef.current) return;
    
    presenceChannelRef.current.track({ 
      user_id: userId, 
      username, 
      is_typing: true, 
      online_at: new Date().toISOString() 
    });
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      presenceChannelRef.current?.track({ 
        user_id: userId, 
        username, 
        is_typing: false, 
        online_at: new Date().toISOString() 
      });
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
        const { data: urlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(data.path);
        url = urlData.publicUrl;
      }
    }
    
    if (url) localStorage.setItem("chat_avatar_url", url);
    else localStorage.removeItem("chat_avatar_url");
    
    await supabase
      .from("profiles")
      .upsert({ 
        user_id: userId, 
        username: name, 
        avatar_url: url, 
        updated_at: new Date().toISOString() 
      }, { onConflict: "user_id" });
      
    setUsername(name);
    setAvatarUrl(url);
    setProfilesMap((prev) => ({ 
      ...prev, 
      [userId]: { username: name, avatar_url: url } 
    }));
  };

  const handleSend = async () => {
    if (!input.trim() || !username || sending) return;
    
    const content = input.trim();
    setInput("");
    setReplyTo(null);
    setSending(true);
    
    presenceChannelRef.current?.track({ 
      user_id: userId, 
      username, 
      is_typing: false, 
      online_at: new Date().toISOString() 
    });
    
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

  const handleDeleteMessage = async (messageId: string) => {
    await supabase.from("messages").delete().eq("id", messageId);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { 
      e.preventDefault(); 
      handleSend(); 
    }
  };

  const handleSettingsSave = (newUsername: string, newAvatarUrl: string | null) => {
    setUsername(newUsername);
    setAvatarUrl(newAvatarUrl);
    setProfilesMap((prev) => ({ 
      ...prev, 
      [userId]: { 
        username: newUsername, 
        avatar_url: newAvatarUrl, 
        allow_dms: prev[userId]?.allow_dms 
      } 
    }));
  };

  const handleBackFromDMs = () => {
    setIsReturningFromDMs(true);
    setShowDMs(false); 
    setDmInitialUserId(null); 
    setUnreadDMs(0); 
    window.history.replaceState({ page: 'public-chat' }, '', '/');
  };

  // Thread functions
  const getReplyCount = useCallback((messageId: string) => {
    return messages.filter(m => m.reply_to === messageId).length;
  }, [messages]);

  const getThreadReplies = useCallback((messageId: string) => {
    return messages.filter(m => m.reply_to === messageId);
  }, [messages]);

  const handleOpenThread = (message: Message) => {
    setThreadMessage(message);
    window.history.pushState({ page: 'thread' }, '', '/');
  };

  const handleCloseThread = () => {
    setThreadMessage(null);
    setThreadInput("");
  };

  const handleThreadSend = async () => {
    if (!threadInput.trim() || !username || threadSending || !threadMessage) return;
    const content = threadInput.trim();
    setThreadInput("");
    setThreadSending(true);

    await supabase.from("messages").insert({
      username,
      user_id: userId,
      content,
      reply_to: threadMessage.id,
      reply_to_username: threadMessage.user_id ? getProfile(threadMessage.user_id).username : threadMessage.username,
      reply_to_content: threadMessage.content?.slice(0, 80) ?? null,
    });

    setThreadSending(false);
    setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  // Handle back button for thread
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (threadMessage) {
        e.preventDefault();
        handleCloseThread();
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [threadMessage]);

  const typingNames = Array.from(typingUsers).map(uid => getProfile(uid).username).filter(Boolean);

  if (!username) return <UsernameModal onJoin={handleJoin} />;

  if (showDMs) {
    return (
      <DirectMessages
        currentUserId={userId}
        currentUsername={username}
        profilesMap={profilesMap}
        onlineUsers={onlineUsers}
        initialConversationUserId={dmInitialUserId}
        onBack={handleBackFromDMs}
        isAdmin={isCurrentUserAdmin}
      />
    );
  }

  // Thread View
  if (threadMessage) {
    const threadReplies = getThreadReplies(threadMessage.id);
    const threadParentProfile = threadMessage.user_id ? getProfile(threadMessage.user_id) : { username: threadMessage.username, avatar_url: null };

    return (
      <div className="flex flex-col h-screen select-none" style={{ background: "hsl(var(--chat-bg))" }}>
        {/* Thread Header */}
        <header className="flex-shrink-0 px-4 py-3 flex items-center gap-3"
          style={{ background: "hsl(var(--chat-header))", borderBottom: "1px solid hsl(var(--border))", boxShadow: "0 1px 20px hsl(220 16% 4% / 0.4)" }}>
          <button onClick={handleCloseThread} className="p-1.5 rounded-lg transition-colors hover:opacity-70" style={{ color: "hsl(var(--muted-foreground))" }}>
            <ArrowRight className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm" style={{ color: "hsl(var(--foreground))" }}>الردود</h1>
            <p className="text-xs truncate" style={{ color: "hsl(var(--muted-foreground))" }}>
              {threadReplies.length} رد على {threadParentProfile.username}
            </p>
          </div>
        </header>

        {/* Thread messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Original message */}
          <div className="pb-3 mb-3" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
            <ChatMessage
              message={threadMessage}
              currentUserId={userId}
              currentUsername={username}
              currentAvatarUrl={avatarUrl}
              reactions={reactions.filter((r) => r.message_id === threadMessage.id)}
              profilesMap={profilesMap}
              isOnline={threadMessage.user_id ? onlineUsers.has(threadMessage.user_id) : false}
              isAdmin={threadMessage.user_id ? adminIds.has(threadMessage.user_id) : false}
              isCurrentUserAdmin={isCurrentUserAdmin}
              onReply={() => {}}
              onUsernameClick={(uid) => setProfileModal(uid)}
              onDelete={handleDeleteMessage}
            />
          </div>

          {/* Replies */}
          {threadReplies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Reply className="w-8 h-8 mb-2" style={{ color: "hsl(var(--muted-foreground))" }} />
              <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>لا توجد ردود بعد</p>
            </div>
          ) : (
            threadReplies.map((reply) => (
              <ChatMessage
                key={reply.id}
                message={reply}
                currentUserId={userId}
                currentUsername={username}
                currentAvatarUrl={avatarUrl}
                reactions={reactions.filter((r) => r.message_id === reply.id)}
                profilesMap={profilesMap}
                isOnline={reply.user_id ? onlineUsers.has(reply.user_id) : false}
                isAdmin={reply.user_id ? adminIds.has(reply.user_id) : false}
                isCurrentUserAdmin={isCurrentUserAdmin}
                onReply={() => {}}
                onUsernameClick={(uid) => setProfileModal(uid)}
                onDelete={handleDeleteMessage}
              />
            ))
          )}
          <div ref={threadEndRef} />
        </div>

        {/* Thread input */}
        <div className="flex-shrink-0 px-4 pb-4 pt-2">
          <div className="flex items-end gap-3 p-3 rounded-2xl"
            style={{ background: "hsl(var(--chat-input-bg))", border: "1px solid hsl(var(--border))" }}>
            <textarea
              value={threadInput}
              onChange={(e) => { setThreadInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleThreadSend(); } }}
              placeholder="اكتب رداً..."
              rows={1}
              maxLength={500}
              className="flex-1 resize-none bg-transparent outline-none text-sm leading-relaxed select-text"
              style={{ color: "hsl(var(--foreground))", minHeight: "24px", maxHeight: "120px", direction: "rtl", textAlign: "right" }}
            />
            <button onClick={handleThreadSend} disabled={!threadInput.trim() || threadSending}
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90 disabled:opacity-40 glow-primary"
              style={{ background: threadInput.trim() && !threadSending ? "var(--gradient-primary)" : "hsl(var(--secondary))" }}>
              <Send className="w-4 h-4" style={{ color: threadInput.trim() && !threadSending ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))" }} />
            </button>
          </div>
        </div>

        {profileModal && (
          <UserProfileModal
            userId={profileModal}
            username={getProfile(profileModal).username}
            avatarUrl={getProfile(profileModal).avatar_url}
            currentUserId={userId}
            isOnline={onlineUsers.has(profileModal)}
            isAdmin={adminIds.has(profileModal)}
            allowDms={profilesMap[profileModal]?.allow_dms ?? true}
            onClose={() => setProfileModal(null)}
            onStartDM={(uid) => { setDmInitialUserId(uid); setShowDMs(true); setProfileModal(null); }}
          />
        )}
      </div>
    );
  }



  return (
    <div className="flex flex-col h-screen select-none" style={{ background: "hsl(var(--chat-bg))" }}>
      {/* Header */}
      <header className="flex-shrink-0 px-4 py-3 flex items-center justify-between"
        style={{ background: "hsl(var(--chat-header))", borderBottom: "1px solid hsl(var(--border))", boxShadow: "0 1px 20px hsl(220 16% 4% / 0.4)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center glow-primary" style={{ background: "var(--gradient-primary)" }}>
            <MessageCircle className="w-5 h-5" style={{ color: "hsl(var(--primary-foreground))" }} />
          </div>
          <div>
            <h1 className="font-bold text-sm" style={{ color: "hsl(var(--foreground))" }}>الدردشة العامة</h1>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full animate-pulse-dot" style={{ background: "hsl(var(--chat-online))" }} />
                <span className="text-xs" style={{ color: "hsl(var(--chat-online))" }}>{onlineCount} متصل</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="w-3 h-3" style={{ color: "hsl(var(--muted-foreground))" }} />
                <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{totalUsers} إجمالي</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setDmInitialUserId(null); setShowDMs(true); }} title="الرسائل الخاصة"
            className="relative p-1.5 rounded-lg transition-colors hover:opacity-70" style={{ color: "hsl(var(--muted-foreground))" }}>
            <MessageSquare className="w-4 h-4" />
            {unreadDMs > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 rounded-full text-xs font-bold flex items-center justify-center px-0.5"
                style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", fontSize: "10px" }}>{unreadDMs}</span>
            )}
          </button>
          {avatarUrl && (
            <img src={avatarUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
              style={{ border: "2px solid hsl(var(--primary) / 0.5)" }} onClick={() => setShowSettings(true)} />
          )}
          <button onClick={() => setShowSettings(true)} title="الإعدادات" className="p-1.5 rounded-lg transition-colors hover:opacity-70" style={{ color: "hsl(var(--muted-foreground))" }}>
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Messages area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 relative">
        {/* مؤشر تحميل المزيد من الرسائل */}
        {loadingMore && (
          <div className="flex justify-center py-2">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full"
              style={{ background: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))" }}>
              <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" 
                style={{ borderColor: "hsl(var(--primary))", borderTopColor: "transparent" }} />
              <span className="text-xs">جاري تحميل رسائل أقدم...</span>
            </div>
          </div>
        )}

        {/* رسالة عدم وجود رسائل أقدم */}
        {!hasMoreMessages && messages.length > 0 && !loadingMore && (
          <div className="flex justify-center py-2">
            <span className="text-xs px-3 py-1 rounded-full" 
              style={{ background: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))" }}>
              هذه بداية المحادثة
            </span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="text-center space-y-3">
              <div className="w-10 h-10 rounded-full border-2 border-t-transparent mx-auto animate-spin" style={{ borderColor: "hsl(var(--primary))", borderTopColor: "transparent" }} />
              <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>جارٍ تحميل الرسائل...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "hsl(var(--secondary))" }}>
              <MessageCircle className="w-8 h-8" style={{ color: "hsl(var(--muted-foreground))" }} />
            </div>
            <div>
              <p className="font-medium" style={{ color: "hsl(var(--foreground))" }}>لا توجد رسائل بعد</p>
              <p className="text-sm mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>كن أول من يبدأ المحادثة! 👋</p>
            </div>
          </div>
        ) : (
          <>
            {messages.filter(msg => !msg.reply_to).map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                currentUserId={userId}
                currentUsername={username}
                currentAvatarUrl={avatarUrl}
                reactions={reactions.filter((r) => r.message_id === msg.id)}
                profilesMap={profilesMap}
                isOnline={msg.user_id ? onlineUsers.has(msg.user_id) : false}
                isAdmin={msg.user_id ? adminIds.has(msg.user_id) : false}
                isCurrentUserAdmin={isCurrentUserAdmin}
                replyCount={getReplyCount(msg.id)}
                onReply={handleOpenThread}
                onUsernameClick={(uid) => setProfileModal(uid)}
                onDelete={handleDeleteMessage}
                onOpenThread={handleOpenThread}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}

        {/* زر العودة للأسفل وإشعار الرسائل الجديدة */}
        {(showScrollButton || hasNewMessages) && (
          <div className="fixed bottom-24 right-6 flex flex-col items-end gap-2 z-10">
            {hasNewMessages && (
              <button
                onClick={() => scrollToBottom(true)}
                className="px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-bounce"
                style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}
              >
                <span className="text-sm">رسائل جديدة</span>
                <ChevronDown className="w-4 h-4" />
              </button>
            )}
            {showScrollButton && !hasNewMessages && (
              <button
                onClick={() => scrollToBottom(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
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
              {typingNames.length === 1 ? `${typingNames[0]} يكتب...` : `${typingNames.join(" و ")} يكتبون...`}
            </span>
          </div>
        </div>
      )}

      {/* Reply preview */}
      {replyTo && (
        <div className="flex-shrink-0 mx-4 mb-2 px-3 py-2 rounded-xl flex items-center justify-between gap-3 animate-fade-in"
          style={{ background: "hsl(var(--chat-reply-bg))", border: "1px solid hsl(var(--border))", borderRight: "3px solid hsl(var(--primary))" }}>
          <div className="flex items-center gap-2 min-w-0">
            <CornerUpLeft className="w-4 h-4 flex-shrink-0" style={{ color: "hsl(var(--primary))" }} />
            <div className="min-w-0">
              <p className="text-xs font-semibold" style={{ color: "hsl(var(--primary))" }}>رد على {replyTo.user_id ? getProfile(replyTo.user_id).username : replyTo.username}</p>
              <p className="text-xs truncate" style={{ color: "hsl(var(--muted-foreground))" }}>{replyTo.content}</p>
            </div>
          </div>
          <button onClick={() => setReplyTo(null)} className="flex-shrink-0 p-1 rounded-lg" style={{ color: "hsl(var(--muted-foreground))" }}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="flex-shrink-0 px-4 pb-4" style={{ paddingTop: replyTo ? "0" : "0.5rem" }}>
        <div className="flex items-end gap-3 p-3 rounded-2xl"
          style={{ background: "hsl(var(--chat-input-bg))", border: "1px solid hsl(var(--border))", transition: "border-color 0.2s" }}
          onFocusCapture={(e) => { 
            (e.currentTarget as HTMLElement).style.borderColor = "hsl(var(--primary))"; 
            (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px hsl(var(--primary) / 0.1)";
          }}
          onBlurCapture={(e) => { 
            (e.currentTarget as HTMLElement).style.borderColor = "hsl(var(--border))"; 
            (e.currentTarget as HTMLElement).style.boxShadow = "none"; 
          }}>
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
            style={{ color: "hsl(var(--foreground))", minHeight: "24px", maxHeight: "120px", direction: "rtl", textAlign: "right" }}
          />
          <button onClick={handleSend} disabled={!input.trim() || sending}
            className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed glow-primary"
            style={{ background: input.trim() && !sending ? "var(--gradient-primary)" : "hsl(var(--secondary))" }}>
            <Send className="w-4 h-4" style={{ color: input.trim() && !sending ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))" }} />
          </button>
        </div>
      </div>

      {showSettings && (
        <SettingsModal 
          currentUsername={username} 
          currentAvatarUrl={avatarUrl} 
          userId={userId} 
          onClose={() => setShowSettings(false)} 
          onSave={handleSettingsSave} 
        />
      )}

      {profileModal && (
        <UserProfileModal
          userId={profileModal}
          username={getProfile(profileModal).username}
          avatarUrl={getProfile(profileModal).avatar_url}
          currentUserId={userId}
          isOnline={onlineUsers.has(profileModal)}
          isAdmin={adminIds.has(profileModal)}
          allowDms={profilesMap[profileModal]?.allow_dms ?? true}
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
