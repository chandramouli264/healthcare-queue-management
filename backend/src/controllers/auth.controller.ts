import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { sendSuccess } from '../utils/apiResponse';

export const authController = {
  async register(req: Request, res: Response) {
    sendSuccess(res, await authService.register(req.body), 'Registration successful', 201);
  },
  async login(req: Request, res: Response) {
    sendSuccess(res, await authService.login(req.body.email, req.body.password), 'Login successful');
  },
  async me(req: Request, res: Response) {
    sendSuccess(res, await authService.me(req.user!.id));
  },
  async updateMe(req: Request, res: Response) {
    sendSuccess(res, await authService.updateProfile(req.user!.id, req.body), 'Profile updated');
  },
  async changePassword(req: Request, res: Response) {
    await authService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
    sendSuccess(res, null, 'Password changed successfully');
  },
};
