import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import ChatMessage, { Message, Reaction, ADMIN_ANIMATED_STICKERS } from "@/components/ChatMessage";
import UsernameModal from "@/components/UsernameModal";
import SettingsModal from "@/components/SettingsModal";
import UserProfileModal from "@/components/UserProfileModal";
import DirectMessages from "@/pages/DirectMessages";
import ChatInfo from "@/components/ChatInfo";
import AdminPanel from "@/components/AdminPanel";
import PollCreator from "@/components/PollCreator";
import PollMessage from "@/components/PollMessage";
import MediaViewer from "@/components/MediaViewer";
import { playSound } from "@/lib/sounds";
import { getLocalAvatar, LOCAL_AVATAR_EVENT } from "@/lib/localAvatar";
import { Send, X, MessageCircle, Users, CornerUpLeft, Settings, MessageSquare, ChevronDown, ArrowRight, Reply, Lock, Unlock, ShieldCheck, Ban, Smile, Megaphone, BarChart3, Paperclip, Pin, PinOff, Bot } from "lucide-react";

const MESSAGES_PER_PAGE = 100;
const AUTH_REQUIRED_MESSAGE = "يجب عليك تسجيل الدخول أولاً";

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { user, profile, isAdmin, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  
  const showDMs = location.pathname === '/dms' || location.pathname.startsWith('/dm/');
  const showAdminPanel = location.pathname === '/admin';
  const showChatInfo = location.pathname === '/chat-info';
  const dmInitialUserId = params.userId || null;

  // Identity comes from auth session
  const userId = user?.id ?? "";
  const username = profile?.username ?? null;
  const [localAvatar, setLocalAvatarState] = useState<string | null>(null);
  const avatarUrl = localAvatar ?? profile?.avatar_url ?? null;
  const isGuest = !user;

  // الصورة الشخصية المحفوظة محلياً على الجهاز
  useEffect(() => {
    setLocalAvatarState(getLocalAvatar(userId));
    const onChange = () => setLocalAvatarState(getLocalAvatar(userId));
    window.addEventListener(LOCAL_AVATAR_EVENT, onChange);
    return () => window.removeEventListener(LOCAL_AVATAR_EVENT, onChange);
  }, [userId]);


  // Helper: prompt guest to sign in
  const requireAuth = useCallback((action?: string) => {
    toast({
      title: "تسجيل الدخول مطلوب",
      description: action ? `سجّل دخولك أولاً ${action}` : "سجّل دخولك للمتابعة",
    });
    navigate("/auth");
    return false;
  }, [navigate, toast]);

  // Helper: show auth modal for send actions
  const showAuthRequiredModal = useCallback((actionType: "public" | "private") => {
    toast({
      title: "تسجيل الدخول مطلوب",
      description: actionType === "private" 
        ? "لإرسال رسالة خاصة يجب عليك تسجيل الدخول أولاً"
        : "لإرسال رسالة عامة يجب عليك تسجيل الدخول أولاً",
    });
    navigate("/auth");
  }, [navigate, toast]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, { username: string; avatar_url: string | null; allow_dms?: boolean }>>({});
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [bannedUserIds, setBannedUserIds] = useState<Set<string>>(new Set());
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [sending, setSending] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [totalUsers, setTotalUsers] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  const [profileModal, setProfileModal] = useState<string | null>(null);
  const [unreadDMs, setUnreadDMs] = useState(0);
  const [isReturningFromDMs, setIsReturningFromDMs] = useState(false);

  const [showScrollButton, setShowScrollButton] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [chatLocked, setChatLocked] = useState(true);
  const [chatLockLoaded, setChatLockLoaded] = useState(false);

  const [chatBg, setChatBg] = useState<string | null>(() => localStorage.getItem("chat_bg_image"));
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);

  const [polls, setPolls] = useState<Record<string, { question: string; options: string[]; is_active: boolean }>>({});
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  const [mentionResults, setMentionResults] = useState<{ userId: string; username: string }[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [pinnedMessage, setPinnedMessage] = useState<{ id: string; message_id: string; content: string; username: string; user_id: string | null } | null>(null);
  const [showPinnedExpanded, setShowPinnedExpanded] = useState(false);
  
  // --- State خاص بعارض الوسائط ---
  const [mediaViewer, setMediaViewer] = useState<{ url: string; type: string; name?: string } | null>(null);

  const [realtimeConnected, setRealtimeConnected] = useState(false);
  
  const fileInputRef2 = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const isFirstLoadRef = useRef(true);
  const isLoadingMoreRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const isUserScrollingUpRef = useRef(false);
  const shouldScrollAfterRefresh = useRef(false);
  const loadMoreMessagesRef = useRef<() => void>(() => {});

  const messageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    messages.forEach(m => {
      if (m.user_id) counts[m.user_id] = (counts[m.user_id] || 0) + 1;
    });
    return counts;
  }, [messages]);

  const reactionsByMessageId = useMemo(() => {
    const map: Record<string, Reaction[]> = {};
    reactions.forEach(r => {
      if (!map[r.message_id]) map[r.message_id] = [];
      map[r.message_id].push(r);
    });
    return map;
  }, [reactions]);

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

  // دالة جديدة للتمرير إلى رسالة معينة
  const scrollToMessage = useCallback(async (messageId: string) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
      messageElement.style.transition = "background-color 0.3s ease";
      messageElement.style.backgroundColor = "hsl(var(--primary) / 0.15)";
      setTimeout(() => {
        messageElement.style.backgroundColor = "";
      }, 2000);
      return true;
    }
    
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) {
      const { data: targetMessage, error } = await supabase
        .from("messages")
        .select("*")
        .eq("id", messageId)
        .single();
      
      if (error || !targetMessage) {
        return false;
      }
      
      const { count: newerCount } = await supabase
        .from("messages")
        .select("*", { count: 'exact', head: true })
        .gt("created_at", targetMessage.created_at);
      
      const newerMessagesCount = newerCount || 0;
      const neededPages = Math.ceil(newerMessagesCount / MESSAGES_PER_PAGE);
      
      let currentMessages = messages;
      for (let i = 0; i <= neededPages; i++) {
        const { data: olderMessages, error: loadError } = await supabase
          .from("messages")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(MESSAGES_PER_PAGE * (i + 1));
        
        if (!loadError && olderMessages) {
          currentMessages = (olderMessages as Message[]).sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          setMessages(currentMessages);
          
          const msgIds = currentMessages.map(m => m.id);
          if (msgIds.length > 0) {
            const { data: reactionsData } = await supabase
              .from("reactions")
              .select("*")
              .in("message_id", msgIds);
            if (reactionsData) {
              setReactions(reactionsData as Reaction[]);
            }
          }
        }
      }
      
      setTimeout(() => {
        const newElement = document.getElementById(`message-${messageId}`);
        if (newElement) {
          newElement.scrollIntoView({ behavior: "smooth", block: "center" });
          newElement.style.transition = "background-color 0.3s ease";
          newElement.style.backgroundColor = "hsl(var(--primary) / 0.15)";
          setTimeout(() => {
            newElement.style.backgroundColor = "";
          }, 2000);
        }
      }, 500);
      
      return true;
    }
    
    return false;
  }, [messages]);

  const getProfile = useCallback((uid: string) => profilesMap[uid] || { username: uid.slice(0, 6), avatar_url: null }, [profilesMap]);
  const isCurrentUserAdmin = adminIds.has(userId);
  const isUserBanned = bannedUserIds.has(userId);

  const refreshChatData = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    
    console.log("جاري تحديث الدردشة...");
    
    try {
      const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(MESSAGES_PER_PAGE);
      
      if (!messagesError && messagesData) {
        const sortedMessages = (messagesData as Message[]).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        setMessages(sortedMessages);
        
        const { count } = await supabase
          .from("messages")
          .select("*", { count: 'exact', head: true });
    
        setHasMoreMessages((count || 0) > MESSAGES_PER_PAGE);
     
        const msgIds = sortedMessages.map(m => m.id);
        if (msgIds.length > 0) {
          const { data: reactionsData } = await supabase
            .from("reactions")
            .select("*")
            .in("message_id", msgIds);
          if (reactionsData) {
            setReactions(reactionsData as Reaction[]);
          }
        }
        
        const pollMsgIds = sortedMessages
          .filter(m => m.content && m.content.startsWith("poll:"))
          .map(m => m.content.replace("poll:", ""));
          
        if (pollMsgIds.length > 0) {
          const { data: pollsData } = await supabase
            .from("polls")
            .select("*")
            .in("id", pollMsgIds);
          if (pollsData) {
            const pollMap: Record<string, { question: string; options: string[]; is_active: boolean }> = {};
            pollsData.forEach((p: any) => {
              const opts = typeof p.options === 'string' ? JSON.parse(p.options) : p.options;
              pollMap[p.id] = { question: p.question, options: opts, is_active: p.is_active };
            });
            setPolls(prev => ({ ...prev, ...pollMap }));
          }
        }
      }
      
      const { data: profilesData } = await supabase.from("profiles").select("*");
      if (profilesData) {
        const map: Record<string, { username: string; avatar_url: string | null; allow_dms?: boolean }> = {};
        profilesData.forEach((p: any) => {
          if (p.user_id) map[p.user_id] = { username: p.username, avatar_url: p.avatar_url, allow_dms: p.allow_dms ?? true };
        });
        setProfilesMap(map);
      }
      
      const { data: adminsData } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (adminsData) setAdminIds(new Set(adminsData.map((a: any) => a.user_id)));
      
      const { data: bannedData } = await supabase.from("banned_users").select("user_id");
      if (bannedData) setBannedUserIds(new Set(bannedData.map((b: any) => b.user_id)));
      
      const { data: pinnedData } = await supabase
        .from("pinned_messages")
        .select("*")
        .order("pinned_at", { ascending: false })
        .limit(1);
      if (pinnedData && pinnedData.length > 0) {
        setPinnedMessage(pinnedData[0] as any);
      } else {
        setPinnedMessage(null);
      }
      
      const { data: chatSettingsData } = await supabase
        .from("chat_settings")
        .select("*")
        .limit(1)
        .single();
      if (chatSettingsData) setChatLocked(chatSettingsData.is_locked);
      
      shouldScrollAfterRefresh.current = true;
      
    } catch (error) {
      console.error("خطأ في تحديث البيانات:", error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing]);

  useEffect(() => {
    if (shouldScrollAfterRefresh.current && !refreshing && messages.length > 0) {
      setTimeout(() => {
        forceScrollToBottom();
        shouldScrollAfterRefresh.current = false;
      }, 200);
    }
  }, [refreshing, messages.length, forceScrollToBottom]);

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
  
      if (scrollTop < 300 && hasMoreMessages && !isLoadingMoreRef.current && !loading) loadMoreMessagesRef.current();
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMoreMessages, loading]);

  useEffect(() => {
    if (!loading && messages.length > 0 && isFirstLoadRef.current) {
      setTimeout(() => { forceScrollToBottom(); isFirstLoadRef.current = false; }, 100);
    }
  }, [loading, messages.length, forceScrollToBottom]);

  useEffect(() => {
    if (!userId) return;
    const fetchUnread = async () => {
      const { count } = await supabase.from("direct_messages").select("*", { count: "exact", head: true }).eq("receiver_user_id", userId).eq("is_read", false);
      setUnreadDMs(count || 0);
    };
    fetchUnread();
  }, [userId]);

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

  // إعداد استماع مباشر للوحة التحكم (حالة الدردشة والحظر)
  useEffect(() => {
    if (!userId) return;
    
    const controlChannel = supabase.channel('system-controls')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_settings' }, (payload) => {
        if (payload.new && typeof payload.new.is_locked !== 'undefined') {
          setChatLocked(payload.new.is_locked);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'banned_users' }, (payload) => {
        if (payload.new && payload.new.user_id) {
          setBannedUserIds(prev => new Set(prev).add(payload.new.user_id));
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'banned_users' }, (payload) => {
        if (payload.old && payload.old.user_id) {
          setBannedUserIds(prev => {
            const updated = new Set(prev);
            updated.delete(payload.old.user_id);
            return updated;
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(controlChannel);
    };
  }, [userId]);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const [messagesRes, profilesRes, totalCountRes, adminsRes, chatSettingsRes, bannedRes, pinnedRes] = await Promise.all([
          supabase.from("messages").select("*").order("created_at", { ascending: false }).limit(MESSAGES_PER_PAGE),
          supabase.from("profiles").select("*"),
          supabase.from("profiles").select("*", { count: 'exact', head: true }),
          supabase.from("user_roles").select("user_id").eq("role", "admin"),
          supabase.from("chat_settings").select("*").limit(1).single(),
          supabase.from("banned_users").select("user_id"),
          supabase.from("pinned_messages").select("*").order("pinned_at", { ascending: false }).limit(1),
        ]);

        if (!messagesRes.error && messagesRes.data) {
          const sortedMessages = (messagesRes.data as Message[]).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          setMessages(sortedMessages);
          const { count } = await supabase.from("messages").select("*", { count: 'exact', head: true });
          setHasMoreMessages((count || 0) > MESSAGES_PER_PAGE);
          const msgIds = sortedMessages.map(m => m.id);
          if (msgIds.length > 0) {
            const { data: reactionsData } = await supabase.from("reactions").select("*").in("message_id", msgIds);
            if (reactionsData) setReactions(reactionsData as Reaction[]);
          }

          const pollMsgIds = sortedMessages.filter(m => m.content && m.content.startsWith("poll:")).map(m => m.content.replace("poll:", ""));
          if (pollMsgIds.length > 0) {
            const { data: pollsData } = await supabase.from("polls").select("*").in("id", pollMsgIds);
            if (pollsData) {
              const pollMap: Record<string, { question: string; options: string[]; is_active: boolean }> = {};
              pollsData.forEach((p: any) => {
                const opts = typeof p.options === 'string' ? JSON.parse(p.options) : p.options;
                pollMap[p.id] = { question: p.question, options: opts, is_active: p.is_active };
              });
              setPolls(pollMap);
            }
          }
        }
        if (!profilesRes.error && profilesRes.data) {
          const map: Record<string, { username: string; avatar_url: string | null; allow_dms?: boolean }> = {};
          profilesRes.data.forEach((p: any) => {
            if (p.user_id) map[p.user_id] = { username: p.username, avatar_url: p.avatar_url, allow_dms: p.allow_dms ?? true };
          });
          if (userId && map[userId]) map[userId].avatar_url = getLocalAvatar(userId);
          setProfilesMap(map);
        }
        if (!totalCountRes.error) setTotalUsers(totalCountRes.count || 0);
        if (!adminsRes.error && adminsRes.data) setAdminIds(new Set(adminsRes.data.map((a: any) => a.user_id)));
        if (!bannedRes.error && bannedRes.data) setBannedUserIds(new Set(bannedRes.data.map((b: any) => b.user_id)));
        if (!pinnedRes.error && pinnedRes.data && pinnedRes.data.length > 0) {
          setPinnedMessage(pinnedRes.data[0] as any);
        }
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

  // ==================== دالة تحميل المزيد من الرسائل المحسنة ====================
  const loadMoreMessages = useCallback(async () => {
    // منع التحميل إذا كان هناك تحميل جارٍ أو لا توجد رسائل أقدم
    if (loadingMore || !hasMoreMessages || isLoadingMoreRef.current || messages.length === 0) return;
    
    isLoadingMoreRef.current = true;
    setLoadingMore(true);
    
    // احصل على أقدم رسالة حالية (أول عنصر في المصفوفة لأنها مرتبة تصاعديًا)
    const oldestMessage = messages[0];
    if (!oldestMessage) {
      isLoadingMoreRef.current = false;
      setLoadingMore(false);
      return;
    }

    const container = messagesContainerRef.current;
    const prevScrollHeight = container?.scrollHeight || 0;
    const prevScrollTop = container?.scrollTop || 0;

    try {
      // استعلام لجلب 100 رسالة أقدم من أقدم رسالة موجودة
      // نستخدم created_at و id معًا لضمان عدم تكرار النتائج
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false }) // نجلب بترتيب تنازلي
        .order("id", { ascending: false })         // تأكيد الترتيب الفريد
        .lt("created_at", oldestMessage.created_at) // رسائل أقدم من هذه النقطة الزمنية
        .limit(MESSAGES_PER_PAGE);

      if (error) throw error;

      if (data && data.length > 0) {
        // الرسائل التي تم جلبها هي الأحدث بين الرسائل الأقدم، لذا نحتاج ترتيبها تصاعديًا للإضافة
        const olderMessages = (data as Message[]).sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        // جلب التفاعلات الخاصة بالرسائل الجديدة
        const olderIds = olderMessages.map(m => m.id);
        if (olderIds.length > 0) {
          const { data: reactionsData } = await supabase
            .from("reactions")
            .select("*")
            .in("message_id", olderIds);
          if (reactionsData && reactionsData.length > 0) {
            setReactions(prev => {
              const existing = new Set(prev.map(r => r.id));
              const fresh = (reactionsData as Reaction[]).filter(r => !existing.has(r.id));
              return [...prev, ...fresh];
            });
          }
        }

        // جلب بيانات الاستطلاعات (polls) للرسائل الجديدة
        const pollMsgIds = olderMessages
          .filter(m => m.content && m.content.startsWith("poll:"))
          .map(m => m.content.replace("poll:", ""));
          
        if (pollMsgIds.length > 0) {
          const { data: pollsData } = await supabase
            .from("polls")
            .select("*")
            .in("id", pollMsgIds);
          if (pollsData) {
            const newPolls: Record<string, { question: string; options: string[]; is_active: boolean }> = {};
            pollsData.forEach((p: any) => {
              const opts = typeof p.options === 'string' ? JSON.parse(p.options) : p.options;
              newPolls[p.id] = { question: p.question, options: opts, is_active: p.is_active };
            });
            setPolls(prev => ({ ...prev, ...newPolls }));
          }
        }

        // دمج الرسائل القديمة مع الجديدة، مع تجنب التكرار
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const uniqueOlder = olderMessages.filter(m => !existingIds.has(m.id));
          if (uniqueOlder.length === 0) return prev;
          // أضف الرسائل الأقدم في البداية ثم الرسائل الموجودة
          return [...uniqueOlder, ...prev];
        });
        
        // التحقق من وجود المزيد من الرسائل الأقدم
        setHasMoreMessages(data.length === MESSAGES_PER_PAGE);
        
        // الحفاظ على موضع التمرير
        requestAnimationFrame(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            const diff = newScrollHeight - prevScrollHeight;
            container.scrollTop = prevScrollTop + diff;
          }
        });
      } else {
        // لا توجد رسائل أقدم
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error("Error loading more messages:", error);
    } finally {
      setLoadingMore(false);
      setTimeout(() => { isLoadingMoreRef.current = false; }, 300);
    }
  }, [loadingMore, hasMoreMessages, messages]);

  // Keep the ref always pointing at the latest loadMoreMessages so the
  // scroll handler (bound once) always invokes the freshest version.
  useEffect(() => {
    loadMoreMessagesRef.current = loadMoreMessages;
  }, [loadMoreMessages]);

  // Realtime listener for messages
  useEffect(() => {
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }
    
    const channel = supabase.channel('public-messages', {
      config: {
        broadcast: { self: true },
        presence: { key: userId || `guest-${Math.random().toString(36).slice(2,9)}` }
      }
    });
    
    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          });
      
          if (newMessage.content && newMessage.content.startsWith("poll:")) {
            const pollId = newMessage.content.replace("poll:", "");
            supabase.from("polls").select("*").eq("id", pollId).single().then(({ data }) => {
              if (data) {
                const opts = typeof data.options === 'string' ? JSON.parse(data.options) : data.options;
                setPolls(prev => ({ 
                  ...prev, 
                  [data.id]: { question: data.question, options: opts as string[], is_active: data.is_active } 
                }));
              }
            });
          }
          
          if (messagesContainerRef.current) {
            const container = messagesContainerRef.current;
            const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
            if (isNearBottom) {
              setTimeout(() => scrollToBottom(true), 100);
            } else if (newMessage.user_id !== userId) {
              setHasNewMessages(true);
            }
          }
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
          const deleted = payload.old as { id: string };
          setMessages((prev) => prev.filter((m) => m.id !== deleted.id));
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions' }, (payload) => {
          const r = payload.new as Reaction;
          setReactions((prev) => prev.find((x) => x.id === r.id) ? prev : [...prev, r]);
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'reactions' }, (payload) => {
          const deleted = payload.old as { id: string };
          setReactions((prev) => prev.filter((r) => r.id !== deleted.id));
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true);
        } else if (status === 'CHANNEL_ERROR') {
          setRealtimeConnected(false);
        }
      });
    realtimeChannelRef.current = channel;
    
    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [userId, scrollToBottom]);

  // Presence 
  useEffect(() => {
    // Guests are also counted as online (anonymous key)
    const presenceKey = userId || `guest-${Math.random().toString(36).slice(2,11)}`;
    const presenceName = username || "زائر";
    const presenceChannel = supabase.channel("presence-chat", { config: { presence: { key: presenceKey } } });
    
    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const keys = Object.keys(state);
        setOnlineCount(keys.length);
        setOnlineUsers(new Set(keys));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({ user_id: presenceKey, username: presenceName, online_at: new Date().toISOString() });
        }
      });
      
    presenceChannelRef.current = presenceChannel;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && presenceChannelRef.current) {
        try {
           await presenceChannelRef.current.track({ user_id: presenceKey, username: presenceName, online_at: new Date().toISOString() });
        } catch (error) {
          console.error("Error tracking presence", error);
        }
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => { 
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      supabase.removeChannel(presenceChannel); 
      presenceChannelRef.current = null;
    };
  }, [username, userId]);

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

  // --- دالة جديدة لفتح عارض الوسائط ---
  const handleOpenMedia = useCallback((url: string, type: string, name?: string) => {
    setMediaViewer({ url, type, name });
  }, []);

  // --- دوال التحكم في الرسائل ---
  const handleReply = useCallback((message: Message) => {
    if (isGuest) {
      showAuthRequiredModal("private");
      return;
    }
    setReplyTo(message);
    inputRef.current?.focus();
  }, [isGuest, showAuthRequiredModal]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (isGuest) {
      showAuthRequiredModal("public");
      return;
    }
    await supabase.from("messages").delete().eq("id", messageId);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, [isGuest, showAuthRequiredModal]);

  const handlePinMessage = useCallback(async (msg: Message) => {
    if (isGuest) {
      showAuthRequiredModal("public");
      return;
    }
    if (!adminIds.has(userId)) return;
    await supabase.from("pinned_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    const name = msg.user_id && profilesMap[msg.user_id] ? profilesMap[msg.user_id].username : msg.username;
    const { data } = await supabase.from("pinned_messages").insert({
      message_id: msg.id,
      pinned_by: userId,
      content: msg.content?.slice(0, 300) ?? "",
      username: name,
      user_id: msg.user_id ?? null,
    }).select().single();
    if (data) setPinnedMessage(data as any);
  }, [isGuest, showAuthRequiredModal, adminIds, userId, profilesMap]);

  const handleUnpinMessage = useCallback(async () => {
    if (isGuest) {
      showAuthRequiredModal("public");
      return;
    }
    if (!adminIds.has(userId)) return;
    await supabase.from("pinned_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    setPinnedMessage(null);
  }, [isGuest, showAuthRequiredModal, adminIds, userId]);

  const handleUsernameClick = useCallback((uid: string) => {
    setProfileModal(uid);
  }, []);

  const handleScrollToOriginalMessage = useCallback(async (messageId: string) => {
    await scrollToMessage(messageId);
  }, [scrollToMessage]);

  // handleJoin no longer needed — username is set during signup. Kept as no-op for legacy modal usage.
  const handleJoin = async (_name: string, _avatarFile?: File | null) => { /* deprecated */ };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("حجم الملف يجب أن يكون أقل من 10 ميجابايت"); return; }
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const uploadPublicFile = async (file: File): Promise<{ url: string; name: string; type: string } | null> => {
    try {
      const mimeExt = file.type && file.type.includes("/") ? file.type.split("/")[1].split("+")[0] : "";
      const nameParts = file.name.split(".");
      const nameExt = nameParts.length > 1 ? nameParts.pop()!.toLowerCase() : "";
      const ext = (nameExt || mimeExt || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
      const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('public_chat_files')
        .upload(fileName, file, {
          contentType: file.type || undefined,
          upsert: false,
        });
      if (uploadError) {
        console.error("Public file upload failed:", uploadError);
        return null;
      }
      return { url: fileName, name: file.name, type: file.type };
    } catch (err) {
      console.error("Public file upload exception:", err);
      return null;
    }
  };

  const handleSend = async () => {
    // التحقق من تسجيل الدخول أولاً
    if (!username) {
      showAuthRequiredModal("public");
      return;
    }
    
    if ((!input.trim() && !selectedFile) || sending || isUserBanned) return;
    if (chatLocked && !isCurrentUserAdmin) return;
    
    // --- Pre-flight validation لسد ثغرة ضعف الإنترنت ---
    if (!isCurrentUserAdmin) {
      setSending(true);
      const [{ data: settingsData }, { data: banData }] = await Promise.all([
        supabase.from("chat_settings").select("is_locked").single(),
        supabase.from("banned_users").select("user_id").eq("user_id", userId).maybeSingle()
      ]);

      if (settingsData?.is_locked) {
        setChatLocked(true);
        setSending(false);
        return;
      }

      if (banData) {
        setBannedUserIds(prev => new Set(prev).add(userId));
        setSending(false);
        return;
      }
      setSending(false);
    }
    // ----------------------------------------------------

    const content = input.trim();
    setInput("");
    setSending(true);
    setMentionQuery(null);
    setMentionResults([]);
    
    let fileUrl: string | null = null;
    let fileName: string | null = null;
    let fileType: string | null = null;
    if (selectedFile) {
      setUploadingFile(true);
      const result = await uploadPublicFile(selectedFile);
      if (result) {
        fileUrl = result.url;
        fileName = result.name;
        fileType = result.type;
      }
      setSelectedFile(null);
      setFilePreview(null);
      setUploadingFile(false);
    }
    
    const insertData: any = { 
      username, 
      user_id: userId, 
      content: content || (fileUrl ? `📎 ${fileName}` : "")
    };
    if (fileUrl) {
      insertData.file_url = fileUrl;
      insertData.file_name = fileName;
      insertData.file_type = fileType;
    }
    if (replyTo) {
      insertData.reply_to = replyTo.id;
      insertData.reply_to_username = replyTo.user_id ? getProfile(replyTo.user_id).username : replyTo.username;
      insertData.reply_to_content = replyTo.content?.slice(0, 80) ?? null;
    }
    setReplyTo(null);
    const { data: insertedMsg, error } = await supabase
      .from("messages")
      .insert(insertData)
      .select()
      .single();

    if (!error && insertedMsg) {
      playSound();
      setMessages(prev => {
        if (prev.some(m => m.id === insertedMsg.id)) return prev;
        return [...prev, insertedMsg as Message].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });
    }
    
    setSending(false);
    inputRef.current?.focus();
    setShowStickerPicker(false);
    setShowPollCreator(false);
    setTimeout(() => { forceScrollToBottom(); }, 100);
  };

  const handleSendSticker = async (sticker: string) => {
    if (!username) {
      showAuthRequiredModal("public");
      return;
    }
    if (sending || isUserBanned) return;
    if (chatLocked && !isCurrentUserAdmin) return;
    setSending(true);
    await supabase.from("messages").insert({ username, user_id: userId, content: `sticker:${sticker}` });
    setSending(false);
    setShowStickerPicker(false);
    setTimeout(() => { forceScrollToBottom(); }, 100);
  };

  const handleCreatePoll = async (question: string, options: string[]) => {
    if (!username) {
      showAuthRequiredModal("public");
      return;
    }
    if (sending) return;
    setSending(true);
    try {
      const { data: poll, error } = await supabase.from("polls").insert({ question, options, created_by: userId }).select().single();
      if (poll && !error) {
        await supabase.from("messages").insert({ username, user_id: userId, content: `poll:${poll.id}` });
        setPolls(prev => ({ ...prev, [poll.id]: { question, options, is_active: true } }));
      }
    } catch (e) {
      console.error("Error creating poll:", e);
    }
    setSending(false);
    setShowPollCreator(false);
    setTimeout(() => { forceScrollToBottom(); }, 100);
  };

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
    
    const cursorPos = target.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([^@]*)$/);
    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase().trim();
      setMentionQuery(query);
      const queryParts = query.split(/\s+/).filter(Boolean);
      const results = Object.entries(profilesMap)
        .filter(([uid, p]) => {
          if (uid === userId) return false;
          const name = p.username.toLowerCase();
          if (queryParts.length === 0) return true;
          return queryParts.every(part => name.includes(part));
        })
        .slice(0, 8)
        .map(([uid, p]) => ({ userId: uid, username: p.username }));
      setMentionResults(results);
    } else {
      setMentionQuery(null);
      setMentionResults([]);
    }
  }, [profilesMap, userId]);

  const handleMentionSelect = (mentionUsername: string) => {
    const cursorPos = inputRef.current?.selectionStart || 0;
    const textBeforeCursor = input.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([^@]*)$/);
    if (mentionMatch) {
      const before = textBeforeCursor.slice(0, mentionMatch.index);
      const after = input.slice(cursorPos);
      setInput(`${before}@${mentionUsername} ${after}`);
    }
    setMentionQuery(null);
    setMentionResults([]);
    inputRef.current?.focus();
  };

  const handleSettingsSave = (newUsername: string, newAvatarUrl: string | null) => {
    // Username is immutable post-signup; only avatar can change.
    setProfilesMap((prev) => ({ ...prev, [userId]: { username: newUsername, avatar_url: newAvatarUrl, allow_dms: prev[userId]?.allow_dms } }));
  };

  const handleBackFromDMs = () => {
    setIsReturningFromDMs(true);
    setUnreadDMs(0);
    navigate('/');
  };

  const handleToggleChatLock = async () => {
    if (isGuest) {
      showAuthRequiredModal("public");
      return;
    }
    const newLocked = !chatLocked;
    await supabase.from("chat_settings").update({ is_locked: newLocked, locked_by: userId, locked_at: newLocked ? new Date().toISOString() : null }).neq("id", "00000000-0000-0000-0000-000000000000");
    setChatLocked(newLocked);
  };

  // دالة معالجة زر تواصل عبر الخاص
  const handleDirectMessageClick = () => {
    if (isGuest) {
      showAuthRequiredModal("private");
      return;
    }
    navigate('/dms');
  };

  const adminProfiles = Array.from(adminIds).map(id => ({ id, ...getProfile(id) }));

  const renderMessageContent = useCallback((msg: Message) => {
    if (msg.content && msg.content.startsWith("poll:")) {
      const pId = msg.content.replace("poll:", "");
      const pollData = polls[pId];
      if (pollData && pollData.options && Array.isArray(pollData.options)) {
        return (
          <PollMessage 
            pollId={pId} 
            currentUserId={userId} 
          />
        );
      }
      return (
        <div className="w-full max-w-[300px] rounded-xl overflow-hidden" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
          <div className="px-3 py-8 text-center">
            <div className="inline-block w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "hsl(var(--primary))", borderTopColor: "transparent" }} />
          </div>
        </div>
      );
    }
    return null;
  }, [polls, userId]);

  const renderedMessagesList = useMemo(() => {
    return messages.map((msg) => {
      const isPoll = msg.content && msg.content.startsWith("poll:");
      const pollContent = isPoll ? renderMessageContent(msg) : null;
      
      if (isPoll) {
        return (
          <div key={msg.id} id={`message-${msg.id}`} className="flex gap-2 animate-fade-in">
            <div className="max-w-[85%]">
              <div className="flex items-center gap-1 mb-1">
                <ShieldCheck className="w-3 h-3" style={{ color: "#1D9BF0" }} />
                <span className="text-[11px] font-semibold" style={{ color: "#1D9BF0" }}>
                  {msg.user_id && profilesMap[msg.user_id] ? profilesMap[msg.user_id].username : msg.username}
                </span>
              </div>
              {pollContent}
            </div>
          </div>
        );
      }
      
      return (
        <ChatMessage 
          key={msg.id} 
          message={msg} 
          currentUserId={userId} 
          currentUsername={username ?? ""} 
          currentAvatarUrl={avatarUrl} 
          reactions={reactionsByMessageId[msg.id] || []} 
          profilesMap={profilesMap} 
          isOnline={msg.user_id ? onlineUsers.has(msg.user_id) : false} 
          isAdmin={msg.user_id ? adminIds.has(msg.user_id) : false} 
          isCurrentUserAdmin={adminIds.has(userId)} 
          messageCounts={messageCounts} 
          onReply={handleReply} 
          onUsernameClick={handleUsernameClick} 
          onDelete={handleDeleteMessage} 
          onPin={handlePinMessage}
          onScrollToOriginalMessage={handleScrollToOriginalMessage}
          onOpenMedia={handleOpenMedia}
        />
      );
    });
  }, [messages, polls, userId, username, avatarUrl, reactionsByMessageId, profilesMap, onlineUsers, adminIds, messageCounts, handleReply, handleUsernameClick, handleDeleteMessage, handlePinMessage, handleScrollToOriginalMessage, renderMessageContent, handleOpenMedia]);

  if (authLoading || (user && !profile && !username)) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: "hsl(var(--background))" }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "hsl(var(--primary))", borderTopColor: "transparent" }} />
      </div>
    );
  }
  
  if (showChatInfo) {
    return (
      <ChatInfo totalUsers={totalUsers} onlineCount={onlineCount} profilesMap={profilesMap} adminIds={adminIds} onlineUsers={onlineUsers} onUsernameClick={(uid) => { navigate('/'); setProfileModal(uid); }} />
    );
  }

  if (showAdminPanel && isCurrentUserAdmin) {
    return (
      <div className="flex flex-col h-screen select-none" style={{ background: "hsl(var(--chat-bg))" }}>
        <header className="flex-shrink-0 px-4 py-2.5 flex items-center gap-3" style={{ background: "hsl(var(--chat-header))", borderBottom: "1px solid hsl(var(--border))" }}>
          <button onClick={() => navigate('/')} className="p-1.5 rounded-full hover:opacity-70" style={{ color: "hsl(var(--primary))" }}>
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
      <DirectMessages currentUserId={userId} currentUsername={username ?? ""} profilesMap={profilesMap} onlineUsers={onlineUsers} initialConversationUserId={dmInitialUserId} onBack={handleBackFromDMs} isAdmin={isCurrentUserAdmin} />
    );
  }

  return (
    <div className="chat-app-shell flex flex-col h-screen select-none" dir="rtl" style={{ background: "hsl(var(--chat-bg))" }}>
      {/* Header */}
      <header className="chat-app-header flex-shrink-0 px-3 py-2.5 flex items-center justify-between overflow-hidden fixed top-0 left-0 right-0 z-20" style={{ background: "hsl(var(--chat-header))", borderBottom: "1px solid hsl(var(--border))" }}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="chat-brand-icon w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "hsl(var(--primary))" }}>
            <MessageCircle className="w-5 h-5" style={{ color: "hsl(var(--primary-foreground))" }} />
          </div>
          <button onClick={() => navigate('/chat-info')} className="text-right hover:opacity-80 transition-opacity">
              <h1 className="font-semibold text-[15px]" style={{ color: "hsl(var(--foreground))" }}>دردشة نبض التفوق</h1>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: "hsl(var(--chat-online))" }} />
                 <span className="text-[11px]" style={{ color: "hsl(var(--chat-online))" }}>{onlineCount} متصلاً الآن</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3" style={{ color: "hsl(var(--muted-foreground))" }} />
                <span className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{totalUsers}</span>
              </div>
              {realtimeConnected && (
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}></span>
                </div>
              )}
            </div>
          </button>
        </div>
        <div className="flex items-center gap-1">
          {isCurrentUserAdmin && (
            <button onClick={() => navigate('/admin')} title="لوحة المشرفين"
              className="p-2 rounded-full transition-colors hover:opacity-70"
              style={{ color: "hsl(var(--primary))" }}>
              <ShieldCheck className="w-5 h-5" />
            </button>
          )}
          {isCurrentUserAdmin && (
            <button onClick={handleToggleChatLock} title={chatLocked ? "فتح الدردشة" : "إغلاق الدردشة"}
              className="p-2 rounded-full transition-colors hover:opacity-70"
              style={{ color: chatLocked ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))" }}>
              {chatLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
            </button>
          )}
          
          
          {/* زر الرسائل الخاصة مع فحص تسجيل الدخول */}
          <button 
            onClick={handleDirectMessageClick} 
            title="الرسائل الخاصة"
            className="relative p-2 rounded-full transition-colors hover:opacity-70" 
            style={{ color: "hsl(var(--muted-foreground))" }}>
            <MessageSquare className="w-5 h-5" />
            {!isGuest && unreadDMs > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full text-[10px] font-bold flex items-center justify-center px-1"
                style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}>{unreadDMs}</span>
            )}
          </button>
          
          {avatarUrl && (
            <img src={avatarUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
              style={{ border: "2px solid hsl(var(--primary) / 0.4)" }} onClick={() => setShowSettings(true)} />
          )}
          <button onClick={() => setShowSettings(true)} title="الإعدادات" className="p-2 rounded-full transition-colors hover:opacity-70" style={{ color: "hsl(var(--muted-foreground))" }}>
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Pinned message banner */}
      {pinnedMessage && (
        <div className="chat-app-pinned flex-shrink-0 px-3 py-2 flex items-start gap-2 animate-fade-in mt-14" style={{ background: "hsl(var(--primary) / 0.08)", borderBottom: "1px solid hsl(var(--primary) / 0.2)" }}>
          <Pin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "hsl(var(--primary))" }} />
          <button onClick={() => setShowPinnedExpanded(v => !v)} className="flex-1 min-w-0 text-right">
            <div className="text-[10px] font-semibold mb-0.5" style={{ color: "hsl(var(--primary))" }}>رسالة مثبّتة · {pinnedMessage.username}</div>
            <div className={`text-[12px] ${showPinnedExpanded ? '' : 'truncate'}`} style={{ color: "hsl(var(--foreground))" }}>{pinnedMessage.content}</div>
          </button>
          {isCurrentUserAdmin && (
            <button onClick={handleUnpinMessage} title="إلغاء التثبيت" className="flex-shrink-0 p-1 rounded-full hover:opacity-70" style={{ color: "hsl(var(--muted-foreground))" }}>
              <PinOff className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Messages area */}
      <div 
        ref={messagesContainerRef} 
        className="chat-app-messages flex-1 overflow-y-auto px-3 space-y-2 relative"
        style={{ 
          marginTop: pinnedMessage ? '108px' : '56px',
          marginBottom: '0px',
          paddingBottom: '100px',
          paddingTop: '12px',
          backgroundImage: chatBg ? `url(${chatBg})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
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
            {renderedMessagesList}
            <div ref={messagesEndRef} />
          </>
        )}

        {(showScrollButton || hasNewMessages) && (
          <div className="fixed bottom-24 right-4 flex flex-col items-end gap-2 z-10">
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
                <button key={admin.id} onClick={() => {
                  if (isGuest) {
                    showAuthRequiredModal("private");
                  } else {
                    navigate(`/dm/${admin.id}`);
                  }
                }}
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
        /* Input area */
        <div className="chat-app-composer flex-shrink-0 px-3 pb-3 pt-1.5 fixed bottom-0 left-0 right-0 z-20" style={{ background: "hsl(var(--chat-bg))" }}>
           {chatLocked && isCurrentUserAdmin && (
            <div className="flex items-center justify-center gap-2 mb-2 px-3 py-1.5 rounded-full" style={{ background: "hsl(var(--destructive) / 0.1)" }}>
              <Lock className="w-3 h-3" style={{ color: "hsl(var(--destructive))" }} />
              <span className="text-[11px]" style={{ color: "hsl(var(--destructive))" }}>الدردشة مغلقة - أنت مشرف يمكنك الكتابة</span>
            </div>
          )}

          {/* Reply preview */}
          {replyTo && (
            <div className="mb-2 px-3 py-2 rounded-xl flex items-center justify-between gap-2 animate-fade-in"
              style={{ background: "hsl(var(--chat-reply-bg, var(--secondary)))", border: "1px solid hsl(var(--border))", borderRight: "3px solid hsl(var(--primary))" }}>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <CornerUpLeft className="w-4 h-4 flex-shrink-0" style={{ color: "hsl(var(--primary))" }} />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold" style={{ color: "hsl(var(--primary))" }}>
                    {replyTo.user_id === userId ? "أنت" : (replyTo.user_id ? getProfile(replyTo.user_id).username : replyTo.username)}
                  </p>
                  <p className="text-[11px] truncate" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {replyTo.content && replyTo.content.startsWith("sticker:") ? "ملصق" : replyTo.content?.slice(0, 80)}
                  </p>
                </div>
              </div>
              <button onClick={() => setReplyTo(null)} className="flex-shrink-0 p-1 rounded-full hover:opacity-70" style={{ color: "hsl(var(--muted-foreground))" }}>
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Poll creator */}
          {showPollCreator && isCurrentUserAdmin && (
            <div className="mb-2">
              <PollCreator onCreatePoll={handleCreatePoll} onClose={() => setShowPollCreator(false)} />
            </div>
          )}

          {/* Mention autocomplete */}
          {mentionQuery !== null && mentionResults.length > 0 && (
            <div className="mb-2 rounded-xl overflow-hidden animate-fade-in" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
              {mentionResults.map((r) => (
                <button
                  key={r.userId}
                  onClick={() => handleMentionSelect(r.username)}
                  className="w-full px-3 py-2 flex items-center gap-2 text-right hover:opacity-80 transition-opacity"
                  style={{ borderBottom: "1px solid hsl(var(--border))" }}
                >
                  {profilesMap[r.userId]?.avatar_url ? (
                    <img src={profilesMap[r.userId].avatar_url!} alt="" className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))" }}>
                      {r.username.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="text-[12px] font-medium" style={{ color: "hsl(var(--foreground))" }}>@{r.username}</span>
                </button>
              ))}
            </div>
          )}

          {/* Admin sticker picker */}
          {showStickerPicker && isCurrentUserAdmin && (
            <div className="mb-2 p-3 rounded-xl animate-fade-in" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
              <p className="text-[11px] font-medium mb-2 px-1" style={{ color: "hsl(var(--muted-foreground))" }}>ملصقات المشرفين المتحركة</p>
              <div className="grid grid-cols-8 gap-1">
                {ADMIN_ANIMATED_STICKERS.map((sticker) => (
                  <button key={sticker.emoji} onClick={() => handleSendSticker(sticker.emoji)}
                    className={`w-10 h-10 flex items-center justify-center rounded-lg text-xl transition-all hover:scale-125 active:scale-90 ${sticker.animation}`}
                    style={{ background: "hsl(var(--secondary))" }}
                    title={sticker.label}>
                    {sticker.emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* File preview */}
          {selectedFile && (
            <div className="mb-2 p-2 rounded-xl flex items-center gap-3 animate-fade-in"
              style={{ background: "hsl(var(--chat-reply-bg))", border: "1px solid hsl(var(--border))" }}>
              {filePreview ? (
                <img src={filePreview} alt="Preview" className="w-12 h-12 object-cover rounded-lg" />
              ) : (
                <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: "hsl(var(--secondary))" }}>
                  <Paperclip className="w-5 h-5" style={{ color: "hsl(var(--muted-foreground))" }} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate" style={{ color: "hsl(var(--foreground))" }}>{selectedFile.name}</p>
                <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{(selectedFile.size / 1024).toFixed(1)} KB</p>
              </div>
              <button onClick={() => { setSelectedFile(null); setFilePreview(null); }} className="p-2 rounded-lg" style={{ color: "hsl(var(--muted-foreground))" }}>
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <input type="file" ref={fileInputRef2} onChange={handleFileSelect} className="hidden" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar" />

          <div className="flex items-end gap-2">
            {isCurrentUserAdmin && (
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => { setShowPollCreator(!showPollCreator); setShowStickerPicker(false); }} title="استطلاع رأي"
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90"
                  style={{ background: showPollCreator ? "hsl(var(--primary) / 0.2)" : "hsl(var(--secondary))", color: showPollCreator ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}>
                  <BarChart3 className="w-4 h-4" />
                </button>
              </div>
            )}
            <button onClick={() => fileInputRef2.current?.click()} disabled={uploadingFile} title="إرفاق ملف"
              className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-40"
              style={{ background: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))" }}>
              <Paperclip className="w-4 h-4" />
            </button>
            
            <div className="chat-input-field flex-1 flex items-end rounded-2xl overflow-hidden" style={{ background: "hsl(var(--chat-input-bg))", border: "1px solid hsl(var(--border))" }}>
              <textarea ref={inputRef} value={input}
                onChange={handleInputChange}
                placeholder="اكتب رسالتك أو شارك رابطاً..."
                rows={1} maxLength={500}
                className="flex-1 resize-none bg-transparent outline-none text-[14px] leading-relaxed select-text px-3 py-2"
                style={{ color: "hsl(var(--foreground))", minHeight: "24px", maxHeight: "120px", direction: "rtl", textAlign: "right" }}
              />
            </div>
            <button onClick={handleSend} disabled={(!input.trim() && !selectedFile) || sending}
              className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 disabled:opacity-40"
              style={{ background: (input.trim() || selectedFile) && !sending ? "hsl(var(--primary))" : "hsl(var(--secondary))" }}>
              <Send className="w-4 h-4" style={{ color: (input.trim() || selectedFile) && !sending ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))" }} />
            </button>
          </div>
        </div>
      )}

      {showSettings && (
        <SettingsModal currentUsername={username ?? ""} currentAvatarUrl={avatarUrl} userId={userId} onClose={() => setShowSettings(false)} onSave={handleSettingsSave} chatBg={chatBg} onChatBgChange={(bg) => { setChatBg(bg); if (bg) localStorage.setItem("chat_bg_image", bg); else localStorage.removeItem("chat_bg_image"); }} />
      )}

      {profileModal && (
        <UserProfileModal userId={profileModal} username={getProfile(profileModal).username} avatarUrl={getProfile(profileModal).avatar_url} currentUserId={userId} isOnline={onlineUsers.has(profileModal)} isAdmin={adminIds.has(profileModal)} isCurrentUserAdmin={isCurrentUserAdmin} allowDms={profilesMap[profileModal]?.allow_dms ?? true} onClose={() => setProfileModal(null)} onStartDM={(uid) => {
          if (isGuest) {
            showAuthRequiredModal("private");
          } else {
            navigate(`/dm/${uid}`);
            setProfileModal(null);
          }
        }} />
      )}

      {/* Media Viewer Modal */}
      {mediaViewer && (
        <MediaViewer
          url={mediaViewer.url}
          type={mediaViewer.type}
          name={mediaViewer.name}
          onClose={() => setMediaViewer(null)}
        />
      )}
    </div>
  );
};

export default Index;
