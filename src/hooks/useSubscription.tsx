
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

// Plan mapping con price IDs reales
const PLAN_MAPPING = {
  "Básico": "price_1RakDbG0tRQIugBejNs3yiVA",
  "Profesional": "price_1RakGGG0tRQIugBefzFK7piu",
  "Academias": "price_1RakGkG0tRQIugBeECOoQI3p"
};

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
    console.log('=== CHECKOUT DIRECTO CON STRIPE ===');
    console.log('Plan:', planName);
    console.log('User:', !!user);
    
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

    const priceId = PLAN_MAPPING[planName as keyof typeof PLAN_MAPPING];
    if (!priceId) {
      console.error('Plan no encontrado:', planName);
      toast({
        title: "Error",
        description: "Plan no disponible",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      console.log('Obteniendo clave pública de Stripe...');
      
      // Obtener la clave pública desde Supabase
      const { data: keyData, error: keyError } = await supabase.functions.invoke('get-stripe-key', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (keyError || !keyData?.publicKey) {
        throw new Error('No se pudo obtener la clave pública de Stripe');
      }

      const stripePublicKey = keyData.publicKey;
      
      // Verificar que tenemos una clave pública válida
      if (!stripePublicKey || !stripePublicKey.startsWith('pk_')) {
        throw new Error('Clave pública de Stripe no válida');
      }
      
      console.log('Cargando Stripe...');
      
      // Cargar Stripe dinámicamente
      const stripe = await loadStripe(stripePublicKey);
      
      if (!stripe) {
        throw new Error('Error al cargar Stripe');
      }

      console.log('Redirigiendo a Stripe Checkout...');
      
      // Redirect directo a Stripe Checkout
      const { error } = await stripe.redirectToCheckout({
        lineItems: [{
          price: priceId,
          quantity: 1,
        }],
        mode: 'subscription',
        successUrl: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/?canceled=true`,
        customerEmail: user.email,
      });

      if (error) {
        console.error('Error en Stripe Checkout:', error);
        throw new Error(error.message || 'Error en el checkout');
      }
      
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

// Función para cargar Stripe dinámicamente
const loadStripe = (publishableKey: string) => {
  return new Promise<any>((resolve, reject) => {
    if (window.Stripe) {
      resolve(window.Stripe(publishableKey));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.onload = () => {
      if (window.Stripe) {
        resolve(window.Stripe(publishableKey));
      } else {
        reject(new Error('Stripe failed to load'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load Stripe'));
    document.head.appendChild(script);
  });
};

// Declaración global para TypeScript
declare global {
  interface Window {
    Stripe: any;
  }
}
