import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { handleSecureError } from '@/utils/securityUtils';
import { checkSubscriptionStatus, createStripeCheckout, openStripeCustomerPortal } from '@/utils/subscriptionApi';
import { supabase } from '@/integrations/supabase/client';
import type { SubscriptionStatus } from '@/types/subscription';
import { toast } from '@/hooks/use-toast';

export const useSubscription = () => {
  const { user, session } = useAuth();
  
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({
    subscribed: false,
    loading: true,
  });
  const [isChecking, setIsChecking] = useState(false);
  const [isReady, setIsReady] = useState(false);
  
  //  OPTIMIZACIÓN: Caché más agresivo con useRef
  const cacheRef = useRef<{
    lastCheckTime: number;
    lastUserId: string | null;
    hasValidCheck: boolean;
    hasInitialCheckCompleted: boolean;
    lastCheckResult: any;
  }>({
    lastCheckTime: 0,
    lastUserId: null,
    hasValidCheck: false,
    hasInitialCheckCompleted: false,
    lastCheckResult: null,
  });

  const checkSubscription = useCallback(async (forceRefresh: boolean = false) => {
    console.log('=== SUBSCRIPTION CHECK START ===');
    console.log('Force refresh:', forceRefresh);
    console.log('User:', !!user);
    console.log('Session:', !!session);
    console.log('Is checking:', isChecking);

    // 🚀 OPTIMIZACIÓN: Prevenir múltiples verificaciones simultáneas
    if (isChecking) {
      console.log('Already checking subscription, skipping');
      return;
    }

    //  OPTIMIZACIÓN: Caché más inteligente
    if (!forceRefresh && 
        cacheRef.current.hasValidCheck && 
        cacheRef.current.lastUserId === user?.id &&
        cacheRef.current.lastCheckResult) {
      console.log('Using cached subscription result (30 min cache)');
      if (!isReady && cacheRef.current.hasInitialCheckCompleted) {
        setIsReady(true);
      }
      return;
    }

    //  OPTIMIZACIÓN: Rate limiting más agresivo
    const now = Date.now();
    if (!forceRefresh && (now - cacheRef.current.lastCheckTime) < 5000) { // 5 segundos
      console.log('Rate limited - skipping check (5s cooldown)');
      return;
    }

    // Wait for complete auth session
    if (!user || !session?.access_token) {
      console.log('Waiting for complete auth session');
      setSubscriptionStatus({
        subscribed: false,
        loading: false,
      });
      setIsReady(true);
      cacheRef.current.hasValidCheck = false;
      cacheRef.current.hasInitialCheckCompleted = true;
      return;
    }

    try {
      setIsChecking(true);
      cacheRef.current.lastCheckTime = now;
      cacheRef.current.lastUserId = user.id;
      
      // Only show loading on first check
      if (!cacheRef.current.hasInitialCheckCompleted) {
        setSubscriptionStatus(prev => ({ ...prev, loading: true }));
      }
      
      console.log('Fetching subscription data from Stripe...');
      
      //  OPTIMIZACIÓN: Timeout más agresivo
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Subscription check timeout')), 3000); // 3 segundos
      });
      
      const checkPromise = checkSubscriptionStatus(user.id, session.access_token);
      
      const data = await Promise.race([checkPromise, timeoutPromise]) as any;

      console.log('Subscription data received:', data);

      const newStatus = {
        subscribed: Boolean(data.subscribed),
        subscription_tier: data.subscription_tier,
        subscription_end: data.subscription_end,
        loading: false,
      };

      setSubscriptionStatus(newStatus);
      cacheRef.current.hasValidCheck = true;
      cacheRef.current.hasInitialCheckCompleted = true;
      cacheRef.current.lastCheckResult = newStatus;
      setIsReady(true);
      
      console.log('✅ Subscription check completed successfully');
      console.log('✅ Final status:', newStatus);
    } catch (error) {
      console.error('❌ Error checking subscription:', error);
      
      // Handle timeout with demo user fallback
      if (error instanceof Error && error.message.includes('timeout')) {
        console.log('Timeout detected, checking demo user status...');
        try {
          const { data: usageData, error: usageError } = await supabase
            .from('user_usage')
            .select('is_demo_user, subscription_tier, queries_remaining_this_month')
            .eq('user_id', user.id)
            .single();

          if (!usageError && usageData?.is_demo_user) {
            console.log('Demo user detected, setting demo status');
            const demoStatus = {
              subscribed: usageData.queries_remaining_this_month > 0,
              subscription_tier: 'Demo',
              loading: false,
            };
            setSubscriptionStatus(demoStatus);
            cacheRef.current.hasValidCheck = true;
            cacheRef.current.hasInitialCheckCompleted = true;
            cacheRef.current.lastCheckResult = demoStatus;
            setIsReady(true);
            return;
          }
        } catch (demoError) {
          console.log('Demo fallback check failed:', demoError);
        }
      }
      
      handleSecureError(error, 'Error al verificar el estado de la suscripción');
      
      setSubscriptionStatus({
        subscribed: false,
        loading: false,
      });
      cacheRef.current.hasValidCheck = false;
      cacheRef.current.hasInitialCheckCompleted = true;
      setIsReady(true);
    } finally {
      setIsChecking(false);
    }
  }, [user?.id, session?.access_token, isChecking, isReady]);

  const redirectToStripeCheckout = async (planName: string) => {
    console.log('=== STRIPE CHECKOUT REDIRECT START ===');
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

  const openCustomerPortal = async () => {
    console.log('=== CUSTOMER PORTAL START ===');
    
    if (!user || !session?.access_token) {
      console.log('❌ No user session for customer portal');
      toast({
        title: "Error",
        description: "Debes iniciar sesión para gestionar tu suscripción",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('🔄 Opening customer portal...');
      
      const url = await openStripeCustomerPortal(session.access_token);
      
      console.log('✅ Customer portal URL received:', url);
      
      window.open(url, '_blank', 'noopener,noreferrer');
      
      toast({
        title: "Portal de gestión",
        description: "Se ha abierto el portal de gestión de Stripe en una nueva pestaña",
        variant: "default",
      });
      
    } catch (error) {
      console.error('❌ Error opening customer portal:', error);
      handleSecureError(error, 'No se pudo abrir el portal de gestión');
    }
  };

  // 🚀 OPTIMIZACIÓN: Effect más inteligente
  useEffect(() => {
    // Reset cache when user changes
    if (user?.id !== cacheRef.current.lastUserId) {
      console.log('User changed, resetting subscription cache');
      cacheRef.current = {
        lastCheckTime: 0,
        lastUserId: user?.id || null,
        hasValidCheck: false,
        hasInitialCheckCompleted: false,
        lastCheckResult: null,
      };
      setIsReady(false);
    }

    //  OPTIMIZACIÓN: Solo verificar una vez por sesión
    if (user && session?.access_token && !cacheRef.current.hasInitialCheckCompleted && !isChecking) {
      console.log('Auth complete, scheduling initial subscription check...');
      
      const timeoutId = setTimeout(() => {
        checkSubscription(false);
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [user?.id, session?.access_token, checkSubscription, isChecking]);

  // Clear cache when auth is lost
  useEffect(() => {
    if (!user || !session) {
      console.log('Auth lost, clearing subscription cache');
      cacheRef.current = {
        lastCheckTime: 0,
        lastUserId: null,
        hasValidCheck: false,
        hasInitialCheckCompleted: false,
        lastCheckResult: null,
      };
      setIsReady(false);
    }
  }, [user, session]);

  return {
    ...subscriptionStatus,
    isReady,
    checkSubscription,
    redirectToStripeCheckout,
    openCustomerPortal,
  };
};

export type { SubscriptionStatus };
