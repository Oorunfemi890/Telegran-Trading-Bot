// FILE: src/services/telegram.listener.ts (HYBRID - POLLING + EVENTS)
// =============================================
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage, NewMessageEvent } from "telegram/events";
import { Api } from "telegram/tl";
import {
  telegramConfig,
  validateTelegramConfig,
} from "../config/telegram.config";
import { SignalService } from "./signal.service";
import { SignalHandler } from "../handlers/signal.handler";
import AppDataSource from "../config/database.config";
import { TelegramChannel } from "../database/entities/TelegramChannel.entity";
import { Queue } from "bullmq";
import { getRedisClient } from "../config/redis.config";

export class TelegramListenerService {
  private client: TelegramClient | null = null;
  private signalService: SignalService;
  private signalHandler: SignalHandler;
  private signalQueue: Queue | null = null;
  private isListening = false;
  private monitoredChannels: Map<string, string> = new Map(); // channelId -> title
  private processedMessageIds: Set<string> = new Set(); // Track processed messages
  private lastCheckedMessageId: Map<string, number> = new Map(); // Track last message ID per channel
  private pollingInterval: NodeJS.Timeout | null = null;
  private eventHandlerAdded = false;
  private startTime: Date = new Date(); // When listener started

  constructor() {
    this.signalService = new SignalService();
    this.signalHandler = new SignalHandler();
    this.initializeQueue();
  }

  /**
   * Initialize signal processing queue
   */
  private initializeQueue() {
    const redis = getRedisClient();
    if (redis && redis.status === "ready") {
      this.signalQueue = new Queue("signal-processing", {
        connection: redis,
      });
      console.log("✅ Signal processing queue initialized");
    }
  }

  /**
   * Start listening to Telegram messages
   */
  async start(): Promise<boolean> {
    try {
      console.log("🎧 Starting Telegram listener...");

      if (!validateTelegramConfig()) {
        console.log("⚠️  Telegram configuration invalid");
        return false;
      }

      // Create client
      this.client = new TelegramClient(
        new StringSession(telegramConfig.sessionString),
        telegramConfig.apiId,
        telegramConfig.apiHash,
        {
          connectionRetries: 5,
          useWSS: true,
          requestRetries: 5,
          autoReconnect: true,
          connectionTimeout: 10000,
        }
      );

      // Connect
      console.log("🔄 Connecting to Telegram...");
      await this.client.connect();
      console.log("✅ Connected to Telegram\n");

      // Load channels to monitor
      await this.loadChannelsToMonitor();

      // Register event handler
      console.log("📡 Registering message event handler...");
      this.setupEventHandler();

      // Start polling for missed messages
      console.log("🔄 Starting message polling...");
      this.startPolling();

      this.isListening = true;
      console.log("✅ Telegram listener started successfully\n");

      return true;
    } catch (error) {
      console.error("❌ Failed to start Telegram listener:", error);
      return false;
    }
  }

  /**
   * Setup real-time event handler
   */
  private setupEventHandler(): void {
    if (!this.client || this.eventHandlerAdded) {
      return;
    }

    this.client.addEventHandler(async (event: NewMessageEvent) => {
      try {
        await this.handleNewMessage(event);
      } catch (error) {
        console.error("❌ Error in event handler:", error);
      }
    }, new NewMessage({}));

    this.eventHandlerAdded = true;
    console.log("✅ Event handler registered");
  }

  /**
   * Start polling for messages (backup for missed events)
   */
  private startPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    // Poll every 2 seconds
    this.pollingInterval = setInterval(async () => {
      try {
        await this.pollChannels();
      } catch (error) {
        console.error("❌ Polling error:", error);
      }
    }, 2000);

