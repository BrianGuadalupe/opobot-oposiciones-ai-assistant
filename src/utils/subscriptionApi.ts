
import { supabase } from '@/integrations/supabase/client';
import { handleSecureError } from '@/utils/securityUtils';
import { toast } from '@/hooks/use-toast';

export const checkSubscriptionStatus = async (
  userId: string,
  accessToken: string
) => {
  console.log('Checking subscription for user:', userId);
  
  const { data, error } = await supabase.functions.invoke('check-subscription', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
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

  console.log('Subscription check result:', data);
  return data;
};

export const createStripeCheckout = async (
  planName: string,
  accessToken: string
) => {
  console.log('Creating checkout session via webhook...');
  
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: { planName },
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (error) {
    throw new Error(error.message || 'Error creating checkout session');
  }

  if (!data?.url) {
    throw new Error('No checkout URL received');
  }

  return data;
};

export const openStripeCustomerPortal = async (accessToken: string) => {
  const { data, error } = await supabase.functions.invoke('customer-portal', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
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

  return data.url;
};
