import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "delete-dm-images") {
      // Delete all files in direct_message_images bucket
      const { data: files } = await supabase.storage.from("direct_message_images").list("", { limit: 1000 });
      if (files && files.length > 0) {
        const filePaths = files.map(f => f.name);
        await supabase.storage.from("direct_message_images").remove(filePaths);
      }
      return new Response(JSON.stringify({ success: true, deleted: files?.length || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "cleanup-old-files") {
      // Delete public chat files older than 2 days
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const { data: files } = await supabase.storage.from("public_chat_files").list("", { limit: 1000 });
      
      if (files && files.length > 0) {
        const oldFiles = files.filter(f => {
          const created = new Date(f.created_at);
          return created < new Date(twoDaysAgo);
        });
        if (oldFiles.length > 0) {
          const paths = oldFiles.map(f => f.name);
          await supabase.storage.from("public_chat_files").remove(paths);
        }
        return new Response(JSON.stringify({ success: true, deleted: oldFiles.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, deleted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
