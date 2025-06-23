
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log('🧠 MANAGE-USAGE Function started');
  console.log('📋 Request method:', req.method);
  
  if (req.method === "OPTIONS") {
    console.log('⚙️ Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

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

    if (action === "check_demo_availability") {
      console.log('🔍 Checking demo availability...');
      console.log('⏳ Calling can_register_demo RPC...');
      
      const { data: canRegister } = await supabaseClient.rpc('can_register_demo', { 
        check_ip: userIp,
        check_email: user.email
      });
      
      console.log('✅ Demo availability check completed:', canRegister);
      
      if (!canRegister) {
        console.log('🔍 Checking specific reason for demo unavailability...');
        const { data: emailDemo } = await supabaseClient
          .from("demo_registrations")
          .select("id")
          .eq("email", user.email)
          .single();

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
    }

    if (action === "register_demo") {
      console.log('📝 Registering demo user...');
      console.log('⏳ Re-checking demo availability...');
      
      const { data: canRegister } = await supabaseClient.rpc('can_register_demo', { 
        check_ip: userIp,
        check_email: user.email
      });
      
      console.log('✅ Demo re-check completed:', canRegister);
      
      if (!canRegister) {
        console.log('❌ Demo registration no longer available');
        const { data: emailDemo } = await supabaseClient
          .from("demo_registrations")
          .select("id")
          .eq("email", user.email)
          .single();

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
      await supabaseClient
        .from("demo_registrations")
        .insert({
          user_id: user.id,
          email: user.email,
          ip_address: userIp
        });

      console.log('⏳ Creating user usage record...');
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

      console.log('✅ Demo registration completed successfully');
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "check_limit") {
      console.log('📊 Checking query limits...');
      console.log('⏳ Calling checkQueryLimit function...');
      
      const canProceed = await checkQueryLimit(supabaseClient, user.id, user.email);
      console.log('✅ Query limit check completed');
      
      return new Response(JSON.stringify(canProceed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "log_query") {
      console.log('📝 Logging query...');
      console.log('⏳ Calling logQuery function...');
      
      await logQuery(supabaseClient, user.id, user.email, queryText, responseLength);
      console.log('✅ Query logged successfully');
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_usage") {
      console.log('📊 Getting usage statistics...');
      console.log('⏳ Calling getUserUsage function...');
      
      const usage = await getUserUsage(supabaseClient, user.id);
      console.log('✅ Usage statistics retrieved');
      
      return new Response(JSON.stringify(usage), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log('❌ Invalid action received:', action);
    return new Response(JSON.stringify({ 
      error: "Invalid action" 
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("💥 CRITICAL ERROR in manage-usage function:", error);
    console.error("💥 Error stack:", error.stack);
    console.error("💥 Error message:", error.message);
    
    return new Response(JSON.stringify({ 
      error: error.message || "Internal server error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function checkQueryLimit(supabase: any, userId: string, email: string) {
  console.log('🔍 checkQueryLimit - Starting limit check for user:', userId);
  
  try {
    console.log('⏳ checkQueryLimit - Fetching user usage...');
    const { data: usage } = await supabase
      .from("user_usage")
      .select("*")
      .eq("user_id", userId)
      .single();

    console.log('✅ checkQueryLimit - User usage fetched');

    if (!usage) {
      console.log('❌ checkQueryLimit - No usage record found');
      return { 
        canProceed: false, 
        reason: "no_usage_record",
        message: "No se encontró registro de uso"
      };
    }

    // Si es usuario demo
    if (usage.is_demo_user) {
      console.log('👤 checkQueryLimit - Processing demo user');
      const queriesUsed = usage.queries_this_month;
      const queriesRemaining = usage.queries_remaining_this_month;
      const usagePercentage = (queriesUsed / 3) * 100;

      if (queriesUsed >= 3) {
        console.log('🚫 checkQueryLimit - Demo limit reached');
        return {
          canProceed: false,
          reason: "demo_limit_reached",
          message: "Has alcanzado el límite de 3 consultas del Demo. Suscríbete para continuar.",
          usageData: { queriesUsed, queriesRemaining: 0, usagePercentage: 100, monthlyLimit: 3 }
        };
      }

      if (usagePercentage >= 90) {
        console.log('⚠️ checkQueryLimit - Demo warning threshold reached');
        return {
          canProceed: true,
          reason: "demo_warning_90",
          message: `Has usado ${queriesUsed} de 3 consultas del Demo (${usagePercentage.toFixed(1)}%)`,
          usageData: { queriesUsed, queriesRemaining, usagePercentage, monthlyLimit: 3 }
        };
      }

      console.log('✅ checkQueryLimit - Demo user can proceed');
      return {
        canProceed: true,
        reason: "ok",
        usageData: { queriesUsed, queriesRemaining, usagePercentage, monthlyLimit: 3 }
      };
    }

    // Para usuarios con suscripción
    console.log('⏳ checkQueryLimit - Fetching subscriber info...');
    const { data: subscriber } = await supabase
      .from("subscribers")
      .select("subscribed, subscription_tier")
      .eq("user_id", userId)
      .single();

    console.log('✅ checkQueryLimit - Subscriber info fetched');

    if (!subscriber?.subscribed) {
      console.log('❌ checkQueryLimit - No active subscription');
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
      console.log('🔄 checkQueryLimit - Resetting usage for new month');
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
      console.log('✅ checkQueryLimit - Usage reset completed');
    }

    const queriesUsed = currentUsage.queries_this_month;
    const queriesRemaining = currentUsage.queries_remaining_this_month;
    const usagePercentage = (queriesUsed / monthlyLimit) * 100;

    // Verificar límites
    if (subscriptionTier === "Profesional") {
      if (queriesUsed >= monthlyLimit) {
        console.log('🚫 checkQueryLimit - Professional plan limit reached');
        return {
          canProceed: false,
          reason: "limit_reached",
          message: "Has alcanzado el límite de consultas mensuales",
          usageData: { queriesUsed, queriesRemaining: 0, usagePercentage: 100, monthlyLimit }
        };
      }
    } else {
      // Plan Básico
      if (queriesUsed >= monthlyLimit) {
        console.log('🚫 checkQueryLimit - Basic plan limit reached');
        return {
          canProceed: false,
          reason: "limit_reached",
          message: "Has alcanzado el límite de 100 consultas mensuales del Plan Básico",
          usageData: { queriesUsed, queriesRemaining: 0, usagePercentage: 100, monthlyLimit }
        };
      }
      
      if (usagePercentage >= 90) {
        console.log('⚠️ checkQueryLimit - Basic plan warning threshold reached');
        return {
          canProceed: true,
          reason: "warning_90",
          message: `Has usado ${queriesUsed} de ${monthlyLimit} consultas mensuales (${usagePercentage.toFixed(1)}%)`,
          usageData: { queriesUsed, queriesRemaining, usagePercentage, monthlyLimit }
        };
      }
    }

    console.log('✅ checkQueryLimit - User can proceed');
    return {
      canProceed: true,
      reason: "ok",
      usageData: { queriesUsed, queriesRemaining, usagePercentage, monthlyLimit }
    };
    
  } catch (error) {
    console.error('💥 checkQueryLimit - Error:', error);
    return {
      canProceed: false,
      reason: "error",
      message: "Error al verificar límite de consultas"
    };
  }
}

async function logQuery(supabase: any, userId: string, email: string, queryText: string, responseLength: number) {
  console.log('📝 logQuery - Starting query logging for user:', userId);
  
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    console.log('⏳ logQuery - Inserting query log...');
    await supabase
      .from("query_logs")
      .insert({
        user_id: userId,
        query_text: queryText.substring(0, 500),
        response_length: responseLength,
        month_year: currentMonth
      });

    console.log('⏳ logQuery - Fetching current usage...');
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
      
      console.log('⏳ logQuery - Calculating historical stats...');
      const { data: monthsActive } = await supabase
        .from("query_logs")
        .select("month_year")
        .eq("user_id", userId);
      
      const uniqueMonths = new Set(monthsActive?.map(m => m.month_year) || []).size;
      const queriesPerMonth = uniqueMonths > 0 ? newTotalQueries / uniqueMonths : newTotalQueries;

      console.log('⏳ logQuery - Updating usage statistics...');
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
    
    console.log('✅ logQuery - Query logging completed successfully');
  } catch (error) {
    console.error('💥 logQuery - Error:', error);
    throw error;
  }
}

async function getUserUsage(supabase: any, userId: string) {
  console.log('📊 getUserUsage - Fetching usage for user:', userId);
  
  try {
    const { data: usage } = await supabase
      .from("user_usage")
      .select("*")
      .eq("user_id", userId)
      .single();

    console.log('✅ getUserUsage - Usage data retrieved');
    return usage || null;
  } catch (error) {
    console.error('💥 getUserUsage - Error:', error);
    return null;
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
