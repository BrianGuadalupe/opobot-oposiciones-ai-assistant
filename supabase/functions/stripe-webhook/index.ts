
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

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Solo aceptar POST requests
  if (req.method !== "POST") {
    logStep("ERROR: Invalid method", { method: req.method });
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // 1. OBTENER VARIABLES DE ENTORNO
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey || !webhookSecret) {
      logStep("ERROR: Missing environment variables");
      return new Response("Server configuration error", { status: 500 });
    }

    // 2. LEER RAW BODY (CRÍTICO PARA STRIPE)
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      logStep("ERROR: No Stripe signature header");
      return new Response("No signature", { status: 400 });
    }

    logStep("Webhook data received", {
      bodyLength: rawBody.length,
      hasSignature: !!signature
    });

    // 3. INICIALIZAR STRIPE
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // 4. VERIFICAR FIRMA DE STRIPE (CRÍTICO PARA SEGURIDAD)
    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
      logStep("Webhook signature verified", { eventType: event.type });
    } catch (err) {
      logStep("ERROR: Webhook signature verification failed", { 
        error: err.message,
        signatureLength: signature.length 
      });
      return new Response("Invalid signature", { status: 400 });
    }

    // 5. CREAR CLIENTE SUPABASE
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // 6. MANEJAR EVENTOS ESPECÍFICOS
    logStep("Processing event", { type: event.type, id: event.id });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout session completed", {
          sessionId: session.id,
          customerId: session.customer,
          subscriptionId: session.subscription
        });

        // Obtener metadatos del usuario
        const userId = session.metadata?.user_id;
        const planName = session.metadata?.plan_name;
        
        if (!userId) {
          logStep("WARNING: No user_id in session metadata");
          break;
        }

        // Actualizar suscripción en base de datos
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
        logStep("Subscription updated", {
          subscriptionId: subscription.id,
          status: subscription.status,
          customerId: subscription.customer
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
          logStep("Subscription status updated", { 
            customerId: subscription.customer,
            status: subscription.status 
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription cancelled", {
          subscriptionId: subscription.id,
          customerId: subscription.customer
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
        logStep("Payment failed", {
          invoiceId: invoice.id,
          customerId: invoice.customer,
          amount: invoice.amount_due
        });

        // Aquí puedes enviar emails de notificación, etc.
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    // 7. RESPONDER INMEDIATAMENTE (CRÍTICO)
    logStep("Webhook processed successfully");
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("CRITICAL ERROR in webhook", { error: errorMessage });
    
    // SIEMPRE devolver 500 para que Stripe reintente
    return new Response(`Webhook error: ${errorMessage}`, { status: 500 });
  }
});
