
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
        let message = "No se pudo activar el demo. Inténtalo de nuevo.";
        
        if (availability.reason === 'email_already_used') {
          message = "Ya has realizado la demo gratuita. ¡Suscríbete para acceso completo a Opobot!";
        } else if (availability.reason === 'ip_limit_reached') {
          message = "Ya has realizado la demo gratuita. ¡Suscríbete para acceso completo a Opobot!";
        }

        toast({
          title: "Demo no disponible",
          description: message,
          variant: "destructive",
          action: (
            <button 
              onClick={() => window.location.href = '/#pricing'}
              className="bg-white text-red-600 px-3 py-1 rounded text-sm hover:bg-gray-100"
            >
              Ver Planes
            </button>
          ),
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
