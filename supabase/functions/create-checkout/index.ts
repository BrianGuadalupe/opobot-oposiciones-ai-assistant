
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Plan mapping - actualizado para incluir "Básico"
const PLAN_MAPPING = {
  "Básico": "price_1RakDbG0tRQIugBejNs3yiVA",
  "Profesional": "price_1RakGGG0tRQIugBefzFK7piu"
};

const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[${timestamp}] [CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  logStep("=== CREATE CHECKOUT FUNCTION STARTED ===");
  
  // Handle CORS
  if (req.method === "OPTIONS") {
    logStep("CORS preflight handled");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Environment check
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    logStep("Environment check", {
      supabaseUrl: !!supabaseUrl,
      supabaseKey: !!supabaseKey,
      stripeKey: !!stripeKey
    });

    if (!supabaseUrl || !supabaseKey || !stripeKey) {
      logStep("ERROR: Missing environment variables");
      return new Response(JSON.stringify({ error: "Missing environment variables" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Create Supabase client
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Get and validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("ERROR: No authorization header");
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token length", { tokenLength: token.length });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user?.email) {
      logStep("ERROR: Authentication failed", { authError });
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    logStep("User authenticated successfully", { userId: user.id, email: user.email });

    // Parse request body
    logStep("Parsing request body...");
    let requestBody;
    try {
      const bodyText = await req.text();
      logStep("Raw body received", { bodyLength: bodyText.length, body: bodyText });
      requestBody = JSON.parse(bodyText);
      logStep("Request body parsed successfully", requestBody);
    } catch (error) {
      logStep("ERROR: Failed to parse body", { error: error.message });
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const { planName } = requestBody;
    if (!planName || typeof planName !== 'string') {
      logStep("ERROR: Invalid planName", { planName, type: typeof planName });
      return new Response(JSON.stringify({ error: "Invalid planName" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Get price ID
    const priceId = PLAN_MAPPING[planName as keyof typeof PLAN_MAPPING];
    if (!priceId) {
      logStep("ERROR: Plan not found in mapping", { 
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

    // Initialize Stripe
    logStep("Initializing Stripe...");
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // Check for existing customer
    logStep("Checking for existing customer...");
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      logStep("No existing customer found, will create new one");
    }

    // Get origin
    const origin = req.headers.get("origin") || "https://www.opobots.com";
    logStep("Using origin for URLs", { origin });

    // Create checkout session
    logStep("Creating Stripe checkout session...");
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
    };

    logStep("Session data prepared", sessionData);

    const session = await stripe.checkout.sessions.create(sessionData);

    logStep("Checkout session created successfully", { 
      sessionId: session.id, 
      url: session.url 
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logStep("CRITICAL ERROR in create-checkout", { 
      message: errorMessage,
      stack: errorStack,
      timestamp: new Date().toISOString()
    });
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
