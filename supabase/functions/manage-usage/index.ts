
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Ultra-aggressive timeout utility - max 3 seconds for ANY operation
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

serve(async (req) => {
  console.log('🚀 MANAGE-USAGE START');
  const startTime = Date.now();
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // STEP 1: Parse body with 1s timeout
    console.log('📦 Parsing request body...');
    const body = await withTimeout(req.json(), 1000);
    const { action } = body;
    console.log('✅ Action:', action);
    
    // STEP 2: Quick auth check
    console.log('🔐 Checking auth...');
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
    console.log('✅ Token extracted, length:', token.length);

    // STEP 3: Initialize Supabase client
    console.log('🔧 Creating Supabase client...');
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // STEP 4: Get user with 2s timeout
    console.log('👤 Getting user...');
    const userResult = await withTimeout(
      supabaseClient.auth.getUser(token),
      2000
    );
    
    if (userResult.error || !userResult.data?.user?.email) {
      console.log('❌ User auth failed:', userResult.error?.message);
      return new Response(JSON.stringify({ 
        error: "User authentication failed" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = userResult.data.user;
    console.log('✅ User authenticated:', user.id);

    // STEP 5: Route to handlers with immediate return
    console.log('🔀 Routing action:', action);
    
    if (action === "check_limit") {
      return await handleCheckLimit(supabaseClient, user.id);
    } else if (action === "log_query") {
      return await handleLogQuery(supabaseClient, user.id, body.queryText, body.responseLength);
    } else if (action === "get_usage") {
      return await handleGetUsage(supabaseClient, user.id);
    } else {
      console.log('❌ Invalid action:', action);
      return new Response(JSON.stringify({ 
        error: "Invalid action" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error("💥 CRITICAL ERROR:", error.message);
    console.error("⏱️ Execution time:", executionTime, "ms");
    
    return new Response(JSON.stringify({ 
      error: error.message || "Internal server error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleCheckLimit(supabase: any, userId: string) {
  console.log('🔍 CHECK_LIMIT START - User:', userId);
  
  try {
    // SINGLE query with 2s timeout - get everything we need
    console.log('📊 Fetching user usage...');
    const usageResult = await withTimeout(
      supabase
        .from("user_usage")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      2000
    );

    if (usageResult.error) {
      console.error('❌ Usage query error:', usageResult.error);
      return new Response(JSON.stringify({
        canProceed: false,
        reason: "error",
        message: "Error al verificar límite"
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const usage = usageResult.data;
    if (!usage) {
      console.log('❌ No usage record');
      return new Response(JSON.stringify({ 
        canProceed: false, 
        reason: "no_usage_record",
        message: "No se encontró registro de uso"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log('✅ Usage found:', usage.is_demo_user ? 'DEMO' : 'SUBSCRIPTION');

    // Quick demo user check
    if (usage.is_demo_user) {
      const queriesUsed = usage.queries_this_month || 0;
      const queriesRemaining = usage.queries_remaining_this_month || 0;
      const usagePercentage = (queriesUsed / 3) * 100;

      console.log('👤 Demo user - Used:', queriesUsed, 'Remaining:', queriesRemaining);

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

    // Quick subscription check with 2s timeout
    console.log('🔍 Checking subscription...');
    const subscriberResult = await withTimeout(
      supabase
        .from("subscribers")
        .select("subscribed, subscription_tier")
        .eq("user_id", userId)
        .maybeSingle(),
      2000
    );

    if (subscriberResult.error) {
      console.error('❌ Subscriber query error:', subscriberResult.error);
      return new Response(JSON.stringify({
        canProceed: false,
        reason: "error",
        message: "Error al verificar suscripción"
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subscriber = subscriberResult.data;
    if (!subscriber?.subscribed) {
      console.log('❌ No active subscription');
      return new Response(JSON.stringify({ 
        canProceed: false, 
        reason: "no_subscription",
        message: "Necesitas una suscripción activa"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process subscription limits
    const subscriptionTier = subscriber.subscription_tier || "Básico";
    const monthlyLimit = getMonthlyLimit(subscriptionTier);
    const queriesUsed = usage.queries_this_month || 0;
    const queriesRemaining = usage.queries_remaining_this_month || 0;
    const usagePercentage = (queriesUsed / monthlyLimit) * 100;

    console.log('✅ Subscription user - Tier:', subscriptionTier, 'Used:', queriesUsed, 'Limit:', monthlyLimit);

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

    // Success response
    return new Response(JSON.stringify({
      canProceed: true,
      reason: (subscriptionTier === "Básico" && usagePercentage >= 90) ? "warning_90" : "ok",
      message: (subscriptionTier === "Básico" && usagePercentage >= 90) ? `Has usado ${queriesUsed} de ${monthlyLimit} consultas` : undefined,
      usageData: { queriesUsed, queriesRemaining, usagePercentage, monthlyLimit }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error('💥 handleCheckLimit error:', error.message);
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
  console.log('📝 LOG_QUERY START - User:', userId);
  
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    // Log query with 2s timeout
    console.log('📝 Inserting query log...');
    await withTimeout(
      supabase
        .from("query_logs")
        .insert({
          user_id: userId,
          query_text: queryText?.substring(0, 500) || '',
          response_length: responseLength || 0,
          month_year: currentMonth
        }),
      2000
    );

    // Update usage with 2s timeout
    console.log('📊 Updating usage...');
    const usageResult = await withTimeout(
      supabase
        .from("user_usage")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      2000
    );

    if (usageResult.data) {
      const currentUsage = usageResult.data;
      const newQueriesThisMonth = (currentUsage.queries_this_month || 0) + 1;
      const newTotalQueries = (currentUsage.total_queries || 0) + 1;
      
      let monthlyLimit;
      if (currentUsage.is_demo_user) {
        monthlyLimit = 3;
      } else {
        monthlyLimit = getMonthlyLimit(currentUsage.subscription_tier);
      }
      
      const newQueriesRemaining = Math.max(0, monthlyLimit - newQueriesThisMonth);
      const newUsagePercentage = (newQueriesThisMonth / monthlyLimit) * 100;
      
      console.log('📊 Updating usage counts...');
      await withTimeout(
        supabase
          .from("user_usage")
          .update({
            queries_this_month: newQueriesThisMonth,
            queries_remaining_this_month: newQueriesRemaining,
            usage_percentage: newUsagePercentage,
            total_queries: newTotalQueries,
          })
          .eq("user_id", userId),
        2000
      );
    }
    
    console.log('✅ Query logged successfully');
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('💥 handleLogQuery error:', error.message);
    return new Response(JSON.stringify({ 
      error: "Query logging failed" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function handleGetUsage(supabase: any, userId: string) {
  console.log('📊 GET_USAGE START - User:', userId);
  
  try {
    console.log('📊 Fetching usage data...');
    const usageResult = await withTimeout(
      supabase
        .from("user_usage")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      2000
    );

    if (usageResult.error) {
      throw usageResult.error;
    }

    console.log('✅ Usage data retrieved');
    return new Response(JSON.stringify(usageResult.data || {}), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('💥 handleGetUsage error:', error.message);
    return new Response(JSON.stringify({ 
      error: "Usage data fetch failed" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

function getMonthlyLimit(tier: string): number {
  switch (tier) {
    case "Demo": return 3;
    case "Básico": return 100;
    case "Profesional": return 3000;
    default: return 0;
  }
}
