
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { Navigate } from "react-router-dom";
import SubscriptionRequiredModal from "./SubscriptionRequiredModal";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireSubscription?: boolean;
}

const ProtectedRoute = ({ children, requireSubscription = false }: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { subscribed, loading: subscriptionLoading } = useSubscription();
  const [showModal, setShowModal] = useState(false);

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

  // Si se requiere suscripción pero no hay usuario autenticado
  if (requireSubscription && !user) {
    console.log('❌ Subscription required but no user, redirecting to auth');
    return <Navigate to="/auth" replace />;
  }

  // Si se requiere suscripción, verificar el estado
  if (requireSubscription) {
    // Si aún está cargando la verificación de suscripción, mostrar loading
    if (subscriptionLoading) {
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

    // Una vez que termine de cargar, si no está suscrito, mostrar modal
    if (!subscribed && !subscriptionLoading) {
      console.log('❌ Subscription required but user not subscribed, showing modal');
      
      return (
        <>
          <SubscriptionRequiredModal 
            isOpen={true}
            onClose={() => {
              console.log('Modal closed, redirecting to home');
              window.location.href = '/';
            }}
          />
          {/* Renderizar contenido de fondo mientras se muestra el modal */}
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-8 h-8 bg-gradient-to-r from-opobot-blue to-opobot-green rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold">O</span>
              </div>
              <p>Verificando acceso...</p>
            </div>
          </div>
        </>
      );
    }
  }

  console.log('✅ Access granted to protected route');
  return <>{children}</>;
};

export default ProtectedRoute;
