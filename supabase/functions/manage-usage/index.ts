
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log('🚀 MANAGE-USAGE ULTRA SIMPLE START');
  
  if (req.method === "OPTIONS") {
    console.log('✅ OPTIONS request handled');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📦 Starting ultra simple response...');
    
    // ULTRA SIMPLE - solo devolver una respuesta inmediatamente
    const response = {
      canProceed: true,
      reason: "ok",
      message: "Test response - ultra simple",
      usageData: {
        queriesUsed: 1,
        queriesRemaining: 99,
        usagePercentage: 1.0,
        monthlyLimit: 100
      }
    };
    
    console.log('✅ About to return response');
    
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("💥 ULTRA SIMPLE ERROR:", error);
    
    return new Response(JSON.stringify({ 
      error: "Ultra simple error",
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
