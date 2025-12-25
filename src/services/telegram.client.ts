// FILE: src/services/telegram.client.ts 
// =============================================
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import {
  telegramConfig,
  validateTelegramConfig,
} from "../config/telegram.config";
import { NewMessage, NewMessageEvent } from "telegram/events";

// @ts-ignore - input module doesn't have types
const input = require("input");

export class TelegramClientService {
  private client: TelegramClient | null = null;
  private session: StringSession;
  private isConnected = false;
  private messageHandlers: Array<(event: NewMessageEvent) => Promise<void>> =
    [];

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
        phoneNumber: async () => await input.text("Enter your phone number: "),
        password: async () => await input.text("Enter your password: "),
        phoneCode: async () =>
          await input.text("Enter the code you received: "),
        onError: (err: Error) => console.error("❌ Telegram auth error:", err),
      });

      // Save session string for future use
      const sessionString = this.client.session.save() as unknown as string;
      if (sessionString && sessionString !== telegramConfig.sessionString) {
        console.log(
          "\n⚠️  IMPORTANT: Save this session string to your .env file:"
        );
        console.log("TELEGRAM_SESSION_STRING=" + sessionString);
        console.log("\n");
      }

      this.isConnected = true;
      console.log("✅ Telegram client connected successfully\n");

      // Set up message handler
      this.setupMessageHandler();

      return true;
    } catch (error) {
      console.error("❌ Failed to initialize Telegram client:", error);
      this.isConnected = false;
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
   * Join a channel by ID or username
   */
  async joinChannel(channelIdentifier: string): Promise<boolean> {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error("Telegram client not connected");
      }

      await this.client.invoke({
        _: "channels.joinChannel",
        channel: channelIdentifier,
      } as any);

      console.log(`✅ Joined channel: ${channelIdentifier}`);
      return true;
    } catch (error: any) {
      console.error(
        `❌ Failed to join channel ${channelIdentifier}:`,
        error.message
      );
      return false;
    }
  }

  /**
   * Get channel information
   */
  async getChannelInfo(channelIdentifier: string): Promise<any> {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error("Telegram client not connected");
      }

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
