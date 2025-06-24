
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Quick timeout utility
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timeout after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

serve(async (req) => {
  console.log('🚀 MANAGE-USAGE Function started');
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    // Quick body parsing with timeout
    const body = await withTimeout(req.json(), 2000);
    const { action } = body;
    
    console.log('📦 Request body received:', { action });
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Quick auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ 
        error: "Authentication required" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const token = authHeader.replace("Bearer ", "");
    
    // Fast user auth with timeout
    const userResult = await withTimeout(
      supabaseClient.auth.getUser(token),
      3000
    );
    
    if (userResult.error || !userResult.data?.user?.email) {
      return new Response(JSON.stringify({ 
        error: "User authentication failed" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = userResult.data.user;
    console.log('👤 Authenticated user:', user.id);

    // Route to specific handlers with early returns
    switch (action) {
      case "check_limit":
        return await handleCheckLimit(supabaseClient, user.id);
      case "log_query":
        return await handleLogQuery(supabaseClient, user.id, body.queryText, body.responseLength);
      case "get_usage":
        return await handleGetUsage(supabaseClient, user.id);
      case "check_demo_availability":
        return await handleCheckDemoAvailability(supabaseClient, body.userIp, user.email);
      case "register_demo":
        return await handleRegisterDemo(supabaseClient, body.userIp, user);
      default:
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
  console.log('🔍 handleCheckLimit - Starting for user:', userId);
  
  try {
    // Single optimized query with timeout
    const usageResult = await withTimeout(
      supabase
        .from("user_usage")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      4000
    );

    if (usageResult.error) {
      console.error('❌ Usage query error:', usageResult.error);
      return new Response(JSON.stringify({
        canProceed: false,
        reason: "error",
        message: "Error al verificar límite de consultas"
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const usage = usageResult.data;
    if (!usage) {
      console.log('❌ No usage record found');
      return new Response(JSON.stringify({ 
        canProceed: false, 
        reason: "no_usage_record",
        message: "No se encontró registro de uso"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process demo users quickly
    if (usage.is_demo_user) {
      console.log('👤 Processing demo user');
      const queriesUsed = usage.queries_this_month;
      const queriesRemaining = usage.queries_remaining_this_month;
      const usagePercentage = (queriesUsed / 3) * 100;

      if (queriesUsed >= 3) {
        return new Response(JSON.stringify({
          canProceed: false,
          reason: "demo_limit_reached",
          message: "Has alcanzado el límite de 3 consultas del Demo. Suscríbete para continuar.",
          usageData: { queriesUsed, queriesRemaining: 0, usagePercentage: 100, monthlyLimit: 3 }
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        canProceed: true,
        reason: usagePercentage >= 90 ? "demo_warning_90" : "ok",
        message: usagePercentage >= 90 ? `Has usado ${queriesUsed} de 3 consultas del Demo (${usagePercentage.toFixed(1)}%)` : undefined,
        usageData: { queriesUsed, queriesRemaining, usagePercentage, monthlyLimit: 3 }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check subscription for non-demo users
    const subscriberResult = await withTimeout(
      supabase
        .from("subscribers")
        .select("subscribed, subscription_tier")
        .eq("user_id", userId)
        .maybeSingle(),
      3000
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
      return new Response(JSON.stringify({ 
        canProceed: false, 
        reason: "no_subscription",
        message: "Necesitas una suscripción activa para usar el chat"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process subscription users
    const subscriptionTier = subscriber.subscription_tier || "Básico";
    const monthlyLimit = getMonthlyLimit(subscriptionTier);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const usageMonth = new Date(usage.current_period_start).toISOString().slice(0, 7);
    
    let currentUsage = usage;

    // Reset usage if new month (with timeout)
    if (usageMonth !== currentMonth) {
      console.log('🔄 Resetting usage for new month');
      const updateResult = await withTimeout(
        supabase
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
          .maybeSingle(),
        3000
      );
      
      if (updateResult.data) {
        currentUsage = updateResult.data;
      }
    }

    const queriesUsed = currentUsage.queries_this_month;
    const queriesRemaining = currentUsage.queries_remaining_this_month;
    const usagePercentage = (queriesUsed / monthlyLimit) * 100;

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

    // Return success with usage data
    return new Response(JSON.stringify({
      canProceed: true,
      reason: (subscriptionTier === "Básico" && usagePercentage >= 90) ? "warning_90" : "ok",
      message: (subscriptionTier === "Básico" && usagePercentage >= 90) ? `Has usado ${queriesUsed} de ${monthlyLimit} consultas mensuales (${usagePercentage.toFixed(1)}%)` : undefined,
      usageData: { queriesUsed, queriesRemaining, usagePercentage, monthlyLimit }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error('💥 handleCheckLimit error:', error.message);
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

async function handleLogQuery(supabase: any, userId: string, queryText: string, responseLength: number) {
  console.log('📝 handleLogQuery - Starting for user:', userId);
  
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    // Log query with timeout
    await withTimeout(
      supabase
        .from("query_logs")
        .insert({
          user_id: userId,
          query_text: queryText?.substring(0, 500) || '',
          response_length: responseLength || 0,
          month_year: currentMonth
        }),
      3000
    );

    // Update usage with timeout
    const usageResult = await withTimeout(
      supabase
        .from("user_usage")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      3000
    );

    if (usageResult.data) {
      const currentUsage = usageResult.data;
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
        3000
      );
    }
    
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
  console.log('📊 handleGetUsage - Starting for user:', userId);
  
  try {
    const usageResult = await withTimeout(
      supabase
        .from("user_usage")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      3000
    );

    if (usageResult.error) {
      throw usageResult.error;
    }

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

async function handleCheckDemoAvailability(supabase: any, userIp: string, email: string) {
  try {
    const canRegisterResult = await withTimeout(
      supabase.rpc('can_register_demo', { 
        check_ip: userIp,
        check_email: email
      }),
      3000
    );
    
    if (canRegisterResult.error) {
      throw canRegisterResult.error;
    }
    
    const canRegister = canRegisterResult.data;
    
    if (!canRegister) {
      const emailDemoResult = await withTimeout(
        supabase
          .from("demo_registrations")
          .select("id")
          .eq("email", email)
          .maybeSingle(),
        2000
      );

      if (emailDemoResult.data) {
        return new Response(JSON.stringify({ 
          canRegister: false, 
          reason: 'email_already_used' 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        return new Response(JSON.stringify({ 
          canRegister: false, 
          reason: 'ip_limit_reached' 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ canRegister: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('💥 handleCheckDemoAvailability error:', error.message);
    return new Response(JSON.stringify({ 
      canRegister: false, 
      reason: 'error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function handleRegisterDemo(supabase: any, userIp: string, user: any) {
  try {
    const canRegisterResult = await withTimeout(
      supabase.rpc('can_register_demo', { 
        check_ip: userIp,
        check_email: user.email
      }),
      3000
    );
    
    if (!canRegisterResult.data) {
      return new Response(JSON.stringify({ 
        error: "Demo registration no longer available" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await withTimeout(
      supabase
        .from("demo_registrations")
        .insert({
          user_id: user.id,
          email: user.email,
          ip_address: userIp
        }),
      3000
    );

    await withTimeout(
      supabase
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
        }),
      3000
    );

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('💥 handleRegisterDemo error:', error.message);
    return new Response(JSON.stringify({ 
      error: "Demo registration failed" 
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
