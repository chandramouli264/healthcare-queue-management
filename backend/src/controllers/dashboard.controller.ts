import { Request, Response } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { sendSuccess } from '../utils/apiResponse';

export const dashboardController = {
  async stats(req: Request, res: Response) {
    sendSuccess(res, await dashboardService.stats(req.user!));
  },
};
