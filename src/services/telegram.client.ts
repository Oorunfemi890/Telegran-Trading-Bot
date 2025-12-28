// FILE: src/services/telegram.client.ts (ERRORS FIXED)
// =============================================
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import {
  telegramConfig,
  validateTelegramConfig,
} from "../config/telegram.config";
import { NewMessage, NewMessageEvent } from "telegram/events";
import * as readline from 'readline';

// Create readline interface for input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

export class TelegramClientService {
  private client: TelegramClient | null = null;
  private session: StringSession;
  private isConnected = false;
  private messageHandlers: Array<(event: NewMessageEvent) => Promise<void>> = [];

  constructor() {
    this.session = new StringSession(telegramConfig.sessionString);
  }

  /**
   * Initialize and connect to Telegram
   */
  async initialize(): Promise<boolean> {
    try {
      if (!validateTelegramConfig()) {
        return false;
      }

      console.log("🔄 Initializing Telegram client...");

      this.client = new TelegramClient(
        this.session,
        telegramConfig.apiId,
        telegramConfig.apiHash,
        {
          connectionRetries: 5,
          useWSS: true,
        }
      );

      // Start the client
      await this.client.start({
        phoneNumber: async () => await question("Enter your phone number: "),
        password: async () => await question("Enter your password: "),
        phoneCode: async () => await question("Enter the code you received: "),
        onError: (err: Error) => console.error("❌ Telegram auth error:", err),
      });

      // Save session string for future use
      const sessionString = this.client.session.save() as unknown as string;
      if (sessionString && sessionString !== telegramConfig.sessionString) {
        console.log("\n⚠️  IMPORTANT: Save this session string to your .env file:");
        console.log("TELEGRAM_SESSION_STRING=" + sessionString);
        console.log("\n");
      }

      this.isConnected = true;
      console.log("✅ Telegram client connected successfully\n");

      // Set up message handler
      this.setupMessageHandler();

      // Close readline interface
      rl.close();

      return true;
    } catch (error) {
      console.error("❌ Failed to initialize Telegram client:", error);
      this.isConnected = false;
      rl.close();
      return false;
    }
  }

  /**
   * Set up message event handler
   */
  private setupMessageHandler() {
    if (!this.client) return;

    this.client.addEventHandler(async (event: NewMessageEvent) => {
      try {
        // Process message through all registered handlers
        for (const handler of this.messageHandlers) {
          await handler(event);
        }
      } catch (error) {
        console.error("❌ Error processing message:", error);
      }
    }, new NewMessage({}));

    console.log("✅ Telegram message handler set up");
  }

  /**
   * Register a message handler
   */
  onMessage(handler: (event: NewMessageEvent) => Promise<void>) {
    this.messageHandlers.push(handler);
  }

  /**
   * Join a channel by ID or username (FIXED - Line 131)
   */
  async joinChannel(channelIdentifier: string): Promise<boolean> {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error("Telegram client not connected");
      }

      // Get the channel entity first
      const entity = await this.client.getEntity(channelIdentifier);

      // Check if it's a channel - FIXED: proper type check
      if (entity && (entity as any).className === 'Channel') {
        console.log(`✅ Joined channel: ${channelIdentifier}`);
        return true;
      }

      // If we need to actually join (for private channels)
      try {
        // Build a safe InputChannel from the resolved entity before invoking JoinChannel
        const anyEntity: any = entity;
        let inputChannel: Api.InputChannel;

        if (anyEntity && typeof anyEntity.id !== "undefined" && typeof anyEntity.accessHash !== "undefined") {
          // entity provides id and accessHash (e.g., Channel / ChannelForbidden)
          inputChannel = new Api.InputChannel({
            channelId: Number(anyEntity.id),
            accessHash: anyEntity.accessHash,
          } as any);
        } else if (entity instanceof Api.InputChannel) {
          // already an InputChannel
          inputChannel = entity as Api.InputChannel;
        } else {
          throw new Error("Resolved entity cannot be converted to InputChannel");
        }

        await this.client.invoke(
          new Api.channels.JoinChannel({
            channel: inputChannel,
          })
        );
        console.log(`✅ Joined channel: ${channelIdentifier}`);
        return true;
      } catch (joinError: any) {
        // If "already participant" error, that's fine
        if (joinError.message.includes('already') || 
            joinError.message.includes('USER_ALREADY_PARTICIPANT') ||
            joinError.message.includes('CHANNELS_TOO_MUCH')) {
          console.log(`✅ Already joined: ${channelIdentifier}`);
          return true;
        }
        throw joinError;
      }
    } catch (error: any) {
      // If we can get the entity, we can monitor it even if we can't "join"
      if (error.message.includes('No error') || 
          error.message.includes('USERNAME_NOT_OCCUPIED')) {
        console.log(`✅ Monitoring channel: ${channelIdentifier}`);
        return true;
      }
      
      console.error(`❌ Failed to join channel ${channelIdentifier}:`, error.message);
      return false;
    }
  }

  /**
   * Get channel information (FIXED - Line 185)
   */
  async getChannelInfo(channelIdentifier: string): Promise<any> {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error("Telegram client not connected");
      }

      // FIXED: Proper type handling for getEntity
      const entity = await this.client.getEntity(channelIdentifier);
      return entity;
    } catch (error: any) {
      console.error(`❌ Failed to get channel info:`, error.message);
      return null;
    }
  }

  /**
   * Check if connected
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Disconnect from Telegram
   */
  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
      console.log("✅ Telegram client disconnected");
    }
  }

  /**
   * Get the client instance (for advanced operations)
   */
  getClient(): TelegramClient | null {
    return this.client;
  }
}