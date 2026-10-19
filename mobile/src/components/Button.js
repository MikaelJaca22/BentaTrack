import { Text, Pressable } from 'react-native';
import { Trash2 } from 'lucide-react-native';

export default function Button({
  variant = 'primary',
  icon: Icon,
  children,
  onPress,
  disabled,
  className = '',
}) {
  const base =
    'flex-row items-center justify-center gap-2 rounded-xl px-4 min-h-[48px]';
  const styles = {
    primary: 'bg-black active:bg-gray800',
    secondary: 'bg-white border border-black active:bg-gray100',
    ghost: 'bg-transparent active:bg-gray100',
  };
  const textColor = variant === 'primary' ? 'text-white' : 'text-black';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`${base} ${styles[variant] || styles.primary} ${
        disabled ? 'opacity-50' : ''
      } ${className}`}
    >
      {Icon ? (
        <Icon size={16} color={variant === 'primary' ? '#FFFFFF' : '#000000'} />
      ) : null}
      <Text className={`text-sm font-medium ${textColor}`}>{children}</Text>
    </Pressable>
  );
}
