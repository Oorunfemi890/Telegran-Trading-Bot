import * as crypto from 'crypto';

/**
 * Generate a cryptographically secure invitation code
 * Format: TRADE-XXXX-XXXX-XXXX (20 characters total)
 */
export const generateInvitationCode = (): string => {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous characters
  const segmentLength = 4;
  const segments = 3;
  
  const generateSegment = (): string => {
    let segment = '';
    for (let i = 0; i < segmentLength; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      segment += charset[randomIndex];
    }
    return segment;
  };
  
  const parts = ['TRADE'];
  for (let i = 0; i < segments; i++) {
    parts.push(generateSegment());
  }
  
  return parts.join('-');
};

/**
 * Validate invitation code format
 */
export const isValidInvitationCodeFormat = (code: string): boolean => {
  const pattern = /^TRADE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  return pattern.test(code);
};

/**
 * Generate multiple unique codes
 */
export const generateMultipleCodes = (count: number): string[] => {
  const codes = new Set<string>();
  
  while (codes.size < count) {
    codes.add(generateInvitationCode());
  }
  
  return Array.from(codes);
};

/**
 * Calculate expiration date from now
 */
export const calculateExpiryDate = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(23, 59, 59, 999); // End of day
  return date;
};

/**
 * Format code for display (with dashes)
 */
export const formatCodeForDisplay = (code: string): string => {
  return code.toUpperCase();
};

/**
 * Sanitize code input (remove spaces, convert to uppercase)
 */
export const sanitizeCodeInput = (code: string): string => {
  return code.replace(/\s+/g, '').toUpperCase();
};