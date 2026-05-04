import { X, MessageSquare, MessageSquareOff, Ban, UserCheck, Calendar, GraduationCap, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";

interface UserProfileModalProps {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  currentUserId: string;
  isOnline?: boolean;
  isAdmin?: boolean;
  isCurrentUserAdmin?: boolean;
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

const UserProfileModal = ({ userId, username, avatarUrl, currentUserId, isOnline, isAdmin, isCurrentUserAdmin, allowDms = true, onClose, onStartDM }: UserProfileModalProps) => {
  const userColor = isAdmin ? "#1D9BF0" : getUserColor(username);
  const isOwnProfile = userId === currentUserId;
  const [isBlocked, setIsBlocked] = useState(false);
  const [loadingBlock, setLoadingBlock] = useState(false);
  const [isBannedFromChat, setIsBannedFromChat] = useState(false);
  const [loadingBan, setLoadingBan] = useState(false);
  const [profileDetails, setProfileDetails] = useState<{ bio: string | null; study_stage: string | null; created_at: string | null }>({ bio: null, study_stage: null, created_at: null });

  useEffect(() => {
    const fetchData = async () => {
      const [blockedRes, bannedRes, profileRes] = await Promise.all([
        supabase.from("blocked_users").select("id").eq("blocker_user_id", currentUserId).eq("blocked_user_id", userId).maybeSingle(),
        supabase.from("banned_users").select("id").eq("user_id", userId).maybeSingle(),
        supabase.from("profiles").select("bio, study_stage, created_at").eq("user_id", userId).maybeSingle(),
      ]);
      if (!isOwnProfile) {
        setIsBlocked(!!blockedRes.data);
        setIsBannedFromChat(!!bannedRes.data);
      }
      if (profileRes.data) {
        setProfileDetails({
          bio: (profileRes.data as any).bio ?? null,
          study_stage: (profileRes.data as any).study_stage ?? null,
          created_at: (profileRes.data as any).created_at ?? null,
        });
      }
    };
    fetchData();
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

  const formatJoinedDate = (iso: string | null) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    } catch { return null; }
  };
  const joinedDate = formatJoinedDate(profileDetails.created_at);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "hsl(220 16% 4% / 0.7)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden animate-scale-in"
        style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "0 24px 64px hsl(220 16% 4% / 0.8)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative gradient header */}
        <div className="relative h-24" style={{ background: `linear-gradient(135deg, ${userColor}55, ${userColor}22), hsl(var(--secondary))` }}>
          <button onClick={onClose} className="absolute top-3 left-3 p-1.5 rounded-full transition-opacity hover:opacity-80" style={{ background: "hsl(220 16% 4% / 0.4)", backdropFilter: "blur(8px)", color: "hsl(var(--foreground))" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Avatar overlapping header */}
        <div className="px-6 pb-5 -mt-12 flex flex-col items-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold overflow-hidden"
              style={{ border: `4px solid hsl(var(--card))`, background: "hsl(var(--card))", boxShadow: `0 8px 24px ${userColor}55` }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-bold" style={{ background: `${userColor}22`, color: userColor }}>
                  {username.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            {isOnline !== undefined && (
              <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full" style={{ background: isOnline ? "hsl(var(--chat-online))" : "hsl(var(--muted-foreground))", borderWidth: "3px", borderColor: "hsl(var(--card))" }} />
            )}
          </div>

          {/* Name + verified */}
          <div className="mt-3 flex items-center gap-1.5">
            <h2 className="text-lg font-bold" style={{ color: isAdmin ? "#1D9BF0" : "hsl(var(--foreground))" }}>{username}</h2>
            {isAdmin && <VerifiedBadge size={18} />}
          </div>
          {isAdmin && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold mt-1" style={{ background: "rgba(29, 155, 240, 0.15)", color: "#1D9BF0" }}>مشرف موثق</span>
          )}

          {/* Joined date — Gregorian / English */}
          {joinedDate && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px]" style={{ color: "hsl(var(--muted-foreground))", direction: "ltr" }}>
              <Calendar className="w-3 h-3" />
              <span>Joined {joinedDate}</span>
            </div>
          )}

          <p className="text-[11px] mt-1" style={{ color: isOnline ? "hsl(var(--chat-online))" : "hsl(var(--muted-foreground))" }}>
            {isOwnProfile ? "هذا أنت" : isOnline ? "متصل الآن" : "غير متصل"}
          </p>

          {/* Info cards: bio + study stage */}
          <div className="w-full mt-4 space-y-2">
            {profileDetails.bio && (
              <div className="w-full p-3 rounded-2xl flex items-start gap-2" style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))" }}>
                <FileText className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "hsl(var(--primary))" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold mb-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>الوصف</p>
                  <p className="text-[12px] leading-snug whitespace-pre-wrap break-words" style={{ color: "hsl(var(--foreground))" }}>{profileDetails.bio}</p>
                </div>
              </div>
            )}
            {profileDetails.study_stage && (
              <div className="w-full p-3 rounded-2xl flex items-start gap-2" style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))" }}>
                <GraduationCap className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "hsl(var(--primary))" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold mb-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>المرحلة الدراسية</p>
                  <p className="text-[12px]" style={{ color: "hsl(var(--foreground))" }}>{profileDetails.study_stage}</p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          {!isOwnProfile && (
            <div className="w-full space-y-2 mt-4">
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

            {isCurrentUserAdmin && !isAdmin && (
              <button
                onClick={async () => {
                  setLoadingBan(true);
                  if (isBannedFromChat) {
                    await supabase.from("banned_users").delete().eq("user_id", userId);
                    setIsBannedFromChat(false);
                  } else {
                    await supabase.from("banned_users").insert({ user_id: userId, banned_by: currentUserId });
                    setIsBannedFromChat(true);
                  }
                  setLoadingBan(false);
                }}
                disabled={loadingBan}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-6 rounded-2xl text-sm font-medium transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                style={{ 
                  background: isBannedFromChat ? "hsl(142, 71%, 45%, 0.1)" : "hsl(var(--destructive) / 0.15)", 
                  color: isBannedFromChat ? "hsl(142, 71%, 45%)" : "hsl(var(--destructive))",
                  border: `1px solid ${isBannedFromChat ? "hsl(142, 71%, 45%, 0.3)" : "hsl(var(--destructive) / 0.3)"}`,
                }}
              >
                {isBannedFromChat ? <UserCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                {isBannedFromChat ? "إلغاء الحظر من العامة" : "حظر من الدردشة العامة"}
              </button>
            )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;
