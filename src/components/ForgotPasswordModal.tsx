
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from '@/integrations/supabase/client';
import { sanitizeInput, validateEmail, authRateLimiter, handleSecureError } from '@/utils/securityUtils';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ForgotPasswordModal = ({ isOpen, onClose }: ForgotPasswordModalProps) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      // Rate limiting check
      const rateLimitKey = `forgot_password_${email}`;
      if (!authRateLimiter.isAllowed(rateLimitKey, 3, 15 * 60 * 1000)) {
        const remainingTime = Math.ceil(authRateLimiter.getRemainingTime(rateLimitKey, 15 * 60 * 1000) / 60000);
        setError(`Demasiados intentos. Espera ${remainingTime} minutos antes de intentar nuevamente.`);
        setLoading(false);
        return;
      }

      // Input validation
      const sanitizedEmail = sanitizeInput(email.toLowerCase());
      
      if (!validateEmail(sanitizedEmail)) {
        setError('Por favor ingresa un email válido');
        setLoading(false);
        return;
      }

      const redirectUrl = `${window.location.origin}/auth?mode=reset`;

      const { error } = await supabase.auth.resetPasswordForEmail(sanitizedEmail, {
        redirectTo: redirectUrl
      });

      if (error) {
        console.error('Password reset error:', error);
        setError('Error al enviar el email de recuperación. Inténtalo nuevamente.');
      } else {
        setMessage('Si el email existe en nuestro sistema, recibirás un enlace para restablecer tu contraseña.');
        setTimeout(() => {
          onClose();
          setEmail('');
          setMessage('');
        }, 3000);
      }
    } catch (error) {
      handleSecureError(error, 'Error al solicitar recuperación de contraseña');
      setError('Error al procesar la solicitud');
    }
    
    setLoading(false);
  };

  const handleClose = () => {
    setEmail('');
    setError('');
    setMessage('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Recuperar Contraseña</DialogTitle>
          <DialogDescription>
            Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="reset-email">Email</Label>
            <Input
              id="reset-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tu@email.com"
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm">
              {error}
            </div>
          )}

          {message && (
            <div className="text-green-600 text-sm">
              {message}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              type="submit"
              className="flex-1 bg-opobot-blue hover:bg-opobot-blue-dark"
              disabled={loading}
            >
              {loading ? 'Enviando...' : 'Enviar Enlace'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ForgotPasswordModal;
