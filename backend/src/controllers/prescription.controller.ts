import { Request, Response } from 'express';
import { prescriptionService } from '../services/prescription.service';
import { sendSuccess } from '../utils/apiResponse';
import { getPagination } from '../utils/pagination';

export const prescriptionController = {
  async create(req: Request, res: Response) {
    sendSuccess(res, await prescriptionService.create(req.user!, req.body), 'Prescription created', 201);
  },
  async list(req: Request, res: Response) {
    const { items, meta } = await prescriptionService.list(req.user!, { ...(req.query as Record<string, never>), ...getPagination(req.query) });
    sendSuccess(res, items, 'Prescriptions retrieved', 200, meta);
  },
  async get(req: Request, res: Response) {
    sendSuccess(res, await prescriptionService.getById(req.user!, req.params.id));
  },
  async listForPatient(req: Request, res: Response) {
    const { items, meta } = await prescriptionService.listForPatient(req.user!, req.params.id, getPagination(req.query));
    sendSuccess(res, items, 'Prescriptions retrieved', 200, meta);
  },
  async update(req: Request, res: Response) {
    sendSuccess(res, await prescriptionService.update(req.user!, req.params.id, req.body), 'Prescription updated');
  },
  async remove(req: Request, res: Response) {
    await prescriptionService.remove(req.user!, req.params.id);
    sendSuccess(res, null, 'Prescription deleted');
  },
};
