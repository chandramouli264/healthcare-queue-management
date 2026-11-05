import { Request, Response } from 'express';
import { appointmentService } from '../services/appointment.service';
import { sendSuccess } from '../utils/apiResponse';
import { getPagination } from '../utils/pagination';

export const appointmentController = {
  async create(req: Request, res: Response) {
    sendSuccess(res, await appointmentService.create(req.user!, req.body), 'Appointment booked successfully', 201);
  },
  async list(req: Request, res: Response) {
    const { items, meta } = await appointmentService.list(req.user!, { ...(req.query as Record<string, never>), ...getPagination(req.query) });
    sendSuccess(res, items, 'Appointments retrieved', 200, meta);
  },
  async get(req: Request, res: Response) {
    sendSuccess(res, await appointmentService.getById(req.user!, req.params.id));
  },
  async listForPatient(req: Request, res: Response) {
    const { items, meta } = await appointmentService.listForPatient(req.user!, req.params.id, {
      ...(req.query as Record<string, never>),
      ...getPagination(req.query),
    });
    sendSuccess(res, items, 'Appointments retrieved', 200, meta);
  },
  async cancel(req: Request, res: Response) {
    sendSuccess(res, await appointmentService.cancel(req.user!, req.params.id, req.body?.reason), 'Appointment cancelled');
  },
  async reschedule(req: Request, res: Response) {
    sendSuccess(res, await appointmentService.reschedule(req.user!, req.params.id, req.body.startTime), 'Appointment rescheduled');
  },
};
