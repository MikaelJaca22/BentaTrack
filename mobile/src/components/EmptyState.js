import { View, Text } from 'react-native';

export default function EmptyState({ icon: Icon, title, hint, children }) {
  return (
    <View className="items-center justify-center py-16 px-6 border border-dashed border-gray300 rounded-xl bg-white">
      {Icon ? <Icon size={32} color="#A3A3A3" strokeWidth={1.5} style={{ marginBottom: 12 }} /> : null}
      <Text className="text-sm font-semibold text-ink text-center">{title}</Text>
      {hint ? (
        <Text className="mt-1 text-xs text-gray500 text-center max-w-[260px]">{hint}</Text>
      ) : null}
      {children ? <View className="mt-4">{children}</View> : null}
    </View>
  );
}
