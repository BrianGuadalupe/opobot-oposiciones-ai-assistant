
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [CREATE-CHECKOUT] ${step}`);
  if (details) {
    console.log(`[${timestamp}] [CREATE-CHECKOUT] Details:`, JSON.stringify(details, null, 2));
  }
};

serve(async (req) => {
  logStep("=== FUNCIÓN CREATE-CHECKOUT INICIADA ===");
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    logStep("Handling CORS preflight request");
    return new Response(null, { headers: corsHeaders });
  }

  // Solo aceptar POST
  if (req.method !== "POST") {
    logStep("ERROR: Método no permitido", { method: req.method });
    return new Response(JSON.stringify({ error: "Método no permitido. Usar POST." }), { 
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    logStep("1. Verificando variables de entorno");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    
    logStep("Variables de entorno", {
      hasStripeKey: !!stripeKey,
      stripeKeyPrefix: stripeKey ? stripeKey.substring(0, 10) + "..." : "NO_ENCONTRADA",
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseAnonKey: !!supabaseAnonKey,
      supabaseUrl: supabaseUrl
    });
    
    if (!stripeKey) {
      logStep("ERROR CRÍTICO: STRIPE_SECRET_KEY no encontrada");
      return new Response(JSON.stringify({ 
        error: "Configuración del servidor incompleta: STRIPE_SECRET_KEY faltante",
        debug: "La clave de Stripe no está configurada en los secrets de Supabase"
      }), { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      logStep("ERROR CRÍTICO: Variables de Supabase no encontradas");
      return new Response(JSON.stringify({ 
        error: "Configuración del servidor incompleta: Variables de Supabase faltantes"
      }), { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    logStep("2. Creando cliente de Supabase");
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    logStep("3. Verificando autenticación");
    const authHeader = req.headers.get("Authorization");
    logStep("Header de autorización", { 
      hasAuthHeader: !!authHeader,
      authHeaderLength: authHeader ? authHeader.length : 0,
      authHeaderPrefix: authHeader ? authHeader.substring(0, 20) + "..." : "NO_ENCONTRADO"
    });
    
    if (!authHeader) {
      logStep("ERROR: Header de autorización faltante");
      return new Response(JSON.stringify({ 
        error: "Token de autenticación requerido",
        debug: "El header Authorization no está presente en la petición"
      }), { 
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const token = authHeader.replace("Bearer ", "");
    logStep("Token extraído", { tokenLength: token.length });
    
    logStep("4. Obteniendo usuario autenticado");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    logStep("Resultado de autenticación", { 
      hasUserData: !!userData,
      hasUser: !!userData?.user,
      userId: userData?.user?.id,
      userEmail: userData?.user?.email,
      userError: userError?.message
    });
    
    if (userError || !userData.user) {
      logStep("ERROR: Usuario no autenticado", { error: userError });
      return new Response(JSON.stringify({ 
        error: "Usuario no autenticado",
        debug: userError?.message || "Token inválido o expirado"
      }), { 
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const user = userData.user;
    logStep("Usuario autenticado exitosamente", { userId: user.id, email: user.email });

    logStep("5. Leyendo cuerpo de la petición");
    let requestBody;
    try {
      const rawBody = await req.text();
      logStep("Cuerpo de petición crudo", { rawBody, bodyLength: rawBody.length });
      
      if (!rawBody || rawBody.trim() === '') {
        throw new Error("Cuerpo de petición vacío");
      }
      
      requestBody = JSON.parse(rawBody);
      logStep("Cuerpo de petición parseado", requestBody);
    } catch (error) {
      logStep("ERROR: No se pudo parsear el cuerpo de la petición", { 
        error: error.message,
        receivedContentType: req.headers.get("content-type")
      });
      return new Response(JSON.stringify({ 
        error: "Cuerpo de petición inválido",
        debug: `Error al parsear JSON: ${error.message}`
      }), { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { planName } = requestBody;
    logStep("Plan solicitado", { planName, planType: typeof planName });

    if (!planName || typeof planName !== 'string') {
      logStep("ERROR: planName faltante o inválido");
      return new Response(JSON.stringify({ 
        error: "El campo 'planName' es requerido y debe ser un string",
        debug: `Recibido: ${JSON.stringify(planName)}`
      }), { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    logStep("6. Mapeando plan a configuración de precio");
    const PLAN_PRICING = {
      "Básico": { amount: 995, name: "Plan Básico" },        
      "Profesional": { amount: 1995, name: "Plan Profesional" }, 
      "Academias": { amount: 4995, name: "Plan Academias" }   
    };

    const planConfig = PLAN_PRICING[planName as keyof typeof PLAN_PRICING];
    logStep("Configuración del plan", { 
      planName, 
      planConfig, 
      availablePlans: Object.keys(PLAN_PRICING) 
    });
    
    if (!planConfig) {
      logStep("ERROR: Plan no reconocido");
      return new Response(JSON.stringify({ 
        error: "Plan no válido",
        debug: `Plan '${planName}' no encontrado. Planes disponibles: ${Object.keys(PLAN_PRICING).join(', ')}`
      }), { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    logStep("7. Inicializando cliente de Stripe");
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    logStep("8. Buscando cliente existente de Stripe");
    const customers = await stripe.customers.list({ 
      email: user.email, 
      limit: 1 
    });

    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Cliente existente encontrado", { customerId });
    } else {
      logStep("Creando nuevo cliente de Stripe");
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          user_id: user.id,
        },
      });
      customerId = customer.id;
      logStep("Nuevo cliente creado", { customerId });
    }

    logStep("9. Preparando sesión de checkout");
    const origin = req.headers.get("origin") || req.headers.get("referer") || "https://dozaqjmdoblwqnuprxnq.supabase.co";
    const sessionConfig = {
      customer: customerId,
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: planConfig.name,
            description: `Suscripción mensual al ${planConfig.name}`,
          },
          unit_amount: planConfig.amount,
          recurring: {
            interval: 'month',
          },
        },
        quantity: 1,
      }],
      mode: 'subscription' as const,
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?canceled=true`,
      metadata: {
        user_id: user.id,
        plan_name: planName,
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required' as const,
    };
    
    logStep("Configuración de sesión preparada", sessionConfig);

    logStep("10. Creando sesión de checkout de Stripe");
    try {
      const session = await stripe.checkout.sessions.create(sessionConfig);

      logStep("ÉXITO: Sesión de checkout creada", { 
        sessionId: session.id, 
        url: session.url,
        planName,
        amount: planConfig.amount,
        currency: 'eur',
        customerId
      });

      const response = {
        url: session.url,
        sessionId: session.id,
        success: true
      };

      logStep("Enviando respuesta exitosa", response);

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });

    } catch (stripeError: any) {
      logStep("ERROR CRÍTICO: Fallo al crear sesión de Stripe", { 
        error: stripeError.message,
        type: stripeError.type,
        code: stripeError.code,
        stack: stripeError.stack
      });
      
      return new Response(JSON.stringify({ 
        error: `Error de Stripe: ${stripeError.message}`,
        debug: {
          type: stripeError.type,
          code: stripeError.code
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR CRÍTICO GENERAL", { 
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      type: typeof error
    });
    
    return new Response(JSON.stringify({ 
      error: `Error del servidor: ${errorMessage}`,
      debug: error instanceof Error ? error.stack : undefined
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
