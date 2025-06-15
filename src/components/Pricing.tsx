import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Pricing = () => {
  const plans = [
    {
      name: "Básico",
      price: "10",
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
      price: "20", 
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
      price: "50",
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
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <Card 
              key={index} 
              className={`relative border-2 transition-all duration-300 hover:shadow-xl shadow-lg ${
                plan.popular 
                  ? 'border-opobot-blue scale-105 z-10 shadow-xl ring-2 ring-opobot-blue/40' 
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
                    className="w-full rounded-lg text-base shadow-sm bg-opobot-blue hover:bg-opobot-blue-dark"
                    size="lg"
                  >
                    Contactar
                  </Button>
                ) : (
                  <a href="/auth?mode=register" tabIndex={-1} className="block">
                    <Button 
                      className="w-full rounded-lg text-base shadow-sm bg-gray-900 hover:bg-gray-800"
                      size="lg"
                    >
                      Comenzar Gratis
                    </Button>
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-gray-600">
            ¿Necesitas algo diferente? 
            <a href="#" className="text-opobot-blue hover:text-opobot-blue-dark font-semibold ml-1">
              Contáctanos para un plan personalizado
            </a>
          </p>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
