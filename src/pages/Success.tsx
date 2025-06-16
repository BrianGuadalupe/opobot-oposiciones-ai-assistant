
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { CheckCircle, ArrowRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link, useSearchParams } from 'react-router-dom';

const Success = () => {
  const { user } = useAuth();
  const { checkSubscription, subscribed, subscription_tier } = useSubscription();
  const [searchParams] = useSearchParams();
  const [isChecking, setIsChecking] = useState(true);
  
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    const verifySubscription = async () => {
      if (user && sessionId) {
        // Wait a moment for Stripe to process
        setTimeout(async () => {
          await checkSubscription();
          setIsChecking(false);
        }, 2000);
      } else {
        setIsChecking(false);
      }
    };
    
    verifySubscription();
  }, [user, sessionId, checkSubscription]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-opobot-blue to-opobot-green">
        <Card className="w-full max-w-md">
          <CardContent className="text-center p-8">
            <p className="text-gray-600">Por favor, inicia sesión para ver el estado de tu suscripción.</p>
            <Button asChild className="mt-4">
              <Link to="/auth">Iniciar Sesión</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-opobot-blue to-opobot-green flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center pb-8">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <CardTitle className="text-3xl font-bold text-gray-900 mb-2">
            ¡Pago Completado!
          </CardTitle>
          <p className="text-gray-600 text-lg">
            Tu suscripción se ha procesado correctamente
          </p>
        </CardHeader>

        <CardContent className="text-center space-y-6">
          {isChecking ? (
            <div className="py-8">
              <div className="animate-spin w-8 h-8 border-4 border-opobot-blue border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Verificando tu suscripción...</p>
            </div>
          ) : subscribed ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-green-800 mb-2">
                  Plan {subscription_tier} Activado
                </h3>
                <p className="text-green-700">
                  Ya puedes acceder a todas las funcionalidades de tu plan.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild className="bg-opobot-blue hover:bg-opobot-blue-dark">
                  <Link to="/chat">
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Ir al Chat IA
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/">
                    <Home className="w-4 h-4 mr-2" />
                    Volver al Inicio
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-yellow-800 mb-2">
                  Procesando Suscripción
                </h3>
                <p className="text-yellow-700">
                  Tu pago se ha completado pero la suscripción puede tardar unos minutos en activarse.
                </p>
              </div>
              
              <Button 
                onClick={() => {
                  setIsChecking(true);
                  checkSubscription().finally(() => setIsChecking(false));
                }}
                variant="outline"
                disabled={isChecking}
              >
                Verificar Estado
              </Button>
            </div>
          )}

          {sessionId && (
            <div className="text-sm text-gray-500 border-t pt-4">
              <p>ID de Sesión: {sessionId}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Success;
