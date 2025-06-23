
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, User, MessageCircle, Bot } from "lucide-react";
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
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  location.pathname === '/chat' 
                    ? 'bg-opobot-blue text-white shadow-md' 
                    : 'bg-gradient-to-r from-opobot-blue to-opobot-green text-white hover:shadow-lg hover:scale-105'
                }`}
              >
                <Bot className="w-5 h-5" />
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
                {/* Chat IA button for mobile - visible only on small screens */}
                <Link 
                  to="/chat" 
                  className={`md:hidden flex items-center justify-center w-12 h-12 rounded-full transition-all ${
                    location.pathname === '/chat' 
                      ? 'bg-opobot-blue text-white shadow-md' 
                      : 'bg-gradient-to-r from-opobot-blue to-opobot-green text-white hover:shadow-lg hover:scale-105'
                  }`}
                >
                  <Bot className="w-6 h-6" />
                </Link>
                
                <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-600">
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
                  <span className="hidden sm:inline">Salir</span>
                </Button>
              </div>
            ) : (
              <Link to="/auth">
                <Button className="bg-opobot-blue hover:bg-opobot-blue-dark">
                  Iniciar Sesión
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
