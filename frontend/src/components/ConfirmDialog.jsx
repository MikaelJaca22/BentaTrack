import Modal from './Modal.jsx';
import Button from './Button.jsx';
import { Trash2 } from 'lucide-react';

export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  destructive = false,
  onConfirm,
  onClose,
  busy,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'secondary' : 'primary'}
            onClick={onConfirm}
            disabled={busy}
            icon={destructive ? Trash2 : undefined}
          >
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-gray600">{message}</p>
    </Modal>
  );
}
