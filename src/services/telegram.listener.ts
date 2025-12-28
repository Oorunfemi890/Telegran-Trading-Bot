// FILE: src/services/telegram.listener.ts (OPTIMIZED - NO QUERY SPAM)
// =============================================
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage, NewMessageEvent } from "telegram/events";
import {
  telegramConfig,
  validateTelegramConfig,
} from "../config/telegram.config";
import { SignalService } from "./signal.service";
import { SignalHandler } from "../handlers/signal.handler";
import AppDataSource from "../config/database.config";
import { TelegramChannel } from "../database/entities/TelegramChannel.entity";
import { Signal } from "../database/entities/Signal.entity";
import { Queue } from "bullmq";
import { getRedisClient } from "../config/redis.config";
import { In } from "typeorm";

export class TelegramListenerService {
  private client: TelegramClient | null = null;
  private signalService: SignalService;
  private signalHandler: SignalHandler;
  private signalQueue: Queue | null = null;
  private isListening = false;
  private monitoredChannels: Map<string, string> = new Map();
  private pollingInterval: NodeJS.Timeout | null = null;
  private eventHandlerAdded = false;
  private startTime: Date = new Date();
  private processedInSession = new Set<string>(); // In-memory cache for this session

  constructor() {
    this.signalService = new SignalService();
    this.signalHandler = new SignalHandler();
    this.initializeQueue();
  }

  private initializeQueue() {
    const redis = getRedisClient();
    if (redis && redis.status === "ready") {
      this.signalQueue = new Queue("signal-processing", {
        connection: redis,
      });
      console.log("✅ Signal processing queue initialized");
    }
  }

