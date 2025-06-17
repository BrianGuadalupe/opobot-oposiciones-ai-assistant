
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    logStep("CORS preflight request");
    return new Response(null, { headers: corsHeaders });
  }

  logStep("Function invoked", { method: req.method, url: req.url });

  try {
    // Environment variables check
    logStep("Checking environment variables");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!supabaseUrl || !supabaseKey) {
      logStep("ERROR: Missing Supabase environment variables");
      throw new Error("Missing Supabase configuration");
    }

    if (!stripeKey) {
      logStep("ERROR: Missing Stripe secret key");
      throw new Error("Missing Stripe secret key");
    }

    logStep("Environment variables OK");

    // Create Supabase client
    logStep("Creating Supabase client");
    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    logStep("Supabase client created");

    // Get authorization header
    logStep("Checking authorization");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("ERROR: No authorization header");
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    logStep("Token extracted", { tokenLength: token.length });

    // Authenticate user
    logStep("Authenticating user");
    const { data, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError) {
      logStep("ERROR: Authentication failed", { error: authError.message });
      throw new Error(`Authentication failed: ${authError.message}`);
    }

    const user = data.user;
    if (!user?.email) {
      logStep("ERROR: No user or email");
      throw new Error("User not authenticated or email not available");
    }

    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse request body - only expecting planName now
    logStep("Parsing request body");
    const requestBody = await req.json();
    logStep("Request body parsed", requestBody);

    const { planName } = requestBody;
    if (!planName || typeof planName !== 'string') {
      logStep("ERROR: Missing or invalid planName");
      throw new Error("Missing or invalid planName");
    }

    // Securely map planName to priceId on server side
    const priceId = PLAN_MAPPING[planName as keyof typeof PLAN_MAPPING];
    if (!priceId) {
      logStep("ERROR: Invalid plan name", { planName, availablePlans: Object.keys(PLAN_MAPPING) });
      throw new Error("Invalid plan name");
    }

    logStep("Plan mapped to price ID", { planName, priceId });

    // Initialize Stripe
    logStep("Initializing Stripe");
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    logStep("Stripe initialized");

    // Check for existing customer
    logStep("Checking for existing customer");
    const customers = await stripe.customers.list({ 
      email: user.email, 
      limit: 1 
    });
    logStep("Customer search completed", { customersFound: customers.data.length });

    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      logStep("No existing customer found");
    }

    // Get origin for redirect URLs
    const origin = req.headers.get("origin") || "https://www.opobots.com";
    logStep("Creating checkout session", { origin, customerId, priceId, planName });

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
    logStep("ERROR occurred", { 
      message: errorMessage, 
      stack: error instanceof Error ? error.stack : 'No stack available' 
    });
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
