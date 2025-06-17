
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
  // Cronometro para medir tiempo de ejecución
  const startTime = Date.now();
  const timeTracker = {
    start: startTime,
    current: () => Date.now() - startTime
  };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    logStep(`CORS preflight request handled in ${timeTracker.current()}ms`);
    return new Response(null, { headers: corsHeaders });
  }

  logStep(`=== FUNCTION STARTED ===`);
  
  try {
    // Environment variables check
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    logStep(`Environment check at ${timeTracker.current()}ms`, {
      supabaseUrl: supabaseUrl ? "present" : "missing",
      supabaseKey: supabaseKey ? "present" : "missing", 
      stripeKey: stripeKey ? "present" : "missing"
    });

    if (!supabaseUrl || !supabaseKey) {
      logStep("ERROR: Missing Supabase environment variables");
      return new Response(JSON.stringify({ 
        error: "Missing Supabase configuration"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    if (!stripeKey) {
      logStep("ERROR: Missing Stripe secret key");
      return new Response(JSON.stringify({ 
        error: "Missing Stripe secret key"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Create Supabase client
    logStep(`Creating Supabase client at ${timeTracker.current()}ms`);
    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    logStep(`Supabase client created at ${timeTracker.current()}ms`);

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep(`ERROR: No authorization header at ${timeTracker.current()}ms`);
      return new Response(JSON.stringify({ 
        error: "No authorization header provided"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    logStep(`Token extracted at ${timeTracker.current()}ms`, { tokenLength: token.length });

    // Authenticate user
    logStep(`=== AUTHENTICATING USER at ${timeTracker.current()}ms ===`);
    const authResponse = await supabaseClient.auth.getUser(token);
    
    if (authResponse.error) {
      logStep(`ERROR: Authentication failed at ${timeTracker.current()}ms`, { error: authResponse.error.message });
      return new Response(JSON.stringify({ 
        error: `Authentication failed: ${authResponse.error.message}`
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const user = authResponse.data.user;
    if (!user?.email) {
      logStep(`ERROR: No user or email at ${timeTracker.current()}ms`);
      return new Response(JSON.stringify({ 
        error: "User not authenticated or email not available"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    logStep(`User authenticated successfully at ${timeTracker.current()}ms`, { 
      userId: user.id, 
      email: user.email.substring(0, 3) + "***"
    });

    // Parse request body
    logStep(`=== PARSING REQUEST BODY at ${timeTracker.current()}ms ===`);
    let requestBody;
    try {
      const bodyText = await req.text();
      logStep(`Raw body received at ${timeTracker.current()}ms`, { bodyLength: bodyText.length });
      
      if (!bodyText) {
        throw new Error("Empty request body");
      }
      
      requestBody = JSON.parse(bodyText);
      logStep(`Request body parsed at ${timeTracker.current()}ms`, { keys: Object.keys(requestBody) });
    } catch (parseError) {
      logStep(`ERROR: Failed to parse request body at ${timeTracker.current()}ms`, { 
        error: parseError instanceof Error ? parseError.message : String(parseError) 
      });
      return new Response(JSON.stringify({ 
        error: "Invalid request body"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const { planName } = requestBody;
    if (!planName || typeof planName !== 'string') {
      logStep(`ERROR: Missing or invalid planName at ${timeTracker.current()}ms`, { planName });
      return new Response(JSON.stringify({ 
        error: "Missing or invalid planName"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Securely map planName to priceId on server side
    const priceId = PLAN_MAPPING[planName as keyof typeof PLAN_MAPPING];
    if (!priceId) {
      logStep(`ERROR: Invalid plan name at ${timeTracker.current()}ms`, { 
        planName, 
        availablePlans: Object.keys(PLAN_MAPPING) 
      });
      return new Response(JSON.stringify({ 
        error: "Invalid plan name"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep(`Plan mapped successfully at ${timeTracker.current()}ms`, { planName, priceId });

    // Initialize Stripe
    try {
      logStep(`=== INITIALIZING STRIPE at ${timeTracker.current()}ms ===`);
      const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
      logStep(`Stripe initialized at ${timeTracker.current()}ms`);
      
      // Check for existing customer
      logStep(`=== CHECKING FOR EXISTING CUSTOMER at ${timeTracker.current()}ms ===`);
      const customers = await stripe.customers.list({ 
        email: user.email, 
        limit: 1 
      });
      logStep(`Customer search completed at ${timeTracker.current()}ms`, { customersFound: customers.data.length });

      let customerId;
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        logStep(`Existing customer found at ${timeTracker.current()}ms`, { customerId });
      } else {
        logStep(`No existing customer found at ${timeTracker.current()}ms, will create new one during checkout`);
      }

      // Get origin for redirect URLs
      const origin = req.headers.get("origin") || "https://www.opobots.com";
      logStep(`=== CREATING CHECKOUT SESSION at ${timeTracker.current()}ms ===`, { 
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

      logStep(`=== CHECKOUT SESSION CREATED SUCCESSFULLY at ${timeTracker.current()}ms ===`, { 
        sessionId: session.id, 
        url: session.url ? "present" : "missing"
      });

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } catch (stripeError) {
      logStep(`=== STRIPE ERROR at ${timeTracker.current()}ms ===`, { 
        error: stripeError instanceof Error ? stripeError.message : String(stripeError)  
      });
      return new Response(JSON.stringify({ 
        error: stripeError instanceof Error ? stripeError.message : "Stripe error occurred"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : 'No stack available';
    
    logStep(`=== CRITICAL ERROR OCCURRED at ${timeTracker.current()}ms ===`, { 
      message: errorMessage,
      type: error?.constructor?.name || 'Unknown',
      stack: stack?.split('\n').slice(0, 3).join('\n')
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
