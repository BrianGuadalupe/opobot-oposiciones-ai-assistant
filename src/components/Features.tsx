
import { Card, CardContent } from "@/components/ui/card";
import { Book, MessageSquare, CheckCircle, Calendar } from "lucide-react";

const Features = () => {
  const features = [
    {
      icon: <Book className="w-8 h-8" />,
      title: "Temarios Actualizados",
      description: "Accede a contenido siempre actualizado de todas las oposiciones del Estado español, desde Auxiliar Administrativo hasta Técnico Superior."
    },
    {
      icon: <MessageSquare className="w-8 h-8" />,
      title: "Consultas Instantáneas", 
      description: "Resuelve dudas al momento sobre legislación, procedimientos administrativos, temarios específicos y mucho más."
    },
    {
      icon: <CheckCircle className="w-8 h-8" />,
      title: "Tests Personalizados",
      description: "Genera tests automáticos adaptados a tu nivel de conocimiento y áreas de mejora para maximizar tu preparación."
    },
    {
      icon: <Calendar className="w-8 h-8" />,
      title: "Disponible 24/7",
      description: "Estudia cuando quieras, donde quieras. Tu asistente personal está siempre disponible para ayudarte a avanzar."
    }
  ];

  return (
    <section id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            ¿Por qué elegir <span className="gradient-text">Opobot</span>?
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Diseñado específicamente para estudiantes de oposiciones, 
            Opobot combina la potencia de la IA con conocimiento especializado
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-opobot-blue to-opobot-green rounded-2xl flex items-center justify-center text-white mx-auto mb-6">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
