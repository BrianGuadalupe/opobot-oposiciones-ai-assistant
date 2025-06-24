
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log('🚀 MANAGE-USAGE START');
  
  if (req.method === "OPTIONS") {
    console.log('✅ OPTIONS request handled');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action } = await req.json();
    console.log('📦 Action received:', action);
    
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.log('❌ No authorization header');
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Create Supabase client with service role for database operations
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get user from token
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) {
      console.log('❌ Authentication failed:', userError?.message);
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = userData.user;
    console.log('✅ User authenticated:', user.id);

    if (action === 'check_limit') {
      console.log('🔍 Checking usage limits...');
      
      // Get user usage data
      const { data: usageData, error: usageError } = await supabaseClient
        .from('user_usage')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (usageError) {
        console.log('❌ Error fetching usage data:', usageError.message);
        
        // If no usage record exists, create one based on subscriber data
        const { data: subscriberData } = await supabaseClient
          .from('subscribers')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (subscriberData) {
          console.log('🔄 Creating usage record from subscriber data...');
          
          const limit = subscriberData.subscribed && subscriberData.subscription_tier 
            ? getSubscriptionLimit(subscriberData.subscription_tier)
            : 0;

          const { data: newUsageData, error: insertError } = await supabaseClient
            .from('user_usage')
            .insert({
              user_id: user.id,
              email: user.email || subscriberData.email,
              is_active: subscriberData.subscribed,
              subscription_tier: subscriberData.subscription_tier,
              queries_remaining_this_month: limit,
              is_demo_user: false
            })
            .select()
            .single();

          if (insertError) {
            console.log('❌ Error creating usage record:', insertError.message);
            throw new Error('Could not create usage record');
          }

          const response = {
            canProceed: newUsageData.queries_remaining_this_month > 0,
            reason: newUsageData.queries_remaining_this_month > 0 ? "ok" : "limit_exceeded",
            message: newUsageData.queries_remaining_this_month > 0 
              ? "Consulta permitida" 
              : "Has alcanzado tu límite mensual",
            usageData: {
              queriesUsed: newUsageData.queries_this_month,
              queriesRemaining: newUsageData.queries_remaining_this_month,
              usagePercentage: newUsageData.usage_percentage,
              monthlyLimit: getSubscriptionLimit(newUsageData.subscription_tier || "")
            }
          };

          console.log('✅ Returning new usage data:', response);
          return new Response(JSON.stringify(response), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        throw new Error('No usage or subscription data found');
      }

      console.log('📊 Usage data found:', usageData);

      const response = {
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
      };

      console.log('✅ Returning response:', response);
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === 'log_query') {
      console.log('📝 Logging query...');
      // This would be implemented for actual query logging
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log('❌ Unknown action:', action);
    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("💥 Error in manage-usage:", error);
    
    return new Response(JSON.stringify({ 
      error: error.message || "Internal server error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getSubscriptionLimit(tier: string): number {
  switch (tier) {
    case 'Básico': return 100;
    case 'Profesional': return 3000;
    case 'Academias': return 10000;
    default: return 0;
  }
}
