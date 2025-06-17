
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Test Supabase client creation
    logStep("Creating Supabase client");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    logStep("Supabase client created successfully");

    // Test auth header extraction
    logStep("Checking authorization header");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("ERROR: No authorization header provided");
      throw new Error("No authorization header provided");
    }
    logStep("Authorization header found", { headerLength: authHeader.length });
    
    // Test token extraction
    const token = authHeader.replace("Bearer ", "");
    logStep("Token extracted", { tokenLength: token.length });

    // Test user authentication - THIS IS WHERE IT MIGHT BE HANGING
    logStep("About to call supabaseClient.auth.getUser");
    const startTime = Date.now();
    
    const { data } = await supabaseClient.auth.getUser(token);
    const authTime = Date.now() - startTime;
    logStep("Auth call completed", { timeMs: authTime });
    
    const user = data.user;
    if (!user?.email) {
      logStep("ERROR: User not authenticated or email not available");
      throw new Error("User not authenticated or email not available");
    }
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Test request body parsing
    logStep("About to parse request body");
    let requestBody;
    try {
      const bodyText = await req.text();
      logStep("Request body received", { bodyLength: bodyText.length });
      
      if (!bodyText || bodyText.trim() === '') {
        throw new Error("Empty request body");
      }
      
      requestBody = JSON.parse(bodyText);
      logStep("Request body parsed successfully", requestBody);
    } catch (parseError) {
      logStep("JSON parsing error", { error: parseError.message });
      throw new Error("Invalid JSON in request body");
    }

    const { priceId, planName } = requestBody;
    if (!priceId || !planName) {
      logStep("ERROR: Missing priceId or planName");
      throw new Error("Missing priceId or planName");
    }
    logStep("Request data validated", { priceId, planName });

    // Test Stripe key retrieval
    logStep("Checking Stripe secret key");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      logStep("ERROR: STRIPE_SECRET_KEY not found");
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    
    if (!stripeKey.startsWith('sk_')) {
      logStep("ERROR: Invalid Stripe key format", { keyPrefix: stripeKey.substring(0, 10) });
      throw new Error("Invalid Stripe secret key format");
    }

    logStep("Stripe key validated", { keyPrefix: stripeKey.substring(0, 10) });

    // Test Stripe client creation
    logStep("Creating Stripe client");
    const stripe = new Stripe(stripeKey, { 
      apiVersion: "2023-10-16" 
    });
    logStep("Stripe client created successfully");

    // Test customer lookup - THIS MIGHT ALSO HANG
    logStep("About to search for existing customer");
    const customerStartTime = Date.now();
    
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerTime = Date.now() - customerStartTime;
    logStep("Customer search completed", { timeMs: customerTime, customersFound: customers.data.length });
    
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      logStep("No existing customer found");
    }

    // Test session creation - THIS IS MOST LIKELY TO HANG
    const origin = req.headers.get("origin") || "https://www.opobots.com";
    logStep("About to create Stripe checkout session", { origin, customerId, priceId });
    
    const sessionStartTime = Date.now();
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
    const sessionTime = Date.now() - sessionStartTime;

    logStep("Checkout session created successfully", { 
      sessionId: session.id, 
      url: session.url,
      timeMs: sessionTime 
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-checkout", { message: errorMessage, stack: error instanceof Error ? error.stack : 'No stack' });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
