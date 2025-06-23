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

serve(async (req) => {
  // Siempre imprimir el inicio
  console.log('[🔍 CHECK-SUBSCRIPTION START]');
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Accept both GET and POST requests
  if (req.method !== "POST" && req.method !== "GET") {
    console.log('[❌ INVALID METHOD]', req.method);
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  // USAR SERVICE ROLE KEY para operaciones de escritura
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    // Verificar variables de entorno críticas
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      logStep("ERROR: Stripe key not configured");
      throw new Error("Service configuration error");
    }
    logStep("Stripe key verified");

    // Verificar autorización
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logStep("ERROR: Invalid authorization header");
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    
    const token = authHeader.replace("Bearer ", "");
    const inputValidation = validateInput(token);
    if (inputValidation) {
      logStep("ERROR: Invalid token format");
      return new Response(JSON.stringify({ error: "Invalid authentication token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    logStep("Authenticating user with token");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      logStep("ERROR: Authentication failed", { error: userError.message });
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    
    const user = userData.user;
    if (!user?.email) {
      logStep("ERROR: No user email available");
      return new Response(JSON.stringify({ error: "User authentication error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Buscar el stripe_customer_id desde la base de datos PRIMERO
    logStep("Looking up subscriber record in database");
    const { data: subscriberData, error: subscriberError } = await supabaseClient
      .from('subscribers')
      .select('stripe_customer_id, subscribed, subscription_tier, subscription_end')
      .eq('user_id', user.id)
      .single();

    if (subscriberError && subscriberError.code !== 'PGRST116') {
      logStep("ERROR: Database query failed", { error: subscriberError.message });
    }

    // Inicializar Stripe con timeout configurado
    const stripe = new Stripe(stripeKey, { 
      apiVersion: "2023-10-16",
      timeout: 4000,
    });
    
    let customerId = subscriberData?.stripe_customer_id;
    console.log('🔑 stripe_customer_id desde DB:', customerId);
    
    // Helper function para timeout manual
    const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Operation timeout after ${timeoutMs}ms`)), timeoutMs);
      });
      
      return Promise.race([promise, timeoutPromise]);
    };

    // Si no tenemos customer_id en la DB, buscar por email (solo la primera vez)
    if (!customerId) {
      logStep("No stripe_customer_id found in DB, searching by email");
      
      try {
        const customers = await withTimeout(
          stripe.customers.list({ 
            email: user.email, 
            limit: 1,
          }),
          3000
        );
        
        if (customers.data.length === 0) {
          logStep("No customer found in Stripe, updating unsubscribed state");
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

        customerId = customers.data[0].id;
        logStep("Found Stripe customer by email, saving to DB", { customerId });
        
        // 🔑 NUEVO: Guardar el customer_id en la DB para futuras consultas
        console.log('🔑 Guardando stripe_customer_id encontrado:', customerId);
        await supabaseClient.from("subscribers").upsert({
          email: user.email,
          user_id: user.id,
          stripe_customer_id: customerId,
          subscribed: false, // Se actualizará después
          subscription_tier: null,
          subscription_end: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'email' });
      } catch (customerError) {
        logStep("ERROR: Failed to fetch customer from Stripe", { error: customerError });
        // Return early con estado no suscrito en caso de timeout del customer
        return new Response(JSON.stringify({ 
          subscribed: false,
          error: "Customer lookup timeout"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    } else {
      logStep("Using stripe_customer_id from database", { customerId });
      console.log('🔑 Usando stripe_customer_id desde cache:', customerId);
    }

    // Usar directamente el customer_id para buscar suscripciones (CORREGIDO)
    logStep("Checking subscriptions with customer_id");
    console.log('🔍 Consultando suscripciones para customer:', customerId);
    
    let subscriptions;
    try {
      // CORREGIDO: Usar status: 'all' para incluir trialing, active, past_due, etc.
      subscriptions = await withTimeout(
        stripe.subscriptions.list({
          customer: customerId,
          status: "all", // Cambio clave: incluir todos los estados
          limit: 10, // Aumentar límite para ver más suscripciones
        }),
        3000
      );
      
      console.log('📦 Subs found:', subscriptions.data.length);
      if (subscriptions.data.length > 0) {
        console.log('🧾 First subscription status:', subscriptions.data[0]?.status);
        console.log('🧾 All subscription statuses:', subscriptions.data.map(s => s.status));
      }
      
      logStep("Stripe subscriptions.list completed successfully", { 
        resultCount: subscriptions.data.length,
        statuses: subscriptions.data.map(s => s.status)
      });
      
    } catch (subscriptionError) {
      logStep("ERROR: Failed to fetch subscriptions from Stripe", { error: subscriptionError });
      
      // Return early con el estado actual en DB si Stripe falla
      if (subscriberData) {
        logStep("Returning cached subscription state due to Stripe timeout");
        return new Response(JSON.stringify({
          subscribed: subscriberData.subscribed || false,
          subscription_tier: subscriberData.subscription_tier || null,
          subscription_end: subscriberData.subscription_end || null,
          cached: true
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      
      // Si no hay datos cached, devolver no suscrito
      return new Response(JSON.stringify({ 
        subscribed: false,
        error: "Subscription check timeout"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    
    // CORREGIDO: Verificar estados válidos de suscripción
    const validStatuses = ['active', 'trialing', 'past_due'];
    const activeSub = subscriptions.data.find(sub => validStatuses.includes(sub.status));
    const hasActiveSub = !!activeSub;
    
    console.log('✅ Valid subscription found:', hasActiveSub);
    if (activeSub) {
      console.log('✅ Active subscription status:', activeSub.status);
    }
    
    let subscriptionTier = null;
    let subscriptionEnd = null;

    if (hasActiveSub && activeSub) {
      subscriptionEnd = new Date(activeSub.current_period_end * 1000).toISOString();
      logStep("Active subscription found", { 
        subscriptionId: activeSub.id, 
        status: activeSub.status,
        endDate: subscriptionEnd 
      });
      
      try {
        const priceId = activeSub.items.data[0].price.id;
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
      } catch (priceError) {
        logStep("WARNING: Failed to fetch price details", { error: priceError });
        subscriptionTier = "Básico"; // Default tier si no podemos determinar el precio
      }
    } else {
      logStep("No active subscription found");
    }

    // Log the final subscription data before return
    const finalSubscriptionData = {
      subscribed: hasActiveSub,
      subscription_tier: subscriptionTier,
      subscription_end: subscriptionEnd
    };
    logStep("Final subscription data to return", finalSubscriptionData);

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
    
    console.log('[✅ CHECK-SUBSCRIPTION SUCCESS] Returning data:', finalSubscriptionData);
    
    return new Response(JSON.stringify(finalSubscriptionData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('[🔥 UNCAUGHT ERROR in check-subscription]', errorMessage);
    console.error('[🔥 ERROR STACK]', error instanceof Error ? error.stack : 'No stack trace');
    logStep("ERROR in check-subscription", { message: errorMessage });
    
    // Return generic error message to avoid information disclosure
    return new Response(JSON.stringify({ 
      error: "Unable to check subscription status" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
