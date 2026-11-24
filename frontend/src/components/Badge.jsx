import { X, AlertTriangle } from 'lucide-react';

// Status badges use the system accent (primary) and danger colors.
const styles = {
  pending: 'bg-white text-primary border border-primary',
  accepted: 'bg-gray200 text-primary border border-gray200',
  delivered: 'bg-primary text-white border border-primary',
  completed: 'bg-primary text-white border border-primary',
  declined: 'bg-white text-gray600 border border-gray400',
  discrepancy: 'bg-white text-danger border-2 border-danger',
  low: 'bg-white text-danger border-2 border-danger',
  default: 'bg-white text-primary border border-gray300',
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
