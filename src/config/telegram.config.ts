// FILE: src/config/telegram.config.ts
// =============================================
export interface TelegramConfig {
  apiId: number;
  apiHash: string;
  botToken: string;
  sessionString: string;
  enabled: boolean;
}

export const telegramConfig: TelegramConfig = {
  apiId: parseInt(process.env.TELEGRAM_API_ID || '0'),
  apiHash: process.env.TELEGRAM_API_HASH || '',
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  sessionString: process.env.TELEGRAM_SESSION_STRING || '',
  enabled: !!(process.env.TELEGRAM_API_ID && process.env.TELEGRAM_API_HASH),
};

export const validateTelegramConfig = (): boolean => {
  // Check if Telegram is explicitly disabled
  if (process.env.TELEGRAM_ENABLED === 'false') {
    console.log('⚠️  Telegram integration disabled via TELEGRAM_ENABLED flag');
    return false;
  }

  if (!telegramConfig.apiId || telegramConfig.apiId === 0) {
    console.log('⚠️  Telegram integration disabled - TELEGRAM_API_ID missing or invalid');
    return false;
  }

  if (!telegramConfig.apiHash) {
    console.log('⚠️  Telegram integration disabled - TELEGRAM_API_HASH missing');
    return false;
  }

  // Validate API ID is a number
  if (isNaN(telegramConfig.apiId)) {
    console.log('⚠️  Telegram integration disabled - TELEGRAM_API_ID must be a number');
    return false;
  }

  console.log('✅ Telegram configuration valid');
  console.log(`   API ID: ${telegramConfig.apiId}`);
  console.log(`   API Hash: ${telegramConfig.apiHash.substring(0, 8)}...`);
  
  return true;
};