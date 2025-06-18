
import { useState } from 'react';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { createStripeCheckout } from '@/utils/subscriptionApi';

export const useCheckout = () => {
  const { user, session } = useAuth();
  const [loading, setLoading] = useState(false);

  const createCheckoutSession = async (planName: string) => {
    console.log('=== CHECKOUT SESSION CREATION START ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Plan requested:', planName);
    console.log('User exists:', !!user);
    console.log('User ID:', user?.id);
    console.log('User email:', user?.email);
    console.log('Session exists:', !!session);
    console.log('Access token exists:', !!session?.access_token);
    console.log('Access token length:', session?.access_token?.length || 0);
    console.log('Session expires at:', session?.expires_at);
    console.log('Current time:', Math.floor(Date.now() / 1000));
    
    // Enhanced session validation
    if (!user || !session?.access_token) {
      console.log('❌ AUTH VALIDATION FAILED');
      console.log('Missing user:', !user);
      console.log('Missing access_token:', !session?.access_token);
      
      toast({
        title: "Regístrate",
        description: "Necesitas registrarte para suscribirte.",
      });
      
      console.log('Redirecting to auth page...');
      window.location.href = '/auth?mode=register';
      return;
    }

    // Validate planName
    if (!planName || typeof planName !== 'string') {
      console.error('❌ INVALID PLAN NAME:', planName);
      toast({
        title: "Error",
        description: "Nombre del plan no válido",
        variant: "destructive",
      });
      return;
    }

    console.log('✅ All validations passed');
    setLoading(true);

    try {
      console.log('🔄 Calling createStripeCheckout...');
      console.log('Parameters:', { planName, tokenLength: session.access_token.length });
      
      const data = await createStripeCheckout(planName, session.access_token);
      
      console.log('✅ Checkout session created successfully');
      console.log('Response data:', data);
      console.log('Checkout URL received:', data.url);
      console.log('Session ID:', data.sessionId);
      
      if (!data.url) {
        throw new Error('No checkout URL received from server');
      }
      
      console.log('🌐 Redirecting to Stripe Checkout:', data.url);
      
      // Test different redirect methods
      console.log('Testing window.location.href redirect...');
      window.location.href = data.url;
      
    } catch (error) {
      console.error('=== CHECKOUT ERROR DETAILS ===');
      console.error('Error type:', typeof error);
      console.error('Error constructor:', error?.constructor?.name);
      console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('Full error object:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      toast({
        title: "Error de Pago",
        description: `No se pudo iniciar el proceso de pago: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      console.log('=== CHECKOUT SESSION END ===');
      console.log('Setting loading to false');
      setLoading(false);
    }
  };

  return {
    createCheckoutSession,
    loading,
  };
};
