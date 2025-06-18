
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
  logStep("=== CHECKOUT SESSION CREATION STARTED ===");
  logStep("Request method", { method: req.method });
  logStep("Request headers", Object.fromEntries(req.headers.entries()));

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    logStep("Handling CORS preflight request");
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    logStep("ERROR: Invalid method", { method: req.method });
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // 1. VERIFICAR CLAVES DE ENTORNO
    logStep("Checking environment variables");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    
    logStep("Environment check", {
      hasStripeKey: !!stripeKey,
      stripeKeyLength: stripeKey ? stripeKey.length : 0,
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseAnonKey: !!supabaseAnonKey,
      supabaseUrl: supabaseUrl
    });
    
    if (!stripeKey) {
      logStep("ERROR: Missing STRIPE_SECRET_KEY");
      return new Response(JSON.stringify({ error: "Server configuration error: Missing Stripe key" }), { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. AUTENTICAR USUARIO
    logStep("Creating Supabase client");
    const supabaseClient = createClient(
      supabaseUrl ?? "",
      supabaseAnonKey ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    logStep("Auth header check", { 
      hasAuthHeader: !!authHeader,
      authHeaderLength: authHeader ? authHeader.length : 0 
    });
    
    if (!authHeader) {
      logStep("ERROR: No authorization header");
      return new Response(JSON.stringify({ error: "Authentication required" }), { 
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const token = authHeader.replace("Bearer ", "");
    logStep("Extracted token", { tokenLength: token.length });
    
    logStep("Getting user from token");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    logStep("User authentication result", { 
      hasUserData: !!userData,
      hasUser: !!userData?.user,
      userId: userData?.user?.id,
      userEmail: userData?.user?.email,
      userError: userError?.message
    });
    
    if (userError || !userData.user) {
      logStep("ERROR: User authentication failed", { error: userError });
      return new Response(JSON.stringify({ error: "User not authenticated" }), { 
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const user = userData.user;
    logStep("User authenticated successfully", { userId: user.id, email: user.email });

    // 3. OBTENER DATOS DEL REQUEST
    logStep("Reading request body");
    let requestBody;
    try {
      requestBody = await req.json();
      logStep("Request body parsed", requestBody);
    } catch (error) {
      logStep("ERROR: Failed to parse request body", { error: error.message });
      return new Response(JSON.stringify({ error: "Invalid request body" }), { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { planName } = requestBody;
    logStep("Plan validation", { planName, planType: typeof planName });

    if (!planName) {
      logStep("ERROR: Missing planName");
      return new Response(JSON.stringify({ error: "Plan name is required" }), { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 4. MAPEAR PLANES A PRICE IDs - ACTUALIZA ESTOS CON TUS PRICE IDs REALES
    const PLAN_MAPPING = {
      "Básico": "REEMPLAZA_CON_TU_PRICE_ID_BASICO",
      "Profesional": "REEMPLAZA_CON_TU_PRICE_ID_PROFESIONAL", 
      "Academias": "REEMPLAZA_CON_TU_PRICE_ID_ACADEMIAS"
    };

    const priceId = PLAN_MAPPING[planName as keyof typeof PLAN_MAPPING];
    logStep("Plan mapping", { planName, priceId, availablePlans: Object.keys(PLAN_MAPPING) });
    
    if (!priceId) {
      logStep("ERROR: Invalid plan name", { planName, availablePlans: Object.keys(PLAN_MAPPING) });
      return new Response(JSON.stringify({ error: "Invalid plan name" }), { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 5. INICIALIZAR STRIPE
    logStep("Initializing Stripe client");
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // 6. BUSCAR O CREAR CUSTOMER
    logStep("Searching for existing customer", { email: user.email });
    const customers = await stripe.customers.list({ 
      email: user.email, 
      limit: 1 
    });

    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      logStep("Creating new customer");
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          user_id: user.id,
        },
      });
      customerId = customer.id;
      logStep("New customer created", { customerId });
    }

    // 7. CREAR CHECKOUT SESSION
    const origin = req.headers.get("origin") || req.headers.get("referer") || "https://dozaqjmdoblwqnuprxnq.supabase.co";
    logStep("Creating checkout session", { 
      customerId, 
      priceId, 
      origin,
      planName 
    });
    
    try {
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?canceled=true`,
        metadata: {
          user_id: user.id,
          plan_name: planName,
        },
      });

      logStep("Checkout session created successfully", { 
        sessionId: session.id, 
        url: session.url,
        planName,
        customerId,
        success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?canceled=true`
      });

      const response = {
        url: session.url,
        sessionId: session.id
      };

      logStep("Sending successful response", response);

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });

    } catch (stripeError) {
      logStep("ERROR: Stripe checkout session creation failed", { 
        error: stripeError.message,
        type: stripeError.type,
        code: stripeError.code
      });
      
      return new Response(JSON.stringify({ 
        error: `Stripe error: ${stripeError.message}` 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("CRITICAL ERROR in create-checkout", { 
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return new Response(JSON.stringify({ 
      error: `Server error: ${errorMessage}` 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
