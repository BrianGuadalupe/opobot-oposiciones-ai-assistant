
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Star, CheckCircle, ExternalLink } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";

const SubscriptionRequired = () => {
  const { user } = useAuth();
  const { redirectToStripeCheckout } = useSubscription();

  // Frontend: Solo datos de presentación (no críticos)
  const plans = [
    {
      name: "Básico",
      price: "9,95",
      description: "Perfecto para empezar",
      features: [
        "100 consultas mensuales",
        "Acceso a temarios básicos",
        "Soporte por email",
        "Tests automáticos"
      ]
    },
    {
      name: "Profesional",
      price: "19,95",
      description: "Para estudiantes serios",
      features: [
        "Consultas ilimitadas",
        "Todos los temarios actualizados",
        "Soporte prioritario",
        "Tests personalizados",
        "Seguimiento de progreso"
      ],
      popular: true
    },
    {
      name: "Academias",
      price: "49,95",
      description: "Solución para centros",
      features: [
        "Hasta 50 estudiantes",
        "Panel de administración",
        "Estadísticas detalladas",
        "Soporte telefónico",
        "Integración personalizada",
        "Formación incluida"
      ]
    }
  ];

  const handleSubscribe = (planName: string) => {
    console.log('=== SUBSCRIPTION REQUIRED - SUBSCRIBE CLICKED ===');
    console.log('Plan name:', planName);
    console.log('User exists:', !!user);
    
    if (!user) {
      console.log('No user found, redirecting to registration');
      window.location.href = '/auth?mode=register';
      return;
    }
    
    console.log('Redirecting to external Stripe checkout...');
    redirectToStripeCheckout(planName);
  };

  console.log('=== SUBSCRIPTION REQUIRED RENDER ===');
  console.log('User:', !!user);

  return (
    <div className="min-h-screen bg-gradient-to-br from-opobot-blue to-opobot-green flex items-center justify-center p-4">
      <div className="w-full max-w-6xl">
        <Card className="mb-8">
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
        </Card>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {plans.map((plan, index) => (
            <Card 
              key={index} 
              className={`relative border-2 transition-all duration-300 hover:shadow-xl ${
                plan.popular 
                  ? 'border-opobot-blue scale-105 shadow-xl ring-2 ring-opobot-blue/40' 
                  : 'border-gray-200 hover:border-opobot-blue bg-white/95'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                  <div className="bg-gradient-to-r from-opobot-blue to-opobot-green text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-400" fill="#fde047" />
                    Más Popular
                  </div>
                </div>
              )}
              
              <CardHeader className="text-center pb-6">
                <CardTitle className="text-xl font-bold text-gray-900 mb-2">
                  {plan.name}
                </CardTitle>
                <p className="text-gray-600 mb-4">{plan.description}</p>
                <div className="flex items-center justify-center">
                  <span className="text-3xl font-bold text-gray-900">€{plan.price}</span>
                  <span className="text-gray-600 ml-2">/mes</span>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center space-x-3">
                      <CheckCircle className="w-4 h-4 text-opobot-green flex-shrink-0" />
                      <span className="text-gray-700 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button 
                  onClick={() => {
                    console.log('Button clicked for plan:', plan.name);
                    handleSubscribe(plan.name);
                  }}
                  className={`w-full rounded-lg text-base shadow-sm ${
                    plan.popular 
                      ? 'bg-opobot-blue hover:bg-opobot-blue-dark' 
                      : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                  size="lg"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Suscribirse Ahora
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => window.location.href = '/'}
            className="text-gray-600 bg-white hover:bg-gray-50"
          >
            Volver al Inicio
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionRequired;
