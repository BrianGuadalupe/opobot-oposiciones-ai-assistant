
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const logStep = (step: string, details?: any) => {
  // Remove sensitive data from logs
  const sanitizedDetails = details ? {
    ...details,
    email: details.email ? `${details.email.substring(0, 3)}***` : undefined,
    customerId: details.customerId ? `${details.customerId.substring(0, 8)}***` : undefined,
    subscriptionId: details.subscriptionId ? `${details.subscriptionId.substring(0, 8)}***` : undefined,
  } : undefined;
  
  const detailsStr = sanitizedDetails ? ` - ${JSON.stringify(sanitizedDetails)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

const validateInput = (input: any): string | null => {
  if (!input || typeof input !== 'string' || input.length > 1000) {
    return 'Invalid input format';
  }
  return null;
};

// DUMMY RESPONSE TEMPORAL PARA TESTING
const ENABLE_DUMMY_RESPONSE = true;
const DUMMY_RESPONSE = {
  subscribed: true,
  subscription_tier: "Profesional",
  subscription_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 días
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Accept both GET and POST requests
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      logStep("ERROR: Stripe key not configured");
      
      // Si no hay clave de Stripe, devolver respuesta dummy si está habilitada
      if (ENABLE_DUMMY_RESPONSE) {
        logStep("Returning dummy response due to missing Stripe key");
        return new Response(JSON.stringify(DUMMY_RESPONSE), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      
      throw new Error("Service configuration error");
    }
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logStep("ERROR: Invalid authorization header");
      throw new Error("Authentication required");
    }
    
    const token = authHeader.replace("Bearer ", "");
    const inputValidation = validateInput(token);
    if (inputValidation) {
      logStep("ERROR: Invalid token format");
      throw new Error("Invalid authentication token");
    }

    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      logStep("ERROR: Authentication failed", { error: userError.message });
      throw new Error("Authentication failed");
    }
    
    const user = userData.user;
    if (!user?.email) {
      logStep("ERROR: No user email available");
      throw new Error("User authentication error");
    }
    logStep("User authenticated", { userId: user.id, email: user.email });

    // RESPUESTA DUMMY TEMPORAL - ELIMINAR EN PRODUCCIÓN
    if (ENABLE_DUMMY_RESPONSE) {
      logStep("RETURNING DUMMY RESPONSE FOR TESTING - REMOVE IN PRODUCTION");
      
      // Actualizar base de datos con respuesta dummy
      await supabaseClient.from("subscribers").upsert({
        email: user.email,
        user_id: user.id,
        stripe_customer_id: "dummy_customer_id",
        subscribed: DUMMY_RESPONSE.subscribed,
        subscription_tier: DUMMY_RESPONSE.subscription_tier,
        subscription_end: DUMMY_RESPONSE.subscription_end,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'email' });
      
      return new Response(JSON.stringify(DUMMY_RESPONSE), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // CÓDIGO REAL DE STRIPE (solo si dummy está deshabilitado)
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    logStep("Starting Stripe customer lookup with timeout protection");
    
    // Timeout protection para consultas de Stripe
    const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Operation timeout after ${timeoutMs}ms`)), timeoutMs);
      });
      
      return Promise.race([promise, timeoutPromise]);
    };

    // Buscar customer con timeout de 3 segundos
    const customers = await withTimeout(
      stripe.customers.list({ 
        email: user.email, 
        limit: 1,
        expand: ['data.subscriptions']
      }),
      3000
    );
    
    if (customers.data.length === 0) {
      logStep("No customer found, updating unsubscribed state");
      await supabaseClient.from("subscribers").upsert({
        email: user.email,
        user_id: user.id,
        stripe_customer_id: null,
        subscribed: false,
        subscription_tier: null,
        subscription_end: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'email' });
      
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Buscar suscripciones activas con timeout de 3 segundos
    const subscriptions = await withTimeout(
      stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      }),
      3000
    );
    
    const hasActiveSub = subscriptions.data.length > 0;
    let subscriptionTier = null;
    let subscriptionEnd = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      logStep("Active subscription found", { subscriptionId: subscription.id, endDate: subscriptionEnd });
      
      const priceId = subscription.items.data[0].price.id;
      const price = await withTimeout(stripe.prices.retrieve(priceId), 2000);
      const amount = price.unit_amount || 0;
      
      // Map amounts to tiers securely
      if (amount <= 1000) {
        subscriptionTier = "Básico";
      } else if (amount <= 2000) {
        subscriptionTier = "Profesional";
      } else {
        subscriptionTier = "Academias";
      }
      logStep("Determined subscription tier", { priceId, amount, subscriptionTier });
    } else {
      logStep("No active subscription found");
    }

    // Update database with validated data
    await supabaseClient.from("subscribers").upsert({
      email: user.email,
      user_id: user.id,
      stripe_customer_id: customerId,
      subscribed: hasActiveSub,
      subscription_tier: subscriptionTier,
      subscription_end: subscriptionEnd,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email' });

    logStep("Updated database with subscription info", { subscribed: hasActiveSub, subscriptionTier });
    
    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      subscription_tier: subscriptionTier,
      subscription_end: subscriptionEnd
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    logStep("ERROR in check-subscription", { message: errorMessage });
    
    // En caso de error, si dummy está habilitado, devolver respuesta dummy
    if (ENABLE_DUMMY_RESPONSE && errorMessage.includes('timeout')) {
      logStep("Returning dummy response due to timeout error");
      return new Response(JSON.stringify(DUMMY_RESPONSE), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    
    // Return generic error message to avoid information disclosure
    return new Response(JSON.stringify({ 
      error: "Unable to check subscription status" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
