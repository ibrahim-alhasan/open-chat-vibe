import { useState } from "react";
import { Loader2, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface UsernameModalProps {
  userId: string;
  onJoin: (username: string) => void;
}

/**
 * ورقة سفلية (Bottom Sheet) لاختيار الاسم عند أول دخول.
 * لا يوجد تسجيل دخول بالبريد — الحساب أُنشئ تلقائياً.
 */
const UsernameModal = ({ userId, onJoin }: UsernameModalProps) => {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) { setError("الرجاء إدخال اسمك"); return; }
    if (trimmed.length < 2) { setError("الاسم يجب أن يكون حرفين على الأقل"); return; }
    if (trimmed.length > 20) { setError("الاسم يجب أن لا يتجاوز 20 حرفاً"); return; }

    setSaving(true);
    const { data: exists } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("username", trimmed)
      .maybeSingle();

    if (exists && exists.user_id !== userId) {
      setSaving(false);
      setError("هذا الاسم مستخدم بالفعل، اختر اسماً آخر");
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ username: trimmed })
      .eq("user_id", userId);

    setSaving(false);
    if (updateError) { setError("تعذّر حفظ الاسم، حاول مجدداً"); return; }
    onJoin(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center"
      style={{ background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(5px)" }}
    >
      <div
        className="w-full max-w-[430px] sheet-up"
        style={{
          background: "#ffffff",
          borderRadius: "28px 28px 0 0",
          padding: "22px 20px calc(20px + var(--safe-bottom)) 20px",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[17px] font-bold" style={{ color: "hsl(var(--foreground))" }}>
            أهلاً بك في نبض التفوق
          </h3>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "var(--gradient-primary)" }}
          >
            <UserRound className="w-5 h-5 text-white" />
          </div>
        </div>

        <p className="text-[12.5px] mb-4" style={{ color: "hsl(var(--muted-foreground))" }}>
          تم إنشاء حسابك تلقائياً، اختر الاسم الذي سيظهر للطلاب في الدردشة.
        </p>

        <form onSubmit={handleSubmit}>
          <label className="text-[12.5px] font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>
            اسم المستخدم
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => { setUsername(e.target.value); setError(""); }}
            placeholder="اسمك المعروض..."
            autoFocus
            maxLength={20}
            className="w-full mt-1.5 mb-3 px-3.5 py-3 rounded-xl text-[13.5px] outline-none select-text"
            style={{
              background: "#f8fafc",
              border: error ? "1px solid hsl(var(--destructive))" : "1px solid hsl(var(--border))",
              color: "hsl(var(--foreground))",
            }}
          />

          {error && (
            <p className="text-[11.5px] mb-2" style={{ color: "hsl(var(--destructive))" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-2xl font-bold text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
            style={{ background: "var(--gradient-primary)", color: "#fff", boxShadow: "var(--shadow-glow)" }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "ابدأ الدردشة"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default UsernameModal;
