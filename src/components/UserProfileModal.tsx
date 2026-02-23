import { X, MessageSquare, MessageSquareOff, Ban, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";

interface UserProfileModalProps {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  currentUserId: string;
  isOnline?: boolean;
  isAdmin?: boolean;
  allowDms?: boolean;
  onClose: () => void;
  onStartDM: (userId: string) => void;
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

// شارة التوثيق بنمط تويتر
const VerifiedBadge = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
    <path d="M20.396 11c.745-.765.745-2.066 0-2.831l-1.09-1.12.354-1.52c.254-1.092-.59-2.138-1.692-2.098l-1.566.057-.63-1.437C15.322 1.01 14.1.573 13.17 1.156l-1.32.827-1.32-.827C9.6.573 8.378 1.01 7.928 2.051l-.63 1.437-1.566-.057c-1.102-.04-1.946 1.006-1.692 2.098l.354 1.52-1.09 1.12c-.745.765-.745 2.066 0 2.831l1.09 1.12-.354 1.52c-.254 1.092.59 2.138 1.692 2.098l1.566-.057.63 1.437c.45 1.041 1.672 1.478 2.602.895l1.32-.827 1.32.827c.93.583 2.152.146 2.602-.895l.63-1.437 1.566.057c1.102.04 1.946-1.006 1.692-2.098l-.354-1.52 1.09-1.12z" fill="#1D9BF0"/>
    <path d="M9.585 14.929l-3.28-3.28 1.168-1.168 2.112 2.112 5.048-5.048 1.168 1.168-6.216 6.216z" fill="white"/>
  </svg>
);

const UserProfileModal = ({ userId, username, avatarUrl, currentUserId, isOnline, isAdmin, allowDms = true, onClose, onStartDM }: UserProfileModalProps) => {
  const userColor = isAdmin ? "#1D9BF0" : getUserColor(username);
  const isOwnProfile = userId === currentUserId;
  const [isBlocked, setIsBlocked] = useState(false);
  const [loadingBlock, setLoadingBlock] = useState(false);

  useEffect(() => {
    const checkBlocked = async () => {
      const { data } = await supabase.from("blocked_users").select("id").eq("blocker_user_id", currentUserId).eq("blocked_user_id", userId).maybeSingle();
      setIsBlocked(!!data);
    };
    if (!isOwnProfile) checkBlocked();
  }, [currentUserId, userId, isOwnProfile]);

  const toggleBlock = async () => {
    setLoadingBlock(true);
    if (isBlocked) {
      await supabase.from("blocked_users").delete().eq("blocker_user_id", currentUserId).eq("blocked_user_id", userId);
      setIsBlocked(false);
    } else {
      await supabase.from("blocked_users").insert({ blocker_user_id: currentUserId, blocked_user_id: userId });
      setIsBlocked(true);
    }
    setLoadingBlock(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "hsl(220 16% 4% / 0.7)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="w-80 rounded-3xl p-6 flex flex-col items-center gap-4 animate-scale-in"
        style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "0 24px 64px hsl(220 16% 4% / 0.8)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-70 transition-opacity self-end" style={{ color: "hsl(var(--muted-foreground))" }}>
          <X className="w-4 h-4" />
        </button>

        <div className="relative">
          <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold overflow-hidden"
            style={{ border: `3px solid ${userColor}`, boxShadow: `0 0 24px ${userColor}44` }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold" style={{ background: `${userColor}22`, color: userColor }}>
                {username.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          {isOnline !== undefined && (
            <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full" style={{ background: isOnline ? "hsl(var(--chat-online))" : "hsl(var(--muted-foreground))", borderWidth: "3px", borderColor: "hsl(var(--card))" }} />
          )}
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5">
            <h2 className="text-xl font-bold" style={{ color: isAdmin ? "#1D9BF0" : "hsl(var(--foreground))" }}>{username}</h2>
            {isAdmin && <VerifiedBadge size={22} />}
          </div>
          {isAdmin && <span className="text-xs px-2 py-0.5 rounded-full font-bold mt-1 inline-block" style={{ background: "rgba(29, 155, 240, 0.15)", color: "#1D9BF0" }}>مشرف موثق</span>}
          <p className="text-xs mt-1" style={{ color: isOnline ? "hsl(var(--chat-online))" : "hsl(var(--muted-foreground))" }}>
            {isOwnProfile ? "هذا أنت" : isOnline ? "متصل الآن" : "غير متصل"}
          </p>
        </div>

        {!isOwnProfile && (
          <div className="w-full space-y-2">
            {!isBlocked && (allowDms ? (
              <button onClick={() => { onStartDM(userId); onClose(); }}
                className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-2xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
                style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))", boxShadow: "0 4px 16px hsl(var(--primary) / 0.3)" }}>
                <MessageSquare className="w-4 h-4" />
                تواصل على الخاص
              </button>
            ) : (
              <div className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-2xl text-sm"
                style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>
                <MessageSquareOff className="w-4 h-4" />
                لا يقبل الرسائل الخاصة
              </div>
            ))}

            <button
              onClick={toggleBlock}
              disabled={loadingBlock}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-6 rounded-2xl text-sm font-medium transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
              style={{ 
                background: isBlocked ? "hsl(var(--secondary))" : "hsl(var(--destructive) / 0.1)", 
                color: isBlocked ? "hsl(var(--foreground))" : "hsl(var(--destructive))",
                border: `1px solid ${isBlocked ? "hsl(var(--border))" : "hsl(var(--destructive) / 0.3)"}`,
              }}
            >
              {isBlocked ? <UserCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
              {isBlocked ? "إلغاء الحظر" : "حظر المستخدم"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfileModal;
