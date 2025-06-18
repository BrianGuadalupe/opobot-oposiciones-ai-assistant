
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { handleSecureError } from '@/utils/securityUtils';
import { checkSubscriptionStatus } from '@/utils/subscriptionApi';
import { useCheckout } from './useCheckout';
import { useCustomerPortal } from './useCustomerPortal';
import type { SubscriptionStatus } from '@/types/subscription';

export const useSubscription = () => {
  const { user, session } = useAuth();
  const { createCheckoutSession, loading: checkoutLoading } = useCheckout();
  const { openCustomerPortal } = useCustomerPortal();
  
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
    createCheckoutSession,
    openCustomerPortal,
    loading: checkoutLoading,
  };
};

export type { SubscriptionStatus };
