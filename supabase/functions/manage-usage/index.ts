
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log('🚀 MANAGE-USAGE START');
  console.log('📅 Timestamp:', new Date().toISOString());
  console.log('🌐 Method:', req.method);
  
  if (req.method === "OPTIONS") {
    console.log('✅ OPTIONS request handled');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📖 Reading request body...');
    const requestBody = await req.json();
    const { action } = requestBody;
    console.log('📦 Action received:', action);
    console.log('📦 Full request body:', JSON.stringify(requestBody, null, 2));
    
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    console.log('🔐 Auth header present:', !!authHeader);
    console.log('🔐 Auth header format valid:', authHeader?.startsWith("Bearer "));
    
    if (!authHeader?.startsWith("Bearer ")) {
      console.log('❌ No authorization header');
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    console.log('🔐 Token length:', token.length);
    
    // Create Supabase client with service role for database operations
    console.log('🔧 Creating Supabase client...');
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    console.log('🔧 Supabase URL exists:', !!supabaseUrl);
    console.log('🔧 Service role key exists:', !!serviceRoleKey);
    
    const supabaseClient = createClient(
      supabaseUrl ?? "",
      serviceRoleKey ?? "",
      { auth: { persistSession: false } }
    );

    // Get user from token
    console.log('👤 Authenticating user...');
    const startAuthTime = Date.now();
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    const authDuration = Date.now() - startAuthTime;
    console.log('👤 Authentication took:', authDuration, 'ms');
    
    if (userError || !userData.user) {
      console.log('❌ Authentication failed:', userError?.message);
      console.log('❌ User data:', userData);
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = userData.user;
    console.log('✅ User authenticated:', user.id.substring(0, 8) + '...');
    console.log('✅ User email:', user.email);

    if (action === 'check_limit') {
      console.log('🔍 Checking usage limits...');
      
      // Get user usage data
      console.log('📊 Querying user_usage table...');
      const startQueryTime = Date.now();
      
      const { data: usageData, error: usageError } = await supabaseClient
        .from('user_usage')
        .select('*')
        .eq('user_id', user.id)
        .single();

      const queryDuration = Date.now() - startQueryTime;
      console.log('📊 Query took:', queryDuration, 'ms');

      if (usageError) {
        console.log('❌ Error fetching usage data:', usageError.message);
        console.log('❌ Error details:', JSON.stringify(usageError, null, 2));
        
        // Check if record doesn't exist
        if (usageError.code === 'PGRST116') {
          console.log('📝 No usage record exists, checking subscriber data...');
          
          const { data: subscriberData, error: subError } = await supabaseClient
            .from('subscribers')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (subError) {
            console.log('❌ Error fetching subscriber data:', subError.message);
            console.log('❌ Creating basic usage record...');
            
            // Create basic usage record for user
            const { data: newUsageData, error: insertError } = await supabaseClient
              .from('user_usage')
              .insert({
                user_id: user.id,
                email: user.email || '',
                is_active: false,
                subscription_tier: null,
                queries_remaining_this_month: 0,
                is_demo_user: false
              })
              .select()
              .single();

            if (insertError) {
              console.log('❌ Error creating usage record:', insertError.message);
              throw new Error('Could not create usage record');
            }

            const response = {
              canProceed: false,
              reason: "no_subscription",
              message: "No tienes una suscripción activa",
              usageData: {
                queriesUsed: 0,
                queriesRemaining: 0,
                usagePercentage: 0,
                monthlyLimit: 0
              }
            };

            console.log('✅ Returning basic usage data:', response);
            return new Response(JSON.stringify(response), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          console.log('📋 Subscriber data found:', subscriberData);
          
          // Create usage record from subscriber data
          const limit = subscriberData.subscribed && subscriberData.subscription_tier 
            ? getSubscriptionLimit(subscriberData.subscription_tier)
            : 0;

          console.log('📈 Calculated limit:', limit);

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

          console.log('✅ Created new usage record:', newUsageData);

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

        throw new Error('Database query failed: ' + usageError.message);
      }

      console.log('📊 Usage data found:', usageData);
      console.log('📊 Queries remaining:', usageData.queries_remaining_this_month);
      console.log('📊 Is active:', usageData.is_active);
      console.log('📊 Subscription tier:', usageData.subscription_tier);

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
      
      const { queryText, responseLength } = requestBody;
      console.log('📝 Query text length:', queryText?.length || 0);
      console.log('📝 Response length:', responseLength || 0);
      
      // Update usage data
      const { error: updateError } = await supabaseClient
        .from('user_usage')
        .update({
          queries_this_month: supabaseClient.sql`queries_this_month + 1`,
          queries_remaining_this_month: supabaseClient.sql`queries_remaining_this_month - 1`,
          total_queries: supabaseClient.sql`total_queries + 1`,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.log('❌ Error updating usage:', updateError.message);
      } else {
        console.log('✅ Usage updated successfully');
      }
      
      // Log the individual query
      const { error: logError } = await supabaseClient
        .from('query_logs')
        .insert({
          user_id: user.id,
          query_text: queryText,
          response_length: responseLength
        });

      if (logError) {
        console.log('❌ Error logging query:', logError.message);
      } else {
        console.log('✅ Query logged successfully');
      }
      
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
    console.error("💥 Error message:", error.message);
    console.error("💥 Error stack:", error.stack);
    
    return new Response(JSON.stringify({ 
      error: error.message || "Internal server error",
      details: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getSubscriptionLimit(tier: string): number {
  console.log('📐 Getting limit for tier:', tier);
  
  const limits = {
    'Demo': 3,
    'Básico': 100,
    'Profesional': 3000,
    'Academias': 10000
  };
  
  const limit = limits[tier] || 0;
  console.log('📐 Limit calculated:', limit);
  
  return limit;
}
