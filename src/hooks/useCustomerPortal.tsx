
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { handleSecureError } from '@/utils/securityUtils';
import { openStripeCustomerPortal } from '@/utils/subscriptionApi';

export const useCustomerPortal = () => {
  const { user, session } = useAuth();

  const openCustomerPortal = async () => {
    if (!user || !session?.access_token) {
      toast({
        title: "Error", 
        description: "Debes iniciar sesión para gestionar tu suscripción",
        variant: "destructive",
      });
      return;
    }

    try {
      const url = await openStripeCustomerPortal(session.access_token);
      
      // Open customer portal in a new tab
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error opening customer portal:', error);
      handleSecureError(error, 'No se pudo abrir el portal de gestión');
    }
  };

  return {
    openCustomerPortal,
  };
};
