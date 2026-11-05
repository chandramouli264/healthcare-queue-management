import { Request, Response } from 'express';
import { patientService } from '../services/patient.service';
import { sendSuccess } from '../utils/apiResponse';
import { getPagination } from '../utils/pagination';

export const patientController = {
  async list(req: Request, res: Response) {
    const { items, meta } = await patientService.list(req.user!, { ...(req.query as Record<string, never>), ...getPagination(req.query) });
    sendSuccess(res, items, 'Patients retrieved', 200, meta);
  },
  async get(req: Request, res: Response) {
    sendSuccess(res, await patientService.getById(req.user!, req.params.id));
  },
  async update(req: Request, res: Response) {
    sendSuccess(res, await patientService.update(req.user!, req.params.id, req.body), 'Patient updated');
  },
};
