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

    // Verificar límites de uso antes de procesar
    console.log('🔍 Checking usage limits...');
    const { data: usageData, error: usageError } = await supabase
      .from('user_usage')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (usageError) {
      console.error('❌ Error checking usage:', usageError);
      throw new Error('Error checking usage limits');
    }

    // Si no existe registro de uso, verificar suscripción
    if (!usageData) {
      console.log('📝 No usage data found, checking subscription...');
      const { data: subData } = await supabase
        .from('subscribers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!subData?.subscribed) {
        console.error('❌ User not subscribed');
        return new Response(JSON.stringify({ 
          error: "No tienes una suscripción activa. Suscríbete para usar Opobot.",
          success: false 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Crear registro de uso inicial
      const limit = getSubscriptionLimit(subData.subscription_tier);
      const { data: newUsage } = await supabase
        .from('user_usage')
        .insert({
          user_id: user.id,
          email: user.email || subData.email,
          is_active: true,
          subscription_tier: subData.subscription_tier,
          queries_remaining_this_month: limit,
          is_demo_user: false
        })
        .select()
        .single();

      if (newUsage.queries_remaining_this_month <= 0) {
        console.error('❌ No queries remaining');
        return new Response(JSON.stringify({ 
          error: "Has alcanzado tu límite de consultas para este período. Renueva tu suscripción para continuar.",
          success: false 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Verificar si tiene consultas restantes
      if (usageData.queries_remaining_this_month <= 0) {
        console.error('❌ No queries remaining for user');
        return new Response(JSON.stringify({ 
          error: "Has alcanzado tu límite de consultas para este período. Renueva tu suscripción para continuar.",
          success: false 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    console.log('✅ Usage limits verified, proceeding with chat...');

    const systemPrompt = `
Eres Opobot, tutor virtual especializado en la oposición de Auxiliar Administrativo del Estado de España.

Responde de forma clara, directa y útil. Si la pregunta no está relacionada con oposiciones, indica educadamente que solo puedes ayudar con temas de oposiciones.

Usa un tono profesional pero cercano, y estructura tu respuesta con puntos claros cuando sea necesario.
`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(conversationHistory || []),
      { role: 'user', content: message }
    ];

    console.log('🤖 Calling OpenAI API...');
    console.log('🤖 Messages count:', messages.length);
    
    const startTime = Date.now();
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    const responseTime = Date.now() - startTime;
    console.log('📡 OpenAI response received in', responseTime, 'ms');
    console.log('📡 OpenAI response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ OpenAI response received successfully');
    console.log('📊 Response data structure:', {
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length || 0,
      hasFirstChoice: !!data.choices?.[0],
      hasMessage: !!data.choices?.[0]?.message,
      hasContent: !!data.choices?.[0]?.message?.content
    });
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('❌ Invalid OpenAI response structure:', data);
      throw new Error('Invalid response from OpenAI');
    }

    const assistantMessage = data.choices[0].message.content;
    console.log('📝 Assistant message length:', assistantMessage?.length || 0);
    
    // Actualizar uso después de procesar la consulta exitosamente
    console.log('📊 Updating usage after successful query...');
    await supabase.from('user_usage').update({
      queries_this_month: supabase.sql`queries_this_month + 1`,
      queries_remaining_this_month: supabase.sql`queries_remaining_this_month - 1`,
      total_queries: supabase.sql`total_queries + 1`,
      updated_at: new Date().toISOString()
    }).eq('user_id', user.id);

    // Registrar la consulta en el log
    await supabase.from('query_logs').insert({
      user_id: user.id,
      query_text: message,
      response_length: assistantMessage.length
    });

    const result = { 
      message: assistantMessage,
      success: true 
    };
    
    console.log('✅ Returning successful response');
    console.log('✅ Total processing time:', Date.now() - startTime, 'ms');
    
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
