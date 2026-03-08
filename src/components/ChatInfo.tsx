import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, MessageCircle, Users, Crown, Trophy, Calendar, BarChart3 } from "lucide-react";

interface ChatInfoProps {
  totalUsers: number;
  onlineCount: number;
  profilesMap: Record<string, { username: string; avatar_url: string | null }>;
  adminIds: Set<string>;
  onlineUsers: Set<string>;
  onClose: () => void;
  onUsernameClick: (userId: string) => void;
}

interface UserMessageCount {
  user_id: string;
  username: string;
  avatar_url: string | null;
  count: number;
}

const ChatInfo = ({ totalUsers, onlineCount, profilesMap, adminIds, onlineUsers, onClose, onUsernameClick }: ChatInfoProps) => {
  const [topUsers, setTopUsers] = useState<UserMessageCount[]>([]);
  const [totalMessages, setTotalMessages] = useState(0);
  const [todayMessages, setTodayMessages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [firstMessageDate, setFirstMessageDate] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Total messages
      const { count: total } = await supabase.from("messages").select("*", { count: "exact", head: true });
      setTotalMessages(total || 0);

      // Today's messages
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count: today } = await supabase.from("messages").select("*", { count: "exact", head: true }).gte("created_at", todayStart.toISOString());
      setTodayMessages(today || 0);

      // First message date
      const { data: firstMsg } = await supabase.from("messages").select("created_at").order("created_at", { ascending: true }).limit(1);
      if (firstMsg && firstMsg.length > 0) {
        setFirstMessageDate(firstMsg[0].created_at);
      }

      // Top 10 users by message count
      const { data: allMessages } = await supabase.from("messages").select("user_id, username");
      if (allMessages) {
        const countMap: Record<string, { count: number; username: string; user_id: string }> = {};
        for (const msg of allMessages) {
          const key = msg.user_id || msg.username;
          if (!countMap[key]) {
            countMap[key] = { count: 0, username: msg.username, user_id: msg.user_id || "" };
          }
          countMap[key].count++;
        }
        const sorted = Object.values(countMap).sort((a, b) => b.count - a.count).slice(0, 10);
        const topWithAvatars: UserMessageCount[] = sorted.map((u) => {
          const profile = u.user_id ? profilesMap[u.user_id] : null;
          return {
            user_id: u.user_id,
            username: profile?.username || u.username,
            avatar_url: profile?.avatar_url || null,
            count: u.count,
          };
        });
        setTopUsers(topWithAvatars);
      }
    } catch (e) {
      console.error("Error fetching stats:", e);
    }
    setLoading(false);
  };

  const getMedalColor = (index: number) => {
    if (index === 0) return "#FFD700";
    if (index === 1) return "#C0C0C0";
    if (index === 2) return "#CD7F32";
    return "hsl(var(--muted-foreground))";
  };

  const getMedalEmoji = (index: number) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `${index + 1}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
  };

  return (
    <div className="flex flex-col h-screen select-none" style={{ background: "hsl(var(--chat-bg))" }}>
      {/* Header */}
      <header className="flex-shrink-0 px-4 py-2.5 flex items-center gap-3" style={{ background: "hsl(var(--chat-header))", borderBottom: "1px solid hsl(var(--border))" }}>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-[15px]" style={{ color: "hsl(var(--foreground))" }}>معلومات الدردشة</h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto" dir="rtl">
        {/* Chat Icon & Name */}
        <div className="flex flex-col items-center py-6 px-4" style={{ background: "hsl(var(--chat-header))" }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-3" style={{ background: "hsl(var(--primary))" }}>
            <MessageCircle className="w-10 h-10" style={{ color: "hsl(var(--primary-foreground))" }} />
          </div>
          <h2 className="text-lg font-bold" style={{ color: "hsl(var(--foreground))" }}>الدردشة العامة</h2>
          <p className="text-[12px] mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>مجموعة عامة للجميع</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 p-4">
          <div className="rounded-xl p-3.5 text-center" style={{ background: "hsl(var(--secondary))" }}>
            <MessageCircle className="w-5 h-5 mx-auto mb-1.5" style={{ color: "hsl(var(--primary))" }} />
            <div className="text-lg font-bold" style={{ color: "hsl(var(--foreground))" }}>
              {loading ? "..." : totalMessages.toLocaleString()}
            </div>
            <div className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>إجمالي الرسائل</div>
          </div>

          <div className="rounded-xl p-3.5 text-center" style={{ background: "hsl(var(--secondary))" }}>
            <BarChart3 className="w-5 h-5 mx-auto mb-1.5" style={{ color: "hsl(var(--chat-online))" }} />
            <div className="text-lg font-bold" style={{ color: "hsl(var(--foreground))" }}>
              {loading ? "..." : todayMessages.toLocaleString()}
            </div>
            <div className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>رسائل اليوم</div>
          </div>

          <div className="rounded-xl p-3.5 text-center" style={{ background: "hsl(var(--secondary))" }}>
            <Users className="w-5 h-5 mx-auto mb-1.5" style={{ color: "hsl(var(--primary))" }} />
            <div className="text-lg font-bold" style={{ color: "hsl(var(--foreground))" }}>{totalUsers}</div>
            <div className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>إجمالي الأعضاء</div>
          </div>

          <div className="rounded-xl p-3.5 text-center" style={{ background: "hsl(var(--secondary))" }}>
            <div className="w-5 h-5 mx-auto mb-1.5 flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "hsl(var(--chat-online))" }} />
            </div>
            <div className="text-lg font-bold" style={{ color: "hsl(var(--foreground))" }}>{onlineCount}</div>
            <div className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>متصل الآن</div>
          </div>
        </div>

        {firstMessageDate && (
          <div className="mx-4 mb-3 rounded-xl p-3 flex items-center gap-3" style={{ background: "hsl(var(--secondary))" }}>
            <Calendar className="w-5 h-5 flex-shrink-0" style={{ color: "hsl(var(--primary))" }} />
            <div>
              <div className="text-[12px] font-medium" style={{ color: "hsl(var(--foreground))" }}>تاريخ أول رسالة</div>
              <div className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{formatDate(firstMessageDate)}</div>
            </div>
          </div>
        )}

        {/* Top 10 Users */}
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-5 h-5" style={{ color: "#FFD700" }} />
            <h3 className="text-[14px] font-bold" style={{ color: "hsl(var(--foreground))" }}>أكثر 10 أشخاص نشاطاً</h3>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "hsl(var(--primary))", borderTopColor: "transparent" }} />
            </div>
          ) : topUsers.length === 0 ? (
            <p className="text-center text-[13px] py-4" style={{ color: "hsl(var(--muted-foreground))" }}>لا توجد رسائل بعد</p>
          ) : (
            <div className="space-y-1.5">
              {topUsers.map((user, index) => (
                <button
                  key={user.user_id || index}
                  onClick={() => user.user_id && onUsernameClick(user.user_id)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors hover:opacity-80"
                  style={{ background: index < 3 ? "hsl(var(--secondary))" : "transparent" }}
                >
                  {/* Rank */}
                  <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full text-[13px] font-bold"
                    style={{ color: getMedalColor(index), background: index < 3 ? "hsl(var(--background) / 0.5)" : "transparent" }}>
                    {getMedalEmoji(index)}
                  </div>

                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold"
                        style={{ background: "hsl(var(--primary) / 0.2)", color: "hsl(var(--primary))" }}>
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {user.user_id && onlineUsers.has(user.user_id) && (
                      <span className="absolute -bottom-0.5 -left-0.5 w-3 h-3 rounded-full" style={{ background: "hsl(var(--chat-online))", border: "2px solid hsl(var(--chat-bg))" }} />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      {user.user_id && adminIds.has(user.user_id) && (
                        <Crown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#FFD700" }} />
                      )}
                      <span className="text-[13px] font-semibold truncate" style={{ color: "hsl(var(--foreground))" }}>{user.username}</span>
                    </div>
                    <span className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{user.count.toLocaleString()} رسالة</span>
                  </div>

                  {/* Bar indicator */}
                  <div className="w-16 h-1.5 rounded-full overflow-hidden flex-shrink-0" style={{ background: "hsl(var(--border))" }}>
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${topUsers[0] ? (user.count / topUsers[0].count) * 100 : 0}%`,
                      background: index === 0 ? "#FFD700" : index === 1 ? "#C0C0C0" : index === 2 ? "#CD7F32" : "hsl(var(--primary))"
                    }} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatInfo;
