export default function Button({
  variant = 'primary',
  icon: Icon,
  children,
  className = '',
  disabled,
  ...props
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors touch-target focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';
  const styles = {
    primary: 'bg-black text-white hover:bg-gray800',
    secondary:
      'bg-white text-black border border-black hover:bg-gray100',
    ghost: 'bg-transparent text-black hover:bg-gray100',
  };
  return (
    <button
      className={`${base} ${styles[variant] || styles.primary} ${className}`}
      disabled={disabled}
      {...props}
    >
      {Icon ? <Icon size={16} strokeWidth={2} /> : null}
      {children}
    </button>
  );
}
