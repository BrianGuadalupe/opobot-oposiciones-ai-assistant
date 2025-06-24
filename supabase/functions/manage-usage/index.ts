
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log('🚀 MANAGE-USAGE START');
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse body FIRST - this might be hanging
    console.log('📦 Parsing request body...');
    const body = await req.json().catch(() => ({}));
    const { action } = body;
    console.log('📦 Action:', action);
    
    // Auth check SECOND
    console.log('🔐 Checking auth header...');
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

    // Create Supabase client THIRD
    console.log('🔧 Creating Supabase client...');
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get user FOURTH
    console.log('👤 Getting user...');
    const userResult = await supabaseClient.auth.getUser(token);
    
    if (userResult.error || !userResult.data?.user?.id) {
      console.log('❌ User auth failed:', userResult.error?.message);
      return new Response(JSON.stringify({ 
        error: "User authentication failed" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userResult.data.user.id;
    console.log('✅ User authenticated:', userId.substring(0, 8) + '...');

    // Route actions FIFTH
    if (action === "check_limit") {
      console.log('🔍 Starting check_limit handler...');
      return await handleCheckLimit(supabaseClient, userId);
    } else if (action === "log_query") {
      console.log('📝 Starting log_query handler...');
      return await handleLogQuery(supabaseClient, userId, body.queryText, body.responseLength);
    } else if (action === "get_usage") {
      console.log('📊 Starting get_usage handler...');
      return await handleGetUsage(supabaseClient, userId);
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
    console.error("💥 GLOBAL ERROR:", error);
    
    return new Response(JSON.stringify({ 
      error: "Internal server error",
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleCheckLimit(supabase: any, userId: string) {
  console.log('🔍 CHECK_LIMIT START for user:', userId.substring(0, 8) + '...');
  
  try {
    console.log('📊 About to query user_usage...');
    
    // ULTRA SIMPLE query - just get what we need
    const { data: usage, error: usageError } = await supabase
      .from("user_usage")
      .select("is_demo_user, queries_this_month, queries_remaining_this_month, subscription_tier")
      .eq("user_id", userId)
      .single();

    console.log('📊 Usage query completed. Error:', usageError?.message, 'Data exists:', !!usage);

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

    console.log('✅ Usage data retrieved successfully');

    // Demo user check FIRST
    if (usage.is_demo_user) {
      const queriesUsed = usage.queries_this_month || 0;
      const queriesRemaining = usage.queries_remaining_this_month || 0;
      const usagePercentage = (queriesUsed / 3) * 100;

      console.log('👤 Demo user - Used:', queriesUsed, 'Remaining:', queriesRemaining);

      if (queriesUsed >= 3) {
        console.log('🚫 Demo limit reached');
        return new Response(JSON.stringify({
          canProceed: false,
          reason: "demo_limit_reached",
          message: "Has alcanzado el límite de 3 consultas del Demo",
          usageData: { queriesUsed, queriesRemaining: 0, usagePercentage: 100, monthlyLimit: 3 }
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log('✅ Demo user can proceed');
      return new Response(JSON.stringify({
        canProceed: true,
        reason: usagePercentage >= 90 ? "demo_warning_90" : "ok",
        message: usagePercentage >= 90 ? `Has usado ${queriesUsed} de 3 consultas` : undefined,
        usageData: { queriesUsed, queriesRemaining, usagePercentage, monthlyLimit: 3 }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Regular subscription user
    console.log('🔍 Checking subscription for regular user...');
    const { data: subscriber, error: subError } = await supabase
      .from("subscribers")
      .select("subscribed, subscription_tier")
      .eq("user_id", userId)
      .single();

    console.log('📊 Subscriber query completed. Error:', subError?.message, 'Subscribed:', subscriber?.subscribed);

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

    // Calculate limits for subscription
    const subscriptionTier = subscriber.subscription_tier || "Básico";
    const monthlyLimit = subscriptionTier === "Básico" ? 100 : 3000;
    const queriesUsed = usage.queries_this_month || 0;
    const queriesRemaining = usage.queries_remaining_this_month || 0;
    const usagePercentage = (queriesUsed / monthlyLimit) * 100;

    console.log('✅ Subscription check complete - Tier:', subscriptionTier, 'Used:', queriesUsed, 'Limit:', monthlyLimit);

    // Check limits
    if (queriesUsed >= monthlyLimit) {
      console.log('🚫 Monthly limit reached');
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
    console.log('✅ Check limit completed successfully');
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
      message: "Error al verificar límite: " + error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function handleLogQuery(supabase: any, userId: string, queryText: string, responseLength: number) {
  console.log('📝 LOG_QUERY START for user:', userId.substring(0, 8) + '...');
  
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    // Log query
    console.log('📝 Inserting query log...');
    await supabase
      .from("query_logs")
      .insert({
        user_id: userId,
        query_text: queryText?.substring(0, 500) || '',
        response_length: responseLength || 0,
        month_year: currentMonth
      });

    console.log('📊 Getting current usage...');
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
      
      console.log('📊 Updating usage...');
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
    
    console.log('✅ Query logged successfully');
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('💥 handleLogQuery error:', error);
    return new Response(JSON.stringify({ 
      error: "Query logging failed: " + error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function handleGetUsage(supabase: any, userId: string) {
  console.log('📊 GET_USAGE START for user:', userId.substring(0, 8) + '...');
  
  try {
    const { data: usage, error } = await supabase
      .from("user_usage")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      throw error;
    }

    console.log('✅ Usage retrieved successfully');
    return new Response(JSON.stringify(usage || {}), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('💥 handleGetUsage error:', error);
    return new Response(JSON.stringify({ 
      error: "Usage data fetch failed: " + error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
