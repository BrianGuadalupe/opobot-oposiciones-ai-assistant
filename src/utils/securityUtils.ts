
import { toast } from '@/hooks/use-toast';

// Input sanitization utilities
export const sanitizeInput = (input: string): string => {
  // Remove potentially dangerous characters
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  return emailRegex.test(email);
};

export const validateName = (name: string): boolean => {
  // Allow letters, spaces, hyphens, and apostrophes
  const nameRegex = /^[a-zA-ZÀ-ÿ\s\-']{1,50}$/;
  return nameRegex.test(name);
};

// Rate limiting for client-side protection
class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  
  isAllowed(key: string, maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    
    // Remove old attempts outside the window
    const recentAttempts = attempts.filter(time => now - time < windowMs);
    
    if (recentAttempts.length >= maxAttempts) {
      return false;
    }
    
    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);
    return true;
  }
  
  getRemainingTime(key: string, windowMs: number = 15 * 60 * 1000): number {
    const attempts = this.attempts.get(key) || [];
    if (attempts.length === 0) return 0;
    
    const oldestAttempt = Math.min(...attempts);
    const timeElapsed = Date.now() - oldestAttempt;
    return Math.max(0, windowMs - timeElapsed);
  }
}

export const authRateLimiter = new RateLimiter();

// Security headers for API requests
export const getSecurityHeaders = (): Record<string, string> => {
  return {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  };
};

// Enhanced error handling that doesn't expose sensitive information
export const handleSecureError = (error: any, fallbackMessage: string = 'Ha ocurrido un error') => {
  console.error('Security Error:', error);
  
  // Don't expose internal error details to users
  const userMessage = error?.message?.includes('rate limit') 
    ? 'Demasiados intentos. Espera unos minutos antes de intentar nuevamente.'
    : fallbackMessage;
    
  toast({
    title: "Error",
    description: userMessage,
    variant: "destructive",
  });
};

// Session validation
export const validateSession = (session: any): boolean => {
  if (!session || !session.access_token || !session.user) {
    return false;
  }
  
  // Check if token is expired
  const expiresAt = session.expires_at;
  if (expiresAt && Date.now() / 1000 > expiresAt) {
    return false;
  }
  
  return true;
};
