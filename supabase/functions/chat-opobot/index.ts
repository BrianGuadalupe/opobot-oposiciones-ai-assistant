import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🚀 CHAT-OPOBOT START - Request received');
  console.log('📥 Method:', req.method);
  console.log('📥 URL:', req.url);
  
  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONS request handled');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📥 Processing chat request...');
    
    // Leer body de la request PRIMERO (solo una vez)
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('📝 Request body received:', {
        hasMessage: !!requestBody.message,
        messageLength: requestBody.message?.length || 0,
        hasHistory: !!requestBody.conversationHistory,
        historyLength: requestBody.conversationHistory?.length || 0
      });
    } catch (error) {
      console.error('❌ Error parsing request body:', error);
      throw new Error('Invalid request body');
    }

    const { message, conversationHistory } = requestBody;
    
    if (!message) {
      console.error('❌ No message provided');
      throw new Error('Message is required');
    }

    console.log('📝 Message received:', message.substring(0, 50) + '...');
    console.log('📚 History length:', conversationHistory?.length || 0);
    
    // Verificar API key de OpenAI
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error('❌ OpenAI API key not configured');
      throw new Error('OpenAI API key not configured');
    }
    console.log('✅ OpenAI API key found');

    // Verificar autenticación del usuario
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error('❌ No authorization header provided');
      return new Response(JSON.stringify({ 
        error: "Authentication required",
        success: false 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
      console.error('❌ Authentication failed:', userError);
      return new Response(JSON.stringify({ 
        error: "Authentication failed",
        success: false 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const user = userData.user;
    console.log('✅ User authenticated:', user.id);

    // VERSIÓN SIMPLIFICADA - Solo responder con un mensaje de prueba
    console.log('🧪 TEST MODE: Returning simple response');
    
    const result = { 
      message: `Hola ${user.email}! Este es un mensaje de prueba. Tu mensaje fue: "${message}". La función está funcionando correctamente.`,
      success: true 
    };
    
    console.log('✅ Returning test response');
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 Error in chat-opobot function:', error);
    console.error('💥 Error message:', error.message);
    console.error('💥 Error stack:', error.stack);
    
    const errorResponse = { 
      error: error.message || 'Error interno del servidor',
      success: false 
    };
    
    console.log('❌ Returning error response:', errorResponse);
    
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Función auxiliar para obtener límites de suscripción
function getSubscriptionLimit(tier: string): number {
  const limits = {
    'Demo': 3,
    'Básico': 100,
    'Profesional': 3000,
    'Academias': 30000
  };
  return limits[tier] || 0;
}
