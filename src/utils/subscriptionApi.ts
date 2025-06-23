
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
    console.log('🔄 Invocando función create-checkout...');
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

    console.log('Function call completado en:', endTime - startTime, 'ms');
    console.log('Create checkout respuesta completa:', { data, error });

    if (error) {
      console.error('❌ Error de función Supabase:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      // Mostrar toast con el error específico
      toast({
        title: "Error de Stripe Checkout",
        description: error.message || 'Error desconocido al crear sesión de checkout',
        variant: "destructive",
      });
      
      // Análisis específico de errores comunes
      if (error.message?.includes('fetch')) {
        console.error('🌐 Error de red detectado');
        throw new Error('Error de conectividad. Verifica tu conexión a internet.');
      }
      
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        console.error('🔍 Función no encontrada');
        throw new Error('Función de checkout no encontrada. Contacta soporte.');
      }

      if (error.message?.includes('authentication') || error.message?.includes('unauthorized')) {
        console.error('🔐 Error de autenticación');
        throw new Error('Error de autenticación. Inicia sesión nuevamente.');
      }
      
      throw new Error(error.message || 'Error creating checkout session');
    }

    if (!data) {
      console.error('❌ No se recibieron datos de create-checkout');
      toast({
        title: "Error",
        description: "No se recibió respuesta del servidor",
        variant: "destructive",
      });
      throw new Error('No response data received');
    }

    console.log('📦 Datos recibidos:', data);

    if (!data.url) {
      console.error('❌ No hay URL de checkout en la respuesta:', data);
      toast({
        title: "Error de Stripe",
        description: "No se pudo generar la URL de checkout",
        variant: "destructive",
      });
      throw new Error('No checkout URL received');
    }

    console.log('✅ Sesión de checkout creada exitosamente');
    console.log('Checkout URL:', data.url);
    console.log('Session ID:', data.sessionId);

    // Toast de éxito
    toast({
      title: "Redirigiendo a Stripe",
      description: "Sesión de checkout creada correctamente",
      variant: "default",
    });

    return data;
  } catch (error) {
    console.error('❌ Create checkout failed:', error);
    
    // Log adicional para debugging
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
