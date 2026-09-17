import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Ban, ShieldOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface AdminPanelProps {
  profilesMap: Record<string, { username: string; avatar_url: string | null }>;
}

const AdminPanel = ({ profilesMap }: AdminPanelProps) => {
  const [bannedUsers, setBannedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unbanLoading, setUnbanLoading] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <div className="flex items-center gap-2">
          <Ban className="w-5 h-5" style={{ color: "hsl(var(--destructive))" }} />
          <span className="text-[15px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>
            المستخدمون المحظورون
          </span>
          {bannedUsers.length > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))" }}>
              {bannedUsers.length}
            </span>
          )}
        </div>
      </div>

      {/* Banned users list */}
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
    </div>
  );
};

export default AdminPanel;
