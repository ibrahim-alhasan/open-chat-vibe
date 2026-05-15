import { useState, useRef, useEffect } from "react";
import { X, User, Save, MessageSquareOff, MessageSquare, Image, Trash2, Volume2, VolumeX, LogOut, LogIn, FileText, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getIsSoundEnabled, setSoundEnabled } from "@/lib/sounds";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface SettingsModalProps {
  currentUsername: string;
  currentAvatarUrl: string | null;
  userId: string;
  onClose: () => void;
  onSave: (newUsername: string, newAvatarUrl: string | null) => void;
  chatBg: string | null;
  onChatBgChange: (bg: string | null) => void;
}

const SettingsModal = ({ currentUsername, currentAvatarUrl, userId, onClose, onSave, chatBg, onChatBgChange }: SettingsModalProps) => {
  const { signOut, user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState(currentUsername);
  const [allowDms, setAllowDms] = useState(true);
  const [bio, setBio] = useState("");
  const [studyStage, setStudyStage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [soundEnabled, setSoundEnabledState] = useState(getIsSoundEnabled());
  const bgInputRef = useRef<HTMLInputElement>(null);

  const isAuthenticated = !!user;

  const handleSignOut = async () => {
    onClose();
    await signOut();
    navigate("/auth");
  };

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase.from("profiles").select("allow_dms, bio, study_stage").eq("user_id", userId).single();
      if (data) {
        setAllowDms(data.allow_dms ?? true);
        setBio((data as any).bio ?? "");
        setStudyStage((data as any).study_stage ?? "");
      }
    };
    if (userId) fetchProfile();
  }, [userId]);

  // دالة لضمان أن cursor يذهب إلى نهاية النص عند التغيير
  const handleRTLInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, setter: (value: string) => void) => {
    const newValue = e.target.value;
    setter(newValue);
    // نضمن أن cursor يبقى في النهاية بعد التحديث
    setTimeout(() => {
      const input = e.target;
      if (input && 'setSelectionRange' in input) {
        const length = input.value.length;
        input.setSelectionRange(length, length);
      }
    }, 0);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAuthenticated) {
      onClose();
      return;
    }
    
    const trimmed = username.trim();
    if (!trimmed) { setError("الرجاء إدخال اسمك"); return; }
    if (trimmed.length < 2) { setError("الاسم يجب أن يكون حرفين على الأقل"); return; }
    if (trimmed.length > 20) { setError("الاسم يجب أن لا يتجاوز 20 حرفاً"); return; }
    const trimmedBio = bio.trim();
    if (trimmedBio.length > 200) { setError("الوصف يجب أن لا يتجاوز 200 حرف"); return; }
    const trimmedStage = studyStage.trim();
    if (trimmedStage.length > 50) { setError("المرحلة الدراسية طويلة جداً"); return; }

    setSaving(true);
    const avatarUrl = null;

    await supabase.from("profiles").upsert(
      {
        user_id: userId,
        username: trimmed,
        avatar_url: avatarUrl,
        allow_dms: allowDms,
        bio: trimmedBio || null,
        study_stage: trimmedStage || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    localStorage.setItem("chat_username", trimmed);
    localStorage.removeItem("chat_avatar_url");

    setSaving(false);
    await refreshProfile();
    onSave(trimmed, avatarUrl);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: "hsl(220 16% 5% / 0.8)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      dir="rtl"
    >
      <div className="w-full max-w-sm mx-4 h-[90vh] flex flex-col">
        <div className="rounded-2xl flex flex-col h-full" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "var(--shadow-card)" }}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 p-4 border-b" style={{ borderColor: "hsl(var(--border))" }}>
            <div className="flex items-center justify-between">
              <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:opacity-70" style={{ color: "hsl(var(--muted-foreground))" }}>
                <X className="w-5 h-5" />
              </button>
              <h2 className="font-bold text-base" style={{ color: "hsl(var(--foreground))" }}>
                {isAuthenticated ? "الإعدادات" : "الإعدادات"}
              </h2>
              <div className="w-8" /> {/* Spacer for balance */}
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <form onSubmit={handleSave} className="space-y-3">
              {/* Avatar - للمستخدمين المسجلين */}
              {isAuthenticated && (
                <div className="flex justify-center">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold"
                    style={{ background: "var(--gradient-primary)", border: "2px solid hsl(var(--primary) / 0.5)", color: "hsl(var(--primary-foreground))" }}
                  >
                    {username.slice(0, 2).toUpperCase()}
                  </div>
                </div>
              )}

              {/* Username input */}
              {isAuthenticated && (
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "hsl(var(--foreground))" }}>
                    <User className="w-3 h-3" />
                    <span>الاسم</span>
                  </label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={username} 
                      dir="rtl"
                      onChange={(e) => { setUsername(e.target.value); setError(""); }}
                      onFocus={(e) => {
                        const length = e.target.value.length;
                        e.target.setSelectionRange(length, length);
                      }}
                      placeholder="اسمك..." 
                      maxLength={20}
                      className="w-full py-2 px-3 rounded-lg text-sm outline-none transition-all duration-200 text-right"
                      style={{ 
                        background: "hsl(var(--input))", 
                        border: error ? "1px solid hsl(var(--destructive))" : "1px solid hsl(var(--border))", 
                        color: "hsl(var(--foreground))",
                        direction: "rtl"
                      }}
                    />
                    {error && <p className="text-[10px] text-right mt-0.5" style={{ color: "hsl(var(--destructive))" }}>{error}</p>}
                  </div>
                </div>
              )}

              {/* Bio */}
              {isAuthenticated && (
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "hsl(var(--foreground))" }}>
                    <FileText className="w-3 h-3" />
                    <span>الوصف</span>
                  </label>
                  <div className="relative">
                    <textarea
                      value={bio}
                      dir="rtl"
                      onChange={(e) => handleRTLInput(e, setBio)}
                      onFocus={(e) => {
                        const length = e.target.value.length;
                        e.target.setSelectionRange(length, length);
                      }}
                      placeholder="نبذة عنك..."
                      maxLength={200}
                      rows={2}
                      className="w-full py-2 px-3 rounded-lg text-sm outline-none transition-all duration-200 text-right resize-none"
                      style={{ 
                        background: "hsl(var(--input))", 
                        border: "1px solid hsl(var(--border))", 
                        color: "hsl(var(--foreground))",
                        direction: "rtl"
                      }}
                    />
                    <p className="text-[9px] mt-0.5 text-left" style={{ color: "hsl(var(--muted-foreground))" }}>{bio.length}/200</p>
                  </div>
                </div>
              )}

              {/* Study stage */}
              {isAuthenticated && (
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "hsl(var(--foreground))" }}>
                    <GraduationCap className="w-3 h-3" />
                    <span>المرحلة الدراسية</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={studyStage}
                      dir="rtl"
                      onChange={(e) => handleRTLInput(e, setStudyStage)}
                      onFocus={(e) => {
                        const length = e.target.value.length;
                        e.target.setSelectionRange(length, length);
                      }}
                      placeholder="المرحلة الدراسية..."
                      maxLength={50}
                      className="w-full py-2 px-3 rounded-lg text-sm outline-none transition-all duration-200 text-right"
                      style={{ 
                        background: "hsl(var(--input))", 
                        border: "1px solid hsl(var(--border))", 
                        color: "hsl(var(--foreground))",
                        direction: "rtl"
                      }}
                    />
                  </div>
                </div>
              )}

              {/* DM Privacy Toggle */}
              {isAuthenticated && (
                <div className="flex items-center justify-between p-2 rounded-lg" style={{ background: "hsl(var(--input))", border: "1px solid hsl(var(--border))" }}>
                  <div className="flex items-center gap-1.5">
                    {allowDms ? <MessageSquare className="w-3.5 h-3.5" style={{ color: "hsl(var(--chat-online))" }} /> : <MessageSquareOff className="w-3.5 h-3.5" style={{ color: "hsl(var(--destructive))" }} />}
                    <span className="text-xs" style={{ color: "hsl(var(--foreground))" }}>الرسائل الخاصة</span>
                  </div>
                  <button type="button" onClick={() => setAllowDms(!allowDms)}
                    className="w-9 h-5 rounded-full relative transition-colors duration-200"
                    style={{ background: allowDms ? "hsl(var(--chat-online))" : "hsl(var(--muted))" }}>
                    <span className="absolute top-0.5 w-4 h-4 rounded-full shadow transition-transform duration-200"
                      style={{ background: "hsl(var(--foreground))", left: allowDms ? "calc(100% - 18px)" : "2px" }} />
                  </button>
                </div>
              )}

              {/* Sound Toggle */}
              <div className="flex items-center justify-between p-2 rounded-lg" style={{ background: "hsl(var(--input))", border: "1px solid hsl(var(--border))" }}>
                <div className="flex items-center gap-1.5">
                  {soundEnabled ? <Volume2 className="w-3.5 h-3.5" style={{ color: "hsl(var(--chat-online))" }} /> : <VolumeX className="w-3.5 h-3.5" style={{ color: "hsl(var(--destructive))" }} />}
                  <span className="text-xs" style={{ color: "hsl(var(--foreground))" }}>أصوات الإرسال</span>
                </div>
                <button type="button" onClick={() => { const v = !soundEnabled; setSoundEnabledState(v); setSoundEnabled(v); }}
                  className="w-9 h-5 rounded-full relative transition-colors duration-200"
                  style={{ background: soundEnabled ? "hsl(var(--chat-online))" : "hsl(var(--muted))" }}>
                  <span className="absolute top-0.5 w-4 h-4 rounded-full shadow transition-transform duration-200"
                    style={{ background: "hsl(var(--foreground))", left: soundEnabled ? "calc(100% - 18px)" : "2px" }} />
                </button>
              </div>

              {/* Chat Background */}
              

              {/* Buttons */}
              {isAuthenticated && (
                <>
                  <button type="submit" disabled={saving}
                    className="w-full py-2 rounded-lg font-semibold text-sm transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60"
                    style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}>
                    {saving ? (
                      <>
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "hsl(var(--primary-foreground))", borderTopColor: "transparent" }} />
                        جارٍ الحفظ...
                      </>
                    ) : (
                      <><Save className="w-3.5 h-3.5" /> حفظ</>
                    )}
                  </button>

                  <button type="button" onClick={handleSignOut}
                    className="w-full py-2 rounded-lg font-semibold text-sm transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
                    style={{ background: "hsl(var(--destructive) / 0.12)", color: "hsl(var(--destructive))", border: "1px solid hsl(var(--destructive) / 0.25)" }}>
                    <LogOut className="w-3.5 h-3.5" />
                    تسجيل الخروج
                  </button>
                </>
              )}

              {!isAuthenticated && (
                <>
                  <button
                    type="button"
                    onClick={() => { onClose(); navigate("/auth"); }}
                    className="w-full py-2 rounded-lg font-semibold text-sm transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
                    style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    تسجيل الدخول
                  </button>
                  <p className="text-[9px] text-center leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                    سجّل دخولك للمشاركة في الدردشة وحفظ ملفك الشخصي.
                  </p>
                </>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
