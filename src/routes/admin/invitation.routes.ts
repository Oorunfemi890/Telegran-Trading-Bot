// FILE: src/routes/admin/invitation.routes.ts
// =============================================
// PHASE 11: ADMIN INVITATION ROUTES
// =============================================

import { Router } from 'express';
import { AdminInvitationController } from '../../controllers/admin/invitation.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { apiRateLimit } from '../../middleware/rateLimit.middleware';

const router = Router();
const invitationController = new AdminInvitationController();

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// GET /api/v1/admin/invitations - Get all invitations with filters
router.get(
  '/',
  apiRateLimit,
  (req, res) => invitationController.getAllInvitations(req, res)
);

// GET /api/v1/admin/invitations/statistics - Get invitation statistics
router.get(
  '/statistics',
  apiRateLimit,
  (req, res) => invitationController.getStatistics(req, res)
);

// GET /api/v1/admin/invitations/export - Export to CSV
router.get(
  '/export',
  apiRateLimit,
  (req, res) => invitationController.exportCSV(req, res)
);

// GET /api/v1/admin/invitations/:id - Get single invitation
router.get(
  '/:id',
  apiRateLimit,
  (req, res) => invitationController.getInvitationById(req, res)
);

// POST /api/v1/admin/invitations - Create single invitation
router.post(
  '/',
  apiRateLimit,
  (req, res) => invitationController.createInvitation(req, res)
);

// POST /api/v1/admin/invitations/bulk - Bulk create invitations
router.post(
  '/bulk',
  apiRateLimit,
  (req, res) => invitationController.bulkCreateInvitations(req, res)
);

// PUT /api/v1/admin/invitations/:id - Update invitation
router.put(
  '/:id',
  apiRateLimit,
  (req, res) => invitationController.updateInvitation(req, res)
);

// POST /api/v1/admin/invitations/:id/revoke - Revoke invitation
router.post(
  '/:id/revoke',
  apiRateLimit,
  (req, res) => invitationController.revokeInvitation(req, res)
);

// POST /api/v1/admin/invitations/:id/resend - Resend invitation email
router.post(
  '/:id/resend',
  apiRateLimit,
  (req, res) => invitationController.resendEmail(req, res)
);

// DELETE /api/v1/admin/invitations/:id - Delete invitation
router.delete(
  '/:id',
  apiRateLimit,
  (req, res) => invitationController.deleteInvitation(req, res)
);

export default router;