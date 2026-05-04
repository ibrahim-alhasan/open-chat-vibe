import { useState, useRef, useEffect } from "react";
import { X, Camera, User, Save, MessageSquareOff, MessageSquare, Image, Trash2, Volume2, VolumeX, LogOut, LogIn, FileText, GraduationCap } from "lucide-react";
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

  // التحقق من وجود مستخدم مسجل دخول
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // إذا لم يكن المستخدم مسجلاً دخول، لا نقوم بحفظ أي شيء
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

    // No avatar upload - keep existing or set to null
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
    >
      <div className="animate-slide-up w-full max-w-sm mx-4">
        <div className="rounded-2xl p-6" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-base" style={{ color: "hsl(var(--foreground))" }}>
              {isAuthenticated ? "إعدادات الملف الشخصي" : "الإعدادات"}
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:opacity-70" style={{ color: "hsl(var(--muted-foreground))" }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            {/* Avatar - يظهر فقط للمستخدمين المسجلين */}
            {isAuthenticated && (
              <div className="flex justify-center">
                <div className="relative">
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold"
                    style={{ background: "var(--gradient-primary)", border: "2px solid hsl(var(--primary) / 0.5)", color: "hsl(var(--primary-foreground))" }}
                  >
                    {username.slice(0, 2).toUpperCase()}
                  </div>
                </div>
              </div>
            )}

            {/* Username input - يظهر فقط للمستخدمين المسجلين */}
            {isAuthenticated && (
              <>
                <div className="relative">
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <User className="w-4 h-4" style={{ color: "hsl(var(--muted-foreground))" }} />
                  </div>
                  <input type="text" value={username} onChange={(e) => { setUsername(e.target.value); setError(""); }}
                    placeholder="اسمك..." maxLength={20}
                    className="w-full py-2.5 pr-9 pl-4 rounded-xl text-sm outline-none transition-all duration-200 text-right"
                    style={{ background: "hsl(var(--input))", border: error ? "1px solid hsl(var(--destructive))" : "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }}
                  />
                </div>

                {error && <p className="text-xs text-right" style={{ color: "hsl(var(--destructive))" }}>{error}</p>}
              </>
            )}

            {/* DM Privacy Toggle - يظهر فقط للمستخدمين المسجلين */}
            {isAuthenticated && (
              <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: "hsl(var(--input))", border: "1px solid hsl(var(--border))" }}>
                <div className="flex items-center gap-2">
                  {allowDms ? <MessageSquare className="w-4 h-4" style={{ color: "hsl(var(--chat-online))" }} /> : <MessageSquareOff className="w-4 h-4" style={{ color: "hsl(var(--destructive))" }} />}
                  <span className="text-sm" style={{ color: "hsl(var(--foreground))" }}>السماح بالرسائل الخاصة</span>
                </div>
                <button type="button" onClick={() => setAllowDms(!allowDms)}
                  className="w-11 h-6 rounded-full relative transition-colors duration-200"
                  style={{ background: allowDms ? "hsl(var(--chat-online))" : "hsl(var(--muted))" }}>
                  <span className="absolute top-0.5 w-5 h-5 rounded-full shadow transition-transform duration-200"
                    style={{ background: "hsl(var(--foreground))", left: allowDms ? "calc(100% - 22px)" : "2px" }} />
                </button>
              </div>
            )}

            {/* Sound Toggle - يظهر للجميع */}
            <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: "hsl(var(--input))", border: "1px solid hsl(var(--border))" }}>
              <div className="flex items-center gap-2">
                {soundEnabled ? <Volume2 className="w-4 h-4" style={{ color: "hsl(var(--chat-online))" }} /> : <VolumeX className="w-4 h-4" style={{ color: "hsl(var(--destructive))" }} />}
                <span className="text-sm" style={{ color: "hsl(var(--foreground))" }}>أصوات الإرسال</span>
              </div>
              <button type="button" onClick={() => { const v = !soundEnabled; setSoundEnabledState(v); setSoundEnabled(v); }}
                className="w-11 h-6 rounded-full relative transition-colors duration-200"
                style={{ background: soundEnabled ? "hsl(var(--chat-online))" : "hsl(var(--muted))" }}>
                <span className="absolute top-0.5 w-5 h-5 rounded-full shadow transition-transform duration-200"
                  style={{ background: "hsl(var(--foreground))", left: soundEnabled ? "calc(100% - 22px)" : "2px" }} />
              </button>
            </div>

            {/* Chat Background - يظهر للجميع */}
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: "hsl(var(--input))", border: "1px solid hsl(var(--border))" }}>
                <div className="flex items-center gap-2">
                  <Image className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
                  <span className="text-sm" style={{ color: "hsl(var(--foreground))" }}>خلفية الدردشة</span>
                </div>
                <div className="flex items-center gap-2">
                  {chatBg && (
                    <button type="button" onClick={() => onChatBgChange(null)} className="p-1.5 rounded-lg hover:opacity-70 transition-colors" style={{ color: "hsl(var(--destructive))" }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button type="button" onClick={() => bgInputRef.current?.click()}
                    className="px-3 py-1 rounded-lg text-[12px] font-medium transition-all active:scale-95"
                    style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" }}>
                    {chatBg ? "تغيير" : "اختيار صورة"}
                  </button>
                </div>
                <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => onChatBgChange(ev.target?.result as string);
                  reader.readAsDataURL(file);
                }} />
              </div>
              {chatBg && (
                <div className="w-full h-16 rounded-xl overflow-hidden" style={{ border: "1px solid hsl(var(--border))" }}>
                  <img src={chatBg} alt="خلفية" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* زر الحفظ - يظهر فقط للمستخدمين المسجلين */}
            {isAuthenticated && (
              <button type="submit" disabled={saving}
                className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}>
                {saving ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "hsl(var(--primary-foreground))", borderTopColor: "transparent" }} />
                    جارٍ الحفظ...
                  </>
                ) : (
                  <><Save className="w-4 h-4" /> حفظ التغييرات</>
                )}
              </button>
            )}

            {/* زر تسجيل الخروج - يظهر فقط للمستخدمين المسجلين */}
            {isAuthenticated && (
              <button type="button" onClick={handleSignOut}
                className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
                style={{ background: "hsl(var(--destructive) / 0.12)", color: "hsl(var(--destructive))", border: "1px solid hsl(var(--destructive) / 0.25)" }}>
                <LogOut className="w-4 h-4" />
                تسجيل الخروج
              </button>
            )}

            {/* زر تسجيل الدخول - يظهر فقط للزوار */}
            {!isAuthenticated && (
              <button
                type="button"
                onClick={() => { onClose(); navigate("/auth"); }}
                className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
                style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}
              >
                <LogIn className="w-4 h-4" />
                تسجيل الدخول / إنشاء حساب
              </button>
            )}

            {!isAuthenticated && (
              <p className="text-[11px] text-center leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                سجّل دخولك للمشاركة في الدردشة وحفظ ملفك الشخصي ورسائلك.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
