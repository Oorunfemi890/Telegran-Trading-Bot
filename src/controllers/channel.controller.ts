// FILE: src/controllers/channel.controller.ts
// =============================================
import { Request, Response } from "express";
import { ChannelService } from "../services/channel.service";

const channelService = new ChannelService();

export class ChannelController {
  /**
   * Get all available channels
   * GET /api/v1/channels
   */
  async getAllChannels(req: Request, res: Response): Promise<void> {
    try {
      const channels = await channelService.getAllChannels();

      res.status(200).json({
        success: true,
        data: channels,
        meta: {
          total: channels.length,
        },
      });
    } catch (error: any) {
      console.error("Get all channels error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch channels",
      });
    }
  }

  /**
   * Get channel by ID
   * GET /api/v1/channels/:id
   */
  async getChannelById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: "Channel ID is required",
        });
        return;
      }

      const channel = await channelService.getChannelById(id);

      res.status(200).json({
        success: true,
        data: channel,
      });
    } catch (error: any) {
      console.error("Get channel by ID error:", error);
      res.status(404).json({
        success: false,
        message: error.message || "Channel not found",
      });
    }
  }

  /**
   * Add new channel (Admin only)
   * POST /api/v1/channels
   */
  async addChannel(req: Request, res: Response): Promise<void> {
    try {
      const { channelId, username, title, description, isPublic } = req.body;

      // Validate required fields
      if (!channelId || !title) {
        res.status(400).json({
          success: false,
          message: "Channel ID and title are required",
          details: {
            channelId: !channelId ? "Channel ID is required" : null,
            title: !title ? "Title is required" : null,
          },
        });
        return;
      }

      const channel = await channelService.addChannel({
        channelId,
        username: username || null,
        title,
        description: description || null,
        isPublic: isPublic !== undefined ? isPublic : true,
      });

      res.status(201).json({
        success: true,
        message: "Channel added successfully",
        data: channel,
      });
    } catch (error: any) {
      console.error("Add channel error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to add channel",
      });
    }
  }

  /**
   * Update channel (Admin only)
   * PUT /api/v1/channels/:id
   */
  async updateChannel(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          message: "Channel ID is required",
        });
        return;
      }

      // Validate that at least one field is being updated
      if (Object.keys(updateData).length === 0) {
        res.status(400).json({
          success: false,
          message: "No update data provided",
        });
        return;
      }

      const channel = await channelService.updateChannel(id, updateData);

      res.status(200).json({
        success: true,
        message: "Channel updated successfully",
        data: channel,
      });
    } catch (error: any) {
      console.error("Update channel error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update channel",
      });
    }
  }

  /**
   * Delete channel (Admin only)
   * DELETE /api/v1/channels/:id
   */
  async deleteChannel(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: "Channel ID is required",
        });
        return;
      }

      await channelService.deleteChannel(id);

      res.status(200).json({
        success: true,
        message: "Channel deleted successfully",
      });
    } catch (error: any) {
      console.error("Delete channel error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to delete channel",
      });
    }
  }

  /**
   * Get user's subscribed channels
   * GET /api/v1/channels/my-subscriptions
   */
  async getMyChannels(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized - User ID not found",
        });
        return;
      }

      const channels = await channelService.getUserChannels(req.userId);

      res.status(200).json({
        success: true,
        data: channels,
        meta: {
          total: channels.length,
        },
      });
    } catch (error: any) {
      console.error("Get my channels error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch subscriptions",
      });
    }
  }

  /**
   * Subscribe to channel
   * POST /api/v1/channels/:id/subscribe
   */
  async subscribeToChannel(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized - User ID not found",
        });
        return;
      }

      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: "Channel ID is required",
        });
        return;
      }

      const subscription = await channelService.subscribeToChannel(
        req.userId,
        id
      );

      res.status(200).json({
        success: true,
        message: "Subscribed to channel successfully",
        data: subscription,
      });
    } catch (error: any) {
      console.error("Subscribe to channel error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to subscribe to channel",
      });
    }
  }

  /**
   * Unsubscribe from channel
   * POST /api/v1/channels/:id/unsubscribe
   */
  async unsubscribeFromChannel(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized - User ID not found",
        });
        return;
      }

      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: "Channel ID is required",
        });
        return;
      }

      await channelService.unsubscribeFromChannel(req.userId, id);

      res.status(200).json({
        success: true,
        message: "Unsubscribed from channel successfully",
      });
    } catch (error: any) {
      console.error("Unsubscribe from channel error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to unsubscribe from channel",
      });
    }
  }

  /**
   * Get channel performance
   * GET /api/v1/channels/:id/performance
   */
  async getChannelPerformance(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: "Channel ID is required",
        });
        return;
      }

      const performance = await channelService.getChannelPerformance(id);

      res.status(200).json({
        success: true,
        data: performance,
      });
    } catch (error: any) {
      console.error("Get channel performance error:", error);
      res.status(404).json({
        success: false,
        message: error.message || "Failed to fetch channel performance",
      });
    }
  }
}
