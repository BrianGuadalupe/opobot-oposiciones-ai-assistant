
import { Card, CardContent } from "@/components/ui/card";

const Testimonials = () => {
  const testimonials = [
    {
      name: "María González",
      role: "Auxiliar Administrativo - Aprobada",
      content: "Opobot me ayudó a entender conceptos complejos de derecho administrativo que llevaba meses sin comprender. En 3 meses conseguí mi plaza.",
      avatar: "MG"
    },
    {
      name: "Carlos Ruiz",
      role: "Profesor de Academia",
      content: "Mis alumnos han mejorado significativamente desde que empezamos a usar Opobot. Es como tener un tutor personal 24/7 para cada estudiante.",
      avatar: "CR"
    },
    {
      name: "Ana Martín", 
      role: "Estudiante de Gestión Procesal",
      content: "Lo que más me gusta es que las respuestas están siempre actualizadas. Opobot conoce la legislación más reciente mejor que muchos manuales.",
      avatar: "AM"
    }
  ];

  return (
    <section id="testimonials" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Lo que dicen nuestros <span className="gradient-text">estudiantes</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Miles de opositores ya han mejorado sus resultados con Opobot
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardContent className="p-8">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-gradient-to-r from-opobot-blue to-opobot-green rounded-full flex items-center justify-center text-white font-semibold">
                    {testimonial.avatar}
                  </div>
                  <div className="ml-4">
                    <h4 className="font-semibold text-gray-900">{testimonial.name}</h4>
                    <p className="text-sm text-gray-600">{testimonial.role}</p>
                  </div>
                </div>
                <p className="text-gray-700 leading-relaxed italic">
                  "{testimonial.content}"
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
