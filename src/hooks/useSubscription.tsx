
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
  
  // Use refs to prevent unnecessary re-checks and race conditions
  const lastCheckTimeRef = useRef<number>(0);
  const lastUserIdRef = useRef<string | null>(null);
  const hasValidCheckRef = useRef<boolean>(false);
  const hasInitialCheckCompletedRef = useRef<boolean>(false);

  const checkSubscription = useCallback(async (forceRefresh: boolean = false) => {
    console.log('=== SUBSCRIPTION CHECK START ===');
    console.log('Force refresh:', forceRefresh);
    console.log('User:', !!user);
    console.log('Session:', !!session);
    console.log('Is checking:', isChecking);

    // Prevent multiple simultaneous checks
    if (isChecking) {
      console.log('Already checking subscription, skipping');
      return;
    }

    // Use cached result if valid and not forced
    if (!forceRefresh && hasValidCheckRef.current && lastUserIdRef.current === user?.id) {
      console.log('Using cached subscription result');
      if (!isReady && hasInitialCheckCompletedRef.current) {
        setIsReady(true);
      }
      return;
    }

    // Rate limiting - avoid checks more frequent than 2 seconds unless forced
    const now = Date.now();
    if (!forceRefresh && (now - lastCheckTimeRef.current) < 2000) {
      console.log('Rate limited - skipping check');
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
      hasValidCheckRef.current = false;
      hasInitialCheckCompletedRef.current = true;
      return;
    }

    try {
      setIsChecking(true);
      lastCheckTimeRef.current = now;
      lastUserIdRef.current = user.id;
      
      // Only show loading on first check
      if (!hasInitialCheckCompletedRef.current) {
        setSubscriptionStatus(prev => ({ ...prev, loading: true }));
      }
      
      console.log('Fetching subscription data from Stripe...');
      
      // Aggressive timeout - 5 seconds max
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Subscription check timeout')), 5000);
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
      hasValidCheckRef.current = true;
      hasInitialCheckCompletedRef.current = true;
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
            hasValidCheckRef.current = true;
            hasInitialCheckCompletedRef.current = true;
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
      hasValidCheckRef.current = false;
      hasInitialCheckCompletedRef.current = true;
      setIsReady(true);
    } finally {
      setIsChecking(false);
    }
  }, [user?.id, session?.access_token, isChecking]);

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

  // Optimized effect - only run when necessary
  useEffect(() => {
    // Reset cache when user changes
    if (user?.id !== lastUserIdRef.current) {
      console.log('User changed, resetting subscription cache');
      hasValidCheckRef.current = false;
      hasInitialCheckCompletedRef.current = false;
      setIsReady(false);
      lastCheckTimeRef.current = 0;
    }

    // Only check if we have complete auth and haven't completed initial check
    if (user && session?.access_token && !hasInitialCheckCompletedRef.current && !isChecking) {
      console.log('Auth complete, scheduling initial subscription check...');
      
      const timeoutId = setTimeout(() => {
        checkSubscription(false);
      }, 100); // Minimal delay to avoid race conditions

      return () => clearTimeout(timeoutId);
    }
  }, [user?.id, session?.access_token, checkSubscription, isChecking]);

  // Clear cache when auth is lost
  useEffect(() => {
    if (!user || !session) {
      console.log('Auth lost, clearing subscription cache');
      hasValidCheckRef.current = false;
      hasInitialCheckCompletedRef.current = false;
      lastUserIdRef.current = null;
      lastCheckTimeRef.current = 0;
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
