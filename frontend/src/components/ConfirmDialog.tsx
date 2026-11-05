import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Modal } from './Modal';

interface Props {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', tone = 'danger', loading, onConfirm, onCancel, children }: Props) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onCancel} disabled={loading}>
            Go back
          </button>
          <button className={tone === 'danger' ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={loading}>
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex gap-3">
        <div className={`h-fit rounded-full p-2 ${tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-600'}`}>
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="flex-1 text-sm text-ink-600">
          {message}
          {children && <div className="mt-4">{children}</div>}
        </div>
      </div>
    </Modal>
  );
}
