
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { handleSecureError, validateSession } from '@/utils/securityUtils';

export interface SubscriptionStatus {
  subscribed: boolean;
  subscription_tier?: string;
  subscription_end?: string;
  loading: boolean;
}

export const useSubscription = () => {
  const { user, session } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({
    subscribed: false,
    loading: true,
  });
  const [loading, setLoading] = useState(false);

  const checkSubscription = useCallback(async () => {
    if (!user || !session || !validateSession(session)) {
      console.log('No valid user session for subscription check');
      setSubscriptionStatus({
        subscribed: false,
        loading: false,
      });
      return;
    }

    try {
      setSubscriptionStatus(prev => ({ ...prev, loading: true }));
      
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (error) {
        console.error('Subscription check error:', error);
        throw new Error('Failed to check subscription status');
      }

      // Validate response data
      if (!data || typeof data.subscribed !== 'boolean') {
        throw new Error('Invalid subscription data received');
      }

      setSubscriptionStatus({
        subscribed: data.subscribed,
        subscription_tier: data.subscription_tier,
        subscription_end: data.subscription_end,
        loading: false,
      });
    } catch (error) {
      console.error('Error checking subscription:', error);
      handleSecureError(error, 'Error al verificar el estado de la suscripción');
      setSubscriptionStatus({
        subscribed: false,
        loading: false,
      });
    }
  }, [user, session]);

  const createCheckoutSession = async (planName: string) => {
    console.log('=== DIRECT STRIPE CHECKOUT ===');
    console.log('Plan name:', planName);
    
    // Redirect to auth if no user
    if (!user || !session || !validateSession(session)) {
      console.log('No valid session, redirecting to auth');
      toast({
        title: "Regístrate",
        description: "Necesitas registrarte para suscribirte.",
      });
      window.location.href = '/auth?mode=register';
      return;
    }

    // Validate planName
    if (!planName || typeof planName !== 'string') {
      console.error('Invalid planName:', planName);
      toast({
        title: "Error",
        description: "Nombre del plan no válido",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      console.log('=== CREATING DIRECT CHECKOUT ===');
      
      // Plan mapping - esto debería estar sincronizado con Stripe
      const PLAN_MAPPING = {
        "Básico": "price_1RakDbG0tRQIugBejNs3yiVA",
        "Profesional": "price_1RakGGG0tRQIugBefzFK7piu"
      };

      const priceId = PLAN_MAPPING[planName as keyof typeof PLAN_MAPPING];
      if (!priceId) {
        throw new Error('Plan no válido');
      }

      console.log('Price ID found:', priceId);

      // Crear URL de checkout directamente con Stripe
      const origin = window.location.origin;
      const stripeCheckoutUrl = `https://checkout.stripe.com/pay/cs_test_a1${btoa(JSON.stringify({
        price: priceId,
        mode: 'subscription',
        success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?canceled=true`,
        customer_email: user.email,
        metadata: {
          user_id: user.id,
          plan_name: planName,
        }
      }))}`;

      console.log('=== REDIRECTING TO STRIPE DIRECTLY ===');
      console.log('Checkout URL:', stripeCheckoutUrl);
      
      // Redirect to Stripe checkout
      window.location.href = stripeCheckoutUrl;
      
    } catch (error) {
      console.error('=== CHECKOUT ERROR ===');
      console.error('Error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      toast({
        title: "Error de Pago",
        description: `No se pudo iniciar el proceso de pago: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      console.log('=== CHECKOUT COMPLETE ===');
      setLoading(false);
    }
  };

  const openCustomerPortal = async () => {
    if (!user || !session || !validateSession(session)) {
      toast({
        title: "Error", 
        description: "Debes iniciar sesión para gestionar tu suscripción",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (error) {
        console.error('Customer portal error:', error);
        throw new Error('Failed to open customer portal');
      }

      if (!data?.url || typeof data.url !== 'string') {
        throw new Error('Invalid portal URL received');
      }

      // Validate URL before opening
      try {
        new URL(data.url);
      } catch {
        throw new Error('Invalid portal URL format');
      }

      // Open customer portal in a new tab
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error opening customer portal:', error);
      handleSecureError(error, 'No se pudo abrir el portal de gestión');
    }
  };

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  return {
    ...subscriptionStatus,
    checkSubscription,
    createCheckoutSession,
    openCustomerPortal,
    loading,
  };
};
