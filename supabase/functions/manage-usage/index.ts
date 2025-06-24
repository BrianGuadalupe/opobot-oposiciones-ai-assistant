
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log('🚀 MANAGE-USAGE Function started');
  console.log('📋 Request method:', req.method);
  
  if (req.method === "OPTIONS") {
    console.log('⚙️ Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    console.log('📥 Reading request body...');
    const requestBody = await req.json();
    console.log('📦 Request body received:', { action: requestBody.action });
    
    const { action, queryText, responseLength, userIp } = requestBody;
    
    console.log('🔧 Creating Supabase client...');
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    console.log('🔐 Checking authorization header...');
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log('❌ Missing or invalid authorization header');
      return new Response(JSON.stringify({ 
        error: "Authentication required" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log('🔍 Extracting and validating user token...');
    const token = authHeader.replace("Bearer ", "");
    console.log('⏳ Calling supabase.auth.getUser...');
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    console.log('✅ User auth check completed');
    
    if (userError || !userData.user?.email) {
      console.log('❌ User authentication failed:', userError?.message || 'No user email');
      return new Response(JSON.stringify({ 
        error: "User authentication failed" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = userData.user;
    console.log('👤 Authenticated user:', user.id);

    // Handle different actions with early returns to avoid hanging
    if (action === "check_demo_availability") {
      console.log('🔍 Processing check_demo_availability...');
      return await handleCheckDemoAvailability(supabaseClient, userIp, user.email);
    }

    if (action === "register_demo") {
      console.log('📝 Processing register_demo...');
      return await handleRegisterDemo(supabaseClient, userIp, user);
    }

    if (action === "check_limit") {
      console.log('📊 Processing check_limit...');
      return await handleCheckLimit(supabaseClient, user.id, user.email);
    }

    if (action === "log_query") {
      console.log('📝 Processing log_query...');
      return await handleLogQuery(supabaseClient, user.id, user.email, queryText, responseLength);
    }

    if (action === "get_usage") {
      console.log('📊 Processing get_usage...');
      return await handleGetUsage(supabaseClient, user.id);
    }

    console.log('❌ Invalid action received:', action);
    return new Response(JSON.stringify({ 
      error: "Invalid action" 
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error("💥 CRITICAL ERROR in manage-usage function:", error);
    console.error("💥 Error stack:", error.stack);
    console.error("💥 Error message:", error.message);
    console.error("⏱️ Execution time before error:", executionTime, "ms");
    
    return new Response(JSON.stringify({ 
      error: error.message || "Internal server error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleCheckDemoAvailability(supabase: any, userIp: string, email: string) {
  try {
    console.log('🔍 Checking demo availability...');
    console.log('⏳ Calling can_register_demo RPC...');
    
    const { data: canRegister } = await supabase.rpc('can_register_demo', { 
      check_ip: userIp,
      check_email: email
    });
    
    console.log('✅ Demo availability check completed:', canRegister);
    
    if (!canRegister) {
      console.log('🔍 Checking specific reason for demo unavailability...');
      const { data: emailDemo } = await supabase
        .from("demo_registrations")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      console.log('📊 Email demo check result:', !!emailDemo);
      
      if (emailDemo) {
        console.log('📧 Email already used for demo');
        return new Response(JSON.stringify({ 
          canRegister: false, 
          reason: 'email_already_used' 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        console.log('🌐 IP limit reached');
        return new Response(JSON.stringify({ 
          canRegister: false, 
          reason: 'ip_limit_reached' 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log('✅ Demo registration available');
    return new Response(JSON.stringify({ canRegister: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('💥 Error in handleCheckDemoAvailability:', error);
    return new Response(JSON.stringify({ error: "Demo availability check failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function handleRegisterDemo(supabase: any, userIp: string, user: any) {
  try {
    console.log('📝 Registering demo user...');
    console.log('⏳ Re-checking demo availability...');
    
    const { data: canRegister } = await supabase.rpc('can_register_demo', { 
      check_ip: userIp,
      check_email: user.email
    });
    
    console.log('✅ Demo re-check completed:', canRegister);
    
    if (!canRegister) {
      console.log('❌ Demo registration no longer available');
      const { data: emailDemo } = await supabase
        .from("demo_registrations")
        .select("id")
        .eq("email", user.email)
        .maybeSingle();

      if (emailDemo) {
        console.log('📧 Email already has demo registered');
        return new Response(JSON.stringify({ 
          error: "Email already has demo registered" 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        console.log('🌐 IP limit reached for today');
        return new Response(JSON.stringify({ 
          error: "IP limit reached for today" 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log('⏳ Inserting demo registration...');
    await supabase
      .from("demo_registrations")
      .insert({
        user_id: user.id,
        email: user.email,
        ip_address: userIp
      });

    console.log('⏳ Creating user usage record...');
    await supabase
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

    console.log('✅ Demo registration completed successfully');
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('💥 Error in handleRegisterDemo:', error);
    return new Response(JSON.stringify({ error: "Demo registration failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function handleCheckLimit(supabase: any, userId: string, email: string) {
  console.log('🔍 handleCheckLimit - Starting limit check for user:', userId);
  
  try {
    console.log('⏳ handleCheckLimit - Fetching user usage...');
    const { data: usage, error: usageError } = await supabase
      .from("user_usage")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    console.log('✅ handleCheckLimit - User usage fetched');

    if (usageError) {
      console.error('❌ Error fetching usage:', usageError);
      return new Response(JSON.stringify({
        canProceed: false,
        reason: "error",
        message: "Error al verificar límite de consultas"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!usage) {
      console.log('❌ handleCheckLimit - No usage record found');
      return new Response(JSON.stringify({ 
        canProceed: false, 
        reason: "no_usage_record",
        message: "No se encontró registro de uso"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Si es usuario demo
    if (usage.is_demo_user) {
      console.log('👤 handleCheckLimit - Processing demo user');
      const queriesUsed = usage.queries_this_month;
      const queriesRemaining = usage.queries_remaining_this_month;
      const usagePercentage = (queriesUsed / 3) * 100;

      if (queriesUsed >= 3) {
        console.log('🚫 handleCheckLimit - Demo limit reached');
        return new Response(JSON.stringify({
          canProceed: false,
          reason: "demo_limit_reached",
          message: "Has alcanzado el límite de 3 consultas del Demo. Suscríbete para continuar.",
          usageData: { queriesUsed, queriesRemaining: 0, usagePercentage: 100, monthlyLimit: 3 }
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (usagePercentage >= 90) {
        console.log('⚠️ handleCheckLimit - Demo warning threshold reached');
        return new Response(JSON.stringify({
          canProceed: true,
          reason: "demo_warning_90",
          message: `Has usado ${queriesUsed} de 3 consultas del Demo (${usagePercentage.toFixed(1)}%)`,
          usageData: { queriesUsed, queriesRemaining, usagePercentage, monthlyLimit: 3 }
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log('✅ handleCheckLimit - Demo user can proceed');
      return new Response(JSON.stringify({
        canProceed: true,
        reason: "ok",
        usageData: { queriesUsed, queriesRemaining, usagePercentage, monthlyLimit: 3 }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Para usuarios con suscripción
    console.log('⏳ handleCheckLimit - Fetching subscriber info...');
    const { data: subscriber, error: subError } = await supabase
      .from("subscribers")
      .select("subscribed, subscription_tier")
      .eq("user_id", userId)
      .maybeSingle();

    console.log('✅ handleCheckLimit - Subscriber info fetched');

    if (subError) {
      console.error('❌ Error fetching subscriber:', subError);
      return new Response(JSON.stringify({
        canProceed: false,
        reason: "error",
        message: "Error al verificar suscripción"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!subscriber?.subscribed) {
      console.log('❌ handleCheckLimit - No active subscription');
      return new Response(JSON.stringify({ 
        canProceed: false, 
        reason: "no_subscription",
        message: "Necesitas una suscripción activa para usar el chat"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subscriptionTier = subscriber.subscription_tier || "Básico";
    const monthlyLimit = getMonthlyLimit(subscriptionTier);
    const currentMonth = new Date().toISOString().slice(0, 7);
    let currentUsage = usage;

    // Verificar si necesitamos resetear el mes
    const usageMonth = new Date(currentUsage.current_period_start).toISOString().slice(0, 7);
    
    if (usageMonth !== currentMonth) {
      console.log('🔄 handleCheckLimit - Resetting usage for new month');
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
        .maybeSingle();
      
      if (updatedUsage) {
        currentUsage = updatedUsage;
      }
      console.log('✅ handleCheckLimit - Usage reset completed');
    }

    const queriesUsed = currentUsage.queries_this_month;
    const queriesRemaining = currentUsage.queries_remaining_this_month;
    const usagePercentage = (queriesUsed / monthlyLimit) * 100;

    // Verificar límites
    if (queriesUsed >= monthlyLimit) {
      console.log('🚫 handleCheckLimit - Monthly limit reached');
      return new Response(JSON.stringify({
        canProceed: false,
        reason: "limit_reached",
        message: `Has alcanzado el límite de ${monthlyLimit} consultas mensuales`,
        usageData: { queriesUsed, queriesRemaining: 0, usagePercentage: 100, monthlyLimit }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    if (subscriptionTier === "Básico" && usagePercentage >= 90) {
      console.log('⚠️ handleCheckLimit - Basic plan warning threshold reached');
      return new Response(JSON.stringify({
        canProceed: true,
        reason: "warning_90",
        message: `Has usado ${queriesUsed} de ${monthlyLimit} consultas mensuales (${usagePercentage.toFixed(1)}%)`,
        usageData: { queriesUsed, queriesRemaining, usagePercentage, monthlyLimit }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log('✅ handleCheckLimit - User can proceed');
    return new Response(JSON.stringify({
      canProceed: true,
      reason: "ok",
      usageData: { queriesUsed, queriesRemaining, usagePercentage, monthlyLimit }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error('💥 handleCheckLimit - Error:', error);
    return new Response(JSON.stringify({
      canProceed: false,
      reason: "error",
      message: "Error al verificar límite de consultas"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function handleLogQuery(supabase: any, userId: string, email: string, queryText: string, responseLength: number) {
  console.log('📝 handleLogQuery - Starting query logging for user:', userId);
  
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    console.log('⏳ handleLogQuery - Inserting query log...');
    await supabase
      .from("query_logs")
      .insert({
        user_id: userId,
        query_text: queryText?.substring(0, 500) || '',
        response_length: responseLength || 0,
        month_year: currentMonth
      });

    console.log('⏳ handleLogQuery - Fetching current usage...');
    const { data: currentUsage } = await supabase
      .from("user_usage")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

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
      
      console.log('⏳ handleLogQuery - Updating usage statistics...');
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
    
    console.log('✅ handleLogQuery - Query logging completed successfully');
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('💥 handleLogQuery - Error:', error);
    return new Response(JSON.stringify({ error: "Query logging failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function handleGetUsage(supabase: any, userId: string) {
  console.log('📊 handleGetUsage - Fetching usage for user:', userId);
  
  try {
    const { data: usage, error } = await supabase
      .from("user_usage")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error('💥 handleGetUsage - Error:', error);
      return new Response(JSON.stringify({ error: "Usage data fetch failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log('✅ handleGetUsage - Usage data retrieved');
    return new Response(JSON.stringify(usage || {}), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('💥 handleGetUsage - Error:', error);
    return new Response(JSON.stringify({ error: "Usage data fetch failed" }), {
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