  async start(): Promise<boolean> {
    try {
      console.log("🎧 Starting Telegram listener...");

      if (!validateTelegramConfig()) {
        console.log("⚠️  Telegram configuration invalid");
        return false;
      }

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

      console.log("🔄 Connecting to Telegram...");
      await this.client.connect();
      console.log("✅ Connected to Telegram\n");

      await this.loadChannelsToMonitor();

      console.log("📡 Registering message event handler...");
      this.setupEventHandler();

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

  private startPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(async () => {
      try {
        await this.pollChannels();
      } catch (error) {
        // Silently ignore polling errors
      }
    }, 2000);

    console.log("✅ Polling started (checking every 2 seconds)");
  }

  /**
   * OPTIMIZED: Batch check all messages at once
   */
  private async pollChannels(): Promise<void> {
    if (!this.client || !this.isListening) {
      return;
    }

    try {
      for (const [channelId, channelTitle] of this.monitoredChannels) {
        try {
          let entity: any;
          try {
            entity = await this.client.getEntity(parseInt(channelId));
          } catch {
            continue;
          }

          if (!entity) continue;

          const messages = await this.client.getMessages(entity, {
            limit: 10,
          });

          // Collect all message IDs and filter
          const messagesToCheck: Array<{
            id: number;
            text: string;
            date: Date;
          }> = [];

          for (const message of messages) {
            const messageId = message.id.toString();
            const msgKey = `${channelId}-${messageId}`;

            // Quick in-memory check first
            if (this.processedInSession.has(msgKey)) {
              continue;
            }

            const messageDate = new Date(message.date * 1000);
            if (messageDate < this.startTime) {
              continue;
            }

            const messageText = message.text || message.message || "";
            if (!messageText || messageText.length < 20) {
              continue;
            }

            messagesToCheck.push({
              id: message.id,
              text: messageText,
              date: messageDate,
            });
          }

          // No new messages to check
          if (messagesToCheck.length === 0) {
            continue;
          }

          // BATCH DATABASE CHECK - Single query instead of N queries
          const messageIds = messagesToCheck.map((m) => m.id.toString());
          const signalRepo = AppDataSource.getRepository(Signal);

          const existingSignals = await signalRepo.find({
            where: {
              messageId: In(messageIds),
              channel: { channelId: channelId },
            },
            select: ["messageId"],
          });

          const existingMessageIds = new Set(
            existingSignals.map((s) => s.messageId)
          );

          // Process only new messages
          for (const msg of messagesToCheck) {
            const messageId = msg.id.toString();
            const msgKey = `${channelId}-${messageId}`;

            if (existingMessageIds.has(messageId)) {
              this.processedInSession.add(msgKey); // Cache it
              continue;
            }

            // Mark as processed in session
            this.processedInSession.add(msgKey);

            console.log("\n" + "=".repeat(60));
            console.log("📨 NEW MESSAGE DETECTED (via polling)");
            console.log("=".repeat(60));
            console.log(`📍 Channel: ${channelTitle}`);
            console.log(`🆔 Chat ID: ${channelId}`);
            console.log(`📨 Message ID: ${msg.id}`);
            console.log(`⏰ Time: ${msg.date.toLocaleString()}`);
            console.log(
              `📝 Content:\n${msg.text.substring(0, 200)}${msg.text.length > 200 ? "..." : ""}`
            );
            console.log("=".repeat(60) + "\n");

            await this.processMessage(channelId, msg.text, msg.id);
          }
        } catch (channelError) {
          continue;
        }
      }
    } catch (error) {
      return;
    }
  }

  /**
   * Handle real-time event
   */
  private async handleNewMessage(event: NewMessageEvent): Promise<void> {
    try {
      const message = event.message;
      if (!message) return;

      const chat = await message.getChat();
      if (!chat) return;

      const chatId = chat.id?.toString();
      if (!chatId) return;

      if (!this.monitoredChannels.has(chatId)) {
        return;
      }

      const messageText = message.text || message.message || "";
      if (!messageText || messageText.length < 20) {
        return;
      }

      const messageId = message.id.toString();
      const msgKey = `${chatId}-${messageId}`;

      // Quick in-memory check
      if (this.processedInSession.has(msgKey)) {
        return;
      }

      // Database check
      const signalRepo = AppDataSource.getRepository(Signal);
      const alreadyProcessed = await signalRepo.findOne({
        where: {
          messageId: messageId,
          channel: { channelId: chatId },
        },
        select: ["id"],
      });

      if (alreadyProcessed) {
        this.processedInSession.add(msgKey);
        return;
      }

      this.processedInSession.add(msgKey);

      const channelTitle = this.monitoredChannels.get(chatId) || "Unknown";

      console.log("\n" + "=".repeat(60));
      console.log("📨 NEW MESSAGE RECEIVED (real-time)");
      console.log("=".repeat(60));
      console.log(`📍 Channel: ${channelTitle}`);
      console.log(`🆔 Chat ID: ${chatId}`);
      console.log(`📨 Message ID: ${message.id}`);
      console.log(`⏰ Time: ${new Date(message.date * 1000).toLocaleString()}`);
      console.log(
        `📝 Content:\n${messageText.substring(0, 200)}${messageText.length > 200 ? "..." : ""}`
      );
      console.log("=".repeat(60) + "\n");

      await this.processMessage(chatId, messageText, message.id);
    } catch (error) {
      console.error("❌ Error handling message:", error);
    }
  }

  private async processMessage(
    channelId: string,
    messageText: string,
    messageId: number
  ): Promise<void> {
    try {
      console.log("🔄 Processing message for signal parsing...");

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

      if (this.signalQueue) {
        await this.signalQueue.add(
          "process-signal",
          { signalId: result.signalId },
          { priority: 1, attempts: 3 }
        );
        console.log("📤 Signal queued for user processing");
      }

      console.log("🔄 Processing signal for users...\n");
      await this.signalHandler.processNewSignal(result.signalId);
    } catch (error) {
      console.error("❌ Error processing message:", error);
    }
  }

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
      } else {
        console.log("");
      }
    } catch (error) {
      console.error("❌ Error loading channels:", error);
    }
  }

  async reloadChannels(): Promise<void> {
    console.log("\n🔄 Reloading channels...\n");
    this.monitoredChannels.clear();
    await this.loadChannelsToMonitor();
  }

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

  isActive(): boolean {
    return this.isListening;
  }

  getConnectionStatus(): {
    isConnected: boolean;
    isListening: boolean;
    monitoredChannels: number;
  } {
    return {
      isConnected: this.client?.connected ?? false,
      isListening: this.isListening,
      monitoredChannels: this.monitoredChannels.size,
    };
  }

  getMonitoredChannels(): Map<string, string> {
    return this.monitoredChannels;
  }
}
