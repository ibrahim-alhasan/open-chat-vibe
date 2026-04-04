import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Ban, RefreshCw, ShieldOff, MessageSquare, Lock, ChevronRight, ArrowRight } from "lucide-react";
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

  // Handle secret code check
  const handleSecretSubmit = () => {
    if (secretInput === SECRET_CODE) {
      setDmUnlocked(true);
      setSecretInput("");
      fetchDmConversations();
    }
  };

  // Fetch all unique DM conversations (lazy - only pairs + last message)
  const fetchDmConversations = async () => {
    setDmLoading(true);
    const { data } = await supabase
      .from("direct_messages")
      .select("sender_user_id, receiver_user_id, sender_username, receiver_username, content, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (data) {
      const convosMap = new Map<string, any>();
      for (const msg of data) {
        const key = [msg.sender_user_id, msg.receiver_user_id].sort().join("_");
        if (!convosMap.has(key)) {
          convosMap.set(key, {
            user1: msg.sender_user_id,
            user2: msg.receiver_user_id,
            username1: msg.sender_username,
            username2: msg.receiver_username,
            lastMessage: msg.content,
            lastTime: msg.created_at,
          });
        }
      }
      setDmConversations(Array.from(convosMap.values()));
    }
    setDmLoading(false);
  };

  // Fetch messages for a specific conversation (lazy)
  const fetchConvoMessages = async (user1: string, user2: string) => {
    setConvoLoading(true);
    setSelectedConvo({ user1, user2 });
    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .or(`and(sender_user_id.eq.${user1},receiver_user_id.eq.${user2}),and(sender_user_id.eq.${user2},receiver_user_id.eq.${user1})`)
      .order("created_at", { ascending: true })
      .limit(500);
    setConvoMessages(data || []);
    setConvoLoading(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Banned users section */}
      <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <div className="flex items-center gap-2">
          <Ban className="w-4 h-4" style={{ color: "hsl(var(--destructive))" }} />
          <span className="text-[13px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>
            المحظورون {bannedUsers.length > 0 && `(${bannedUsers.length})`}
          </span>
        </div>
        <button onClick={fetchBanned} className="p-2 rounded-full hover:opacity-70 transition-all active:scale-90" style={{ color: "hsl(var(--primary))" }}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

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

        {/* DM Monitoring Section */}
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid hsl(var(--border))" }}>
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4" style={{ color: "hsl(var(--muted-foreground))" }} />
            <span className="text-[13px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>مراقبة المحادثات الخاصة</span>
          </div>

          {!dmUnlocked ? (
            <div className="flex gap-2">
              <input
                type="password"
                value={secretInput}
                onChange={(e) => setSecretInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSecretSubmit()}
                className="flex-1 h-9 rounded-lg px-3 text-[13px] outline-none"
                style={{ background: "hsl(var(--secondary))", color: "hsl(var(--foreground))", border: "1px solid hsl(var(--border))" }}
              />
              <button
                onClick={handleSecretSubmit}
                className="px-4 h-9 rounded-lg text-[12px] font-medium transition-all active:scale-95"
                style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
              >
                دخول
              </button>
            </div>
          ) : selectedConvo ? (
            // Show conversation messages
            <div>
              <button
                onClick={() => { setSelectedConvo(null); setConvoMessages([]); }}
                className="flex items-center gap-1 mb-3 text-[12px] font-medium transition-all active:scale-95"
                style={{ color: "hsl(var(--primary))" }}
              >
                <ArrowRight className="w-3.5 h-3.5" />
                العودة للمحادثات
              </button>

              {convoLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "hsl(var(--primary))", borderTopColor: "transparent" }} />
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
                  {convoMessages.map((msg) => {
                    const profile = getProfile(msg.sender_user_id);
                    return (
                      <div key={msg.id} className="p-2.5 rounded-lg" style={{ background: "hsl(var(--secondary))" }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] font-bold" style={{ color: getUserColor(msg.sender_username) }}>
                            {profile.username}
                          </span>
                          <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                            {new Date(msg.created_at).toLocaleString("ar-SY", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                          </span>
                        </div>
                        {msg.reply_to_content && (
                          <div className="mb-1 px-2 py-1 rounded text-[10px] truncate" style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", borderRight: "2px solid hsl(var(--primary))" }}>
                            {msg.reply_to_content}
                          </div>
                        )}
                        {msg.image_url && (
                          <img src={msg.image_url} className="rounded-md mb-1 max-h-32 object-cover" />
                        )}
                        <p className="text-[12px] leading-relaxed" style={{ color: "hsl(var(--foreground))" }}>{msg.content}</p>
                      </div>
                    );
                  })}
                  {convoMessages.length === 0 && (
                    <p className="text-center text-[12px] py-6" style={{ color: "hsl(var(--muted-foreground))" }}>لا توجد رسائل</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            // Show conversations list
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {dmConversations.length} محادثة
                </span>
                <button onClick={fetchDmConversations} className="p-1.5 rounded-full hover:opacity-70 transition-all" style={{ color: "hsl(var(--primary))" }}>
                  <RefreshCw className={`w-3.5 h-3.5 ${dmLoading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {dmLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "hsl(var(--primary))", borderTopColor: "transparent" }} />
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
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
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: getUserColor(p1.username) + "22", color: getUserColor(p1.username), border: `1.5px solid ${getUserColor(p1.username)}` }}>
                            {p1.username.slice(0, 1)}
                          </div>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: getUserColor(p2.username) + "22", color: getUserColor(p2.username), border: `1.5px solid ${getUserColor(p2.username)}` }}>
                            {p2.username.slice(0, 1)}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold truncate" style={{ color: "hsl(var(--foreground))" }}>
                            {p1.username} ↔ {p2.username}
                          </p>
                          <p className="text-[11px] truncate" style={{ color: "hsl(var(--muted-foreground))" }}>
                            {convo.lastMessage}
                          </p>
                          <p className="text-[9px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                            {formatDistanceToNow(new Date(convo.lastTime), { addSuffix: true, locale: ar })}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 flex-shrink-0 rtl:rotate-180" style={{ color: "hsl(var(--muted-foreground))" }} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
