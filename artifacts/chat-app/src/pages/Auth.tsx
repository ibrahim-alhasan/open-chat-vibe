import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Eye, EyeOff, MessageCircle } from "lucide-react";
import { z } from "zod";

const signUpSchema = z.object({
  email: z.string().trim().email("بريد إلكتروني غير صالح").max(255),
  password: z.string().min(1, "أدخل كلمة السر").max(72),
  username: z.string().trim().min(2, "الاسم قصير جداً").max(20, "الاسم طويل جداً")
    .regex(/^[\p{L}\p{N}_ ]+$/u, "حروف وأرقام و _ فقط"),
});

const signInSchema = z.object({
  email: z.string().trim().email("بريد إلكتروني غير صالح"),
  password: z.string().min(1, "أدخل كلمة السر"),
});

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!authLoading && user) navigate("/", { replace: true });
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const parsed = signUpSchema.safeParse({ email, password, username });
        if (!parsed.success) {
          toast({ title: "خطأ", description: parsed.error.errors[0].message, variant: "destructive" });
          return;
        }
        const { data: exists } = await supabase.from("profiles").select("username").eq("username", parsed.data.username).maybeSingle();
        if (exists) {
          toast({ title: "الاسم مستخدم", description: "اختر اسماً آخر", variant: "destructive" });
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { username: parsed.data.username },
          },
        });
        if (error) throw error;
        toast({ title: "أهلاً بك!", description: "تم إنشاء حسابك بنجاح" });
      } else {
        const parsed = signInSchema.safeParse({ email, password });
        if (!parsed.success) {
          toast({ title: "خطأ", description: parsed.error.errors[0].message, variant: "destructive" });
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      const raw = (err?.message || "").toLowerCase();
      let msg = err?.message || "حدث خطأ";
      if (raw.includes("invalid login") || raw.includes("invalid credentials")) msg = "البريد أو كلمة السر غير صحيحة";
      else if (raw.includes("email not confirmed") || raw.includes("not confirmed")) msg = "يجب تأكيد البريد الإلكتروني أولاً";
      else if (raw.includes("already registered") || raw.includes("user already")) msg = "هذا البريد مسجل مسبقاً";
      else if (raw.includes("rate limit") || raw.includes("too many")) msg = "محاولات كثيرة، حاول لاحقاً";
      else if (raw.includes("network") || raw.includes("fetch")) msg = "تعذر الاتصال بالخادم";
      toast({ title: "تعذر إتمام العملية", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center overflow-y-auto"
      style={{ background: "hsl(var(--background))" }}
    >
      {/* Background glow */}
      <div
        className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] rounded-full opacity-[0.07]"
        style={{ background: "radial-gradient(ellipse, hsl(var(--primary)), transparent 70%)" }}
      />

      <div className="relative w-full max-w-[400px] px-5 py-10 flex flex-col items-center gap-7">
        {/* Logo area */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-[72px] h-[72px] rounded-[22px] flex items-center justify-center shadow-2xl"
            style={{ background: "linear-gradient(145deg, hsl(142, 70%, 48%), hsl(142, 60%, 36%))" }}
          >
            <MessageCircle className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "hsl(var(--foreground))" }}>
            الدردشة العامة
          </h1>
          <p className="text-[13px] text-center" style={{ color: "hsl(var(--muted-foreground))" }}>
            {mode === "signup" ? "أنشئ حسابك وانضم إلى المجتمع" : "مرحباً بعودتك"}
          </p>
        </div>

        {/* Card */}
        <div
          className="w-full rounded-3xl p-6 space-y-5"
          style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "0 8px 32px rgba(0,0,0,0.35)" }}
        >
          {/* Mode switcher */}
          <div
            className="grid grid-cols-2 rounded-xl p-1"
            style={{ background: "hsl(var(--secondary))" }}
          >
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className="py-2 rounded-lg text-[13px] font-medium transition-all duration-200"
                style={{
                  background: mode === m ? "hsl(var(--card))" : "transparent",
                  color: mode === m ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                  boxShadow: mode === m ? "0 1px 6px rgba(0,0,0,0.25)" : "none",
                }}
              >
                {m === "signin" ? "تسجيل دخول" : "حساب جديد"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>
                  اسم العرض
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="مثلاً: أحمد"
                  maxLength={20}
                  required
                  autoComplete="nickname"
                  className="w-full h-11 px-4 rounded-xl text-[14px] outline-none transition-all"
                  style={{
                    background: "hsl(var(--secondary))",
                    border: "1.5px solid hsl(var(--border))",
                    color: "hsl(var(--foreground))",
                    direction: "rtl",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "hsl(var(--primary))";
                    e.target.style.boxShadow = "0 0 0 3px hsl(var(--primary) / 0.12)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "hsl(var(--border))";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[12px] font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>
                البريد الإلكتروني
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="w-full h-11 px-4 rounded-xl text-[14px] outline-none transition-all"
                style={{
                  background: "hsl(var(--secondary))",
                  border: "1.5px solid hsl(var(--border))",
                  color: "hsl(var(--foreground))",
                  direction: "ltr",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "hsl(var(--primary))";
                  e.target.style.boxShadow = "0 0 0 3px hsl(var(--primary) / 0.12)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "hsl(var(--border))";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[12px] font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>
                كلمة السر
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  className="w-full h-11 px-4 pr-11 rounded-xl text-[14px] outline-none transition-all"
                  style={{
                    background: "hsl(var(--secondary))",
                    border: "1.5px solid hsl(var(--border))",
                    color: "hsl(var(--foreground))",
                    direction: "ltr",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "hsl(var(--primary))";
                    e.target.style.boxShadow = "0 0 0 3px hsl(var(--primary) / 0.12)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "hsl(var(--border))";
                    e.target.style.boxShadow = "none";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 px-3 flex items-center transition-opacity hover:opacity-70"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-2xl font-semibold text-[15px] transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 mt-1 flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, hsl(142, 70%, 45%), hsl(142, 58%, 36%))",
                color: "white",
                boxShadow: "0 4px 18px hsl(142 70% 45% / 0.4)",
              }}
            >
              {submitting
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : mode === "signup" ? "إنشاء حساب" : "دخول"}
            </button>
          </form>
        </div>

        {/* Guest link */}
        <button
          type="button"
          onClick={() => navigate("/")}
          className="text-[13px] transition-opacity hover:opacity-70"
          style={{ color: "hsl(var(--muted-foreground))" }}
        >
          متابعة كزائر (قراءة فقط)
        </button>
      </div>
    </div>
  );
};

export default Auth;
