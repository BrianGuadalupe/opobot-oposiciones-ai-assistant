
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
      let { data: usageData, error: usageError } = await supabase
        .from('user_usage')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!usageData) {
        console.log('🔄 Creating new user_usage record for user:', user.id);
        
        const { data: subData } = await supabase
          .from('subscribers')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        const limit = subData?.subscribed ? getSubscriptionLimit(subData.subscription_tier) : 0;
        
        console.log('📊 User subscription data:', {
          subscribed: subData?.subscribed,
          tier: subData?.subscription_tier,
          limit: limit
        });

        const { data: newUsage, error: insertError } = await supabase
          .from('user_usage')
          .insert({
            user_id: user.id,
            email: user.email || subData?.email,
            is_active: subData?.subscribed || false,
            subscription_tier: subData?.subscription_tier || null,
            queries_remaining_this_month: limit,
            queries_this_month: 0,
            total_queries: 0,
            usage_percentage: 0,
            is_demo_user: false
          })
          .select()
          .single();

        if (insertError) {
          console.error('❌ Error creating user_usage record:', insertError);
          return new Response(JSON.stringify({ 
            error: "Error creating usage record",
            details: insertError.message 
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        usageData = newUsage;
        console.log('✅ Created user_usage record:', usageData);
      }

      const canProceed = usageData.queries_remaining_this_month > 0;
      const reason = canProceed ? "ok" : "limit_exceeded";
      const message = canProceed 
        ? "Consulta permitida" 
        : "Has alcanzado tu límite de consultas para este período";

      const response = {
        canProceed,
        reason,
        message,
        usageData: {
          queriesUsed: usageData.queries_this_month || 0,
          queriesRemaining: usageData.queries_remaining_this_month || 0,
          usagePercentage: usageData.usage_percentage || 0,
          monthlyLimit: getSubscriptionLimit(usageData.subscription_tier || "")
        }
      };

      console.log('📊 Returning usage check result:', response);
      return new Response(JSON.stringify(response), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    if (action === 'log_query') {
      console.log('📝 Logging query for user:', user.id);
      
      const { data: currentUsage, error: fetchError } = await supabase
        .from('user_usage')
        .select('queries_this_month, queries_remaining_this_month, total_queries')
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        console.error('❌ Error fetching current usage:', fetchError);
        return new Response(JSON.stringify({ 
          error: "Error fetching usage data",
          details: fetchError.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Actualizar user_usage - el trigger calculará automáticamente el porcentaje
      const { error: updateError } = await supabase
        .from('user_usage')
        .update({
          queries_this_month: (currentUsage.queries_this_month || 0) + 1,
          queries_remaining_this_month: (currentUsage.queries_remaining_this_month || 0) - 1,
          total_queries: (currentUsage.total_queries || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('❌ Error updating usage:', updateError);
        return new Response(JSON.stringify({ 
          error: "Error updating usage",
          details: updateError.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: logError } = await supabase
        .from('query_logs')
        .insert({
          user_id: user.id,
          query_text: queryText,
          response_length: responseLength
        });

      if (logError) {
        console.error('❌ Error logging query:', logError);
      }

      console.log('✅ Query logged successfully');
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('💥 Error in manage-usage:', error);
    return new Response(JSON.stringify({ 
      error: error.message || "Internal server error",
      stack: error.stack 
    }), {
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
