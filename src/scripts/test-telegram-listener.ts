// FILE: src/scripts/test-telegram-listener.ts (IMPROVED)
// =============================================
import 'reflect-metadata';
import { config } from 'dotenv';
import AppDataSource from '../config/database.config';
import { TelegramChannel } from '../database/entities/TelegramChannel.entity';
import { initializeDatabase } from '../config/database.config';
import { initializeRedis } from '../config/redis.config';
import { telegramConfig, validateTelegramConfig } from '../config/telegram.config';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

config();

async function testTelegramListener() {
  try {
    console.log('\n🧪 TELEGRAM LISTENER DIAGNOSTIC\n');
    console.log('='.repeat(70));

    // 1. Check config
    console.log('\n1️⃣  CHECKING TELEGRAM CONFIGURATION');
    console.log('-'.repeat(70));
    
    const configValid = validateTelegramConfig();
    if (!configValid) {
      console.error('❌ Telegram configuration is invalid!');
      process.exit(1);
    }
    
    console.log('✅ Configuration valid');
    console.log(`   API ID: ${telegramConfig.apiId}`);
    console.log(`   API Hash: ${telegramConfig.apiHash.substring(0, 8)}...`);
    console.log(`   Session: ${telegramConfig.sessionString ? '✓ Present' : '✗ Missing'}`);

    // 2. Initialize database
    console.log('\n2️⃣  CONNECTING TO DATABASE');
    console.log('-'.repeat(70));
    
    await initializeDatabase();
    console.log('✅ Database connected');

    // 3. Initialize Redis
    console.log('\n3️⃣  CONNECTING TO REDIS');
    console.log('-'.repeat(70));
    
    await initializeRedis();
    console.log('✅ Redis connected');

    // 4. Load channels
    console.log('\n4️⃣  LOADING MONITORED CHANNELS');
    console.log('-'.repeat(70));
    
    const channelRepo = AppDataSource.getRepository(TelegramChannel);
    const channels = await channelRepo.find({
      where: { isActive: true },
    });

    if (channels.length === 0) {
      console.warn('⚠️  No channels configured!');
      console.log('\n💡 Add a channel:');
      console.log('   POST /api/v1/channels');
      console.log('   {');
      console.log('     "channelId": "-1003564664086",');
      console.log('     "title": "Your Channel Name",');
      console.log('     "isPublic": true');
      console.log('   }');
      
      await AppDataSource.destroy();
      process.exit(1);
    }

    console.log(`✅ Found ${channels.length} channel(s):`);
    for (const ch of channels) {
      console.log(`   • ${ch.title}`);
      console.log(`     ID: ${ch.channelId}`);
    }

    // 5. Test Telegram connection
    console.log('\n5️⃣  TESTING TELEGRAM CONNECTION');
    console.log('-'.repeat(70));
    
    const client = new TelegramClient(
      new StringSession(telegramConfig.sessionString),
      telegramConfig.apiId,
      telegramConfig.apiHash,
      {
        connectionRetries: 5,
        useWSS: true,
      }
    );

    console.log('🔄 Connecting...');
    await client.connect();
    console.log('✅ Telegram connected');

    // Get current user
    const me = await client.getMe();
    console.log(`✅ Authenticated as: ${(me as any).firstName}`);
    console.log(`   Phone: +${(me as any).phone}`);

    // 6. Test channel access
    console.log('\n6️⃣  TESTING CHANNEL ACCESS');
    console.log('-'.repeat(70));
    
    for (const channel of channels) {
      try {
        const entity = await client.getEntity(parseInt(channel.channelId));
        const messages = await client.getMessages(entity, { limit: 5 });
        
        console.log(`✅ ${channel.title}`);
        console.log(`   Access: OK`);
        console.log(`   Recent messages: ${messages.length}`);
        
        if (messages.length > 0) {
          const lastMsg = messages[0];
          console.log(`   Last message: ${lastMsg.text?.substring(0, 50) || '(no text)'}...`);
          console.log(`   Time: ${new Date((lastMsg.date as number) * 1000).toLocaleString()}`);
        }
      } catch (error: any) {
        console.error(`❌ ${channel.title}: ${error.message}`);
      }
    }

    // 7. Start listening
    console.log('\n7️⃣  STARTING LISTENER');
    console.log('-'.repeat(70));
    
    const monitoredChannels = new Map(channels.map(ch => [ch.channelId, ch.title]));
    const processedMessages = new Set<string>();
    let messageCount = 0;

    // Add event handler
    client.addEventHandler(
      async (event: any) => {
        try {
          const message = event.message;
          if (!message) return;

          const chat = await message.getChat();
          const chatId = chat?.id?.toString();

          if (!chatId || !monitoredChannels.has(chatId)) {
            return;
          }

          const msgKey = `${chatId}-${message.id}`;
          if (processedMessages.has(msgKey)) {
            return;
          }

          processedMessages.add(msgKey);
          messageCount++;

          const title = monitoredChannels.get(chatId);
          const text = message.text || message.message || '';

          console.log('\n' + '═'.repeat(70));
          console.log(`📨 MESSAGE #${messageCount} RECEIVED!`);
          console.log('═'.repeat(70));
          console.log(`✅ Channel: ${title}`);
          console.log(`   ID: ${chatId}`);
          console.log(`   Time: ${new Date(message.date * 1000).toLocaleString()}`);
          console.log(`   Length: ${text.length} characters`);
          console.log(`\n📝 Content:\n${text}`);
          console.log('═'.repeat(70) + '\n');

        } catch (err) {
          console.error('❌ Error:', err);
        }
      },
      new (require('telegram/events')).NewMessage({})
    );

    console.log('✅ Event handler registered');

    // Start polling
    let pollCount = 0;
    const pollInterval = setInterval(async () => {
      pollCount++;
      if (pollCount % 3 === 0) {
        console.log(`🔄 Polling channels... (poll #${pollCount})`);
      }

      try {
        for (const [channelId, channelTitle] of monitoredChannels) {
          try {
            const entity = await client.getEntity(parseInt(channelId));
            const messages = await client.getMessages(entity, { limit: 10 });

            for (const message of messages) {
              const msgKey = `${channelId}-${message.id}`;

              if (processedMessages.has(msgKey)) {
                continue;
              }

              processedMessages.add(msgKey);
              messageCount++;

              const text = message.text || message.message || '';
              if (text.length < 20) continue;

              console.log('\n' + '═'.repeat(70));
              console.log(`📨 MESSAGE #${messageCount} DETECTED (polling)!`);
              console.log('═'.repeat(70));
              console.log(`✅ Channel: ${channelTitle}`);
              console.log(`   ID: ${channelId}`);
              console.log(`   Time: ${new Date(message.date * 1000).toLocaleString()}`);
              console.log(`   Length: ${text.length} characters`);
              console.log(`\n📝 Content:\n${text}`);
              console.log('═'.repeat(70) + '\n');
            }
          } catch (err) {
            // Ignore channel errors
          }
        }
      } catch (err) {
        // Ignore polling errors
      }
    }, 3000); // Poll every 3 seconds

    console.log('✅ Polling started (every 3 seconds)\n');

    console.log('═'.repeat(70));
    console.log('🎧 LISTENING FOR MESSAGES...\n');
    console.log('✨ Now posting a message will show here!\n');
    console.log('═'.repeat(70) + '\n');

    // Keep running
    process.on('SIGINT', () => {
      clearInterval(pollInterval);
      console.log('\n✅ Test stopped');
      process.exit(0);
    });

    // Keep running
    await new Promise(() => {});

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

testTelegramListener();