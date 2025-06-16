
export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
}

export const validatePassword = (password: string): PasswordValidationResult => {
  const errors: string[] = [];
  let strength: 'weak' | 'medium' | 'strong' = 'weak';

  // Minimum length check
  if (password.length < 8) {
    errors.push('La contraseña debe tener al menos 8 caracteres');
  }

  // Character variety checks
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (!hasUpperCase) {
    errors.push('Debe incluir al menos una letra mayúscula');
  }
  if (!hasLowerCase) {
    errors.push('Debe incluir al menos una letra minúscula');
  }
  if (!hasNumbers) {
    errors.push('Debe incluir al menos un número');
  }
  if (!hasSpecialChar) {
    errors.push('Debe incluir al menos un carácter especial');
  }

  // Calculate strength
  const criteriasMet = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar, password.length >= 8].filter(Boolean).length;
  
  if (criteriasMet >= 4 && password.length >= 12) {
    strength = 'strong';
  } else if (criteriasMet >= 3 && password.length >= 8) {
    strength = 'medium';
  }

  // Common password patterns check
  const commonPatterns = ['password', '123456', 'qwerty', 'admin', 'letmein'];
  if (commonPatterns.some(pattern => password.toLowerCase().includes(pattern))) {
    errors.push('No uses patrones comunes de contraseña');
    strength = 'weak';
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength
  };
};

export const getPasswordStrengthColor = (strength: 'weak' | 'medium' | 'strong'): string => {
  switch (strength) {
    case 'weak': return 'text-red-600';
    case 'medium': return 'text-yellow-600';
    case 'strong': return 'text-green-600';
    default: return 'text-gray-600';
  }
};

export const getPasswordStrengthText = (strength: 'weak' | 'medium' | 'strong'): string => {
  switch (strength) {
    case 'weak': return 'Débil';
    case 'medium': return 'Media';
    case 'strong': return 'Fuerte';
    default: return '';
  }
};
