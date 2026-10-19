import { View, Text } from 'react-native';

// Generic white card. Pass optional title.
export default function Card({ title, className = '', children }) {
  return (
    <View className={`bg-white border border-gray200 rounded-xl p-4 ${className}`}>
      {title ? (
        <Text className="text-sm font-semibold text-ink mb-3">{title}</Text>
      ) : null}
      {children}
    </View>
  );
}
