import { VALIDATION } from './constants';

export const validateEmail = (email: string): boolean => {
  return VALIDATION.EMAIL_REGEX.test(email);
};

export const validatePhone = (phone: string): boolean => {
  return VALIDATION.PHONE_REGEX.test(phone);
};

export const validatePassword = (password: string): { valid: boolean; message?: string } => {
  if (password.length < VALIDATION.PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      message: `Password must be at least ${VALIDATION.PASSWORD_MIN_LENGTH} characters long`,
    };
  }

  if (!VALIDATION.PASSWORD_REGEX.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    };
  }

  return { valid: true };
};

export const validateRequired = (value: any, fieldName: string): { valid: boolean; message?: string } => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return {
      valid: false,
      message: `${fieldName} is required`,
    };
  }
  return { valid: true };
};

export const validateNumber = (
  value: number,
  options: { min?: number; max?: number } = {}
): { valid: boolean; message?: string } => {
  if (isNaN(value)) {
    return { valid: false, message: 'Value must be a number' };
  }

  if (options.min !== undefined && value < options.min) {
    return { valid: false, message: `Value must be at least ${options.min}` };
  }

  if (options.max !== undefined && value > options.max) {
    return { valid: false, message: `Value must be at most ${options.max}` };
  }

  return { valid: true };
};

export const validateDate = (date: Date | string): { valid: boolean; message?: string } => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return { valid: false, message: 'Invalid date' };
  }

  return { valid: true };
};

export const validateFutureDate = (date: Date | string): { valid: boolean; message?: string } => {
  const dateValidation = validateDate(date);
  if (!dateValidation.valid) {
    return dateValidation;
  }

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();

  if (dateObj <= now) {
    return { valid: false, message: 'Date must be in the future' };
  }

  return { valid: true };
};
