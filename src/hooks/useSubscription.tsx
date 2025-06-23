
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
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<number>(0);

  const checkSubscription = useCallback(async (forceRefresh: boolean = false) => {
    console.log('=== SUBSCRIPTION CHECK START ===');
    console.log('Force refresh:', forceRefresh);
    console.log('Is checking:', isChecking);
    console.log('User:', !!user);
    console.log('Session:', !!session);

    // Evitar llamadas simultáneas y muy frecuentes
    const now = Date.now();
    if (!forceRefresh && (isChecking || (now - lastCheckTime) < 5000)) {
      console.log('Subscription check skipped - too frequent or already in progress');
      return;
    }

    // Esperar a que la autenticación esté completa
    if (!user || !session?.access_token) {
      console.log('Subscription check: Waiting for complete auth session');
      setSubscriptionStatus({
        subscribed: false,
        loading: false,
      });
      return;
    }

    try {
      setIsChecking(true);
      setLastCheckTime(now);
      setSubscriptionStatus(prev => ({ ...prev, loading: true }));
      
      console.log('Checking local subscription data first...');
      
      // Primero intentar obtener datos locales
      const { data: localData, error: localError } = await supabase
        .from('subscribers')
        .select('subscribed, subscription_tier, subscription_end')
        .eq('user_id', user.id)
        .single();

      if (!localError && localData && !forceRefresh) {
        console.log('Using local subscription data:', localData);
        setSubscriptionStatus({
          subscribed: localData.subscribed,
          subscription_tier: localData.subscription_tier,
          subscription_end: localData.subscription_end,
          loading: false,
        });
        return;
      }

      console.log('Fetching fresh subscription data from Stripe...');
      
      // Timeout de seguridad
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Subscription check timeout')), 15000);
      });
      
      const checkPromise = checkSubscriptionStatus(user.id, session.access_token);
      
      const data = await Promise.race([checkPromise, timeoutPromise]) as any;

      console.log('Fresh subscription data received:', data);

      setSubscriptionStatus({
        subscribed: data.subscribed,
        subscription_tier: data.subscription_tier,
        subscription_end: data.subscription_end,
        loading: false,
      });
      
      console.log('✅ Subscription check completed successfully');
    } catch (error) {
      console.error('❌ Error checking subscription:', error);
      handleSecureError(error, 'Error al verificar el estado de la suscripción');
      
      // En caso de error, asumir que no está suscrito y dejar de cargar
      setSubscriptionStatus({
        subscribed: false,
        loading: false,
      });
    } finally {
      setIsChecking(false);
    }
  }, [user, session?.access_token, isChecking, lastCheckTime]);

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
      window.location.href = data.url;
      
    } catch (error) {
      console.error('❌ Error in checkout redirect:', error);
      handleSecureError(error, 'Error al crear la sesión de pago');
    }
  };

  // Customer portal
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

  // Solo verificar suscripción una vez cuando el usuario esté autenticado
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (user && session?.access_token && !isChecking) {
      console.log('Auth complete, scheduling subscription check...');
      
      // Pequeño delay para evitar llamadas duplicadas inmediatas
      timeoutId = setTimeout(() => {
        checkSubscription(false);
      }, 500);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user?.id, session?.access_token]); // Dependencias más específicas

  return {
    ...subscriptionStatus,
    checkSubscription,
    redirectToStripeCheckout,
    openCustomerPortal,
  };
};

export type { SubscriptionStatus };
