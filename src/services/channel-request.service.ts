// ===================================================
// FILE: src/services/channel-request.service.ts (NEW)
// ===================================================

import AppDataSource from '../config/database.config';
import { ChannelRequest, ChannelRequestStatus } from '../database/entities/ChannelRequest.entity';
import { TelegramChannel } from '../database/entities/TelegramChannel.entity';
import { EmailService } from './email.service';

export class ChannelRequestService {
  private requestRepo = AppDataSource.getRepository(ChannelRequest);
  private channelRepo = AppDataSource.getRepository(TelegramChannel);
  private emailService = new EmailService();

  /**
   * Submit channel request (User)
   */
  async submitRequest(data: {
    userId: string;
    channelId: string;
    channelUsername?: string;
    channelTitle: string;
    channelDescription?: string;
    reason: string;
  }): Promise<ChannelRequest> {
    // Check if channel already exists
    const existingChannel = await this.channelRepo.findOne({
      where: { channelId: data.channelId },
    });

    if (existingChannel) {
      throw new Error('This channel is already in the system');
    }

    // Check if user already has pending request for this channel
    const existingRequest = await this.requestRepo.findOne({
      where: {
        user_id: data.userId,
        channelId: data.channelId,
        status: ChannelRequestStatus.PENDING,
      },
    });

    if (existingRequest) {
      throw new Error('You already have a pending request for this channel');
    }

    const request = this.requestRepo.create({
      user_id: data.userId,
      channelId: data.channelId,
      channelUsername: data.channelUsername || null,
      channelTitle: data.channelTitle,
      channelDescription: data.channelDescription || null,
      reason: data.reason,
      status: ChannelRequestStatus.PENDING,
    });

    await this.requestRepo.save(request);

    return request;
  }

  /**
   * Get all channel requests (Admin)
   */
  async getAllRequests(filters?: {
    status?: ChannelRequestStatus;
    userId?: string;
  }): Promise<ChannelRequest[]> {
    const query = this.requestRepo
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.user', 'user')
      .leftJoinAndSelect('request.reviewedBy', 'reviewedBy')
      .orderBy('request.createdAt', 'DESC');

    if (filters?.status) {
      query.andWhere('request.status = :status', { status: filters.status });
    }

    if (filters?.userId) {
      query.andWhere('request.user_id = :userId', { userId: filters.userId });
    }

    return await query.getMany();
  }

  /**
   * Get user's channel requests
   */
  async getUserRequests(userId: string): Promise<ChannelRequest[]> {
    return await this.requestRepo.find({
      where: { user_id: userId },
      order: { createdAt: 'DESC' },
      relations: ['reviewedBy'],
    });
  }

  /**
   * Approve channel request (Admin)
   */
  async approveRequest(
    requestId: string,
    adminId: string
  ): Promise<{ request: ChannelRequest; channel: TelegramChannel }> {
    const request = await this.requestRepo.findOne({
      where: { id: requestId },
      relations: ['user'],
    });

    if (!request) {
      throw new Error('Request not found');
    }

    if (request.status !== ChannelRequestStatus.PENDING) {
      throw new Error('Request has already been reviewed');
    }

    // Create the channel
    const channel = this.channelRepo.create({
      channelId: request.channelId,
      username: request.channelUsername,
      title: request.channelTitle,
      description: request.channelDescription,
      isPublic: true,
      isActive: true,
    });

    await this.channelRepo.save(channel);

    // Update request
    request.status = ChannelRequestStatus.APPROVED;
    request.reviewed_by_id = adminId;
    request.reviewedAt = new Date();

    await this.requestRepo.save(request);

    // Send approval email to user
    await this.emailService.sendChannelApprovalEmail({
      recipientName: request.user.fullName,
      recipientEmail: request.user.email,
      channelTitle: request.channelTitle,
      approved: true,
    });

    return { request, channel };
  }

  /**
   * Reject channel request (Admin)
   */
  async rejectRequest(
    requestId: string,
    adminId: string,
    rejectionReason: string
  ): Promise<ChannelRequest> {
    const request = await this.requestRepo.findOne({
      where: { id: requestId },
      relations: ['user'],
    });

    if (!request) {
      throw new Error('Request not found');
    }

    if (request.status !== ChannelRequestStatus.PENDING) {
      throw new Error('Request has already been reviewed');
    }

    request.status = ChannelRequestStatus.REJECTED;
    request.reviewed_by_id = adminId;
    request.reviewedAt = new Date();
    request.rejectionReason = rejectionReason;

    await this.requestRepo.save(request);

    // Send rejection email to user
    await this.emailService.sendChannelApprovalEmail({
      recipientName: request.user.fullName,
      recipientEmail: request.user.email,
      channelTitle: request.channelTitle,
      approved: false,
      rejectionReason,
    });

    return request;
  }

  /**
   * Get pending requests count (Admin)
   */
  async getPendingCount(): Promise<number> {
    return await this.requestRepo.count({
      where: { status: ChannelRequestStatus.PENDING },
    });
  }
}