import { useState, useRef, useEffect } from "react";
import { X, Camera, User, Save, MessageSquareOff, MessageSquare, Image, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
  const [username, setUsername] = useState(currentUsername);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(currentAvatarUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [allowDms, setAllowDms] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase.from("profiles").select("allow_dms").eq("user_id", userId).single();
      if (data) setAllowDms(data.allow_dms ?? true);
    };
    fetchProfile();
  }, [userId]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) { setError("الرجاء إدخال اسمك"); return; }
    if (trimmed.length < 2) { setError("الاسم يجب أن يكون حرفين على الأقل"); return; }
    if (trimmed.length > 20) { setError("الاسم يجب أن لا يتجاوز 20 حرفاً"); return; }

    setSaving(true);
    let avatarUrl: string | null = currentAvatarUrl;

    if (avatarFile) {
      const ext = avatarFile.name.split(".").pop();
      const fileName = `${userId}_${Date.now()}.${ext}`;
      const { data, error: uploadError } = await supabase.storage.from("avatars").upload(fileName, avatarFile, { upsert: true });
      if (!uploadError && data) {
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(data.path);
        avatarUrl = urlData.publicUrl;
      }
    }

    await supabase.from("profiles").upsert(
      { user_id: userId, username: trimmed, avatar_url: avatarUrl, allow_dms: allowDms, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

    localStorage.setItem("chat_username", trimmed);
    if (avatarUrl) localStorage.setItem("chat_avatar_url", avatarUrl);
    else localStorage.removeItem("chat_avatar_url");

    setSaving(false);
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
            <h2 className="font-bold text-base" style={{ color: "hsl(var(--foreground))" }}>إعدادات الملف الشخصي</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:opacity-70" style={{ color: "hsl(var(--muted-foreground))" }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            {/* Avatar picker */}
            <div className="flex justify-center">
              <div className="relative">
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden transition-all duration-200 hover:opacity-80"
                  style={{ background: avatarPreview ? "transparent" : "var(--gradient-primary)", border: "2px solid hsl(var(--primary) / 0.5)" }}>
                  {avatarPreview ? <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" /> : <User className="w-8 h-8" style={{ color: "hsl(var(--primary-foreground))" }} />}
                </button>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer" style={{ background: "hsl(var(--primary))" }} onClick={() => fileInputRef.current?.click()}>
                  <Camera className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary-foreground))" }} />
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>
            </div>

            {/* Username input */}
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

            {/* DM Privacy Toggle */}
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
          </form>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;