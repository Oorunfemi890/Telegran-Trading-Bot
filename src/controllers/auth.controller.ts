// FILE: src/controllers/auth.controller.ts
// =============================================
import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";

const authService = new AuthService();

export class AuthController {
  /**
   * Register new user
   * POST /api/v1/auth/register
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, fullName, password, invitationCode } = req.body;

      // Validate input
      if (!email || !fullName || !password || !invitationCode) {
        res.status(400).json({
          success: false,
          message: "All fields are required",
        });
        return;
      }

      const result = await authService.register({
        email,
        fullName,
        password,
        invitationCode,
      });

      res.status(201).json({
        success: true,
        message: "Registration successful",
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Registration failed",
      });
    }
  }

  /**
   * Login user
   * POST /api/v1/auth/login
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: "Email and password are required",
        });
        return;
      }

      const result = await authService.login({ email, password });

      res.status(200).json({
        success: true,
        message: "Login successful",
        data: result,
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        message: error.message || "Login failed",
      });
    }
  }

  /**
   * Request password reset
   * POST /api/v1/auth/forgot-password
   */
  async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          message: "Email is required",
        });
        return;
      }

      const token = await authService.requestPasswordReset(email);

      res.status(200).json({
        success: true,
        message: "If your email is registered, you will receive a reset link",
        ...(process.env.NODE_ENV === "development" && { token }),
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Password reset request failed",
      });
    }
  }

  /**
   * Reset password
   * POST /api/v1/auth/reset-password
   */
  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        res.status(400).json({
          success: false,
          message: "Token and new password are required",
        });
        return;
      }

      await authService.resetPassword(token, newPassword);

      res.status(200).json({
        success: true,
        message: "Password reset successful",
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Password reset failed",
      });
    }
  }

  /**
   * Get current user profile
   * GET /api/v1/auth/profile
   */
  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      const profile = await authService.getProfile(req.userId);

      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to get profile",
      });
    }
  }

  /**
   * Validate invitation code
   * POST /api/v1/auth/validate-invitation
   */
  async validateInvitation(req: Request, res: Response): Promise<void> {
    try {
      const { code, email } = req.body;

      if (!code) {
        res.status(400).json({
          success: false,
          message: "Invitation code is required",
        });
        return;
      }

      const isValid = await authService.validateInvitationCode(code, email);

      res.status(200).json({
        success: true,
        data: { isValid },
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Validation failed",
      });
    }
  }
}
