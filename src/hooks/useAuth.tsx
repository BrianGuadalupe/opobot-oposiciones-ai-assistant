import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { validatePassword } from '@/utils/passwordValidation';
import { sanitizeInput, validateEmail, validateName, authRateLimiter, handleSecureError, validateSession } from '@/utils/securityUtils';
import { toast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (newPassword: string) => Promise<{ error: any }>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event);
        
        // Validate session before setting it
        if (session && !validateSession(session)) {
          console.log('Invalid session detected, signing out');
          await supabase.auth.signOut();
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Check subscription status when user logs in
        if (event === 'SIGNED_IN' && session) {
          try {
            await supabase.functions.invoke('check-subscription', {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            });
          } catch (error) {
            console.error('Error checking subscription on login:', error);
          }
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && validateSession(session)) {
        setSession(session);
        setUser(session?.user ?? null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      // Rate limiting check
      const rateLimitKey = `signup_${email}`;
      if (!authRateLimiter.isAllowed(rateLimitKey, 3, 15 * 60 * 1000)) {
        const remainingTime = Math.ceil(authRateLimiter.getRemainingTime(rateLimitKey, 15 * 60 * 1000) / 60000);
        return { 
          error: { 
            message: `Demasiados intentos de registro. Espera ${remainingTime} minutos antes de intentar nuevamente.` 
          } 
        };
      }

      // Input validation and sanitization
      const sanitizedEmail = sanitizeInput(email.toLowerCase());
      const sanitizedFullName = sanitizeInput(fullName);

      if (!validateEmail(sanitizedEmail)) {
        return { error: { message: 'Por favor ingresa un email válido' } };
      }

      if (!validateName(sanitizedFullName)) {
        return { error: { message: 'El nombre solo puede contener letras, espacios y guiones' } };
      }

      // Password validation
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        return { 
          error: { 
            message: `Contraseña no válida: ${passwordValidation.errors.join(', ')}` 
          } 
        };
      }

      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email: sanitizedEmail,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: sanitizedFullName
          }
        }
      });

      if (error) {
        console.error('Signup error:', error);
        // Don't expose internal error details
        const userMessage = error.message.includes('already registered') 
          ? 'Este email ya está registrado' 
          : 'Error al crear la cuenta. Inténtalo nuevamente.';
        return { error: { message: userMessage } };
      }

      return { error: null };
    } catch (error) {
      handleSecureError(error, 'Error al crear la cuenta');
      return { error: { message: 'Error al crear la cuenta' } };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      // Rate limiting check
      const rateLimitKey = `signin_${email}`;
      if (!authRateLimiter.isAllowed(rateLimitKey, 5, 15 * 60 * 1000)) {
        const remainingTime = Math.ceil(authRateLimiter.getRemainingTime(rateLimitKey, 15 * 60 * 1000) / 60000);
        return { 
          error: { 
            message: `Demasiados intentos de inicio de sesión. Espera ${remainingTime} minutos antes de intentar nuevamente.` 
          } 
        };
      }

      // Input validation and sanitization
      const sanitizedEmail = sanitizeInput(email.toLowerCase());

      if (!validateEmail(sanitizedEmail)) {
        return { error: { message: 'Por favor ingresa un email válido' } };
      }

      if (!password || password.length < 1) {
        return { error: { message: 'Por favor ingresa tu contraseña' } };
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: sanitizedEmail,
        password
      });

      if (error) {
        console.error('Signin error:', error);
        // Return specific error messages to help users
        if (error.message.includes('Email not confirmed')) {
          return { error: { message: 'Email not confirmed' } };
        } else if (error.message.includes('Invalid login credentials')) {
          return { error: { message: 'Invalid login credentials' } };
        } else {
          return { error: { message: 'Error al iniciar sesión' } };
        }
      }

      return { error: null };
    } catch (error) {
      handleSecureError(error, 'Error al iniciar sesión');
      return { error: { message: 'Error al iniciar sesión' } };
    }
  };

  const resetPassword = async (newPassword: string) => {
    try {
      // Password validation
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        return { 
          error: { 
            message: `Contraseña no válida: ${passwordValidation.errors.join(', ')}` 
          } 
        };
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        console.error('Password reset error:', error);
        return { error: { message: 'Error al actualizar la contraseña' } };
      }

      return { error: null };
    } catch (error) {
      handleSecureError(error, 'Error al restablecer contraseña');
      return { error: { message: 'Error al restablecer contraseña' } };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Signout error:', error);
      handleSecureError(error, 'Error al cerrar sesión');
    }
  };

  const value = {
    user,
    session,
    signUp,
    signIn,
    signOut,
    resetPassword,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
