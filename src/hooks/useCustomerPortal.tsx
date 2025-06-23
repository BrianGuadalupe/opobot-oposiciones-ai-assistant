
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { handleSecureError } from '@/utils/securityUtils';
import { supabase } from '@/integrations/supabase/client';

export const useCustomerPortal = () => {
  const { user, session } = useAuth();

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
      console.log('🔄 Calling customer-portal function...');
      
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log('📥 Customer portal response:', { 
        hasData: !!data, 
        hasError: !!error,
        url: data?.url
      });

      if (error) {
        console.error('❌ Error from customer-portal function:', error);
        throw error;
      }

      if (!data?.url) {
        console.error('❌ No URL received from customer portal');
        throw new Error('No se recibió la URL del portal de gestión');
      }

      console.log('🌐 Opening customer portal URL:', data.url);
      
      // Abrir el portal de gestión en una nueva pestaña
      window.open(data.url, '_blank', 'noopener,noreferrer');
      
      toast({
        title: "Portal de gestión",
        description: "Se ha abierto el portal de gestión de Stripe en una nueva pestaña",
        variant: "default",
      });
      
    } catch (error) {
      console.error('💥 Error opening customer portal:', error);
      handleSecureError(error, 'No se pudo abrir el portal de gestión');
    }
  };

  return {
    openCustomerPortal,
  };
};
