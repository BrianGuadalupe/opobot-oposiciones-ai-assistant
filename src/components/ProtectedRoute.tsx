
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireSubscription?: boolean;
}

const ProtectedRoute = ({ children, requireSubscription = false }: ProtectedRouteProps) => {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      if (!user || !session) {
        navigate('/auth');
        return;
      }

      if (!requireSubscription) {
        setHasAccess(true);
        setIsLoading(false);
        return;
      }

      try {
        // Verificar si es usuario demo
        const { data: usageData } = await supabase
          .from('user_usage')
          .select('is_demo_user')
          .eq('user_id', user.id)
          .single();

        if (usageData?.is_demo_user) {
          // Usuario demo tiene acceso
          setHasAccess(true);
          setIsLoading(false);
          return;
        }

        // Verificar suscripción para usuarios normales
        const { data: subscription } = await supabase
          .from('subscribers')
          .select('subscribed')
          .eq('user_id', user.id)
          .single();

        if (subscription?.subscribed) {
          setHasAccess(true);
        } else {
          navigate('/?subscription_required=true');
        }
      } catch (error) {
        console.error('Error checking access:', error);
        navigate('/?subscription_required=true');
      } finally {
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [user, session, navigate, requireSubscription]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-opobot-blue"></div>
      </div>
    );
  }

  return hasAccess ? <>{children}</> : null;
};

export default ProtectedRoute;