    console.log("✅ Polling started (checking every 2 seconds)");
  }

  /**
   * Poll channels for new messages
   */
  private async pollChannels(): Promise<void> {
    if (!this.client || !this.isListening) {
      return;
    }

    try {
      for (const [channelId, channelTitle] of this.monitoredChannels) {
        try {
          // Convert string ID to proper format
          let entity: any;

          try {
            // Try as channel ID first
            entity = await this.client.getEntity(parseInt(channelId));
          } catch {
            try {
              // Try as negative channel ID
              entity = await this.client.getEntity(parseInt(channelId));
            } catch {
              // Skip this channel
              continue;
            }
          }

          if (!entity) {
            continue;
          }

          // Get recent messages (last 10)
          const messages = await this.client.getMessages(entity, {
            limit: 10,
          });

          // Process each message
          for (const message of messages) {
            const msgId = `${channelId}-${message.id}`;

            // Skip if already processed
            if (this.processedMessageIds.has(msgId)) {
              continue;
            }

            // Mark as processed
            this.processedMessageIds.add(msgId);

            // Get message text
            const messageText = message.text || message.message || "";
            if (!messageText || messageText.length < 20) {
              continue;
            }

            console.log("\n" + "=".repeat(60));
            console.log("📨 NEW MESSAGE DETECTED (via polling)");
            console.log("=".repeat(60));
            console.log(`📍 Channel: ${channelTitle}`);
            console.log(`🆔 Chat ID: ${channelId}`);
            console.log(`📨 Message ID: ${message.id}`);
            console.log(
              `⏰ Time: ${new Date(message.date * 1000).toLocaleString()}`
            );
            console.log(
              `📝 Content:\n${messageText.substring(0, 200)}${
                messageText.length > 200 ? "..." : ""
              }`
            );
            console.log("=".repeat(60) + "\n");

            // Process the message
            await this.processMessage(channelId, messageText, message.id);
          }
        } catch (channelError) {
          // Silently skip channels with errors
          continue;
        }
      }
    } catch (error) {
      // Silently ignore polling errors
      return;
    }
  }

  /**
   * Handle real-time event (NEW messages only)
   */
  private async handleNewMessage(event: NewMessageEvent): Promise<void> {
    try {
      const message = event.message;
      if (!message) return;

      // Get the chat/channel
      const chat = await message.getChat();
      if (!chat) {
        return;
      }

      const chatId = chat.id?.toString();
      if (!chatId) return;

      // Check if we're monitoring this channel
      if (!this.monitoredChannels.has(chatId)) {
        return;
      }

      // Get message text
      const messageText = message.text || message.message || "";
      if (!messageText || messageText.length < 20) {
        return;
      }

      const msgId = `${chatId}-${message.id}`;

      // Skip if already processed
      if (this.processedMessageIds.has(msgId)) {
        return;
      }

      // Mark as processed
      this.processedMessageIds.add(msgId);

      const channelTitle = this.monitoredChannels.get(chatId) || "Unknown";

      console.log("\n" + "=".repeat(60));
      console.log("📨 NEW MESSAGE RECEIVED (real-time)");
      console.log("=".repeat(60));
      console.log(`📍 Channel: ${channelTitle}`);
      console.log(`🆔 Chat ID: ${chatId}`);
      console.log(`📨 Message ID: ${message.id}`);
      console.log(`⏰ Time: ${new Date(message.date * 1000).toLocaleString()}`);
      console.log(
        `📝 Content:\n${messageText.substring(0, 200)}${
          messageText.length > 200 ? "..." : ""
        }`
      );
      console.log("=".repeat(60) + "\n");

      // Process the message
      await this.processMessage(chatId, messageText, message.id);
    } catch (error) {
      console.error("❌ Error handling message:", error);
    }
  }

  /**
   * Process message and queue signal
   */
  private async processMessage(
    channelId: string,
    messageText: string,
    messageId: number
  ): Promise<void> {
    try {
      console.log("🔄 Processing message for signal parsing...");

      // Try to process the signal
      const result = await this.signalService.processMessage(
        channelId,
        messageId.toString(),
        messageText,
        new Date()
      );

      if (!result.success) {
        console.log(`ℹ️  Message is not a valid signal: ${result.error}`);
        return;
      }

      if (!result.signalId) {
        console.log("⚠️  Signal saved but no ID returned");
        return;
      }

      console.log(`✅ SIGNAL PARSED AND SAVED!`);
      console.log(`   Signal ID: ${result.signalId}\n`);

      // Queue for processing
      if (this.signalQueue) {
        await this.signalQueue.add(
          "process-signal",
          { signalId: result.signalId },
          { priority: 1, attempts: 3 }
        );
        console.log("📤 Signal queued for user processing");
      }

      // Also process immediately
      console.log("🔄 Processing signal for users...\n");
      await this.signalHandler.processNewSignal(result.signalId);
    } catch (error) {
      console.error("❌ Error processing message:", error);
    }
  }

  /**
   * Load channels from database
   */
  private async loadChannelsToMonitor(): Promise<void> {
    try {
      const channelRepo = AppDataSource.getRepository(TelegramChannel);
      const channels = await channelRepo.find({
        where: { isActive: true },
      });

      console.log(`📋 Found ${channels.length} active channel(s) to monitor\n`);

      for (const channel of channels) {
        this.monitoredChannels.set(channel.channelId, channel.title);
        console.log(`✅ Monitoring: ${channel.title}`);
        console.log(`   Channel ID: ${channel.channelId}`);
      }

      if (channels.length === 0) {
        console.log("\n⚠️  NO CHANNELS CONFIGURED!");
        console.log("💡 To add a channel:");
        console.log("   1. Login to dashboard");
        console.log("   2. Go to Channels");
        console.log("   3. Add your signal channel\n");
      } else {
        console.log("");
      }
    } catch (error) {
      console.error("❌ Error loading channels:", error);
    }
  }

  /**
   * Reload channels (hot-reload)
   */
  async reloadChannels(): Promise<void> {
    console.log("\n🔄 Reloading channels...\n");
    this.monitoredChannels.clear();
    await this.loadChannelsToMonitor();
  }

  /**
   * Stop listening
   */
  async stop(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    if (this.isListening && this.client) {
      try {
        await this.client.disconnect();
        this.isListening = false;
        console.log("✅ Telegram listener stopped");
      } catch (error) {
        console.error("❌ Error stopping listener:", error);
      }
    }
  }

  /**
   * Check if listening
   */
  isActive(): boolean {
    return this.isListening;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    isConnected: boolean;
    isListening: boolean;
    monitoredChannels: number;
    processedMessages: number;
  } {
    return {
      isConnected: this.client?.connected ?? false,
      isListening: this.isListening,
      monitoredChannels: this.monitoredChannels.size,
      processedMessages: this.processedMessageIds.size,
    };
  }

  /**
   * Get monitored channels
   */
  getMonitoredChannels(): Map<string, string> {
    return this.monitoredChannels;
  }
}
