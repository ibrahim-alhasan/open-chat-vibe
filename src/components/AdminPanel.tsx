import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Ban, RefreshCw, ShieldOff, MessageSquare, ChevronRight, ArrowRight, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface AdminPanelProps {
  profilesMap: Record<string, { username: string; avatar_url: string | null }>;
}

const SECRET_CODE = "ahmad06afrin&&sy088abc";

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
  const [activeTab, setActiveTab] = useState<"banned" | "dms">("banned");
  const [bannedUsers, setBannedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unbanLoading, setUnbanLoading] = useState<string | null>(null);
  
  // DM monitoring
  const [secretInput, setSecretInput] = useState("");
  const [dmUnlocked, setDmUnlocked] = useState(false);
  const [dmConversations, setDmConversations] = useState<any[]>([]);
  const [dmLoading, setDmLoading] = useState(false);
  const [selectedConvo, setSelectedConvo] = useState<{ user1: string; user2: string } | null>(null);
  const [convoMessages, setConvoMessages] = useState<any[]>([]);
  const [convoLoading, setConvoLoading] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  const getProfile = (uid: string) => profilesMap[uid] || { username: uid?.slice(0, 6) || "؟", avatar_url: null };

  const fetchBanned = async () => {
    setLoading(true);
    const { data } = await supabase.from("banned_users").select("*").order("created_at", { ascending: false });
    setBannedUsers(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchBanned(); }, []);

  const handleUnban = async (bannedId: string, visitorUserId: string) => {
    setUnbanLoading(visitorUserId);
    await supabase.from("banned_users").delete().eq("id", bannedId);
    setBannedUsers(prev => prev.filter(b => b.id !== bannedId));
    setUnbanLoading(null);
  };

  // Handle secret code check - just check on input change
  useEffect(() => {
    if (secretInput === SECRET_CODE) {
      setDmUnlocked(true);
      setSecretInput("");
      fetchDmConversations();
    }
  }, [secretInput]);

  // Fetch ALL DM conversations using pagination to bypass 1000 limit
  const fetchAllDMs = async () => {
    const allData: any[] = [];
    const batchSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data } = await supabase
        .from("direct_messages")
        .select("sender_user_id, receiver_user_id, sender_username, receiver_username, content, created_at, image_url")
        .order("created_at", { ascending: false })
        .range(offset, offset + batchSize - 1);

      if (data && data.length > 0) {
        allData.push(...data);
        offset += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }
    return allData;
  };

  const fetchDmConversations = async () => {
    setDmLoading(true);
    const data = await fetchAllDMs();

    if (data.length > 0) {
      const convosMap = new Map<string, any>();
      for (const msg of data) {
        const key = [msg.sender_user_id, msg.receiver_user_id].sort().join("_");
        if (!convosMap.has(key)) {
          convosMap.set(key, {
            user1: msg.sender_user_id,
            user2: msg.receiver_user_id,
            lastMessage: msg.image_url ? "📷 صورة" : msg.content,
            lastTime: msg.created_at,
            msgCount: 1,
          });
        } else {
          convosMap.get(key).msgCount++;
        }
      }
      setDmConversations(Array.from(convosMap.values()));
    }
    setDmLoading(false);
  };

  // Fetch ALL messages for a specific conversation
  const fetchConvoMessages = async (user1: string, user2: string) => {
    setConvoLoading(true);
    setSelectedConvo({ user1, user2 });

    const allMessages: any[] = [];
    const batchSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data } = await supabase
        .from("direct_messages")
        .select("*")
        .or(`and(sender_user_id.eq.${user1},receiver_user_id.eq.${user2}),and(sender_user_id.eq.${user2},receiver_user_id.eq.${user1})`)
        .order("created_at", { ascending: true })
        .range(offset, offset + batchSize - 1);

      if (data && data.length > 0) {
        allMessages.push(...data);
        offset += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }

    setConvoMessages(allMessages);
    setConvoLoading(false);
  };

  const renderBannedTab = () => (
    <div className="flex-1 overflow-y-auto px-3 pb-3 pt-2">
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "hsl(var(--primary))", borderTopColor: "transparent" }} />
        </div>
      ) : bannedUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "hsl(var(--secondary))" }}>
            <ShieldOff className="w-6 h-6" style={{ color: "hsl(var(--muted-foreground))" }} />
          </div>
          <p className="text-[13px] font-medium" style={{ color: "hsl(var(--foreground))" }}>لا يوجد مستخدمون محظورون</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bannedUsers.map((banned) => {
            const profile = getProfile(banned.user_id);
            const bannedByProfile = getProfile(banned.banned_by);
            return (
              <div key={banned.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "hsl(var(--secondary))" }}>
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} className="w-10 h-10 rounded-full object-cover flex-shrink-0" style={{ border: "2px solid hsl(var(--destructive) / 0.4)" }} />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0" style={{ background: "hsl(var(--destructive) / 0.15)", color: "hsl(var(--destructive))", border: "2px solid hsl(var(--destructive) / 0.4)" }}>
                    {profile.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0 text-right">
                  <p className="text-[13px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>{profile.username}</p>
                  <p className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>حظر بواسطة: {bannedByProfile.username}</p>
                  {banned.reason && <p className="text-[11px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>السبب: {banned.reason}</p>}
                  <p className="text-[10px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{formatDistanceToNow(new Date(banned.created_at), { addSuffix: true, locale: ar })}</p>
                </div>
                <button onClick={() => handleUnban(banned.id, banned.user_id)} disabled={unbanLoading === banned.user_id}
                  className="flex-shrink-0 px-3 py-2 rounded-lg text-[12px] font-medium transition-all active:scale-95 disabled:opacity-50"
                  style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" }}>
                  {unbanLoading === banned.user_id ? "جاري..." : "إلغاء الحظر"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderDmsTab = () => {
    if (!dmUnlocked) {
      return (
        <div className="flex-1 flex items-center justify-center px-6">
          <input
            type="password"
            value={secretInput}
            onChange={(e) => setSecretInput(e.target.value)}
            placeholder=""
            className="w-full max-w-[240px] h-10 rounded-xl px-4 text-[13px] outline-none text-center"
            style={{ background: "hsl(var(--secondary))", color: "hsl(var(--foreground))", border: "1px solid hsl(var(--border))" }}
          />
        </div>
      );
    }

    if (selectedConvo) {
      const p1 = getProfile(selectedConvo.user1);
      const p2 = getProfile(selectedConvo.user2);
      return (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Conversation header */}
          <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
            <button
              onClick={() => { setSelectedConvo(null); setConvoMessages([]); }}
              className="p-1.5 rounded-full hover:opacity-70 transition-all"
              style={{ color: "hsl(var(--primary))" }}
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <span className="text-[13px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>
              {p1.username} ↔ {p2.username}
            </span>
            <span className="text-[11px] mr-auto" style={{ color: "hsl(var(--muted-foreground))" }}>
              {convoMessages.length} رسالة
            </span>
          </div>

          {convoLoading ? (
            <div className="flex-1 flex justify-center items-center">
              <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "hsl(var(--primary))", borderTopColor: "transparent" }} />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
              {convoMessages.map((msg) => {
                const senderProfile = getProfile(msg.sender_user_id);
                const isSender1 = msg.sender_user_id === selectedConvo.user1;
                return (
                  <div key={msg.id} className="flex flex-col" style={{ alignItems: isSender1 ? "flex-start" : "flex-end" }}>
                    <div className="max-w-[85%] p-2.5 rounded-xl" style={{ background: isSender1 ? "hsl(var(--secondary))" : "hsl(var(--primary) / 0.1)" }}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5">
                          {senderProfile.avatar_url ? (
                            <img src={senderProfile.avatar_url} className="w-5 h-5 rounded-full object-cover" />
                          ) : (
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ background: getUserColor(senderProfile.username) + "22", color: getUserColor(senderProfile.username) }}>
                              {senderProfile.username.slice(0, 1)}
                            </div>
                          )}
                          <span className="text-[11px] font-bold" style={{ color: getUserColor(senderProfile.username) }}>
                            {senderProfile.username}
                          </span>
                        </div>
                        <span className="text-[9px] flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>
                          {new Date(msg.created_at).toLocaleString("ar-SY", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                        </span>
                      </div>
                      {msg.reply_to_content && (
                        <div className="mb-1.5 px-2 py-1 rounded text-[10px] truncate" style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", borderRight: "2px solid hsl(var(--primary))" }}>
                          {msg.reply_to_content}
                        </div>
                      )}
                      {msg.image_url && (
                        <img
                          src={msg.image_url}
                          className="rounded-lg mb-1.5 max-w-full max-h-[200px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setViewingImage(msg.image_url)}
                        />
                      )}
                      {msg.content && msg.content !== "📷 صورة" && (
                        <p className="text-[12px] leading-relaxed break-words" style={{ color: "hsl(var(--foreground))" }}>{msg.content}</p>
                      )}
                    </div>
                  </div>
                );
              })}
              {convoMessages.length === 0 && (
                <p className="text-center text-[12px] py-6" style={{ color: "hsl(var(--muted-foreground))" }}>لا توجد رسائل</p>
              )}
            </div>
          )}
        </div>
      );
    }

    // Conversations list
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 flex-shrink-0" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
          <span className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
            {dmConversations.length} محادثة
          </span>
          <button onClick={fetchDmConversations} className="p-1.5 rounded-full hover:opacity-70 transition-all" style={{ color: "hsl(var(--primary))" }}>
            <RefreshCw className={`w-3.5 h-3.5 ${dmLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {dmLoading ? (
          <div className="flex-1 flex justify-center items-center">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "hsl(var(--primary))", borderTopColor: "transparent" }} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
            {dmConversations.map((convo, i) => {
              const p1 = getProfile(convo.user1);
              const p2 = getProfile(convo.user2);
              return (
                <button
                  key={i}
                  onClick={() => fetchConvoMessages(convo.user1, convo.user2)}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-right transition-all active:scale-[0.98]"
                  style={{ background: "hsl(var(--secondary))" }}
                >
                  <div className="flex -space-x-2 flex-shrink-0">
                    {p1.avatar_url ? (
                      <img src={p1.avatar_url} className="w-8 h-8 rounded-full object-cover" style={{ border: "1.5px solid hsl(var(--background))" }} />
                    ) : (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: getUserColor(p1.username) + "22", color: getUserColor(p1.username), border: `1.5px solid ${getUserColor(p1.username)}` }}>
                        {p1.username.slice(0, 1)}
                      </div>
                    )}
                    {p2.avatar_url ? (
                      <img src={p2.avatar_url} className="w-8 h-8 rounded-full object-cover" style={{ border: "1.5px solid hsl(var(--background))" }} />
                    ) : (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: getUserColor(p2.username) + "22", color: getUserColor(p2.username), border: `1.5px solid ${getUserColor(p2.username)}` }}>
                        {p2.username.slice(0, 1)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold truncate" style={{ color: "hsl(var(--foreground))" }}>
                      {p1.username} ↔ {p2.username}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: "hsl(var(--muted-foreground))" }}>
                      {convo.lastMessage}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                        {formatDistanceToNow(new Date(convo.lastTime), { addSuffix: true, locale: ar })}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))" }}>
                        {convo.msgCount} رسالة
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 flex-shrink-0 rtl:rotate-180" style={{ color: "hsl(var(--muted-foreground))" }} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex flex-shrink-0" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <button
          onClick={() => setActiveTab("banned")}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-medium transition-all"
          style={{
            color: activeTab === "banned" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
            borderBottom: activeTab === "banned" ? "2px solid hsl(var(--primary))" : "2px solid transparent"
          }}
        >
          <Ban className="w-4 h-4" />
          المحظورون {bannedUsers.length > 0 && `(${bannedUsers.length})`}
        </button>
        <button
          onClick={() => setActiveTab("dms")}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-medium transition-all"
          style={{
            color: activeTab === "dms" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
            borderBottom: activeTab === "dms" ? "2px solid hsl(var(--primary))" : "2px solid transparent"
          }}
        >
          
          عدد المستخدمين 
        </button>
      </div>

      {activeTab === "banned" ? renderBannedTab() : renderDmsTab()}

      {/* Image viewer overlay */}
      {viewingImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setViewingImage(null)}
        >
          <img src={viewingImage} className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
