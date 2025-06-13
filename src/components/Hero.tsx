
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

const Hero = () => {
  return (
    <section className="hero-gradient pt-20 pb-16 lg:pt-32 lg:pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center animate-fade-in">
          <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 mb-6">
            Tu <span className="gradient-text">Asistente IA</span> para
            <br />
            Oposiciones al Estado
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            Opobot es el primer asistente de inteligencia artificial especializado 
            en oposiciones españolas. Estudia de forma más eficiente, resuelve dudas 
            al instante y domina tu temario como nunca antes.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Button 
              size="lg" 
              className="bg-opobot-blue hover:bg-opobot-blue-dark text-lg px-8 py-4 rounded-xl"
            >
              Probar Gratis 7 Días
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              className="text-lg px-8 py-4 rounded-xl border-2"
            >
              Ver Demo
            </Button>
          </div>

          <div className="flex items-center justify-center space-x-6 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-opobot-green" />
              <span>Sin permanencia</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-opobot-green" />
              <span>Cancela cuando quieras</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-opobot-green" />
              <span>Soporte 24/7</span>
            </div>
          </div>
        </div>

        <div className="mt-16 animate-slide-up">
          <div className="relative max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-6">
              <div className="bg-gray-900 rounded-xl p-6 text-green-400 font-mono text-sm">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-400 ml-4">Opobot Assistant</span>
                </div>
                <div>
                  <span className="text-blue-400">usuario@opobot:</span>
                  <span className="text-white"> ¿Cuáles son los requisitos para ser Auxiliar Administrativo del Estado?</span>
                </div>
                <div className="mt-2 text-gray-300">
                  🤖 <strong>Opobot:</strong> Para acceder a las oposiciones de Auxiliar Administrativo del Estado necesitas cumplir los siguientes requisitos:
                  <br /><br />
                  • Ser español o ciudadano de la UE
                  <br />
                  • Tener al menos 16 años
                  <br />
                  • Poseer el título de ESO o equivalente
                  <br />
                  • No estar inhabilitado para el ejercicio público...
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
