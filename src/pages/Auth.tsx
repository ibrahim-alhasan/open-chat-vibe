import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, MessageCircle, Shield, Save } from "lucide-react";
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
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
        // Check username availability
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
      const msg = err?.message?.includes("Invalid login")
        ? "البريد أو كلمة السر غير صحيحة"
        : err?.message?.includes("already registered")
          ? "هذا البريد مسجل مسبقاً"
          : err?.message || "حدث خطأ";
      toast({ title: "تعذر إتمام العملية", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden bg-background"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Decorative gradient header */}
      <div
        className="relative flex-shrink-0 px-5 pt-6 pb-8"
        style={{
          background: "linear-gradient(160deg, hsl(var(--primary) / 0.25) 0%, hsl(var(--primary) / 0.05) 100%)",
        }}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-primary/20 backdrop-blur flex items-center justify-center shadow-lg">
            <MessageCircle className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-lg font-bold text-foreground">مرحباً بك في الدردشة</h1>
          <p className="text-[11px] text-muted-foreground text-center leading-snug px-2 max-w-[300px]">
            تم إضافة تسجيل الدخول لحماية المستخدمين وحفظ تقدمهم ورسائلهم.
          </p>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-primary" /> آمن</span>
            <span className="flex items-center gap-1"><Save className="w-3 h-3 text-primary" /> محفوظ</span>
          </div>
        </div>
      </div>

      {/* Form sheet pulled up over header */}
      <div className="flex-1 min-h-0 -mt-5 px-4 pb-3 flex flex-col">
        <div className="bg-card border border-border rounded-t-3xl rounded-b-2xl shadow-xl p-4 space-y-3 flex-1 flex flex-col">
          {/* Mode switcher */}
          <div className="grid grid-cols-2 gap-1 bg-muted rounded-xl p-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`py-1.5 rounded-lg text-xs font-medium transition-all ${
                mode === "signup" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              حساب جديد
            </button>
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`py-1.5 rounded-lg text-xs font-medium transition-all ${
                mode === "signin" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              تسجيل دخول
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-2.5 flex-1 flex flex-col">
            {mode === "signup" && (
              <div className="space-y-1">
                <Label htmlFor="username" className="text-xs">اسم العرض</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="مثلاً: أحمد"
                  maxLength={20}
                  className="h-10 text-sm"
                  required
                />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                dir="ltr"
                className="h-10 text-sm"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password" className="text-xs">كلمة السر</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                dir="ltr"
                className="h-10 text-sm"
                required
              />
            </div>

            <div className="flex-1" />

            <Button type="submit" className="w-full h-11 rounded-xl font-semibold" disabled={submitting}>
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === "signup" ? (
                "إنشاء حساب"
              ) : (
                "دخول"
              )}
            </Button>

            <button
              type="button"
              onClick={() => navigate("/")}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              متابعة كزائر (قراءة فقط)
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Auth;