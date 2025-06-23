
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export const useDemoRegistration = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { session } = useAuth();
  const { toast } = useToast();

  const checkDemoAvailability = async () => {
    if (!session) return { canRegister: false, reason: 'no_auth' };

    try {
      // Obtener IP del usuario
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const { ip } = await ipResponse.json();

      const { data, error } = await supabase.functions.invoke('manage-usage', {
        body: { 
          action: 'check_demo_availability',
          userIp: ip 
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error checking demo availability:', error);
      return { canRegister: false, reason: 'error' };
    }
  };

  const registerDemo = async () => {
    if (!session) {
      toast({
        title: "Error",
        description: "Debes iniciar sesión primero",
        variant: "destructive",
      });
      return false;
    }

    setIsLoading(true);

    try {
      // Verificar disponibilidad primero
      const availability = await checkDemoAvailability();
      
      if (!availability.canRegister) {
        toast({
          title: "Demo no disponible",
          description: "Ya se ha registrado un usuario demo desde esta IP hoy. Inténtalo mañana.",
          variant: "destructive",
        });
        return false;
      }

      // Obtener IP del usuario
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const { ip } = await ipResponse.json();

      const { data, error } = await supabase.functions.invoke('manage-usage', {
        body: { 
          action: 'register_demo',
          userIp: ip 
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      toast({
        title: "🎉 Demo Activado",
        description: "¡Tienes 3 consultas gratis para probar Opobot!",
        variant: "default",
      });

      return true;
    } catch (error) {
      console.error('Error registering demo:', error);
      toast({
        title: "Error",
        description: "No se pudo activar el demo. Inténtalo de nuevo.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    registerDemo,
    checkDemoAvailability,
    isLoading
  };
};
