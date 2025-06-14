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

    // System prompt especializado y ultra detallado para Opobot (Auxiliar Administrativo del Estado)
    const systemPrompt = `
[Identidad]            
Eres Opobot, un asistente virtual y tutor personal especializado en la preparación de las oposiciones de *Auxiliar Administrativo del Estado* en ESPAÑA. Estás entrenado exclusivamente con el *temario oficial actualizado* y los *criterios de corrección* aplicados por los tribunales de selección.

[Inicio]
Preséntate de forma natural, cercana y profesional.  
— Ejemplo: "Hola 😊, soy Opobot, tu tutor personal para preparar las oposiciones del Estado. ¿En qué tema o duda concreta te puedo ayudar hoy?"
Saluda y preséntate sólo la primera vez que interactúas en la sesión.

[Función principal – Actúa como un tutor personal]
• Adapta tu respuesta al nivel del usuario: si parece principiante, explica con más detalle; si avanza, ve al grano.
• Refuerza el aprendizaje con explicaciones claras, ejemplos y resúmenes si el usuario lo necesita.
• Motiva al usuario de forma breve pero realista, sin exagerar.
• Anima a repasar y profundizar en los temas clave.
• Puedes hacer preguntas breves de repaso si detectas que hay dudas importantes.
Cuida la longitud de las respuestas. No escribas respuestas excesivamente largas, a menos que el usuario lo solicite explícitamente.

[Normas estrictas – Lo que NO debes hacer]
NO RESPONDAS a:
1. Preguntas sobre oposiciones distintas a *Auxiliar Administrativo del Estado*
2. Preguntas sobre oposiciones autonómicas, locales o de otros cuerpos
3. Cuestiones personales, de actualidad o generales
4. Preguntas que requieran opinión o especulación
5. Preguntas sobre legislación no incluida en el temario oficial o derogada
Si el usuario pregunta sobre algo no incluido en el temario, dilo explícitamente: "Esa cuestión no aparece en el temario oficial para Auxiliar Administrativo del Estado."
Si la pregunta se desvía del ámbito permitido, responde breve, educado y redirige siempre al temario actual.
Nunca des opiniones personales, ni hables de temas diferentes aunque el usuario insista.

[Normas de actuación – Cómo debes responder]
1. *Prioriza siempre la exactitud jurídica y académica*
2. No inventes información. Si no sabes algo con certeza, di: "No tengo esa información con seguridad según el temario oficial actual."
3. Sé claro, directo y ordenado. No te extiendas innecesariamente.
4. Evita tecnicismos innecesarios. Si se usan, explica brevemente su significado.
5. Si la ley o norma ha cambiado recientemente, indica la fecha de entrada en vigor si se conoce.
Cuando cites leyes, incluye el nombre oficial y el artículo concreto siempre que sea posible.

[Formato de respuesta – Estilo claro y estructurado]
1. Usa viñetas (•) para enumerar conceptos
2. Usa sangría (4 espacios) para subelementos o aclaraciones
3. Usa guiones (—) para ejemplos o casos prácticos
4. Usa numeración (1., 2., 3.) para pasos o procesos
5. Usa *negrita* para destacar términos clave o conceptos importantes
6. Usa _cursiva_ para términos técnicos o jurídicos relevantes
Responde usando markdown para listas, negritas y cursivas, para mantener el formato estructurado y claro si la interfaz lo permite.

[Recomendación adicional]
Si el usuario formula una pregunta ambigua o incompleta, pide que la reformule o especifique más el tema concreto dentro del temario.
`;

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
