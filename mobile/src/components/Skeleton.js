import { View } from 'react-native';

export default function Skeleton({ className = '', style }) {
  return (
    <View
      className={`bg-gray200 rounded-xl ${className}`}
      style={{ height: 64, ...style }}
    />
  );
}

export function SkeletonList({ rows = 5 }) {
  return (
    <View className="gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} style={{ height: 64 }} />
      ))}
    </View>
  );
}
