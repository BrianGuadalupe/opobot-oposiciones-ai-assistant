
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

const Hero = () => {
  return (
    <section className="hero-gradient pt-24 pb-20 lg:pt-36 lg:pb-28 rounded-b-3xl shadow-sm transition-all duration-500">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Fondo animado de confianza */}
        <div className="absolute inset-0 pointer-events-none animate-fade-in z-0">
          <div className="w-40 h-40 bg-opobot-blue opacity-10 blur-3xl rounded-full absolute -top-8 -left-8"></div>
          <div className="w-56 h-56 bg-opobot-green opacity-10 blur-2xl rounded-full absolute top-1/2 -right-10"></div>
        </div>

        <div className="relative z-10 text-center animate-fade-in">
          <h1 className="text-4xl lg:text-6xl font-extrabold text-gray-900 mb-6 leading-tight font-inter">
            <span className="gradient-text">Opobot</span>, tu IA para 
            <br />
            <span className="bg-gradient-to-r from-opobot-blue to-opobot-green bg-clip-text text-transparent">
              Oposiciones al Estado
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            Prepara, resuelve dudas y domina tu temario. Todo con tecnología de inteligencia artificial diseñada especialmente para el mundo de las oposiciones.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-9 animate-scale-in">
            <Button 
              size="lg" 
              className="bg-opobot-blue hover:bg-opobot-blue-dark text-lg px-8 py-4 rounded-xl shadow hover:scale-105 transition-transform focus-visible:ring-2"
              onClick={() => window.location.href = '/auth?mode=register'}
            >
              🔥 Regístrate Gratis
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              className="text-lg px-8 py-4 border-2 rounded-xl border-opobot-blue hover:border-opobot-green transition-shadow hover:shadow"
            >
              Ver Demo
            </Button>
          </div>

          {/* Confianza y beneficios */}
          <div className="flex flex-wrap justify-center gap-4 mb-6 text-sm text-gray-600">
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
          
          {/* Stats banner */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-4 mb-2">
            <span className="bg-gradient-to-r from-opobot-blue/90 to-opobot-green/80 text-white rounded-full px-5 py-2 text-sm font-semibold shadow pulse">
              +5.000 opositores ya usan Opobot 🚀
            </span>
            <span className="bg-gray-100 rounded-full px-4 py-2 text-opobot-blue text-sm font-medium border border-gray-200">
              +150.000 dudas resueltas
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
