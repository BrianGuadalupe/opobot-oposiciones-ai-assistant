
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

  console.log('=== PROTECTED ROUTE ===');
  console.log('User exists:', !!user);
  console.log('Auth loading:', authLoading);
  console.log('Subscription loading:', subscriptionLoading);
  console.log('Subscribed:', subscribed);
  console.log('Require subscription:', requireSubscription);

  // Mostrar loading mientras se carga la autenticación
  if (authLoading) {
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

  // Si no hay usuario, redirigir a auth
  if (!user) {
    console.log('❌ No user found, redirecting to auth');
    return <Navigate to="/auth" replace />;
  }

  // Si se requiere suscripción y aún se está cargando el estado de suscripción
  if (requireSubscription && subscriptionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-gradient-to-r from-opobot-blue to-opobot-green rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold">O</span>
          </div>
          <p>Verificando suscripción...</p>
        </div>
      </div>
    );
  }

  // Si se requiere suscripción pero el usuario no está suscrito (después de cargar)
  if (requireSubscription && !subscriptionLoading && !subscribed) {
    console.log('❌ Subscription required but user not subscribed, redirecting to home with subscription required');
    return <Navigate to="/?subscription_required=true" replace />;
  }

  console.log('✅ Access granted to protected route');
  return <>{children}</>;
};

export default ProtectedRoute;
