
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

  logStep("=== FUNCTION STARTED ===");
  logStep("Request method", { method: req.method });
  logStep("Request headers", { 
    origin: req.headers.get("origin"),
    authorization: req.headers.get("Authorization") ? "present" : "missing",
    contentType: req.headers.get("content-type")
  });

  try {
    // Environment variables check
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    logStep("Environment check", {
      supabaseUrl: supabaseUrl ? "present" : "missing",
      supabaseKey: supabaseKey ? "present" : "missing", 
      stripeKey: stripeKey ? "present" : "missing"
    });

    if (!supabaseUrl || !supabaseKey) {
      logStep("ERROR: Missing Supabase environment variables");
      throw new Error("Missing Supabase configuration");
    }

    if (!stripeKey) {
      logStep("ERROR: Missing Stripe secret key");
      throw new Error("Missing Stripe secret key");
    }

    // Create Supabase client
    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    logStep("Supabase client created");

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("ERROR: No authorization header");
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    logStep("Token extracted", { tokenLength: token.length });

    // Authenticate user
    logStep("=== AUTHENTICATING USER ===");
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

    logStep("User authenticated successfully", { 
      userId: user.id, 
      email: user.email.substring(0, 3) + "***" // Partial email for privacy
    });

    // Parse request body
    logStep("=== PARSING REQUEST BODY ===");
    let requestBody;
    try {
      requestBody = await req.json();
      logStep("Request body parsed", { keys: Object.keys(requestBody) });
    } catch (parseError) {
      logStep("ERROR: Failed to parse request body", { error: parseError.message });
      throw new Error("Invalid request body");
    }

    const { planName } = requestBody;
    if (!planName || typeof planName !== 'string') {
      logStep("ERROR: Missing or invalid planName", { planName });
      throw new Error("Missing or invalid planName");
    }

    // Securely map planName to priceId on server side
    const priceId = PLAN_MAPPING[planName as keyof typeof PLAN_MAPPING];
    if (!priceId) {
      logStep("ERROR: Invalid plan name", { planName, availablePlans: Object.keys(PLAN_MAPPING) });
      throw new Error("Invalid plan name");
    }

    logStep("Plan mapped successfully", { planName, priceId });

    // Initialize Stripe
    logStep("=== INITIALIZING STRIPE ===");
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Check for existing customer
    logStep("=== CHECKING FOR EXISTING CUSTOMER ===");
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
      logStep("No existing customer found, will create new one");
    }

    // Get origin for redirect URLs
    const origin = req.headers.get("origin") || "https://www.opobots.com";
    logStep("=== CREATING CHECKOUT SESSION ===", { 
      origin, 
      customerId: customerId ? "present" : "will_create", 
      priceId, 
      planName 
    });

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

    logStep("=== CHECKOUT SESSION CREATED SUCCESSFULLY ===", { 
      sessionId: session.id, 
      url: session.url ? "present" : "missing"
    });

    const response = JSON.stringify({ url: session.url });
    logStep("=== RETURNING RESPONSE ===", { responseLength: response.length });

    return new Response(response, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : 'No stack available';
    
    logStep("=== CRITICAL ERROR OCCURRED ===", { 
      message: errorMessage,
      type: error?.constructor?.name || 'Unknown',
      stack: stack?.split('\n').slice(0, 3).join('\n') // First 3 lines of stack
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
