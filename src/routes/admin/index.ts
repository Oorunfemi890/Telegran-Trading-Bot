// =============================================
// FILE: src/routes/admin/index.ts
// =============================================

import { Router } from "express";
import router from "../auth.routes";
import usersRouter from "./users.routes";

const adminRouter = Router();

// Admin routes overview
adminRouter.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Admin API v1',
    endpoints: {
      invitations: '/api/v1/admin/invitations',
      users: '/api/v1/admin/users',
      analytics: '/api/v1/admin/analytics',
      system: '/api/v1/admin/system',
    },
  });
});

// Mount sub-routes
adminRouter.use('/invitations', router);
adminRouter.use('/users', usersRouter);

export default adminRouter;