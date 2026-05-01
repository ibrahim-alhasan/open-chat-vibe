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
  password: z.string().min(6, "كلمة السر 6 أحرف على الأقل").max(72),
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-primary/15 items-center justify-center mx-auto">
            <MessageCircle className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">مرحباً بك في الدردشة</h1>
          <p className="text-sm text-muted-foreground leading-relaxed px-2">
            تم إضافة تسجيل الدخول لحماية المستخدمين وحفظ تقدمهم ورسائلهم.
          </p>
          <div className="flex items-center justify-center gap-4 pt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-primary" /> آمن</span>
            <span className="flex items-center gap-1.5"><Save className="w-3.5 h-3.5 text-primary" /> محفوظ</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-lg space-y-4">
          <div className="grid grid-cols-2 gap-1 bg-muted rounded-lg p-1">
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`py-2 rounded-md text-sm font-medium transition-colors ${mode === "signup" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              حساب جديد
            </button>
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`py-2 rounded-md text-sm font-medium transition-colors ${mode === "signin" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              تسجيل دخول
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="username">اسم العرض</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="مثلاً: أحمد"
                  maxLength={20}
                  required
                />
                <p className="text-xs text-muted-foreground">يظهر هذا الاسم للجميع في الدردشة. لا يمكن تغييره لاحقاً.</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                dir="ltr"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">كلمة السر</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                dir="ltr"
                minLength={6}
                required
              />
              {mode === "signup" && <p className="text-xs text-muted-foreground">6 أحرف على الأقل</p>}
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (mode === "signup" ? "إنشاء حساب" : "دخول")}
            </Button>
          </form>
        </div>

        <button
          onClick={() => navigate("/")}
          className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          متابعة كزائر (قراءة فقط)
        </button>
      </div>
    </div>
  );
};

export default Auth;