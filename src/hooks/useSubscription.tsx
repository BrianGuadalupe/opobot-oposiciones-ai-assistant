
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { handleSecureError } from '@/utils/securityUtils';
import { checkSubscriptionStatus, createStripeCheckout } from '@/utils/subscriptionApi';
import { supabase } from '@/integrations/supabase/client';
import type { SubscriptionStatus } from '@/types/subscription';

export const useSubscription = () => {
  const { user, session } = useAuth();
  
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({
    subscribed: false,
    loading: true,
  });
  const [hasCheckedSubscription, setHasCheckedSubscription] = useState(false);

  const checkSubscription = useCallback(async () => {
    // Wait for auth to be fully loaded
    if (!user || !session?.access_token) {
      console.log('Subscription check: Waiting for complete auth session');
      setSubscriptionStatus({
        subscribed: false,
        loading: false,
      });
      return;
    }

    // Prevent multiple simultaneous calls
    if (subscriptionStatus.loading) {
      console.log('Subscription check already in progress, skipping...');
      return;
    }

    try {
      setSubscriptionStatus(prev => ({ ...prev, loading: true }));
      
      const data = await checkSubscriptionStatus(user.id, session.access_token);

      setSubscriptionStatus({
        subscribed: data.subscribed,
        subscription_tier: data.subscription_tier,
        subscription_end: data.subscription_end,
        loading: false,
      });
      
      setHasCheckedSubscription(true);
    } catch (error) {
      console.error('Error checking subscription:', error);
      handleSecureError(error, 'Error al verificar el estado de la suscripción');
      setSubscriptionStatus({
        subscribed: false,
        loading: false,
      });
      setHasCheckedSubscription(true);
    }
  }, [user, session?.access_token, subscriptionStatus.loading]);

  // Función principal de redirección a Stripe Checkout
  const redirectToStripeCheckout = async (planName: string) => {
    console.log('=== STRIPE CHECKOUT REDIRECT START ===');
    console.log('Plan:', planName);
    console.log('User:', !!user);
    console.log('Session:', !!session?.access_token);
    
    if (!user || !session?.access_token) {
      console.log('❌ No user session for checkout');
      handleSecureError(new Error('No authenticated session'), 'Debes iniciar sesión para suscribirte');
      return;
    }

    try {
      console.log('🔄 Creating checkout session...');
      const data = await createStripeCheckout(planName, session.access_token);
      
      console.log('✅ Checkout session created:', data);
      
      if (!data?.url) {
        throw new Error('No se recibió la URL de checkout de Stripe');
      }

      console.log('🌐 Redirecting to Stripe Checkout URL:', data.url);
      
      // Opción 1: Redirección directa (recomendada)
      console.log('Using window.location.href for redirect...');
      window.location.href = data.url;
      
    } catch (error) {
      console.error('❌ Error in checkout redirect:', error);
      handleSecureError(error, 'Error al crear la sesión de pago');
    }
  };

  // Función alternativa usando sessionId (si prefieres esta opción)
  const redirectToStripeCheckoutWithSessionId = async (planName: string) => {
    console.log('=== STRIPE CHECKOUT WITH SESSION ID START ===');
    console.log('Plan:', planName);
    
    if (!user || !session?.access_token) {
      console.log('❌ No user session for checkout');
      handleSecureError(new Error('No authenticated session'), 'Debes iniciar sesión para suscribirte');
      return;
    }

    try {
      console.log('🔄 Creating checkout session...');
      const data = await createStripeCheckout(planName, session.access_token);
      
      console.log('✅ Checkout session created:', data);
      
      if (!data?.sessionId) {
        throw new Error('No se recibió el sessionId de Stripe');
      }

      console.log('🌐 Redirecting with sessionId:', data.sessionId);
      
      // Opción 2: Usando Stripe.js (requiere cargar Stripe en el frontend)
      // Nota: Necesitarías instalar @stripe/stripe-js para usar esto
      /*
      const stripe = await loadStripe('tu_publishable_key_aquí');
      if (stripe) {
        const { error } = await stripe.redirectToCheckout({
          sessionId: data.sessionId
        });
        if (error) {
          console.error('Stripe redirect error:', error);
          handleSecureError(error, 'Error al redirigir a Stripe');
        }
      }
      */
      
      // Alternativa sin Stripe.js: construir URL manualmente
      const checkoutUrl = `https://checkout.stripe.com/c/pay/${data.sessionId}`;
      console.log('Constructed checkout URL:', checkoutUrl);
      window.location.href = checkoutUrl;
      
    } catch (error) {
      console.error('❌ Error in checkout redirect:', error);
      handleSecureError(error, 'Error al crear la sesión de pago');
    }
  };

  // Customer portal sigue igual ya que no interfiere con webhooks
  const openCustomerPortal = async () => {
    if (!user || !session?.access_token) {
      console.log('No user session for customer portal');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
      handleSecureError(error, 'No se pudo abrir el portal de gestión');
    }
  };

  // Only run checkSubscription once when we have a complete session
  useEffect(() => {
    if (user && session?.access_token && !hasCheckedSubscription) {
      console.log('Auth complete, checking subscription...');
      checkSubscription();
    }
  }, [user, session?.access_token, hasCheckedSubscription, checkSubscription]);

  return {
    ...subscriptionStatus,
    checkSubscription,
    redirectToStripeCheckout,
    redirectToStripeCheckoutWithSessionId, // Función alternativa
    openCustomerPortal,
  };
};

export type { SubscriptionStatus };
