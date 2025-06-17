
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import ForgotPasswordModal from "@/components/ForgotPasswordModal";
import ResetPasswordForm from "@/components/ResetPasswordForm";

const Auth = () => {
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const queryMode = urlParams.get("mode");

  // Si es modo reset, mostrar el formulario de reset
  if (queryMode === "reset") {
    return <ResetPasswordForm />;
  }

  const [isLogin, setIsLogin] = useState(queryMode !== "register");
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showEmailConfirmMessage, setShowEmailConfirmMessage] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Cambia el modo de login/register en función del parámetro cada vez que cambia la URL
    setIsLogin(queryMode !== "register");
  }, [queryMode]);

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setShowEmailConfirmMessage(false);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Email not confirmed')) {
            setError('Por favor, revisa tu email y confirma tu cuenta antes de iniciar sesión.');
          } else if (error.message.includes('Invalid login credentials')) {
            setError('Email o contraseña incorrectos. Si acabas de registrarte, confirma tu email primero.');
          } else {
            setError(error.message);
          }
        }
      } else {
        const { error } = await signUp(email, password, fullName);
        if (error) {
          if (error.message.includes('already registered')) {
            setError('Este email ya está registrado. Intenta iniciar sesión o confirma tu email si ya te registraste.');
          } else {
            setError(error.message);
          }
        } else {
          setShowEmailConfirmMessage(true);
          setError('');
        }
      }
    } catch (err) {
      setError('Ocurrió un error inesperado');
    }
    
    setLoading(false);
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-opobot-blue to-opobot-green flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="flex items-center justify-center mb-8">
            <div className="w-12 h-12 bg-gradient-to-r from-opobot-blue to-opobot-green rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">O</span>
            </div>
            <span className="text-2xl font-bold text-gray-900 ml-3">Opobot</span>
          </div>

          <h2 className="text-2xl font-bold text-center mb-6">
            {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </h2>

          {showEmailConfirmMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold text-green-800 mb-2">¡Cuenta creada!</h3>
              <p className="text-green-700 text-sm">
                Te hemos enviado un email de confirmación a <strong>{email}</strong>. 
                Por favor, revisa tu bandeja de entrada y haz clic en el enlace para confirmar tu cuenta.
              </p>
              <p className="text-green-600 text-xs mt-2">
                Una vez confirmada, podrás iniciar sesión y proceder con tu suscripción.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <Label htmlFor="fullName">Nombre Completo</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={!isLogin}
                  placeholder="Tu nombre completo"
                />
              </div>
            )}

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="tu@email.com"
              />
            </div>

            <div>
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                minLength={6}
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm text-center">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-opobot-blue hover:bg-opobot-blue-dark"
              disabled={loading}
            >
              {loading ? 'Cargando...' : (isLogin ? 'Iniciar Sesión' : 'Crear Cuenta')}
            </Button>
          </form>

          {isLogin && (
            <div className="mt-4 text-center">
              <button
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-opobot-blue hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setShowEmailConfirmMessage(false);
                // Cambia la URL para reflejar el modo al cambiar manualmente
                const params = new URLSearchParams(location.search);
                if (isLogin) {
                  params.set('mode', 'register');
                } else {
                  params.delete('mode');
                }
                navigate({
                  pathname: location.pathname,
                  search: params.toString(),
                }, { replace: true });
              }}
              className="text-opobot-blue hover:underline"
            >
              {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
            </button>
          </div>
        </div>
      </div>

      <ForgotPasswordModal 
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </>
  );
};

export default Auth;
