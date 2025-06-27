import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  console.log('🚀 CHAT-OPOBOT FINAL - Request received');
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const requestBody = await req.json();
    const { message } = requestBody;
    if (!message) {
      throw new Error('Message is required');
    }
    console.log('📝 Message received:', message.substring(0, 50) + '...');
    // Verificar API key de OpenAI
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }
    console.log('�� Calling OpenAI API...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Eres Opobot, tutor virtual especializado en la oposición de Auxiliar Administrativo del Estado de España. Responde de forma clara, directa y útil. Si la pregunta no está relacionada con oposiciones, indica educadamente que solo puedes ayudar con temas de oposiciones.'
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;
    console.log('✅ Chat completed successfully');
    return new Response(JSON.stringify({
      message: assistantMessage,
      success: true
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('💥 Error in chat-opobot:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Error interno del servidor',
      success: false
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
