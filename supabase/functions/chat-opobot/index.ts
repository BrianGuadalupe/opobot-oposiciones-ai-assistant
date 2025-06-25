
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    
    // Leer body de la request
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('📝 Request body received:', requestBody);
    } catch (error) {
      console.error('❌ Error parsing request body:', error);
      throw new Error('Invalid request body');
    }

    const { message } = requestBody;
    
    if (!message) {
      console.error('❌ No message provided');
      throw new Error('Message is required');
    }

    console.log('📝 Message received:', message);
    
    // Respuesta simple sin autenticación
    console.log('🧪 ULTRA SIMPLE TEST MODE: Returning response');
    
    const result = { 
      message: `Respuesta de prueba: "${message}". La función está funcionando.`,
      success: true 
    };
    
    console.log('✅ Returning test response');
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 Error in chat-opobot function:', error);
    console.error('💥 Error message:', error.message);
    
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
