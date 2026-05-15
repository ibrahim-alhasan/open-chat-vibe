import { useState, useRef } from "react";
import { MessageCircle, User, Camera, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface UsernameModalProps {
  onJoin: (username: string, avatarFile?: File | null) => void;
}

const UsernameModal = ({ onJoin }: UsernameModalProps) => {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) { setError("الرجاء إدخال اسمك"); return; }
    if (trimmed.length < 2) { setError("الاسم يجب أن يكون حرفين على الأقل"); return; }
    if (trimmed.length > 20) { setError("الاسم يجب أن لا يتجاوز 20 حرفاً"); return; }

    // Check if username already exists
    setChecking(true);
    const { data } = await supabase.from("profiles").select("username, user_id").eq("username", trimmed).maybeSingle();
    setChecking(false);

    const existingUserId = localStorage.getItem("chat_user_id");
    if (data && data.user_id !== existingUserId) {
      setError("هذا الاسم مستخدم بالفعل، اختر اسماً آخر");
      return;
    }

    onJoin(trimmed, avatarFile);
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: "hsl(220 16% 5% / 0.95)", backdropFilter: "blur(8px)" }}
    >
      <div className="animate-slide-up w-full max-w-md mx-4">
        <div
          className="rounded-2xl p-8"
          style={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            boxShadow: "var(--shadow-card)",
          }}
        >
          {/* Avatar picker */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden transition-all duration-200 hover:opacity-80 glow-primary"
                style={{
                  background: avatarPreview ? "transparent" : "var(--gradient-primary)",
                  border: "2px solid hsl(var(--primary) / 0.5)",
                }}
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <MessageCircle className="w-8 h-8" style={{ color: "hsl(var(--primary-foreground))" }} />
                )}
              </button>
              <div
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: "hsl(var(--primary))" }}
              >
                <Camera className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary-foreground))" }} />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2 text-gradient">مرحباً بك في الدردشة العامة</h1>
            <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              {avatarPreview ? "صورتك جاهزة! أدخل اسمك للانضمام" : "أضف صورتك واكتب اسمك للانضمام"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <User className="w-5 h-5" style={{ color: "hsl(var(--muted-foreground))" }} />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(""); }}
                placeholder="اسمك..."
                autoFocus
                maxLength={20}
                className="w-full py-3 pr-10 pl-4 rounded-xl text-sm outline-none transition-all duration-200 text-right"
                style={{
                  background: "hsl(var(--input))",
                  border: error ? "1px solid hsl(var(--destructive))" : "1px solid hsl(var(--border))",
                  color: "hsl(var(--foreground))",
                }}
                onFocus={(e) => {
                  if (!error) e.target.style.borderColor = "hsl(var(--primary))";
                  e.target.style.boxShadow = "0 0 0 3px hsl(var(--primary) / 0.15)";
                }}
                onBlur={(e) => {
                  if (!error) e.target.style.borderColor = "hsl(var(--border))";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            {error && (
              <p className="text-xs text-right animate-fade-in" style={{ color: "hsl(var(--destructive))" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={checking}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 glow-primary active:scale-95 disabled:opacity-60"
              style={{
                background: "var(--gradient-primary)",
                color: "hsl(var(--primary-foreground))",
              }}
            >
              {checking ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري التحقق...
                </span>
              ) : "انضم للدردشة 🚀"}
            </button>
          </form>

          <p className="text-center text-xs mt-4" style={{ color: "hsl(var(--muted-foreground))" }}>
            لا يلزم تسجيل دخول • دردشة مجانية وفورية
          </p>
        </div>
      </div>
    </div>
  );
};

export default UsernameModal;
