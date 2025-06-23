
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
    const { action, queryText, responseLength, userIp } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("Authentication required");
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user?.email) {
      throw new Error("User authentication failed");
    }

    const user = userData.user;

    if (action === "check_demo_availability") {
      // Verificar si IP puede registrar demo
      const { data: canRegister } = await supabaseClient.rpc('can_register_demo', { 
        check_ip: userIp 
      });
      
      return new Response(JSON.stringify({ canRegister }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "register_demo") {
      // Registrar usuario demo
      await supabaseClient
        .from("demo_registrations")
        .insert({
          user_id: user.id,
          email: user.email,
          ip_address: userIp
        });

      // Crear registro de uso para demo
      await supabaseClient
        .from("user_usage")
        .insert({
          user_id: user.id,
          email: user.email,
          is_active: true,
          is_demo_user: true,
          subscription_tier: "Demo",
          queries_remaining_this_month: 3,
          current_period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
          current_period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59).toISOString()
        });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "check_limit") {
      // Verificar límite antes de procesar consulta
      const canProceed = await checkQueryLimit(supabaseClient, user.id, user.email);
      return new Response(JSON.stringify(canProceed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "log_query") {
      // Registrar consulta después de procesarla
      await logQuery(supabaseClient, user.id, user.email, queryText, responseLength);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_usage") {
      // Obtener estadísticas de uso
      const usage = await getUserUsage(supabaseClient, user.id);
      return new Response(JSON.stringify(usage), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");

  } catch (error) {
    console.error("Error in manage-usage function:", error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function checkQueryLimit(supabase: any, userId: string, email: string) {
  // Obtener registro de uso
  const { data: usage } = await supabase
    .from("user_usage")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!usage) {
    return { 
      canProceed: false, 
      reason: "no_usage_record",
      message: "No se encontró registro de uso"
    };
  }

  // Si es usuario demo
  if (usage.is_demo_user) {
    const queriesUsed = usage.queries_this_month;
    const queriesRemaining = usage.queries_remaining_this_month;
    const usagePercentage = (queriesUsed / 3) * 100;

    if (queriesUsed >= 3) {
      return {
        canProceed: false,
        reason: "demo_limit_reached",
        message: "Has alcanzado el límite de 3 consultas del Demo. Suscríbete para continuar.",
        usageData: { queriesUsed, queriesRemaining: 0, usagePercentage: 100, monthlyLimit: 3 }
      };
    }

    if (usagePercentage >= 90) {
      return {
        canProceed: true,
        reason: "demo_warning_90",
        message: `Has usado ${queriesUsed} de 3 consultas del Demo (${usagePercentage.toFixed(1)}%)`,
        usageData: { queriesUsed, queriesRemaining, usagePercentage, monthlyLimit: 3 }
      };
    }

    return {
      canProceed: true,
      reason: "ok",
      usageData: { queriesUsed, queriesRemaining, usagePercentage, monthlyLimit: 3 }
    };
  }

  // Para usuarios con suscripción - código existente
  const { data: subscriber } = await supabase
    .from("subscribers")
    .select("subscribed, subscription_tier")
    .eq("user_id", userId)
    .single();

  if (!subscriber?.subscribed) {
    return { 
      canProceed: false, 
      reason: "no_subscription",
      message: "Necesitas una suscripción activa para usar el chat"
    };
  }

  const subscriptionTier = subscriber.subscription_tier || "Básico";
  const monthlyLimit = getMonthlyLimit(subscriptionTier);
  const currentMonth = new Date().toISOString().slice(0, 7);
  let currentUsage = usage;

  // Verificar si necesitamos resetear el mes
  const usageMonth = new Date(currentUsage.current_period_start).toISOString().slice(0, 7);
  
  if (usageMonth !== currentMonth) {
    // Resetear para el nuevo mes
    const { data: updatedUsage } = await supabase
      .from("user_usage")
      .update({
        queries_this_month: 0,
        queries_remaining_this_month: monthlyLimit,
        usage_percentage: 0,
        subscription_tier: subscriptionTier,
        current_period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        current_period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59).toISOString()
      })
      .eq("user_id", userId)
      .select()
      .single();
    
    currentUsage = updatedUsage;
  }

  const queriesUsed = currentUsage.queries_this_month;
  const queriesRemaining = currentUsage.queries_remaining_this_month;
  const usagePercentage = (queriesUsed / monthlyLimit) * 100;

  // Verificar límites
  if (subscriptionTier === "Profesional") {
    if (queriesUsed >= monthlyLimit) {
      return {
        canProceed: false,
        reason: "limit_reached",
        message: "Has alcanzado el límite de consultas mensuales",
        usageData: { queriesUsed, queriesRemaining: 0, usagePercentage: 100, monthlyLimit }
      };
    }
  } else {
    // Plan Básico - verificar advertencias y límites
    if (queriesUsed >= monthlyLimit) {
      return {
        canProceed: false,
        reason: "limit_reached",
        message: "Has alcanzado el límite de 100 consultas mensuales del Plan Básico",
        usageData: { queriesUsed, queriesRemaining: 0, usagePercentage: 100, monthlyLimit }
      };
    }
    
    if (usagePercentage >= 90) {
      return {
        canProceed: true,
        reason: "warning_90",
        message: `Has usado ${queriesUsed} de ${monthlyLimit} consultas mensuales (${usagePercentage.toFixed(1)}%)`,
        usageData: { queriesUsed, queriesRemaining, usagePercentage, monthlyLimit }
      };
    }
  }

  return {
    canProceed: true,
    reason: "ok",
    usageData: { queriesUsed, queriesRemaining, usagePercentage, monthlyLimit }
  };
}

async function logQuery(supabase: any, userId: string, email: string, queryText: string, responseLength: number) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  // Registrar la consulta
  await supabase
    .from("query_logs")
    .insert({
      user_id: userId,
      query_text: queryText.substring(0, 500),
      response_length: responseLength,
      month_year: currentMonth
    });

  // Actualizar estadísticas de uso
  const { data: currentUsage } = await supabase
    .from("user_usage")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (currentUsage) {
    const newQueriesThisMonth = currentUsage.queries_this_month + 1;
    const newTotalQueries = currentUsage.total_queries + 1;
    
    let monthlyLimit;
    if (currentUsage.is_demo_user) {
      monthlyLimit = 3;
    } else {
      monthlyLimit = getMonthlyLimit(currentUsage.subscription_tier);
    }
    
    const newQueriesRemaining = Math.max(0, monthlyLimit - newQueriesThisMonth);
    const newUsagePercentage = (newQueriesThisMonth / monthlyLimit) * 100;
    
    // Calcular estadísticas históricas
    const { data: monthsActive } = await supabase
      .from("query_logs")
      .select("month_year")
      .eq("user_id", userId);
    
    const uniqueMonths = new Set(monthsActive?.map(m => m.month_year) || []).size;
    const queriesPerMonth = uniqueMonths > 0 ? newTotalQueries / uniqueMonths : newTotalQueries;

    await supabase
      .from("user_usage")
      .update({
        queries_this_month: newQueriesThisMonth,
        queries_remaining_this_month: newQueriesRemaining,
        usage_percentage: newUsagePercentage,
        total_queries: newTotalQueries,
        queries_per_month: queriesPerMonth,
        months_with_active_subscription: uniqueMonths
      })
      .eq("user_id", userId);
  }
}

async function getUserUsage(supabase: any, userId: string) {
  const { data: usage } = await supabase
    .from("user_usage")
    .select("*")
    .eq("user_id", userId)
    .single();

  return usage || null;
}

function getMonthlyLimit(tier: string): number {
  switch (tier) {
    case "Demo": return 3;
    case "Básico": return 100;
    case "Profesional": return 3000;
    default: return 0;
  }
}
