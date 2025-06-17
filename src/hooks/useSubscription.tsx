
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
    console.log('=== CHECKOUT SESSION START ===');
    console.log('Plan:', planName);
    console.log('User:', !!user);
    console.log('Session:', !!session);
    
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
    console.log('Starting checkout process...');

    try {
      console.log('=== CALLING EDGE FUNCTION ===');
      console.log('Function name: create-checkout');
      console.log('Request body:', { planName });
      
      // Create a promise with timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Function call timeout after 30 seconds')), 30000)
      );

      console.log('=== MAKING SUPABASE INVOKE CALL ===');
      
      const invokePromise = supabase.functions.invoke('create-checkout', {
        body: { planName: planName.trim() },
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('=== WAITING FOR RESPONSE ===');
      
      const response = await Promise.race([invokePromise, timeoutPromise]) as any;
      
      console.log('=== RESPONSE RECEIVED ===');
      console.log('Response status:', response?.status);
      console.log('Response error:', response?.error);
      console.log('Response data:', response?.data);

      if (response.error) {
        console.error('Edge function error:', response.error);
        throw new Error(response.error.message || 'Error en el servidor');
      }

      const data = response.data;
      if (!data?.url) {
        console.error('No URL in response:', data);
        throw new Error('No se recibió URL de checkout');
      }

      console.log('=== REDIRECTING TO STRIPE ===');
      console.log('Checkout URL:', data.url);
      
      // Redirect to Stripe checkout
      window.location.href = data.url;
      
    } catch (error) {
      console.error('=== CHECKOUT ERROR ===');
      console.error('Error type:', error?.constructor?.name);
      console.error('Error message:', error instanceof Error ? error.message : String(error));
      console.error('Full error:', error);
      
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
