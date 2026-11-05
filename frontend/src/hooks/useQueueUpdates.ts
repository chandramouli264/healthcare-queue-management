import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

/** Joins the given queue rooms and calls onUpdate whenever one changes. */
export function useQueueUpdates(queueIds: string[], onUpdate: (queueId: string) => void) {
  const { socket } = useSocket();
  const key = queueIds.join(',');

  useEffect(() => {
    if (!socket || queueIds.length === 0) return;
    const join = () => queueIds.forEach((id) => socket.emit('queue:join', id));
    join();
    socket.on('connect', join);
    const handler = (p: { queueId: string }) => {
      if (queueIds.includes(p.queueId)) onUpdate(p.queueId);
    };
    socket.on('queue:updated', handler);
    return () => {
      socket.off('queue:updated', handler);
      socket.off('connect', join);
      queueIds.forEach((id) => socket.emit('queue:leave', id));
    };
  }, [socket, key]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Calls onChange for any appointment change relevant to the current user. */
export function useAppointmentUpdates(onChange: () => void) {
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return;
    socket.on('appointment:updated', onChange);
    return () => {
      socket.off('appointment:updated', onChange);
    };
  }, [socket]); // eslint-disable-line react-hooks/exhaustive-deps
}
