
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [STRIPE-WEBHOOK] ${step}`);
  if (details) {
    console.log(`[${timestamp}] [STRIPE-WEBHOOK] Details:`, JSON.stringify(details, null, 2));
  }
};

serve(async (req) => {
  logStep("=== WEBHOOK RECEIVED ===");
  logStep("Request method", { method: req.method });
  logStep("Request headers", Object.fromEntries(req.headers.entries()));

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    logStep("Handling CORS preflight");
    return new Response(null, { headers: corsHeaders });
  }

  // Solo aceptar POST requests
  if (req.method !== "POST") {
    logStep("ERROR: Invalid method", { method: req.method });
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // 1. OBTENER VARIABLES DE ENTORNO
    logStep("Checking environment variables");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    logStep("Environment variables check", {
      hasStripeKey: !!stripeKey,
      stripeKeyLength: stripeKey ? stripeKey.length : 0,
      hasWebhookSecret: !!webhookSecret,
      webhookSecretLength: webhookSecret ? webhookSecret.length : 0,
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseServiceKey: !!supabaseServiceKey,
      supabaseUrl
    });
    
    if (!stripeKey || !webhookSecret) {
      logStep("ERROR: Missing environment variables", {
        missingStripeKey: !stripeKey,
        missingWebhookSecret: !webhookSecret
      });
      return new Response("Server configuration error", { status: 500 });
    }

    // 2. LEER RAW BODY (CRÍTICO PARA STRIPE)
    logStep("Reading raw body");
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature");

    logStep("Webhook data received", {
      bodyLength: rawBody.length,
      hasSignature: !!signature,
      signatureLength: signature ? signature.length : 0,
      bodyPreview: rawBody.substring(0, 100) + (rawBody.length > 100 ? '...' : '')
    });

    if (!signature) {
      logStep("ERROR: No Stripe signature header");
      return new Response("No signature", { status: 400 });
    }

    // 3. INICIALIZAR STRIPE
    logStep("Initializing Stripe client");
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // 4. VERIFICAR FIRMA DE STRIPE (CRÍTICO PARA SEGURIDAD)
    logStep("Verifying webhook signature");
    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
      logStep("Webhook signature verified successfully", { 
        eventType: event.type,
        eventId: event.id,
        created: event.created
      });
    } catch (err) {
      logStep("ERROR: Webhook signature verification failed", { 
        error: err.message,
        signatureLength: signature.length,
        bodyLength: rawBody.length,
        webhookSecretLength: webhookSecret.length
      });
      return new Response("Invalid signature", { status: 400 });
    }

    // 5. CREAR CLIENTE SUPABASE
    logStep("Creating Supabase client");
    const supabase = createClient(
      supabaseUrl ?? "",
      supabaseServiceKey ?? "",
      { auth: { persistSession: false } }
    );

    // 6. MANEJAR EVENTOS ESPECÍFICOS
    logStep("Processing event", { 
      type: event.type, 
      id: event.id,
      livemode: event.livemode,
      created: new Date(event.created * 1000).toISOString()
    });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Processing checkout.session.completed", {
          sessionId: session.id,
          customerId: session.customer,
          subscriptionId: session.subscription,
          mode: session.mode,
          paymentStatus: session.payment_status,
          customerEmail: session.customer_email
        });

        // Obtener metadatos del usuario
        const userId = session.metadata?.user_id;
        const planName = session.metadata?.plan_name;
        
        logStep("Session metadata", {
          userId,
          planName,
          allMetadata: session.metadata
        });
        
        if (!userId) {
          logStep("WARNING: No user_id in session metadata");
          break;
        }

        // Actualizar suscripción en base de datos
        logStep("Updating subscription in database");
        const { error: updateError } = await supabase
          .from("subscribers")
          .upsert({
            user_id: userId,
            stripe_customer_id: session.customer,
            subscription_id: session.subscription,
            subscribed: true,
            subscription_tier: planName,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });

        if (updateError) {
          logStep("ERROR: Failed to update subscription", { error: updateError });
        } else {
          logStep("Subscription updated successfully", { userId, planName });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Processing customer.subscription.updated", {
          subscriptionId: subscription.id,
          status: subscription.status,
          customerId: subscription.customer,
          currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString()
        });

        // Actualizar estado de suscripción
        const { error: updateError } = await supabase
          .from("subscribers")
          .update({
            subscribed: subscription.status === "active",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", subscription.customer);

        if (updateError) {
          logStep("ERROR: Failed to update subscription status", { error: updateError });
        } else {
          logStep("Subscription status updated successfully", { 
            customerId: subscription.customer,
            status: subscription.status 
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Processing customer.subscription.deleted", {
          subscriptionId: subscription.id,
          customerId: subscription.customer,
          canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null
        });

        // Marcar como no suscrito
        const { error: updateError } = await supabase
          .from("subscribers")
          .update({
            subscribed: false,
            subscription_tier: null,
            subscription_end: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", subscription.customer);

        if (updateError) {
          logStep("ERROR: Failed to cancel subscription", { error: updateError });
        } else {
          logStep("Subscription cancelled successfully", { customerId: subscription.customer });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Processing invoice.payment_failed", {
          invoiceId: invoice.id,
          customerId: invoice.customer,
          amount: invoice.amount_due,
          currency: invoice.currency,
          attemptCount: invoice.attempt_count
        });

        // Aquí puedes enviar emails de notificación, etc.
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Processing invoice.payment_succeeded", {
          invoiceId: invoice.id,
          customerId: invoice.customer,
          amount: invoice.amount_paid,
          currency: invoice.currency,
          subscriptionId: invoice.subscription
        });
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    // 7. RESPONDER INMEDIATAMENTE (CRÍTICO)
    logStep("Webhook processed successfully - sending response");
    return new Response(JSON.stringify({ 
      received: true,
      eventType: event.type,
      eventId: event.id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("CRITICAL ERROR in webhook", { 
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // SIEMPRE devolver 500 para que Stripe reintente
    return new Response(`Webhook error: ${errorMessage}`, { status: 500 });
  }
});
