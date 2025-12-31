// FILE: src/controllers/admin/invitation.controller.ts
// =============================================
// PHASE 11: ADMIN INVITATION CONTROLLER (CLEANED)
// =============================================

import { Request, Response } from 'express';
import { AdminInvitationService } from '../../services/admin/invitation.service';

const invitationService = new AdminInvitationService();

export class AdminInvitationController {
  async getAllInvitations(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const filters = {
        status: req.query.status as any,
        tier: req.query.tier as any,
        search: req.query.search as string,
        dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
        dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
        hasEmail: req.query.hasEmail === 'true' ? true : req.query.hasEmail === 'false' ? false : undefined,
      };

      const result = await invitationService.getAllInvitations(filters, page, limit);

      res.json({
        success: true,
        data: result.invitations,
        meta: result.pagination,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async createInvitation(req: Request, res: Response): Promise<void> {
    try {
      const invitation = await invitationService.createInvitation({
        ...req.body,
        generatedById: req.userId!,
      });

      res.status(201).json({
        success: true,
        data: invitation,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async bulkCreateInvitations(req: Request, res: Response): Promise<void> {
    try {
      const invitations = await invitationService.bulkCreateInvitations({
        ...req.body,
        generatedById: req.userId!,
      });

      res.status(201).json({
        success: true,
        data: invitations,
        meta: { count: invitations.length },
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getInvitationById(req: Request, res: Response): Promise<void> {
    try {
      const invitation = await invitationService.getInvitationById(req.params.id);

      res.json({
        success: true,
        data: invitation,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }

  async updateInvitation(req: Request, res: Response): Promise<void> {
    try {
      const invitation = await invitationService.updateInvitation(
        req.params.id,
        req.body
      );

      res.json({
        success: true,
        data: invitation,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async revokeInvitation(req: Request, res: Response): Promise<void> {
    try {
      const invitation = await invitationService.revokeInvitation(req.params.id);

      res.json({
        success: true,
        data: invitation,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async deleteInvitation(req: Request, res: Response): Promise<void> {
    try {
      await invitationService.deleteInvitation(req.params.id);

      res.json({
        success: true,
        message: 'Invitation deleted successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      const stats = await invitationService.getStatistics();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async resendEmail(req: Request, res: Response): Promise<void> {
    try {
      await invitationService.resendInvitationEmail(req.params.id);

      res.json({
        success: true,
        message: 'Invitation email sent successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async exportCSV(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        status: req.query.status as any,
        tier: req.query.tier as any,
        search: req.query.search as string,
      };

      const csv = await invitationService.exportToCSV(filters);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=invitations.csv');
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}