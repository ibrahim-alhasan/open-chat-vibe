import { X, MessageSquare } from "lucide-react";

interface UserProfileModalProps {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  currentUserId: string;
  isOnline?: boolean;
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

const UserProfileModal = ({ userId, username, avatarUrl, currentUserId, isOnline, onClose, onStartDM }: UserProfileModalProps) => {
  const userColor = getUserColor(username);
  const isOwnProfile = userId === currentUserId;

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

        {/* Avatar with online indicator */}
        <div className="relative">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold overflow-hidden"
            style={{ border: `3px solid ${userColor}`, boxShadow: `0 0 24px ${userColor}44` }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold" style={{ background: `${userColor}22`, color: userColor }}>
                {username.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          {isOnline !== undefined && (
            <span
              className="absolute bottom-1 right-1 w-5 h-5 rounded-full border-3"
              style={{
                background: isOnline ? "hsl(var(--chat-online))" : "hsl(var(--muted-foreground))",
                borderColor: "hsl(var(--card))",
                borderWidth: "3px",
              }}
            />
          )}
        </div>

        <div className="text-center">
          <h2 className="text-xl font-bold" style={{ color: "hsl(var(--foreground))" }}>{username}</h2>
          <p className="text-xs mt-1" style={{ color: isOnline ? "hsl(var(--chat-online))" : "hsl(var(--muted-foreground))" }}>
            {isOwnProfile ? "هذا أنت" : isOnline ? "متصل الآن" : "غير متصل"}
          </p>
        </div>

        {!isOwnProfile && (
          <button
            onClick={() => { onStartDM(userId); onClose(); }}
            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-2xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
            style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))", boxShadow: "0 4px 16px hsl(var(--primary) / 0.3)" }}
          >
            <MessageSquare className="w-4 h-4" />
            تواصل على الخاص
          </button>
        )}
      </div>
    </div>
  );
};

export default UserProfileModal;
