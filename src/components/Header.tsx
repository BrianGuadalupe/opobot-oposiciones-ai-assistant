
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, User, MessageCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const Header = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-opobot-blue to-opobot-green rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">O</span>
            </div>
            <span className="text-xl font-bold text-gray-900">Opobot</span>
          </Link>
          
          <nav className="hidden md:flex items-center space-x-8">
            {user && (
              <Link 
                to="/chat" 
                className={`flex items-center space-x-2 transition-colors ${
                  location.pathname === '/chat' 
                    ? 'text-opobot-blue' 
                    : 'text-gray-600 hover:text-opobot-blue'
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                <span>Chat IA</span>
              </Link>
            )}
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
            {user ? (
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <User className="w-4 h-4" />
                  <span>{user.email}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={signOut}
                  className="flex items-center space-x-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Salir</span>
                </Button>
              </div>
            ) : (
              <>
                <Button variant="outline" className="hidden sm:inline-flex">
                  <Link to="/auth">Iniciar Sesión</Link>
                </Button>
                <Button className="bg-opobot-blue hover:bg-opobot-blue-dark">
                  <Link to="/auth">Comenzar Gratis</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
