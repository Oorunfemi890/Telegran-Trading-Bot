// FILE: src/scripts/telegram-auth.ts
// =============================================
import 'reflect-metadata';
import { config } from 'dotenv';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import * as readline from 'readline';

config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

async function authenticateTelegram() {
  try {
    console.log('\n📱 Telegram Authentication');
    console.log('===========================\n');

    // Get credentials from env
    const apiId = parseInt(process.env.TELEGRAM_API_ID || '0');
    const apiHash = process.env.TELEGRAM_API_HASH || '';
    const sessionString = process.env.TELEGRAM_SESSION_STRING || '';

    // Validate credentials
    if (!apiId || apiId === 0) {
      console.error('❌ TELEGRAM_API_ID is missing or invalid in .env file');
      console.log('\n💡 Your API credentials:');
      console.log('   TELEGRAM_API_ID=36700032');
      console.log('   TELEGRAM_API_HASH=f84134e8946cb9d1be966be7c612cc84\n');
      rl.close();
      process.exit(1);
    }

    if (!apiHash) {
      console.error('❌ TELEGRAM_API_HASH is missing in .env file');
      rl.close();
      process.exit(1);
    }

    console.log('✅ Telegram credentials found');
    console.log(`   API ID: ${apiId}`);
    console.log(`   API Hash: ${apiHash.substring(0, 8)}...`);
    console.log();

    console.log('You will be asked to:');
    console.log('1. Enter your phone number (with country code, e.g., +2348012345678)');
    console.log('2. Enter the code sent to your Telegram app');
    console.log('3. Enter your 2FA password (if enabled)\n');

    const session = new StringSession(sessionString);
    const client = new TelegramClient(session, apiId, apiHash, {
      connectionRetries: 5,
      useWSS: true,
    });

    console.log('🔄 Connecting to Telegram...\n');

    await client.start({
      phoneNumber: async () => {
        const phone = await question('Enter your phone number: ');
        return phone;
      },
      password: async () => {
        const pass = await question('Enter your 2FA password (if enabled): ');
        return pass;
      },
      phoneCode: async () => {
        const code = await question('Enter the code from Telegram: ');
        return code;
      },
      onError: (err: Error) => {
        console.error('❌ Telegram error:', err.message);
      },
    });

    console.log('\n✅ Successfully connected to Telegram!\n');

    // Get and save session string
    const newSessionString = client.session.save() as unknown as string;

    console.log('==========================================');
    console.log('⚠️  IMPORTANT: Save this to your .env file:');
    console.log('==========================================\n');
    console.log('TELEGRAM_SESSION_STRING=' + newSessionString);
    console.log('\n==========================================\n');

    // Test: Get user info
    try {
      const me = await client.getMe();
      console.log('✅ Logged in as:');
      console.log(`   Name: ${(me as any).firstName} ${(me as any).lastName || ''}`);
      console.log(`   Phone: ${(me as any).phone}`);
      console.log(`   Username: @${(me as any).username || 'N/A'}`);
      console.log();
    } catch (error) {
      console.log('⚠️  Could not fetch user info (but connection is OK)');
    }

    console.log('==========================================');
    console.log('✅ AUTHENTICATION SUCCESSFUL!');
    console.log('==========================================\n');

    console.log('📋 Next Steps:');
    console.log('1. Copy the TELEGRAM_SESSION_STRING above');
    console.log('2. Add it to your .env file');
    console.log('3. Set TELEGRAM_ENABLED=true in .env');
    console.log('4. Restart your server: npm run dev');
    console.log('5. Start monitoring signal channels!\n');

    await client.disconnect();
    rl.close();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Authentication failed:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('1. Check your phone number format (+234...)');
    console.error('2. Make sure you entered the correct code from Telegram');
    console.error('3. If you have 2FA enabled, enter your password correctly');
    console.error('4. Check your internet connection');
    console.error('5. Try again with: npm run telegram:auth\n');

    rl.close();
    process.exit(1);
  }
}

authenticateTelegram();