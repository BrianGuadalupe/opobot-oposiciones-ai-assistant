
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
  console.log('📥 Headers:', Object.fromEntries(req.headers.entries()));
  
  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONS request handled');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📥 Processing chat request...');
    
    // Verificar API key de OpenAI
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error('❌ OpenAI API key not configured');
      throw new Error('OpenAI API key not configured');
    }
    console.log('✅ OpenAI API key found');

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
    console.log('📚 History length:', conversationHistory?.length || 0);

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
