// FILE: src/helpers/encryption.helper.ts

import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

// Encryption configuration
const ALGORITHM = (process.env.ENCRYPTION_ALGORITHM || 'aes-256-cbc') as crypto.CipherGCMTypes;
const IV_LENGTH = 16;

// Get encryption key from environment (must be 64 hex chars = 32 bytes)
const getEncryptionKey = (): Buffer => {
  const keyHex = process.env.ENCRYPTION_KEY;
  
  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY not set in environment variables');
  }
  
  // If it's already a hex string (64 chars), convert to buffer
  if (keyHex.length === 64) {
    return Buffer.from(keyHex, 'hex');
  }
  
  // Otherwise, hash it to get 32 bytes
  return crypto.createHash('sha256').update(keyHex).digest();
};

/**
 * Encrypt sensitive text (like API keys)
 */
export const encrypt = (text: string): string => {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV + encrypted data
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypt encrypted text
 */
export const decrypt = (encryptedText: string): string => {
  try {
    const key = getEncryptionKey();
    const parts = encryptedText.split(':');
    
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
};

/**
 * Hash password with bcrypt
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

/**
 * Compare password with hash
 */
export const comparePassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

/**
 * Generate random token for verification, reset, etc.
 */
export const generateRandomToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Generate secure random code
 */
export const generateSecureCode = (length: number = 6): string => {
  const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    code += charset[randomIndex];
  }
  
  return code;
};