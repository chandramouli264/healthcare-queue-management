import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { env } from '../config/env';
import { verifyToken } from '../utils/jwt';
import { userRepository } from '../repositories/user.repository';
import { logger } from '../utils/logger';
import { SOCKET_EVENTS } from './events';

let io: Server | null = null;

interface SocketUser {
  id: string;
  role: string;
  doctorId: string | null;
  patientId: string | null;
}

export function initSocket(server: HttpServer): Server {
  io = new Server(server, { cors: { origin: env.corsOrigins, credentials: true } });

  // Every socket must present a valid JWT (handshake auth.token).
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('UNAUTHORIZED'));
      const payload = verifyToken(token);
      const user = await userRepository.findAuthUser(payload.sub);
      if (!user || !user.isActive) return next(new Error('UNAUTHORIZED'));
      socket.data.user = {
        id: user.id,
        role: user.role,
        doctorId: user.doctor?.id ?? null,
        patientId: user.patient?.id ?? null,
      } satisfies SocketUser;
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as SocketUser;
    socket.join(`user:${user.id}`);
    if (user.doctorId) socket.join(`doctor:${user.doctorId}`);
    if (user.role === 'ADMIN' || user.role === 'RECEPTIONIST') socket.join('staff');

    // Queue rooms only carry "something changed" signals; clients re-fetch
    // through the authorised REST API, so no patient data leaks via sockets.
    socket.on(SOCKET_EVENTS.QUEUE_JOIN, (queueId: unknown) => {
      if (typeof queueId === 'string' && /^[0-9a-f-]{36}$/i.test(queueId)) socket.join(`queue:${queueId}`);
    });
    socket.on(SOCKET_EVENTS.QUEUE_LEAVE, (queueId: unknown) => {
      if (typeof queueId === 'string') socket.leave(`queue:${queueId}`);
    });
  });

  logger.info('Socket.IO initialised');
  return io;
}

export function getIO(): Server | null {
  return io;
}

export function emitQueueUpdated(queueId: string, doctorId: string, reason: string) {
  if (!io) return;
  const payload = { queueId, doctorId, reason, at: new Date().toISOString() };
  io.to(`queue:${queueId}`).to(`doctor:${doctorId}`).to('staff').emit(SOCKET_EVENTS.QUEUE_UPDATED, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function emitAppointmentChanged(doctorId: string, patientUserId: string, payload: unknown) {
  if (!io) return;
  io.to(`doctor:${doctorId}`).to(`user:${patientUserId}`).to('staff').emit(SOCKET_EVENTS.APPOINTMENT_UPDATED, payload);
}
