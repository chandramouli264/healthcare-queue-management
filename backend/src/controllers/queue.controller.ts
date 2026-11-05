import { Request, Response } from 'express';
import { queueService } from '../services/queue.service';
import { sendSuccess } from '../utils/apiResponse';

export const queueController = {
  async get(req: Request, res: Response) {
    sendSuccess(res, await queueService.getById(req.user!, req.params.id));
  },
  async forDoctor(req: Request, res: Response) {
    sendSuccess(res, await queueService.getForDoctor(req.user!, req.params.doctorId, req.query.date as string | undefined));
  },
  async mine(req: Request, res: Response) {
    sendSuccess(res, await queueService.getMyQueues(req.user!));
  },
  async call(req: Request, res: Response) {
    const result = await queueService.callNext(req.user!, req.params.id);
    sendSuccess(res, result, result.called ? `Token #${result.called.tokenNumber} called` : 'No patients waiting in the queue');
  },
  async start(req: Request, res: Response) {
    sendSuccess(res, await queueService.startConsultation(req.user!, req.params.id), 'Consultation started');
  },
  async complete(req: Request, res: Response) {
    sendSuccess(res, await queueService.complete(req.user!, req.params.id), 'Consultation completed');
  },
  async skip(req: Request, res: Response) {
    sendSuccess(res, await queueService.skip(req.user!, req.params.id), 'Patient skipped');
  },
};
