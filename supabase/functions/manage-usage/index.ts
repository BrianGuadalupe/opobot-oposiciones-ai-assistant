import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const { action, queryText, responseLength } = requestBody;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      { auth: { persistSession: false } }
    );

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = userData.user;

    if (action === 'check_limit') {
      const { data: usageData, error: usageError } = await supabase
        .from('user_usage')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!usageData) {
        const { data: subData } = await supabase
          .from('subscribers')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        const limit = subData?.subscribed ? getSubscriptionLimit(subData.subscription_tier) : 0;

        const { data: newUsage } = await supabase
          .from('user_usage')
          .insert({
            user_id: user.id,
            email: user.email || subData?.email,
            is_active: subData?.subscribed || false,
            subscription_tier: subData?.subscription_tier || null,
            queries_remaining_this_month: limit,
            is_demo_user: false
          })
          .select()
          .single();

        return new Response(JSON.stringify({
          canProceed: limit > 0,
          reason: limit > 0 ? "ok" : "no_subscription",
          message: limit > 0 ? "Consulta permitida" : "No tienes una suscripción activa",
          usageData: {
            queriesUsed: 0,
            queriesRemaining: limit,
            usagePercentage: 0,
            monthlyLimit: limit
          }
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({
        canProceed: usageData.queries_remaining_this_month > 0,
        reason: usageData.queries_remaining_this_month > 0 ? "ok" : "limit_exceeded",
        message: usageData.queries_remaining_this_month > 0
          ? "Consulta permitida"
          : "Has alcanzado tu límite mensual",
        usageData: {
          queriesUsed: usageData.queries_this_month,
          queriesRemaining: usageData.queries_remaining_this_month,
          usagePercentage: usageData.usage_percentage,
          monthlyLimit: getSubscriptionLimit(usageData.subscription_tier || "")
        }
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === 'log_query') {
      await supabase.from('user_usage').update({
        queries_this_month: supabase.sql`queries_this_month + 1`,
        queries_remaining_this_month: supabase.sql`queries_remaining_this_month - 1`,
        total_queries: supabase.sql`total_queries + 1`,
        updated_at: new Date().toISOString()
      }).eq('user_id', user.id);

      await supabase.from('query_logs').insert({
        user_id: user.id,
        query_text: queryText,
        response_length: responseLength
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getSubscriptionLimit(tier: string): number {
  const limits = {
    'Demo': 3,
    'Básico': 100,
    'Profesional': 3000,
    'Academias': 30000
  };
  return limits[tier] || 0;
}
