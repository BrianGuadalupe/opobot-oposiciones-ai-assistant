
import { supabase } from '@/integrations/supabase/client';
import { handleSecureError } from '@/utils/securityUtils';
import { toast } from '@/hooks/use-toast';

export const checkSubscriptionStatus = async (
  userId: string,
  accessToken: string
) => {
  console.log('=== CHECK SUBSCRIPTION STATUS START ===');
  console.log('User ID:', userId);
  console.log('Access token length:', accessToken?.length || 0);
  
  try {
    const { data, error } = await supabase.functions.invoke('check-subscription', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Check subscription response:', { data, error });

    if (error) {
      console.error('❌ Subscription check error:', error);
      throw new Error('Failed to check subscription status');
    }

    // Validate response data
    if (!data || typeof data.subscribed !== 'boolean') {
      console.error('❌ Invalid subscription data received:', data);
      throw new Error('Invalid subscription data received');
    }

    console.log('✅ Subscription check successful:', data);
    return data;
  } catch (error) {
    console.error('❌ Check subscription failed:', error);
    throw error;
  }
};

export const createStripeCheckout = async (
  planName: string,
  accessToken: string
) => {
  console.log('=== CREATE STRIPE CHECKOUT START ===');
  console.log('Plan name:', planName);
  console.log('Access token length:', accessToken?.length || 0);
  console.log('Supabase URL:', 'https://dozaqjmdoblwqnuprxnq.supabase.co');
  
  try {
    console.log('🔄 Invoking create-checkout function...');
    console.log('Function URL: https://dozaqjmdoblwqnuprxnq.supabase.co/functions/v1/create-checkout');
    console.log('Request body:', { planName });
    console.log('Request headers:', {
      Authorization: `Bearer ${accessToken.substring(0, 20)}...`,
      'Content-Type': 'application/json',
    });
    
    const startTime = Date.now();
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { planName },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    const endTime = Date.now();

    console.log('Function call completed in:', endTime - startTime, 'ms');
    console.log('Create checkout raw response:', { data, error });

    if (error) {
      console.error('❌ Supabase function error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      // Check if it's a network error
      if (error.message?.includes('fetch')) {
        console.error('🌐 Network error detected');
        throw new Error('Error de conectividad. Verifica tu conexión a internet.');
      }
      
      // Check if it's a function not found error
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        console.error('🔍 Function not found error');
        throw new Error('Función de checkout no encontrada. Contacta soporte.');
      }
      
      throw new Error(error.message || 'Error creating checkout session');
    }

    if (!data) {
      console.error('❌ No data received from create-checkout function');
      throw new Error('No response data received');
    }

    if (!data.url) {
      console.error('❌ No checkout URL in response:', data);
      throw new Error('No checkout URL received');
    }

    console.log('✅ Checkout session created successfully');
    console.log('Checkout URL:', data.url);
    console.log('Session ID:', data.sessionId);

    return data;
  } catch (error) {
    console.error('❌ Create checkout failed:', error);
    
    // Additional error context
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    throw error;
  }
};

export const openStripeCustomerPortal = async (accessToken: string) => {
  console.log('=== OPEN CUSTOMER PORTAL START ===');
  console.log('Access token length:', accessToken?.length || 0);
  
  try {
    const { data, error } = await supabase.functions.invoke('customer-portal', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Customer portal response:', { data, error });

    if (error) {
      console.error('❌ Customer portal error:', error);
      throw new Error('Failed to open customer portal');
    }

    if (!data?.url || typeof data.url !== 'string') {
      console.error('❌ Invalid portal URL received:', data);
      throw new Error('Invalid portal URL received');
    }

    // Validate URL before opening
    try {
      new URL(data.url);
      console.log('✅ Valid portal URL:', data.url);
    } catch {
      console.error('❌ Invalid URL format:', data.url);
      throw new Error('Invalid portal URL format');
    }

    return data.url;
  } catch (error) {
    console.error('❌ Customer portal failed:', error);
    throw error;
  }
};
