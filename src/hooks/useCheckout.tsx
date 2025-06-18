
import { useState } from 'react';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { createStripeCheckout } from '@/utils/subscriptionApi';

export const useCheckout = () => {
  const { user, session } = useAuth();
  const [loading, setLoading] = useState(false);

  const createCheckoutSession = async (planName: string) => {
    console.log('=== WEBHOOK CHECKOUT SESSION ===');
    console.log('Plan:', planName);
    console.log('User:', !!user);
    console.log('Session token available:', !!session?.access_token);
    
    // Enhanced session validation
    if (!user || !session?.access_token) {
      console.log('Missing auth requirements, redirecting to auth');
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

    setLoading(true);

    try {
      const data = await createStripeCheckout(planName, session.access_token);
      
      console.log('Redirecting to Stripe Checkout:', data.url);
      
      // Redirect to Stripe Checkout
      window.location.href = data.url;
      
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

  return {
    createCheckoutSession,
    loading,
  };
};
