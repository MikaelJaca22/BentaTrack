export default function Button({
  variant = 'primary',
  icon: Icon,
  children,
  className = '',
  disabled,
  ...props
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors touch-target focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';
  const styles = {
    primary: 'bg-primary text-white hover:bg-primaryDark',
    secondary:
      'bg-white text-primary border border-primary hover:bg-primaryLight',
    ghost: 'bg-transparent text-primary hover:bg-primaryLight',
  };
  return (
    <button
      className={`${base} ${styles[variant] || styles.primary} ${className}`}
      disabled={disabled}
      {...props}
    >
      {Icon ? <Icon size={16} strokeWidth={1.5} /> : null}
      {children}
    </button>
  );
}
