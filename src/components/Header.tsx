
import { Button } from "@/components/ui/button";

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-opobot-blue to-opobot-green rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">O</span>
            </div>
            <span className="text-xl font-bold text-gray-900">Opobot</span>
          </div>
          
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-gray-600 hover:text-opobot-blue transition-colors">
              Características
            </a>
            <a href="#pricing" className="text-gray-600 hover:text-opobot-blue transition-colors">
              Precios
            </a>
            <a href="#testimonials" className="text-gray-600 hover:text-opobot-blue transition-colors">
              Testimonios
            </a>
          </nav>

          <div className="flex items-center space-x-4">
            <Button variant="outline" className="hidden sm:inline-flex">
              Iniciar Sesión
            </Button>
            <Button className="bg-opobot-blue hover:bg-opobot-blue-dark">
              Comenzar Gratis
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
