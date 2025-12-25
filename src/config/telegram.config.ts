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
  if (!telegramConfig.enabled) {
    console.log('⚠️  Telegram integration disabled - missing credentials');
    return false;
  }

  if (!telegramConfig.apiId || !telegramConfig.apiHash) {
    console.error('❌ Telegram API credentials missing');
    return false;
  }

  return true;
};