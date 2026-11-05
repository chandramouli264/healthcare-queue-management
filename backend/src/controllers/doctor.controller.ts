import { Request, Response } from 'express';
import { doctorService } from '../services/doctor.service';
import { slotService } from '../services/slot.service';
import { sendSuccess } from '../utils/apiResponse';
import { getPagination } from '../utils/pagination';

export const doctorController = {
  async list(req: Request, res: Response) {
    const { items, meta } = await doctorService.list({ ...(req.query as Record<string, never>), ...getPagination(req.query) });
    sendSuccess(res, items, 'Doctors retrieved', 200, meta);
  },
  async specializations(_req: Request, res: Response) {
    sendSuccess(res, await doctorService.specializations());
  },
  async get(req: Request, res: Response) {
    sendSuccess(res, await doctorService.getById(req.params.id));
  },
  async create(req: Request, res: Response) {
    sendSuccess(res, await doctorService.create(req.body), 'Doctor created', 201);
  },
  async update(req: Request, res: Response) {
    sendSuccess(res, await doctorService.update(req.user!, req.params.id, req.body), 'Doctor updated');
  },
  async remove(req: Request, res: Response) {
    const result = await doctorService.remove(req.params.id);
    sendSuccess(res, result, result.deleted ? 'Doctor deleted' : 'Doctor has appointment history and was deactivated');
  },
  async getSchedules(req: Request, res: Response) {
    sendSuccess(res, await doctorService.getSchedules(req.params.id));
  },
  async replaceSchedules(req: Request, res: Response) {
    sendSuccess(res, await doctorService.replaceSchedules(req.user!, req.params.id, req.body.schedules), 'Schedule updated');
  },
  async listTimeOff(req: Request, res: Response) {
    sendSuccess(res, await doctorService.listTimeOff(req.params.id));
  },
  async addTimeOff(req: Request, res: Response) {
    sendSuccess(res, await doctorService.addTimeOff(req.user!, req.params.id, req.body), 'Time off added', 201);
  },
  async removeTimeOff(req: Request, res: Response) {
    await doctorService.removeTimeOff(req.user!, req.params.id, req.params.timeOffId);
    sendSuccess(res, null, 'Time off removed');
  },
  async availableSlots(req: Request, res: Response) {
    sendSuccess(res, await slotService.getAvailableSlots(req.params.id, String(req.query.date)), 'Available slots retrieved');
  },
};
