import { Request, Response } from 'express';
import { userService } from '../services/user.service';
import { sendSuccess } from '../utils/apiResponse';
import { getPagination } from '../utils/pagination';

export const userController = {
  async list(req: Request, res: Response) {
    const { items, meta } = await userService.list({ ...(req.query as Record<string, never>), ...getPagination(req.query) });
    sendSuccess(res, items, 'Users retrieved', 200, meta);
  },
  async create(req: Request, res: Response) {
    sendSuccess(res, await userService.create(req.body), 'User created', 201);
  },
  async update(req: Request, res: Response) {
    sendSuccess(res, await userService.update(req.user!.id, req.params.id, req.body), 'User updated');
  },
  async remove(req: Request, res: Response) {
    sendSuccess(res, await userService.deactivate(req.user!.id, req.params.id), 'User deactivated');
  },
};
