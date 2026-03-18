import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Image, ChevronRight, Search, RefreshCw } from "lucide-react";
import LinkifiedText from "@/components/LinkifiedText";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface AdminPanelProps {
  profilesMap: Record<string, { username: string; avatar_url: string | null }>;
}

interface DmConversation {
  participantA: string;
  participantB: string;
  usernameA: string;
  usernameB: string;
  avatarA: string | null;
  avatarB: string | null;
  lastMessage: string;
  lastTime: string;
  messageCount: number;
}

interface DmImage {
  id: string;
  image_url: string;
  image_name: string | null;
  sender_username: string;
  receiver_username: string;
  sender_user_id: string | null;
  receiver_user_id: string | null;
  created_at: string;
}

type Tab = "conversations" | "images";

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

const AdminPanel = ({ profilesMap }: AdminPanelProps) => {
  const [tab, setTab] = useState<Tab>("conversations");
  const [conversations, setConversations] = useState<DmConversation[]>([]);
  const [images, setImages] = useState<DmImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConv, setSelectedConv] = useState<{ userA: string; userB: string } | null>(null);
  const [convMessages, setConvMessages] = useState<any[]>([]);
  const [convLoading, setConvLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const getProfile = (uid: string, fallbackUsername?: string) => profilesMap[uid] || { username: fallbackUsername || uid?.slice(0, 6) || "؟", avatar_url: null };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchAllRows = async (table: string, query: any) => {
    const pageSize = 1000;
    let allData: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await query.range(from, from + pageSize - 1);
      if (error || !data || data.length === 0) break;
      allData = allData.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    return allData;
  };

  const fetchData = async () => {
    setLoading(true);
    const [allDms, allImages] = await Promise.all([
      fetchAllRows("direct_messages", supabase.from("direct_messages").select("*").order("created_at", { ascending: false })),
      fetchAllRows("direct_messages", supabase.from("direct_messages").select("*").not("image_url", "is", null).order("created_at", { ascending: false })),
    ]);
    const dmsData = allDms;
    const imagesData = allImages;

    // Build conversations
    if (dmsData) {
      const convMap = new Map<string, DmConversation>();
      for (const dm of dmsData) {
        const a = dm.sender_user_id || dm.sender_username;
        const b = dm.receiver_user_id || dm.receiver_username;
        const key = [a, b].sort().join("||");
        if (!convMap.has(key)) {
          const profileA = dm.sender_user_id ? getProfile(dm.sender_user_id, dm.sender_username) : { username: dm.sender_username, avatar_url: null };
          const profileB = dm.receiver_user_id ? getProfile(dm.receiver_user_id, dm.receiver_username) : { username: dm.receiver_username, avatar_url: null };
          convMap.set(key, {
            participantA: a,
            participantB: b,
            usernameA: profileA.username,
            usernameB: profileB.username,
            avatarA: profileA.avatar_url,
            avatarB: profileB.avatar_url,
            lastMessage: dm.content,
            lastTime: dm.created_at,
            messageCount: 1,
          });
        } else {
          convMap.get(key)!.messageCount++;
        }
      }
      setConversations(Array.from(convMap.values()));
    }

    if (imagesData) {
      setImages(imagesData as DmImage[]);
    }
    setLoading(false);
  };

  const openConversation = async (userA: string, userB: string) => {
    setSelectedConv({ userA, userB });
    setConvLoading(true);
    const allMessages = await fetchAllRows("direct_messages",
      supabase
        .from("direct_messages")
        .select("*")
        .or(
          `and(sender_user_id.eq.${userA},receiver_user_id.eq.${userB}),and(sender_user_id.eq.${userB},receiver_user_id.eq.${userA})`
        )
        .order("created_at", { ascending: true })
    );
    setConvMessages(allMessages);
    setConvLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const refreshConversation = async () => {
    if (!selectedConv || refreshing) return;
    setRefreshing(true);
    const allMessages = await fetchAllRows("direct_messages",
      supabase
        .from("direct_messages")
        .select("*")
        .or(
          `and(sender_user_id.eq.${selectedConv.userA},receiver_user_id.eq.${selectedConv.userB}),and(sender_user_id.eq.${selectedConv.userB},receiver_user_id.eq.${selectedConv.userA})`
        )
        .order("created_at", { ascending: true })
    );
    setConvMessages(allMessages);
    setRefreshing(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  // Realtime subscription for active conversation
  useEffect(() => {
    if (!selectedConv) return;
    const { userA, userB } = selectedConv;
    const channel = supabase
      .channel(`admin-dm-${userA}-${userB}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, (payload) => {
        const msg = payload.new as any;
        const isRelevant =
          (msg.sender_user_id === userA && msg.receiver_user_id === userB) ||
          (msg.sender_user_id === userB && msg.receiver_user_id === userA);
        if (isRelevant) {
          setConvMessages((prev) => {
            if (prev.find((m: any) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "direct_messages" }, (payload) => {
        const deleted = payload.old as { id: string };
        setConvMessages((prev) => prev.filter((m: any) => m.id !== deleted.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedConv]);

  const formatTime = (t: string) => {
    const d = new Date(t);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffH = diffMs / 3600000;
    if (diffH < 1) return `${Math.floor(diffMs / 60000)} د`;
    if (diffH < 24) return `${Math.floor(diffH)} س`;
    return d.toLocaleDateString("ar");
  };

  const filteredConversations = conversations.filter(c =>
    !search || c.usernameA.includes(search) || c.usernameB.includes(search)
  );

  const filteredImages = images.filter(img =>
    !search || img.sender_username.includes(search) || img.receiver_username.includes(search)
  );

  // Conversation detail view
  if (selectedConv) {
    // Find usernames from conversation messages
    const firstMsg = convMessages[0];
    const usernameA = firstMsg ? (firstMsg.sender_user_id === selectedConv.userA ? firstMsg.sender_username : firstMsg.receiver_username) : undefined;
    const usernameB = firstMsg ? (firstMsg.sender_user_id === selectedConv.userB ? firstMsg.sender_username : firstMsg.receiver_username) : undefined;
    const profileA = getProfile(selectedConv.userA, usernameA);
    const profileB = getProfile(selectedConv.userB, usernameB);
    return (
      <div className="flex flex-col h-full" style={{ background: "hsl(var(--chat-bg, var(--background)))" }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ background: "hsl(var(--chat-header, var(--card)))", borderBottom: "1px solid hsl(var(--border))" }}>
          <button onClick={() => setSelectedConv(null)} className="p-1.5 rounded-full hover:opacity-70 transition-opacity" style={{ color: "hsl(var(--primary))" }}>
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="flex -space-x-2 rtl:space-x-reverse flex-shrink-0">
            {profileA.avatar_url ? (
              <img src={profileA.avatar_url} className="w-8 h-8 rounded-full object-cover" style={{ border: "2px solid hsl(var(--background))" }} />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ background: `${getUserColor(profileA.username)}22`, color: getUserColor(profileA.username), border: "2px solid hsl(var(--background))" }}>
                {profileA.username.slice(0, 2).toUpperCase()}
              </div>
            )}
            {profileB.avatar_url ? (
              <img src={profileB.avatar_url} className="w-8 h-8 rounded-full object-cover" style={{ border: "2px solid hsl(var(--background))" }} />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ background: `${getUserColor(profileB.username)}22`, color: getUserColor(profileB.username), border: "2px solid hsl(var(--background))" }}>
                {profileB.username.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <h2 className="font-semibold text-[13px] flex-1" style={{ color: "hsl(var(--foreground))" }}>
            {profileA.username} ↔ {profileB.username}
          </h2>
          <button 
            onClick={refreshConversation} 
            disabled={refreshing}
            className="p-2 rounded-full hover:opacity-70 transition-all active:scale-90"
            style={{ color: "hsl(var(--primary))" }}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-4 space-y-3">
          {convLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "hsl(var(--primary))", borderTopColor: "transparent" }} />
            </div>
          ) : convMessages.length === 0 ? (
            <p className="text-center text-[13px] py-8" style={{ color: "hsl(var(--muted-foreground))" }}>لا توجد رسائل</p>
          ) : (
            convMessages.map((msg: any) => {
              const isUserA = msg.sender_user_id === selectedConv.userA;
              const senderProfile = msg.sender_user_id ? getProfile(msg.sender_user_id, msg.sender_username) : { username: msg.sender_username, avatar_url: null };
              const senderColor = getUserColor(senderProfile.username);

              return (
                <div key={msg.id} className={`flex gap-2 animate-fade-in ${isUserA ? "flex-row" : "flex-row-reverse"}`}>
                  {/* Avatar */}
                  <div className="flex-shrink-0 mt-1">
                    {senderProfile.avatar_url ? (
                      <img src={senderProfile.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" style={{ border: `2px solid ${senderColor}55` }} />
                    ) : (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: `${senderColor}22`, color: senderColor, border: `2px solid ${senderColor}55` }}>
                        {senderProfile.username.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Bubble */}
                  <div className={`max-w-[75%] flex flex-col ${isUserA ? "items-start" : "items-end"}`}>
                    {/* Sender name */}
                    <span className="text-[11px] font-semibold mb-0.5 px-1" style={{ color: senderColor }}>
                      {senderProfile.username}
                    </span>

                    {/* Reply preview */}
                    {msg.reply_to_content && (
                      <div className="px-2 py-1 rounded-lg text-[11px] mb-1 max-w-full" style={{ background: "hsl(var(--chat-reply-bg, var(--secondary)))", border: "1px solid hsl(var(--border))", borderRight: isUserA ? undefined : "2px solid hsl(var(--primary))", borderLeft: isUserA ? "2px solid hsl(var(--primary))" : undefined }}>
                        <p className="truncate" style={{ color: "hsl(var(--muted-foreground))" }}>{msg.reply_to_content}</p>
                      </div>
                    )}

                    {/* Image */}
                    {msg.image_url && (
                      <div className={`mb-1 rounded-xl overflow-hidden cursor-pointer transition-transform hover:scale-[1.02] ${isUserA ? "rounded-tl-sm" : "rounded-tr-sm"}`} onClick={() => setLightboxImg(msg.image_url)}>
                        <img src={msg.image_url} alt="" className="max-w-[200px] max-h-[200px] object-cover" loading="lazy" />
                      </div>
                    )}

                    {/* Text bubble */}
                    {msg.content && msg.content !== "📷 صورة" && (
                      <div className={`px-3 py-2 rounded-2xl text-[13px] break-words ${isUserA ? "rounded-tl-sm chat-bubble-other" : "rounded-tr-sm chat-bubble-own"}`} style={{ direction: "rtl", textAlign: "right" }}>
                        <LinkifiedText text={msg.content} />
                      </div>
                    )}

                    {/* Time + receiver */}
                    <div className="flex items-center gap-1.5 mt-0.5 px-1">
                      <span className="text-[10px]" style={{ color: "hsl(var(--chat-timestamp, var(--muted-foreground)))" }}>
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: ar })}
                      </span>
                      <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>→ {msg.receiver_username}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Lightbox */}
        {lightboxImg && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
            <img src={lightboxImg} alt="" className="max-w-full max-h-full rounded-lg" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex gap-0" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <button
          onClick={() => setTab("conversations")}
          className="flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-semibold transition-all"
          style={{
            color: tab === "conversations" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
            borderBottom: tab === "conversations" ? "2px solid hsl(var(--primary))" : "2px solid transparent",
          }}
        >
          <MessageSquare className="w-4 h-4" /> المحادثات الخاصة
        </button>
        <button
          onClick={() => setTab("images")}
          className="flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-semibold transition-all"
          style={{
            color: tab === "images" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
            borderBottom: tab === "images" ? "2px solid hsl(var(--primary))" : "2px solid transparent",
          }}
        >
          <Image className="w-4 h-4" /> الصور المرسلة
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-full" style={{ background: "hsl(var(--secondary))" }}>
          <Search className="w-4 h-4" style={{ color: "hsl(var(--muted-foreground))" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم المستخدم..."
            className="flex-1 bg-transparent outline-none text-[13px]"
            style={{ color: "hsl(var(--foreground))", direction: "rtl" }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "hsl(var(--primary))", borderTopColor: "transparent" }} />
          </div>
        ) : tab === "conversations" ? (
          filteredConversations.length === 0 ? (
            <p className="text-center text-[13px] py-8" style={{ color: "hsl(var(--muted-foreground))" }}>لا توجد محادثات</p>
          ) : (
            <div className="space-y-1.5">
              {filteredConversations.map((conv, i) => (
                <button
                  key={i}
                  onClick={() => openConversation(conv.participantA, conv.participantB)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors hover:opacity-80"
                  style={{ background: "hsl(var(--secondary))" }}
                >
                  <div className="flex -space-x-2 rtl:space-x-reverse flex-shrink-0">
                    {conv.avatarA ? (
                      <img src={conv.avatarA} className="w-9 h-9 rounded-full object-cover" style={{ border: "2px solid hsl(var(--background))" }} />
                    ) : (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold" style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", border: "2px solid hsl(var(--background))" }}>
                        {conv.usernameA[0]}
                      </div>
                    )}
                    {conv.avatarB ? (
                      <img src={conv.avatarB} className="w-9 h-9 rounded-full object-cover" style={{ border: "2px solid hsl(var(--background))" }} />
                    ) : (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold" style={{ background: "hsl(var(--accent))", color: "hsl(var(--accent-foreground))", border: "2px solid hsl(var(--background))" }}>
                        {conv.usernameB[0]}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>
                        {conv.usernameA} ↔ {conv.usernameB}
                      </span>
                      <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>{formatTime(conv.lastTime)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-[12px] truncate" style={{ color: "hsl(var(--muted-foreground))" }}>{conv.lastMessage}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" }}>
                        {conv.messageCount} رسالة
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 flex-shrink-0 rtl:rotate-180" style={{ color: "hsl(var(--muted-foreground))" }} />
                </button>
              ))}
            </div>
          )
        ) : (
          filteredImages.length === 0 ? (
            <p className="text-center text-[13px] py-8" style={{ color: "hsl(var(--muted-foreground))" }}>لا توجد صور</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filteredImages.map((img) => (
                <div key={img.id} className="rounded-xl overflow-hidden" style={{ background: "hsl(var(--secondary))" }}>
                  <img
                    src={img.image_url}
                    alt={img.image_name || ""}
                    className="w-full h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setLightboxImg(img.image_url)}
                  />
                  <div className="p-2 space-y-0.5">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-semibold" style={{ color: "hsl(var(--primary))" }}>من:</span>
                      <span className="text-[11px]" style={{ color: "hsl(var(--foreground))" }}>{img.sender_username}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-semibold" style={{ color: "hsl(var(--primary))" }}>إلى:</span>
                      <span className="text-[11px]" style={{ color: "hsl(var(--foreground))" }}>{img.receiver_username}</span>
                    </div>
                    <span className="text-[9px]" style={{ color: "hsl(var(--muted-foreground))" }}>{formatTime(img.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {lightboxImg && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
