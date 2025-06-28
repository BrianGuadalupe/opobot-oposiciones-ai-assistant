import { Button } from "@/components/ui/button";
import { CheckCircle, Bot, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDemoRegistration } from "@/hooks/useDemoRegistration";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

const Hero = () => {
  const { user } = useAuth();
  const { registerDemo, checkDemoStatus, showSubscriptionModal, isLoading } = useDemoRegistration();
  const navigate = useNavigate();
  const [demoStatus, setDemoStatus] = useState<'checking' | 'no_demo' | 'demo_active' | 'demo_exhausted'>('checking');
  const [remainingQueries, setRemainingQueries] = useState(0);

  // Verificar estado del demo cuando el usuario cambia
  useEffect(() => {
    const checkStatus = async () => {
      if (!user) {
        setDemoStatus('no_demo');
        return;
      }

      try {
        const status = await checkDemoStatus();
        setDemoStatus(status.status);
        if (status.status === 'demo_active' && status.remaining) {
          setRemainingQueries(status.remaining);
        }
      } catch (error) {
        console.error('Error checking demo status:', error);
        setDemoStatus('no_demo'); // Fallback
      }
    };

    checkStatus();
  }, [user, checkDemoStatus]);

  const handleDemoClick = async () => {
    if (!user) {
      // Redirigir a registro si no está logueado
      navigate('/auth?mode=register&demo=true');
      return;
    }

    if (demoStatus === 'demo_exhausted') {
      // Mostrar modal de suscripción
      showSubscriptionModal();
      return;
    }

    if (demoStatus === 'demo_active') {
      // Si tiene demo activo, ir al chat directamente
      navigate('/chat');
      return;
    }

    if (demoStatus === 'no_demo') {
      // Si no tiene demo, intentar activarlo
      const success = await registerDemo();
      if (success) {
        navigate('/chat');
      }
      return;
    }
  };

  const getDemoButtonText = () => {
    if (isLoading) return "Activando...";
    if (demoStatus === 'checking') return "Verificando...";
    if (demoStatus === 'demo_exhausted') return "Demo Agotado";
    if (demoStatus === 'demo_active') {
      return remainingQueries > 0 ? `Chat (${remainingQueries} restantes)` : "Ir al Chat";
    }
    return "Ver Demo";
  };

  const getDemoButtonVariant = () => {
    if (demoStatus === 'demo_exhausted') return "destructive";
    if (demoStatus === 'demo_active') return "default";
    return "outline";
  };

  const getDemoButtonIcon = () => {
    if (demoStatus === 'demo_exhausted') return <AlertCircle className="w-5 h-5" />;
    if (demoStatus === 'demo_active') return <Bot className="w-5 h-5" />;
    return <Bot className="w-5 h-5" />;
  };

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
              className="bg-opobot-blue hover:bg-opobot-blue-dark text-lg px-8 py-4 rounded-xl shadow hover:scale-105 transition-transform focus-visible:ring-2 flex items-center gap-2"
              onClick={() => window.location.href = '/auth?mode=register'}
            >
              <Bot className="w-5 h-5" />
              Regístrate Gratis
            </Button>
            <Button 
              variant={getDemoButtonVariant()}
              size="lg"
              className={`text-lg px-8 py-4 border-2 rounded-xl transition-shadow hover:shadow flex items-center gap-2 ${
                demoStatus === 'demo_exhausted' 
                  ? 'border-red-500 hover:border-red-600 bg-red-500 hover:bg-red-600 text-white' 
                  : 'border-opobot-blue hover:border-opobot-green'
              }`}
              onClick={handleDemoClick}
              disabled={isLoading || demoStatus === 'checking'}
            >
              {getDemoButtonIcon()}
              {getDemoButtonText()}
            </Button>
          </div>

          {/* Mensaje informativo para demo agotado */}
          {demoStatus === 'demo_exhausted' && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg max-w-md mx-auto">
              <p className="text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 inline mr-2" />
                Has agotado tu demo gratuito. ¡Suscríbete para acceso ilimitado!
              </p>
            </div>
          )}

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
