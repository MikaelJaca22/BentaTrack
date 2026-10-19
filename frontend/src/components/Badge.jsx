import { X, AlertTriangle } from 'lucide-react';

// Monochrome status badges. Status is shown via fill/border/icon/text only.
const styles = {
  pending: 'bg-white text-black border border-gray400',
  accepted: 'bg-gray200 text-black border border-gray200',
  delivered: 'bg-gray800 text-white border border-gray800',
  completed: 'bg-black text-white border border-black',
  declined: 'bg-white text-gray600 border border-gray400',
  discrepancy: 'bg-white text-black border-2 border-black',
  low: 'bg-white text-black border-2 border-black',
  default: 'bg-white text-black border border-gray300',
};

const labels = {
  pending: 'Pending',
  accepted: 'Accepted',
  delivered: 'Delivered',
  completed: 'Completed',
  declined: 'Declined',
  discrepancy: 'Discrepancy',
};

export default function Badge({ status = 'default', children }) {
  const cls = styles[status] || styles.default;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium ${cls}`}
    >
      {status === 'declined' ? <X size={12} strokeWidth={2.5} /> : null}
      {status === 'discrepancy' ? (
        <AlertTriangle size={12} strokeWidth={2.5} />
      ) : null}
      {children || labels[status] || status}
    </span>
  );
}
