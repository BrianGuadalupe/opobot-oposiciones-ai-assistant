
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory } = await req.json();
    
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader?.replace('Bearer ', '') || ''
    );

    if (userError || !user) {
      throw new Error('Usuario no autenticado');
    }

    console.log('Processing chat request for user:', user.id);

    // System prompt especializado en oposiciones españolas
    const systemPrompt = `Eres Opobot, un asistente especializado en oposiciones al Estado español. Tu conocimiento incluye:

- Legislación española actualizada (hasta 2023)
- Procedimientos administrativos
- Temarios de todas las oposiciones del Estado
- Derecho constitucional, administrativo, civil, penal
- Técnicas de estudio para oposiciones
- Resolución de casos prácticos

Características importantes:
- Responde siempre en español
- Sé preciso y cita artículos cuando sea relevante
- Si no estás seguro de algo, indícalo claramente
- Adapta tu respuesta al nivel de la oposición (A1, A2, C1, C2)
- Ofrece ejemplos prácticos cuando sea útil
- Mantén un tono profesional pero cercano

Si te preguntan sobre temas fuera de oposiciones, redirige amablemente hacia temas relacionados con el estudio de oposiciones.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

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

    const data = await response.json();
    
    if (!response.ok) {
      console.error('OpenAI API error:', data);
      throw new Error('Error en la API de OpenAI');
    }

    const assistantMessage = data.choices[0].message.content;
    
    console.log('Generated response for user:', user.id);

    return new Response(JSON.stringify({ 
      message: assistantMessage,
      success: true 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in chat-opobot function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
