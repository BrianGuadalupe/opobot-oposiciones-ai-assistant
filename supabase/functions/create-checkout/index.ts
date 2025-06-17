
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Logger with timestamps
const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[${timestamp}] [CREATE-CHECKOUT] ${step}${detailsStr}`);
};

// Secure mapping of plan names to price IDs (server-side only)
const PLAN_MAPPING = {
  "Básico": "price_1RakDbG0tRQIugBejNs3yiVA",
  "Profesional": "price_1RakGGG0tRQIugBefzFK7piu"
};

serve(async (req) => {
  const startTime = Date.now();
  
  logStep("=== FUNCTION STARTED ===");
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    logStep("CORS preflight handled");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Environment variables check
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    logStep("Environment check", {
      supabaseUrl: supabaseUrl ? "✓" : "✗",
      supabaseKey: supabaseKey ? "✓" : "✗", 
      stripeKey: stripeKey ? "✓" : "✗"
    });

    if (!supabaseUrl || !supabaseKey || !stripeKey) {
      const error = "Missing environment variables";
      logStep("ERROR: " + error);
      return new Response(JSON.stringify({ error }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Create Supabase client
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("ERROR: No authorization header");
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    logStep("Token extracted", { length: token.length });

    // Authenticate user
    logStep("=== AUTHENTICATING USER ===");
    const authResponse = await supabaseClient.auth.getUser(token);
    
    if (authResponse.error) {
      logStep("ERROR: Authentication failed", { error: authResponse.error.message });
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const user = authResponse.data.user;
    if (!user?.email) {
      logStep("ERROR: No user or email");
      return new Response(JSON.stringify({ error: "User not authenticated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    logStep("User authenticated", { 
      userId: user.id, 
      email: user.email.substring(0, 3) + "***"
    });

    // Parse request body
    logStep("=== PARSING REQUEST BODY ===");
    let requestBody;
    try {
      const bodyText = await req.text();
      logStep("Raw body received", { length: bodyText.length });
      
      if (!bodyText) {
        throw new Error("Empty request body");
      }
      
      requestBody = JSON.parse(bodyText);
      logStep("Body parsed", { keys: Object.keys(requestBody) });
    } catch (parseError) {
      logStep("ERROR: Failed to parse body", { error: parseError.message });
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const { planName } = requestBody;
    if (!planName || typeof planName !== 'string') {
      logStep("ERROR: Invalid planName", { planName });
      return new Response(JSON.stringify({ error: "Invalid planName" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Map planName to priceId
    const priceId = PLAN_MAPPING[planName as keyof typeof PLAN_MAPPING];
    if (!priceId) {
      logStep("ERROR: Invalid plan", { planName, available: Object.keys(PLAN_MAPPING) });
      return new Response(JSON.stringify({ error: "Invalid plan name" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Plan mapped", { planName, priceId });

    // Initialize Stripe
    logStep("=== INITIALIZING STRIPE ===");
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // Check for existing customer
    logStep("=== CHECKING CUSTOMER ===");
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      logStep("No existing customer - will create during checkout");
    }

    // Get origin for URLs
    const origin = req.headers.get("origin") || "https://www.opobots.com";
    logStep("=== CREATING CHECKOUT SESSION ===", { origin, customerId: customerId ? "exists" : "new" });

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?canceled=true`,
      metadata: {
        user_id: user.id,
        plan_name: planName,
      },
    });

    const executionTime = Date.now() - startTime;
    logStep("=== SUCCESS ===", { 
      sessionId: session.id,
      url: session.url ? "✓" : "✗",
      executionTime: `${executionTime}ms`
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logStep("=== CRITICAL ERROR ===", { 
      message: errorMessage,
      type: error?.constructor?.name || 'Unknown',
      executionTime: `${executionTime}ms`
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
