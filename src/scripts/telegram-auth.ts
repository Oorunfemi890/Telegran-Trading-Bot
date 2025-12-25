// FILE: src/scripts/telegram-auth.ts
// =============================================
import 'reflect-metadata';
import { config } from 'dotenv';
import { TelegramClientService } from '../services/telegram.client';

config();

async function authenticateTelegram() {
  try {
    console.log('\n📱 Telegram Authentication');
    console.log('===========================\n');

    console.log('You will be asked to:');
    console.log('1. Enter your phone number (with country code, e.g., +1234567890)');
    console.log('2. Enter the code sent to your Telegram app');
    console.log('3. Enter your 2FA password (if enabled)\n');

    const telegram = new TelegramClientService();

    const connected = await telegram.initialize();

    if (connected) {
      console.log('\n✅ Authentication successful!');
      console.log('⚠️  Copy the SESSION_STRING above and add it to your .env file');
      console.log('📱 You can now use Telegram integration!\n');
    } else {
      console.log('\n❌ Authentication failed');
      console.log('💡 Check your API credentials in .env file\n');
    }

    await telegram.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during authentication:', error);
    process.exit(1);
  }
}

authenticateTelegram();