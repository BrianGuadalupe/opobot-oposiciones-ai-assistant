
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
    
    // Leer body de la request
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Supabase configuration missing');
      throw new Error('Supabase configuration not found');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

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

    // Verificar límites usando manage-usage
    console.log('🔍 Checking usage limits via manage-usage...');
    const { data: limitCheckData, error: limitError } = await supabase.functions.invoke('manage-usage', {
      body: { action: 'check_limit' }
    });

    if (limitError) {
      console.error('❌ Error checking limits:', limitError);
      throw new Error('Error checking usage limits');
    }

    if (!limitCheckData?.canProceed) {
      console.error('❌ Usage limit exceeded');
      return new Response(JSON.stringify({ 
        error: limitCheckData?.message || "Has alcanzado tu límite de consultas",
        success: false 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Usage limits verified, proceeding with chat...');

    // Preparar prompt del sistema
    const systemPrompt = `Eres Opobot, tutor virtual especializado en la oposición de Auxiliar Administrativo del Estado de España.

Tu función es ayudar a estudiantes con:
- Temario y contenidos específicos de la oposición
- Resolución de dudas sobre materias del programa
- Técnicas de estudio y preparación
- Orientación sobre el proceso de oposición

Responde de forma clara, directa y útil. Si la pregunta no está relacionada con oposiciones, indica educadamente que solo puedes ayudar con temas de oposiciones.

Usa un tono profesional pero cercano, y estructura tu respuesta con puntos claros cuando sea necesario.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(conversationHistory || []),
      { role: 'user', content: message }
    ];

    console.log('🤖 Calling OpenAI API...');
    console.log('🤖 Messages count:', messages.length);
    
    const startTime = Date.now();
    
    // Timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('⏰ Timeout reached, aborting OpenAI call');
      controller.abort();
    }, 25000);
    
    try {
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
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      console.log('📡 OpenAI response received in', responseTime, 'ms');
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ OpenAI API error:', response.status, errorText);
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.choices?.[0]?.message?.content) {
        console.error('❌ Invalid OpenAI response structure');
        throw new Error('Invalid response from OpenAI');
      }

      const assistantMessage = data.choices[0].message.content;
      console.log('📝 Assistant message length:', assistantMessage.length);
      
      // Registrar el uso vía manage-usage
      console.log('📊 Logging usage...');
      supabase.functions.invoke('manage-usage', {
        body: { 
          action: 'log_query',
          queryText: message,
          responseLength: assistantMessage.length
        }
      }).catch(err => {
        console.error('❌ Error logging usage (non-critical):', err);
      });

      const result = { 
        message: assistantMessage,
        success: true 
      };
      
      console.log('✅ Chat completed successfully');
      console.log('✅ Total time:', Date.now() - startTime, 'ms');
      
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      clearTimeout(timeoutId);
      console.error('💥 OpenAI API error:', error);
      
      if (error.name === 'AbortError') {
        return new Response(JSON.stringify({ 
          error: "La respuesta está tardando demasiado. Por favor, intenta de nuevo.",
          success: false 
        }), {
          status: 408,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw error;
    }

  } catch (error) {
    console.error('💥 Error in chat-opobot:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Error interno del servidor',
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
