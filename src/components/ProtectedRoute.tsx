
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useNavigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireSubscription?: boolean;
}

const ProtectedRoute = ({ children, requireSubscription = false }: ProtectedRouteProps) => {
  const { user, session } = useAuth();
  const { subscribed, loading: subscriptionLoading, checkSubscription } = useSubscription();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      console.log('=== PROTECTED ROUTE CHECK ACCESS ===');
      console.log('User:', !!user);
      console.log('Session:', !!session);
      console.log('Require subscription:', requireSubscription);
      console.log('Subscribed:', subscribed);
      console.log('Subscription loading:', subscriptionLoading);

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

      // Wait for subscription check to complete
      if (subscriptionLoading) {
        console.log('Subscription still loading, waiting...');
        return;
      }

      // If subscription is required, check if user is subscribed
      if (subscribed) {
        console.log('User is subscribed, granting access');
        setHasAccess(true);
      } else {
        console.log('User is not subscribed, checking for demo user...');
        
        // Check for demo user as fallback
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          const { data: usageData, error: usageError } = await supabase
            .from('user_usage')
            .select('is_demo_user, subscription_tier, queries_remaining_this_month')
            .eq('user_id', user.id)
            .single();

          if (!usageError && usageData?.is_demo_user && usageData.queries_remaining_this_month > 0) {
            console.log('Demo user has queries remaining, granting access');
            setHasAccess(true);
          } else if (!usageError && usageData?.is_demo_user && usageData.queries_remaining_this_month <= 0) {
            console.log('Demo user has no queries remaining, redirecting with demo_expired');
            navigate('/?demo_expired=true');
            return;
          } else {
            console.log('User is not subscribed and not demo, redirecting with subscription_required');
            navigate('/?subscription_required=true');
            return;
          }
        } catch (error) {
          console.error('Error checking demo user status:', error);
          navigate('/?subscription_required=true');
          return;
        }
      }

      setIsLoading(false);
    };

    checkAccess();
  }, [user, session, navigate, requireSubscription, subscribed, subscriptionLoading]);

  // Trigger subscription check when component mounts if user is authenticated
  useEffect(() => {
    if (user && session && requireSubscription && !subscriptionLoading) {
      console.log('Triggering subscription check for protected route');
      checkSubscription(false);
    }
  }, [user, session, requireSubscription, checkSubscription, subscriptionLoading]);

  if (isLoading || subscriptionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-opobot-blue"></div>
      </div>
    );
  }

  return hasAccess ? <>{children}</> : null;
};

export default ProtectedRoute;
