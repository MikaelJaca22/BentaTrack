import { View, Text } from 'react-native';
import { X, AlertTriangle } from 'lucide-react-native';

// Monochrome status badges for React Native.
const map = {
  pending: { bg: 'bg-white', border: 'border-gray400', text: 'text-black', icon: null, fg: '#000000' },
  accepted: { bg: 'bg-gray200', border: 'border-gray200', text: 'text-black', icon: null, fg: '#000000' },
  delivered: { bg: 'bg-gray800', border: 'border-gray800', text: 'text-white', icon: null, fg: '#FFFFFF' },
  completed: { bg: 'bg-black', border: 'border-black', text: 'text-white', icon: null, fg: '#FFFFFF' },
  declined: { bg: 'bg-white', border: 'border-gray400', text: 'text-gray600', icon: X, fg: '#525252' },
  discrepancy: { bg: 'bg-white', border: 'border-black', text: 'text-black', icon: AlertTriangle, fg: '#000000' },
  low: { bg: 'bg-white', border: 'border-black', text: 'text-black', icon: AlertTriangle, fg: '#000000' },
};

const labels = {
  pending: 'Pending',
  accepted: 'Accepted',
  delivered: 'Delivered',
  completed: 'Completed',
  declined: 'Declined',
  discrepancy: 'Discrepancy',
};

export default function Badge({ status = 'pending', children }) {
  const s = map[status] || map.pending;
  const Icon = s.icon;
  const borderWidth = status === 'discrepancy' || status === 'low' ? 2 : 1;
  return (
    <View
      className={`flex-row items-center gap-1 rounded-xl px-2.5 py-1 ${s.bg} ${s.border}`}
      style={{ borderWidth }}
    >
      {Icon ? <Icon size={12} color={s.fg} strokeWidth={2.5} /> : null}
      <Text className={`text-xs font-medium ${s.text}`}>
        {children || labels[status] || status}
      </Text>
    </View>
  );
}
