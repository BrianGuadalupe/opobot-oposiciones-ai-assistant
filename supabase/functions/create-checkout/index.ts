
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Plan mapping con price IDs de LIVE mode
const PLAN_MAPPING = {
  "Básico": "price_1RakDbG0tRQIugBejNs3yiVA",
  "Profesional": "price_1RakGGG0tRQIugBefzFK7piu",
  "Academias": "price_1RakGkG0tRQIugBeECOoQI3p"
};

serve(async (req) => {
  const startTime = Date.now();
  console.log(`=== [${startTime}] FUNCTION STARTED ===`);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log(`[${Date.now() - startTime}ms] OPTIONS request - returning CORS headers`);
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`[${Date.now() - startTime}ms] 1. Checking HTTP method: ${req.method}`);
    
    if (req.method !== "POST") {
      console.error(`[${Date.now() - startTime}ms] Invalid method:`, req.method);
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 405,
      });
    }

    console.log(`[${Date.now() - startTime}ms] 2. Checking environment variables...`);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    console.log(`[${Date.now() - startTime}ms] Environment check:`, {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey,
      hasStripeKey: !!stripeKey,
      stripeKeyStart: stripeKey ? stripeKey.substring(0, 8) : "MISSING",
    });

    if (!supabaseUrl || !supabaseKey || !stripeKey) {
      const error = "Missing environment variables";
      console.error(`[${Date.now() - startTime}ms] CRITICAL:`, error);
      return new Response(JSON.stringify({ error }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    console.log(`[${Date.now() - startTime}ms] 3. Reading request body...`);
    let requestBody;
    try {
      const bodyText = await req.text();
      console.log(`[${Date.now() - startTime}ms] Raw body:`, bodyText);
      
      if (!bodyText || bodyText.trim() === '') {
        console.error(`[${Date.now() - startTime}ms] Empty body received`);
        return new Response(JSON.stringify({ error: "Empty request body" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
      
      requestBody = JSON.parse(bodyText);
      console.log(`[${Date.now() - startTime}ms] Parsed body:`, requestBody);
    } catch (error) {
      console.error(`[${Date.now() - startTime}ms] Body parsing error:`, error);
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const { planName } = requestBody;
    console.log(`[${Date.now() - startTime}ms] 4. Plan requested:`, planName);

    if (!planName) {
      console.error(`[${Date.now() - startTime}ms] No planName provided`);
      return new Response(JSON.stringify({ error: "Plan name required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Obtener price ID
    const priceId = PLAN_MAPPING[planName as keyof typeof PLAN_MAPPING];
    if (!priceId) {
      console.error(`[${Date.now() - startTime}ms] Invalid plan:`, planName);
      return new Response(JSON.stringify({ 
        error: "Invalid plan",
        availablePlans: Object.keys(PLAN_MAPPING)
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log(`[${Date.now() - startTime}ms] 5. Price ID:`, priceId);

    // Obtener usuario autenticado
    console.log(`[${Date.now() - startTime}ms] 6. Getting user info...`);
    const authHeader = req.headers.get("Authorization");
    console.log(`[${Date.now() - startTime}ms] Auth header exists:`, !!authHeader);
    
    let userEmail = "guest@opobots.com"; // fallback
    let userId = "guest";

    if (authHeader) {
      console.log(`[${Date.now() - startTime}ms] 7. Creating Supabase client...`);
      try {
        const supabaseClient = createClient(supabaseUrl, supabaseKey);
        console.log(`[${Date.now() - startTime}ms] 8. Supabase client created, getting user...`);
        
        const token = authHeader.replace("Bearer ", "");
        console.log(`[${Date.now() - startTime}ms] Token length:`, token.length);
        
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
        console.log(`[${Date.now() - startTime}ms] Auth response:`, { 
          hasUser: !!user, 
          error: authError?.message,
          userEmail: user?.email 
        });
        
        if (user?.email) {
          userEmail = user.email;
          userId = user.id;
          console.log(`[${Date.now() - startTime}ms] User authenticated:`, userEmail);
        } else {
          console.log(`[${Date.now() - startTime}ms] Auth failed, using guest`);
        }
      } catch (authErr) {
        console.error(`[${Date.now() - startTime}ms] Auth error:`, authErr);
        console.log(`[${Date.now() - startTime}ms] Continuing with guest user`);
      }
    } else {
      console.log(`[${Date.now() - startTime}ms] No auth header, using guest`);
    }

    console.log(`[${Date.now() - startTime}ms] 9. Final user info:`, { userEmail, userId });

    console.log(`[${Date.now() - startTime}ms] 10. Initializing Stripe...`);
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    console.log(`[${Date.now() - startTime}ms] Stripe initialized`);
    
    console.log(`[${Date.now() - startTime}ms] 11. Checking for existing customer...`);
    let customerId;
    try {
      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
      console.log(`[${Date.now() - startTime}ms] Customer search result:`, customers.data.length);
      
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        console.log(`[${Date.now() - startTime}ms] Found existing customer:`, customerId);
      } else {
        console.log(`[${Date.now() - startTime}ms] No existing customer found`);
      }
    } catch (customerErr) {
      console.error(`[${Date.now() - startTime}ms] Customer lookup error:`, customerErr);
    }

    console.log(`[${Date.now() - startTime}ms] 12. Creating checkout session...`);
    const origin = req.headers.get("origin") || "https://opobots.com";
    console.log(`[${Date.now() - startTime}ms] Origin:`, origin);

    const sessionData = {
      customer: customerId,
      customer_email: customerId ? undefined : userEmail,
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
        user_id: userId,
        plan_name: planName,
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
    };

    console.log(`[${Date.now() - startTime}ms] Session data:`, JSON.stringify(sessionData, null, 2));

    try {
      console.log(`[${Date.now() - startTime}ms] 13. Calling Stripe API...`);
      const session = await stripe.checkout.sessions.create(sessionData);
      console.log(`[${Date.now() - startTime}ms] 14. Session created successfully:`, session.id);
      console.log(`[${Date.now() - startTime}ms] Session URL:`, session.url);

      const response = {
        url: session.url,
        sessionId: session.id,
        timing: `${Date.now() - startTime}ms`
      };
      
      console.log(`[${Date.now() - startTime}ms] 15. Returning response:`, response);

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } catch (stripeErr) {
      console.error(`[${Date.now() - startTime}ms] STRIPE ERROR:`, stripeErr);
      throw stripeErr;
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const timingInfo = `${Date.now() - startTime}ms`;
    
    console.error(`[${timingInfo}] === CRITICAL ERROR ===`);
    console.error(`[${timingInfo}] Error:`, errorMessage);
    console.error(`[${timingInfo}] Stack:`, error instanceof Error ? error.stack : "No stack");
    console.error(`[${timingInfo}] Error type:`, typeof error);
    console.error(`[${timingInfo}] Error constructor:`, error?.constructor?.name);
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      timestamp: new Date().toISOString(),
      timing: timingInfo,
      errorType: typeof error,
      errorConstructor: error?.constructor?.name
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
