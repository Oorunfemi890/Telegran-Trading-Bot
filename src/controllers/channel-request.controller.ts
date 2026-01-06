// ===================================================
// FILE: src/controllers/channel-request.controller.ts (NEW)
// ===================================================

import { Request, Response } from "express";
import { ChannelRequestService } from "../services/channel-request.service";

const channelRequestService = new ChannelRequestService();

export class ChannelRequestController {
  // User endpoints
  async submitRequest(req: Request, res: Response): Promise<void> {
    try {
      const request = await channelRequestService.submitRequest({
        userId: req.userId!,
        ...req.body,
      });

      res.status(201).json({
        success: true,
        message: "Channel request submitted successfully",
        data: request,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getUserRequests(req: Request, res: Response): Promise<void> {
    try {
      const requests = await channelRequestService.getUserRequests(req.userId!);

      res.json({
        success: true,
        data: requests,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Admin endpoints
  async getAllRequests(req: Request, res: Response): Promise<void> {
    try {
      const requests = await channelRequestService.getAllRequests({
        status: req.query.status as any,
      });

      res.json({
        success: true,
        data: requests,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async approveRequest(req: Request, res: Response): Promise<void> {
    try {
      // ✅ ACCEPT EDITED DATA FROM REQUEST BODY
      const editedData = req.body.editedData
        ? {
            channelTitle: req.body.editedData.channelTitle,
            channelUsername: req.body.editedData.channelUsername,
            channelDescription: req.body.editedData.channelDescription,
            channelId: req.body.editedData.channelId,
          }
        : undefined;

      const result = await channelRequestService.approveRequest(
        req.params.id,
        req.userId!,
        editedData // ✅ PASS EDITED DATA
      );

      res.json({
        success: true,
        message: "Channel request approved",
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async rejectRequest(req: Request, res: Response): Promise<void> {
    try {
      const request = await channelRequestService.rejectRequest(
        req.params.id,
        req.userId!,
        req.body.rejectionReason
      );

      res.json({
        success: true,
        message: "Channel request rejected",
        data: request,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getPendingCount(_req: Request, res: Response): Promise<void> {
    try {
      const count = await channelRequestService.getPendingCount();

      res.json({
        success: true,
        data: { count },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}
