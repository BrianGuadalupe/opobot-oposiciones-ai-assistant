
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
      console.log('=== PROTECTED ROUTE CHECK ACCESS ===');
      console.log('User:', !!user);
      console.log('Session:', !!session);
      console.log('Require subscription:', requireSubscription);

      if (!user || !session) {
        console.log('No user or session, redirecting to auth');
        navigate('/auth');
        return;
      }

      if (!requireSubscription) {
        console.log('No subscription required, granting access');
        setHasAccess(true);
        setIsLoading(false);
        return;
      }

      try {
        console.log('Checking subscription status with local data first...');
        
        // Primero intentar obtener datos locales más rápido
        const { data: localSubscriber, error: localError } = await supabase
          .from('subscribers')
          .select('subscribed, subscription_tier, subscription_end')
          .eq('user_id', user.id)
          .single();

        if (!localError && localSubscriber?.subscribed) {
          console.log('Local subscription valid, granting access');
          setHasAccess(true);
          setIsLoading(false);
          return;
        }

        // Solo verificar demo si no hay suscripción local válida
        console.log('Checking demo user status...');
        const { data: usageData, error: usageError } = await supabase
          .from('user_usage')
          .select('is_demo_user, subscription_tier, queries_remaining_this_month')
          .eq('user_id', user.id)
          .single();

        if (usageError) {
          console.error('Error fetching usage data:', usageError);
          navigate('/?subscription_required=true');
          return;
        }

        if (usageData?.is_demo_user) {
          console.log('Demo user detected, checking remaining queries');
          if (usageData.queries_remaining_this_month > 0) {
            console.log('Demo user has queries remaining, granting access');
            setHasAccess(true);
          } else {
            console.log('Demo user has no queries remaining, redirecting with demo_expired');
            navigate('/?demo_expired=true');
            return;
          }
          setIsLoading(false);
          return;
        }

        // Si no es demo y no tiene suscripción local, verificar con Stripe (más lento)
        console.log('No local subscription found, checking with Stripe...');
        const { data: refreshData, error: refreshError } = await supabase.functions.invoke('check-subscription', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        
        if (refreshError) {
          console.error('Error refreshing subscription:', refreshError);
          navigate('/?subscription_required=true');
          return;
        }
        
        console.log('Refreshed subscription data:', refreshData);
        if (refreshData?.subscribed) {
          setHasAccess(true);
        } else {
          navigate('/?subscription_required=true');
          return;
        }
      } catch (error) {
        console.error('Unexpected error checking access:', error);
        navigate('/?subscription_required=true');
        return;
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
