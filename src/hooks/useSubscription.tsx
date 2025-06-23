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
  
  // Use refs to track the last successful check and prevent unnecessary re-checks
  const lastCheckTimeRef = useRef<number>(0);
  const lastUserIdRef = useRef<string | null>(null);
  const hasValidCheckRef = useRef<boolean>(false);

  const checkSubscription = useCallback(async (forceRefresh: boolean = false) => {
    console.log('=== SUBSCRIPTION CHECK START ===');
    console.log('Force refresh:', forceRefresh);
    console.log('Is checking:', isChecking);
    console.log('User:', !!user);
    console.log('Session:', !!session);
    console.log('Has valid check:', hasValidCheckRef.current);

    // If we already have a valid check for this user and no force refresh, skip
    if (!forceRefresh && hasValidCheckRef.current && lastUserIdRef.current === user?.id && !isChecking) {
      console.log('Subscription check skipped - already have valid result for this user');
      return;
    }

    // Prevent multiple simultaneous checks
    if (isChecking) {
      console.log('Subscription check already in progress, skipping');
      return;
    }

    // Rate limiting - avoid checks more frequent than 3 seconds unless forced
    const now = Date.now();
    if (!forceRefresh && (now - lastCheckTimeRef.current) < 3000) {
      console.log('Subscription check skipped - rate limited');
      return;
    }

    // Wait for complete auth session
    if (!user || !session?.access_token) {
      console.log('Subscription check: Waiting for complete auth session');
      console.log('User exists:', !!user);
      console.log('Session exists:', !!session);
      console.log('Access token exists:', !!session?.access_token);
      
      setSubscriptionStatus({
        subscribed: false,
        loading: false,
      });
      hasValidCheckRef.current = false;
      return;
    }

    try {
      setIsChecking(true);
      lastCheckTimeRef.current = now;
      lastUserIdRef.current = user.id;
      
      // Only set loading to true if we don't have a valid previous result
      if (!hasValidCheckRef.current) {
        setSubscriptionStatus(prev => ({ ...prev, loading: true }));
      }
      
      console.log('Fetching subscription data from Stripe...');
      
      // Reduce timeout to 8 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Subscription check timeout')), 8000);
      });
      
      const checkPromise = checkSubscriptionStatus(user.id, session.access_token);
      
      const data = await Promise.race([checkPromise, timeoutPromise]) as any;

      console.log('Subscription data received:', data);

      const newStatus = {
        subscribed: data.subscribed,
        subscription_tier: data.subscription_tier,
        subscription_end: data.subscription_end,
        loading: false,
      };

      setSubscriptionStatus(newStatus);
      hasValidCheckRef.current = true;
      
      console.log('✅ Subscription check completed successfully');
      console.log('✅ Final status:', newStatus);
    } catch (error) {
      console.error('❌ Error checking subscription:', error);
      
      // Handle timeout with demo user fallback
      if (error instanceof Error && error.message.includes('timeout')) {
        console.log('Timeout detected, checking demo user status as fallback...');
        try {
          const { data: usageData, error: usageError } = await supabase
            .from('user_usage')
            .select('is_demo_user, subscription_tier, queries_remaining_this_month')
            .eq('user_id', user.id)
            .single();

          if (!usageError && usageData?.is_demo_user) {
            console.log('Demo user detected during timeout, setting demo status');
            const demoStatus = {
              subscribed: usageData.queries_remaining_this_month > 0,
              subscription_tier: 'Demo',
              loading: false,
            };
            setSubscriptionStatus(demoStatus);
            hasValidCheckRef.current = true;
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
    } finally {
      setIsChecking(false);
    }
  }, [user?.id, session?.access_token, isChecking]);

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

  // Customer portal mejorado
  const openCustomerPortal = async () => {
    console.log('=== CUSTOMER PORTAL START ===');
    console.log('User:', !!user);
    console.log('Session:', !!session?.access_token);
    
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
      
      // Abrir en nueva pestaña
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

  // Optimized effect - only run subscription check when truly necessary
  useEffect(() => {
    // Reset cache when user changes
    if (user?.id !== lastUserIdRef.current) {
      console.log('User changed, resetting subscription cache');
      hasValidCheckRef.current = false;
      lastCheckTimeRef.current = 0;
    }

    // Only check if we have a complete auth session and don't have a valid result
    if (user && session?.access_token && !hasValidCheckRef.current && !isChecking) {
      console.log('Auth complete, scheduling subscription check...');
      
      const timeoutId = setTimeout(() => {
        checkSubscription(false);
      }, 100); // Reduced timeout for faster response

      return () => clearTimeout(timeoutId);
    }
  }, [user?.id, session?.access_token, checkSubscription, isChecking]);

  // Clear cache when auth state is lost
  useEffect(() => {
    if (!user || !session) {
      console.log('Auth lost, clearing subscription cache');
      hasValidCheckRef.current = false;
      lastUserIdRef.current = null;
      lastCheckTimeRef.current = 0;
    }
  }, [user, session]);

  return {
    ...subscriptionStatus,
    checkSubscription,
    redirectToStripeCheckout,
    openCustomerPortal,
  };
};

export type { SubscriptionStatus };
