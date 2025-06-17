
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Star, ArrowRight } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";

const SubscriptionRequired = () => {
  const { user } = useAuth();
  const { createCheckoutSession, loading } = useSubscription();

  const handleSubscribe = async (priceId: string, planName: string) => {
    if (!user) {
      window.location.href = '/auth?mode=register';
      return;
    }
    await createCheckoutSession(priceId, planName);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-opobot-blue to-opobot-green flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-orange-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900 mb-2">
            Suscripción Requerida
          </CardTitle>
          <p className="text-gray-600">
            Para acceder a Opobot y todas sus funcionalidades, necesitas una suscripción activa.
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-blue-900">Plan Profesional</h3>
                  <p className="text-sm text-blue-700">Acceso completo a Opobot</p>
                  <div className="flex items-center mt-2">
                    <span className="text-2xl font-bold text-blue-900">€19,95</span>
                    <span className="text-blue-600 ml-1">/mes</span>
                  </div>
                </div>
                <Star className="w-8 h-8 text-yellow-500" />
              </div>
              
              <ul className="mt-4 space-y-2 text-sm text-blue-800">
                <li>✓ Consultas ilimitadas</li>
                <li>✓ Todos los temarios actualizados</li>
                <li>✓ Tests personalizados</li>
                <li>✓ Seguimiento de progreso</li>
              </ul>
              
              <Button 
                onClick={() => handleSubscribe("price_1RakGGG0tRQlugBefzfK7piu", "Profesional")}
                className="w-full mt-4 bg-opobot-blue hover:bg-opobot-blue-dark"
                disabled={loading}
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                {loading ? 'Procesando...' : 'Suscribirse Ahora'}
              </Button>
            </div>
          </div>

          <div className="text-center pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => window.location.href = '/'}
              className="text-gray-600"
            >
              Volver al Inicio
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionRequired;
