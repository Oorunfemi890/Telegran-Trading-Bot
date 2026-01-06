// ===================================================
// FILE: src/services/channel-request.service.ts (FIXED)
// ===================================================

import AppDataSource from "../config/database.config";
import {
  ChannelRequest,
  ChannelRequestStatus,
} from "../database/entities/ChannelRequest.entity";
import { TelegramChannel } from "../database/entities/TelegramChannel.entity";
import { EmailService } from "./email.service";
import { getWebSocketServer } from "../websocket/socket.server";

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
    telegramLink?: string;
    reason: string;
  }): Promise<ChannelRequest> {
    // ✅ REMOVED: Check if channel already exists - allow requests anyway

    // Check if user already has pending request for this channel
    const existingRequest = await this.requestRepo.findOne({
      where: {
        user_id: data.userId,
        channelId: data.channelId,
        status: ChannelRequestStatus.PENDING,
      },
    });

    if (existingRequest) {
      throw new Error("You already have a pending request for this channel");
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

    // ✅ EMIT WEBSOCKET EVENT TO ALL ADMINS
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.emitToAdmins("channel:request:new", {
        type: "channel_request_submitted",
        request: {
          id: request.id,
          channelTitle: request.channelTitle,
          channelUsername: request.channelUsername,
          channelId: request.channelId,
          reason: request.reason,
          createdAt: request.createdAt,
        },
        timestamp: new Date(),
      });
      console.log("📡 WebSocket: Channel request notification sent to admins");
    }

    return request;
  }

  /**
   * Get all channel requests (Admin) - ✅ FETCH ALL, NOT JUST PENDING
   */
  async getAllRequests(filters?: {
    status?: ChannelRequestStatus;
    userId?: string;
  }): Promise<ChannelRequest[]> {
    const query = this.requestRepo
      .createQueryBuilder("request")
      .leftJoinAndSelect("request.user", "user")
      .leftJoinAndSelect("request.reviewedBy", "reviewedBy")
      .orderBy("request.createdAt", "DESC");

    if (filters?.status) {
      query.andWhere("request.status = :status", { status: filters.status });
    }

    if (filters?.userId) {
      query.andWhere("request.user_id = :userId", { userId: filters.userId });
    }

    return await query.getMany();
  }

  /**
   * Get user's channel requests
   */
  async getUserRequests(userId: string): Promise<ChannelRequest[]> {
    return await this.requestRepo.find({
      where: { user_id: userId },
      order: { createdAt: "DESC" },
      relations: ["reviewedBy"],
    });
  }

  /**
   * Approve channel request (Admin) - UPDATED TO ACCEPT EDITED DATA
   */
  async approveRequest(
    requestId: string,
    adminId: string,
    editedData?: {
      channelTitle?: string;
      channelUsername?: string;
      channelDescription?: string;
      channelId?: string;
    }
  ): Promise<{ request: ChannelRequest; channel: TelegramChannel }> {
    const request = await this.requestRepo.findOne({
      where: { id: requestId },
      relations: ["user"],
    });

    if (!request) {
      throw new Error("Request not found");
    }

    if (request.status !== ChannelRequestStatus.PENDING) {
      throw new Error("Request has already been reviewed");
    }

    // ✅ USE EDITED DATA IF PROVIDED, OTHERWISE USE ORIGINAL REQUEST DATA
    const finalChannelId = editedData?.channelId || request.channelId;
    const finalTitle = editedData?.channelTitle || request.channelTitle;
    const finalUsername =
      editedData?.channelUsername || request.channelUsername;
    const finalDescription =
      editedData?.channelDescription || request.channelDescription;

    // ✅ CHECK IF CHANNEL ALREADY EXISTS BEFORE CREATING
    let channel = await this.channelRepo.findOne({
      where: { channelId: finalChannelId },
    });

    if (!channel) {
      // Create the channel with final (possibly edited) data
      channel = this.channelRepo.create({
        channelId: finalChannelId,
        username: finalUsername,
        title: finalTitle,
        description: finalDescription,
        isPublic: true,
        isActive: true,
      });

      await this.channelRepo.save(channel);
      console.log("✅ New channel created:", channel.title);
    } else {
      // Channel exists - optionally update it with edited data if provided
      if (editedData) {
        channel.title = finalTitle;
        channel.username = finalUsername;
        channel.description = finalDescription;
        await this.channelRepo.save(channel);
        console.log(
          "✅ Existing channel updated with edited data:",
          channel.title
        );
      } else {
        console.log(
          "ℹ️ Channel already exists, marking request as approved:",
          channel.title
        );
      }
    }

    // Update request
    request.status = ChannelRequestStatus.APPROVED;
    request.reviewed_by_id = adminId;
    request.reviewedAt = new Date();

    await this.requestRepo.save(request);

    // Send approval email to user
    await this.emailService.sendChannelApprovalEmail({
      recipientName: request.user.fullName,
      recipientEmail: request.user.email,
      channelTitle: finalTitle,
      approved: true,
    });

    // ✅ EMIT WEBSOCKET EVENTS
    const wsServer = getWebSocketServer();
    if (wsServer) {
      // Notify user
      wsServer.emitToUser(request.user_id, "channel:request:approved", {
        type: "channel_request_approved",
        channelTitle: finalTitle,
        channelId: channel.id,
        timestamp: new Date(),
      });

      // Notify all admins
      wsServer.emitToAdmins("channel:request:processed", {
        type: "channel_request_approved",
        requestId: request.id,
        channelTitle: finalTitle,
        timestamp: new Date(),
      });

      // Broadcast new channel to all users
      wsServer.broadcast("channel:added", {
        type: "channel_added",
        channel: {
          id: channel.id,
          channelId: channel.channelId,
          title: channel.title,
          username: channel.username,
          description: channel.description,
        },
        timestamp: new Date(),
      });
    }

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
      relations: ["user"],
    });

    if (!request) {
      throw new Error("Request not found");
    }

    if (request.status !== ChannelRequestStatus.PENDING) {
      throw new Error("Request has already been reviewed");
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

    // ✅ EMIT WEBSOCKET EVENT TO USER
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.emitToUser(request.user_id, "channel:request:rejected", {
        type: "channel_request_rejected",
        channelTitle: request.channelTitle,
        rejectionReason,
        timestamp: new Date(),
      });

      // ✅ EMIT TO ALL ADMINS (TO UPDATE THEIR NOTIFICATION COUNT)
      wsServer.emitToAdmins("channel:request:processed", {
        type: "channel_request_rejected",
        requestId: request.id,
        channelTitle: request.channelTitle,
        timestamp: new Date(),
      });
    }

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
