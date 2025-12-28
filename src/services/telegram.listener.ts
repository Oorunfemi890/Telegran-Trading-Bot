// FILE: src/services/telegram.listener.ts (ALTERNATIVE - NO JOIN)
// =============================================
import { TelegramClientService } from './telegram.client';
import { SignalService } from './signal.service';
import { SignalHandler } from '../handlers/signal.handler';
import { NewMessageEvent } from 'telegram/events';
import AppDataSource from '../config/database.config';
import { TelegramChannel } from '../database/entities/TelegramChannel.entity';
import { Queue } from 'bullmq';
import { getRedisClient } from '../config/redis.config';

export class TelegramListenerService {
  private telegramClient: TelegramClientService;
  private signalService: SignalService;
  private signalHandler: SignalHandler;
  private signalQueue: Queue | null = null;
  private isListening = false;
  private monitoredChannels: Map<string, string> = new Map(); // channelId -> title

  constructor() {
    this.telegramClient = new TelegramClientService();
    this.signalService = new SignalService();
    this.signalHandler = new SignalHandler();
    this.initializeQueue();
  }

  /**
   * Initialize signal processing queue
   */
  private initializeQueue() {
    const redis = getRedisClient();
    if (redis && redis.status === 'ready') {
      this.signalQueue = new Queue('signal-processing', {
        connection: redis,
      });
      console.log('✅ Signal processing queue initialized');
    }
  }

  /**
   * Start listening to Telegram messages
   */
  async start(): Promise<boolean> {
    try {
      console.log('🎧 Starting Telegram listener...');

      // Initialize Telegram client
      const connected = await this.telegramClient.initialize();
      if (!connected) {
        console.log('⚠️  Telegram client not initialized - listener not started');
        return false;
      }

      // Load channels to monitor
      await this.loadChannelsToMonitor();

      // Register message handler (monitors ALL messages)
      this.telegramClient.onMessage(async (event: NewMessageEvent) => {
        await this.handleMessage(event);
      });

      this.isListening = true;
      console.log('✅ Telegram listener started successfully\n');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to start Telegram listener:', error);
      return false;
    }
  }

  /**
   * Load channels from database (don't join, just track IDs)
   */
  private async loadChannelsToMonitor() {
    try {
      const channelRepo = AppDataSource.getRepository(TelegramChannel);
      const channels = await channelRepo.find({
        where: { isActive: true },
      });

      console.log(`📡 Found ${channels.length} active channels to monitor`);

      for (const channel of channels) {
        this.monitoredChannels.set(channel.channelId, channel.title);
        console.log(`✅ Monitoring: ${channel.title} (${channel.channelId})`);
      }

      if (channels.length === 0) {
        console.log('\n⚠️  No channels configured for monitoring');
        console.log('💡 Add a channel via API or database, then restart\n');
      } else {
        console.log('');
      }
    } catch (error) {
      console.error('❌ Error loading channels:', error);
    }
  }

  /**
   * Handle incoming Telegram message
   */
  private async handleMessage(event: NewMessageEvent) {
    try {
      const message = event.message;
      
      // Get channel info
      const chat = await message.getChat();
      if (!chat) return;

      const channelId = chat.id?.toString();
      if (!channelId) return;

      // Check if we're monitoring this channel
      if (!this.monitoredChannels.has(channelId)) {
        return;
      }

      // Get message text
      const messageText = message.text || message.message;
      if (!messageText) return;

      // Skip very short messages (likely not signals)
      if (messageText.length < 20) return;

      const channelTitle = this.monitoredChannels.get(channelId);
      
      console.log('\n📨 New message detected');
      console.log(`📍 Channel: ${channelTitle}`);
      console.log(`🆔 ID: ${channelId}`);
      console.log(`📝 Text preview: ${messageText.substring(0, 100)}...`);

      // Queue the message for processing OR process directly
      if (this.signalQueue) {
        // Use queue for async processing
        await this.signalQueue.add(
          'process-signal',
          {
            channelId,
            messageId: message.id.toString(),
            messageText,
            messageTime: new Date(),
          },
          {
            priority: 1,
            attempts: 3,
          }
        );
        console.log('📤 Message queued for processing');
      } else {
        // Process directly without queue
        const result = await this.signalService.processMessage(
          channelId,
          message.id.toString(),
          messageText,
          new Date()
        );

        if (result.success && result.signalId) {
          console.log(`✅ Signal processed: ${result.signalId}`);
          // Process new signal (find users and queue trades)
          await this.signalHandler.processNewSignal(result.signalId);
        } else {
          console.log(`ℹ️  Not a signal: ${result.error}`);
        }
      }
    } catch (error) {
      console.error('❌ Error handling message:', error);
    }
  }

  /**
   * Reload channels from database (for hot-reload without restart)
   */
  async reloadChannels(): Promise<void> {
    console.log('🔄 Reloading channels...');
    this.monitoredChannels.clear();
    await this.loadChannelsToMonitor();
  }

  /**
   * Stop listening
   */
  async stop() {
    if (this.isListening) {
      await this.telegramClient.disconnect();
      this.isListening = false;
      console.log('✅ Telegram listener stopped');
    }
  }

  /**
   * Check if listening
   */
  isActive(): boolean {
    return this.isListening;
  }

  /**
   * Add a new channel to monitor (without joining)
   */
  async addChannel(channelId: string, title: string): Promise<boolean> {
    try {
      this.monitoredChannels.set(channelId, title);
      console.log(`✅ Now monitoring channel: ${title}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to add channel ${channelId}:`, error);
      return false;
    }
  }

  /**
   * Remove channel from monitoring
   */
  removeChannel(channelId: string): void {
    const title = this.monitoredChannels.get(channelId);
    this.monitoredChannels.delete(channelId);
    console.log(`✅ Stopped monitoring channel: ${title || channelId}`);
  }

  /**
   * Get list of monitored channels
   */
  getMonitoredChannels(): Map<string, string> {
    return this.monitoredChannels;
  }
}