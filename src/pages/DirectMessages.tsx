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

const DirectMessages = ({ 
  currentUserId, 
  currentUsername, 
  profilesMap, 
  onlineUsers, 
  initialConversationUserId, 
  onBack 
}: DirectMessagesProps) => {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(initialConversationUserId || null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // إضافة useEffect لإدارة history للعودة إلى الدردشة العامة
  useEffect(() => {
    // إضافة حالة جديدة إلى history عند فتح صفحة الرسائل الخاصة
    window.history.pushState({ page: 'dms', timestamp: Date.now() }, '', '/dms');
    
    // معالج حدث popstate للعودة
    const handlePopState = (event: PopStateEvent) => {
      // منع التنقل الافتراضي
      event.preventDefault();
      
      // التحقق من الحالة
      if (event.state?.page === 'dms' || !event.state) {
        // العودة إلى الدردشة العامة
        onBack();
      }
    };

    // إضافة مستمع الحدث
    window.addEventListener('popstate', handlePopState);

    // تنظيف المستمع عند إلغاء تحميل المكون
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [onBack]); // إعادة التشغيل إذا تغيرت دالة onBack

  // إضافة useEffect للتعامل مع التنقل بين المحادثات
  useEffect(() => {
    // إذا كان هناك محادثة نشطة، أضف نقطة في history للمحادثة
    if (activeConversation) {
      const conversationProfile = profilesMap[activeConversation];
      const conversationName = conversationProfile?.username || 'محادثة';
      
      // إضافة حالة للمحادثة في history
      window.history.pushState(
        { page: 'dm-conversation', userId: activeConversation, timestamp: Date.now() }, 
        '', 
        `/dm/${activeConversation}`
      );
    }
  }, [activeConversation, profilesMap]);

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
          className="flex items-center gap-3 px-4 py-
