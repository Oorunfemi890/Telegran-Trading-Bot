// FILE: src/controllers/admin/invitation.controller.ts
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

// =============================================
// FILE: src/controllers/admin/users.controller.ts
// =============================================

import { AdminUserManagementService } from '../../services/admin/user-management.service';

const userService = new AdminUserManagementService();

export class AdminUsersController {
  async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const filters = {
        status: req.query.status as any,
        tier: req.query.tier as any,
        role: req.query.role as any,
        search: req.query.search as string,
        dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
        dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
        hasActiveSubscription: req.query.hasActiveSubscription === 'true' ? true : 
                              req.query.hasActiveSubscription === 'false' ? false : undefined,
      };

      const result = await userService.getAllUsers(filters, page, limit);

      res.json({
        success: true,
        data: result.users,
        meta: result.pagination,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const user = await userService.getUserById(req.params.id);

      res.json({
        success: true,
        data: user,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }

  async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const user = await userService.updateUser(req.params.id, req.body);

      res.json({
        success: true,
        data: user,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async suspendUser(req: Request, res: Response): Promise<void> {
    try {
      const user = await userService.suspendUser(req.params.id, req.body.reason);

      res.json({
        success: true,
        data: user,
        message: 'User suspended successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async activateUser(req: Request, res: Response): Promise<void> {
    try {
      const user = await userService.activateUser(req.params.id);

      res.json({
        success: true,
        data: user,
        message: 'User activated successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      await userService.deleteUser(req.params.id);

      res.json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async extendSubscription(req: Request, res: Response): Promise<void> {
    try {
      const user = await userService.extendSubscription(
        req.params.id,
        req.body.days
      );

      res.json({
        success: true,
        data: user,
        message: 'Subscription extended successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async changeUserTier(req: Request, res: Response): Promise<void> {
    try {
      const user = await userService.changeUserTier(
        req.params.id,
        req.body.tier
      );

      res.json({
        success: true,
        data: user,
        message: 'User tier changed successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getUserStatistics(req: Request, res: Response): Promise<void> {
    try {
      const stats = await userService.getUserStatistics(req.params.id);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getSystemStatistics(req: Request, res: Response): Promise<void> {
    try {
      const stats = await userService.getSystemStatistics();

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

  async promoteToAdmin(req: Request, res: Response): Promise<void> {
    try {
      const user = await userService.promoteToAdmin(
        req.params.id,
        req.userId!
      );

      res.json({
        success: true,
        data: user,
        message: 'User promoted to admin',
      });
    } catch (error: any) {
      res.status(403).json({
        success: false,
        message: error.message,
      });
    }
  }

  async demoteToUser(req: Request, res: Response): Promise<void> {
    try {
      const user = await userService.demoteToUser(
        req.params.id,
        req.userId!
      );

      res.json({
        success: true,
        data: user,
        message: 'Admin demoted to user',
      });
    } catch (error: any) {
      res.status(403).json({
        success: false,
        message: error.message,
      });
    }
  }
}