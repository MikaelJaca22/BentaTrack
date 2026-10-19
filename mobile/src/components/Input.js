import { View, Text, TextInput } from 'react-native';
import { AlertCircle } from 'lucide-react-native';

export default function Input({ label, error, className = '', ...props }) {
  return (
    <View className="w-full mb-3">
      {label ? (
        <Text className="mb-1.5 text-sm font-medium text-ink">{label}</Text>
      ) : null}
      <TextInput
        placeholderTextColor="#A3A3A3"
        className={`w-full rounded-xl bg-white border px-3.5 py-3 text-sm text-ink ${
          error ? 'border-black' : 'border-gray300'
        } ${className}`}
        {...props}
      />
      {error ? (
        <View className="flex-row items-center gap-1.5 mt-1.5">
          <AlertCircle size={14} color="#000000" />
          <Text className="text-xs font-medium text-black">{error}</Text>
        </View>
      ) : null}
    </View>
  );
}
