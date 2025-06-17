
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

  const createCheckoutSession = async (priceId: string, planName: string) => {
    if (!user || !session || !validateSession(session)) {
      toast({
        title: "Error",
        description: "Debes iniciar sesión para suscribirte",
        variant: "destructive",
      });
      return;
    }

    // Validate inputs
    if (!priceId || typeof priceId !== 'string' || priceId.length > 100) {
      toast({
        title: "Error",
        description: "Información del plan no válida",
        variant: "destructive",
      });
      return;
    }

    if (!planName || typeof planName !== 'string' || planName.length > 50) {
      toast({
        title: "Error",
        description: "Nombre del plan no válido",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      console.log('Creating checkout session for:', { priceId, planName });
      
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId, planName },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (error) {
        console.error('Checkout creation error:', error);
        throw new Error('Failed to create checkout session');
      }

      if (!data?.url || typeof data.url !== 'string') {
        throw new Error('Invalid checkout URL received');
      }

      // Validate URL before opening
      try {
        new URL(data.url);
      } catch {
        throw new Error('Invalid checkout URL format');
      }

      console.log('Redirecting to Stripe checkout:', data.url);
      // Redirect to Stripe checkout
      window.location.href = data.url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      handleSecureError(error, 'No se pudo iniciar el proceso de pago');
    } finally {
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
