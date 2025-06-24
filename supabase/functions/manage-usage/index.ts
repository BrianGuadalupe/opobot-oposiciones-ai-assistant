
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log('🚀 MANAGE-USAGE START');
  const startTime = Date.now();
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse body
    const body = await req.json();
    const { action } = body;
    console.log('📦 Action:', action);
    
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.log('❌ No auth header');
      return new Response(JSON.stringify({ 
        error: "Authentication required" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const token = authHeader.replace("Bearer ", "");
    console.log('✅ Token extracted');

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get user
    const userResult = await supabaseClient.auth.getUser(token);
    
    if (userResult.error || !userResult.data?.user?.id) {
      console.log('❌ User auth failed');
      return new Response(JSON.stringify({ 
        error: "User authentication failed" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userResult.data.user.id;
    console.log('✅ User authenticated:', userId);

    // Route actions
    if (action === "check_limit") {
      return await handleCheckLimit(supabaseClient, userId);
    } else if (action === "log_query") {
      return await handleLogQuery(supabaseClient, userId, body.queryText, body.responseLength);
    } else if (action === "get_usage") {
      return await handleGetUsage(supabaseClient, userId);
    } else {
      return new Response(JSON.stringify({ 
        error: "Invalid action" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error("💥 ERROR:", error);
    console.error("⏱️ Time:", executionTime, "ms");
    
    return new Response(JSON.stringify({ 
      error: "Internal server error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleCheckLimit(supabase: any, userId: string) {
  console.log('🔍 CHECK_LIMIT - User:', userId);
  
  try {
    // Single query to get usage
    console.log('📊 Getting usage...');
    const { data: usage, error: usageError } = await supabase
      .from("user_usage")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (usageError) {
      console.log('❌ Usage error:', usageError.message);
      return new Response(JSON.stringify({
        canProceed: false,
        reason: "no_usage_record",
        message: "No se encontró registro de uso"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log('✅ Usage found:', usage ? 'YES' : 'NO');

    // Demo user check
    if (usage.is_demo_user) {
      const queriesUsed = usage.queries_this_month || 0;
      const queriesRemaining = usage.queries_remaining_this_month || 0;
      const usagePercentage = (queriesUsed / 3) * 100;

      console.log('👤 Demo - Used:', queriesUsed, 'Remaining:', queriesRemaining);

      if (queriesUsed >= 3) {
        return new Response(JSON.stringify({
          canProceed: false,
          reason: "demo_limit_reached",
          message: "Has alcanzado el límite de 3 consultas del Demo",
          usageData: { queriesUsed, queriesRemaining: 0, usagePercentage: 100, monthlyLimit: 3 }
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        canProceed: true,
        reason: usagePercentage >= 90 ? "demo_warning_90" : "ok",
        message: usagePercentage >= 90 ? `Has usado ${queriesUsed} de 3 consultas` : undefined,
        usageData: { queriesUsed, queriesRemaining, usagePercentage, monthlyLimit: 3 }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Subscription user check
    console.log('🔍 Checking subscription...');
    const { data: subscriber, error: subError } = await supabase
      .from("subscribers")
      .select("subscribed, subscription_tier")
      .eq("user_id", userId)
      .single();

    if (subError || !subscriber?.subscribed) {
      console.log('❌ No active subscription');
      return new Response(JSON.stringify({ 
        canProceed: false, 
        reason: "no_subscription",
        message: "Necesitas una suscripción activa"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate limits
    const subscriptionTier = subscriber.subscription_tier || "Básico";
    const monthlyLimit = subscriptionTier === "Básico" ? 100 : 3000;
    const queriesUsed = usage.queries_this_month || 0;
    const queriesRemaining = usage.queries_remaining_this_month || 0;
    const usagePercentage = (queriesUsed / monthlyLimit) * 100;

    console.log('✅ Subscription - Tier:', subscriptionTier, 'Used:', queriesUsed, 'Limit:', monthlyLimit);

    // Check limits
    if (queriesUsed >= monthlyLimit) {
      return new Response(JSON.stringify({
        canProceed: false,
        reason: "limit_reached",
        message: `Has alcanzado el límite de ${monthlyLimit} consultas mensuales`,
        usageData: { queriesUsed, queriesRemaining: 0, usagePercentage: 100, monthlyLimit }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Success
    return new Response(JSON.stringify({
      canProceed: true,
      reason: (subscriptionTier === "Básico" && usagePercentage >= 90) ? "warning_90" : "ok",
      message: (subscriptionTier === "Básico" && usagePercentage >= 90) ? `Has usado ${queriesUsed} de ${monthlyLimit} consultas` : undefined,
      usageData: { queriesUsed, queriesRemaining, usagePercentage, monthlyLimit }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error('💥 handleCheckLimit error:', error);
    return new Response(JSON.stringify({
      canProceed: false,
      reason: "error",
      message: "Error al verificar límite"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function handleLogQuery(supabase: any, userId: string, queryText: string, responseLength: number) {
  console.log('📝 LOG_QUERY - User:', userId);
  
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    // Log query
    await supabase
      .from("query_logs")
      .insert({
        user_id: userId,
        query_text: queryText?.substring(0, 500) || '',
        response_length: responseLength || 0,
        month_year: currentMonth
      });

    // Update usage
    const { data: currentUsage } = await supabase
      .from("user_usage")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (currentUsage) {
      const newQueriesThisMonth = (currentUsage.queries_this_month || 0) + 1;
      const newTotalQueries = (currentUsage.total_queries || 0) + 1;
      
      let monthlyLimit;
      if (currentUsage.is_demo_user) {
        monthlyLimit = 3;
      } else {
        monthlyLimit = currentUsage.subscription_tier === "Básico" ? 100 : 3000;
      }
      
      const newQueriesRemaining = Math.max(0, monthlyLimit - newQueriesThisMonth);
      const newUsagePercentage = (newQueriesThisMonth / monthlyLimit) * 100;
      
      await supabase
        .from("user_usage")
        .update({
          queries_this_month: newQueriesThisMonth,
          queries_remaining_this_month: newQueriesRemaining,
          usage_percentage: newUsagePercentage,
          total_queries: newTotalQueries,
        })
        .eq("user_id", userId);
    }
    
    console.log('✅ Query logged');
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('💥 handleLogQuery error:', error);
    return new Response(JSON.stringify({ 
      error: "Query logging failed" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function handleGetUsage(supabase: any, userId: string) {
  console.log('📊 GET_USAGE - User:', userId);
  
  try {
    const { data: usage, error } = await supabase
      .from("user_usage")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      throw error;
    }

    console.log('✅ Usage retrieved');
    return new Response(JSON.stringify(usage || {}), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('💥 handleGetUsage error:', error);
    return new Response(JSON.stringify({ 
      error: "Usage data fetch failed" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
