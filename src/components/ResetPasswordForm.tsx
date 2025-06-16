
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { validatePassword, getPasswordStrengthColor, getPasswordStrengthText } from '@/utils/passwordValidation';

const ResetPasswordForm = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { resetPassword, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Si ya está autenticado, redirigir
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validar que las contraseñas coincidan
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      setLoading(false);
      return;
    }

    // Validar fortaleza de la contraseña
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setError(`Contraseña no válida: ${passwordValidation.errors.join(', ')}`);
      setLoading(false);
      return;
    }

    try {
      const { error } = await resetPassword(password);
      if (error) {
        setError(error.message);
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError('Ocurrió un error inesperado');
    }
    
    setLoading(false);
  };

  const passwordValidation = validatePassword(password);

  return (
    <div className="min-h-screen bg-gradient-to-br from-opobot-blue to-opobot-green flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-r from-opobot-blue to-opobot-green rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">O</span>
          </div>
          <span className="text-2xl font-bold text-gray-900 ml-3">Opobot</span>
        </div>

        <h2 className="text-2xl font-bold text-center mb-6">
          Restablecer Contraseña
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="password">Nueva Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              minLength={8}
            />
            {password && (
              <div className="mt-1">
                <span className={`text-xs ${getPasswordStrengthColor(passwordValidation.strength)}`}>
                  Fortaleza: {getPasswordStrengthText(passwordValidation.strength)}
                </span>
                {passwordValidation.errors.length > 0 && (
                  <ul className="text-xs text-red-600 mt-1">
                    {passwordValidation.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="••••••••"
              minLength={8}
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
            disabled={loading || !passwordValidation.isValid}
          >
            {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordForm;
