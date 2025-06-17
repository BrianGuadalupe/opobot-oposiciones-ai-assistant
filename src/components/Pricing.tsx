
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Star, CreditCard, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import AcademyContactModal from "./AcademyContactModal";
import { useState } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";

const Pricing = () => {
  const { user } = useAuth();
  const { subscribed, subscription_tier, createCheckoutSession, openCustomerPortal, loading } = useSubscription();
  
  // Frontend: Solo datos de presentación (no críticos)
  const plans = [
    {
      name: "Básico",
      price: "9,95", 
      period: "mes",
      description: "Perfecto para empezar",
      features: [
        "100 consultas mensuales",
        "Acceso a temarios básicos",
        "Soporte por email",
        "Tests automáticos"
      ],
      popular: false
    },
    {
      name: "Profesional",
      price: "19,95", 
      period: "mes",
      description: "Para estudiantes serios",
      features: [
        "Consultas ilimitadas",
        "Todos los temarios actualizados",
        "Soporte prioritario",
        "Tests personalizados",
        "Seguimiento de progreso",
        "Recordatorios de estudio"
      ],
      popular: true
    },
    {
      name: "Academias",
      price: "49,95",
      period: "mes",
      description: "Solución para centros",
      features: [
        "Hasta 50 estudiantes",
        "Panel de administración",
        "Estadísticas detalladas", 
        "Soporte telefónico",
        "Integración personalizada",
        "Formación incluida"
      ],
      popular: false
    }
  ];

  const [modalOpen, setModalOpen] = useState(false);

  const handleSubscribe = async (planName: string) => {
    if (!user) {
      window.location.href = '/auth?mode=register';
      return;
    }

    // Solo enviamos el nombre del plan - híbrida segura
    await createCheckoutSession(planName);
  };

  const isCurrentPlan = (planName: string) => {
    return subscribed && subscription_tier === planName;
  };

  return (
    <section id="pricing" className="py-20 hero-gradient rounded-xl shadow-inner">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Elige tu <span className="gradient-text">plan perfecto</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Planes diseñados para adaptarse a tus necesidades, 
            desde estudiantes individuales hasta academias completas
          </p>
          
          {user && subscribed && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg inline-block">
              <p className="text-green-800 font-medium">
                Plan actual: <span className="font-bold">{subscription_tier}</span>
              </p>
              <Button
                onClick={openCustomerPortal}
                variant="outline"
                size="sm"
                className="mt-2 text-green-700 border-green-300 hover:bg-green-100"
              >
                <Settings className="w-4 h-4 mr-2" />
                Gestionar Suscripción
              </Button>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => {
            const isCurrent = isCurrentPlan(plan.name);
            
            return (
              <Card 
                key={index} 
                className={`relative border-2 transition-all duration-300 hover:shadow-xl shadow-lg ${
                  plan.popular 
                    ? 'border-opobot-blue scale-105 z-10 shadow-xl ring-2 ring-opobot-blue/40' 
                    : isCurrent
                    ? 'border-green-500 bg-green-50/50'
                    : 'border-gray-200 hover:border-opobot-blue bg-white/95'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-20 flex justify-center w-full pointer-events-none">
                    <Badge
                      className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-opobot-blue to-opobot-green text-white text-base font-semibold shadow-lg ring-2 ring-opobot-blue/20 border-0 animate-pulse select-none"
                      style={{ boxShadow: "0 4px 24px 0 rgba(37,99,235,0.14)" }}
                    >
                      <Star className="w-5 h-5 text-yellow-400 drop-shadow" strokeWidth={2.4} fill="#fde047" />
                      Más Popular
                    </Badge>
                  </div>
                )}

                {isCurrent && (
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-20 flex justify-center w-full pointer-events-none">
                    <Badge className="bg-green-500 text-white text-sm font-semibold px-4 py-1">
                      Tu Plan Actual
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="text-center pb-8">
                  <CardTitle className="text-2xl font-bold text-gray-900 mb-2">
                    {plan.name}
                  </CardTitle>
                  <p className="text-gray-600 mb-4">{plan.description}</p>
                  <div className="flex items-center justify-center">
                    <span className="text-4xl font-bold text-gray-900">€{plan.price}</span>
                    <span className="text-gray-600 ml-2">/{plan.period}</span>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center space-x-3">
                        <CheckCircle className="w-5 h-5 text-opobot-green flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  {plan.name === 'Academias' ? (
                    <Button 
                      onClick={() => handleSubscribe(plan.name)}
                      disabled={loading}
                      className="w-full rounded-lg text-base shadow-sm bg-opobot-blue hover:bg-opobot-blue-dark"
                      size="lg"
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      {user ? (loading ? 'Cargando...' : 'Suscribirse') : 'Comenzar Gratis'}
                    </Button>
                  ) : isCurrent ? (
                    <Button 
                      onClick={openCustomerPortal}
                      variant="outline"
                      className="w-full rounded-lg text-base shadow-sm border-green-300 text-green-700 hover:bg-green-50"
                      size="lg"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Gestionar Plan
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => handleSubscribe(plan.name)}
                      disabled={loading}
                      className="w-full rounded-lg text-base shadow-sm bg-opobot-blue hover:bg-opobot-blue-dark"
                      size="lg"
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      {user ? (loading ? 'Cargando...' : 'Suscribirse') : 'Comenzar Gratis'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <AcademyContactModal open={modalOpen} onOpenChange={setModalOpen} />

        <div className="text-center mt-12">
          <Button
            asChild
            className="px-6 py-3 rounded-xl bg-opobot-blue hover:bg-opobot-blue-dark text-white text-base font-semibold shadow transition-all"
            size="lg"
          >
            <a href="/auth?mode=register" tabIndex={-1}>
              Contáctanos para un plan personalizado
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
