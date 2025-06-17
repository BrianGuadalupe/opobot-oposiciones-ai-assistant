
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Plan mapping - CRÍTICO: usar las claves exactas de Stripe
const PLAN_MAPPING = {
  "Básico": "price_1RakDbG0tRQIugBejNs3yiVA",
  "Profesional": "price_1RakGGG0tRQIugBefzFK7piu"
};

const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [CREATE-CHECKOUT] ${step}`);
  if (details) {
    console.log(`[${timestamp}] [CREATE-CHECKOUT] Details:`, JSON.stringify(details, null, 2));
  }
};

serve(async (req) => {
  logStep("=== FUNCTION STARTED ===");
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    logStep("Handling CORS preflight");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. VERIFICAR VARIABLES DE ENTORNO CRÍTICAS
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    logStep("Environment variables check", {
      supabaseUrl: !!supabaseUrl,
      supabaseKey: !!supabaseKey,
      stripeKey: !!stripeKey,
      stripeKeyPrefix: stripeKey ? stripeKey.substring(0, 8) + "..." : "MISSING"
    });

    if (!supabaseUrl || !supabaseKey || !stripeKey) {
      const missing = [];
      if (!supabaseUrl) missing.push("SUPABASE_URL");
      if (!supabaseKey) missing.push("SUPABASE_ANON_KEY");
      if (!stripeKey) missing.push("STRIPE_SECRET_KEY");
      
      logStep("CRITICAL ERROR: Missing environment variables", { missing });
      return new Response(JSON.stringify({ 
        error: "Server configuration error",
        missing: missing 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // 2. VERIFICAR MÉTODO HTTP
    if (req.method !== "POST") {
      logStep("ERROR: Invalid HTTP method", { method: req.method });
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 405,
      });
    }

    // 3. CREAR CLIENTE SUPABASE CON TIMEOUT
    logStep("Creating Supabase client");
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // 4. VERIFICAR AUTENTICACIÓN
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("ERROR: No authorization header");
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user", { tokenLength: token.length });

    // Timeout para auth
    const authPromise = supabaseClient.auth.getUser(token);
    const authTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Auth timeout")), 10000);
    });

    const { data: { user }, error: authError } = await Promise.race([authPromise, authTimeout]) as any;
    
    if (authError || !user?.email) {
      logStep("ERROR: Authentication failed", { 
        authError: authError?.message,
        hasUser: !!user,
        hasEmail: !!user?.email 
      });
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    logStep("User authenticated successfully", { 
      userId: user.id, 
      email: user.email?.substring(0, 5) + "***" 
    });

    // 5. PARSEAR BODY CON MANEJO DE ERRORES
    let requestBody;
    try {
      const bodyText = await req.text();
      logStep("Raw body received", { bodyLength: bodyText.length });
      
      if (!bodyText) {
        throw new Error("Empty request body");
      }
      
      requestBody = JSON.parse(bodyText);
      logStep("Request body parsed", { planName: requestBody.planName });
    } catch (error) {
      logStep("ERROR: Failed to parse request body", { error: error.message });
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // 6. VALIDAR PLAN NAME
    const { planName } = requestBody;
    if (!planName || typeof planName !== 'string') {
      logStep("ERROR: Invalid planName", { planName, type: typeof planName });
      return new Response(JSON.stringify({ error: "Invalid plan name" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // 7. OBTENER PRICE ID
    const priceId = PLAN_MAPPING[planName as keyof typeof PLAN_MAPPING];
    if (!priceId) {
      logStep("ERROR: Plan not found", { 
        planName, 
        availablePlans: Object.keys(PLAN_MAPPING) 
      });
      return new Response(JSON.stringify({ 
        error: "Invalid plan name",
        availablePlans: Object.keys(PLAN_MAPPING)
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Plan mapped successfully", { planName, priceId });

    // 8. INICIALIZAR STRIPE CON TIMEOUT
    logStep("Initializing Stripe");
    const stripe = new Stripe(stripeKey, { 
      apiVersion: "2023-10-16",
      timeout: 15000 // 15 segundos timeout
    });
    
    // 9. VERIFICAR CUSTOMER EXISTENTE CON TIMEOUT
    logStep("Checking for existing customer");
    const customersPromise = stripe.customers.list({ email: user.email, limit: 1 });
    const customersTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Customers API timeout")), 10000);
    });

    const customers = await Promise.race([customersPromise, customersTimeout]) as any;
    
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId: customerId.substring(0, 8) + "..." });
    } else {
      logStep("No existing customer found");
    }

    // 10. OBTENER ORIGIN
    const origin = req.headers.get("origin") || req.headers.get("referer") || "https://opobots.com";
    logStep("Using origin for URLs", { origin });

    // 11. CREAR CHECKOUT SESSION CON TIMEOUT
    logStep("Creating Stripe checkout session");
    const sessionData = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription" as const,
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?canceled=true`,
      metadata: {
        user_id: user.id,
        plan_name: planName,
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
    };

    logStep("Session data prepared", sessionData);

    const sessionPromise = stripe.checkout.sessions.create(sessionData);
    const sessionTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Checkout session creation timeout")), 15000);
    });

    const session = await Promise.race([sessionPromise, sessionTimeout]) as any;

    logStep("Checkout session created successfully", { 
      sessionId: session.id,
      hasUrl: !!session.url
    });

    // 12. RESPUESTA EXITOSA
    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logStep("CRITICAL ERROR", { 
      message: errorMessage,
      stack: errorStack,
      timestamp: new Date().toISOString()
    });
    
    // Determinar el tipo de error para el status code
    let statusCode = 500;
    if (errorMessage.includes("timeout") || errorMessage.includes("Timeout")) {
      statusCode = 504; // Gateway Timeout
    } else if (errorMessage.includes("auth") || errorMessage.includes("Authentication")) {
      statusCode = 401; // Unauthorized
    }
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: statusCode,
    });
  }
});
