-- إعادة منح صلاحية التنفيذ لمستخدمي التطبيق
-- هذا آمن لأن الدوال SECURITY DEFINER وتقرأ فقط
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
