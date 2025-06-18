
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { handleSecureError } from '@/utils/securityUtils';
import { checkSubscriptionStatus } from '@/utils/subscriptionApi';
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

  // Solo redirigir a Stripe Checkout externo - sin crear sesiones
  const redirectToStripeCheckout = (planName: string) => {
    console.log('=== REDIRECTING TO EXTERNAL STRIPE CHECKOUT ===');
    console.log('Plan:', planName);
    
    // URLs directas de Stripe Checkout (configuradas en tu dashboard de Stripe)
    const checkoutUrls = {
      'Básico': 'https://buy.stripe.com/basic-plan-url', // Reemplaza con tu URL real
      'Profesional': 'https://buy.stripe.com/pro-plan-url', // Reemplaza con tu URL real  
      'Academias': 'https://buy.stripe.com/academy-plan-url' // Reemplaza con tu URL real
    };
    
    const checkoutUrl = checkoutUrls[planName as keyof typeof checkoutUrls];
    
    if (!checkoutUrl) {
      console.error('No checkout URL found for plan:', planName);
      return;
    }
    
    console.log('Redirecting to:', checkoutUrl);
    window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
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
    openCustomerPortal,
  };
};

export type { SubscriptionStatus };
