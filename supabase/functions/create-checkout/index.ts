
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
  logStep("=== CHECKOUT SESSION CREATION ===");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    logStep("ERROR: Invalid method", { method: req.method });
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // 1. VERIFICAR CLAVES DE ENTORNO
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      logStep("ERROR: Missing STRIPE_SECRET_KEY");
      return new Response("Server configuration error", { status: 500 });
    }

    // 2. AUTENTICAR USUARIO
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("ERROR: No authorization header");
      return new Response("Authentication required", { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      logStep("ERROR: User authentication failed", { error: userError });
      return new Response("User not authenticated", { status: 401 });
    }

    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    // 3. OBTENER DATOS DEL REQUEST
    const requestBody = await req.json();
    const { planName } = requestBody;

    if (!planName) {
      logStep("ERROR: Missing planName");
      return new Response("Plan name is required", { status: 400 });
    }

    // 4. MAPEAR PLANES A PRICE IDs
    const PLAN_MAPPING = {
      "Básico": "price_1RakDbG0tRQIugBejNs3yiVA",
      "Profesional": "price_1RakGGG0tRQIugBefzFK7piu",
      "Academias": "price_1RakGkG0tRQIugBeECOoQI3p"
    };

    const priceId = PLAN_MAPPING[planName as keyof typeof PLAN_MAPPING];
    if (!priceId) {
      logStep("ERROR: Invalid plan name", { planName });
      return new Response("Invalid plan name", { status: 400 });
    }

    logStep("Plan mapping found", { planName, priceId });

    // 5. INICIALIZAR STRIPE
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // 6. BUSCAR O CREAR CUSTOMER
    const customers = await stripe.customers.list({ 
      email: user.email, 
      limit: 1 
    });

    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
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
    const origin = req.headers.get("origin") || "https://dozaqjmdoblwqnuprxnq.supabase.co";
    
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

    logStep("Checkout session created", { 
      sessionId: session.id, 
      url: session.url,
      planName,
      customerId 
    });

    return new Response(JSON.stringify({ 
      url: session.url,
      sessionId: session.id 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("CRITICAL ERROR in create-checkout", { error: errorMessage });
    
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
