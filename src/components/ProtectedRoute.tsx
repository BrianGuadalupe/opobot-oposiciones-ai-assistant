
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireSubscription?: boolean;
}

const ProtectedRoute = ({ children, requireSubscription = false }: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { subscribed, loading: subscriptionLoading } = useSubscription();

  // Show loading while auth or subscription is loading
  if (authLoading || (user && subscriptionLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-gradient-to-r from-opobot-blue to-opobot-green rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold">O</span>
          </div>
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  // If no user and auth is required
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If subscription is required but user is not subscribed
  if (requireSubscription && !subscribed) {
    return <Navigate to="/?subscription_required=true" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
