// =============================================
// FILE: src/helpers/validation.helper.ts
// =============================================

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isStrongPassword = (password: string): boolean => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const minLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  
  return minLength && hasUppercase && hasLowercase && hasNumber;
};

export const isValidSymbol = (symbol: string): boolean => {
  // Valid forex, crypto, or index symbols
  const symbolRegex = /^[A-Z]{3,10}$/;
  return symbolRegex.test(symbol.toUpperCase());
};

export const isValidLotSize = (
  lotSize: number,
  minLot: number = 0.01,
  maxLot: number = 100
): boolean => {
  return lotSize >= minLot && lotSize <= maxLot;
};

export const isValidRiskPercentage = (risk: number): boolean => {
  return risk > 0 && risk <= 100;
};

export const isValidPrice = (price: number): boolean => {
  return price > 0 && !isNaN(price) && isFinite(price);
};

export const validateTradeDirection = (direction: string): boolean => {
  return ['buy', 'sell'].includes(direction.toLowerCase());
};