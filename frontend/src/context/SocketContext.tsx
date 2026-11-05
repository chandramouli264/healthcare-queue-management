import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import { BellRing, Pill } from 'lucide-react';
import { useAuth } from './AuthContext';

const SocketContext = createContext<{ socket: Socket | null; connected: boolean }>({ socket: null, connected: false });

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token || !user) return;
    const s = io(import.meta.env.VITE_SOCKET_URL || undefined, { auth: { token }, transports: ['websocket', 'polling'] });
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('queue:patient-called', (p: { tokenNumber: number; doctor: { name: string; roomNumber: string | null } }) => {
      toast.success(`It's your turn! Token #${p.tokenNumber} – please proceed to ${p.doctor.name}${p.doctor.roomNumber ? ` (Room ${p.doctor.roomNumber})` : ''}.`, {
        duration: 10_000,
        icon: <BellRing className="h-5 w-5 text-brand-600" />,
      });
    });
    s.on('prescription:created', () => toast('A new prescription has been added to your records.', { icon: <Pill className="h-5 w-5 text-violet-600" /> }));
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [token, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return <SocketContext.Provider value={{ socket, connected }}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);
