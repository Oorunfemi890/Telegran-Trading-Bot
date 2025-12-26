// FILE: src/services/channel.service.ts
// =============================================
import AppDataSource from '../config/database.config';
import { TelegramChannel } from '../database/entities/TelegramChannel.entity';
import { UserChannelSubscription } from '../database/entities/UserChannelSubscription.entity';
import { User } from '../database/entities/User.entity';
import { TelegramClientService } from './telegram.client';

export class ChannelService {
  private channelRepo = AppDataSource.getRepository(TelegramChannel);
  private subscriptionRepo = AppDataSource.getRepository(UserChannelSubscription);
  private userRepo = AppDataSource.getRepository(User);
  private telegramClient: TelegramClientService;

  constructor() {
    this.telegramClient = new TelegramClientService();
  }

  /**
   * Get all available channels
   */
  async getAllChannels() {
    return await this.channelRepo.find({
      where: { isActive: true },
      order: { totalSignals: 'DESC' },
    });
  }

  /**
   * Get channel by ID
   */
  async getChannelById(channelId: string) {
    const channel = await this.channelRepo.findOne({
      where: { id: channelId },
      relations: ['subscriptions'],
    });

    if (!channel) {
      throw new Error('Channel not found');
    }

    return channel;
  }

  /**
   * Add a new channel
   */
  async addChannel(data: {
    channelId: string;
    username?: string;
    title: string;
    description?: string;
    isPublic: boolean;
  }) {
    // Check if channel already exists
    const existing = await this.channelRepo.findOne({
      where: { channelId: data.channelId },
    });

    if (existing) {
      throw new Error('Channel already exists');
    }

    // Try to get channel info from Telegram
    let channelInfo = null;
    if (this.telegramClient.getConnectionStatus()) {
      try {
        channelInfo = await this.telegramClient.getChannelInfo(data.channelId);
      } catch (error) {
        console.warn('Could not fetch channel info from Telegram');
      }
    }

    // Create channel
    const channel = this.channelRepo.create({
      channelId: data.channelId,
      username: data.username || channelInfo?.username || null,
      title: data.title || channelInfo?.title || 'Unknown Channel',
      description: data.description || null,
      isPublic: data.isPublic,
      isActive: true,
    });

    return await this.channelRepo.save(channel);
  }

  /**
   * Update channel
   */
  async updateChannel(
    channelId: string,
    data: Partial<{
      title: string;
      description: string;
      isPublic: boolean;
      isActive: boolean;
    }>
  ) {
    const channel = await this.getChannelById(channelId);

    Object.assign(channel, data);

    return await this.channelRepo.save(channel);
  }

  /**
   * Delete channel (soft delete by deactivating)
   */
  async deleteChannel(channelId: string) {
    const channel = await this.getChannelById(channelId);

    channel.isActive = false;

    return await this.channelRepo.save(channel);
  }

  /**
   * Get user's subscribed channels
   */
  async getUserChannels(userId: string) {
    const subscriptions = await this.subscriptionRepo.find({
      where: { user_id: userId, isActive: true },
      relations: ['channel'],
    });

    return subscriptions.map((sub) => sub.channel);
  }

  /**
   * Subscribe user to channel
   */
  async subscribeToChannel(userId: string, channelId: string) {
    // Verify user exists
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    // Verify channel exists
    const channel = await this.channelRepo.findOne({ where: { id: channelId } });
    if (!channel) {
      throw new Error('Channel not found');
    }

    if (!channel.isActive) {
      throw new Error('Channel is not active');
    }

    // Check if already subscribed
    const existing = await this.subscriptionRepo.findOne({
      where: { user_id: userId, channel_id: channelId },
    });

    if (existing) {
      if (existing.isActive) {
        throw new Error('Already subscribed to this channel');
      }
      // Reactivate subscription
      existing.isActive = true;
      return await this.subscriptionRepo.save(existing);
    }

    // Create new subscription
    const subscription = this.subscriptionRepo.create({
      user_id: userId,
      channel_id: channelId,
      isActive: true,
    });

    return await this.subscriptionRepo.save(subscription);
  }

  /**
   * Unsubscribe user from channel
   */
  async unsubscribeFromChannel(userId: string, channelId: string) {
    const subscription = await this.subscriptionRepo.findOne({
      where: { user_id: userId, channel_id: channelId },
    });

    if (!subscription) {
      throw new Error('Not subscribed to this channel');
    }

    subscription.isActive = false;

    return await this.subscriptionRepo.save(subscription);
  }

  /**
   * Get channel performance statistics
   */
  async getChannelPerformance(channelId: string) {
    const channel = await this.getChannelById(channelId);

    const successRate =
      channel.totalSignals > 0
        ? (channel.successfulSignals / channel.totalSignals) * 100
        : 0;

    return {
      channelId: channel.id,
      channelName: channel.title,
      totalSignals: channel.totalSignals,
      successfulSignals: channel.successfulSignals,
      successRate: successRate.toFixed(2),
      subscriberCount: channel.subscriptions?.length || 0,
    };
  }

  /**
   * Update channel statistics after signal processing
   */
  async updateChannelStats(
    channelId: string,
    wasSuccessful: boolean
  ): Promise<void> {
    const channel = await this.channelRepo.findOne({
      where: { channelId },
    });

    if (channel) {
      channel.totalSignals += 1;
      if (wasSuccessful) {
        channel.successfulSignals += 1;
      }
      await this.channelRepo.save(channel);
    }
  }
}