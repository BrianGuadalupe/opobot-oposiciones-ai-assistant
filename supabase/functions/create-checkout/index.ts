
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Plan mapping simplificado
const PLAN_MAPPING = {
  "Básico": "price_1RakDbG0tRQIugBejNs3yiVA",
  "Profesional": "price_1RakGGG0tRQIugBefzFK7piu"
};

serve(async (req) => {
  console.log("=== FUNCTION STARTED ===");
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log("OPTIONS request - returning CORS headers");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("1. Checking environment variables...");
    
    // Verificar variables de entorno
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    console.log("Environment check:", {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey,
      hasStripeKey: !!stripeKey,
      stripeKeyStart: stripeKey ? stripeKey.substring(0, 8) : "MISSING"
    });

    if (!supabaseUrl || !supabaseKey || !stripeKey) {
      const error = "Missing environment variables";
      console.error("CRITICAL:", error);
      return new Response(JSON.stringify({ error }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    console.log("2. Checking HTTP method...");
    if (req.method !== "POST") {
      console.error("Invalid method:", req.method);
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 405,
      });
    }

    console.log("3. Creating Supabase client...");
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    console.log("4. Checking authentication...");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header");
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("Token length:", token.length);

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user?.email) {
      console.error("Auth failed:", authError?.message);
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    console.log("5. User authenticated:", user.email);

    console.log("6. Parsing request body...");
    let requestBody;
    try {
      const bodyText = await req.text();
      console.log("Raw body:", bodyText);
      requestBody = JSON.parse(bodyText);
      console.log("Parsed body:", requestBody);
    } catch (error) {
      console.error("Body parsing error:", error);
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const { planName } = requestBody;
    console.log("7. Plan requested:", planName);

    if (!planName) {
      console.error("No planName provided");
      return new Response(JSON.stringify({ error: "Plan name required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Obtener price ID
    const priceId = PLAN_MAPPING[planName as keyof typeof PLAN_MAPPING];
    if (!priceId) {
      console.error("Invalid plan:", planName);
      return new Response(JSON.stringify({ 
        error: "Invalid plan",
        availablePlans: Object.keys(PLAN_MAPPING)
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log("8. Price ID:", priceId);

    console.log("9. Initializing Stripe...");
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    console.log("10. Checking for existing customer...");
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      console.log("Found existing customer:", customerId);
    } else {
      console.log("No existing customer found");
    }

    console.log("11. Creating checkout session...");
    const origin = req.headers.get("origin") || "https://opobots.com";
    console.log("Origin:", origin);

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

    console.log("Session data:", JSON.stringify(sessionData, null, 2));

    const session = await stripe.checkout.sessions.create(sessionData);

    console.log("12. Session created successfully:", session.id);
    console.log("Session URL:", session.url);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("=== CRITICAL ERROR ===");
    console.error("Error:", errorMessage);
    console.error("Stack:", error instanceof Error ? error.stack : "No stack");
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
