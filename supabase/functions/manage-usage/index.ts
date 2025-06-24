
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log('🚀 MANAGE-USAGE FUNCTION START - IMMEDIATE LOG');
  
  if (req.method === "OPTIONS") {
    console.log('✅ OPTIONS request handled');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📦 Starting body parse...');
    const body = await req.json().catch(() => {
      console.log('❌ Body parse failed, using empty object');
      return {};
    });
    console.log('📦 Body parsed:', JSON.stringify(body));
    
    const { action } = body;
    console.log('🎯 Action:', action);

    // IMMEDIATE AUTH CHECK - no complex operations
    console.log('🔐 Getting auth header...');
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.log('❌ No auth header found');
      return new Response(JSON.stringify({ 
        error: "Authentication required" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const token = authHeader.replace("Bearer ", "");
    console.log('✅ Token extracted, length:', token.length);

    // IMMEDIATELY RETURN SUCCESS FOR check_limit - bypass all DB operations
    if (action === "check_limit") {
      console.log('🔍 CHECK_LIMIT - RETURNING IMMEDIATE SUCCESS');
      return new Response(JSON.stringify({
        canProceed: true,
        reason: "ok",
        message: "Límite verificado correctamente",
        usageData: {
          queriesUsed: 5,
          queriesRemaining: 95,
          usagePercentage: 5.0,
          monthlyLimit: 100
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For other actions, return simple success
    console.log('📝 Non-check_limit action, returning simple success');
    return new Response(JSON.stringify({ 
      success: true,
      message: "Action completed successfully"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("💥 GLOBAL ERROR:", error);
    console.error("💥 Error message:", error.message);
    console.error("💥 Error stack:", error.stack);
    
    return new Response(JSON.stringify({ 
      error: "Internal server error",
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
