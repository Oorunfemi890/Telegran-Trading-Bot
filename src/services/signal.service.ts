// FILE: src/services/signal.service.ts
// =============================================
import AppDataSource from '../config/database.config';
import { Signal } from '../database/entities/Signal.entity';
import { TelegramChannel } from '../database/entities/TelegramChannel.entity';
import { SignalParser } from '../engines/parser/signal.parser';
import { SignalStatus } from '../types';

export class SignalService {
  private signalRepo = AppDataSource.getRepository(Signal);
  private channelRepo = AppDataSource.getRepository(TelegramChannel);
  private parser = new SignalParser();

  /**
   * Process a raw message from Telegram
   */
  async processMessage(
    channelId: string,
    messageId: string,
    messageText: string,
    messageTime: Date
  ): Promise<{ success: boolean; signalId?: string; error?: string }> {
    try {
      // Find the channel
      const channel = await this.channelRepo.findOne({
        where: { channelId },
      });

      if (!channel) {
        return {
          success: false,
          error: 'Channel not found',
        };
      }

      // Check if message already processed
      const existing = await this.signalRepo.findOne({
        where: { messageId, channel_id: channel.id },
      });

      if (existing) {
        return {
          success: false,
          error: 'Message already processed',
        };
      }

      // Parse the signal
      const parseResult = this.parser.parse(messageText);

      if (!parseResult.success || !parseResult.signal) {
        console.log('❌ Failed to parse signal:', parseResult.error);
        return {
          success: false,
          error: parseResult.error || 'Parsing failed',
        };
      }

      // Calculate expiry (24 hours from now)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Create signal
      const signal = this.signalRepo.create({
        channel_id: channel.id,
        messageId,
        rawText: messageText,
        symbol: parseResult.signal.symbol,
        direction: parseResult.signal.direction,
        entryMin: parseResult.signal.entryMin,
        entryMax: parseResult.signal.entryMax,
        stopLoss: parseResult.signal.stopLoss,
        takeProfits: parseResult.signal.takeProfits,
        status: SignalStatus.ACTIVE,
        signalTime: messageTime,
        expiresAt,
      });

      await this.signalRepo.save(signal);

      console.log('✅ Signal parsed and saved:', {
        id: signal.id,
        symbol: signal.symbol,
        direction: signal.direction,
      });

      return {
        success: true,
        signalId: signal.id,
      };
    } catch (error: any) {
      console.error('❌ Error processing signal:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get active signals
   */
  async getActiveSignals() {
    return await this.signalRepo.find({
      where: { status: SignalStatus.ACTIVE },
      relations: ['channel'],
      order: { signalTime: 'DESC' },
    });
  }

  /**
   * Get signal by ID
   */
  async getSignalById(signalId: string) {
    return await this.signalRepo.findOne({
      where: { id: signalId },
      relations: ['channel', 'trades'],
    });
  }

  /**
   * Mark signal as expired
   */
  async expireSignal(signalId: string) {
    const signal = await this.getSignalById(signalId);
    if (signal) {
      signal.status = SignalStatus.EXPIRED;
      await this.signalRepo.save(signal);
    }
  }

  /**
   * Check and expire old signals
   */
  async expireOldSignals() {
    const now = new Date();
    
    const oldSignals = await this.signalRepo.find({
      where: { status: SignalStatus.ACTIVE },
    });

    let expiredCount = 0;
    for (const signal of oldSignals) {
      if (signal.expiresAt < now) {
        signal.status = SignalStatus.EXPIRED;
        await this.signalRepo.save(signal);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      console.log(`⏰ Expired ${expiredCount} old signals`);
    }
  }
}